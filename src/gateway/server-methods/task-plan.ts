import fs from "node:fs/promises";
import path from "node:path";
import { spawnSubagentDirect } from "../../agents/subagent-spawn.js";
import { loadConfig } from "../../config/config.js";
import { resolveStateDir } from "../../config/config.js";
import { normalizeAgentId, parseAgentSessionKey } from "../../routing/session-key.js";
import type { GatewayRequestHandlers } from "./types.js";

type TodoStatus = "todo" | "planned" | "in_progress" | "blocked" | "done" | "verified" | "closed";
type TransitionAction = "forward" | "rollback" | "retry" | "branch" | "restore";
type VerifierStatus = "pending" | "passed" | "failed" | "blocked";

type TodoItem = {
  id: string;
  title: string;
  status: TodoStatus;
  result?: string;
  ownerAgent?: string;
  dependsOn?: string[];
  acceptanceCriteria?: string[];
  outputSchema?: string;
  riskLevel?: "low" | "medium" | "high";
  mergeKey?: string;
  retryLimit?: number;
  createdAt?: number;
  updatedAt?: number;
  startedAt?: number;
  completedAt?: number;
  heartbeatAt?: number;
  attemptCount?: number;
  lastProgressNote?: string;
  lastProgressAt?: number;
  spawnIdempotencyKey?: string;
  spawned?: boolean;
  spawnAttempts?: number;
  lastSpawnAt?: number;
  lastSpawnError?: string;
  childSessionKey?: string;
};

type TaskPlan = {
  description: string;
  todos: TodoItem[];
  phase?: "planning" | "execution" | "verification" | "complete";
  updatedAt?: number;
  currentBranchId?: string;
  branches?: TaskPlanBranch[];
  checkpoints?: TaskPlanCheckpoint[];
  dreams?: TaskPlanDream[];
  verifierHistory?: TaskPlanVerifierRecord[];
  graphEdges?: TaskPlanGraphEdge[];
  stageHistoryTree?: Record<string, string[]>;
  recoveryState?: {
    lastBroadcastAt?: number;
    lastStaleDigest?: string;
    staleTodoNotifiedAt?: Record<string, number>;
    autopilotLastDigest?: string;
    autopilotLastBroadcastAt?: number;
  };
};

type TaskPlanBranch = {
  id: string;
  status: "active" | "archived";
  createdAt: number;
  parentBranchId?: string;
  derivedFromCheckpointId?: string;
};

type TaskPlanCheckpoint = {
  checkpointId: string;
  taskId: string;
  stageId: string;
  branchId: string;
  reason: TransitionAction | "approve" | "verifier";
  previousCheckpointId?: string;
  sourceCheckpointId?: string;
  createdAt: number;
  snapshot: {
    description: string;
    phase: TaskPlanPhase;
    todos: TodoItem[];
  };
};

type TaskPlanDream = {
  dreamId: string;
  taskId: string;
  stageId: string;
  branchId: string;
  summary: string;
  keyDecisions: string[];
  risks: string[];
  nextAction: string;
  anchors: string[];
  sourceCheckpointIds: string[];
  createdAt: number;
};

type TaskPlanVerifierRecord = {
  verifierId: string;
  taskId: string;
  stageId: string;
  branchId: string;
  status: VerifierStatus;
  summary: string;
  evidence: string[];
  recommendedAction?: "forward" | "retry" | "rollback" | "branch" | "manual_review";
  createdAt: number;
};

type TaskPlanGraphEdge = {
  edgeId: string;
  from: string;
  to: string;
  relation:
    | "TASK_HAS_STAGE"
    | "STAGE_HAS_CHECKPOINT"
    | "STAGE_HAS_TODO"
    | "TODO_BLOCKS_TODO"
    | "STAGE_GENERATES_DREAM"
    | "DECISION_BASED_ON_EVIDENCE"
    | "ERROR_TRIGGERS_ROLLBACK"
    | "BRANCH_DERIVED_FROM_CHECKPOINT"
    | "DREAM_SUMMARIZES_CHECKPOINT"
    | "VERIFIER_EVALUATES_STAGE";
  at: number;
};

type TaskPlanExecutionGraph = {
  orderedTodoIds: string[];
  readyTodoIds: string[];
  blockedTodoIds: string[];
  blockedBy: Record<string, string[]>;
  inProgressTodoIds: string[];
  longRunningTodoIds: string[];
  staleTodoIds: string[];
  todoTelemetry: Record<
    string,
    {
      status: TodoStatus;
      runtimeMs: number;
      idleMs: number;
      attemptCount: number;
      lastTouchedAt: number | null;
      spawn?: {
        spawned: boolean;
        spawnAttempts: number;
        lastSpawnError?: string;
        childSessionKey?: string;
        lastSpawnAt?: number;
      };
    }
  >;
  autoDispatch: {
    enabled: boolean;
    queueDepth: number;
    runningCount: number;
    maxConcurrent: number;
    frozen: boolean;
    freezeReason?: string;
    lastSpawnAt?: number;
  };
  advisories: string[];
};
type TaskPlanRuntimeSummary = {
  currentBranchId: string;
  branchesCount: number;
  checkpointsCount: number;
  latestCheckpointId?: string;
  latestCheckpointAt?: number;
  latestDreamId?: string;
  latestDreamSummary?: string;
  latestVerifierStatus?: VerifierStatus;
  currentBranchHistoryCount: number;
};

type TaskPlanPhase = NonNullable<TaskPlan["phase"]>;

const LONG_RUNNING_TODO_MS = 20 * 60_000;
const STALE_TODO_IDLE_MS = 3 * 60_000;
const RECOVERY_BROADCAST_COOLDOWN_MS = 1 * 60_000;
const STALE_TODO_NOTIFY_COOLDOWN_MS = 10 * 60_000;
const AUTOPILOT_MAX_CONCURRENT_DEFAULT = 2;
const AUTOPILOT_RETRY_LIMIT_DEFAULT = 3;
const AUTOPILOT_WATCHDOG_HEARTBEAT_MS = 5_000;
const AUTOPILOT_RETRY_BACKOFF_BASE_MS = 5_000;
const AUTOPILOT_STATUS_BROADCAST_COOLDOWN_MS = 2_000;
const TRANSITION_ACTIONS = new Set<TransitionAction>([
  "forward",
  "rollback",
  "retry",
  "branch",
  "restore",
]);

function isTodoTerminal(status: TodoStatus): boolean {
  return status === "done" || status === "verified" || status === "closed";
}

function isTodoPlanned(status: TodoStatus): boolean {
  return status === "todo" || status === "planned";
}

function isPlaceholderTodoTitle(title: string): boolean {
  const normalized = title.trim();
  if (!normalized) {
    return false;
  }
  return (
    /^agent\s*\d+\s*:\s*待定任务\d*$/i.test(normalized) ||
    /^代理\s*\d+\s*:\s*待定任务\d*$/i.test(normalized) ||
    /^待定任务\d*$/i.test(normalized)
  );
}

function isPlaceholderTodoResult(result: string | undefined): boolean {
  if (!result) {
    return false;
  }
  const normalized = result.trim().toLowerCase();
  return (
    normalized.includes("占位任务") ||
    normalized.includes("无需执行") ||
    normalized.includes("placeholder")
  );
}

function sanitizeTaskPlan(plan: TaskPlan): { plan: TaskPlan; removed: number } {
  const before = Array.isArray(plan.todos) ? plan.todos.length : 0;
  const nextTodos = (Array.isArray(plan.todos) ? plan.todos : []).filter(
    (todo) => !isPlaceholderTodoTitle(todo.title) && !isPlaceholderTodoResult(todo.result),
  );
  const removed = before - nextTodos.length;
  if (removed <= 0) {
    const normalizedPhase = normalizePlanPhase(plan.phase);
    const runtime = ensureTaskPlanRuntime(plan);
    if (normalizedPhase === plan.phase && !runtime.changed) {
      return { plan, removed: 0 };
    }
    return {
      plan: {
        ...runtime.plan,
        phase: normalizedPhase,
        updatedAt: Date.now(),
      },
      removed: 0,
    };
  }
  const runtime = ensureTaskPlanRuntime(plan);
  return {
    plan: {
      ...runtime.plan,
      todos: nextTodos,
      phase: normalizePlanPhase(plan.phase),
      updatedAt: Date.now(),
    },
    removed,
  };
}

