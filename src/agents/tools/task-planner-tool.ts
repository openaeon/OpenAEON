import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Type } from "@sinclair/typebox";
import { acquireSessionWriteLock } from "../session-write-lock.js";
import type { AnyAgentTool } from "./common.js";
import { ToolInputError, jsonResult, readStringParam } from "./common.js";

const TaskPlannerSchema = Type.Object({
  action: Type.Union([
    Type.Literal("create_plan"),
    Type.Literal("add_todo"),
    Type.Literal("update_todo"),
    Type.Literal("read_plan"),
    Type.Literal("complete_plan"),
    Type.Literal("set_phase"),
  ]),
  description: Type.Optional(
    Type.String({ description: "Overall plan description for create_plan" }),
  ),
  taskId: Type.Optional(Type.String({ description: "ID of the task to update" })),
  title: Type.Optional(Type.String({ description: "Task title for add_todo or update_todo" })),
  status: Type.Optional(
    Type.Union([Type.Literal("todo"), Type.Literal("in_progress"), Type.Literal("done")]),
  ),
  result: Type.Optional(
    Type.String({
      description:
        "Only used when status is 'done'. The result output from the subagent or execution step.",
    }),
  ),
  ownerAgent: Type.Optional(
    Type.String({
      description: "Optional owner agent/session label for this task.",
    }),
  ),
  dependsOn: Type.Optional(
    Type.Array(Type.String(), {
      description: "Optional dependency task IDs that must complete before this task.",
    }),
  ),
  acceptanceCriteria: Type.Optional(
    Type.Array(Type.String(), {
      description: "Optional acceptance criteria checklist for objective verification.",
    }),
  ),
  outputSchema: Type.Optional(
    Type.String({
      description: "Optional output contract/schema description for task result.",
    }),
  ),
  riskLevel: Type.Optional(
    Type.Union([Type.Literal("low"), Type.Literal("medium"), Type.Literal("high")], {
      description: "Optional risk level used by orchestrator guardrails.",
    }),
  ),
  mergeKey: Type.Optional(
    Type.String({
      description: "Optional merge key for grouping related tasks/results.",
    }),
  ),
  retryLimit: Type.Optional(
    Type.Number({
      minimum: 0,
      maximum: 10,
      description: "Optional retry cap for this task.",
    }),
  ),
  phase: Type.Optional(
    Type.Union(
      [
        Type.Literal("planning"),
        Type.Literal("execution"),
        Type.Literal("verification"),
        Type.Literal("complete"),
      ],
      {
        description:
          "Phase for set_phase action. Transitions: planning → execution → verification → complete",
      },
    ),
  ),
  parentSessionKey: Type.Optional(
    Type.String({
      description:
        "If you are a subagent updating a main agent's task plan, provide the main agent's session key here.",
    }),
  ),
  format: Type.Optional(
    Type.Union([Type.Literal("full"), Type.Literal("digest")], {
      description:
        "Output format for read_plan. 'full' returns all todos, 'digest' returns a compact status line.",
    }),
  ),
});

type TodoItem = {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "done";
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
  phase: "planning" | "execution" | "verification" | "complete";
};

const TASK_PLAN_PHASE_ORDER: Record<TaskPlan["phase"], number> = {
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

function prunePlaceholderTodos(plan: TaskPlan): number {
  const before = plan.todos.length;
  plan.todos = plan.todos.filter(
    (todo) => !isPlaceholderTodoTitle(todo.title) && !isPlaceholderTodoResult(todo.result),
  );
  return before - plan.todos.length;
}

function readStringArrayParam(
  params: unknown,
  key: string,
  opts: { required?: boolean } = {},
): string[] | undefined {
  if (!params || typeof params !== "object") {
    if (opts.required) {
      throw new ToolInputError(`Invalid value for '${key}': expected array`);
    }
    return undefined;
  }
  const value = (params as Record<string, unknown>)[key];
  if (value === undefined) {
    if (opts.required) {
      throw new ToolInputError(`Missing required parameter '${key}'`);
    }
    return undefined;
  }
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new ToolInputError(`Invalid value for '${key}': expected string[]`);
  }
  return value;
}

function readNumberParam(
  params: unknown,
  key: string,
  opts: { required?: boolean; min?: number; max?: number } = {},
): number | undefined {
  if (!params || typeof params !== "object") {
    if (opts.required) {
      throw new ToolInputError(`Invalid value for '${key}': expected number`);
    }
    return undefined;
  }
  const value = (params as Record<string, unknown>)[key];
  if (value === undefined) {
    if (opts.required) {
      throw new ToolInputError(`Missing required parameter '${key}'`);
    }
    return undefined;
  }
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new ToolInputError(`Invalid value for '${key}': expected number`);
  }
  if (opts.min !== undefined && value < opts.min) {
    throw new ToolInputError(`Invalid value for '${key}': must be >= ${opts.min}`);
  }
  if (opts.max !== undefined && value > opts.max) {
    throw new ToolInputError(`Invalid value for '${key}': must be <= ${opts.max}`);
  }
  return value;
}

