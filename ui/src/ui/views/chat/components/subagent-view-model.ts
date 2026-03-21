import type {
  GatewaySessionRow,
  SandboxChatEvents,
  SubagentStatus,
  SubagentViewModel,
} from "../../../types.ts";
import type { TaskPlanSnapshot } from "../../sandbox.ts";

type PlanTodo = NonNullable<TaskPlanSnapshot["todos"]>[number];
type SessionMatchMode = "owner_first" | "balanced" | "fuzzy";

const PLACEHOLDER_TITLE_PATTERNS = [
  /^agent\s*\d+\s*:\s*待定任务\d*$/i,
  /^代理\s*\d+\s*:\s*待定任务\d*$/i,
  /待定任务\d*/i,
];

const PLACEHOLDER_HINT_PATTERNS = [/占位任务/i, /无需执行/i, /placeholder/i];

let lastDebugFingerprint = "";

function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function includesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function resolveOwnerAlias(ownerAgent: string): string {
  const normalized = ownerAgent.trim();
  if (!normalized) {
    return normalized;
  }
  return normalized.toLowerCase();
}

function tokenize(text: string): string[] {
  if (!text) {
    return [];
  }
  const asciiTokens = text
    .toLowerCase()
    .split(/[^a-z0-9:_-]+/g)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length >= 2);
  if (asciiTokens.length > 0) {
    return Array.from(new Set(asciiTokens));
  }
  const cjkTokens = text
    .replace(/\s+/g, "")
    .split("")
    .filter((ch) => ch.trim().length > 0);
  return Array.from(new Set(cjkTokens));
}

function overlapScore(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 || tokensB.length === 0) {
    return 0;
  }
  const setB = new Set(tokensB);
  let hits = 0;
  for (const token of tokensA) {
    if (setB.has(token)) {
      hits += 1;
    }
  }
  return hits;
}

function isPlaceholderText(title: string, detail: string): boolean {
  return includesAny(title, PLACEHOLDER_TITLE_PATTERNS) || includesAny(detail, PLACEHOLDER_HINT_PATTERNS);
}

export function isPlaceholderPlanTodo(todo: { title?: string; result?: string }): boolean {
  const title = normalize(todo.title);
  const result = normalize(todo.result);
  return isPlaceholderText(title, result);
}

export function isPlaceholderSessionRow(row: {
  label?: string;
  displayName?: string;
  subject?: string;
}): boolean {
  const label = `${normalize(row.label)} ${normalize(row.displayName)}`.trim();
  const subject = normalize(row.subject);
  return isPlaceholderText(label, subject);
}

export function getVisiblePlanTodos(plan: TaskPlanSnapshot | null | undefined): PlanTodo[] {
  const todos = Array.isArray(plan?.todos) ? plan.todos : [];
  return todos.filter((todo) => !isPlaceholderPlanTodo(todo));
}

function resolveTodoStatus(params: {
  todo: PlanTodo;
  readySet: ReadonlySet<string>;
  blockedSet: ReadonlySet<string>;
  lastEvent?: string;
}): SubagentStatus {
  const { todo, readySet, blockedSet, lastEvent } = params;
  if (todo.status === "done") {
    return "done";
  }
  if (blockedSet.has(todo.id)) {
    return "blocked";
  }
  if (todo.status === "in_progress") {
    return "in_progress";
  }
  if (readySet.has(todo.id)) {
    return "ready";
  }
  if (normalize(lastEvent)) {
    return "in_progress";
  }
  return "idle";
}

function shouldDebugSubagentModel(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("debugSubagentSidebar") === "1";
  } catch {
    return false;
  }
}

function resolveSessionMatchMode(params?: { matchMode?: SessionMatchMode }): SessionMatchMode {
  if (params?.matchMode) {
    return params.matchMode;
  }
  if (typeof window !== "undefined") {
    try {
      const query = new URLSearchParams(window.location.search).get("subagentMatchMode");
      if (query === "owner_first" || query === "balanced" || query === "fuzzy") {
        return query;
      }
    } catch {
      // ignore URL parsing failures
    }
  }
  return "balanced";
}

function scoreSessionForTodo(params: {
  todo: PlanTodo;
  row: GatewaySessionRow;
  matchMode: SessionMatchMode;
  usedSessionKeys: ReadonlySet<string>;
  hasOwnerBoundChoice: boolean;
  events: SandboxChatEvents;
}): number {
  const { todo, row, matchMode, usedSessionKeys, hasOwnerBoundChoice, events } = params;
  const owner = resolveOwnerAlias(todo.ownerAgent ?? "");
  const key = normalize(row.key).toLowerCase();
  const label = `${normalize(row.label)} ${normalize(row.displayName)}`.toLowerCase();
  const subject = normalize(row.subject).toLowerCase();
  const title = normalize(todo.title).toLowerCase();

  let score = 0;

  if (owner) {
    if (key === owner) {
      score += 1000;
    } else if (key.includes(owner)) {
      score += 420;
    } else if (label.includes(owner)) {
      score += 320;
    }
  }

  const titleTokens = tokenize(title);
  const subjectTokens = tokenize(subject);
  const labelTokens = tokenize(label);
  const subjectOverlap = overlapScore(titleTokens, subjectTokens);
  const labelOverlap = overlapScore(titleTokens, labelTokens);
  score += Math.min(220, subjectOverlap * (matchMode === "fuzzy" ? 40 : 28));
  score += Math.min(120, labelOverlap * (matchMode === "owner_first" ? 16 : 24));

  if (title && subject && (subject.includes(title) || title.includes(subject))) {
    score += 140;
  }
  if (title && label && (label.includes(title) || title.includes(label))) {
    score += 80;
  }

  if (events[row.key]) {
    score += 40;
  }

  const updatedAt = typeof row.updatedAt === "number" ? row.updatedAt : 0;
  if (updatedAt > 0) {
    const ageMs = Date.now() - updatedAt;
    if (ageMs < 2 * 60_000) {
      score += 18;
    } else if (ageMs < 15 * 60_000) {
      score += 10;
    }
  }

  if (usedSessionKeys.has(row.key) && !hasOwnerBoundChoice) {
    score -= matchMode === "fuzzy" ? 40 : 70;
  }

  if (matchMode === "owner_first" && owner && score < 300) {
    score -= 120;
  }

  return score;
}