function cloneTodoList(todos: TodoItem[]): TodoItem[] {
  return todos.map((todo) => ({ ...todo }));
}

function createCheckpointId(now: number): string {
  return `ckpt_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function createBranchId(now: number): string {
  return `branch_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function createDreamId(now: number): string {
  return `dream_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function createVerifierId(now: number): string {
  return `verify_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function createGraphEdgeId(now: number): string {
  return `edge_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function ensureTaskPlanRuntime(plan: TaskPlan): { plan: TaskPlan; changed: boolean } {
  const now = Date.now();
  const branchBase: TaskPlanBranch[] = Array.isArray(plan.branches)
    ? plan.branches.map((item) => ({ ...item }))
    : [];
  const branches: TaskPlanBranch[] =
    branchBase.length > 0 ? branchBase : [{ id: "main", status: "active", createdAt: now }];
  let changed = branchBase.length === 0;
  const branchIds = new Set(branches.map((branch) => branch.id));
  let currentBranchId = typeof plan.currentBranchId === "string" ? plan.currentBranchId.trim() : "";
  if (!currentBranchId) {
    currentBranchId = "main";
    changed = true;
  }
  if (!branchIds.has(currentBranchId)) {
    branches.push({
      id: currentBranchId,
      status: "active",
      createdAt: now,
    });
    changed = true;
  }
  const checkpoints = Array.isArray(plan.checkpoints)
    ? plan.checkpoints.map((item) => ({ ...item }))
    : [];
  if (!Array.isArray(plan.checkpoints)) {
    changed = true;
  }
  const dreams = Array.isArray(plan.dreams) ? plan.dreams.map((item) => ({ ...item })) : [];
  if (!Array.isArray(plan.dreams)) {
    changed = true;
  }
  const verifierHistory = Array.isArray(plan.verifierHistory)
    ? plan.verifierHistory.map((item) => ({ ...item }))
    : [];
  if (!Array.isArray(plan.verifierHistory)) {
    changed = true;
  }
  const graphEdges = Array.isArray(plan.graphEdges)
    ? plan.graphEdges.map((item) => ({ ...item }))
    : [];
  if (!Array.isArray(plan.graphEdges)) {
    changed = true;
  }
  const stageHistoryTree =
    plan.stageHistoryTree && typeof plan.stageHistoryTree === "object"
      ? Object.fromEntries(
          Object.entries(plan.stageHistoryTree).map(([branchId, history]) => [
            branchId,
            Array.isArray(history)
              ? history.filter((item): item is string => typeof item === "string")
              : [],
          ]),
        )
      : {};
  if (!plan.stageHistoryTree || typeof plan.stageHistoryTree !== "object") {
    changed = true;
  }
  if (!Array.isArray(stageHistoryTree[currentBranchId])) {
    stageHistoryTree[currentBranchId] = [];
    changed = true;
  }
  return {
    plan: {
      ...plan,
      currentBranchId,
      branches,
      checkpoints,
      dreams,
      verifierHistory,
      graphEdges,
      stageHistoryTree,
    },
    changed,
  };
}

function pushGraphEdge(
  plan: TaskPlan,
  edge: Omit<TaskPlanGraphEdge, "edgeId"> & { edgeId?: string },
): TaskPlan {
  const runtime = ensureTaskPlanRuntime(plan).plan;
  const edges = Array.isArray(runtime.graphEdges) ? [...runtime.graphEdges] : [];
  edges.push({
    edgeId: edge.edgeId ?? createGraphEdgeId(edge.at),
    ...edge,
  });
  return {
    ...runtime,
    graphEdges: edges,
    updatedAt: edge.at,
  };
}

function appendCheckpoint(
  plan: TaskPlan,
  params: {
    reason: TransitionAction | "approve" | "verifier";
    stageId?: string;
    sourceCheckpointId?: string;
    taskId?: string;
    now?: number;
  },
): TaskPlan {
  const runtime = ensureTaskPlanRuntime(plan).plan;
  const now = params.now ?? Date.now();
  const checkpoints = Array.isArray(runtime.checkpoints) ? [...runtime.checkpoints] : [];
  const checkpointId = createCheckpointId(now);
  const currentBranchId = runtime.currentBranchId ?? "main";
  const phase = normalizePlanPhase(runtime.phase);
  const previousCheckpointId =
    checkpoints.length > 0 ? checkpoints[checkpoints.length - 1]?.checkpointId : undefined;
  const nextCheckpoint = {
    checkpointId,
    taskId: params.taskId ?? "task_plan",
    stageId: params.stageId ?? phase,
    branchId: currentBranchId,
    reason: params.reason,
    previousCheckpointId,
    sourceCheckpointId: params.sourceCheckpointId,
    createdAt: now,
    snapshot: {
      description: runtime.description,
      phase,
      todos: cloneTodoList(runtime.todos),
    },
  };
  checkpoints.push(nextCheckpoint);
  const stageHistoryTree = {
    ...runtime.stageHistoryTree,
  };
  const history = Array.isArray(stageHistoryTree[currentBranchId])
    ? [...stageHistoryTree[currentBranchId]]
    : [];
  history.push(`${phase}:${checkpointId}`);
  stageHistoryTree[currentBranchId] = history;
  let next: TaskPlan = {
    ...runtime,
    checkpoints,
    stageHistoryTree,
    updatedAt: now,
  };
  next = pushGraphEdge(next, {
    from: `task:${nextCheckpoint.taskId}`,
    to: `stage:${nextCheckpoint.stageId}`,
    relation: "TASK_HAS_STAGE",
    at: now,
  });
  next = pushGraphEdge(next, {
    from: `stage:${nextCheckpoint.stageId}`,
    to: `checkpoint:${nextCheckpoint.checkpointId}`,
    relation: "STAGE_HAS_CHECKPOINT",
    at: now,
  });
  const placeholderTodoIds = new Set(
    nextCheckpoint.snapshot.todos
      .filter((todo) => isPlaceholderTodoTitle(todo.title) || isPlaceholderTodoResult(todo.result))
      .map((todo) => todo.id),
  );
  for (const todo of nextCheckpoint.snapshot.todos) {
    if (!todo?.id || placeholderTodoIds.has(todo.id)) {
      continue;
    }
    next = pushGraphEdge(next, {
      from: `stage:${nextCheckpoint.stageId}`,
      to: `todo:${todo.id}`,
      relation: "STAGE_HAS_TODO",
      at: now,
    });
    const deps = Array.isArray(todo.dependsOn) ? todo.dependsOn.filter(Boolean) : [];
    for (const depId of deps) {
      if (placeholderTodoIds.has(depId)) {
        continue;
      }
      next = pushGraphEdge(next, {
        from: `todo:${depId}`,
        to: `todo:${todo.id}`,
        relation: "TODO_BLOCKS_TODO",
        at: now,
      });
    }
  }
  return next;
}

function buildTaskPlanRuntimeSummary(plan: TaskPlan): TaskPlanRuntimeSummary {
  const runtime = ensureTaskPlanRuntime(plan).plan;
  const currentBranchId = runtime.currentBranchId ?? "main";
  const branches = Array.isArray(runtime.branches) ? runtime.branches : [];
  const checkpoints = Array.isArray(runtime.checkpoints) ? runtime.checkpoints : [];
  const dreams = Array.isArray(runtime.dreams) ? runtime.dreams : [];
  const verifierHistory = Array.isArray(runtime.verifierHistory) ? runtime.verifierHistory : [];
  const latestCheckpoint = checkpoints.length > 0 ? checkpoints[checkpoints.length - 1] : undefined;
  const latestDream = dreams.length > 0 ? dreams[dreams.length - 1] : undefined;
  const latestVerifier =
    verifierHistory.length > 0 ? verifierHistory[verifierHistory.length - 1] : undefined;
  const currentBranchHistory = runtime.stageHistoryTree?.[currentBranchId];
  return {
    currentBranchId,
    branchesCount: branches.length,
    checkpointsCount: checkpoints.length,
    latestCheckpointId: latestCheckpoint?.checkpointId,
    latestCheckpointAt: latestCheckpoint?.createdAt,
    latestDreamId: latestDream?.dreamId,
    latestDreamSummary: latestDream?.summary,
    latestVerifierStatus: latestVerifier?.status,
    currentBranchHistoryCount: Array.isArray(currentBranchHistory)
      ? currentBranchHistory.length
      : 0,
  };
}

function restoreFromCheckpoint(
  plan: TaskPlan,
  checkpointId: string,
  now = Date.now(),
): TaskPlan | null {
  const runtime = ensureTaskPlanRuntime(plan).plan;
  const checkpoints = Array.isArray(runtime.checkpoints) ? runtime.checkpoints : [];
  const checkpoint = checkpoints.find((item) => item.checkpointId === checkpointId);
  if (!checkpoint) {
    return null;
  }
  const branchId = checkpoint.branchId || runtime.currentBranchId || "main";
  const branches = Array.isArray(runtime.branches) ? [...runtime.branches] : [];
  if (!branches.some((branch) => branch.id === branchId)) {
    branches.push({ id: branchId, status: "active", createdAt: now });
  }
  const stageHistoryTree = {
    ...runtime.stageHistoryTree,
  };
  if (!Array.isArray(stageHistoryTree[branchId])) {
    stageHistoryTree[branchId] = [];
  }
  return {
    ...runtime,
    description: checkpoint.snapshot.description,
    phase: checkpoint.snapshot.phase,
    todos: cloneTodoList(checkpoint.snapshot.todos),
    currentBranchId: branchId,
    branches,
    stageHistoryTree,
    updatedAt: now,
  };
}

function normalizePlanPhase(phase: TaskPlan["phase"]): TaskPlanPhase {
  return phase === "planning" ||
    phase === "execution" ||
    phase === "verification" ||
    phase === "complete"
    ? phase
    : "planning";
}

function resolveExecutionTransition(fromPhase: TaskPlan["phase"]): {
  from: TaskPlanPhase;
  to: TaskPlanPhase;
  changed: boolean;
} {
  const from = normalizePlanPhase(fromPhase);
  const to: TaskPlanPhase = from === "planning" ? "execution" : from;
  return { from, to, changed: from !== to };
}

function resolveLastTouchedAt(todo: TodoItem): number | null {
  const candidate =
    todo.heartbeatAt ?? todo.updatedAt ?? todo.lastProgressAt ?? todo.startedAt ?? todo.createdAt;
  return typeof candidate === "number" && Number.isFinite(candidate) ? candidate : null;
}

function buildExecutionGraph(
  plan: TaskPlan,
  now = Date.now(),
  autoDispatch?: Partial<TaskPlanExecutionGraph["autoDispatch"]>,
): TaskPlanExecutionGraph {
  const todos = Array.isArray(plan.todos) ? plan.todos : [];
  if (todos.length === 0) {
    return {
      orderedTodoIds: [],
      readyTodoIds: [],
      blockedTodoIds: [],
      blockedBy: {},
      inProgressTodoIds: [],
      longRunningTodoIds: [],
      staleTodoIds: [],
      todoTelemetry: {},
      autoDispatch: {
        enabled: Boolean(autoDispatch?.enabled),
        queueDepth: 0,
        runningCount: 0,
        maxConcurrent: autoDispatch?.maxConcurrent ?? AUTOPILOT_MAX_CONCURRENT_DEFAULT,
        frozen: Boolean(autoDispatch?.frozen),
        freezeReason: autoDispatch?.freezeReason,
        lastSpawnAt: autoDispatch?.lastSpawnAt,
      },
      advisories: [],
    };
  }
  const byId = new Map(todos.map((todo) => [todo.id, todo] as const));
  const active = todos.filter((todo) => !isTodoTerminal(todo.status));
  const depsById = new Map<string, string[]>();
  const blockedBy: Record<string, string[]> = {};
  const inDegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  for (const todo of active) {
    const deps = Array.isArray(todo.dependsOn) ? todo.dependsOn.filter(Boolean) : [];
    depsById.set(todo.id, deps);
    inDegree.set(todo.id, 0);
    outgoing.set(todo.id, []);
  }

  for (const todo of active) {
    const deps = depsById.get(todo.id) ?? [];
    for (const depId of deps) {
      const depTodo = byId.get(depId);
      if (!depTodo || !isTodoTerminal(depTodo.status)) {
        blockedBy[todo.id] = [...(blockedBy[todo.id] ?? []), depId];
      }
      if (!inDegree.has(depId)) {
        continue;
      }
      inDegree.set(todo.id, (inDegree.get(todo.id) ?? 0) + 1);
      outgoing.set(depId, [...(outgoing.get(depId) ?? []), todo.id]);
    }
  }

  const queue = Array.from(inDegree.entries())
    .filter(([, degree]) => degree === 0)
    .map(([id]) => id);
  const ordered: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    ordered.push(id);
    for (const nextId of outgoing.get(id) ?? []) {
      const current = (inDegree.get(nextId) ?? 0) - 1;
      inDegree.set(nextId, current);
      if (current === 0) {
        queue.push(nextId);
      }
    }
  }

  const cyclicRemainder = Array.from(inDegree.entries())
    .filter(([, degree]) => degree > 0)
    .map(([id]) => id);
  const orderedTodoIds = [...ordered, ...cyclicRemainder];
  const inProgressTodoIds = active
    .filter((todo) => todo.status === "in_progress")
    .map((todo) => todo.id);
  const readyTodoIds = active
    .filter((todo) => isTodoPlanned(todo.status) && (blockedBy[todo.id] ?? []).length === 0)
    .map((todo) => todo.id);
  const blockedTodoIds = active
    .filter((todo) => (blockedBy[todo.id] ?? []).length > 0)
    .map((todo) => todo.id);
  const longRunningTodoIds: string[] = [];
  const staleTodoIds: string[] = [];
  const todoTelemetry: TaskPlanExecutionGraph["todoTelemetry"] = {};
  for (const todo of active) {
    const lastTouchedAt = resolveLastTouchedAt(todo);
    const runtimeMs =
      todo.status === "in_progress" &&
      typeof todo.startedAt === "number" &&
      Number.isFinite(todo.startedAt)
        ? Math.max(0, now - todo.startedAt)
        : 0;
    const idleMs =
      todo.status === "in_progress" && lastTouchedAt !== null
        ? Math.max(0, now - lastTouchedAt)
        : 0;
    const attemptCount = Number.isFinite(todo.attemptCount)
      ? Math.max(0, Number(todo.attemptCount))
      : 0;
    if (todo.status === "in_progress" && runtimeMs >= LONG_RUNNING_TODO_MS) {
      longRunningTodoIds.push(todo.id);
    }
    if (todo.status === "in_progress" && idleMs >= STALE_TODO_IDLE_MS) {
      staleTodoIds.push(todo.id);
    }
    todoTelemetry[todo.id] = {
      status: todo.status,
      runtimeMs,
      idleMs,
      attemptCount,
      lastTouchedAt,
      spawn: {
        spawned: todo.spawned === true,
        spawnAttempts: Number.isFinite(todo.spawnAttempts)
          ? Math.max(0, Number(todo.spawnAttempts))
          : 0,
        lastSpawnError: typeof todo.lastSpawnError === "string" ? todo.lastSpawnError : undefined,
        childSessionKey:
          typeof todo.childSessionKey === "string" ? todo.childSessionKey : undefined,
        lastSpawnAt: typeof todo.lastSpawnAt === "number" ? todo.lastSpawnAt : undefined,
      },
    };
  }
  const advisories: string[] = [];
  if (staleTodoIds.length > 0) {
    advisories.push(`stalled:${staleTodoIds.join(",")}`);
  }
  if (longRunningTodoIds.length > 0) {
    advisories.push(`long_running:${longRunningTodoIds.join(",")}`);
  }
  if (readyTodoIds.length > 0 && inProgressTodoIds.length === 0) {
    advisories.push(`dispatch_ready:${readyTodoIds.join(",")}`);
  }
  if (readyTodoIds.length === 0 && blockedTodoIds.length > 0) {
    advisories.push(`unblock_dependencies:${blockedTodoIds.join(",")}`);
  }

  return {
    orderedTodoIds,
    readyTodoIds,
    blockedTodoIds,
    blockedBy,
    inProgressTodoIds,
    longRunningTodoIds,
    staleTodoIds,
    todoTelemetry,
    autoDispatch: {
      enabled: Boolean(autoDispatch?.enabled),
      queueDepth: readyTodoIds.length,
      runningCount: inProgressTodoIds.length,
      maxConcurrent: autoDispatch?.maxConcurrent ?? AUTOPILOT_MAX_CONCURRENT_DEFAULT,
      frozen: Boolean(autoDispatch?.frozen),
      freezeReason: autoDispatch?.freezeReason,
      lastSpawnAt: autoDispatch?.lastSpawnAt,
    },
    advisories,
  };
}

function buildExecutionPrompt(graph: TaskPlanExecutionGraph): string {
  const pieces: string[] = [];
  if (graph.staleTodoIds.length > 0) {
    pieces.push(`检测到停滞任务: ${graph.staleTodoIds.join(", ")}，先 heartbeat 或拆分后重试`);
  }
  if (graph.longRunningTodoIds.length > 0) {
    pieces.push(`长时运行任务: ${graph.longRunningTodoIds.join(", ")}，建议输出中间结果并继续推进`);
  }
  if (graph.readyTodoIds.length > 0) {
    pieces.push(`优先执行 ready tasks: ${graph.readyTodoIds.join(", ")}`);
  } else if (graph.blockedTodoIds.length > 0) {
    pieces.push(`暂无 ready task，先解除阻塞依赖: ${graph.blockedTodoIds.join(", ")}`);
  } else {
    pieces.push("当前无可执行任务，进入验证与收敛总结");
  }
  return `计划已进入 execution。${pieces.join("；")}。按依赖顺序推进，逐项回填 result。`;
}

function buildRecoveryPrompt(graph: TaskPlanExecutionGraph, staleTodoIds: string[]): string {
  const parts: string[] = [];
  parts.push(`检测到停滞任务: ${staleTodoIds.join(", ")}`);
  if (graph.readyTodoIds.length > 0) {
    parts.push(`并行推进 ready: ${graph.readyTodoIds.join(", ")}`);
  }
  if (graph.blockedTodoIds.length > 0) {
    parts.push(`排查阻塞链路: ${graph.blockedTodoIds.join(", ")}`);
  }
  return `执行恢复建议：${parts.join("；")}。优先输出中间结果，并为 in_progress 任务发送 heartbeat。`;
}

function isAutopilotEligibleSession(sessionKey: string): boolean {
  const key = sessionKey.trim();
  return key === "main" || key === "agent:main:main";
}

function resolveAutopilotPolicy(params: { maxConcurrent?: unknown; chaosScore?: unknown }): {
  maxConcurrent: number;
  frozen: boolean;
  freezeReason?: string;
  severity: "none" | "mild" | "medium" | "severe";
} {
  const configuredMax =
    typeof params.maxConcurrent === "number" && Number.isFinite(params.maxConcurrent)
      ? Math.max(1, Math.floor(params.maxConcurrent))
      : AUTOPILOT_MAX_CONCURRENT_DEFAULT;
  const chaos =
    typeof params.chaosScore === "number" && Number.isFinite(params.chaosScore)
      ? Math.max(0, params.chaosScore)
      : 0;
  if (chaos >= 20) {
    return {
      maxConcurrent: 1,
      frozen: true,
      freezeReason: "chaos_severe_recovery_only",
      severity: "severe",
    };
  }
  if (chaos >= 14) {
    return {
      maxConcurrent: 1,
      frozen: true,
      freezeReason: "chaos_medium_pause_dispatch",
      severity: "medium",
    };
  }
  if (chaos >= 8) {
    return {
      maxConcurrent: 1,
      frozen: false,
      freezeReason: "chaos_mild_load_shed",
      severity: "mild",
    };
  }
  return {
    maxConcurrent: configuredMax,
    frozen: false,
    severity: "none",
  };
}

function makeAutopilotDigest(input: {
  sessionKey: string;
  queueDepth: number;
  runningCount: number;
  frozen: boolean;
  freezeReason?: string;
  maxConcurrent: number;
}): string {
  return [
    input.sessionKey,
    input.queueDepth,
    input.runningCount,
    input.frozen ? "1" : "0",
    input.freezeReason ?? "",
    input.maxConcurrent,
  ].join("|");
}

function buildAutopilotTask(todo: TodoItem): string {
  const acceptance = Array.isArray(todo.acceptanceCriteria)
    ? todo.acceptanceCriteria.filter((item) => typeof item === "string" && item.trim().length > 0)
    : [];
  const lines = [`执行 TODO: ${todo.title}`, `todoId: ${todo.id}`];
  if (acceptance.length > 0) {
    lines.push(`验收标准: ${acceptance.join("；")}`);
  }
  lines.push("要求：完成后回填 task planner result，并保持 heartbeat。");
  return lines.join("\n");
}

function shouldRetrySpawn(todo: TodoItem, now: number): boolean {
  const attempts = Number.isFinite(todo.spawnAttempts)
    ? Math.max(0, Number(todo.spawnAttempts))
    : 0;
  if (attempts >= AUTOPILOT_RETRY_LIMIT_DEFAULT) {
    return false;
  }
  if (!todo.lastSpawnError) {
    return true;
  }
  const lastSpawnAt = Number.isFinite(todo.lastSpawnAt) ? Number(todo.lastSpawnAt) : 0;
  const backoffMs = AUTOPILOT_RETRY_BACKOFF_BASE_MS * Math.max(1, 2 ** Math.max(0, attempts - 1));
  return now - lastSpawnAt >= backoffMs;
}

async function runAutopilotDispatch(params: {
  plan: TaskPlan;
  sessionKey: string;
  now: number;
  maxConcurrent?: unknown;
  chaosScore?: unknown;
  autopilotEnabled?: boolean;
}): Promise<{
  nextPlan: TaskPlan;
  changed: boolean;
  graph: TaskPlanExecutionGraph;
  statusPayload: {
    sessionKey: string;
    enabled: boolean;
    queueDepth: number;
    runningCount: number;
    maxConcurrent: number;
    frozen: boolean;
    freezeReason?: string;
    at: number;
  };
  spawnedPayloads: Array<{
    sessionKey: string;
    todoId: string;
    agentId: string;
    ok: boolean;
    childSessionKey?: string;
    error?: string;
    attempt: number;
    at: number;
  }>;
}> {
  const phase = normalizePlanPhase(params.plan.phase);
  const enabled =
    params.autopilotEnabled !== false &&
    phase === "execution" &&
    isAutopilotEligibleSession(params.sessionKey);
  const policy = resolveAutopilotPolicy({
    maxConcurrent: params.maxConcurrent,
    chaosScore: params.chaosScore,
  });
  const nextPlan: TaskPlan = {
    ...params.plan,
    todos: [...params.plan.todos],
  };
  let changed = false;

  if (enabled) {
    // Keep long-running in_progress todos alive with heartbeat metadata.
    for (let idx = 0; idx < nextPlan.todos.length; idx += 1) {
      const todo = nextPlan.todos[idx];
      if (todo.status !== "in_progress") {
        continue;
      }
      const lastTouched = resolveLastTouchedAt(todo) ?? 0;
      if (params.now - lastTouched < AUTOPILOT_WATCHDOG_HEARTBEAT_MS) {
        continue;
      }
      nextPlan.todos[idx] = {
        ...todo,
        heartbeatAt: params.now,
        lastProgressAt: params.now,
        lastProgressNote: "autopilot heartbeat",
        updatedAt: params.now,
        attemptCount: Number.isFinite(todo.attemptCount)
          ? Math.max(0, Number(todo.attemptCount))
          : 0,
      };
      changed = true;
    }
  }

  let graph = buildExecutionGraph(nextPlan, params.now, {
    enabled,
    maxConcurrent: policy.maxConcurrent,
    frozen: policy.frozen,
    freezeReason: policy.freezeReason,
  });
  const spawnedPayloads: Array<{
    sessionKey: string;
    todoId: string;
    agentId: string;
    ok: boolean;
    childSessionKey?: string;
    error?: string;
    attempt: number;
    at: number;
  }> = [];

  if (enabled && !policy.frozen) {
    const runningSlots = graph.inProgressTodoIds.length;
    const availableSlots = Math.max(0, policy.maxConcurrent - runningSlots);
    const readyQueue = graph.orderedTodoIds.filter((id) => graph.readyTodoIds.includes(id));
    const requesterAgentId = normalizeAgentId(
      parseAgentSessionKey(params.sessionKey)?.agentId ?? "main",
    );
    let consumedSlots = 0;
    for (const todoId of readyQueue) {
      if (consumedSlots >= availableSlots) {
        break;
      }
      const todoIndex = nextPlan.todos.findIndex((entry) => entry.id === todoId);
      if (todoIndex < 0) {
        continue;
      }
      const todo = nextPlan.todos[todoIndex];
      if (isTodoTerminal(todo.status)) {
        continue;
      }
      const idemKey = `${params.sessionKey}:${todo.id}:${normalizeAgentId(todo.ownerAgent ?? requesterAgentId)}`;
      const hasActiveChild =
        typeof todo.childSessionKey === "string" &&
        todo.childSessionKey.trim().length > 0 &&
        !todo.lastSpawnError;
      if (hasActiveChild || (todo.spawnIdempotencyKey === idemKey && todo.spawned === true)) {
        continue;
      }
      if (!shouldRetrySpawn(todo, params.now)) {
        continue;
      }
      const targetAgentId = normalizeAgentId(todo.ownerAgent ?? requesterAgentId);
      const attempt =
        (Number.isFinite(todo.spawnAttempts) ? Math.max(0, Number(todo.spawnAttempts)) : 0) + 1;
      const task = buildAutopilotTask(todo);
      const spawned = await spawnSubagentDirect(
        {
          task,
          label: `autoplan-${todo.id}`,
          agentId: targetAgentId,
          mode: "run",
          runTimeoutSeconds: 600,
          expectsCompletionMessage: true,
        },
        {
          agentSessionKey: params.sessionKey,
          requesterAgentIdOverride: requesterAgentId,
          iterationDepth: 1,
        },
      );
      if (spawned.status === "accepted" && spawned.childSessionKey) {
        nextPlan.todos[todoIndex] = {
          ...todo,
          status: "in_progress",
          startedAt:
            typeof todo.startedAt === "number" && Number.isFinite(todo.startedAt)
              ? todo.startedAt
              : params.now,
          heartbeatAt: params.now,
          lastProgressAt: params.now,
          updatedAt: params.now,
          spawnIdempotencyKey: idemKey,
          spawned: true,
          spawnAttempts: attempt,
          lastSpawnAt: params.now,
          lastSpawnError: undefined,
          childSessionKey: spawned.childSessionKey,
        };
        consumedSlots += 1;
        changed = true;
        spawnedPayloads.push({
          sessionKey: params.sessionKey,
          todoId: todo.id,
          agentId: targetAgentId,
          ok: true,
          childSessionKey: spawned.childSessionKey,
          attempt,
          at: params.now,
        });
        continue;
      }
      nextPlan.todos[todoIndex] = {
        ...todo,
        updatedAt: params.now,
        spawnIdempotencyKey: idemKey,
        spawned: false,
        spawnAttempts: attempt,
        lastSpawnAt: params.now,
        lastSpawnError: spawned.error ?? "spawn_failed",
      };
      changed = true;
      spawnedPayloads.push({
        sessionKey: params.sessionKey,
        todoId: todo.id,
        agentId: targetAgentId,
        ok: false,
        error: spawned.error ?? "spawn_failed",
        attempt,
        at: params.now,
      });
    }
  }

  const lastSpawnAt = spawnedPayloads.length > 0 ? params.now : undefined;
  graph = buildExecutionGraph(nextPlan, params.now, {
    enabled,
    maxConcurrent: policy.maxConcurrent,
    frozen: policy.frozen,
    freezeReason: policy.freezeReason,
    lastSpawnAt,
  });
  const statusPayload = {
    sessionKey: params.sessionKey,
    enabled,
    queueDepth: graph.readyTodoIds.length,
    runningCount: graph.inProgressTodoIds.length,
    maxConcurrent: graph.autoDispatch.maxConcurrent,
    frozen: graph.autoDispatch.frozen,
    freezeReason: graph.autoDispatch.freezeReason,
    at: params.now,
  };

  const digest = makeAutopilotDigest({
    sessionKey: params.sessionKey,
    queueDepth: statusPayload.queueDepth,
    runningCount: statusPayload.runningCount,
    maxConcurrent: statusPayload.maxConcurrent,
    frozen: statusPayload.frozen,
    freezeReason: statusPayload.freezeReason,
  });
  const currentState = nextPlan.recoveryState ?? {};
  const shouldUpdateDigest =
    currentState.autopilotLastDigest !== digest ||
    (params.now - (currentState.autopilotLastBroadcastAt ?? 0) >=
      AUTOPILOT_STATUS_BROADCAST_COOLDOWN_MS &&
      spawnedPayloads.length > 0);
  if (shouldUpdateDigest) {
    nextPlan.recoveryState = {
      ...currentState,
      autopilotLastDigest: digest,
      autopilotLastBroadcastAt: params.now,
    };
    nextPlan.updatedAt = params.now;
    changed = true;
  }

  return { nextPlan, changed, graph, statusPayload, spawnedPayloads };
}

function applyRecoveryState(params: {
  plan: TaskPlan;
  sessionKey: string;
  graph: TaskPlanExecutionGraph;
  now: number;
}): {
  nextPlan: TaskPlan;
  changed: boolean;
  broadcastPayload?: {
    sessionKey: string;
    staleTodoIds: string[];
    readyTodoIds: string[];
    blockedTodoIds: string[];
    prompt: string;
    advisories: string[];
    at: number;
  };
} {
  const staleTodoIds = params.graph.staleTodoIds;
  const state = params.plan.recoveryState ?? {};
  const staleTodoNotifiedAt = { ...state.staleTodoNotifiedAt };
  const staleDigest = [...staleTodoIds].sort().join(",");
  const digestChanged = staleDigest !== (state.lastStaleDigest ?? "");
  const lastBroadcastAt = state.lastBroadcastAt ?? 0;
  const globalCooldownElapsed = params.now - lastBroadcastAt >= RECOVERY_BROADCAST_COOLDOWN_MS;
  const staleCandidates = staleTodoIds.filter((id) => {
    const lastNotified = staleTodoNotifiedAt[id] ?? 0;
    return params.now - lastNotified >= STALE_TODO_NOTIFY_COOLDOWN_MS;
  });

  let broadcastPayload:
    | {
        sessionKey: string;
        staleTodoIds: string[];
        readyTodoIds: string[];
        blockedTodoIds: string[];
        prompt: string;
        advisories: string[];
        at: number;
      }
    | undefined;

  if (
    staleTodoIds.length > 0 &&
    staleCandidates.length > 0 &&
    (globalCooldownElapsed || digestChanged)
  ) {
    broadcastPayload = {
      sessionKey: params.sessionKey,
      staleTodoIds: staleCandidates,
      readyTodoIds: params.graph.readyTodoIds,
      blockedTodoIds: params.graph.blockedTodoIds,
      prompt: buildRecoveryPrompt(params.graph, staleCandidates),
      advisories: params.graph.advisories,
      at: params.now,
    };
    for (const id of staleCandidates) {
      staleTodoNotifiedAt[id] = params.now;
    }
  }

  for (const key of Object.keys(staleTodoNotifiedAt)) {
    if (!staleTodoIds.includes(key)) {
      delete staleTodoNotifiedAt[key];
    }
  }

  const nextState = {
    lastBroadcastAt: broadcastPayload ? params.now : state.lastBroadcastAt,
    lastStaleDigest: staleDigest,
    staleTodoNotifiedAt,
  };
  const changed =
    (state.lastBroadcastAt ?? 0) !== (nextState.lastBroadcastAt ?? 0) ||
    (state.lastStaleDigest ?? "") !== (nextState.lastStaleDigest ?? "") ||
    JSON.stringify(state.staleTodoNotifiedAt ?? {}) !==
      JSON.stringify(nextState.staleTodoNotifiedAt);

  if (!changed) {
    return { nextPlan: params.plan, changed: false, broadcastPayload };
  }
  return {
    nextPlan: {
      ...params.plan,
      recoveryState: nextState,
      updatedAt: params.now,
    },
    changed: true,
    broadcastPayload,
  };
}

async function loadTaskPlanFromDisk(
  workspaceDir: string,
  sessionKey: string,
): Promise<TaskPlan | null> {
  const plannerFile = resolvePlannerFilePath(workspaceDir, sessionKey);
  try {
    const content = await fs.readFile(plannerFile, "utf-8");
    return JSON.parse(content) as TaskPlan;
  } catch {
    return null;
  }
}

function resolvePlannerFilePath(workspaceDir: string, sessionKey: string): string {
  const safeKey = sessionKey.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(workspaceDir, ".openaeon", "planner", `${safeKey}.json`);
}

async function saveTaskPlanToDisk(
  workspaceDir: string,
  sessionKey: string,
  plan: TaskPlan,
): Promise<void> {
  const plannerFile = resolvePlannerFilePath(workspaceDir, sessionKey);
  await fs.mkdir(path.dirname(plannerFile), { recursive: true });
  await fs.writeFile(plannerFile, JSON.stringify(plan, null, 2), "utf-8");
}

function resolveWorkspaceDir(): string {
  const cfg = loadConfig();
  const stateDir = resolveStateDir(process.env);
  // Prefer explicit workspace from config, fallback to state dir parent (usually home dir)
  const explicit =
    (cfg.agents as Record<string, unknown> | undefined)?.defaults &&
    typeof ((cfg.agents as Record<string, unknown>)?.defaults as Record<string, unknown>)
      ?.workspace === "string"
      ? (((cfg.agents as Record<string, unknown>)?.defaults as Record<string, unknown>)
          ?.workspace as string)
      : undefined;
  return explicit ?? path.dirname(stateDir);
}

export const taskPlanHandlers: GatewayRequestHandlers = {
  "task_plan.read": async ({ params, respond, context }) => {
    const rawKey = params && typeof params.sessionKey === "string" ? params.sessionKey.trim() : "";
    const maxConcurrent =
      params && typeof params.maxConcurrent === "number" ? params.maxConcurrent : undefined;
    const chaosScore =
      params && typeof params.chaosScore === "number" ? params.chaosScore : undefined;

    if (!rawKey) {
      respond(true, { ok: true, plan: null }, undefined);
      return;
    }

    try {
      const workspaceDir = resolveWorkspaceDir();
      const existing = await loadTaskPlanFromDisk(workspaceDir, rawKey);
      if (!existing) {
        respond(true, { ok: true, plan: null }, undefined);
        return;
      }
      const { plan, removed } = sanitizeTaskPlan(existing);
      const now = Date.now();
      const autopilot = await runAutopilotDispatch({
        plan,
        sessionKey: rawKey,
        now,
        maxConcurrent,
        chaosScore,
        autopilotEnabled: params && params.autopilot === true,
      });
      const recovery = applyRecoveryState({
        plan: autopilot.nextPlan,
        sessionKey: rawKey,
        graph: autopilot.graph,
        now,
      });
      const shouldPersist =
        removed > 0 || autopilot.changed || recovery.changed || plan !== existing;
      if (shouldPersist) {
        await saveTaskPlanToDisk(workspaceDir, rawKey, recovery.nextPlan);
      }
      if (typeof context.broadcast === "function") {
        context.broadcast("task_plan.autopilot.status", autopilot.statusPayload);
        for (const payload of autopilot.spawnedPayloads) {
          context.broadcast("task_plan.autopilot.spawned", payload);
        }
      }
      if (recovery.broadcastPayload && typeof context.broadcast === "function") {
        context.broadcast("task_plan.execution.recover", recovery.broadcastPayload);
      }
      respond(
        true,
        {
          ok: true,
          plan: recovery.nextPlan,
          executionGraph: autopilot.graph,
          recovery: recovery.broadcastPayload ?? null,
          autopilot: autopilot.statusPayload,
          spawned: autopilot.spawnedPayloads,
          taskRuntime: buildTaskPlanRuntimeSummary(recovery.nextPlan),
        },
        undefined,
      );
    } catch (err) {
      respond(true, { ok: true, plan: null, error: String(err) }, undefined);
    }
  },
  "task_plan.approve": async ({ params, respond, context }) => {
    const rawKey = params && typeof params.sessionKey === "string" ? params.sessionKey.trim() : "";
    if (!rawKey) {
      respond(false, undefined, {
        code: "TASK_PLAN_INVALID_REQUEST",
        message: "sessionKey is required",
      });
      return;
    }

    try {
      const workspaceDir = resolveWorkspaceDir();
      const existing = await loadTaskPlanFromDisk(workspaceDir, rawKey);
      if (!existing) {
        respond(true, { ok: true, plan: null, warning: "PLAN_NOT_FOUND" }, undefined);
        return;
      }
      const { plan: cleaned } = sanitizeTaskPlan(existing);
      const transition = resolveExecutionTransition(cleaned.phase);
      const baseNext: TaskPlan = {
        ...cleaned,
        phase: transition.to,
        updatedAt: Date.now(),
      };
      const now = Date.now();
      const autopilot = await runAutopilotDispatch({
        plan: baseNext,
        sessionKey: rawKey,
        now,
        maxConcurrent:
          params && typeof params.maxConcurrent === "number" ? params.maxConcurrent : undefined,
        chaosScore: params && typeof params.chaosScore === "number" ? params.chaosScore : undefined,
        autopilotEnabled: true,
      });
      const next =
        transition.changed && transition.to === "execution"
          ? appendCheckpoint(autopilot.nextPlan, {
              reason: "approve",
              stageId: transition.to,
              taskId: rawKey,
              now,
            })
          : autopilot.nextPlan;
      await saveTaskPlanToDisk(workspaceDir, rawKey, next);
      respond(
        true,
        {
          ok: true,
          plan: next,
          executionGraph: autopilot.graph,
          autopilot: autopilot.statusPayload,
          spawned: autopilot.spawnedPayloads,
          taskRuntime: buildTaskPlanRuntimeSummary(next),
          approvedAt: next.updatedAt,
          phaseTransition: {
            from: transition.from,
            to: transition.to,
            changed: transition.changed,
          },
        },
        undefined,
      );
      if (transition.changed && transition.to === "execution") {
        const executionGraph = autopilot.graph;
        const prompt = buildExecutionPrompt(executionGraph);
        if (typeof context.broadcast === "function") {
          context.broadcast("task_plan.execution.trigger", {
            sessionKey: rawKey,
            approvedAt: next.updatedAt,
            phaseTransition: {
              from: transition.from,
              to: transition.to,
              changed: transition.changed,
            },
            executionGraph,
            prompt,
          });
          context.broadcast("task_plan.autopilot.status", autopilot.statusPayload);
          for (const payload of autopilot.spawnedPayloads) {
            context.broadcast("task_plan.autopilot.spawned", payload);
          }
        }
      }
    } catch (err) {
      respond(false, undefined, {
        code: "TASK_PLAN_APPROVE_ERROR",
        message: `failed to approve task plan: ${String(err)}`,
      });
    }
  },
  "task_plan.transition.apply": async ({ params, respond, context }) => {
    const rawKey = params && typeof params.sessionKey === "string" ? params.sessionKey.trim() : "";
    const actionRaw = params && typeof params.action === "string" ? params.action.trim() : "";
    const action = TRANSITION_ACTIONS.has(actionRaw as TransitionAction)
      ? (actionRaw as TransitionAction)
      : null;
    const checkpointId =
      params && typeof params.checkpointId === "string" ? params.checkpointId.trim() : "";
    const requestedBranchId =
      params && typeof params.branchId === "string" ? params.branchId.trim() : "";
    if (!rawKey || !action) {
      respond(false, undefined, {
        code: "TASK_PLAN_INVALID_REQUEST",
        message: "sessionKey and valid action are required",
      });
      return;
    }
    try {
      const workspaceDir = resolveWorkspaceDir();
      const existing = await loadTaskPlanFromDisk(workspaceDir, rawKey);
      if (!existing) {
        respond(true, { ok: true, plan: null, warning: "PLAN_NOT_FOUND" }, undefined);
        return;
      }
      const { plan: cleaned } = sanitizeTaskPlan(existing);
      const runtime = ensureTaskPlanRuntime(cleaned).plan;
      const now = Date.now();
      let next = runtime;
      let changed = false;
      let fromPhase = normalizePlanPhase(runtime.phase);
      let toPhase = fromPhase;
      const sourceCheckpointId = checkpointId || undefined;

      if (action === "forward") {
        const transition = resolveExecutionTransition(runtime.phase);
        fromPhase = transition.from;
        toPhase = transition.to;
        if (transition.changed) {
          next = {
            ...runtime,
            phase: transition.to,
            updatedAt: now,
          };
          changed = true;
        }
      } else if (action === "retry") {
        fromPhase = normalizePlanPhase(runtime.phase);
        toPhase = fromPhase === "complete" ? "complete" : "execution";
        if (fromPhase !== "complete" && fromPhase !== "execution") {
          next = {
            ...runtime,
            phase: "execution",
            updatedAt: now,
          };
          changed = true;
        }
      } else if (action === "branch") {
        const nextBranchId = requestedBranchId || createBranchId(now);
        const branches = Array.isArray(runtime.branches) ? [...runtime.branches] : [];
        if (!branches.some((branch) => branch.id === nextBranchId)) {
          branches.push({
            id: nextBranchId,
            status: "active",
            createdAt: now,
            parentBranchId: runtime.currentBranchId,
            derivedFromCheckpointId: sourceCheckpointId,
          });
        }
        const stageHistoryTree = { ...runtime.stageHistoryTree };
        if (!Array.isArray(stageHistoryTree[nextBranchId])) {
          stageHistoryTree[nextBranchId] = Array.isArray(
            stageHistoryTree[runtime.currentBranchId ?? "main"],
          )
            ? [...(stageHistoryTree[runtime.currentBranchId ?? "main"] as string[])]
            : [];
        }
        next = {
          ...runtime,
          branches,
          currentBranchId: nextBranchId,
          stageHistoryTree,
          updatedAt: now,
        };
        changed = true;
      } else if (action === "rollback" || action === "restore") {
        if (!checkpointId) {
          respond(false, undefined, {
            code: "TASK_PLAN_INVALID_REQUEST",
            message: "checkpointId is required for rollback/restore",
          });
          return;
        }
        const restored = restoreFromCheckpoint(runtime, checkpointId, now);
        if (!restored) {
          respond(false, undefined, {
            code: "TASK_PLAN_CHECKPOINT_NOT_FOUND",
            message: `checkpoint not found: ${checkpointId}`,
          });
          return;
        }
        fromPhase = normalizePlanPhase(runtime.phase);
        toPhase = normalizePlanPhase(restored.phase);
        next = restored;
        changed = true;
      }

      if (changed) {
        next = appendCheckpoint(next, {
          reason: action,
          stageId: toPhase,
          sourceCheckpointId,
          taskId: rawKey,
          now,
        });
        await saveTaskPlanToDisk(workspaceDir, rawKey, next);
      }

      const graph = buildExecutionGraph(next, now, {
        enabled: false,
      });
      const checkpoints = Array.isArray(next.checkpoints) ? next.checkpoints : [];
      const latestCheckpointId =
        checkpoints.length > 0 ? checkpoints[checkpoints.length - 1]?.checkpointId : undefined;
      const payload = {
        sessionKey: rawKey,
        action,
        changed,
        phaseTransition: {
          from: fromPhase,
          to: toPhase,
          changed: fromPhase !== toPhase,
        },
        currentBranchId: next.currentBranchId,
        checkpointId: changed ? latestCheckpointId : undefined,
        at: now,
      };
      if (typeof context.broadcast === "function") {
        context.broadcast("task_plan.stage.changed", payload);
      }
      respond(
        true,
        {
          ok: true,
          plan: next,
          executionGraph: graph,
          taskRuntime: buildTaskPlanRuntimeSummary(next),
          transition: payload,
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, {
        code: "TASK_PLAN_TRANSITION_ERROR",
        message: `task plan transition failed: ${String(err)}`,
      });
    }
  },
  "task_plan.checkpoint.restore": async ({ params, respond, context }) => {
    const rawKey = params && typeof params.sessionKey === "string" ? params.sessionKey.trim() : "";
    const checkpointId =
      params && typeof params.checkpointId === "string" ? params.checkpointId.trim() : "";
    if (!rawKey || !checkpointId) {
      respond(false, undefined, {
        code: "TASK_PLAN_INVALID_REQUEST",
        message: "sessionKey and checkpointId are required",
      });
      return;
    }
    try {
      const workspaceDir = resolveWorkspaceDir();
      const existing = await loadTaskPlanFromDisk(workspaceDir, rawKey);
      if (!existing) {
        respond(true, { ok: true, plan: null, warning: "PLAN_NOT_FOUND" }, undefined);
        return;
      }
      const { plan: cleaned } = sanitizeTaskPlan(existing);
      const now = Date.now();
      const restored = restoreFromCheckpoint(cleaned, checkpointId, now);
      if (!restored) {
        respond(false, undefined, {
          code: "TASK_PLAN_CHECKPOINT_NOT_FOUND",
          message: `checkpoint not found: ${checkpointId}`,
        });
        return;
      }
      const next = appendCheckpoint(restored, {
        reason: "restore",
        sourceCheckpointId: checkpointId,
        stageId: normalizePlanPhase(restored.phase),
        taskId: rawKey,
        now,
      });
      await saveTaskPlanToDisk(workspaceDir, rawKey, next);
      const graph = buildExecutionGraph(next, now, {
        enabled: false,
      });
      if (typeof context.broadcast === "function") {
        context.broadcast("task_plan.checkpoint.restored", {
          sessionKey: rawKey,
          checkpointId,
          branchId: next.currentBranchId,
          at: now,
        });
      }
      respond(
        true,
        {
          ok: true,
          plan: next,
          executionGraph: graph,
          taskRuntime: buildTaskPlanRuntimeSummary(next),
          restoredFrom: checkpointId,
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, {
        code: "TASK_PLAN_RESTORE_ERROR",
        message: `task plan checkpoint restore failed: ${String(err)}`,
      });
    }
  },
  "task_plan.verifier.report": async ({ params, respond, context }) => {
    const rawKey = params && typeof params.sessionKey === "string" ? params.sessionKey.trim() : "";
    const statusRaw = params && typeof params.status === "string" ? params.status.trim() : "";
    const status: VerifierStatus =
      statusRaw === "passed" || statusRaw === "failed" || statusRaw === "blocked"
        ? statusRaw
        : "pending";
    if (!rawKey) {
      respond(false, undefined, {
        code: "TASK_PLAN_INVALID_REQUEST",
        message: "sessionKey is required",
      });
      return;
    }
    try {
      const workspaceDir = resolveWorkspaceDir();
      const existing = await loadTaskPlanFromDisk(workspaceDir, rawKey);
      if (!existing) {
        respond(true, { ok: true, plan: null, warning: "PLAN_NOT_FOUND" }, undefined);
        return;
      }
      const { plan: cleaned } = sanitizeTaskPlan(existing);
      const runtime = ensureTaskPlanRuntime(cleaned).plan;
      const now = Date.now();
      const stageId =
        params && typeof params.stageId === "string" && params.stageId.trim().length > 0
          ? params.stageId.trim()
          : normalizePlanPhase(runtime.phase);
      const summary =
        params && typeof params.summary === "string" && params.summary.trim().length > 0
          ? params.summary.trim()
          : `verifier marked ${status}`;
      const evidence =
        params && Array.isArray(params.evidence)
          ? params.evidence.filter(
              (item): item is string => typeof item === "string" && item.trim().length > 0,
            )
          : [];
      const recommendedAction =
        params && typeof params.recommendedAction === "string"
          ? (params.recommendedAction as TaskPlanVerifierRecord["recommendedAction"])
          : undefined;
      const verifierRecord: TaskPlanVerifierRecord = {
        verifierId: createVerifierId(now),
        taskId: rawKey,
        stageId,
        branchId: runtime.currentBranchId ?? "main",
        status,
        summary,
        evidence,
        recommendedAction,
        createdAt: now,
      };
      let next: TaskPlan = {
        ...runtime,
        verifierHistory: [...(runtime.verifierHistory ?? []), verifierRecord],
        updatedAt: now,
      };
      if (status === "passed" && normalizePlanPhase(next.phase) === "execution") {
        next = {
          ...next,
          phase: "verification",
          updatedAt: now,
        };
      }
      next = pushGraphEdge(next, {
        from: `verifier:${verifierRecord.verifierId}`,
        to: `stage:${stageId}`,
        relation: "VERIFIER_EVALUATES_STAGE",
        at: now,
      });
      if (status === "failed" || status === "blocked") {
        next = pushGraphEdge(next, {
          from: `error:${verifierRecord.verifierId}`,
          to: `stage:${stageId}`,
          relation: "ERROR_TRIGGERS_ROLLBACK",
          at: now,
        });
      }
      next = appendCheckpoint(next, {
        reason: "verifier",
        stageId,
        taskId: rawKey,
        now,
      });
      await saveTaskPlanToDisk(workspaceDir, rawKey, next);
      const payload = {
        sessionKey: rawKey,
        verifier: verifierRecord,
        taskRuntime: buildTaskPlanRuntimeSummary(next),
        graphEdges: (next.graphEdges ?? []).slice(-80),
        at: now,
      };
      if (typeof context.broadcast === "function") {
        context.broadcast("task_plan.verifier.result", payload);
      }
      respond(
        true,
        {
          ok: true,
          plan: next,
          verifier: verifierRecord,
          taskRuntime: buildTaskPlanRuntimeSummary(next),
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, {
        code: "TASK_PLAN_VERIFIER_ERROR",
        message: `task plan verifier report failed: ${String(err)}`,
      });
    }
  },
  "task_plan.dream.distill": async ({ params, respond, context }) => {
    const rawKey = params && typeof params.sessionKey === "string" ? params.sessionKey.trim() : "";
    if (!rawKey) {
      respond(false, undefined, {
        code: "TASK_PLAN_INVALID_REQUEST",
        message: "sessionKey is required",
      });
      return;
    }
    try {
      const workspaceDir = resolveWorkspaceDir();
      const existing = await loadTaskPlanFromDisk(workspaceDir, rawKey);
      if (!existing) {
        respond(true, { ok: true, plan: null, warning: "PLAN_NOT_FOUND" }, undefined);
        return;
      }
      const { plan: cleaned } = sanitizeTaskPlan(existing);
      const runtime = ensureTaskPlanRuntime(cleaned).plan;
      const now = Date.now();
      const stageId =
        params && typeof params.stageId === "string" && params.stageId.trim().length > 0
          ? params.stageId.trim()
          : normalizePlanPhase(runtime.phase);
      const branchId =
        params && typeof params.branchId === "string" && params.branchId.trim().length > 0
          ? params.branchId.trim()
          : (runtime.currentBranchId ?? "main");
      const summary =
        params && typeof params.summary === "string" && params.summary.trim().length > 0
          ? params.summary.trim()
          : `distilled ${stageId} stage`;
      const keyDecisions =
        params && Array.isArray(params.keyDecisions)
          ? params.keyDecisions.filter(
              (item): item is string => typeof item === "string" && item.trim().length > 0,
            )
          : [];
      const risks =
        params && Array.isArray(params.risks)
          ? params.risks.filter(
              (item): item is string => typeof item === "string" && item.trim().length > 0,
            )
          : [];
      const nextAction =
        params && typeof params.nextAction === "string" && params.nextAction.trim().length > 0
          ? params.nextAction.trim()
          : "continue execution";
      const anchors =
        params && Array.isArray(params.anchors)
          ? params.anchors.filter(
              (item): item is string => typeof item === "string" && item.trim().length > 0,
            )
          : [`stage:${stageId}`, `branch:${branchId}`];
      const sourceCheckpointIds = Array.isArray(runtime.checkpoints)
        ? runtime.checkpoints
            .filter((checkpoint) => checkpoint.branchId === branchId)
            .slice(-3)
            .map((checkpoint) => checkpoint.checkpointId)
        : [];
      const dream: TaskPlanDream = {
        dreamId: createDreamId(now),
        taskId: rawKey,
        stageId,
        branchId,
        summary,
        keyDecisions,
        risks,
        nextAction,
        anchors,
        sourceCheckpointIds,
        createdAt: now,
      };
      let next: TaskPlan = {
        ...runtime,
        dreams: [...(runtime.dreams ?? []), dream],
        updatedAt: now,
      };
      next = pushGraphEdge(next, {
        from: `stage:${stageId}`,
        to: `dream:${dream.dreamId}`,
        relation: "STAGE_GENERATES_DREAM",
        at: now,
      });
      for (const checkpointId of sourceCheckpointIds) {
        next = pushGraphEdge(next, {
          from: `dream:${dream.dreamId}`,
          to: `checkpoint:${checkpointId}`,
          relation: "DREAM_SUMMARIZES_CHECKPOINT",
          at: now,
        });
      }
      await saveTaskPlanToDisk(workspaceDir, rawKey, next);
      if (typeof context.broadcast === "function") {
        context.broadcast("task_plan.dream.created", {
          sessionKey: rawKey,
          dream,
          taskRuntime: buildTaskPlanRuntimeSummary(next),
          graphEdges: (next.graphEdges ?? []).slice(-80),
          at: now,
        });
      }
      respond(
        true,
        {
          ok: true,
          plan: next,
          dream,
          taskRuntime: buildTaskPlanRuntimeSummary(next),
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, {
        code: "TASK_PLAN_DREAM_ERROR",
        message: `task plan dream distill failed: ${String(err)}`,
      });
    }
  },
  "task_plan.graph.query": async ({ params, respond }) => {
    const rawKey = params && typeof params.sessionKey === "string" ? params.sessionKey.trim() : "";
    if (!rawKey) {
      respond(false, undefined, {
        code: "TASK_PLAN_INVALID_REQUEST",
        message: "sessionKey is required",
      });
      return;
    }
    try {
      const workspaceDir = resolveWorkspaceDir();
      const existing = await loadTaskPlanFromDisk(workspaceDir, rawKey);
      if (!existing) {
        respond(true, { ok: true, edges: [], warning: "PLAN_NOT_FOUND" }, undefined);
        return;
      }
      const { plan } = sanitizeTaskPlan(existing);
      const runtime = ensureTaskPlanRuntime(plan).plan;
      const nodeId =
        params && typeof params.nodeId === "string" && params.nodeId.trim().length > 0
          ? params.nodeId.trim()
          : "";
      const relation =
        params && typeof params.relation === "string" && params.relation.trim().length > 0
          ? params.relation.trim()
          : "";
      const limit =
        params && typeof params.limit === "number" && Number.isFinite(params.limit)
          ? Math.max(1, Math.min(200, Math.floor(params.limit)))
          : 50;
      const edges = (runtime.graphEdges ?? []).filter((edge) => {
        if (nodeId && !edge.from.includes(nodeId) && !edge.to.includes(nodeId)) {
          return false;
        }
        if (relation && edge.relation !== relation) {
          return false;
        }
        return true;
      });
      respond(
        true,
        {
          ok: true,
          edges: edges.slice(-limit),
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, {
        code: "TASK_PLAN_GRAPH_QUERY_ERROR",
        message: `task plan graph query failed: ${String(err)}`,
      });
    }
  },
  "task_plan.autopilot.tick": async ({ params, respond, context }) => {
    const rawKey = params && typeof params.sessionKey === "string" ? params.sessionKey.trim() : "";
    if (!rawKey) {
      respond(false, undefined, {
        code: "TASK_PLAN_INVALID_REQUEST",
        message: "sessionKey is required",
      });
      return;
    }
    try {
      const workspaceDir = resolveWorkspaceDir();
      const existing = await loadTaskPlanFromDisk(workspaceDir, rawKey);
      if (!existing) {
        respond(true, { ok: true, plan: null }, undefined);
        return;
      }
      const { plan: cleaned, removed } = sanitizeTaskPlan(existing);
      const now = Date.now();
      const autopilot = await runAutopilotDispatch({
        plan: cleaned,
        sessionKey: rawKey,
        now,
        maxConcurrent:
          params && typeof params.maxConcurrent === "number" ? params.maxConcurrent : undefined,
        chaosScore: params && typeof params.chaosScore === "number" ? params.chaosScore : undefined,
        autopilotEnabled:
          !(params && Object.prototype.hasOwnProperty.call(params, "autopilot")) ||
          params.autopilot === true,
      });
      const recovery = applyRecoveryState({
        plan: autopilot.nextPlan,
        sessionKey: rawKey,
        graph: autopilot.graph,
        now,
      });
      const shouldPersist =
        removed > 0 || autopilot.changed || recovery.changed || cleaned !== existing;
      if (shouldPersist) {
        await saveTaskPlanToDisk(workspaceDir, rawKey, recovery.nextPlan);
      }
      if (typeof context.broadcast === "function") {
        context.broadcast("task_plan.autopilot.status", autopilot.statusPayload);
        for (const payload of autopilot.spawnedPayloads) {
          context.broadcast("task_plan.autopilot.spawned", payload);
        }
        if (recovery.broadcastPayload) {
          context.broadcast("task_plan.execution.recover", recovery.broadcastPayload);
        }
      }
      respond(
        true,
        {
          ok: true,
          plan: recovery.nextPlan,
          executionGraph: autopilot.graph,
          autopilot: autopilot.statusPayload,
          spawned: autopilot.spawnedPayloads,
          recovery: recovery.broadcastPayload ?? null,
          taskRuntime: buildTaskPlanRuntimeSummary(recovery.nextPlan),
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, {
        code: "TASK_PLAN_AUTOPILOT_ERROR",
        message: `task plan autopilot tick failed: ${String(err)}`,
      });
    }
  },
};
