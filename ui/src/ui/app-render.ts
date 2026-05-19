import { html, nothing } from "lit";
import { parseAgentSessionKey } from "../../../src/routing/session-key.js";
import { t, i18n } from "../i18n/index.ts";
import { refreshChatAvatar } from "./app-chat.ts";
import { renderUsageTab } from "./app-render-usage-tab.ts";
import { renderChatControls, renderTab, renderThemeToggle } from "./app-render.helpers.ts";
import "./components/language-switcher.ts";
import type { AppViewState } from "./app-view-state.ts";
import { loadAgentFileContent, loadAgentFiles, saveAgentFile } from "./controllers/agent-files.ts";
import { loadAgentIdentities, loadAgentIdentity } from "./controllers/agent-identity.ts";
import {
  deleteAgentKnowledgeFile,
  loadAgentKnowledge,
  loadAgentKnowledgeFileContent,
  loadAgentKnowledgeStatus,
  saveAgentKnowledgeFile,
} from "./controllers/agent-knowledge.ts";
import { loadAgentSkills } from "./controllers/agent-skills.ts";
import { loadAgents, loadToolsCatalog } from "./controllers/agents.ts";
import { loadChannels } from "./controllers/channels.ts";
import { loadChatHistory } from "./controllers/chat.ts";
import {
  dispatchCognitiveTask,
  forceStartCognitiveNode,
  submitCognitiveTask,
} from "./controllers/cognitive.ts";
import {
  applyConfig,
  loadConfig,
  runUpdate,
  saveConfig,
  updateConfigFormValue,
  removeConfigFormValue,
} from "./controllers/config.ts";
import {
  loadCronRuns,
  loadMoreCronJobs,
  loadMoreCronRuns,
  reloadCronJobs,
  toggleCronJob,
  runCronJob,
  removeCronJob,
  addCronJob,
  startCronEdit,
  startCronClone,
  cancelCronEdit,
  validateCronForm,
  hasCronFormErrors,
  normalizeCronFormState,
  getVisibleCronJobs,
  updateCronJobsFilter,
  updateCronRunsFilter,
} from "./controllers/cron.ts";
import { loadDebug, callDebugMethod } from "./controllers/debug.ts";
import {
  approveDevicePairing,
  loadDevices,
  rejectDevicePairing,
  revokeDeviceToken,
  rotateDeviceToken,
} from "./controllers/devices.ts";
import {
  loadExecApprovals,
  removeExecApprovalsFormValue,
  saveExecApprovals,
  updateExecApprovalsFormValue,
} from "./controllers/exec-approvals.ts";
import { loadLogs } from "./controllers/logs.ts";
import { loadNodes } from "./controllers/nodes.ts";
import { loadPresence } from "./controllers/presence.ts";
import { loadSandboxCognitivePlan } from "./controllers/sandbox.ts";
import { deleteSessionAndRefresh, loadSessions, patchSession } from "./controllers/sessions.ts";
import {
  installSkill,
  loadSkills,
  saveSkillApiKey,
  saveSkillBaseUrl,
  saveSkillProxy,
  updateSkillEdit,
  updateSkillEnabled,
} from "./controllers/skills.ts";
import { buildExternalLinkRel, EXTERNAL_LINK_TARGET } from "./external-link.ts";
import { icons } from "./icons.ts";
import { normalizeBasePath, TAB_GROUPS, subtitleForTab, titleForTab } from "./navigation.ts";
import { resolveConfiguredCronModelSuggestions } from "./views/agents-utils.ts";
import { renderAeonLogic } from "./views/aeon-logic.ts";
import { renderAgents } from "./views/agents.ts";
import { renderChannels } from "./views/channels.ts";
import { renderChat } from "./views/chat.ts";
import { isPlaceholderCognitivePlanTodo } from "./views/chat/components/subagent-view-model.ts";
import { renderCognitiveView } from "./views/cognitive.ts";
import { renderConfig } from "./views/config.ts";
import { renderCron } from "./views/cron.ts";
import { renderDebug } from "./views/debug.ts";
import { renderExecApprovalPrompt } from "./views/exec-approval.ts";
import { renderGatewayUrlConfirmation } from "./views/gateway-url-confirmation.ts";
import { renderInstances } from "./views/instances.ts";
import { renderLogs } from "./views/logs.ts";
import { renderNodes } from "./views/nodes.ts";
import { renderOverview } from "./views/overview.ts";
import { renderSandbox } from "./views/sandbox/index.ts";
import { renderSessions } from "./views/sessions.ts";
import { renderSkills } from "./views/skills.ts";
import { renderCognitivePlanConfirmation } from "./views/cognitive-plan-confirmation.ts";

const AVATAR_DATA_RE = /^data:/i;
const AVATAR_HTTP_RE = /^https?:\/\//i;
const chatDraftCache = new WeakMap<object, Map<string, string>>();
const CRON_THINKING_SUGGESTIONS = ["off", "minimal", "low", "medium", "high"];
const CRON_TIMEZONE_SUGGESTIONS = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
];

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function normalizeSuggestionValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function uniquePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(normalized);
  }
  return output;
}

function normalizeSubagentId(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (normalized.length > 0) {
    return normalized.slice(0, 48);
  }
  const fallbackNormalized = fallback
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return fallbackNormalized.length > 0 ? fallbackNormalized.slice(0, 48) : "worker";
}

function resolveChatPerformanceMode(state: AppViewState): "performance" | "balanced" | "visual" {
  const config = state.configForm ?? state.configSnapshot?.config ?? null;
  const ui = config && typeof config === "object" ? (config as Record<string, unknown>).ui : null;
  const chat = ui && typeof ui === "object" ? (ui as Record<string, unknown>).chat : null;
  const mode =
    chat && typeof chat === "object"
      ? (chat as Record<string, unknown>).performanceMode
      : undefined;
  return mode === "performance" || mode === "visual" || mode === "balanced" ? mode : "balanced";
}

function resolveSubagentMatchMode(state: AppViewState): "owner_first" | "balanced" | "fuzzy" {
  const config = state.configForm ?? state.configSnapshot?.config ?? null;
  const ui = config && typeof config === "object" ? (config as Record<string, unknown>).ui : null;
  const chat = ui && typeof ui === "object" ? (ui as Record<string, unknown>).chat : null;
  const mode =
    chat && typeof chat === "object"
      ? (chat as Record<string, unknown>).subagentMatchMode
      : undefined;
  return mode === "owner_first" || mode === "balanced" || mode === "fuzzy" ? mode : "balanced";
}

function resolveAssistantAvatarUrl(state: AppViewState): string | undefined {
  const list = state.agentsList?.agents ?? [];
  const parsed = parseAgentSessionKey(state.sessionKey);
  const agentId = parsed?.agentId ?? state.agentsList?.defaultId ?? "main";
  const agent = list.find((entry) => entry.id === agentId);
  const identity = agent?.identity;
  const candidate = identity?.avatarUrl ?? identity?.avatar;
  if (!candidate) {
    return undefined;
  }
  if (AVATAR_DATA_RE.test(candidate) || AVATAR_HTTP_RE.test(candidate)) {
    return candidate;
  }
  return identity?.avatarUrl;
}

function cacheDraft(state: AppViewState, sessionKey: string, draft: string) {
  const key = sessionKey.trim();
  if (!key) {
    return;
  }
  let perSession = chatDraftCache.get(state);
  if (!perSession) {
    perSession = new Map<string, string>();
    chatDraftCache.set(state, perSession);
  }
  perSession.set(key, draft);
}

function restoreDraft(state: AppViewState, sessionKey: string): string {
  const key = sessionKey.trim();
  if (!key) {
    return "";
  }
  const perSession = chatDraftCache.get(state);
  if (!perSession) {
    return "";
  }
  return perSession.get(key) ?? "";
}

