import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_SUBAGENT_MAX_CHILDREN,
  DEFAULT_SUBAGENT_MAX_SPAWN_DEPTH,
} from "../config/agent-limits.js";
import { loadConfig } from "../config/config.js";
import { formatThinkingLevels, normalizeThinkLevel } from "../auto-reply/thinking.js";
import { callGateway } from "../gateway/call.js";
import { getGlobalHookRunner } from "../plugins/hook-runner-global.js";
import {
  isCronSessionKey,
  normalizeAgentId,
  parseAgentSessionKey,
} from "../routing/session-key.js";
import { normalizeDeliveryContext } from "../utils/delivery-context.js";
import {
  resolveAgentConfig,
  resolveAgentSkillsFilter,
  resolveSubagentFixedSkills,
  resolveSubagentInheritSkills,
} from "./agent-scope.js";
import { AGENT_LANE_SUBAGENT } from "./lanes.js";
import { resolveSubagentSpawnModelSelection } from "./model-selection.js";
import { resolveSandboxRuntimeStatus } from "./sandbox/runtime-status.js";
import { buildSubagentSystemPrompt } from "./subagent-announce.js";
import { readLatestSubagentOutput } from "./subagent-announce.js";
import { resolveWorkspaceRoot } from "./workspace-dir.js";
import { getSubagentDepthFromSessionStore } from "./subagent-depth.js";
import {
  countActiveRunsForSession,
  registerSubagentRun,
  waitForSubagentCompletion,
} from "./subagent-registry.js";
import { readStringParam } from "./tools/common.js";
import { runAgentStep, readLatestAssistantReply } from "./tools/agent-step.js";
import {
  resolveDisplaySessionKey,
  resolveInternalSessionKey,
  resolveMainSessionAlias,
} from "./tools/sessions-helpers.js";

export const SUBAGENT_SPAWN_MODES = ["run", "session"] as const;
export type SpawnSubagentMode = (typeof SUBAGENT_SPAWN_MODES)[number];
export const SUBAGENT_SPAWN_SANDBOX_MODES = ["inherit", "require"] as const;
export type SpawnSubagentSandboxMode = (typeof SUBAGENT_SPAWN_SANDBOX_MODES)[number];

export type SpawnSubagentParams = {
  task: string;
  label?: string;
  agentId?: string;
  model?: string;
  thinking?: string;
  runTimeoutSeconds?: number;
  thread?: boolean;
  mode?: SpawnSubagentMode;
  cleanup?: "delete" | "keep";
  sandbox?: SpawnSubagentSandboxMode;
  expectsCompletionMessage?: boolean;
  tools?: string[];
  skills?: string[];
  sharedContext?: Record<string, unknown>;
  role?: "manager" | "worker";
  /** Dialectic Evolution: Spawn positive/negative pair and synthesize. */
  dialecticMode?: boolean;
};

export type SpawnSubagentContext = {
  agentSessionKey?: string;
  agentChannel?: string;
  agentAccountId?: string;
  agentTo?: string;
  agentThreadId?: string | number;
  agentGroupId?: string | null;
  agentGroupChannel?: string | null;
  agentGroupSpace?: string | null;
  requesterAgentIdOverride?: string;
  /** Multi-agent Cognitive Loop Fusion: current recursive iteration depth */
  iterationDepth?: number;
  /** Authorized Freedom Mode: bypass or scale standard limits */
  freedom?: boolean;
};

export const SUBAGENT_SPAWN_ACCEPTED_NOTE =
  "auto-announces on completion, do not poll/sleep. The response will be sent back as an user message.";
export const SUBAGENT_SPAWN_SESSION_ACCEPTED_NOTE =
  "thread-bound session stays active after this task; continue in-thread for follow-ups.";

export type SpawnSubagentResult = {
  status: "accepted" | "forbidden" | "error";
  childSessionKey?: string;
  runId?: string;
  mode?: SpawnSubagentMode;
  note?: string;
  modelApplied?: boolean;
  completionText?: string;
  error?: string;
};

