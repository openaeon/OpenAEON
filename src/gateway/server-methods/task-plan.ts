import fs from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "../../config/config.js";
import { resolveStateDir } from "../../config/config.js";
import type { GatewayRequestHandlers } from "./types.js";

type TodoStatus = "todo" | "in_progress" | "done";

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
};

type TaskPlan = {
  description: string;
  todos: TodoItem[];
  phase?: "planning" | "execution" | "verification" | "complete";
  updatedAt?: number;
};

type TaskPlanExecutionGraph = {
  orderedTodoIds: string[];
  readyTodoIds: string[];
  blockedTodoIds: string[];
  blockedBy: Record<string, string[]>;
};

type TaskPlanPhase = NonNullable<TaskPlan["phase"]>;

const TASK_PLAN_PHASE_ORDER: Record<TaskPlanPhase, number> = {
  planning: 0,
  execution: 1,
  verification: 2,
  complete: 3,
};

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
    if (normalizedPhase === plan.phase) {
      return { plan, removed: 0 };
    }
    return {
      plan: {
        ...plan,
        phase: normalizedPhase,
        updatedAt: Date.now(),
      },
      removed: 0,
    };
  }
  return {
    plan: {
      ...plan,
      todos: nextTodos,
      phase: normalizePlanPhase(plan.phase),
      updatedAt: Date.now(),
    },
    removed,
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

function buildExecutionGraph(plan: TaskPlan): TaskPlanExecutionGraph {
  const todos = Array.isArray(plan.todos) ? plan.todos : [];
  if (todos.length === 0) {
    return {
      orderedTodoIds: [],
      readyTodoIds: [],
      blockedTodoIds: [],
      blockedBy: {},
    };
  }
  const byId = new Map(todos.map((todo) => [todo.id, todo] as const));
  const active = todos.filter((todo) => todo.status !== "done");
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
      if (!depTodo || depTodo.status !== "done") {
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
  const readyTodoIds = active
    .filter((todo) => (blockedBy[todo.id] ?? []).length === 0)
    .map((todo) => todo.id);
  const blockedTodoIds = active
    .filter((todo) => (blockedBy[todo.id] ?? []).length > 0)
    .map((todo) => todo.id);

  return {
    orderedTodoIds,
    readyTodoIds,
    blockedTodoIds,
    blockedBy,
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
  "task_plan.read": async ({ params, respond }) => {
    const rawKey = params && typeof params.sessionKey === "string" ? params.sessionKey.trim() : "";

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
      if (removed > 0) {
        await saveTaskPlanToDisk(workspaceDir, rawKey, plan);
      }
      respond(true, { ok: true, plan, executionGraph: buildExecutionGraph(plan) }, undefined);
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
      const next: TaskPlan = {
        ...cleaned,
        phase: transition.to,
        updatedAt: Date.now(),
      };
      await saveTaskPlanToDisk(workspaceDir, rawKey, next);
      respond(
        true,
        {
          ok: true,
          plan: next,
          executionGraph: buildExecutionGraph(next),
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
        const executionGraph = buildExecutionGraph(next);
        const prompt =
          executionGraph.readyTodoIds.length > 0
            ? `计划已批准并进入 execution。优先执行 ready tasks: ${executionGraph.readyTodoIds.join(", ")}；按依赖顺序推进，逐项回填 result。`
            : "计划已批准并进入 execution。暂无 ready task，先解除阻塞依赖并继续推进。";
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
        }
      }
    } catch (err) {
      respond(false, undefined, {
        code: "TASK_PLAN_APPROVE_ERROR",
        message: `failed to approve task plan: ${String(err)}`,
      });
    }
  },
};