function resolveSessionForTodoWithStrategy(params: {
  todo: PlanTodo;
  sessions: GatewaySessionRow[];
  matchMode: SessionMatchMode;
  usedSessionKeys: ReadonlySet<string>;
  events: SandboxChatEvents;
}): GatewaySessionRow | undefined {
  const { todo, sessions, matchMode, usedSessionKeys, events } = params;
  if (sessions.length === 0) {
    return undefined;
  }
  const owner = resolveOwnerAlias(todo.ownerAgent ?? "");
  const hasOwnerBoundChoice = Boolean(
    owner &&
      sessions.some((row) => {
        const key = normalize(row.key).toLowerCase();
        const label = `${normalize(row.label)} ${normalize(row.displayName)}`.toLowerCase();
        return key === owner || key.includes(owner) || label.includes(owner);
      }),
  );
  let best: GatewaySessionRow | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const row of sessions) {
    const score = scoreSessionForTodo({
      todo,
      row,
      matchMode,
      usedSessionKeys,
      hasOwnerBoundChoice,
      events,
    });
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }
  return bestScore > 0 ? best : undefined;
}

function calculateTodoDepth(
  todoId: string,
  blockedBy: Record<string, string[]>,
  memo: Map<string, number>,
  visited: Set<string>,
): number {
  if (memo.has(todoId)) {
    return memo.get(todoId)!;
  }
  if (visited.has(todoId)) {
    return 1; // Cycle detected, fallback
  }
  visited.add(todoId);
  const deps = blockedBy[todoId] || [];
  if (deps.length === 0) {
    memo.set(todoId, 1);
    return 1;
  }
  let maxDepDepth = 0;
  for (const depId of deps) {
    maxDepDepth = Math.max(maxDepDepth, calculateTodoDepth(depId, blockedBy, memo, visited));
  }
  const depth = maxDepDepth + 1;
  memo.set(todoId, depth);
  return depth;
}

export function buildSubagentViewModel(params: {
  taskPlan: TaskPlanSnapshot | null | undefined;
  sandboxChatEvents?: SandboxChatEvents;
  sessions?: GatewaySessionRow[];
  matchMode?: SessionMatchMode;
}): SubagentViewModel[] {
  const visibleTodos = getVisiblePlanTodos(params.taskPlan);
  if (visibleTodos.length === 0) {
    return [];
  }
  const graph = params.taskPlan?.executionGraph;
  const orderedIds = Array.isArray(graph?.orderedTodoIds) ? graph?.orderedTodoIds : [];
  const orderIndex = new Map<string, number>(orderedIds.map((id, idx) => [id, idx]));
  const readySet = new Set(graph?.readyTodoIds ?? []);
  const blockedSet = new Set(graph?.blockedTodoIds ?? []);
  const blockedBy = graph?.blockedBy ?? {};
  const sessions = (params.sessions ?? []).filter((row) => !isPlaceholderSessionRow(row));
  const events = params.sandboxChatEvents ?? {};
  const matchMode = resolveSessionMatchMode({ matchMode: params.matchMode });
  const usedSessionKeys = new Set<string>();

  const sortedTodos = [...visibleTodos].sort((a, b) => {
    const ai = orderIndex.get(a.id);
    const bi = orderIndex.get(b.id);
    if (ai == null && bi == null) {
      return 0;
    }
    if (ai == null) {
      return 1;
    }
    if (bi == null) {
      return -1;
    }
    return ai - bi;
  });

    const depthMemo = new Map<string, number>();
    const models = sortedTodos.map((todo) => {
      const session = resolveSessionForTodoWithStrategy({
        todo,
        sessions,
        matchMode,
        usedSessionKeys,
        events,
      });
      if (session) {
        usedSessionKeys.add(session.key);
      }
      const lastEvent = session ? events[session.key] : undefined;
      const depthRaw = calculateTodoDepth(todo.id, blockedBy, depthMemo, new Set());
      const depthLevel = Math.max(1, Math.min(4, depthRaw)) as 1 | 2 | 3 | 4;
      return {
        todoId: todo.id,
        ownerAgent: todo.ownerAgent,
        title: todo.title,
        status: resolveTodoStatus({ todo, readySet, blockedSet, lastEvent }),
        blockedBy: blockedBy[todo.id] ?? [],
        lastEvent,
        updatedAt: session?.updatedAt ?? null,
        model: session?.model,
        tokenUsage: (session?.totalTokens ?? session?.outputTokens) ?? undefined,
        depthLevel,
      } satisfies SubagentViewModel;
    });

  if (shouldDebugSubagentModel()) {
    const fingerprint = JSON.stringify({
      rawTodoCount: params.taskPlan?.todos?.length ?? 0,
      visibleTodoCount: visibleTodos.length,
      sessionCount: params.sessions?.length ?? 0,
      filteredSessionCount: sessions.length,
      vmCount: models.length,
      matchMode,
    });
    if (fingerprint !== lastDebugFingerprint) {
      lastDebugFingerprint = fingerprint;
      console.debug("[subagent-sidebar] vm", JSON.parse(fingerprint));
    }
  }

  return models;
}
