import path from "node:path";
import { withFileLock } from "../../infra/file-lock.js";
import type { SubagentRunOutcome } from "../../agents/subagent-announce.js";
import {
  evaluateCognitiveInvariants,
  projectCognitiveState,
} from "../cognition/invariant-engine.js";
import { CognitionService } from "../cognition/service.js";
import { CognitiveMemoryService } from "../memory/service.js";
import { publishCognitiveEvent } from "../observability/event-bus.js";
import { COGNITIVE_POLICY } from "./policy.js";
import { readTaskRecord, taskLockFile, writeTaskRecord } from "./store.js";
import type { CognitiveTaskRecord } from "./types.js";

function taskStoreDir(workspaceDir: string): string {
  return path.join(workspaceDir, ".openaeon", "cognitive", "tasks");
}

function isCognitiveTaskLink(value: unknown): value is {
  taskId: string;
  nodeId: string;
  runId?: string;
  role?: string;
} {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return typeof candidate.taskId === "string" && typeof candidate.nodeId === "string";
}

function summarizeOutput(outputText: string | undefined): string {
  const trimmed = outputText?.trim();
  if (!trimmed) {
    return "Subagent completed without textual output.";
  }
  return trimmed.length > 1200 ? `${trimmed.slice(0, 1200)}...` : trimmed;
}

async function enrichRecord(
  workspaceDir: string,
  record: CognitiveTaskRecord,
): Promise<CognitiveTaskRecord> {
  const memory = new CognitiveMemoryService(workspaceDir);
  const strategyHits = await memory.queryEvolution({
    taskId: record.id,
    tags: ["strategy"],
    limit: 5,
  });
  const stateProjection = projectCognitiveState({
    taskId: record.id,
    sessionKey: record.sessionKey,
    phase: record.status.phase,
    tree: record.tree,
    reflections: record.reflections,
    strategyHits,
  });
  const invariantReport = evaluateCognitiveInvariants({
    taskId: record.id,
    sessionKey: record.sessionKey,
    phase: record.status.phase,
    input: record.input,
    tree: record.tree,
    reflections: record.reflections,
    runIds: record.runIds,
  });
  return {
    ...record,
    stateProjection,
    invariantReport,
    memoryTrace: {
      shortTermExpiresAt: Date.now() + 30 * 60 * 1000,
      longTermSources: record.memoryTrace?.longTermSources ?? [],
      evolutionStrategyHits: strategyHits,
    },
  };
}

export function extractCognitiveTaskLink(
  sharedContext: Record<string, unknown> | undefined,
): { taskId: string; nodeId: string; runId?: string; role?: string } | null {
  const link = sharedContext?.cognitiveTask;
  return isCognitiveTaskLink(link) ? link : null;
}

export async function completeCognitiveNodeFromSubagent(input: {
  workspaceDir: string;
  taskId: string;
  nodeId: string;
  subagentRunId: string;
  childSessionKey: string;
  outcome: SubagentRunOutcome;
  outputText?: string;
}): Promise<CognitiveTaskRecord | null> {
  const baseDir = taskStoreDir(input.workspaceDir);
  const lockPath = taskLockFile(baseDir, input.taskId);

  return await withFileLock(lockPath, COGNITIVE_POLICY.LOCK_OPTIONS, async () => {
    const record = await readTaskRecord(baseDir, input.taskId);
    if (!record) {
      return null;
    }
    const node = record.tree.nodes[input.nodeId];
    if (!node) {
      return record;
    }

    const cognition = new CognitionService();
    const memory = new CognitiveMemoryService(input.workspaceDir);
    const success = input.outcome.status === "ok";
    const previousRetryCount =
      node.metadata && typeof node.metadata.retryCount === "number" ? node.metadata.retryCount : 0;
    const attemptCount = previousRetryCount + (success ? 0 : 1);
    const canRetry = !success && attemptCount < COGNITIVE_POLICY.MAX_RETRIES;
    const retryDelayMs = Math.min(90_000, 5_000 * 2 ** Math.max(0, attemptCount - 1));
    const output = success
      ? summarizeOutput(input.outputText)
      : input.outcome.error || "Subagent ended without successful completion.";
    const reflected = cognition.reflect({
      taskId: input.taskId,
      nodeId: input.nodeId,
      output,
      success,
    });

    if (!success) {
      await memory.writeEvolution({
        taskId: input.taskId,
        category: "failure_case",
        content: output,
        tags: ["subagent", input.nodeId, input.subagentRunId],
        runId: input.subagentRunId,
      });
    } else {
      await memory.writeEvolution({
        taskId: input.taskId,
        category: "success_path",
        content: output,
        tags: ["subagent", input.nodeId, input.subagentRunId],
        runId: input.subagentRunId,
      });
    }

    const updatedNode = {
      ...node,
      status: success ? ("done" as const) : canRetry ? ("todo" as const) : ("failed" as const),
      artifacts: success
        ? Array.from(
            new Set([
              ...node.artifacts,
              `subagent:run:${input.subagentRunId}`,
              `subagent:session:${input.childSessionKey}`,
            ]),
          )
        : node.artifacts,
      metadata: {
        ...node.metadata,
        retryCount: attemptCount,
        nextRetryAt: canRetry ? Date.now() + retryDelayMs : undefined,
        lastError: success ? undefined : output,
        subagentOutcome: input.outcome.status,
        completedBySubagentAt: Date.now(),
        lastSubagentOutput: output,
      },
    };

    const nodes = {
      ...record.tree.nodes,
      [input.nodeId]: updatedNode,
    };
    const nonRootNodes = Object.values(nodes).filter(
      (candidate) => candidate.id !== record.tree.rootId,
    );
    const executableNodes = nonRootNodes.length > 0 ? nonRootNodes : Object.values(nodes);
    const allTerminal =
      executableNodes.length > 0 &&
      executableNodes.every(
        (candidate) => candidate.status === "done" || candidate.status === "failed",
      );
    const hasFailed = executableNodes.some((candidate) => candidate.status === "failed");
    const nextPhase =
      record.status.phase === "EXECUTE" && allTerminal
        ? hasFailed
          ? "REFLECT"
          : "VERIFY"
        : record.status.phase;
    const nextReason =
      nextPhase !== record.status.phase
        ? hasFailed
          ? "subagent_failure_requires_reflection"
          : "subagent_delegation_completed"
        : record.status.reason;
    const nextRecord: CognitiveTaskRecord = {
      ...record,
      status: {
        phase: nextPhase,
        reason: nextReason,
        updatedAt: Date.now(),
      },
      tree: {
        ...record.tree,
        nodes,
      },
      reflections: [...record.reflections, reflected],
      runIds: Array.from(new Set([...record.runIds, input.subagentRunId])),
      updatedAt: Date.now(),
      version: record.version + 1,
    };

    const enriched = await enrichRecord(input.workspaceDir, nextRecord);
    await writeTaskRecord(baseDir, enriched);

    publishCognitiveEvent({
      stream: "runtime_subagent_completed",
      taskId: input.taskId,
      runId: input.subagentRunId,
      payload: {
        nodeId: input.nodeId,
        childSessionKey: input.childSessionKey,
        outcome: input.outcome.status,
        success,
        nextPhase,
      },
    });

    return enriched;
  });
}
