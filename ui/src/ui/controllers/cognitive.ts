import type { GatewayBrowserClient } from "../gateway.ts";
import type { CognitiveTaskRecord } from "../types.ts";

export type CognitiveMemoryEntry = {
  id: string;
  taskId: string;
  category: "success_path" | "failure_case" | "optimization_strategy";
  content: string;
  tags: string[];
  runId?: string;
  createdAt: number;
};

export type CognitiveLongTermEntry = {
  text: string;
  source: string;
  score: number;
  path: string;
  startLine: number;
  endLine: number;
  citation?: string;
};

export type CognitiveSourceContext = {
  path: string;
  startLine: number;
  endLine: number;
  contextStartLine: number;
  contextEndLine: number;
  lineCount: number;
  excerpt: string;
};

export type CognitiveTaskEvent = {
  id: string;
  taskId: string;
  runId: string;
  at: number;
  stream: string;
  payload: Record<string, unknown>;
};

export type CognitiveMemoryQueryResult = {
  evolution: CognitiveMemoryEntry[];
  longTerm: CognitiveLongTermEntry[];
};

export type CognitiveState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  sessionKey: string;
  cognitiveTaskRecord: CognitiveTaskRecord | null;
  cognitiveTaskList: CognitiveTaskRecord[];
  cognitiveSelectedTaskId: string | null;
  cognitiveRuntimeEvents: CognitiveTaskEvent[];
  cognitiveLegacyPlan: unknown | null;
  cognitiveMemoryQuery: string;
  cognitiveMemoryTags: string;
  cognitiveMemoryResults: CognitiveMemoryQueryResult | null;
  cognitiveLoading: boolean;
  cognitiveMemoryLoading: boolean;
};

type CognitiveTaskListResponse = {
  ok: boolean;
  tasks: CognitiveTaskRecord[];
};

type CognitiveTaskReadResponse = {
  ok: boolean;
  task: CognitiveTaskRecord | null;
  legacyPlan?: unknown;
  runtime?: {
    events?: CognitiveTaskEvent[];
  };
  error?: string;
};

type CognitiveTaskSubmitResponse = {
  ok: boolean;
  task: CognitiveTaskRecord;
};

type CognitiveMemoryQueryResponse = {
  ok: boolean;
  evolution: CognitiveMemoryEntry[];
  longTerm: CognitiveLongTermEntry[];
};

type CognitiveSourceReadResponse = {
  ok: boolean;
  source: CognitiveSourceContext;
};

function sortByFreshness(tasks: CognitiveTaskRecord[]): CognitiveTaskRecord[] {
  return [...tasks].sort((a, b) => b.updatedAt - a.updatedAt);
}

function chooseTask(
  state: CognitiveState,
  tasks: CognitiveTaskRecord[],
): CognitiveTaskRecord | null {
  if (tasks.length === 0) {
    return null;
  }
  const preferredId = state.cognitiveSelectedTaskId?.trim();
  if (preferredId) {
    const preferred = tasks.find((task) => task.id === preferredId);
    if (preferred) {
      return preferred;
    }
  }
  const sessionMatches = tasks.filter((task) => task.sessionKey === state.sessionKey.trim());
  if (sessionMatches.length > 0) {
    return sortByFreshness(sessionMatches)[0] ?? null;
  }
  return sortByFreshness(tasks)[0] ?? null;
}

async function readSelectedTask(state: CognitiveState, taskId: string): Promise<void> {
  if (!state.client) {
    return;
  }
  const res = await state.client.request<CognitiveTaskReadResponse>("cognitive.task.read", {
    taskId,
    includeLegacyPlan: true,
  });
  if (res?.ok) {
    state.cognitiveTaskRecord = res.task;
    state.cognitiveLegacyPlan = res.legacyPlan ?? null;
    state.cognitiveRuntimeEvents = Array.isArray(res.runtime?.events) ? res.runtime.events : [];
  } else {
    state.cognitiveTaskRecord = null;
    state.cognitiveLegacyPlan = null;
    state.cognitiveRuntimeEvents = [];
  }
}

