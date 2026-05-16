import type { OPENAEONApp } from "./app.ts";
import { loadDebug } from "./controllers/debug.ts";
import { loadAeonLogic } from "./controllers/aeon.ts";
import { loadLogs } from "./controllers/logs.ts";
import { loadNodes } from "./controllers/nodes.ts";
import { loadSandboxCognitivePlan } from "./controllers/sandbox.ts";
import { loadCognitiveTask } from "./controllers/cognitive.ts";
import type { CognitivePlanSnapshot } from "./views/sandbox.ts";

type PollingHost = {
  nodesPollInterval: number | null;
  logsPollInterval: number | null;
  debugPollInterval: number | null;
  aeonPollInterval: number | null;
  sandboxPollTimer: number | null;
  tab: string;
};

type SandboxWatchdogHost = PollingHost & {
  client: import("./gateway.ts").GatewayBrowserClient | null;
  connected: boolean;
  settings: import("./storage.ts").UiSettings;
  sessionKey: string;
  sandboxCognitivePlan: CognitivePlanSnapshot | null;
  chatSending: boolean;
  chatStream: string | null;
  chatMessage: string;
  chatChaosScore: number;
  aeonEternalMode: boolean;
  executionAutoQueued: boolean;
  lastError: string | null;
  executionWatchdog: {
    active: boolean;
    degraded: boolean;
    reason: string | null;
    retryCount: number;
    stagnantPolls: number;
    startedAt: number | null;
    lastProgressAt: number | null;
    lastDigest: string | null;
    lastRetryAt: number | null;
  };
  aeonSystemStatus?: import("./types.ts").AeonStatusResult | null;
  handleSendChat: () => Promise<void>;
};

function isPlanTodoExecutable(todo: CognitivePlanSnapshot["todos"][number]): boolean {
  return todo.status !== "done";
}

function countExecutableTodos(plan: CognitivePlanSnapshot): number {
  return (Array.isArray(plan.todos) ? plan.todos : []).filter(isPlanTodoExecutable).length;
}