export function splitModelRef(ref?: string) {
  if (!ref) {
    return { provider: undefined, model: undefined };
  }
  const trimmed = ref.trim();
  if (!trimmed) {
    return { provider: undefined, model: undefined };
  }
  const [provider, model] = trimmed.split("/", 2);
  if (model) {
    return { provider, model };
  }
  return { provider: undefined, model: trimmed };
}

function resolveSpawnMode(params: {
  requestedMode?: SpawnSubagentMode;
  threadRequested: boolean;
}): SpawnSubagentMode {
  if (params.requestedMode === "run" || params.requestedMode === "session") {
    return params.requestedMode;
  }
  // Thread-bound spawns should default to persistent sessions.
  return params.threadRequested ? "session" : "run";
}

function summarizeError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "string") {
    return err;
  }
  return "error";
}

async function ensureThreadBindingForSubagentSpawn(params: {
  hookRunner: ReturnType<typeof getGlobalHookRunner>;
  childSessionKey: string;
  agentId: string;
  label?: string;
  mode: SpawnSubagentMode;
  requesterSessionKey?: string;
  requester: {
    channel?: string;
    accountId?: string;
    to?: string;
    threadId?: string | number;
  };
}): Promise<{ status: "ok" } | { status: "error"; error: string }> {
  const hookRunner = params.hookRunner;
  if (!hookRunner?.hasHooks("subagent_spawning")) {
    return {
      status: "error",
      error:
        "thread=true is unavailable because no channel plugin registered subagent_spawning hooks.",
    };
  }

  try {
    const result = await hookRunner.runSubagentSpawning(
      {
        childSessionKey: params.childSessionKey,
        agentId: params.agentId,
        label: params.label,
        mode: params.mode,
        requester: params.requester,
        threadRequested: true,
      },
      {
        childSessionKey: params.childSessionKey,
        requesterSessionKey: params.requesterSessionKey,
      },
    );
    if (result?.status === "error") {
      const error = result.error.trim();
      return {
        status: "error",
        error: error || "Failed to prepare thread binding for this subagent session.",
      };
    }
    if (result?.status !== "ok" || !result.threadBindingReady) {
      return {
        status: "error",
        error:
          "Unable to create or bind a thread for this subagent session. Session mode is unavailable for this target.",
      };
    }
    return { status: "ok" };
  } catch (err) {
    return {
      status: "error",
      error: `Thread bind failed: ${summarizeError(err)}`,
    };
  }
}

