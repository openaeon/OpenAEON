import crypto from "node:crypto";
import { loadConfig } from "../config/config.js";
import { callGateway } from "../gateway/call.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { normalizeDeliveryContext } from "../utils/delivery-context.js";
import { extractTaskResult, type TaskResult } from "./subagent-announce.js";
import { readLatestSubagentOutput } from "./subagent-announce.js";
import { resolveSubagentSpawnModelSelection } from "./model-selection.js";
import { buildSubagentSystemPrompt } from "./subagent-announce.js";
import { registerSubagentRun } from "./subagent-registry.js";
import { AGENT_LANE_SUBAGENT } from "./lanes.js";
import type { SubagentRunRecord } from "./subagent-registry.types.js";
import type { SubagentRunOutcome } from "./subagent-announce.js";

const log = createSubsystemLogger("subagent-retry");

/**
 * Policy controlling automatic retries for failed subagent runs.
 */
export interface RetryPolicy {
  /** Maximum number of retry attempts (default: 2). */
  maxRetries: number;
  /** Which task_result statuses should trigger a retry. */
  retryOnStatus: TaskResult["status"][];
  /** Optional model fallback chain for retries (e.g., try cheaper model first, then stronger). */
  modelFallback?: string[];
}

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 2,
  retryOnStatus: ["failed"],
  modelFallback: undefined,
};

/**
 * Resolve retry policy from config or return default.
 */
export function resolveRetryPolicy(cfg?: ReturnType<typeof loadConfig>): RetryPolicy {
  // @ts-expect-error - config type might not reflect runtime retry options yet
  const cfgRetry = cfg?.agents?.defaults?.subagents?.retry;
  if (!cfgRetry || typeof cfgRetry !== "object") {
    return DEFAULT_RETRY_POLICY;
  }
  const raw = cfgRetry as Record<string, unknown>;
  return {
    maxRetries:
      typeof raw.maxRetries === "number" && Number.isFinite(raw.maxRetries)
        ? Math.max(0, Math.floor(raw.maxRetries))
        : DEFAULT_RETRY_POLICY.maxRetries,
    retryOnStatus: Array.isArray(raw.retryOnStatus)
      ? (raw.retryOnStatus.filter(
          (s: unknown) => typeof s === "string" && ["success", "partial", "failed"].includes(s),
        ) as TaskResult["status"][])
      : DEFAULT_RETRY_POLICY.retryOnStatus,
    modelFallback: Array.isArray(raw.modelFallback)
      ? (raw.modelFallback.filter((m: unknown) => typeof m === "string" && m.trim()) as string[])
      : undefined,
  };
}

/**
 * Determine whether a failed subagent run should be retried.
 */
export function shouldRetrySubagentRun(params: {
  entry: SubagentRunRecord;
  taskResult?: TaskResult;
  outcome?: SubagentRunOutcome;
  policy: RetryPolicy;
}): boolean {
  const { entry, taskResult, outcome, policy } = params;

  // Never retry if retries are disabled.
  if (policy.maxRetries <= 0) return false;

  // Check retry count.
  const currentRetryCount = entry.retryCount ?? 0;
  if (currentRetryCount >= policy.maxRetries) {
    log.info(
      `[retry] run ${entry.runId} reached max retries (${currentRetryCount}/${policy.maxRetries}), not retrying`,
    );
    return false;
  }

  // Check if outcome or task result triggers a retry.
  if (taskResult && policy.retryOnStatus.includes(taskResult.status)) {
    log.info(
      `[retry] run ${entry.runId} task_result status="${taskResult.status}" matches retry policy`,
    );
    return true;
  }

  // Also retry on lifecycle errors/timeouts even without a task_result.
  if (!taskResult && (outcome?.status === "error" || outcome?.status === "timeout")) {
    log.info(`[retry] run ${entry.runId} outcome="${outcome.status}" (no task_result), retrying`);
    return true;
  }

  return false;
}

/**
 * Re-spawn a failed subagent with updated context (previous failure info).
 * Returns the new runId if successful, or undefined if the retry spawn fails.
 */