export function renderApp(state: AppViewState) {
  const openClawVersion =
    (typeof state.hello?.server?.version === "string" && state.hello.server.version.trim()) ||
    state.updateAvailable?.currentVersion ||
    t("common.na");
  const availableUpdate =
    state.updateAvailable &&
    state.updateAvailable.latestVersion !== state.updateAvailable.currentVersion
      ? state.updateAvailable
      : null;
  const versionStatusClass = availableUpdate ? "warn" : "ok";
  const presenceCount = state.presenceEntries.length;
  const sessionsCount = state.sessionsResult?.count ?? null;
  const cronNext = state.cronStatus?.nextWakeAtMs ?? null;
  const chatDisabledReason = state.connected ? null : t("chat.disconnected");
  const isChat = state.tab === "chat";
  const chatFocus = isChat && (state.settings.chatFocusMode || state.onboarding);
  const showThinking = state.onboarding ? false : state.settings.chatShowThinking;
  const assistantAvatarUrl = resolveAssistantAvatarUrl(state);
  const chatAvatarUrl = state.chatAvatarUrl ?? assistantAvatarUrl ?? null;
  const configValue = state.configForm ?? state.configSnapshot?.config ?? null;
  const basePath = normalizeBasePath(state.basePath ?? "");
  const resolvedAgentId =
    state.agentsSelectedId ??
    state.agentsList?.defaultId ??
    state.agentsList?.agents?.[0]?.id ??
    null;
  const cronAgentSuggestions = Array.from(
    new Set(
      [
        ...(state.agentsList?.agents?.map((entry) => entry.id.trim()) ?? []),
        ...state.cronJobs
          .map((job) => (typeof job.agentId === "string" ? job.agentId.trim() : ""))
          .filter(Boolean),
      ].filter(Boolean),
    ),
  ).toSorted((a, b) => a.localeCompare(b));
  const cronModelSuggestions = Array.from(
    new Set(
      [
        ...state.cronModelSuggestions,
        ...resolveConfiguredCronModelSuggestions(configValue),
        ...state.cronJobs
          .map((job) => {
            if (job.payload.kind !== "agentTurn" || typeof job.payload.model !== "string") {
              return "";
            }
            return job.payload.model.trim();
          })
          .filter(Boolean),
      ].filter(Boolean),
    ),
  ).toSorted((a, b) => a.localeCompare(b));
  const visibleCronJobs = getVisibleCronJobs(state);
  const selectedDeliveryChannel =
    state.cronForm.deliveryChannel && state.cronForm.deliveryChannel.trim()
      ? state.cronForm.deliveryChannel.trim()
      : "last";
  const jobToSuggestions = state.cronJobs
    .map((job) => normalizeSuggestionValue(job.delivery?.to))
    .filter(Boolean);
  const accountToSuggestions = (
    selectedDeliveryChannel === "last"
      ? Object.values(state.channelsSnapshot?.channelAccounts ?? {}).flat()
      : (state.channelsSnapshot?.channelAccounts?.[selectedDeliveryChannel] ?? [])
  )
    .flatMap((account) => [
      normalizeSuggestionValue(account.accountId),
      normalizeSuggestionValue(account.name),
    ])
    .filter(Boolean);
  const rawDeliveryToSuggestions = uniquePreserveOrder([
    ...jobToSuggestions,
    ...accountToSuggestions,
  ]);
  const deliveryToSuggestions =
    state.cronForm.deliveryMode === "webhook"
      ? rawDeliveryToSuggestions.filter((value) => isHttpUrl(value))
      : rawDeliveryToSuggestions;

  const cg = state.aeonSystemStatus?.cognitiveState;
  const peanoCoord = cg?.topo ??
    state.aeonSystemStatus?.peanoCoordinate ?? { x: 0.5, y: 0.5, z: 0.5 };
  const resonanceActive =
    (state.aeonSystemStatus?.resonanceActive ?? (state.aeonSystemStatus?.chaosScore ?? 0) > 4) ||
    state.chatChaosScore > 4;
  const chaosScore = Math.max(state.aeonSystemStatus?.chaosScore ?? 0, state.chatChaosScore);
  const epiphanyFactor = Math.max(
    state.aeonSystemStatus?.epiphanyFactor ?? 0,
    state.chatEpiphanyFactor,
  );
  const memorySaturation = state.aeonSystemStatus?.memorySaturation ?? 0;
  const riskScore = state.aeonSystemStatus?.telemetry?.v4?.inference?.riskScore ?? 0;
  const switchChatSession = (next: string) => {
    cacheDraft(state, state.sessionKey, state.chatMessage);
    state.sessionKey = next;
    state.chatMessage = restoreDraft(state, next);
    state.chatAttachments = [];
    state.chatStream = null;
    state.chatStreamStartedAt = null;
    state.chatRunId = null;
    state.chatQueue = [];
    state.resetToolStream();
    state.resetChatScroll();
    state.sandboxCognitivePlan = null;
    state.sandboxCognitivePlanLoading = false;
    state.sandboxCognitivePlanError = null;
    state.executionWatchdog = {
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
    state.executionAutoQueued = false;
    state.sandboxChatEvents = {};
    state.aeonThinkingCursor = null;
    state.aeonThinkingEvents = [];
    state.aeonEternalHydratedSessionKey = null;
    state.applySettings({
      ...state.settings,
      sessionKey: next,
      lastActiveSessionKey: next,
    });
    void state.loadAssistantIdentity();
    void loadChatHistory(state);
    void refreshChatAvatar(state);
  };
  const handleQuickCommand = (input: { name: string; args: string[]; raw: string }) => {
    const name = input.name.trim().toLowerCase();
    const arg = input.args[0]?.trim().toLowerCase() ?? "";
    if (name === "new") {
      void state.handleSendChat("/new", { restoreDraft: true });
      return;
    }
    if (name === "main") {
      if (state.sessionKey !== "main") {
        switchChatSession("main");
      }
      return;
    }
    if (name === "sandbox") {
      state.setTab("sandbox");
      return;
    }
    if (name === "aeon") {
      state.setTab("aeon");
      return;
    }
    if (name === "focus") {
      if (state.onboarding) {
        return;
      }
      state.applySettings({
        ...state.settings,
        chatFocusMode: !state.settings.chatFocusMode,
      });
      return;
    }
    if (name === "thinking") {
      if (state.onboarding) {
        return;
      }
      state.applySettings({
        ...state.settings,
        chatShowThinking: !state.settings.chatShowThinking,
      });
      return;
    }
    if (name === "eternal") {
      const next = arg === "on" ? true : arg === "off" ? false : !state.aeonEternalMode;
      void state.handleToggleEternalMode(next, "local");
      return;
    }
    if (name === "web") {
      const next = arg === "on" ? true : arg === "off" ? false : !state.chatWebSearchEnabled;
      state.handleToggleWebSearch(next);
      return;
    }
    if (name === "refresh") {
      state.resetToolStream();
      void Promise.all([loadChatHistory(state), refreshChatAvatar(state)]);
      return;
    }
    if (name === "clear") {
      state.chatMessage = "";
    }
  };
  const handleRecoverExecution = () => {
    const staleCount = state.sandboxCognitivePlan?.executionGraph?.staleTodoIds?.length ?? 0;
    const longRunningCount =
      state.sandboxCognitivePlan?.executionGraph?.longRunningTodoIds?.length ?? 0;
    const recoveryPrompt =
      staleCount > 0 || longRunningCount > 0
        ? `恢复 execution：优先处理 stale(${staleCount}) 与 long-running(${longRunningCount}) 任务，逐步回填进展，禁止回到 planning。`
        : "恢复 execution：继续推进当前 TODO，逐步回填进展，禁止回到 planning。";
    if (state.chatSending || Boolean(state.chatStream?.trim())) {
      state.chatMessage = recoveryPrompt;
      state.executionAutoQueued = true;
      return;
    }
    state.executionAutoQueued = false;
    state.chatMessage = recoveryPrompt;
    void state.handleSendChat();
  };
  const applyCognitivePlanResponse = (res: {
    plan?: import("./views/sandbox/types.ts").CognitivePlanSnapshot | null;
    executionGraph?: import("./views/sandbox/types.ts").CognitivePlanSnapshot["executionGraph"];
    taskRuntime?: import("./views/sandbox/types.ts").CognitivePlanSnapshot["taskRuntime"];
  }) => {
    if (!res.plan) {
      return;
    }
    state.sandboxCognitivePlan = {
      ...res.plan,
      executionGraph: res.executionGraph ?? res.plan.executionGraph,
      taskRuntime: res.taskRuntime ?? res.plan.taskRuntime,
    };
  };
  const resolveSelectedCognitiveTaskId = async (): Promise<string | null> => {
    if (!state.client) {
      return null;
    }
    const listRes = await state.client.request<{
      ok?: boolean;
      tasks?: Array<{ id: string; sessionKey: string; updatedAt: number }>;
    }>("cognitive.task.list", { limit: 80 });
    const tasks = Array.isArray(listRes?.tasks) ? listRes.tasks : [];
    const selected = tasks
      .filter((task) => task.sessionKey === state.sessionKey)
      .toSorted((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];
    return selected?.id ?? null;
  };
  const runAutopilotTick = (maxConcurrent: number) => {
    void (async () => {
      if (!state.client || !state.connected) {
        return;
      }
      const nextMax = Math.max(1, Math.min(8, Math.floor(maxConcurrent)));
      try {
        const taskId = await resolveSelectedCognitiveTaskId();
        if (!taskId) {
          return;
        }
        await state.client.request<{ ok?: boolean; task?: unknown }>("cognitive.runtime.dispatch", {
          taskId,
        });
        await loadSandboxCognitivePlan(state as any);
      } catch (err) {
        state.lastError = `Failed to update autopilot parallelism: ${String(err)}`;
      }
    })();
  };
  const handleWorkbenchSend = (message?: string, options?: { mode?: string }) => {
    if (options?.mode === "agent") {
      const text = (message ?? state.chatMessage).trim();
      if (!text) {
        state.lastError = "Agent delegation needs a mission prompt.";
        return;
      }
      const ownerId = normalizeSubagentId(
        state.sandboxCognitivePlan?.todos?.find((todo) => todo.status === "in_progress")
          ?.ownerAgent ?? "",
        "agent-delegate",
      );
      state.chatMessage = "";
      state.chatAttachments = [];
      void state.handleSendChat(`/subagents spawn ${ownerId} ${text}`, {
        restoreDraft: true,
        mode: "agent",
      });
      return;
    }

    if (options?.mode !== "task" && options?.mode !== "dispatch") {
      return state.handleSendChat(message, options);
    }

    void (async () => {
      const text = (message ?? state.chatMessage).trim();
      if (!text && options.mode === "task") {
        return;
      }
      if (!state.client || !state.connected) {
        state.lastError = "Cognitive runtime is not connected.";
        return;
      }

      try {
        let taskId = await resolveSelectedCognitiveTaskId();
        if (options.mode === "task" || !taskId) {
          if (!text) {
            state.lastError = "Dispatch needs an existing Cognitive task or a task prompt.";
            return;
          }
          const title = text.split(/\r?\n/, 1)[0]?.slice(0, 80) || "Cognitive Task";
          const submitted = await submitCognitiveTask(state, { title, text });
          taskId = submitted?.id ?? null;
        }

        if (options.mode === "dispatch" && taskId) {
          await dispatchCognitiveTask(state);
        }

        state.chatMessage = "";
        state.chatAttachments = [];
        await loadSandboxCognitivePlan(state);
      } catch (err) {
        state.lastError = `Failed to run Cognitive ${options.mode}: ${String(err)}`;
      }
    })();
  };
  const handleAutopilotMaxConcurrentChange = (maxConcurrent: number) => {
    const nextMax = Math.max(1, Math.min(8, Math.floor(maxConcurrent)));
    state.applySettings({
      ...state.settings,
      chatAutopilotMaxConcurrent: nextMax,
    });
    runAutopilotTick(nextMax);
  };
  const handleRetryPlanStage = () => {
    void (async () => {
      if (!state.client) {
        return;
      }
      const confirmed = await state.requestCognitivePlanConfirmation({
        action: "retry",
        title: "Retry Current Stage",
        message: "This will re-enter execution and append a new checkpoint.",
        confirmLabel: "Retry Stage",
        details: [
          `session=${state.sessionKey}`,
          `phase=${state.sandboxCognitivePlan?.phase ?? "unknown"}`,
          `branch=${state.sandboxCognitivePlan?.taskRuntime?.currentBranchId ?? "main"}`,
        ],
      });
      if (!confirmed) {
        return;
      }
      try {
        const taskId = await resolveSelectedCognitiveTaskId();
        if (!taskId) {
          return;
        }
        await state.client.request<{ ok?: boolean; task?: unknown }>("cognitive.task.transition", {
          taskId,
          to: "EXECUTE",
          reason: "ui_retry_execution_stage",
        });
        await loadSandboxCognitivePlan(state as any);
        if (state.chatSending || Boolean(state.chatStream?.trim())) {
          state.executionAutoQueued = true;
          state.chatMessage = "已触发 retry。继续 execution，逐项推进并回填结果。";
          return;
        }
        state.executionAutoQueued = false;
        state.chatMessage = "已触发 retry。继续 execution，逐项推进并回填结果。";
        await state.handleSendChat();
      } catch (err) {
        state.lastError = `Failed to retry stage: ${String(err)}`;
      }
    })();
  };
  const handleBranchFromCurrent = () => {
    void (async () => {
      if (!state.client) {
        return;
      }
      const customBranch = window.prompt("Branch id (optional):", "")?.trim() ?? "";
      const confirmed = await state.requestCognitivePlanConfirmation({
        action: "branch",
        title: customBranch ? "Create or Switch Branch" : "Create New Branch",
        message: customBranch
          ? `Branch target: ${customBranch}`
          : "A new branch id will be generated from current state.",
        confirmLabel: "Create Branch",
        details: [
          `session=${state.sessionKey}`,
          `fromBranch=${state.sandboxCognitivePlan?.taskRuntime?.currentBranchId ?? "main"}`,
        ],
      });
      if (!confirmed) {
        return;
      }
      try {
        state.lastError =
          "Branch operations are not available in Cognitive-only mode. Use task transitions and replay instead.";
      } catch (err) {
        state.lastError = `Failed to create branch: ${String(err)}`;
      }
    })();
  };
  const handleRestoreCheckpoint = (checkpointId: string) => {
    void (async () => {
      if (!state.client || !checkpointId) {
        return;
      }
      const checkpoint = state.sandboxCognitivePlan?.checkpoints?.find(
        (entry) => entry.checkpointId === checkpointId,
      );
      const confirmed = await state.requestCognitivePlanConfirmation({
        action: "restore",
        title: "Restore Checkpoint",
        message: `Restore ${checkpointId.slice(0, 18)} and append restore checkpoint.`,
        confirmLabel: "Restore",
        details: [
          `session=${state.sessionKey}`,
          `phase=${checkpoint?.stageId ?? "unknown"}`,
          `branch=${checkpoint?.branchId ?? state.sandboxCognitivePlan?.taskRuntime?.currentBranchId ?? "main"}`,
          `reason=${checkpoint?.reason ?? "unknown"}`,
        ],
      });
      if (!confirmed) {
        return;
      }
      try {
        const taskId = await resolveSelectedCognitiveTaskId();
        if (!taskId) {
          return;
        }
        await state.client.request<{ ok?: boolean; task?: unknown }>("cognitive.task.transition", {
          taskId,
          to: "PLAN",
          reason: "ui_restore_as_replan",
        });
        await loadSandboxCognitivePlan(state as any);
      } catch (err) {
        state.lastError = `Failed to restore checkpoint: ${String(err)}`;
      }
    })();
  };
  const handleRollbackToLatestCheckpoint = () => {
    void (async () => {
      if (!state.client) {
        return;
      }
      const checkpointId = state.sandboxCognitivePlan?.taskRuntime?.latestCheckpointId;
      if (!checkpointId) {
        state.lastError = "No checkpoint available for rollback.";
        return;
      }
      const latest = state.sandboxCognitivePlan?.checkpoints?.find(
        (entry) => entry.checkpointId === checkpointId,
      );
      const confirmed = await state.requestCognitivePlanConfirmation({
        action: "rollback-latest",
        title: "Rollback to Latest Checkpoint",
        message: `Rollback target: ${checkpointId.slice(0, 18)}`,
        confirmLabel: "Rollback",
        details: [
          `session=${state.sessionKey}`,
          `phase=${latest?.stageId ?? "unknown"}`,
          `branch=${latest?.branchId ?? state.sandboxCognitivePlan?.taskRuntime?.currentBranchId ?? "main"}`,
          `reason=${latest?.reason ?? "unknown"}`,
        ],
      });
      if (!confirmed) {
        return;
      }
      try {
        const taskId = await resolveSelectedCognitiveTaskId();
        if (!taskId) {
          return;
        }
        await state.client.request<{ ok?: boolean; task?: unknown }>("cognitive.task.transition", {
          taskId,
          to: "PLAN",
          reason: "ui_rollback_as_replan",
        });
        await loadSandboxCognitivePlan(state as any);
      } catch (err) {
        state.lastError = `Failed to rollback checkpoint: ${String(err)}`;
      }
    })();
  };
  const handleSwitchBranch = (branchId: string) => {
    void (async () => {
      if (!state.client || !branchId) {
        return;
      }
      const confirmed = await state.requestCognitivePlanConfirmation({
        action: "switch-branch",
        title: "Switch Branch",
        message: `Switch to branch "${branchId}" and append transition checkpoint.`,
        confirmLabel: "Switch Branch",
        details: [
          `session=${state.sessionKey}`,
          `fromBranch=${state.sandboxCognitivePlan?.taskRuntime?.currentBranchId ?? "main"}`,
          `toBranch=${branchId}`,
        ],
      });
      if (!confirmed) {
        return;
      }
      try {
        state.lastError =
          "Branch switching is not available in Cognitive-only mode. Use task transitions and replay instead.";
      } catch (err) {
        state.lastError = `Failed to switch branch: ${String(err)}`;
      }
    })();
  };
  const handleVerifierReport = (status: "passed" | "failed" | "blocked") => {
    void (async () => {
      if (!state.client) {
        return;
      }
      const stageId = state.sandboxCognitivePlan?.phase ?? "execution";
      const summary =
        status === "passed"
          ? "Verifier checks passed"
          : status === "failed"
            ? "Verifier checks failed"
            : "Verifier blocked pending evidence";
      const confirmed = await state.requestCognitivePlanConfirmation({
        action: "retry",
        title: "Submit Verifier Result",
        message: `Submit verifier status: ${status}`,
        confirmLabel: "Submit",
        details: [
          `session=${state.sessionKey}`,
          `stage=${stageId}`,
          `branch=${state.sandboxCognitivePlan?.taskRuntime?.currentBranchId ?? "main"}`,
        ],
      });
      if (!confirmed) {
        return;
      }
      try {
        const taskId = await resolveSelectedCognitiveTaskId();
        if (!taskId) {
          return;
        }
        const to =
          status === "passed"
            ? "VERIFY"
            : status === "failed" || status === "blocked"
              ? "REFLECT"
              : null;
        if (to) {
          await state.client.request<{ ok?: boolean; task?: unknown }>(
            "cognitive.task.transition",
            {
              taskId,
              to,
              reason: `ui_verifier_${status}`,
            },
          );
        }
        await state.client.request<{ ok?: boolean; reflection?: unknown }>(
          "cognitive.cognition.reflect",
          {
            taskId,
            output: summary,
            success: status === "passed",
          },
        );
        await loadSandboxCognitivePlan(state as any);
      } catch (err) {
        state.lastError = `Failed to submit verifier result: ${String(err)}`;
      }
    })();
  };
  const handleDistillDream = () => {
    void (async () => {
      if (!state.client) {
        return;
      }
      const phase = state.sandboxCognitivePlan?.phase ?? "execution";
      const branch = state.sandboxCognitivePlan?.taskRuntime?.currentBranchId ?? "main";
      const latestVerifier = state.sandboxCognitivePlan?.verifierHistory?.slice(-1)[0];
      const summary =
        phase === "planning"
          ? "Planning decisions distilled"
          : phase === "execution"
            ? "Execution progress distilled"
            : phase === "verification"
              ? "Verification outcomes distilled"
              : "Task completion distilled";
      const confirmed = await state.requestCognitivePlanConfirmation({
        action: "branch",
        title: "Distill Dream",
        message: "Create dream summary and graph anchors from current stage.",
        confirmLabel: "Distill",
        details: [
          `session=${state.sessionKey}`,
          `stage=${phase}`,
          `branch=${branch}`,
          `verifier=${latestVerifier?.status ?? "none"}`,
        ],
      });
      if (!confirmed) {
        return;
      }
      try {
        const taskId = await resolveSelectedCognitiveTaskId();
        if (!taskId) {
          return;
        }
        await state.client.request<{ ok?: boolean; task?: unknown }>(
          "cognitive.cognition.dream.run",
          {
            taskId,
          },
        );
        await loadSandboxCognitivePlan(state as any);
      } catch (err) {
        state.lastError = `Failed to distill dream: ${String(err)}`;
      }
    })();
  };
  const handleCognitivePlanGraphNodeIdChange = (nodeId: string) => {
    state.cognitivePlanGraphNodeId = nodeId;
  };
  const handleCognitivePlanGraphRelationChange = (relation: string) => {
    state.cognitivePlanGraphRelation = relation;
  };
  const handleCognitivePlanGraphAutoTrackChange = (enabled: boolean) => {
    state.cognitivePlanGraphAutoTrack = enabled;
  };
  const resolveTodoFocusFromGraphNode = (nodeId: string): string | null => {
    const normalized = nodeId.trim();
    if (!normalized) {
      return null;
    }
    const todos = Array.isArray(state.sandboxCognitivePlan?.todos)
      ? state.sandboxCognitivePlan!.todos
      : [];
    const visibleTodos = todos.filter((todo) => !isPlaceholderCognitivePlanTodo(todo));
    if (normalized.startsWith("todo:")) {
      const todoId = normalized.slice("todo:".length).trim();
      if (!todoId) {
        return null;
      }
      return visibleTodos.some((todo) => todo.id === todoId) ? todoId : null;
    }
    if (normalized.startsWith("task:")) {
      const taskId = normalized.slice("task:".length).trim();
      if (taskId && visibleTodos.some((todo) => todo.id === taskId)) {
        return taskId;
      }
    }
    if (visibleTodos.some((todo) => todo.id === normalized)) {
      return normalized;
    }
    if (normalized === "stage:planning") {
      return visibleTodos.find((todo) => todo.status === "todo")?.id ?? null;
    }
    if (normalized === "stage:execution") {
      return (
        visibleTodos.find((todo) => todo.status === "in_progress")?.id ??
        visibleTodos.find((todo) => todo.status === "todo")?.id ??
        null
      );
    }
    if (normalized === "stage:verification") {
      return visibleTodos.find((todo) => todo.status === "done")?.id ?? null;
    }
    return null;
  };
  const handleCognitivePlanFocusTodoChange = (todoId: string | null) => {
    state.cognitivePlanFocusTodoId = todoId?.trim() ? todoId : null;
  };
  const pushCognitivePlanGraphTrail = (nodeId: string) => {
    const normalized = nodeId.trim();
    if (!normalized) {
      return;
    }
    if (state.cognitivePlanGraphTrail[state.cognitivePlanGraphTrail.length - 1] === normalized) {
      return;
    }
    const deduped = [
      ...state.cognitivePlanGraphTrail.filter((entry) => entry !== normalized),
      normalized,
    ];
    state.cognitivePlanGraphTrail = deduped.slice(-12);
  };
  const handleCognitivePlanGraphPageChange = (page: number) => {
    state.cognitivePlanGraphPage = Math.max(1, Math.floor(page));
  };
  const handleCognitivePlanGraphExpandedRelationChange = (relation: string) => {
    state.cognitivePlanGraphExpandedRelation = relation.trim();
  };
  const handleCognitivePlanGraphTrailJump = (nodeId: string, trailIndex: number) => {
    const normalized = nodeId.trim();
    if (!normalized) {
      return;
    }
    const clampedIndex = Math.max(
      0,
      Math.min(trailIndex, state.cognitivePlanGraphTrail.length - 1),
    );
    state.cognitivePlanGraphTrail = state.cognitivePlanGraphTrail.slice(0, clampedIndex + 1);
    handleQueryCognitivePlanGraph(
      { nodeId: normalized, relation: state.cognitivePlanGraphRelation },
      false,
    );
  };
  const handleClearCognitivePlanGraph = () => {
    state.cognitivePlanGraphEdges = [];
    state.cognitivePlanGraphError = null;
    state.cognitivePlanGraphLoading = false;
    state.cognitivePlanGraphNodeId = "";
    state.cognitivePlanGraphRelation = "";
    state.cognitivePlanGraphPage = 1;
    state.cognitivePlanGraphTrail = [];
    state.cognitivePlanGraphExpandedRelation = "";
    state.cognitivePlanGraphSourceBreadcrumb = null;
    state.cognitivePlanGraphSourceMemory = null;
    state.cognitivePlanGraphSourceContext = null;
    state.cognitivePlanGraphSourceSelectedLine = null;
    state.cognitivePlanFocusTodoId = null;
  };
  const handleQueryCognitivePlanGraph = (
    query: { nodeId?: string; relation?: string },
    appendTrail = true,
  ) => {
    void (async () => {
      if (!state.client) {
        return;
      }
      const normalizedNodeId = (query.nodeId ?? "").trim();
      const normalizedRelation = (query.relation ?? "").trim();
      state.cognitivePlanGraphLoading = true;
      state.cognitivePlanGraphError = null;
      state.cognitivePlanGraphNodeId = normalizedNodeId;
      state.cognitivePlanGraphRelation = normalizedRelation;
      state.cognitivePlanGraphPage = 1;
      state.cognitivePlanGraphSourceBreadcrumb = null;
      state.cognitivePlanGraphSourceMemory = null;
      state.cognitivePlanGraphSourceContext = null;
      if (appendTrail && normalizedNodeId) {
        pushCognitivePlanGraphTrail(normalizedNodeId);
      }
      state.cognitivePlanFocusTodoId = resolveTodoFocusFromGraphNode(normalizedNodeId);
      try {
        const sourceEdges = Array.isArray(state.sandboxCognitivePlan?.graphEdges)
          ? state.sandboxCognitivePlan!.graphEdges
          : [];
        state.cognitivePlanGraphEdges = sourceEdges.filter((edge) => {
          if (
            normalizedNodeId &&
            !edge.from.includes(normalizedNodeId) &&
            !edge.to.includes(normalizedNodeId)
          ) {
            return false;
          }
          if (normalizedRelation && edge.relation !== normalizedRelation) {
            return false;
          }
          return true;
        });
      } catch (err) {
        state.cognitivePlanGraphError = `Failed to query graph memory: ${String(err)}`;
      } finally {
        state.cognitivePlanGraphLoading = false;
      }
    })();
  };
  const handleSpawnAgentsFromPlan = () => {
    const plan = state.sandboxCognitivePlan;
    const todos = Array.isArray(plan?.todos) ? plan.todos : [];
    const queued = todos
      .filter((todo) => todo.status !== "done")
      .filter((todo) => !isPlaceholderCognitivePlanTodo(todo))
      .slice(0, 5);
    if (queued.length === 0) {
      state.lastError = "No actionable TODOs found in the current task plan.";
      return;
    }
    let spawned = 0;
    for (const [index, todo] of queued.entries()) {
      const fallbackId = `task-${todo.id || index + 1}`;
      const ownerId = normalizeSubagentId(todo.ownerAgent ?? "", fallbackId);
      const taskText = (todo.title || "").trim() || `Execute task ${index + 1}`;
      const command = `/subagents spawn ${ownerId} ${taskText}`;
      void state.handleSendChat(command, { restoreDraft: true });
      spawned += 1;
    }
    state.lastError = null;
    if (spawned > 0) {
      state.setTab("agents");
    }
  };

  return html`
    <div class="aeon-cosmos-core" style="${resonanceActive ? "filter: saturate(1.5) contrast(1.1);" : ""} --aeon-chaos: ${chaosScore}; --aeon-epiphany: ${epiphanyFactor};">
        <div class="aeon-bg-fractal"></div>
        <div class="aeon-particle-field"></div>
        <div class="aeon-neutrino-flux"></div>
        <div class="aeon-peano-motif" style="transform: translate(${peanoCoord.x * 20 - 10}px, ${peanoCoord.y * 20 - 10}px) scale(${peanoCoord.z + 0.8});">
            <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
                <path d="M 12.5 12.5 L 12.5 37.5 L 37.5 37.5 L 37.5 12.5 L 62.5 12.5 L 62.5 37.5 L 87.5 37.5 L 87.5 12.5 L 87.5 37.5 L 87.5 62.5 L 62.5 62.5 L 62.5 87.5 L 87.5 87.5 L 87.5 62.5 L 37.5 62.5 L 37.5 87.5 L 12.5 87.5 L 12.5 62.5 Z" fill="none" stroke="currentColor" stroke-width="0.5" stroke-dasharray="200" stroke-dashoffset="200">
                    <animate attributeName="stroke-dashoffset" from="200" to="0" dur="10s" repeatCount="indefinite" />
                </path>
            </svg>
        </div>
        <div class="aeon-tesseract">
            <div class="aeon-tesseract-cube"></div>
            <div class="aeon-tesseract-cube"></div>
        </div>
    </div>
    <div class="aeon-shushu-cue" style="opacity: ${resonanceActive ? 0.8 : 0.3}">术数</div>
    <div class="aeon-formula-motif">Z ⇌ Z² + C</div>
    <div class="aeon-peano-scan" style="--scan-x: ${peanoCoord.x * 100}%; --scan-y: ${peanoCoord.y * 100}%; opacity: ${resonanceActive ? 0.4 : 0.15}; animation: none;"></div>
    <div class="aeon-axiomatic-core"></div>
    <div class="aeon-silicon-nexus">
      <div class="shell aeon-fractal-module ${isChat ? "shell--chat" : ""} ${chatFocus ? "shell--chat-focus" : ""} ${state.settings.navCollapsed ? "shell--nav-collapsed" : ""} ${state.onboarding ? "shell--onboarding" : ""}">
        <div class="aeon-neural-pulse"></div>
        <div class="aeon-silicon-circuit"></div>
      <aside class="nav ${state.settings.navCollapsed ? "nav--collapsed" : ""}">

        <div class="nav-brand-header">
          <div class="brand">
            <div class="brand-logo">
              <img src=${basePath ? `${basePath}/favicon.svg` : "/favicon.svg"} alt="OPENAEON" />
            </div>
            ${
              !state.settings.navCollapsed
                ? html`
                    <div class="brand-text">
                      <div class="brand-title">OPENAEON</div>
                      <div class="brand-sub">Gateway Dashboard</div>
                    </div>
                  `
                : nothing
            }
          </div>
        </div>
        ${TAB_GROUPS.map((group) => {
          const isGroupCollapsed = state.settings.navGroupsCollapsed[group.label] ?? false;
          const hasActiveTab = group.tabs.some((tab) => tab === state.tab);
          return html`
            <div class="nav-group ${isGroupCollapsed && !hasActiveTab ? "nav-group--collapsed" : ""}">
              <button
                class="nav-label"
                @click=${() => {
                  const next = { ...state.settings.navGroupsCollapsed };
                  next[group.label] = !isGroupCollapsed;
                  state.applySettings({
                    ...state.settings,
                    navGroupsCollapsed: next,
                  });
                }}
                aria-expanded=${!isGroupCollapsed}
              >
                <span class="nav-label__text">${t(`nav.${group.label}`)}</span>
                <span class="nav-label__chevron">${isGroupCollapsed ? "+" : "−"}</span>
              </button>
              <div class="nav-group__items">
                ${group.tabs.map((tab) => renderTab(state, tab))}
              </div>
            </div>
          `;
        })}
        <div class="nav-group nav-group--links">
          <div class="nav-label nav-label--static">
            <span class="nav-label__text">${t("common.resources")}</span>
          </div>
          <div class="nav-group__items">
            <a
              class="nav-item nav-item--external"
              href="https://docs.openaeon.ai"
              target=${EXTERNAL_LINK_TARGET}
              rel=${buildExternalLinkRel()}
              title="${t("common.docs")} (opens in new tab)"
            >
              <span class="nav-item__icon" aria-hidden="true">${icons.book}</span>
              <span class="nav-item__text">${t("common.docs")}</span>
            </a>
          </div>
        </div>
      </aside>
      <div class="page-container">
        <header class="page-header">
          <div class="header-left">
            <button
              type="button"
              class="nav-collapse-toggle"
              @click=${() => {
                if (isChat && state.settings.chatFocusMode) {
                  state.applySettings({
                    ...state.settings,
                    chatFocusMode: false,
                    navCollapsed: false,
                  });
                } else {
                  state.applySettings({
                    ...state.settings,
                    navCollapsed: !state.settings.navCollapsed,
                  });
                }
              }}
              title="${state.settings.navCollapsed ? t("nav.expand") : t("nav.collapse")}"
              aria-label="${state.settings.navCollapsed ? t("nav.expand") : t("nav.collapse")}"
            >
              <span class="nav-collapse-toggle__icon">${icons.menu}</span>
            </button>
            <span class="header-title">${state.tab === "usage" ? "" : titleForTab(state.tab)}</span>
          </div>
          <div class="header-right">
            <language-switcher 
              .locale=${state.settings.locale || "en"}
              @locale-change=${(e: CustomEvent) => {
                const loc = e.detail.locale;
                state.applySettings({ ...state.settings, locale: loc });
                void i18n.setLocale(loc);
              }}
            ></language-switcher>
            <div class="pill">
              <span class="statusDot ${versionStatusClass}"></span>
              <span>${t("common.version")}</span>
              <span class="mono">${openClawVersion}</span>
            </div>
            <div class="pill">
              <span class="statusDot ${state.connected ? "ok" : ""}"></span>
              <span>${t("common.health")}</span>
              <span class="mono">${state.connected ? t("common.ok") : t("common.offline")}</span>
            </div>
            ${renderThemeToggle(state)}
          </div>
        </header>

        <main class="content ${isChat ? "content--chat" : ""}">
          ${
            availableUpdate
              ? html`<div class="update-banner callout danger" role="alert">
                <strong>Update available:</strong> v${availableUpdate.latestVersion}
                (running v${availableUpdate.currentVersion}).
                <button
                  class="btn btn--sm update-banner__btn"
                  ?disabled=${state.updateRunning || !state.connected}
                  @click=${() => runUpdate(state)}
                >${state.updateRunning ? "Updating…" : "Update now"}</button>
              </div>`
              : nothing
          }
          <section class="content-header">
            <div>
              ${state.tab === "usage" ? nothing : html`<div class="page-sub">${subtitleForTab(state.tab)}</div>`}
            </div>
          <div class="page-meta">
            ${state.lastError ? html`<div class="pill danger">${state.lastError}</div>` : nothing}
            ${isChat ? renderChatControls(state) : nothing}
          </div>
        </section>

        ${
          state.tab === "overview"
            ? renderOverview({
                connected: state.connected,
                hello: state.hello,
                settings: state.settings,
                password: state.password,
                lastError: state.lastError,
                lastErrorCode: state.lastErrorCode,
                presenceCount,
                sessionsCount,
                cronEnabled: state.cronStatus?.enabled ?? null,
                cronNext,
                lastChannelsRefresh: state.channelsLastSuccess,
                onSettingsChange: (next) => state.applySettings(next),
                onPasswordChange: (next) => (state.password = next),
                onSessionKeyChange: (next) => {
                  state.sessionKey = next;
                  state.chatMessage = "";
                  state.resetToolStream();
                  state.sandboxCognitivePlan = null;
                  state.sandboxCognitivePlanLoading = false;
                  state.sandboxCognitivePlanError = null;
                  state.sandboxChatEvents = {};
                  state.applySettings({
                    ...state.settings,
                    sessionKey: next,
                    lastActiveSessionKey: next,
                  });
                  void state.loadAssistantIdentity();
                },
                onConnect: () => state.connect(),
                onRefresh: () => state.loadOverview(),
              })
            : nothing
        }

        ${
          state.tab === "channels"
            ? renderChannels({
                connected: state.connected,
                loading: state.channelsLoading,
                snapshot: state.channelsSnapshot,
                lastError: state.channelsError,
                lastSuccessAt: state.channelsLastSuccess,
                whatsappMessage: state.whatsappLoginMessage,
                whatsappQrDataUrl: state.whatsappLoginQrDataUrl,
                whatsappConnected: state.whatsappLoginConnected,
                whatsappBusy: state.whatsappBusy,
                weixinMessage: state.weixinLoginMessage,
                weixinQrDataUrl: state.weixinLoginQrDataUrl,
                weixinConnected: state.weixinLoginConnected,
                weixinBusy: state.weixinBusy,
                configSchema: state.configSchema,
                configSchemaLoading: state.configSchemaLoading,
                configForm: state.configForm,
                configUiHints: state.configUiHints,
                configSaving: state.configSaving,
                configFormDirty: state.configFormDirty,
                nostrProfileFormState: state.nostrProfileFormState,
                nostrProfileAccountId: state.nostrProfileAccountId,
                onRefresh: (probe) => loadChannels(state, probe),
                onWhatsAppStart: (force) => state.handleWhatsAppStart(force),
                onWhatsAppWait: () => state.handleWhatsAppWait(),
                onWhatsAppLogout: () => state.handleWhatsAppLogout(),
                onWeixinStart: (force) => state.handleWeixinStart(force),
                onWeixinWait: () => state.handleWeixinWait(),
                onWeixinLogout: () => state.handleWeixinLogout(),
                onConfigPatch: (path, value) => updateConfigFormValue(state, path, value),
                onConfigSave: () => state.handleChannelConfigSave(),
                onConfigReload: () => state.handleChannelConfigReload(),
                onNostrProfileEdit: (accountId, profile) =>
                  state.handleNostrProfileEdit(accountId, profile),
                onNostrProfileCancel: () => state.handleNostrProfileCancel(),
                onNostrProfileFieldChange: (field, value) =>
                  state.handleNostrProfileFieldChange(field, value),
                onNostrProfileSave: () => state.handleNostrProfileSave(),
                onNostrProfileImport: () => state.handleNostrProfileImport(),
                onNostrProfileToggleAdvanced: () => state.handleNostrProfileToggleAdvanced(),
              })
            : nothing
        }

        ${
          state.tab === "instances"
            ? renderInstances({
                loading: state.presenceLoading,
                entries: state.presenceEntries,
                lastError: state.presenceError,
                statusMessage: state.presenceStatus,
                onRefresh: () => loadPresence(state),
              })
            : nothing
        }

        ${
          state.tab === "sessions"
            ? renderSessions({
                loading: state.sessionsLoading,
                result: state.sessionsResult,
                error: state.sessionsError,
                activeMinutes: state.sessionsFilterActive,
                limit: state.sessionsFilterLimit,
                includeGlobal: state.sessionsIncludeGlobal,
                includeUnknown: state.sessionsIncludeUnknown,
                basePath: state.basePath,
                onFiltersChange: (next) => {
                  state.sessionsFilterActive = next.activeMinutes;
                  state.sessionsFilterLimit = next.limit;
                  state.sessionsIncludeGlobal = next.includeGlobal;
                  state.sessionsIncludeUnknown = next.includeUnknown;
                },
                onRefresh: () => loadSessions(state),
                onPatch: (key, patch) => patchSession(state, key, patch),
                onDelete: (key) => deleteSessionAndRefresh(state, key),
              })
            : nothing
        }

        ${
          state.tab === "sandbox"
            ? renderSandbox({
                sessionKey: state.sessionKey,
                loading: state.sessionsLoading,
                result: state.sessionsResult,
                error: state.sessionsError,
                sandboxChatEvents: state.sandboxChatEvents,
                cognitivePlan: state.sandboxCognitivePlan ?? null,
                agentIdentityById: state.agentIdentityById,
                recruitModalOpen: state.sandboxRecruitModalOpen,
                nodes: state.nodes,
                health: state.debugHealth,
                channels: state.channelsSnapshot,
                usage: state.usageCostSummary,
                approvalsCount: state.execApprovalQueue?.length ?? 0,
                evolution: state.aeonSystemStatus?.evolution,
                consciousness: state.aeonSystemStatus?.consciousness,
                telemetry: state.aeonSystemStatus?.telemetry,
                legacy: state.aeonSystemStatus?.legacy,
                timestamp: state.aeonSystemStatus?.timestamp,
                memoryPersistence: state.aeonSystemStatus?.memory?.persistence,
                executionDelivery: state.aeonSystemStatus?.execution?.delivery,
                eternalMode: state.aeonSystemStatus?.mode?.eternal,
                onToggleEternalMode: () =>
                  void state.handleToggleEternalMode(!state.aeonEternalMode, "local"),
                onRefresh: async () => {
                  await loadSessions(state);
                  await loadSandboxCognitivePlan(state);
                  await state.handleAeonLogicRefresh();
                },
                onForceRestart: () => {
                  void state.handleSendChat("/new", { restoreDraft: true });
                },
                onSessionFocus: (next) => {
                  state.sessionKey = next;
                  state.aeonThinkingCursor = null;
                  state.aeonThinkingEvents = [];
                  state.aeonEternalHydratedSessionKey = null;
                  state.applySettings({
                    ...state.settings,
                    sessionKey: next,
                    lastActiveSessionKey: next,
                  });
                  void loadSandboxCognitivePlan(state);
                },
                onRecruitAgent: () => state.handleRecruitModalOpen(),
                onRecruitModalClose: () => state.handleRecruitModalClose(),
                onAvatarSelect: (agentId, avatarId) =>
                  state.handleAgentAvatarChange(agentId, avatarId),
              })
            : nothing
        }

        ${
          state.tab === "cognitive"
            ? renderCognitiveView({
                sessionKey: state.sessionKey,
                cognitivePlan: state.sandboxCognitivePlan ?? null,
                cognitiveTask: state.cognitiveTaskRecord,
                cognitiveTaskList: state.cognitiveTaskList,
                cognitiveSelectedTaskId: state.cognitiveSelectedTaskId,
                cognitiveRuntimeEvents: state.cognitiveRuntimeEvents,
                cognitiveSubmitTitle: state.cognitiveSubmitTitle,
                cognitiveSubmitText: state.cognitiveSubmitText,
                cognitiveMemoryQuery: state.cognitiveMemoryQuery,
                cognitiveMemoryTags: state.cognitiveMemoryTags,
                cognitiveMemoryResults: state.cognitiveMemoryResults,
                cognitiveReplayRunId: state.cognitiveReplayRunId,
                cognitiveReplayEvents: state.cognitiveReplayEvents,
                cognitiveReplayLoading: state.cognitiveReplayLoading,
                cognitiveLoading: state.cognitiveLoading,
                cognitiveMemoryLoading: state.cognitiveMemoryLoading,
                cognitiveSourceContext: state.cognitiveSourceContext,
                cognitiveSourceSelectedLine: state.cognitiveSourceSelectedLine,
                cognitiveSelectedMemoryResult: state.cognitiveSelectedMemoryResult,
                sandboxChatEvents: state.sandboxChatEvents,
                aeonStatus: state.aeonSystemStatus,
                chatMessages: state.chatMessages,
                chatToolMessages: state.chatToolMessages,
                onRefresh: () => state.handleCognitiveRefresh(),
                onSelectTask: (taskId) => void state.handleCognitiveSelectTask(taskId),
                onSubmitTask: () => void state.handleCognitiveSubmitTask(),
                onTransition: (to, reason) => void state.handleCognitiveTransition(to, reason),
                onDispatch: () => void state.handleCognitiveDispatch(),
                onDream: () => void state.handleCognitiveDream(),
                onReflect: () => void state.handleCognitiveReflect(),
                onMemoryQueryChange: (next) => {
                  state.cognitiveMemoryQuery = next;
                },
                onMemoryTagsChange: (next) => {
                  state.cognitiveMemoryTags = next;
                },
                onRunMemoryQuery: () => void state.handleCognitiveMemoryQuery(),
                onSubmitTitleChange: (next) => {
                  state.cognitiveSubmitTitle = next;
                },
                onSubmitTextChange: (next) => {
                  state.cognitiveSubmitText = next;
                },
                onInspectMemoryResult: (result) => void state.handleInspectMemoryResult(result),
                onTraceMemoryResult: (result) => void state.handleTraceMemoryResult(result),
                onSourceLineSelect: (lineNo) => state.handleSourceLineSelect(lineNo),
                onReplayRun: (runId) => void state.handleCognitiveReplay(runId),
              })
            : nothing
        }

        ${
          state.tab === "aeon"
            ? renderAeonLogic({
                loading: state.aeonLogicLoading,
                error: state.aeonLogicError,
                content: state.aeonLogicContent,
                userDraft: state.chatMessage,
                history: state.chatMessages,
                isThinking: state.chatSending || Boolean(state.chatStream),
                showManual: state.aeonManualVisible,
                systemStatus: state.aeonSystemStatus,
                onRefresh: () => state.handleAeonLogicRefresh(),
                onCompaction: () => state.handleAeonLogicCompaction(),
                onDraftChange: (next) => state.setChatMessage(next),
                onToggleManual: (visible) => state.handleToggleAeonManual(visible),
                cognitiveLog: state.aeonSystemStatus?.evolution?.cognitiveLog,
                liveThinking: state.chatStreamThinking,
                activeTab: state.aeonActiveTab,
                viewMode: state.aeonViewMode,
                onTabChange: (tab) => state.handleAeonTabChange(tab),
                onViewModeChange: (mode) => state.handleAeonViewModeChange(mode),
                onBacktrack: (runId) => state.handleAeonBacktrack(runId),
              })
            : nothing
        }

        ${renderUsageTab(state)}

        ${
          state.tab === "cron"
            ? renderCron({
                basePath: state.basePath,
                loading: state.cronLoading,
                jobsLoadingMore: state.cronJobsLoadingMore,
                status: state.cronStatus,
                jobs: visibleCronJobs,
                jobsTotal: state.cronJobsTotal,
                jobsHasMore: state.cronJobsHasMore,
                jobsQuery: state.cronJobsQuery,
                jobsEnabledFilter: state.cronJobsEnabledFilter,
                jobsScheduleKindFilter: state.cronJobsScheduleKindFilter,
                jobsLastStatusFilter: state.cronJobsLastStatusFilter,
                jobsSortBy: state.cronJobsSortBy,
                jobsSortDir: state.cronJobsSortDir,
                error: state.cronError,
                busy: state.cronBusy,
                form: state.cronForm,
                fieldErrors: state.cronFieldErrors,
                canSubmit: !hasCronFormErrors(state.cronFieldErrors),
                editingJobId: state.cronEditingJobId,
                channels: state.channelsSnapshot?.channelMeta?.length
                  ? state.channelsSnapshot.channelMeta.map((entry) => entry.id)
                  : (state.channelsSnapshot?.channelOrder ?? []),
                channelLabels: state.channelsSnapshot?.channelLabels ?? {},
                channelMeta: state.channelsSnapshot?.channelMeta ?? [],
                runsJobId: state.cronRunsJobId,
                runs: state.cronRuns,
                runsTotal: state.cronRunsTotal,
                runsHasMore: state.cronRunsHasMore,
                runsLoadingMore: state.cronRunsLoadingMore,
                runsScope: state.cronRunsScope,
                runsStatuses: state.cronRunsStatuses,
                runsDeliveryStatuses: state.cronRunsDeliveryStatuses,
                runsStatusFilter: state.cronRunsStatusFilter,
                runsQuery: state.cronRunsQuery,
                runsSortDir: state.cronRunsSortDir,
                agentSuggestions: cronAgentSuggestions,
                modelSuggestions: cronModelSuggestions,
                thinkingSuggestions: CRON_THINKING_SUGGESTIONS,
                timezoneSuggestions: CRON_TIMEZONE_SUGGESTIONS,
                deliveryToSuggestions,
                onFormChange: (patch) => {
                  state.cronForm = normalizeCronFormState({ ...state.cronForm, ...patch });
                  state.cronFieldErrors = validateCronForm(state.cronForm);
                },
                onRefresh: () => state.loadCron(),
                onAdd: () => addCronJob(state),
                onEdit: (job) => startCronEdit(state, job),
                onClone: (job) => startCronClone(state, job),
                onCancelEdit: () => cancelCronEdit(state),
                onToggle: (job, enabled) => toggleCronJob(state, job, enabled),
                onRun: (job) => runCronJob(state, job),
                onRemove: (job) => removeCronJob(state, job),
                onLoadRuns: async (jobId) => {
                  updateCronRunsFilter(state, { cronRunsScope: "job" });
                  await loadCronRuns(state, jobId);
                },
                onLoadMoreJobs: () => loadMoreCronJobs(state),
                onJobsFiltersChange: async (patch) => {
                  updateCronJobsFilter(state, patch);
                  const shouldReload =
                    typeof patch.cronJobsQuery === "string" ||
                    Boolean(patch.cronJobsEnabledFilter) ||
                    Boolean(patch.cronJobsSortBy) ||
                    Boolean(patch.cronJobsSortDir);
                  if (shouldReload) {
                    await reloadCronJobs(state);
                  }
                },
                onJobsFiltersReset: async () => {
                  updateCronJobsFilter(state, {
                    cronJobsQuery: "",
                    cronJobsEnabledFilter: "all",
                    cronJobsScheduleKindFilter: "all",
                    cronJobsLastStatusFilter: "all",
                    cronJobsSortBy: "nextRunAtMs",
                    cronJobsSortDir: "asc",
                  });
                  await reloadCronJobs(state);
                },
                onLoadMoreRuns: () => loadMoreCronRuns(state),
                onRunsFiltersChange: async (patch) => {
                  updateCronRunsFilter(state, patch);
                  if (state.cronRunsScope === "all") {
                    await loadCronRuns(state, null);
                    return;
                  }
                  await loadCronRuns(state, state.cronRunsJobId);
                },
              })
            : nothing
        }

        ${
          state.tab === "agents"
            ? renderAgents({
                loading: state.agentsLoading,
                error: state.agentsError,
                agentsList: state.agentsList,
                selectedAgentId: resolvedAgentId,
                activePanel: state.agentsPanel,
                configForm: configValue,
                configLoading: state.configLoading,
                configSaving: state.configSaving,
                configDirty: state.configFormDirty,
                channelsLoading: state.channelsLoading,
                channelsError: state.channelsError,
                channelsSnapshot: state.channelsSnapshot,
                channelsLastSuccess: state.channelsLastSuccess,
                cronLoading: state.cronLoading,
                cronStatus: state.cronStatus,
                cronJobs: state.cronJobs,
                cronError: state.cronError,
                agentFilesLoading: state.agentFilesLoading,
                agentFilesError: state.agentFilesError,
                agentFilesList: state.agentFilesList,
                agentFileActive: state.agentFileActive,
                agentFileContents: state.agentFileContents,
                agentFileDrafts: state.agentFileDrafts,
                agentFileSaving: state.agentFileSaving,
                agentKnowledgeLoading: state.agentKnowledgeLoading,
                agentKnowledgeError: state.agentKnowledgeError,
                agentKnowledgeList: state.agentKnowledgeList,
                agentKnowledgeStatus: state.agentKnowledgeStatus,
                agentKnowledgeFileContents: state.agentKnowledgeFileContents,
                agentKnowledgeFileDrafts: state.agentKnowledgeFileDrafts,
                agentKnowledgeFileActive: state.agentKnowledgeFileActive,
                agentKnowledgeSaving: state.agentKnowledgeSaving,
                agentIdentityLoading: state.agentIdentityLoading,
                agentIdentityError: state.agentIdentityError,
                agentIdentityById: state.agentIdentityById,
                agentSkillsLoading: state.agentSkillsLoading,
                agentSkillsReport: state.agentSkillsReport,
                agentSkillsError: state.agentSkillsError,
                agentSkillsAgentId: state.agentSkillsAgentId,
                toolsCatalogLoading: state.toolsCatalogLoading,
                toolsCatalogError: state.toolsCatalogError,
                toolsCatalogResult: state.toolsCatalogResult,
                skillsFilter: state.skillsFilter,
                onRefresh: async () => {
                  await loadAgents(state);
                  const nextSelected =
                    state.agentsSelectedId ??
                    state.agentsList?.defaultId ??
                    state.agentsList?.agents?.[0]?.id ??
                    null;
                  await loadToolsCatalog(state, nextSelected);
                  const agentIds = state.agentsList?.agents?.map((entry) => entry.id) ?? [];
                  if (agentIds.length > 0) {
                    void loadAgentIdentities(state, agentIds);
                  }
                },
                onSelectAgent: (agentId) => {
                  if (state.agentsSelectedId === agentId) {
                    return;
                  }
                  state.agentsSelectedId = agentId;
                  state.agentFilesList = null;
                  state.agentFilesError = null;
                  state.agentFilesLoading = false;
                  state.agentFileActive = null;
                  state.agentFileContents = {};
                  state.agentFileDrafts = {};
                  state.agentKnowledgeList = null;
                  state.agentKnowledgeStatus = null;
                  state.agentKnowledgeError = null;
                  state.agentKnowledgeLoading = false;
                  state.agentKnowledgeFileActive = null;
                  state.agentKnowledgeFileContents = {};
                  state.agentKnowledgeFileDrafts = {};
                  state.agentSkillsReport = null;
                  state.agentSkillsError = null;
                  state.agentSkillsAgentId = null;
                  void loadAgentIdentity(state, agentId);
                  if (state.agentsPanel === "tools") {
                    void loadToolsCatalog(state, agentId);
                  }
                  if (state.agentsPanel === "files") {
                    void loadAgentFiles(state, agentId);
                  }
                  if (state.agentsPanel === "knowledge") {
                    void loadAgentKnowledge(state, agentId);
                    void loadAgentKnowledgeStatus(state, agentId);
                  }
                  if (state.agentsPanel === "skills") {
                    void loadAgentSkills(state, agentId);
                  }
                },
                onSelectPanel: (panel) => {
                  state.agentsPanel = panel;
                  if (panel === "files" && resolvedAgentId) {
                    if (state.agentFilesList?.agentId !== resolvedAgentId) {
                      state.agentFilesList = null;
                      state.agentFilesError = null;
                      state.agentFileActive = null;
                      state.agentFileContents = {};
                      state.agentFileDrafts = {};
                      void loadAgentFiles(state, resolvedAgentId);
                    }
                  }
                  if (panel === "knowledge" && resolvedAgentId) {
                    if (state.agentKnowledgeList?.agentId !== resolvedAgentId) {
                      state.agentKnowledgeList = null;
                      state.agentKnowledgeStatus = null;
                      state.agentKnowledgeError = null;
                      state.agentKnowledgeFileActive = null;
                      state.agentKnowledgeFileContents = {};
                      state.agentKnowledgeFileDrafts = {};
                      void loadAgentKnowledge(state, resolvedAgentId);
                      void loadAgentKnowledgeStatus(state, resolvedAgentId);
                    }
                  }
                  if (panel === "tools") {
                    void loadToolsCatalog(state, resolvedAgentId);
                  }
                  if (panel === "skills") {
                    if (resolvedAgentId) {
                      void loadAgentSkills(state, resolvedAgentId);
                    }
                  }
                  if (panel === "channels") {
                    void loadChannels(state, false);
                  }
                  if (panel === "cron") {
                    void state.loadCron();
                  }
                },
                onLoadFiles: (agentId) => loadAgentFiles(state, agentId),
                onSelectFile: (name) => {
                  state.agentFileActive = name;
                  if (!resolvedAgentId) {
                    return;
                  }
                  void loadAgentFileContent(state, resolvedAgentId, name);
                },
                onFileDraftChange: (name, content) => {
                  state.agentFileDrafts = { ...state.agentFileDrafts, [name]: content };
                },
                onFileReset: (name) => {
                  const base = state.agentFileContents[name] ?? "";
                  state.agentFileDrafts = { ...state.agentFileDrafts, [name]: base };
                },
                onFileSave: (name) => {
                  if (!resolvedAgentId) {
                    return;
                  }
                  const content =
                    state.agentFileDrafts[name] ?? state.agentFileContents[name] ?? "";
                  void saveAgentFile(state, resolvedAgentId, name, content);
                },
                onKnowledgeLoadFiles: (agentId) => {
                  void loadAgentKnowledge(state, agentId);
                  void loadAgentKnowledgeStatus(state, agentId);
                },
                onKnowledgeSelectFile: (name) => {
                  state.agentKnowledgeFileActive = name;
                  if (!resolvedAgentId) {
                    return;
                  }
                  void loadAgentKnowledgeFileContent(state, resolvedAgentId, name);
                },
                onKnowledgeFileDraftChange: (name, content) => {
                  state.agentKnowledgeFileDrafts = {
                    ...state.agentKnowledgeFileDrafts,
                    [name]: content,
                  };
                },
                onKnowledgeFileReset: (name) => {
                  const base = state.agentKnowledgeFileContents[name] ?? "";
                  state.agentKnowledgeFileDrafts = {
                    ...state.agentKnowledgeFileDrafts,
                    [name]: base,
                  };
                },
                onKnowledgeFileSave: (name) => {
                  if (!resolvedAgentId) {
                    return;
                  }
                  const content =
                    state.agentKnowledgeFileDrafts[name] ??
                    state.agentKnowledgeFileContents[name] ??
                    "";
                  void saveAgentKnowledgeFile(state, resolvedAgentId, name, content);
                },
                onKnowledgeFileDelete: (name) => {
                  if (!resolvedAgentId) {
                    return;
                  }
                  void deleteAgentKnowledgeFile(state, resolvedAgentId, name);
                },
                onToolsProfileChange: (agentId, profile, clearAllow) => {
                  if (!configValue) {
                    return;
                  }
                  const list = (configValue as { agents?: { list?: unknown[] } }).agents?.list;
                  if (!Array.isArray(list)) {
                    return;
                  }
                  const index = list.findIndex(
                    (entry) =>
                      entry &&
                      typeof entry === "object" &&
                      "id" in entry &&
                      (entry as { id?: string }).id === agentId,
                  );
                  if (index < 0) {
                    return;
                  }
                  const basePath = ["agents", "list", index, "tools"];
                  if (profile) {
                    updateConfigFormValue(state, [...basePath, "profile"], profile);
                  } else {
                    removeConfigFormValue(state, [...basePath, "profile"]);
                  }
                  if (clearAllow) {
                    removeConfigFormValue(state, [...basePath, "allow"]);
                  }
                },
                onToolsOverridesChange: (agentId, alsoAllow, deny) => {
                  if (!configValue) {
                    return;
                  }
                  const list = (configValue as { agents?: { list?: unknown[] } }).agents?.list;
                  if (!Array.isArray(list)) {
                    return;
                  }
                  const index = list.findIndex(
                    (entry) =>
                      entry &&
                      typeof entry === "object" &&
                      "id" in entry &&
                      (entry as { id?: string }).id === agentId,
                  );
                  if (index < 0) {
                    return;
                  }
                  const basePath = ["agents", "list", index, "tools"];
                  if (alsoAllow.length > 0) {
                    updateConfigFormValue(state, [...basePath, "alsoAllow"], alsoAllow);
                  } else {
                    removeConfigFormValue(state, [...basePath, "alsoAllow"]);
                  }
                  if (deny.length > 0) {
                    updateConfigFormValue(state, [...basePath, "deny"], deny);
                  } else {
                    removeConfigFormValue(state, [...basePath, "deny"]);
                  }
                },
                onConfigReload: () => loadConfig(state),
                onConfigSave: () => saveConfig(state),
                onChannelsRefresh: () => loadChannels(state, false),
                onCronRefresh: () => state.loadCron(),
                onSkillsFilterChange: (next) => (state.skillsFilter = next),
                onSkillsRefresh: () => {
                  if (resolvedAgentId) {
                    void loadAgentSkills(state, resolvedAgentId);
                  }
                },
                onAgentSkillToggle: (agentId, skillName, enabled) => {
                  if (!configValue) {
                    return;
                  }
                  const list = (configValue as { agents?: { list?: unknown[] } }).agents?.list;
                  if (!Array.isArray(list)) {
                    return;
                  }
                  const index = list.findIndex(
                    (entry) =>
                      entry &&
                      typeof entry === "object" &&
                      "id" in entry &&
                      (entry as { id?: string }).id === agentId,
                  );
                  if (index < 0) {
                    return;
                  }
                  const entry = list[index] as { skills?: unknown };
                  const normalizedSkill = skillName.trim();
                  if (!normalizedSkill) {
                    return;
                  }
                  const allSkills =
                    state.agentSkillsReport?.skills?.map((skill) => skill.name).filter(Boolean) ??
                    [];
                  const existing = Array.isArray(entry.skills)
                    ? entry.skills.map((name) => String(name).trim()).filter(Boolean)
                    : undefined;
                  const base = existing ?? allSkills;
                  const next = new Set(base);
                  if (enabled) {
                    next.add(normalizedSkill);
                  } else {
                    next.delete(normalizedSkill);
                  }
                  updateConfigFormValue(state, ["agents", "list", index, "skills"], [...next]);
                },
                onAgentSkillsClear: (agentId) => {
                  if (!configValue) {
                    return;
                  }
                  const list = (configValue as { agents?: { list?: unknown[] } }).agents?.list;
                  if (!Array.isArray(list)) {
                    return;
                  }
                  const index = list.findIndex(
                    (entry) =>
                      entry &&
                      typeof entry === "object" &&
                      "id" in entry &&
                      (entry as { id?: string }).id === agentId,
                  );
                  if (index < 0) {
                    return;
                  }
                  removeConfigFormValue(state, ["agents", "list", index, "skills"]);
                },
                onAgentSkillsDisableAll: (agentId) => {
                  if (!configValue) {
                    return;
                  }
                  const list = (configValue as { agents?: { list?: unknown[] } }).agents?.list;
                  if (!Array.isArray(list)) {
                    return;
                  }
                  const index = list.findIndex(
                    (entry) =>
                      entry &&
                      typeof entry === "object" &&
                      "id" in entry &&
                      (entry as { id?: string }).id === agentId,
                  );
                  if (index < 0) {
                    return;
                  }
                  updateConfigFormValue(state, ["agents", "list", index, "skills"], []);
                },
                onModelChange: (agentId, modelId) => {
                  if (!configValue) {
                    return;
                  }
                  const list = (configValue as { agents?: { list?: unknown[] } }).agents?.list;
                  if (!Array.isArray(list)) {
                    return;
                  }
                  const index = list.findIndex(
                    (entry) =>
                      entry &&
                      typeof entry === "object" &&
                      "id" in entry &&
                      (entry as { id?: string }).id === agentId,
                  );
                  if (index < 0) {
                    return;
                  }
                  const basePath = ["agents", "list", index, "model"];
                  if (!modelId) {
                    removeConfigFormValue(state, basePath);
                    return;
                  }
                  const entry = list[index] as { model?: unknown };
                  const existing = entry?.model;
                  if (existing && typeof existing === "object" && !Array.isArray(existing)) {
                    const fallbacks = (existing as { fallbacks?: unknown }).fallbacks;
                    const next = {
                      primary: modelId,
                      ...(Array.isArray(fallbacks) ? { fallbacks } : {}),
                    };
                    updateConfigFormValue(state, basePath, next);
                  } else {
                    updateConfigFormValue(state, basePath, modelId);
                  }
                },
                onModelFallbacksChange: (agentId, fallbacks) => {
                  if (!configValue) {
                    return;
                  }
                  const list = (configValue as { agents?: { list?: unknown[] } }).agents?.list;
                  if (!Array.isArray(list)) {
                    return;
                  }
                  const index = list.findIndex(
                    (entry) =>
                      entry &&
                      typeof entry === "object" &&
                      "id" in entry &&
                      (entry as { id?: string }).id === agentId,
                  );
                  if (index < 0) {
                    return;
                  }
                  const basePath = ["agents", "list", index, "model"];
                  const entry = list[index] as { model?: unknown };
                  const normalized = fallbacks.map((name) => name.trim()).filter(Boolean);
                  const existing = entry.model;
                  const resolvePrimary = () => {
                    if (typeof existing === "string") {
                      return existing.trim() || null;
                    }
                    if (existing && typeof existing === "object" && !Array.isArray(existing)) {
                      const primary = (existing as { primary?: unknown }).primary;
                      if (typeof primary === "string") {
                        const trimmed = primary.trim();
                        return trimmed || null;
                      }
                    }
                    return null;
                  };
                  const primary = resolvePrimary();
                  if (normalized.length === 0) {
                    if (primary) {
                      updateConfigFormValue(state, basePath, primary);
                    } else {
                      removeConfigFormValue(state, basePath);
                    }
                    return;
                  }
                  const next = primary
                    ? { primary, fallbacks: normalized }
                    : { fallbacks: normalized };
                  updateConfigFormValue(state, basePath, next);
                },
              })
            : nothing
        }

        ${
          state.tab === "skills"
            ? renderSkills({
                loading: state.skillsLoading,
                report: state.skillsReport,
                error: state.skillsError,
                filter: state.skillsFilter,
                edits: state.skillEdits,
                messages: state.skillMessages,
                busyKey: state.skillsBusyKey,
                onFilterChange: (next) => (state.skillsFilter = next),
                onRefresh: () => loadSkills(state, { clearMessages: true }),
                onToggle: (key, enabled) => updateSkillEnabled(state, key, enabled),
                onEdit: (key, value) => updateSkillEdit(state, key, value),
                onSaveKey: (key) => saveSkillApiKey(state, key),
                onSaveBaseUrl: (key) => saveSkillBaseUrl(state, key),
                onSaveProxy: (key) => saveSkillProxy(state, key),
                onInstall: (skillKey, name, installId) =>
                  installSkill(state, skillKey, name, installId),
              })
            : nothing
        }

        ${
          state.tab === "nodes"
            ? renderNodes({
                loading: state.nodesLoading,
                nodes: state.nodes,
                devicesLoading: state.devicesLoading,
                devicesError: state.devicesError,
                devicesList: state.devicesList,
                configForm: state.configForm ?? state.configSnapshot?.config ?? null,
                configLoading: state.configLoading,
                configSaving: state.configSaving,
                configDirty: state.configFormDirty,
                configFormMode: state.configFormMode,
                execApprovalsLoading: state.execApprovalsLoading,
                execApprovalsSaving: state.execApprovalsSaving,
                execApprovalsDirty: state.execApprovalsDirty,
                execApprovalsSnapshot: state.execApprovalsSnapshot,
                execApprovalsForm: state.execApprovalsForm,
                execApprovalsSelectedAgent: state.execApprovalsSelectedAgent,
                execApprovalsTarget: state.execApprovalsTarget,
                execApprovalsTargetNodeId: state.execApprovalsTargetNodeId,
                onRefresh: () => loadNodes(state),
                onDevicesRefresh: () => loadDevices(state),
                onDeviceApprove: (requestId) => approveDevicePairing(state, requestId),
                onDeviceReject: (requestId) => rejectDevicePairing(state, requestId),
                onDeviceRotate: (deviceId, role, scopes) =>
                  rotateDeviceToken(state, { deviceId, role, scopes }),
                onDeviceRevoke: (deviceId, role) => revokeDeviceToken(state, { deviceId, role }),
                onLoadConfig: () => loadConfig(state),
                onLoadExecApprovals: () => {
                  const target =
                    state.execApprovalsTarget === "node" && state.execApprovalsTargetNodeId
                      ? { kind: "node" as const, nodeId: state.execApprovalsTargetNodeId }
                      : { kind: "gateway" as const };
                  return loadExecApprovals(state, target);
                },
                onBindDefault: (nodeId) => {
                  if (nodeId) {
                    updateConfigFormValue(state, ["tools", "exec", "node"], nodeId);
                  } else {
                    removeConfigFormValue(state, ["tools", "exec", "node"]);
                  }
                },
                onBindAgent: (agentIndex, nodeId) => {
                  const basePath = ["agents", "list", agentIndex, "tools", "exec", "node"];
                  if (nodeId) {
                    updateConfigFormValue(state, basePath, nodeId);
                  } else {
                    removeConfigFormValue(state, basePath);
                  }
                },
                onSaveBindings: () => saveConfig(state),
                onExecApprovalsTargetChange: (kind, nodeId) => {
                  state.execApprovalsTarget = kind;
                  state.execApprovalsTargetNodeId = nodeId;
                  state.execApprovalsSnapshot = null;
                  state.execApprovalsForm = null;
                  state.execApprovalsDirty = false;
                  state.execApprovalsSelectedAgent = null;
                },
                onExecApprovalsSelectAgent: (agentId) => {
                  state.execApprovalsSelectedAgent = agentId;
                },
                onExecApprovalsPatch: (path, value) =>
                  updateExecApprovalsFormValue(state, path, value),
                onExecApprovalsRemove: (path) => removeExecApprovalsFormValue(state, path),
                onSaveExecApprovals: () => {
                  const target =
                    state.execApprovalsTarget === "node" && state.execApprovalsTargetNodeId
                      ? { kind: "node" as const, nodeId: state.execApprovalsTargetNodeId }
                      : { kind: "gateway" as const };
                  return saveExecApprovals(state, target);
                },
              })
            : nothing
        }

        ${
          state.tab === "chat"
            ? renderChat({
                performanceMode: resolveChatPerformanceMode(state),
                visualMode: state.settings.chatVisualMode ?? "professional",
                visualDensity: state.settings.chatVisualDensity ?? "comfortable",
                sidebarDefault: state.settings.chatSidebarDefault ?? "collapsed",
                subagentMatchMode: resolveSubagentMatchMode(state),
                sessionKey: state.sessionKey,
                onSessionKeyChange: (next) => switchChatSession(next),
                thinkingLevel: state.chatThinkingLevel,
                showThinking,
                loading: state.chatLoading,
                sending: state.chatSending,
                compactionStatus: state.compactionStatus,
                fallbackStatus: state.fallbackStatus,
                assistantAvatarUrl: chatAvatarUrl,
                messages: state.chatMessages,
                toolMessages: state.chatToolMessages,
                stream: state.chatStream,
                streamThinking: state.chatStreamThinking,
                streamStartedAt: state.chatStreamStartedAt,
                draft: state.chatMessage,
                queue: state.chatQueue,
                connected: state.connected,
                canSend: state.connected,
                disabledReason: chatDisabledReason,
                error: state.lastError,
                sessions: state.sessionsResult,
                focusMode: chatFocus,
                cognitivePlan: state.sandboxCognitivePlan ?? null,
                executionWatchdog: state.executionWatchdog,
                onRefresh: () => {
                  state.resetToolStream();
                  return Promise.all([loadChatHistory(state), refreshChatAvatar(state)]);
                },
                onToggleFocusMode: () => {
                  if (state.onboarding) {
                    return;
                  }
                  state.applySettings({
                    ...state.settings,
                    chatFocusMode: !state.settings.chatFocusMode,
                  });
                },
                onChatScroll: (event) => state.handleChatScroll(event),
                onDraftChange: (next) => {
                  state.chatMessage = next;
                  cacheDraft(state, state.sessionKey, next);
                },
                attachments: state.chatAttachments,
                onAttachmentsChange: (next) => (state.chatAttachments = next),
                onSend: handleWorkbenchSend,
                canAbort: Boolean(state.chatRunId),
                onAbort: () => void state.handleAbortChat(),
                onQueueRemove: (id) => state.removeQueuedMessage(id),
                onNewSession: () => state.handleSendChat("/new", { restoreDraft: true }),
                onOpenSandbox: () => state.setTab("sandbox"),
                onOpenAeon: () => state.setTab("aeon"),
                onOpenAgents: () => state.setTab("agents"),
                onOpenCognitiveSource: () => void state.handleOpenCognitiveSource(),
                onReopenCognitiveMemory: () => void state.handleReopenCognitiveMemory(),
                onSpawnAgentsFromPlan: handleSpawnAgentsFromPlan,
                autopilotEnabled: state.settings.chatAutopilotEnabled ?? true,
                onToggleAutopilot: (enabled: boolean) =>
                  state.applySettings({
                    ...state.settings,
                    chatAutopilotEnabled: enabled,
                  }),
                autopilotMaxConcurrent: state.settings.chatAutopilotMaxConcurrent ?? 2,
                onAutopilotMaxConcurrentChange: handleAutopilotMaxConcurrentChange,
                onAutopilotDispatchNow: () =>
                  runAutopilotTick(state.settings.chatAutopilotMaxConcurrent ?? 2),
                onForceStartTodo: (todoId) => forceStartCognitiveNode(state, todoId),
                eternalMode: state.aeonEternalMode,
                onToggleEternalMode: () =>
                  void state.handleToggleEternalMode(!state.aeonEternalMode, "local"),
                manualState: {
                  visible: state.chatManualVisible,
                  mode: state.chatManualMode,
                  activeSection: state.chatManualSection,
                  lastOpenedAt: state.chatManualLastOpenedAt,
                  dismissedHints: state.chatManualDismissedHints,
                },
                aeonSystemStatus: state.aeonSystemStatus,
                onManualToggle: (visible, options) =>
                  state.handleToggleChatManual(visible, options),
                onManualModeChange: (mode) => state.handleToggleChatManual(true, { mode }),
                onManualSectionChange: (section) => state.handleToggleChatManual(true, { section }),
                manualRuntime: {
                  delivery: {
                    state: state.aeonSystemStatus?.execution?.delivery?.state ?? "persist_failed",
                    persistedAt: state.aeonSystemStatus?.execution?.delivery?.persistedAt
                      ? new Date(
                          state.aeonSystemStatus.execution.delivery.persistedAt,
                        ).toISOString()
                      : null,
                  },
                  eternalMode: {
                    enabled: state.aeonEternalMode,
                    source: state.aeonEternalModeSource,
                  },
                  chaosScore: state.chatChaosScore,
                  epiphanyFactor: state.chatEpiphanyFactor,
                  fractalState: {
                    depthLevel: (1 +
                      Math.round(
                        Math.max(0, Math.min(1, state.chatChaosScore / 10)) * 0.65 * 3 +
                          Math.max(0, Math.min(1, state.chatEpiphanyFactor)) * 0.35 * 3,
                      )) as 1 | 2 | 3 | 4,
                    resonanceLevel: Math.max(0, Math.min(1, state.chatEpiphanyFactor)),
                    formulaPhase:
                      state.aeonSystemStatus?.execution?.delivery?.state === "persist_failed"
                        ? "error"
                        : state.chatStream
                          ? "active"
                          : "idle",
                    noiseLevel: Math.max(
                      0.08,
                      Math.min(
                        0.9,
                        0.15 + Math.max(0, Math.min(1, state.chatChaosScore / 10)) * 0.55,
                      ),
                    ),
                    deliveryBand:
                      state.aeonSystemStatus?.execution?.delivery?.state === "persist_failed"
                        ? "warn"
                        : state.aeonSystemStatus?.execution?.delivery?.state === "persisted" ||
                            state.aeonSystemStatus?.execution?.delivery?.state === "acknowledged"
                          ? "safe"
                          : "pending",
                  },
                },
                onQuickCommand: handleQuickCommand,
                onRecoverExecution: handleRecoverExecution,
                showNewMessages: state.chatNewMessagesBelow && !state.chatManualRefreshInFlight,
                onScrollToBottom: () => state.scrollToBottom(),
                // Sidebar props for tool output viewing
                sidebarOpen: state.sidebarOpen,
                sidebarContent: state.sidebarContent,
                sidebarError: state.sidebarError,
                splitRatio: state.splitRatio,
                onOpenSidebar: (content: string) => state.handleOpenSidebar(content),
                onCloseSidebar: () => state.handleCloseSidebar(),
                onSplitRatioChange: (ratio: number) => state.handleSplitRatioChange(ratio),
                assistantName: state.assistantName,
                assistantAvatar: state.assistantAvatar,
                webSearchEnabled: state.chatWebSearchEnabled,
                onToggleWebSearch: (enabled: boolean) => state.handleToggleWebSearch(enabled),
                onApprovePlan: () => {
                  void (async () => {
                    let changedToExecution = false;
                    try {
                      if (state.client) {
                        const listRes = await state.client.request<{
                          ok?: boolean;
                          tasks?: Array<{ id: string; sessionKey: string; updatedAt: number }>;
                        }>("cognitive.task.list", { limit: 80 });
                        const tasks = Array.isArray(listRes?.tasks) ? listRes.tasks : [];
                        const selected = tasks
                          .filter((task) => task.sessionKey === state.sessionKey)
                          .toSorted((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];
                        if (selected?.id) {
                          await state.client.request<{ ok?: boolean; task?: unknown }>(
                            "cognitive.task.transition",
                            {
                              taskId: selected.id,
                              to: "EXECUTE",
                              reason: "ui_approve_plan",
                            },
                          );
                          changedToExecution = true;
                          await loadSandboxCognitivePlan(state as any);
                        }
                        if (changedToExecution) {
                          // Gateway event is the primary execution trigger.
                          // Queue one fallback send only if event path did not arrive in time.
                          window.setTimeout(() => {
                            if (
                              state.sandboxCognitivePlan?.phase === "planning" &&
                              !state.chatSending &&
                              !state.chatStream?.trim()
                            ) {
                              state.chatMessage =
                                "计划已批准。立即进入 execution 阶段，禁止再次规划，按当前 TODO 逐项执行并在每步后汇报结果。";
                              void state.handleSendChat();
                            }
                          }, 1200);
                        }
                      }
                    } catch (err) {
                      state.lastError = `Failed to approve cognitive plan: ${String(err)}`;
                      return;
                    }
                    // Legacy fallback for gateways without execution trigger broadcast support.
                    if (!changedToExecution && state.sandboxCognitivePlan?.phase === "execution") {
                      state.chatMessage = "继续执行当前 execution 阶段任务，逐项完成并回填结果。";
                      if (state.chatSending || Boolean(state.chatStream?.trim())) {
                        state.executionAutoQueued = true;
                        return;
                      }
                      state.executionAutoQueued = false;
                      await state.handleSendChat();
                    }
                  })();
                },
                onRetryPlanStage: handleRetryPlanStage,
                onBranchFromCurrent: handleBranchFromCurrent,
                onSwitchBranch: handleSwitchBranch,
                onRollbackToLatestCheckpoint: handleRollbackToLatestCheckpoint,
                onRestoreCheckpoint: handleRestoreCheckpoint,
                onVerifierReport: handleVerifierReport,
                onDistillDream: handleDistillDream,
                onQueryCognitivePlanGraph: handleQueryCognitivePlanGraph,
                onClearCognitivePlanGraph: handleClearCognitivePlanGraph,
                onCognitivePlanGraphNodeIdChange: handleCognitivePlanGraphNodeIdChange,
                onCognitivePlanGraphRelationChange: handleCognitivePlanGraphRelationChange,
                onCognitivePlanGraphAutoTrackChange: handleCognitivePlanGraphAutoTrackChange,
                onCognitivePlanGraphPageChange: handleCognitivePlanGraphPageChange,
                onCognitivePlanGraphTrailJump: handleCognitivePlanGraphTrailJump,
                onCognitivePlanGraphExpandedRelationChange:
                  handleCognitivePlanGraphExpandedRelationChange,
                cognitivePlanGraphEdges: state.cognitivePlanGraphEdges,
                cognitivePlanGraphLoading: state.cognitivePlanGraphLoading,
                cognitivePlanGraphError: state.cognitivePlanGraphError,
                cognitivePlanGraphNodeId: state.cognitivePlanGraphNodeId,
                cognitivePlanGraphRelation: state.cognitivePlanGraphRelation,
                cognitivePlanGraphAutoTrack: state.cognitivePlanGraphAutoTrack,
                cognitivePlanGraphPage: state.cognitivePlanGraphPage,
                cognitivePlanGraphPageSize: state.cognitivePlanGraphPageSize,
                cognitivePlanGraphTrail: state.cognitivePlanGraphTrail,
                cognitivePlanGraphExpandedRelation: state.cognitivePlanGraphExpandedRelation,
                cognitivePlanGraphSourceBreadcrumb: state.cognitivePlanGraphSourceBreadcrumb,
                cognitivePlanGraphSourceMemory: state.cognitivePlanGraphSourceMemory,
                cognitivePlanGraphSourceContext: state.cognitivePlanGraphSourceContext,
                cognitivePlanGraphSourceSelectedLine: state.cognitivePlanGraphSourceSelectedLine,
                cognitivePlanFocusTodoId: state.cognitivePlanFocusTodoId,
                onCognitivePlanFocusTodoChange: handleCognitivePlanFocusTodoChange,
                sandboxSessions: state.sessionsResult?.sessions?.filter(
                  (r) => r.kind !== "global" && !r.systemSent,
                ),
                cognitiveLog: state.aeonSystemStatus?.evolution?.cognitiveLog,
                chaosScore,
                epiphanyFactor,
                riskScore,
                memorySaturation,
                executionDelivery: state.aeonSystemStatus?.execution?.delivery,
                fractalState: {
                  depthLevel: (1 +
                    Math.round(
                      Math.max(0, Math.min(1, state.chatChaosScore / 10)) * 0.65 * 3 +
                        Math.max(0, Math.min(1, state.chatEpiphanyFactor)) * 0.35 * 3,
                    )) as 1 | 2 | 3 | 4,
                  resonanceLevel: Math.max(0, Math.min(1, state.chatEpiphanyFactor)),
                  formulaPhase:
                    state.aeonSystemStatus?.execution?.delivery?.state === "persist_failed"
                      ? "error"
                      : state.chatStream
                        ? "active"
                        : "idle",
                  noiseLevel: Math.max(
                    0.08,
                    Math.min(
                      0.9,
                      0.15 + Math.max(0, Math.min(1, state.chatChaosScore / 10)) * 0.55,
                    ),
                  ),
                  deliveryBand:
                    state.aeonSystemStatus?.execution?.delivery?.state === "persist_failed"
                      ? "warn"
                      : state.aeonSystemStatus?.execution?.delivery?.state === "persisted" ||
                          state.aeonSystemStatus?.execution?.delivery?.state === "acknowledged"
                        ? "safe"
                        : "pending",
                },
              })
            : nothing
        }

        ${
          state.tab === "config"
            ? renderConfig({
                raw: state.configRaw,
                originalRaw: state.configRawOriginal,
                valid: state.configValid,
                issues: state.configIssues,
                loading: state.configLoading,
                saving: state.configSaving,
                applying: state.configApplying,
                updating: state.updateRunning,
                connected: state.connected,
                schema: state.configSchema,
                schemaLoading: state.configSchemaLoading,
                uiHints: state.configUiHints,
                formMode: state.configFormMode,
                formValue: state.configForm,
                originalValue: state.configFormOriginal,
                searchQuery: state.configSearchQuery,
                activeSection: state.configActiveSection,
                activeSubsection: state.configActiveSubsection,
                onRawChange: (next) => {
                  state.configRaw = next;
                },
                onFormModeChange: (mode) => (state.configFormMode = mode),
                onFormPatch: (path, value) => updateConfigFormValue(state, path, value),
                onSearchChange: (query) => (state.configSearchQuery = query),
                onSectionChange: (section) => {
                  state.configActiveSection = section;
                  state.configActiveSubsection = null;
                },
                onSubsectionChange: (section) => (state.configActiveSubsection = section),
                onReload: () => loadConfig(state),
                onSave: () => saveConfig(state),
                onApply: () => applyConfig(state),
                onUpdate: () => runUpdate(state),
              })
            : nothing
        }

        ${
          state.tab === "debug"
            ? renderDebug({
                loading: state.debugLoading,
                status: state.debugStatus,
                health: state.debugHealth,
                models: state.debugModels,
                heartbeat: state.debugHeartbeat,
                eventLog: state.eventLog,
                callMethod: state.debugCallMethod,
                callParams: state.debugCallParams,
                callResult: state.debugCallResult,
                callError: state.debugCallError,
                onCallMethodChange: (next) => (state.debugCallMethod = next),
                onCallParamsChange: (next) => (state.debugCallParams = next),
                onRefresh: () => loadDebug(state),
                onCall: () => callDebugMethod(state),
              })
            : nothing
        }

        ${
          state.tab === "logs"
            ? renderLogs({
                loading: state.logsLoading,
                error: state.logsError,
                file: state.logsFile,
                entries: state.logsEntries,
                filterText: state.logsFilterText,
                levelFilters: state.logsLevelFilters,
                autoFollow: state.logsAutoFollow,
                truncated: state.logsTruncated,
                onFilterTextChange: (next) => (state.logsFilterText = next),
                onLevelToggle: (level, enabled) => {
                  state.logsLevelFilters = { ...state.logsLevelFilters, [level]: enabled };
                },
                onToggleAutoFollow: (next) => (state.logsAutoFollow = next),
                onRefresh: () => loadLogs(state, { reset: true }),
                onExport: (lines, label) => state.exportLogs(lines, label),
                onScroll: (event) => state.handleLogsScroll(event),
              })
            : nothing
        }
      </main>
      </div>
      ${renderExecApprovalPrompt(state)}
      ${renderGatewayUrlConfirmation(state)}
      ${renderCognitivePlanConfirmation(state)}
    </div>
      </div>
    </div>
  `;
}
