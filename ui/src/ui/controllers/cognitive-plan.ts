import type { CognitiveRuntimeSummary, CognitiveTaskRecord } from "../types.ts";
import type { CognitivePlanSnapshot } from "../views/sandbox.ts";

function mapPhase(phase?: string): CognitivePlanSnapshot["phase"] {
  if (phase === "PLAN" || phase === "INIT") return "planning";
  if (phase === "EXECUTE") return "execution";
  if (phase === "VERIFY" || phase === "REFLECT") return "verification";
  return "complete";
}

export function projectCognitiveTaskToCognitivePlan(
  task: CognitiveTaskRecord,
  runtimeSummary?: CognitiveRuntimeSummary | null,
): CognitivePlanSnapshot {
  const rootId = task.tree.rootId;
  const nodes = Object.values(task.tree.nodes).filter((node) => node.id !== rootId);
  const todos = nodes.map((node) => ({
    id: node.id,
    title: node.title,
    status: (node.status === "done"
      ? "done"
      : node.status === "in_progress"
        ? "in_progress"
        : "todo") as "todo" | "in_progress" | "done",
    result: node.artifacts?.length ? node.artifacts.join(", ") : undefined,
    dependsOn: node.dependsOn ?? [],
    ownerAgent: node.ownerRole,
    acceptanceCriteria: node.acceptanceCriteria ?? [],
    updatedAt: task.updatedAt,
  }));

  const todoById = new Map(todos.map((todo) => [todo.id, todo]));
  const blockedBy: Record<string, string[]> = {};
  const readyTodoIds: string[] = [];
  const blockedTodoIds: string[] = [];

  for (const todo of todos) {
    const blockers = (todo.dependsOn ?? []).filter(
      (depId) => todoById.get(depId)?.status !== "done",
    );
    blockedBy[todo.id] = blockers;
    if (todo.status === "todo") {
      if (blockers.length === 0) readyTodoIds.push(todo.id);
      else blockedTodoIds.push(todo.id);
    }
  }

  const now = task.updatedAt;
  const phase = mapPhase(task.status.phase);
  const graphEdges = todos.flatMap((todo) => {
    const stageEdge = {
      edgeId: `cog-stage-${task.id}-${todo.id}`,
      from: `stage:${phase}`,
      to: `todo:${todo.id}`,
      relation: "STAGE_HAS_TODO",
      at: now,
    };
    const depEdges = (todo.dependsOn ?? []).map((depId) => ({
      edgeId: `cog-dep-${task.id}-${depId}-${todo.id}`,
      from: `todo:${depId}`,
      to: `todo:${todo.id}`,
      relation: "TODO_BLOCKS_TODO",
      at: now,
    }));
    return [stageEdge, ...depEdges];
  });

  return {
    taskId: task.id,
    sessionKey: task.sessionKey,
    title: task.title,
    description: task.input,
    nativePhase: task.status.phase,
    todos,
    phase,
    stateProjection: task.stateProjection ?? runtimeSummary?.stateProjection ?? null,
    invariants: task.invariantReport ?? runtimeSummary?.invariants ?? null,
    memoryTrace: task.memoryTrace ?? runtimeSummary?.memoryTrace ?? null,
    architecture: runtimeSummary?.architecture ?? null,
    replayCursor: runtimeSummary?.replayCursor ?? task.runIds.at(-1) ?? null,
    taskTree: task.tree,
    runtime: runtimeSummary ?? null,
    updatedAt: task.updatedAt,
    executionGraph: {
      orderedTodoIds: todos.map((todo) => todo.id),
      readyTodoIds,
      blockedTodoIds,
      inProgressTodoIds: todos
        .filter((todo) => todo.status === "in_progress")
        .map((todo) => todo.id),
      longRunningTodoIds: [],
      staleTodoIds: [],
      blockedBy,
      autoDispatch: {
        enabled: true,
        queueDepth: runtimeSummary?.queue?.pending ?? 0,
        runningCount: runtimeSummary?.queue?.claimed ?? 0,
        maxConcurrent: 3,
        frozen: false,
        lastSpawnAt: now,
      },
      advisories: [],
    },
    taskRuntime: {
      currentBranchId: "main",
      branchesCount: 1,
      checkpointsCount: 0,
      currentBranchHistoryCount: 1,
    },
    graphEdges,
  };
}