async function resolveSessionCognitiveTaskId(host: SandboxWatchdogHost): Promise<string | null> {
  if (!host.client || !host.connected) {
    return null;
  }
  const sessionKey = host.sessionKey.trim();
  if (!sessionKey) {
    return null;
  }
  try {
    const list = await host.client.request<{
      ok?: boolean;
      tasks?: Array<{ id: string; sessionKey: string; updatedAt: number }>;
    }>("cognitive.task.list", { limit: 80 });
    const tasks = Array.isArray(list?.tasks) ? list.tasks : [];
    const match = tasks
      .filter((task) => task.sessionKey === sessionKey)
      .toSorted((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];
    return match?.id ?? null;
  } catch {
    return null;
  }
}

async function runEternalPlanningAutodrive(host: SandboxWatchdogHost): Promise<void> {
  const plan = host.sandboxCognitivePlan;
  if (!host.aeonEternalMode || !plan || plan.phase !== "planning") {
    return;
  }
  if (!host.client || !host.connected || !host.sessionKey) {
    return;
  }
  if (countExecutableTodos(plan) <= 0) {
    return;
  }
  if (host.chatSending || Boolean(host.chatStream?.trim())) {
    return;
  }
  const now = Date.now();
  if (
    host.executionWatchdog.lastRetryAt != null &&
    now - host.executionWatchdog.lastRetryAt < 8_000
  ) {
    return;
  }
  try {
    const taskId = await resolveSessionCognitiveTaskId(host);
    if (!taskId) {
      return;
    }
    await host.client.request<{ ok?: boolean; task?: { id: string } }>(
      "cognitive.task.transition",
      {
        taskId,
        to: "EXECUTE",
        reason: "ui_eternal_auto_approve",
      },
    );
    await loadSandboxCognitivePlan(host as unknown as OPENAEONApp);
    host.executionWatchdog = {
      ...host.executionWatchdog,
      lastRetryAt: now,
      reason: "eternal_auto_approved",
    };
    const executionPrompt =
      "永恒模式自动推进：立即进入 execution，禁止回到 planning。按 TODO 逐项完成；复杂任务必须使用 sessions_spawn 并行子代理并汇总结果后再进入 verification。";
    if (host.chatSending || Boolean(host.chatStream?.trim())) {
      host.chatMessage = executionPrompt;
      host.executionAutoQueued = true;
      return;
    }
    host.executionAutoQueued = false;
    host.chatMessage = executionPrompt;
    await host.handleSendChat();
  } catch (err) {
    host.lastError = `Eternal auto-drive failed: ${String(err)}`;
    host.executionWatchdog = {
      ...host.executionWatchdog,
      degraded: true,
      reason: "eternal_auto_approve_failed",
      lastRetryAt: now,
    };
  }
}

function digestCognitivePlan(plan: CognitivePlanSnapshot): string {
  const parts = (plan.todos ?? []).map((todo) => `${todo.id}:${todo.status}`).sort();
  return `${plan.phase ?? "planning"}|${parts.join("|")}`;
}

function mirrorWatchdogToTelemetry(host: SandboxWatchdogHost) {
  const auto = host.aeonSystemStatus?.telemetry?.v4?.autospawn;
  if (!auto) {
    return;
  }
  auto.watchdogActive = host.executionWatchdog.active;
  auto.degraded = host.executionWatchdog.degraded;
  auto.degradedReason = host.executionWatchdog.reason;
  auto.retryCount = host.executionWatchdog.retryCount;
}

async function runExecutionAutopilotTick(host: SandboxWatchdogHost): Promise<void> {
  const plan = host.sandboxCognitivePlan;
  if (!host.connected || !host.client) {
    return;
  }
  if (!plan || plan.phase !== "execution") {
    return;
  }
  if ((host.settings.chatAutopilotEnabled ?? true) !== true) {
    return;
  }
  try {
    const taskId = await resolveSessionCognitiveTaskId(host);
    if (!taskId) {
      return;
    }
    await host.client.request<{ ok?: boolean; task?: { id: string } }>(
      "cognitive.runtime.dispatch",
      {
        taskId,
      },
    );
    await loadSandboxCognitivePlan(host as unknown as OPENAEONApp);
  } catch {
    // best-effort tick; watchdog handles degraded recovery path
  }
}

async function runExecutionWatchdog(host: SandboxWatchdogHost) {
  const plan = host.sandboxCognitivePlan;
  if (
    !plan ||
    plan.phase !== "execution" ||
    !Array.isArray(plan.todos) ||
    plan.todos.length === 0
  ) {
    if (host.executionWatchdog.active || host.executionWatchdog.degraded) {
      host.executionWatchdog = {
        active: false,
        degraded: false,
        reason: null,
        retryCount: 0,
        stagnantPolls: 0,
        startedAt: null,
        lastProgressAt: null,
        lastDigest: null,
        lastRetryAt: null,
      };
      mirrorWatchdogToTelemetry(host);
    }
    return;
  }
  const now = Date.now();
  const digest = digestCognitivePlan(plan);
  if (!host.executionWatchdog.active) {
    host.executionWatchdog = {
      ...host.executionWatchdog,
      active: true,
      degraded: false,
      reason: null,
      stagnantPolls: 0,
      startedAt: now,
      lastProgressAt: now,
      lastDigest: digest,
    };
    mirrorWatchdogToTelemetry(host);
    return;
  }
  const changed = host.executionWatchdog.lastDigest !== digest;
  if (changed) {
    host.executionWatchdog = {
      ...host.executionWatchdog,
      degraded: false,
      reason: null,
      stagnantPolls: 0,
      lastProgressAt: now,
      lastDigest: digest,
    };
    mirrorWatchdogToTelemetry(host);
    return;
  }
  if (host.chatSending || Boolean(host.chatStream?.trim())) {
    return;
  }
  const stagnantPolls = host.executionWatchdog.stagnantPolls + 1;
  host.executionWatchdog = {
    ...host.executionWatchdog,
    stagnantPolls,
  };
  if (stagnantPolls >= 6 && host.executionWatchdog.retryCount < 1) {
    host.executionWatchdog = {
      ...host.executionWatchdog,
      retryCount: host.executionWatchdog.retryCount + 1,
      stagnantPolls: 0,
      lastRetryAt: now,
      reason: "execution_stalled_retrying",
    };
    host.chatMessage =
      "继续执行当前 execution 阶段的 TODO，禁止回到 planning。按顺序逐项完成并回填结果。";
    await host.handleSendChat();
    mirrorWatchdogToTelemetry(host);
    return;
  }
  if (stagnantPolls >= 10 && host.executionWatchdog.retryCount >= 1) {
    host.executionWatchdog = {
      ...host.executionWatchdog,
      degraded: true,
      reason: "execution_stalled_after_retry",
    };
    mirrorWatchdogToTelemetry(host);
  }
}

export function startNodesPolling(host: PollingHost) {
  if (host.nodesPollInterval != null) {
    return;
  }
  host.nodesPollInterval = window.setInterval(
    () => void loadNodes(host as unknown as OPENAEONApp, { quiet: true }),
    5000,
  );
}

export function stopNodesPolling(host: PollingHost) {
  if (host.nodesPollInterval == null) {
    return;
  }
  clearInterval(host.nodesPollInterval);
  host.nodesPollInterval = null;
}

export function startLogsPolling(host: PollingHost) {
  if (host.logsPollInterval != null) {
    return;
  }
  host.logsPollInterval = window.setInterval(() => {
    if (host.tab !== "logs") {
      return;
    }
    void loadLogs(host as unknown as OPENAEONApp, { quiet: true });
  }, 2000);
}

export function stopLogsPolling(host: PollingHost) {
  if (host.logsPollInterval == null) {
    return;
  }
  clearInterval(host.logsPollInterval);
  host.logsPollInterval = null;
}

export function startDebugPolling(host: PollingHost) {
  if (host.debugPollInterval != null) {
    return;
  }
  host.debugPollInterval = window.setInterval(() => {
    if (host.tab !== "debug") {
      return;
    }
    void loadDebug(host as unknown as OPENAEONApp);
  }, 3000);
}

export function stopDebugPolling(host: PollingHost) {
  if (host.debugPollInterval == null) {
    return;
  }
  clearInterval(host.debugPollInterval);
  host.debugPollInterval = null;
}

export function startSandboxPolling(host: PollingHost & { sessionKey: string }) {
  if (host.sandboxPollTimer != null) {
    return;
  }
  host.sandboxPollTimer = window.setInterval(() => {
    if (host.tab !== "chat") {
      return;
    }
    void (async () => {
      await loadSandboxCognitivePlan(host as unknown as OPENAEONApp);
      await runEternalPlanningAutodrive(host as unknown as SandboxWatchdogHost);
      await runExecutionAutopilotTick(host as unknown as SandboxWatchdogHost);
      await runExecutionWatchdog(host as unknown as SandboxWatchdogHost);
    })();
  }, 2000);
}

export function stopSandboxPolling(host: PollingHost) {
  if (host.sandboxPollTimer == null) {
    return;
  }
  clearInterval(host.sandboxPollTimer);
  host.sandboxPollTimer = null;
}

export function startAeonPolling(host: PollingHost) {
  if (host.aeonPollInterval != null) {
    return;
  }
  host.aeonPollInterval = window.setInterval(() => {
    if (host.tab !== "aeon" && host.tab !== "chat" && host.tab !== "cognitive") {
      return;
    }
    const sessionKey =
      typeof (host as { sessionKey?: unknown }).sessionKey === "string"
        ? ((host as unknown as { sessionKey: string }).sessionKey || "").trim()
        : "";

    if (host.tab === "cognitive") {
      void loadCognitiveTask(host as unknown as any);
    }

    const shouldPollForAeonLogic =
      host.tab === "aeon" ||
      (host.tab === "chat" &&
        (sessionKey === "" || sessionKey === "main" || sessionKey === "agent:main:main"));

    if (shouldPollForAeonLogic) {
      void loadAeonLogic(host as unknown as any);
    }
  }, 5000);
}

export function stopAeonPolling(host: PollingHost) {
  if (host.aeonPollInterval == null) {
    return;
  }
  clearInterval(host.aeonPollInterval);
  host.aeonPollInterval = null;
}