async function spawnDialecticSubagent(
  params: SpawnSubagentParams,
  ctx: SpawnSubagentContext,
): Promise<SpawnSubagentResult> {
  const { task, label, runTimeoutSeconds } = params;
  const timeoutMs = (runTimeoutSeconds || 120) * 1000;

  // Step 1: Thesis (正题) - Initial proposal
  const thesisParams: SpawnSubagentParams = {
    ...params,
    dialecticMode: false,
    label: `${label || "Task"} [Thesis]`,
  };
  const thesisResult = await spawnSubagentDirect(thesisParams, ctx);
  if (thesisResult.status !== "accepted") return thesisResult;

  // Wait for Thesis to complete and read result
  if (thesisResult.runId && thesisResult.childSessionKey) {
    await waitForSubagentCompletion(thesisResult.runId, timeoutMs);
  }
  const thesisOutput = thesisResult.childSessionKey
    ? await readLatestAssistantReply({ sessionKey: thesisResult.childSessionKey })
    : undefined;

  // Step 2: Parallel Antitheses (并行反题) - Multiple critical perspectives
  const antithesisPersonas = [
    {
      name: "Logic Critic",
      prompt: "作为一个极度严苛的逻辑审查者，指出其中所有潜在的逻辑漏洞和推导缺陷。",
    },
    {
      name: "Security & Risk Analyst",
      prompt: "作为一个安全专家，指出其中所有潜在的安全性风险、隐私隐患或边缘案例崩溃点。",
    },
    {
      name: "Optimization Architect",
      prompt: "作为一个资深架构师，指出是否有性能更优、更简洁或更具扩展性的替代路径。",
    },
  ];

  const antithesisPromises = antithesisPersonas.map(async (persona) => {
    const antithesisTask = `${persona.prompt}

任务内容：
${task}

初步方案（正题）：
${thesisOutput || "(无输出内容)"}`;

    const antithesisParams: SpawnSubagentParams = {
      ...params,
      task: antithesisTask,
      dialecticMode: false,
      label: `${label || "Task"} [Antithesis - ${persona.name}]`,
    };

    const result = await spawnSubagentDirect(antithesisParams, ctx);
    if (result.status === "accepted" && result.runId && result.childSessionKey) {
      await waitForSubagentCompletion(result.runId, timeoutMs);
      return await readLatestAssistantReply({ sessionKey: result.childSessionKey });
    }
    return undefined;
  });

  const antithesisOutputs = (await Promise.all(antithesisPromises)).filter(Boolean);

  // Step 3: Synthesis (合题) - Final integration
  const synthesisTask = `作为智慧综合者，请深入综合以下主执行方案（正题）与多方面的严苛审查建议（反题组），通过逻辑冲突的“量子折叠”消除矛盾，给出一个最终的、工业级的、考虑了所有边缘风险的完善方案。

任务背景：
${task}

正题方案：
${thesisOutput || "(无输出内容)"}

反题审查结论：
${antithesisOutputs.map((out, i) => `[审查者 ${i + 1}]:\n${out}`).join("\n\n") || "(无反题内容)"}`;

  const synthesisParams: SpawnSubagentParams = {
    ...params,
    task: synthesisTask,
    dialecticMode: false,
    label: `${label || "Task"} [Synthesis]`,
  };

  // The final run in the dialectic chain is the one we return as the "result".
  return await spawnSubagentDirect(synthesisParams, ctx);
}

