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
    Type.Literal("touch_todo"),
    Type.Literal("read_plan"),
    Type.Literal("complete_plan"),
    Type.Literal("close_plan"),
    Type.Literal("set_phase"),
  ]),
  description: Type.Optional(
    Type.String({ description: "Overall plan description for create_plan" }),
  ),
  taskId: Type.Optional(Type.String({ description: "ID of the task to update" })),
  title: Type.Optional(Type.String({ description: "Task title for add_todo or update_todo" })),
  status: Type.Optional(
    Type.Union([
      Type.Literal("planned"),
      Type.Literal("in_progress"),
      Type.Literal("blocked"),
      Type.Literal("done"),
      Type.Literal("verified"),
      Type.Literal("closed"),
      // legacy compatibility
      Type.Literal("todo"),
    ]),
  ),
  result: Type.Optional(
    Type.String({
      description: "Result output from subagent or execution step.",
    }),
  ),
  note: Type.Optional(
    Type.String({
      description: "Optional heartbeat/progress note for touch_todo.",
    }),
  ),
  owner: Type.Optional(
    Type.String({
      description: "Owner for closure tracking.",
    }),
  ),
  ownerAgent: Type.Optional(
    Type.String({
      description: "Legacy owner field; mapped into owner.",
    }),
  ),
  dependsOn: Type.Optional(
    Type.Array(Type.String(), {
      description: "Optional dependency task IDs that must complete before this task.",
    }),
  ),
  acceptance: Type.Optional(
    Type.Array(Type.String(), {
      description: "Required acceptance checklist for closure validation.",
    }),
  ),
  acceptanceCriteria: Type.Optional(
    Type.Array(Type.String(), {
      description: "Legacy acceptance field; mapped into acceptance.",
    }),
  ),
  evidenceRefs: Type.Optional(
    Type.Array(Type.String(), {
      description: "Evidence references proving acceptance criteria completion.",
    }),
  ),
  verifiedBy: Type.Optional(Type.String({ description: "Verifier identity for verified status." })),
  closedAt: Type.Optional(Type.Number({ minimum: 0 })),
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
          "Phase for set_phase action. Transitions: planning -> execution -> verification -> complete",
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

export type TodoStatus = "planned" | "in_progress" | "blocked" | "done" | "verified" | "closed";

export type TodoItem = {
  id: string;
  title: string;
  status: TodoStatus;
  result?: string;
  owner: string;
  ownerAgent?: string;
  dependsOn?: string[];
  acceptance: string[];
  acceptanceCriteria?: string[];
  evidenceRefs: string[];
  verifiedBy?: string;
  closedAt?: number;
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
};

export type TaskPlan = {
  description: string;
  todos: TodoItem[];
  phase: "planning" | "execution" | "verification" | "complete";
  updatedAt?: number;
  closureStatus?: "open" | "closed" | "closed_with_gaps";
  closureGaps?: {
    failed: string[];
    missingEvidence: string[];
    nextActions: string[];
  };
};

const TASK_PLAN_PHASE_ORDER: Record<TaskPlan["phase"], number> = {
  planning: 0,
  execution: 1,
  verification: 2,
  complete: 3,
};

const STATUS_ICON: Record<TodoStatus, string> = {
  planned: "📝",
  in_progress: "🔄",
  blocked: "⛔",
  done: "✅",
  verified: "🧪",
  closed: "🔒",
};

function normalizeTodoStatus(status: string | undefined): TodoStatus {
  if (status === "todo") {
    return "planned";
  }
  if (
    status === "planned" ||
    status === "in_progress" ||
    status === "blocked" ||
    status === "done" ||
    status === "verified" ||
    status === "closed"
  ) {
    return status;
  }
  return "planned";
}