function ensureDoneResultWhenRequired(item: TodoItem): void {
  if (item.status !== "done") {
    return;
  }
  if (!item.acceptanceCriteria || item.acceptanceCriteria.length === 0) {
    return;
  }
  if (!item.result || item.result.trim().length === 0) {
    throw new ToolInputError(
      "Cannot set todo to done without non-empty result when acceptanceCriteria is defined.",
    );
  }
}

export function createTaskPlannerTool(options?: {
  agentSessionKey?: string;
  workspaceDir?: string;
}): AnyAgentTool | null {
  if (!options?.workspaceDir) {
    return null;
  }
  const workspaceDir = options.workspaceDir;
  // Use a fallback key if session key is not provided. Sanitize to prevent path traversal.
  const sessionKey = options.agentSessionKey
    ? options.agentSessionKey.replace(/[^a-zA-Z0-9_-]/g, "_")
    : "default";

  return {
    label: "Task Planner",
    name: "write_todos",
    description:
      "Manage a task plan and todo list to coordinate complex multi-step work. Useful for breaking down long tasks, tracking progress, and communicating steps between sub-agents. Use 'create_plan' to initialize, 'add_todo' to add items, 'update_todo' to change status, and 'read_plan' to view current plan.",
    parameters: TaskPlannerSchema,
    execute: async (_toolCallId, params) => {
      const action = readStringParam(params, "action", { required: true });
      const parentSessionKeyRaw = readStringParam(params, "parentSessionKey");
      const targetSessionKey = parentSessionKeyRaw
        ? parentSessionKeyRaw.replace(/[^a-zA-Z0-9_-]/g, "_")
        : sessionKey;

      const plannerDir = path.join(workspaceDir, ".openaeon", "planner");
      const plannerFile = path.join(plannerDir, `${targetSessionKey}.json`);

      let lockRelease: (() => Promise<void>) | undefined;
      try {
        const lock = await acquireSessionWriteLock({ sessionFile: plannerFile, timeoutMs: 15000 });
        lockRelease = lock.release;

        const loadPlan = async (): Promise<TaskPlan> => {
          try {
            const content = await fs.readFile(plannerFile, "utf-8");
            const raw = JSON.parse(content) as TaskPlan;
            // Backcompat: old plans without phase default to "execution"
            if (!raw.phase) {
              raw.phase = "execution";
            }
            return raw;
          } catch {
            return { description: "", todos: [], phase: "planning" };
          }
        };

        const savePlan = async (plan: TaskPlan) => {
          await fs.mkdir(plannerDir, { recursive: true });
          await fs.writeFile(plannerFile, JSON.stringify(plan, null, 2), "utf-8");
        };

        if (action === "create_plan") {
          const description = readStringParam(params, "description", { required: true });
          const plan: TaskPlan = { description, todos: [], phase: "planning" };
          await savePlan(plan);
          return jsonResult({ status: "ok", plan });
        }

        if (action === "read_plan") {
          const plan = await loadPlan();
          const removed = prunePlaceholderTodos(plan);
          if (removed > 0) {
            await savePlan(plan);
          }
          const format = readStringParam(params, "format");
          if (format === "digest") {
            const statusIcons: Record<string, string> = {
              todo: "⏳",
              in_progress: "🔄",
              done: "✅",
            };
            const doneCount = plan.todos.filter((t) => t.status === "done").length;
            const total = plan.todos.length;
            const items = plan.todos
              .map((t, i) => {
                const icon = statusIcons[t.status] ?? "⏳";
                return `${i + 1}. ${t.title} ${icon}`;
              })
              .join(" | ");
            return jsonResult({
              status: "ok",
              digest: `TODO[${doneCount}/${total}]: ${items}`,
              plan,
            });
          }
          return jsonResult({ status: "ok", plan });
        }

        if (action === "complete_plan") {
          const plan = await loadPlan();
          const removed = prunePlaceholderTodos(plan);
          if (removed > 0) {
            await savePlan(plan);
          }
          plan.todos = plan.todos.map((t) => ({ ...t, status: "done" as const }));
          plan.phase = "complete";
          await savePlan(plan);
          return jsonResult({ status: "ok", message: "All tasks marked as done.", plan });
        }

        if (action === "set_phase") {
          const phaseStr = readStringParam(params, "phase", { required: true });
          const validPhases = ["planning", "execution", "verification", "complete"] as const;
          if (!validPhases.includes(phaseStr as (typeof validPhases)[number])) {
            throw new ToolInputError(
              `Invalid phase: ${phaseStr}. Must be one of: ${validPhases.join(", ")}`,
            );
          }
          const plan = await loadPlan();
          const removed = prunePlaceholderTodos(plan);
          if (removed > 0) {
            await savePlan(plan);
          }
          const currentOrder = TASK_PLAN_PHASE_ORDER[plan.phase];
          const nextOrder = TASK_PLAN_PHASE_ORDER[phaseStr as TaskPlan["phase"]];
          if (nextOrder < currentOrder) {
            throw new ToolInputError(
              `Invalid phase transition: ${plan.phase} -> ${phaseStr}. Backward transitions are not allowed.`,
            );
          }
          plan.phase = phaseStr as TaskPlan["phase"];
          await savePlan(plan);
          return jsonResult({ status: "ok", phase: plan.phase, plan });
        }

        const plan = await loadPlan();
        const removed = prunePlaceholderTodos(plan);
        if (removed > 0) {
          await savePlan(plan);
        }

        if (action === "add_todo") {
          const title = readStringParam(params, "title", { required: true });
          if (isPlaceholderTodoTitle(title)) {
            return jsonResult({
              status: "ignored",
              reason: "placeholder_todo_title",
              plan,
            });
          }
          const id = crypto.randomUUID().substring(0, 8);
          const ownerAgent = readStringParam(params, "ownerAgent");
          const dependsOn = readStringArrayParam(params, "dependsOn");
          const acceptanceCriteria = readStringArrayParam(params, "acceptanceCriteria");
          const outputSchema = readStringParam(params, "outputSchema");
          const riskLevel = readStringParam(params, "riskLevel") as TodoItem["riskLevel"] | undefined;
          const mergeKey = readStringParam(params, "mergeKey");
          const retryLimit = readNumberParam(params, "retryLimit", { min: 0, max: 10 });
          const item: TodoItem = {
            id,
            title,
            status: "todo",
            ...(ownerAgent ? { ownerAgent } : {}),
            ...(dependsOn && dependsOn.length > 0 ? { dependsOn } : {}),
            ...(acceptanceCriteria && acceptanceCriteria.length > 0 ? { acceptanceCriteria } : {}),
            ...(outputSchema ? { outputSchema } : {}),
            ...(riskLevel ? { riskLevel } : {}),
            ...(mergeKey ? { mergeKey } : {}),
            ...(retryLimit !== undefined ? { retryLimit } : {}),
          };
          plan.todos.push(item);
          await savePlan(plan);
          return jsonResult({ status: "ok", added: item, plan });
        }

        if (action === "update_todo") {
          const taskId = readStringParam(params, "taskId", { required: true });
          const statusStr = readStringParam(params, "status");
          const titleStr = readStringParam(params, "title");
          const resultStr = readStringParam(params, "result");
          const ownerAgent = readStringParam(params, "ownerAgent");
          const dependsOn = readStringArrayParam(params, "dependsOn");
          const acceptanceCriteria = readStringArrayParam(params, "acceptanceCriteria");
          const outputSchema = readStringParam(params, "outputSchema");
          const riskLevel = readStringParam(params, "riskLevel") as TodoItem["riskLevel"] | undefined;
          const mergeKey = readStringParam(params, "mergeKey");
          const retryLimit = readNumberParam(params, "retryLimit", { min: 0, max: 10 });

          const item = plan.todos.find((t) => t.id === taskId);
          if (!item) {
            throw new ToolInputError(`Task ID ${taskId} not found.`);
          }
          if (statusStr) {
            item.status = statusStr as "todo" | "in_progress" | "done";
          }
          if (titleStr) {
            if (isPlaceholderTodoTitle(titleStr)) {
              throw new ToolInputError("Placeholder todo titles are not allowed.");
            }
            item.title = titleStr;
          }
          if (resultStr) {
            item.result = resultStr;
          }
          if (ownerAgent) {
            item.ownerAgent = ownerAgent;
          }
          if (dependsOn) {
            item.dependsOn = dependsOn;
          }
          if (acceptanceCriteria) {
            item.acceptanceCriteria = acceptanceCriteria;
          }
          if (outputSchema) {
            item.outputSchema = outputSchema;
          }
          if (riskLevel) {
            item.riskLevel = riskLevel;
          }
          if (mergeKey) {
            item.mergeKey = mergeKey;
          }
          if (retryLimit !== undefined) {
            item.retryLimit = retryLimit;
          }
          ensureDoneResultWhenRequired(item);
          await savePlan(plan);
          return jsonResult({ status: "ok", updated: item, plan });
        }

        throw new ToolInputError(`Unknown action: ${action}`);
      } finally {
        if (lockRelease) {
          await lockRelease();
        }
      }
    },
  };
}