export async function loadCognitiveTask(state: CognitiveState): Promise<void> {
  if (!state.client || !state.connected || !state.sessionKey) {
    return;
  }
  if (state.cognitiveLoading) {
    return;
  }
  state.cognitiveLoading = true;
  try {
    const listRes = await state.client.request<CognitiveTaskListResponse>("cognitive.task.list", {
      limit: 50,
    });
    const tasks = Array.isArray(listRes?.tasks) ? listRes.tasks : [];
    state.cognitiveTaskList = tasks;

    const selected = chooseTask(state, tasks);
    state.cognitiveSelectedTaskId = selected?.id ?? null;
    if (selected) {
      await readSelectedTask(state, selected.id);
    } else {
      state.cognitiveTaskRecord = null;
      state.cognitiveLegacyPlan = null;
      state.cognitiveRuntimeEvents = [];
    }
  } catch (err) {
    console.error("Failed to load cognitive task:", err);
  } finally {
    state.cognitiveLoading = false;
  }
}

export async function selectCognitiveTask(
  state: CognitiveState,
  taskId: string | null,
): Promise<void> {
  state.cognitiveSelectedTaskId = taskId;
  if (!taskId) {
    await loadCognitiveTask(state);
    return;
  }
  await readSelectedTask(state, taskId);
}

export async function submitCognitiveTask(
  state: CognitiveState,
  input: { title?: string; text: string },
): Promise<CognitiveTaskRecord | null> {
  if (!state.client || !state.connected || !state.sessionKey) {
    return null;
  }
  const text = input.text.trim();
  if (!text) {
    return null;
  }
  const res = await state.client.request<CognitiveTaskSubmitResponse>("cognitive.task.submit", {
    sessionKey: state.sessionKey,
    title: input.title?.trim() || undefined,
    text,
  });
  const task = res?.task ?? null;
  state.cognitiveSelectedTaskId = task?.id ?? null;
  await loadCognitiveTask(state);
  return task;
}

export async function transitionCognitiveTask(
  state: CognitiveState,
  to: "INIT" | "PLAN" | "EXECUTE" | "VERIFY" | "REFLECT" | "DONE" | "FAILED" | "ROLLED_BACK",
  reason?: string,
): Promise<CognitiveTaskRecord | null> {
  const taskId = state.cognitiveSelectedTaskId ?? state.cognitiveTaskRecord?.id ?? null;
  if (!state.client || !state.connected || !taskId) {
    return null;
  }
  const res = await state.client.request<{ ok: boolean; task: CognitiveTaskRecord }>(
    "cognitive.task.transition",
    {
      taskId,
      to,
      reason,
    },
  );
  await loadCognitiveTask(state);
  return res?.task ?? null;
}

export async function dispatchCognitiveTask(
  state: CognitiveState,
): Promise<CognitiveTaskRecord | null> {
  const taskId = state.cognitiveSelectedTaskId ?? state.cognitiveTaskRecord?.id ?? null;
  if (!state.client || !state.connected || !taskId) {
    return null;
  }
  const res = await state.client.request<{ ok: boolean; task: CognitiveTaskRecord }>(
    "cognitive.runtime.dispatch",
    { taskId },
  );
  await loadCognitiveTask(state);
  return res?.task ?? null;
}

export async function runCognitiveDream(
  state: CognitiveState,
): Promise<CognitiveTaskRecord | null> {
  const taskId = state.cognitiveSelectedTaskId ?? state.cognitiveTaskRecord?.id ?? null;
  if (!state.client || !state.connected || !taskId) {
    return null;
  }
  const res = await state.client.request<{ ok: boolean; task: CognitiveTaskRecord }>(
    "cognitive.cognition.dream.run",
    { taskId },
  );
  await loadCognitiveTask(state);
  return res?.task ?? null;
}

export async function reflectCognitiveTask(
  state: CognitiveState,
  input: { nodeId?: string; output: string; success?: boolean },
): Promise<Record<string, unknown> | null> {
  const taskId = state.cognitiveSelectedTaskId ?? state.cognitiveTaskRecord?.id ?? null;
  if (!state.client || !state.connected || !taskId) {
    return null;
  }
  const res = await state.client.request<{ ok: boolean; reflection: Record<string, unknown> }>(
    "cognitive.cognition.reflect",
    {
      taskId,
      nodeId: input.nodeId,
      output: input.output,
      success: input.success ?? true,
    },
  );
  await loadCognitiveTask(state);
  return res?.reflection ?? null;
}