function normalizeTodo(todo: Partial<TodoItem>, fallbackOwner: string): TodoItem {
  const owner =
    (typeof todo.owner === "string" && todo.owner.trim()) ||
    (typeof todo.ownerAgent === "string" && todo.ownerAgent.trim()) ||
    fallbackOwner;
  const acceptance = Array.isArray(todo.acceptance)
    ? todo.acceptance.filter(
        (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
      )
    : Array.isArray(todo.acceptanceCriteria)
      ? todo.acceptanceCriteria.filter(
          (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
        )
      : [];

  return {
    id:
      typeof todo.id === "string" && todo.id.trim().length > 0
        ? todo.id
        : crypto.randomUUID().slice(0, 8),
    title: typeof todo.title === "string" ? todo.title : "Untitled todo",
    status: normalizeTodoStatus(typeof todo.status === "string" ? todo.status : undefined),
    result: typeof todo.result === "string" ? todo.result : undefined,
    owner,
    ownerAgent: typeof todo.ownerAgent === "string" ? todo.ownerAgent : owner,
    dependsOn: Array.isArray(todo.dependsOn)
      ? todo.dependsOn.filter((d): d is string => typeof d === "string")
      : undefined,
    acceptance: acceptance.length > 0 ? acceptance : ["Provide result with verifiable evidence"],
    acceptanceCriteria:
      acceptance.length > 0 ? acceptance : ["Provide result with verifiable evidence"],
    evidenceRefs: Array.isArray(todo.evidenceRefs)
      ? todo.evidenceRefs.filter(
          (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
        )
      : [],
    verifiedBy: typeof todo.verifiedBy === "string" ? todo.verifiedBy : undefined,
    closedAt: typeof todo.closedAt === "number" ? todo.closedAt : undefined,
    outputSchema: typeof todo.outputSchema === "string" ? todo.outputSchema : undefined,
    riskLevel:
      todo.riskLevel === "low" || todo.riskLevel === "medium" || todo.riskLevel === "high"
        ? todo.riskLevel
        : undefined,
    mergeKey: typeof todo.mergeKey === "string" ? todo.mergeKey : undefined,
    retryLimit: typeof todo.retryLimit === "number" ? todo.retryLimit : undefined,
    createdAt: typeof todo.createdAt === "number" ? todo.createdAt : undefined,
    updatedAt: typeof todo.updatedAt === "number" ? todo.updatedAt : undefined,
    startedAt: typeof todo.startedAt === "number" ? todo.startedAt : undefined,
    completedAt: typeof todo.completedAt === "number" ? todo.completedAt : undefined,
    heartbeatAt: typeof todo.heartbeatAt === "number" ? todo.heartbeatAt : undefined,
    attemptCount: typeof todo.attemptCount === "number" ? todo.attemptCount : 0,
    lastProgressNote: typeof todo.lastProgressNote === "string" ? todo.lastProgressNote : undefined,
    lastProgressAt: typeof todo.lastProgressAt === "number" ? todo.lastProgressAt : undefined,
  };
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

function assertValidStatusTransition(from: TodoStatus, to: TodoStatus): void {
  if (from === to) {
    return;
  }
  const allowed: Record<TodoStatus, TodoStatus[]> = {
    planned: ["in_progress", "blocked"],
    in_progress: ["blocked", "done"],
    blocked: ["in_progress", "done"],
    done: ["blocked", "verified"],
    verified: ["blocked", "closed"],
    closed: [],
  };
  if (!allowed[from].includes(to)) {
    throw new ToolInputError(`Invalid todo transition: ${from} -> ${to}`);
  }
}

function ensureClosureFields(item: TodoItem): void {
  const label = item.id.slice(0, 8);
  if (!item.owner?.trim()) {
    throw new ToolInputError(`Todo '${label}' missing mandatory 'owner'`);
  }
  if (!Array.isArray(item.acceptance) || item.acceptance.length === 0) {
    throw new ToolInputError(`Todo '${label}' missing mandatory 'acceptance' criteria`);
  }
  if (item.status === "done" || item.status === "verified" || item.status === "closed") {
    if (!item.result || item.result.trim().length === 0) {
      throw new ToolInputError(`Todo '${label}' missing 'result' for status '${item.status}'`);
    }
    const isLowRisk = item.riskLevel === "low";
    if (!isLowRisk) {
      if (!Array.isArray(item.evidenceRefs) || item.evidenceRefs.length === 0) {
        throw new ToolInputError(
          `Todo '${label}' requires 'evidenceRefs' for status '${item.status}' (riskLevel: ${item.riskLevel ?? "medium"})`,
        );
      }
    }
  }
  if (item.status === "verified" || item.status === "closed") {
    if (!item.verifiedBy || item.verifiedBy.trim().length === 0) {
      throw new ToolInputError(`Todo '${label}' missing 'verifiedBy' for status '${item.status}'`);
    }
  }
  if (item.status === "closed" && typeof item.closedAt !== "number") {
    throw new ToolInputError(`Todo '${item.id}' missing closedAt for status closed`);
  }
}

function extractPlanGaps(plan: TaskPlan) {
  const failed: string[] = [];
  const missingEvidence: string[] = [];
  const nextActions: string[] = [];

  for (const todo of plan.todos) {
    if (!todo.owner?.trim()) {
      failed.push(`${todo.id}:missing_owner`);
    }
    if (!Array.isArray(todo.acceptance) || todo.acceptance.length === 0) {
      failed.push(`${todo.id}:missing_acceptance`);
      nextActions.push(`补充 ${todo.id} 的 acceptance`);
    }
    if (
      (todo.status === "done" || todo.status === "verified" || todo.status === "closed") &&
      (!Array.isArray(todo.evidenceRefs) || todo.evidenceRefs.length === 0)
    ) {
      missingEvidence.push(todo.id);
      nextActions.push(`补充 ${todo.id} 的 evidenceRefs`);
    }
    if ((todo.status === "verified" || todo.status === "closed") && !todo.verifiedBy) {
      failed.push(`${todo.id}:missing_verifiedBy`);
      nextActions.push(`补充 ${todo.id} 的 verifiedBy`);
    }
    if (todo.status !== "verified" && todo.status !== "closed") {
      failed.push(`${todo.id}:not_verified`);
      nextActions.push(`将 ${todo.id} 推进到 verified`);
    }
  }

  return {
    failed,
    missingEvidence,
    nextActions: Array.from(new Set(nextActions)),
  };
}

async function upsertClosureSkill(params: {
  workspaceDir: string;
  plan: TaskPlan;
  targetSessionKey: string;
}) {
  const skillsDir = path.join(params.workspaceDir, ".agents", "skills", "plan-closure-playbook");
  await fs.mkdir(skillsDir, { recursive: true });
  const closedCount = params.plan.todos.filter((todo) => todo.status === "closed").length;
  const total = params.plan.todos.length;
  const acceptanceHints = params.plan.todos
    .flatMap((todo) => todo.acceptance)
    .slice(0, 12)
    .map((line) => `- ${line}`)
    .join("\n");
  const evidenceHints = params.plan.todos
    .flatMap((todo) => todo.evidenceRefs)
    .slice(0, 12)
    .map((line) => `- ${line}`)
    .join("\n");

  const content = `---
name: task_plan_closure
description: Hermes-style closure checklist for OPENAEON plans.
---

# Closure Playbook

Use this skill after execution to enforce strong closure consistency.

## Session
- session: ${params.targetSessionKey}
- closure: ${closedCount}/${total}

## Acceptance Signals
${acceptanceHints || "- (none)"}

## Evidence Signals
${evidenceHints || "- (none)"}
`;

  await fs.writeFile(path.join(skillsDir, "SKILL.md"), content, "utf-8");
}

function sanitizeSessionKey(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function loadTaskPlan(params: {
  workspaceDir: string;
  targetSessionKey: string;
}): Promise<TaskPlan> {
  const plannerFile = path.join(
    params.workspaceDir,
    ".openaeon",
    "planner",
    `${params.targetSessionKey}.json`,
  );

  try {
    const content = await fs.readFile(plannerFile, "utf-8");
    const raw = JSON.parse(content) as Partial<TaskPlan>;
    const fallbackOwner = params.targetSessionKey || "main";
    const todosRaw = Array.isArray(raw.todos) ? raw.todos : [];
    return {
      description: typeof raw.description === "string" ? raw.description : "",
      todos: todosRaw.map((todo) => normalizeTodo(todo as Partial<TodoItem>, fallbackOwner)),
      phase:
        raw.phase === "planning" ||
        raw.phase === "execution" ||
        raw.phase === "verification" ||
        raw.phase === "complete"
          ? raw.phase
          : "planning",
      updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : undefined,
      closureStatus:
        raw.closureStatus === "closed" || raw.closureStatus === "closed_with_gaps"
          ? raw.closureStatus
          : "open",
      closureGaps:
        raw.closureGaps &&
        Array.isArray(raw.closureGaps.failed) &&
        Array.isArray(raw.closureGaps.missingEvidence) &&
        Array.isArray(raw.closureGaps.nextActions)
          ? raw.closureGaps
          : undefined,
    };
  } catch {
    return { description: "", todos: [], phase: "planning", closureStatus: "open" };
  }
}

async function saveTaskPlan(params: {
  workspaceDir: string;
  targetSessionKey: string;
  plan: TaskPlan;
}) {
  const plannerDir = path.join(params.workspaceDir, ".openaeon", "planner");
  const plannerFile = path.join(plannerDir, `${params.targetSessionKey}.json`);
  params.plan.updatedAt = Date.now();
  await fs.mkdir(plannerDir, { recursive: true });
  await fs.writeFile(plannerFile, JSON.stringify(params.plan, null, 2), "utf-8");
  try {
    const { getDiagnosticSessionState } = await import("../../logging/diagnostic-session-state.js");
    const state = getDiagnosticSessionState({ sessionKey: params.targetSessionKey });
    state.currentTaskPhase = params.plan.phase;
  } catch {
    // no-op
  }
}

export async function updateTaskPlannerTodo(params: {
  workspaceDir: string;
  targetSessionKey: string;
  taskId: string;
  status?: TodoStatus;
  result?: string;
  owner?: string;
  acceptance?: string[];
  evidenceRefs?: string[];
  verifiedBy?: string;
  closedAt?: number;
  note?: string;
}): Promise<{ ok: true; updated: TodoItem } | { ok: false; error: string }> {
  const plannerFile = path.join(
    params.workspaceDir,
    ".openaeon",
    "planner",
    `${params.targetSessionKey}.json`,
  );

  let release: (() => Promise<void>) | undefined;
  try {
    const lock = await acquireSessionWriteLock({ sessionFile: plannerFile, timeoutMs: 15_000 });
    release = lock.release;

    const plan = await loadTaskPlan({
      workspaceDir: params.workspaceDir,
      targetSessionKey: params.targetSessionKey,
    });
    const item = plan.todos.find((todo) => todo.id === params.taskId);
    if (!item) {
      return { ok: false, error: `Task ID ${params.taskId} not found.` };
    }

    const now = Date.now();
    const previousStatus = item.status;
    if (params.status) {
      assertValidStatusTransition(previousStatus, params.status);
      item.status = params.status;
    }

    if (typeof params.result === "string" && params.result.trim().length > 0) {
      item.result = params.result;
      item.lastProgressAt = now;
    }
    if (params.owner?.trim()) {
      item.owner = params.owner;
      item.ownerAgent = params.owner;
    }
    if (Array.isArray(params.acceptance)) {
      const nextAcceptance = params.acceptance.filter((entry) => entry.trim().length > 0);
      if (nextAcceptance.length > 0) {
        item.acceptance = nextAcceptance;
        item.acceptanceCriteria = nextAcceptance;
      }
    }
    if (Array.isArray(params.evidenceRefs)) {
      item.evidenceRefs = params.evidenceRefs.filter((entry) => entry.trim().length > 0);
    }
    if (typeof params.verifiedBy === "string" && params.verifiedBy.trim().length > 0) {
      item.verifiedBy = params.verifiedBy;
    }
    if (typeof params.closedAt === "number") {
      item.closedAt = params.closedAt;
    }
    if (params.note?.trim()) {
      item.lastProgressNote = params.note;
      item.lastProgressAt = now;
    }

    item.updatedAt = now;
    if (item.status === "in_progress") {
      if (previousStatus !== "in_progress") {
        item.startedAt = item.startedAt ?? now;
        item.attemptCount = (item.attemptCount ?? 0) + 1;
      }
      item.heartbeatAt = now;
    }
    if (item.status === "done") {
      item.completedAt = item.completedAt ?? now;
      item.heartbeatAt = now;
    }
    if (item.status === "verified") {
      item.heartbeatAt = now;
    }
    if (item.status === "closed") {
      item.closedAt = item.closedAt ?? now;
      item.heartbeatAt = now;
    }

    ensureClosureFields(item);

    await saveTaskPlan({
      workspaceDir: params.workspaceDir,
      targetSessionKey: params.targetSessionKey,
      plan,
    });
    return { ok: true, updated: item };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  } finally {
    if (release) {
      await release();
    }
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
  const sessionKey = options.agentSessionKey
    ? sanitizeSessionKey(options.agentSessionKey)
    : "default";

  return {
    label: "Task Planner",
    name: "write_todos",
    description:
      "Manage a strict closure-oriented task plan. Lifecycle: planned -> in_progress -> blocked|done -> verified -> closed.",
    parameters: TaskPlannerSchema,
    execute: async (_toolCallId, params) => {
      const action = readStringParam(params, "action", { required: true });
      const parentSessionKeyRaw = readStringParam(params, "parentSessionKey");
      const targetSessionKey = parentSessionKeyRaw
        ? sanitizeSessionKey(parentSessionKeyRaw)
        : sessionKey;
      const plannerFile = path.join(
        workspaceDir,
        ".openaeon",
        "planner",
        `${targetSessionKey}.json`,
      );

      let lockRelease: (() => Promise<void>) | undefined;
      try {
        const lock = await acquireSessionWriteLock({ sessionFile: plannerFile, timeoutMs: 15000 });
        lockRelease = lock.release;

        const loadPlan = async (): Promise<TaskPlan> =>
          await loadTaskPlan({ workspaceDir, targetSessionKey });
        const savePlan = async (plan: TaskPlan) =>
          await saveTaskPlan({ workspaceDir, targetSessionKey, plan });

        if (action === "create_plan") {
          const description = readStringParam(params, "description", { required: true });
          const plan: TaskPlan = {
            description,
            todos: [],
            phase: "planning",
            updatedAt: Date.now(),
            closureStatus: "open",
          };
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
            const doneCount = plan.todos.filter((t) => t.status === "closed").length;
            const total = plan.todos.length;
            const items = plan.todos
              .map((t, i) => `${i + 1}. ${t.title} ${STATUS_ICON[t.status]}`)
              .join(" | ");
            return jsonResult({
              status: "ok",
              digest: `TODO[${doneCount}/${total} closed]: ${items}`,
              plan,
            });
          }
          return jsonResult({ status: "ok", plan });
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
        prunePlaceholderTodos(plan);

        if (action === "add_todo") {
          const title = readStringParam(params, "title", { required: true });
          if (isPlaceholderTodoTitle(title)) {
            return jsonResult({
              status: "ignored",
              reason: "placeholder_todo_title",
              plan,
            });
          }
          const now = Date.now();
          const owner =
            readStringParam(params, "owner") ||
            readStringParam(params, "ownerAgent") ||
            targetSessionKey;
          const acceptance = readStringArrayParam(params, "acceptance") ||
            readStringArrayParam(params, "acceptanceCriteria") || [
              "Provide result with evidence refs",
            ];
          const item: TodoItem = {
            id: crypto.randomUUID().substring(0, 8),
            title,
            status: "planned",
            owner,
            ownerAgent: owner,
            dependsOn: readStringArrayParam(params, "dependsOn"),
            acceptance,
            acceptanceCriteria: acceptance,
            evidenceRefs: readStringArrayParam(params, "evidenceRefs") || [],
            verifiedBy: readStringParam(params, "verifiedBy"),
            closedAt: readNumberParam(params, "closedAt", { min: 0 }),
            outputSchema: readStringParam(params, "outputSchema"),
            riskLevel: readStringParam(params, "riskLevel") as TodoItem["riskLevel"] | undefined,
            mergeKey: readStringParam(params, "mergeKey"),
            retryLimit: readNumberParam(params, "retryLimit", { min: 0, max: 10 }),
            createdAt: now,
            updatedAt: now,
            attemptCount: 0,
          };
          ensureClosureFields({ ...item, status: "planned" });
          plan.todos.push(item);
          await savePlan(plan);
          return jsonResult({ status: "ok", added: item, plan });
        }

        if (action === "update_todo") {
          const taskId = readStringParam(params, "taskId", { required: true });
          const nextStatusRaw = readStringParam(params, "status");
          const nextStatus = nextStatusRaw ? normalizeTodoStatus(nextStatusRaw) : undefined;
          const updateResult = await updateTaskPlannerTodo({
            workspaceDir,
            targetSessionKey,
            taskId,
            status: nextStatus,
            result: readStringParam(params, "result"),
            owner: readStringParam(params, "owner") || readStringParam(params, "ownerAgent"),
            acceptance:
              readStringArrayParam(params, "acceptance") ||
              readStringArrayParam(params, "acceptanceCriteria"),
            evidenceRefs: readStringArrayParam(params, "evidenceRefs"),
            verifiedBy: readStringParam(params, "verifiedBy"),
            closedAt: readNumberParam(params, "closedAt", { min: 0 }),
          });
          if (!updateResult.ok) {
            throw new ToolInputError(updateResult.error);
          }
          const nextPlan = await loadPlan();
          return jsonResult({ status: "ok", updated: updateResult.updated, plan: nextPlan });
        }

        if (action === "touch_todo") {
          const taskId = readStringParam(params, "taskId", { required: true });
          const note = readStringParam(params, "note");
          const update = await updateTaskPlannerTodo({
            workspaceDir,
            targetSessionKey,
            taskId,
            note,
          });
          if (!update.ok) {
            throw new ToolInputError(update.error);
          }
          const nextPlan = await loadPlan();
          return jsonResult({
            status: "ok",
            touched: {
              id: update.updated.id,
              heartbeatAt: update.updated.heartbeatAt,
              lastProgressAt: update.updated.lastProgressAt,
            },
            plan: nextPlan,
          });
        }

        if (action === "complete_plan" || action === "close_plan") {
          const gaps = extractPlanGaps(plan);
          if (gaps.failed.length > 0 || gaps.missingEvidence.length > 0) {
            plan.closureStatus = "open";
            plan.closureGaps = gaps;
            await savePlan(plan);
            return jsonResult({
              status: "closure_blocked",
              message:
                "Plan cannot be closed. Some todos are not verified or missing acceptance/evidence.",
              gaps,
              plan,
            });
          }

          const now = Date.now();
          for (const todo of plan.todos) {
            if (todo.status === "verified") {
              todo.status = "closed";
              todo.closedAt = now;
              todo.updatedAt = now;
            }
            ensureClosureFields(todo);
          }
          plan.phase = "complete";
          plan.closureStatus = "closed";
          plan.closureGaps = undefined;

          const sinkGaps: string[] = [];
          try {
            const { distillMemory } = await import("./memory-distill-tool.js");
            await distillMemory({ workspaceDir });
          } catch (err) {
            sinkGaps.push(`distill_failed:${err instanceof Error ? err.message : String(err)}`);
          }
          try {
            await upsertClosureSkill({ workspaceDir, plan, targetSessionKey });
          } catch (err) {
            sinkGaps.push(
              `skills_upsert_failed:${err instanceof Error ? err.message : String(err)}`,
            );
          }

          if (sinkGaps.length > 0) {
            plan.closureStatus = "closed_with_gaps";
            plan.closureGaps = {
              failed: sinkGaps,
              missingEvidence: [],
              nextActions: ["下次 heartbeat 优先补齐沉淀阶段失败项"],
            };
          }

          await savePlan(plan);
          return jsonResult({
            status: "ok",
            message: "Plan closed with strong closure checks.",
            closureStatus: plan.closureStatus,
            plan,
          });
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