export async function spawnSubagentDirect(
  params: SpawnSubagentParams,
  ctx: SpawnSubagentContext,
): Promise<SpawnSubagentResult> {
  const task = params.task;
  const label = params.label?.trim() || "";
  const requestedAgentId = params.agentId;
  const modelOverride = params.model;
  const thinkingOverrideRaw = params.thinking;
  const requestThreadBinding = params.thread === true;
  const sandboxMode = params.sandbox === "require" ? "require" : "inherit";
  const spawnMode = resolveSpawnMode({
    requestedMode: params.mode,
    threadRequested: requestThreadBinding,
  });
  if (spawnMode === "session" && !requestThreadBinding) {
    return {
      status: "error",
      error: 'mode="session" requires thread=true so the subagent can stay bound to a thread.',
    };
  }

  if (params.dialecticMode) {
    return await spawnDialecticSubagent(params, ctx);
  }

  const cleanup =
    spawnMode === "session"
      ? "keep"
      : params.cleanup === "keep" || params.cleanup === "delete"
        ? params.cleanup
        : "keep";
  const expectsCompletionMessage = params.expectsCompletionMessage !== false;
  const requesterOrigin = normalizeDeliveryContext({
    channel: ctx.agentChannel,
    accountId: ctx.agentAccountId,
    to: ctx.agentTo,
    threadId: ctx.agentThreadId,
  });
  const hookRunner = getGlobalHookRunner();
  const cfg = loadConfig();

  // When agent omits runTimeoutSeconds, use the config default.
  // Falls back to 0 (no timeout) if config key is also unset,
  // preserving current behavior for existing deployments.
  const cfgSubagentTimeout =
    typeof cfg?.agents?.defaults?.subagents?.runTimeoutSeconds === "number" &&
    Number.isFinite(cfg.agents.defaults.subagents.runTimeoutSeconds)
      ? Math.max(0, Math.floor(cfg.agents.defaults.subagents.runTimeoutSeconds))
      : 600; // default 10m if unset (align with DEFAULT_AGENT_TIMEOUT_SECONDS)
  const runTimeoutSecondsCandidate =
    typeof params.runTimeoutSeconds === "number" && Number.isFinite(params.runTimeoutSeconds)
      ? Math.max(0, Math.floor(params.runTimeoutSeconds))
      : cfgSubagentTimeout;
  // If explicitly set to 0, use the config default if it's non-zero.
  const runTimeoutSeconds =
    runTimeoutSecondsCandidate === 0 && cfgSubagentTimeout > 0
      ? cfgSubagentTimeout
      : runTimeoutSecondsCandidate;
  let modelApplied = false;
  let threadBindingReady = false;
  const { mainKey, alias } = resolveMainSessionAlias(cfg);
  const requesterSessionKey = ctx.agentSessionKey;
  const requesterInternalKey = requesterSessionKey
    ? resolveInternalSessionKey({
        key: requesterSessionKey,
        alias,
        mainKey,
      })
    : alias;
  const requesterDisplayKey = resolveDisplaySessionKey({
    key: requesterInternalKey,
    alias,
    mainKey,
  });

  const callerDepth = getSubagentDepthFromSessionStore(requesterInternalKey, { cfg });
  const maxSpawnDepth =
    cfg.agents?.defaults?.subagents?.maxSpawnDepth ?? DEFAULT_SUBAGENT_MAX_SPAWN_DEPTH;
  if (callerDepth >= maxSpawnDepth) {
    return {
      status: "forbidden",
      error: `sessions_spawn is not allowed at this depth (current depth: ${callerDepth}, max: ${maxSpawnDepth})`,
    };
  }

  const maxChildren = cfg.agents?.defaults?.subagents?.maxChildrenPerAgent ?? 5;
  const activeChildren = countActiveRunsForSession(requesterInternalKey);
  if (activeChildren >= maxChildren) {
    return {
      status: "forbidden",
      error: `sessions_spawn has reached max active children for this session (${activeChildren}/${maxChildren})`,
    };
  }

  const requesterAgentId = normalizeAgentId(
    ctx.requesterAgentIdOverride ?? parseAgentSessionKey(requesterInternalKey)?.agentId,
  );
  const targetAgentId = requestedAgentId ? normalizeAgentId(requestedAgentId) : requesterAgentId;
  if (targetAgentId !== requesterAgentId) {
    const allowAgents = resolveAgentConfig(cfg, requesterAgentId)?.subagents?.allowAgents ?? [];
    const allowAny = allowAgents.some((value) => value.trim() === "*");
    const normalizedTargetId = targetAgentId.toLowerCase();
    const allowSet = new Set(
      allowAgents
        .filter((value) => value.trim() && value.trim() !== "*")
        .map((value) => normalizeAgentId(value).toLowerCase()),
    );
    if (!allowAny && !allowSet.has(normalizedTargetId)) {
      const allowedText = allowSet.size > 0 ? Array.from(allowSet).join(", ") : "none";
      return {
        status: "forbidden",
        error: `agentId is not allowed for sessions_spawn (allowed: ${allowedText})`,
      };
    }
  }
  const childSessionKey = `agent:${targetAgentId}:subagent:${crypto.randomUUID()}`;
  const requesterRuntime = resolveSandboxRuntimeStatus({
    cfg,
    sessionKey: requesterInternalKey,
  });
  const childRuntime = resolveSandboxRuntimeStatus({
    cfg,
    sessionKey: childSessionKey,
  });
  if (!childRuntime.sandboxed && (requesterRuntime.sandboxed || sandboxMode === "require")) {
    if (requesterRuntime.sandboxed) {
      return {
        status: "forbidden",
        error:
          "Sandboxed sessions cannot spawn unsandboxed subagents. Set a sandboxed target agent or use the same agent runtime.",
      };
    }
    return {
      status: "forbidden",
      error:
        'sessions_spawn sandbox="require" needs a sandboxed target runtime. Pick a sandboxed agentId or use sandbox="inherit".',
    };
  }
  const childDepth = callerDepth + 1;
  const spawnedByKey = requesterInternalKey;
  const targetAgentConfig = resolveAgentConfig(cfg, targetAgentId);
  const resolvedModel = resolveSubagentSpawnModelSelection({
    cfg,
    agentId: targetAgentId,
    modelOverride,
  });

  const resolvedThinkingDefaultRaw =
    readStringParam(targetAgentConfig?.subagents ?? {}, "thinking") ??
    readStringParam(cfg.agents?.defaults?.subagents ?? {}, "thinking");

  // Multi-agent Cognitive Loop Fusion: Resolve and merge skills
  const parentSkills = resolveAgentSkillsFilter(cfg, requesterAgentId);
  const inheritEnabled = resolveSubagentInheritSkills(cfg, requesterAgentId);
  const subagentFixedSkills = resolveSubagentFixedSkills(cfg, requesterAgentId);

  const mergedSkills = new Set<string>();

  // 1. Inherit parent skills if enabled
  if (inheritEnabled && parentSkills) {
    for (const s of parentSkills) mergedSkills.add(s);
  }

  // 2. Add subagent fixed skills defined by parent
  if (subagentFixedSkills) {
    for (const s of subagentFixedSkills) mergedSkills.add(s);
  }

  // 3. Add explicitly requested skills
  if (params.skills) {
    for (const s of params.skills) mergedSkills.add(s);
  }

  const finalSkills = mergedSkills.size > 0 ? Array.from(mergedSkills) : undefined;

  let thinkingOverride: string | undefined;
  const thinkingCandidateRaw = thinkingOverrideRaw || resolvedThinkingDefaultRaw;
  if (thinkingCandidateRaw) {
    const normalized = normalizeThinkLevel(thinkingCandidateRaw);
    if (!normalized) {
      const { provider, model } = splitModelRef(resolvedModel);
      const hint = formatThinkingLevels(provider, model);
      return {
        status: "error",
        error: `Invalid thinking level "${thinkingCandidateRaw}". Use one of: ${hint}.`,
      };
    }
    thinkingOverride = normalized;
  }
  try {
    await callGateway({
      method: "sessions.patch",
      params: { key: childSessionKey, spawnDepth: childDepth },
      timeoutMs: 10_000,
    });
  } catch (err) {
    const messageText =
      err instanceof Error ? err.message : typeof err === "string" ? err : "error";
    return {
      status: "error",
      error: messageText,
      childSessionKey,
    };
  }

  if (resolvedModel) {
    try {
      await callGateway({
        method: "sessions.patch",
        params: { key: childSessionKey, model: resolvedModel },
        timeoutMs: 10_000,
      });
      modelApplied = true;
    } catch (err) {
      const messageText =
        err instanceof Error ? err.message : typeof err === "string" ? err : "error";
      return {
        status: "error",
        error: messageText,
        childSessionKey,
      };
    }
  }
  if (thinkingOverride !== undefined) {
    try {
      await callGateway({
        method: "sessions.patch",
        params: {
          key: childSessionKey,
          thinkingLevel: thinkingOverride === "off" ? null : thinkingOverride,
        },
        timeoutMs: 10_000,
      });
    } catch (err) {
      const messageText =
        err instanceof Error ? err.message : typeof err === "string" ? err : "error";
      return {
        status: "error",
        error: messageText,
        childSessionKey,
      };
    }
  }
  if (requestThreadBinding) {
    const bindResult = await ensureThreadBindingForSubagentSpawn({
      hookRunner,
      childSessionKey,
      agentId: targetAgentId,
      label: label || undefined,
      mode: spawnMode,
      requesterSessionKey: requesterInternalKey,
      requester: {
        channel: requesterOrigin?.channel,
        accountId: requesterOrigin?.accountId,
        to: requesterOrigin?.to,
        threadId: requesterOrigin?.threadId,
      },
    });
    if (bindResult.status === "error") {
      try {
        await callGateway({
          method: "sessions.delete",
          params: { key: childSessionKey, emitLifecycleHooks: false },
          timeoutMs: 10_000,
        });
      } catch {
        // Best-effort cleanup only.
      }
      return {
        status: "error",
        error: bindResult.error,
        childSessionKey,
      };
    }
    threadBindingReady = true;
  }

  // Multi-agent Cognitive Loop Fusion: Increment iteration depth for sub-agent
  const childIterationDepth = (ctx.iterationDepth ?? 0) + 1;

  // Hereditary Planning Ledger: Attempt to inherit parent's PLAN.md/TODO.md
  let inheritedLedger: string | undefined;
  try {
    const workspaceRoot = resolveWorkspaceRoot(cfg.agents?.defaults?.workspace);
    const planPaths = [path.join(workspaceRoot, "PLAN.md"), path.join(workspaceRoot, "TODO.md")];
    for (const planPath of planPaths) {
      try {
        const content = await fs.readFile(planPath, "utf-8");
        if (content.trim()) {
          inheritedLedger = content.trim();
          break;
        }
      } catch {
        // Continue to next path
      }
    }
  } catch {
    // Best-effort only
  }

  const sharedContext = {
    ...params.sharedContext,
    cognitiveDepth: childIterationDepth,
    inheritedLedger,
  };

  const childSystemPrompt = buildSubagentSystemPrompt({
    requesterSessionKey,
    requesterOrigin,
    childSessionKey,
    label: label || undefined,
    task,
    acpEnabled: cfg.acp?.enabled !== false,
    childDepth,
    maxSpawnDepth,
    freedomMode: ctx.freedom,
  });

  const childTaskMessage = [
    `[Subagent Context] You are running as a subagent (depth ${childDepth}/${maxSpawnDepth}, iteration ${childIterationDepth}). Results auto-announce to your requester; do not busy-poll for status.`,
    spawnMode === "session"
      ? "[Subagent Context] This subagent session is persistent and remains available for thread follow-up messages."
      : undefined,
    sharedContext
      ? `[Shared Context] The following context/memory was passed from your requester (Cognitive Iteration Formula: Z ⇌ Z² + C):\n\`\`\`json\n${JSON.stringify(sharedContext, null, 2)}\n\`\`\`\nIf you modify this shared state during your task, you MUST return the final updated JSON wrapped in a \`<updated_shared_context>\` XML block at the very end of your final response.`
      : undefined,
    `[Subagent Task]: ${task}`,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n\n");

  const childIdem = crypto.randomUUID();
  let childRunId: string = childIdem;
  try {
    const response = await callGateway<{ runId: string }>({
      method: "agent",
      params: {
        message: childTaskMessage,
        sessionKey: childSessionKey,
        channel: requesterOrigin?.channel,
        to: requesterOrigin?.to ?? undefined,
        accountId: requesterOrigin?.accountId ?? undefined,
        threadId: requesterOrigin?.threadId != null ? String(requesterOrigin.threadId) : undefined,
        idempotencyKey: childIdem,
        deliver: false,
        lane: AGENT_LANE_SUBAGENT,
        extraSystemPrompt: childSystemPrompt,
        thinking: thinkingOverride,
        timeout: runTimeoutSeconds,
        label: label || undefined,
        spawnedBy: spawnedByKey,
        groupId: ctx.agentGroupId ?? undefined,
        groupChannel: ctx.agentGroupChannel ?? undefined,
        groupSpace: ctx.agentGroupSpace ?? undefined,
        tools: params.tools,
        skills: finalSkills,
      },
      timeoutMs: 10_000,
    });
    if (typeof response?.runId === "string" && response.runId) {
      childRunId = response.runId;
    }
  } catch (err) {
    if (threadBindingReady) {
      const hasEndedHook = hookRunner?.hasHooks("subagent_ended") === true;
      let endedHookEmitted = false;
      if (hasEndedHook) {
        try {
          await hookRunner?.runSubagentEnded(
            {
              targetSessionKey: childSessionKey,
              targetKind: "subagent",
              reason: "spawn-failed",
              sendFarewell: true,
              accountId: requesterOrigin?.accountId,
              runId: childRunId,
              outcome: "error",
              error: "Session failed to start",
            },
            {
              runId: childRunId,
              childSessionKey,
              requesterSessionKey: requesterInternalKey,
            },
          );
          endedHookEmitted = true;
        } catch {
          // Spawn should still return an actionable error even if cleanup hooks fail.
        }
      }
      // Always delete the provisional child session after a failed spawn attempt.
      // If we already emitted subagent_ended above, suppress a duplicate lifecycle hook.
      try {
        await callGateway({
          method: "sessions.delete",
          params: {
            key: childSessionKey,
            deleteTranscript: true,
            emitLifecycleHooks: !endedHookEmitted,
          },
          timeoutMs: 10_000,
        });
      } catch {
        // Best-effort only.
      }
    }
    const messageText = summarizeError(err);
    return {
      status: "error",
      error: messageText,
      childSessionKey,
      runId: childRunId,
    };
  }

  registerSubagentRun({
    runId: childRunId,
    childSessionKey,
    requesterSessionKey: requesterInternalKey,
    requesterOrigin,
    requesterDisplayKey,
    task,
    cleanup,
    label: label || undefined,
    model: resolvedModel,
    runTimeoutSeconds,
    expectsCompletionMessage,
    spawnMode,
    sharedContext,
  });

  if (hookRunner?.hasHooks("subagent_spawned")) {
    try {
      await hookRunner.runSubagentSpawned(
        {
          runId: childRunId,
          childSessionKey,
          agentId: targetAgentId,
          label: label || undefined,
          requester: {
            channel: requesterOrigin?.channel,
            accountId: requesterOrigin?.accountId,
            to: requesterOrigin?.to,
            threadId: requesterOrigin?.threadId,
          },
          threadRequested: requestThreadBinding,
          mode: spawnMode,
        },
        {
          runId: childRunId,
          childSessionKey,
          requesterSessionKey: requesterInternalKey,
        },
      );
    } catch {
      // Spawn should still return accepted if spawn lifecycle hooks fail.
    }
  }

  // Check if we're in a cron isolated session - don't add "do not poll" note
  // because cron sessions end immediately after the agent produces a response,
  // so the agent needs to wait for subagent results to keep the turn alive.
  const isCronSession = isCronSessionKey(ctx.agentSessionKey);
  const note =
    spawnMode === "session"
      ? SUBAGENT_SPAWN_SESSION_ACCEPTED_NOTE
      : isCronSession
        ? undefined
        : SUBAGENT_SPAWN_ACCEPTED_NOTE;

  // Wait for completion if requested, so we can return the result inline
  let completionText: string | undefined;
  if (expectsCompletionMessage) {
    if (!isCronSession) {
      // Use config wait timeout
      const waitTimeoutMs =
        typeof params.runTimeoutSeconds === "number" && params.runTimeoutSeconds > 0
          ? params.runTimeoutSeconds * 1000 + 10_000
          : 300_000; // default 5m wait for inline result

      await waitForSubagentCompletion(childRunId, waitTimeoutMs);

      // Attempt to read the final message from the session
      try {
        const text = await readLatestSubagentOutput(childSessionKey);
        if (text) {
          completionText = text;
        }
      } catch {
        // Ignore read errors
      }
    }
  }

  return {
    status: "accepted",
    childSessionKey,
    runId: childRunId,
    mode: spawnMode,
    note,
    modelApplied: resolvedModel ? modelApplied : undefined,
    completionText,
  };
}