export async function queryCognitiveMemory(
  state: CognitiveState,
  input: { query?: string; tags?: string[]; limit?: number; maxResults?: number },
): Promise<CognitiveMemoryQueryResult | null> {
  if (!state.client || !state.connected) {
    return null;
  }
  if (state.cognitiveMemoryLoading) {
    return state.cognitiveMemoryResults;
  }
  state.cognitiveMemoryLoading = true;
  try {
    const res = await state.client.request<CognitiveMemoryQueryResponse>("cognitive.memory.query", {
      taskId: state.cognitiveSelectedTaskId ?? state.cognitiveTaskRecord?.id ?? undefined,
      sessionKey: state.sessionKey,
      query: input.query?.trim() || undefined,
      tags: input.tags,
      limit: input.limit ?? 25,
      maxResults: input.maxResults ?? 6,
    });
    const next = {
      evolution: Array.isArray(res?.evolution) ? res.evolution : [],
      longTerm: Array.isArray(res?.longTerm) ? res.longTerm : [],
    };
    state.cognitiveMemoryResults = next;
    return next;
  } finally {
    state.cognitiveMemoryLoading = false;
  }
}

export async function replayCognitiveTask(
  state: CognitiveState,
  runId: string,
  limit = 200,
): Promise<Array<Record<string, unknown>> | null> {
  const taskId = state.cognitiveSelectedTaskId ?? state.cognitiveTaskRecord?.id ?? null;
  if (!state.client || !state.connected || !taskId || !runId.trim()) {
    return null;
  }
  const res = await state.client.request<{ ok: boolean; events: Array<Record<string, unknown>> }>(
    "cognitive.task.replay",
    {
      taskId,
      runId: runId.trim(),
      limit,
    },
  );
  return Array.isArray(res?.events) ? res.events : null;
}

export async function readCognitiveSourceContext(
  state: CognitiveState,
  input: {
    path: string;
    startLine: number;
    endLine: number;
    contextLines?: number;
  },
): Promise<CognitiveSourceContext | null> {
  if (!state.client || !state.connected) {
    return null;
  }
  const path = input.path.trim();
  if (!path) {
    return null;
  }
  const res = await state.client.request<CognitiveSourceReadResponse>("cognitive.source.read", {
    path,
    startLine: input.startLine,
    endLine: input.endLine,
    contextLines: input.contextLines ?? 5,
  });
  return res?.source ?? null;
}

export function formatCognitiveSourceLineSidebar(params: {
  result: CognitiveLongTermEntry;
  source: CognitiveSourceContext;
  lineNo: number;
}): string {
  const excerptLines = params.source.excerpt
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .map((line) => {
      const match = line.match(/^([ >])\s+(\d+)\s+\|\s?(.*)$/);
      if (!match) {
        return null;
      }
      return {
        isMatch: match[1] === ">",
        lineNo: Number(match[2]),
        content: match[3] ?? "",
      };
    })
    .filter((line): line is { isMatch: boolean; lineNo: number; content: string } => line != null);
  const selectedLine = Math.max(
    params.source.contextStartLine,
    Math.min(params.source.contextEndLine, Math.floor(params.lineNo)),
  );
  const selectedIndex = excerptLines.findIndex((line) => line.lineNo === selectedLine);
  const selectedText = selectedIndex >= 0 ? (excerptLines[selectedIndex]?.content ?? "") : "";
  const contextSlice =
    selectedIndex >= 0
      ? excerptLines.slice(
          Math.max(0, selectedIndex - 2),
          Math.min(excerptLines.length, selectedIndex + 3),
        )
      : [];
  const citation = params.result.citation?.trim();
  return [
    `# Source Line`,
    ``,
    `- Path: \`${params.source.path}\``,
    `- Selected line: \`${selectedLine}\``,
    `- Match range: \`${params.result.startLine}-${params.result.endLine}\``,
    `- Source score: \`${params.result.score.toFixed(2)}\``,
    citation ? `- Citation: \`${citation}\`` : null,
    ``,
    `## Selected`,
    `\`\`\`text`,
    selectedText || "(line not available in current context)",
    `\`\`\``,
    ``,
    ...(contextSlice.length > 0
      ? [
          `## Nearby Context`,
          `\`\`\`text`,
          ...contextSlice.map(
            (line) =>
              `${line.lineNo === selectedLine ? ">" : " "} ${String(line.lineNo).padStart(4, " ")} | ${line.content}`,
          ),
          `\`\`\``,
          ``,
        ]
      : []),
    `## Context`,
    `The source panel stays synchronized with the selected line so you can inspect nearby code and trace it back to a task node.`,
  ]
    .filter((line): line is string => line != null)
    .join("\n");
}
