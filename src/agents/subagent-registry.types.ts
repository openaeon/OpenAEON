import type { DeliveryContext } from "../utils/delivery-context.js";
import type { SubagentRunOutcome } from "./subagent-announce.js";
import type { SubagentLifecycleEndedReason } from "./subagent-lifecycle-events.js";
import type { SpawnSubagentMode } from "./subagent-spawn.js";

export type SubagentRunRecord = {
  runId: string;
  childSessionKey: string;
  requesterSessionKey: string;
  requesterOrigin?: DeliveryContext;
  requesterDisplayKey: string;
  task: string;
  cleanup: "delete" | "keep";
  label?: string;
  model?: string;
  runTimeoutSeconds?: number;
  spawnMode?: SpawnSubagentMode;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  outcome?: SubagentRunOutcome;
  archiveAtMs?: number;
  cleanupCompletedAt?: number;
  cleanupHandled?: boolean;
  suppressAnnounceReason?: "steer-restart" | "killed";
  expectsCompletionMessage?: boolean;
  /** Number of announce delivery attempts that returned false (deferred). */
  announceRetryCount?: number;
  /** Timestamp of the last announce retry attempt (for backoff). */
  lastAnnounceRetryAt?: number;
  /** Terminal lifecycle reason recorded when the run finishes. */
  endedReason?: SubagentLifecycleEndedReason;
  /** Set after the subagent_ended hook has been emitted successfully once. */
  endedHookEmittedAt?: number;
  /** Number of times this task has been retried (0 = first attempt). */
  retryCount?: number;
  /** Maximum retries allowed for this task (from retry policy). */
  maxRetries?: number;
  /** If this is a retry, the runId of the original (first) attempt. */
  originalRunId?: string;
  /** Multi-agent Cognitive Loop Fusion: shared state passed to subagent */
  sharedContext?: Record<string, unknown>;
  /** Task planner linkage for closure writeback. */
  planId?: string;
  todoId?: string;
  acceptance?: string[];
  autoBackfillAt?: number;
  autoBackfillStatus?: "ok" | "blocked" | "failed";
  autoBackfillError?: string;
  /** Spawn pipeline phase for durability/audit of startup failures. */
  spawnPhase?:
    | "registered"
    | "depth-patched"
    | "model-patched"
    | "thinking-patched"
    | "thread-bound"
    | "dispatched"
    | "running"
    | "failed";
};