export async function retrySubagentRun(params: {
  originalEntry: SubagentRunRecord;
  taskResult?: TaskResult;
  retryCount: number;
  policy: RetryPolicy;
}): Promise<string | undefined> {
  const { originalEntry, taskResult, retryCount, policy } = params;
  const cfg = loadConfig();

  // Determine model for retry — use fallback chain if available.
  let retryModel = originalEntry.model;
  if (policy.modelFallback && policy.modelFallback.length > 0) {
    // Use modular fallback: index into the fallback chain by retry attempt.
    const fallbackIndex = Math.min(retryCount - 1, policy.modelFallback.length - 1);
    if (fallbackIndex >= 0) {
      retryModel = policy.modelFallback[fallbackIndex];
      log.info(
        `[retry] run ${originalEntry.runId} retry #${retryCount} using fallback model: ${retryModel}`,
      );
    }
  }

  // Build a retry context that includes the previous failure info.
  const retryContext: Record<string, unknown> = {
    _retryInfo: {
      attempt: retryCount,
      maxRetries: policy.maxRetries,
      previousStatus: taskResult?.status ?? "error",
      previousSummary: taskResult?.summary ?? "No structured result available",
      previousBlockers: taskResult?.blockers ?? [],
      instruction:
        "This is an automatic retry. The previous attempt failed. " +
        "Please try a different approach or strategy to complete the task. " +
        "Review the blockers above and adapt your plan accordingly.",
    },
  };

  const targetAgentId = originalEntry.childSessionKey.split(":")[1] ?? "main";
  const childSessionKey = `agent:${targetAgentId}:subagent:${crypto.randomUUID()}`;
  const requesterOrigin = normalizeDeliveryContext(originalEntry.requesterOrigin);

  // Patch child session with retry depth.
  try {
    await callGateway({
      method: "sessions.patch",
      params: { key: childSessionKey, spawnDepth: 1 },
      timeoutMs: 10_000,
    });
  } catch (err) {
    log.error(`[retry] failed to create child session for retry: ${err}`);
    return undefined;
  }

  // Apply model to the child session.
  const resolvedModel =
    retryModel ??
    resolveSubagentSpawnModelSelection({
      cfg,
      agentId: targetAgentId,
    });
  if (resolvedModel) {
    try {
      await callGateway({
        method: "sessions.patch",
        params: { key: childSessionKey, model: resolvedModel },
        timeoutMs: 10_000,
      });
    } catch (err) {
      log.error(`[retry] failed to set model for retry session: ${err}`);
    }
  }

  // Build system prompt and task message.
  const childSystemPrompt = buildSubagentSystemPrompt({
    requesterSessionKey: originalEntry.requesterSessionKey,
    requesterOrigin,
    childSessionKey,
    label: originalEntry.label
      ? `${originalEntry.label} (retry #${retryCount})`
      : `retry-${retryCount}`,
    task: originalEntry.task,
    childDepth: 1,
  });

  const childTaskMessage = [
    `[Subagent Context] Automatic retry #${retryCount}/${policy.maxRetries}. The previous attempt failed.`,
    `[Retry Context]\n\`\`\`json\n${JSON.stringify(retryContext._retryInfo, null, 2)}\n\`\`\``,
    `[Subagent Task]: ${originalEntry.task}`,
  ].join("\n\n");

  const childIdem = crypto.randomUUID();
  let childRunId = childIdem as `${string}-${string}-${string}-${string}-${string}`;

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
        timeout: originalEntry.runTimeoutSeconds,
        label: originalEntry.label
          ? `${originalEntry.label} (retry #${retryCount})`
          : `retry-${retryCount}`,
        spawnedBy: originalEntry.requesterSessionKey,
      },
      timeoutMs: 10_000,
    });
    if (typeof response?.runId === "string" && response.runId.includes("-")) {
      childRunId = response.runId as `${string}-${string}-${string}-${string}-${string}`;
    }
  } catch (err) {
    log.error(`[retry] failed to spawn retry agent: ${err}`);
    return undefined;
  }

  // Register the retry run.
  registerSubagentRun({
    runId: childRunId,
    childSessionKey,
    requesterSessionKey: originalEntry.requesterSessionKey,
    requesterOrigin,
    requesterDisplayKey: originalEntry.requesterDisplayKey,
    task: originalEntry.task,
    cleanup: originalEntry.cleanup,
    label: originalEntry.label
      ? `${originalEntry.label} (retry #${retryCount})`
      : `retry-${retryCount}`,
    model: resolvedModel,
    runTimeoutSeconds: originalEntry.runTimeoutSeconds,
    expectsCompletionMessage: originalEntry.expectsCompletionMessage,
    spawnMode: originalEntry.spawnMode,
    retryCount,
    maxRetries: policy.maxRetries,
    originalRunId: originalEntry.originalRunId ?? originalEntry.runId,
  });

  log.info(
    `[retry] spawned retry #${retryCount} for run ${originalEntry.runId} → new run ${childRunId} (model: ${resolvedModel})`,
  );

  return childRunId;
}

/**
 * Evaluate a completed subagent run and trigger automatic retry if needed.
 * Returns true if a retry was triggered (caller should suppress the original announce).
 */
export async function evaluateAndRetryIfNeeded(params: {
  entry: SubagentRunRecord;
  output: string | undefined;
  outcome?: SubagentRunOutcome;
}): Promise<boolean> {
  const { entry, output, outcome } = params;
  const cfg = loadConfig();
  const policy = resolveRetryPolicy(cfg);

  // Skip retry logic for session-mode subagents (they persist).
  if (entry.spawnMode === "session") return false;

  const taskResult = extractTaskResult(output);

  if (!shouldRetrySubagentRun({ entry, taskResult, outcome, policy })) {
    return false;
  }

  const retryCount = (entry.retryCount ?? 0) + 1;
  const newRunId = await retrySubagentRun({
    originalEntry: entry,
    taskResult,
    retryCount,
    policy,
  });

  if (newRunId) {
    log.info(
      `[retry] suppressing announce for run ${entry.runId}, retry ${newRunId} is in progress`,
    );
    return true;
  }

  // Retry spawn failed — fall through to normal announce.
  return false;
}
