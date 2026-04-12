import path from "node:path";
import { loadTaskPlan, saveTaskPlan } from "../../agents/tools/task-planner-tool.js";
import type { TaskPlan, TodoItem, TodoStatus } from "../../agents/tools/task-planner-tool.js";
import type { CognitiveTaskRecord } from "./types.js";
import { mapCognitiveToLegacy } from "./phase-mapping.js";
import type { TaskNode } from "../contracts/types.js";
import { acquireSessionWriteLock } from "../../agents/session-write-lock.js";

function mapNodeStatusToTodoStatus(status: TaskNode["status"]): TodoStatus {
  switch (status) {
    case "todo":
      return "planned";
    case "in_progress":
      return "in_progress";
    case "done":
      return "done";
    case "failed":
      return "blocked";
    case "blocked":
      return "blocked";
    default:
      return "planned";
  }
}

function mapNodeToTodo(node: TaskNode, fallbackOwner: string): TodoItem {
  return {
    id: node.id,
    title: node.title,
    status: mapNodeStatusToTodoStatus(node.status),
    owner: fallbackOwner,
    ownerAgent: fallbackOwner,
    dependsOn: node.dependsOn.length > 0 ? node.dependsOn : undefined,
    acceptance:
      node.acceptanceCriteria.length > 0 ? node.acceptanceCriteria : ["Provide verifiable output"],
    acceptanceCriteria:
      node.acceptanceCriteria.length > 0 ? node.acceptanceCriteria : ["Provide verifiable output"],
    evidenceRefs: node.artifacts.filter((a) => a.startsWith("run:") || a.startsWith("evidence:")),
    updatedAt: Date.now(),
    createdAt: Date.now(),
    attemptCount: 0,
  };
}

export async function syncCognitiveToLegacy(
  workspaceDir: string,
  record: CognitiveTaskRecord,
): Promise<void> {
  const sessionKey = record.sessionKey;
  const plannerFile = path.join(workspaceDir, ".openaeon", "planner", `${sessionKey}.json`);

  // Prepare updates outside the lock to minimize hold time.
  const todos: TodoItem[] = Object.values(record.tree.nodes).map((node) =>
    mapNodeToTodo(node, sessionKey),
  );
  const description = record.input;
  const legacyPhase = mapCognitiveToLegacy(record.status.phase);

  const lockStartedAt = Date.now();
  const { release } = await acquireSessionWriteLock({
    sessionFile: plannerFile,
    timeoutMs: 5_000, // Reduced timeout; we prefer failing fast over holding the event loop.
  });

  try {
    const lockAcquiredAt = Date.now();
    const waitMs = lockAcquiredAt - lockStartedAt;

    // Load existing or initialize new
    const existing = await loadTaskPlan({ workspaceDir, targetSessionKey: sessionKey });

    const updatedPlan: TaskPlan = {
      ...existing,
      description,
      phase: legacyPhase,
      todos,
      updatedAt: Date.now(),
    };

    await saveTaskPlan({
      workspaceDir,
      targetSessionKey: sessionKey,
      plan: updatedPlan,
    });

    const holdMs = Date.now() - lockAcquiredAt;
    if (waitMs > 1000 || holdMs > 1000) {
      console.warn(
        `[legacy-sync] lock contention detected: waitMs=${waitMs} holdMs=${holdMs} file=${plannerFile}`,
      );
    }
  } finally {
    await release();
  }
}
