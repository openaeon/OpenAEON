import { describe, expect, it, vi } from "vitest";
import type { CognitiveTaskRecord } from "../types.ts";
import type { CognitiveState } from "./cognitive.ts";
import {
  dispatchCognitiveTask,
  formatCognitiveSourceLineSidebar,
  loadCognitiveTask,
  queryCognitiveMemory,
  readCognitiveSourceContext,
  reflectCognitiveTask,
  replayCognitiveTask,
  runCognitiveDream,
  submitCognitiveTask,
  transitionCognitiveTask,
} from "./cognitive.ts";

function buildTask(overrides: Partial<CognitiveTaskRecord> = {}): CognitiveTaskRecord {
  return {
    id: "task-1",
    sessionKey: "main",
    title: "Cognitive task",
    input: "input",
    status: {
      phase: "PLAN",
      updatedAt: Date.now(),
      reason: "test",
    },
    tree: {
      rootId: "root-1",
      nodes: {
        "root-1": {
          id: "root-1",
          title: "Root",
          dependsOn: [],
          children: [],
          status: "todo",
          priority: 1,
          acceptanceCriteria: [],
          artifacts: [],
        },
      },
    },
    reflections: [],
    runIds: ["run-1"],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
    ...overrides,
  };
}

function createState() {
  const request = vi.fn();
  const state: CognitiveState = {
    client: {
      request,
    } as unknown as CognitiveState["client"],
    connected: true,
    sessionKey: "main",
    cognitiveTaskRecord: null,
    cognitiveTaskList: [],
    cognitiveSelectedTaskId: null,
    cognitiveRuntimeEvents: [],
    sandboxCognitivePlan: null,
    cognitiveMemoryQuery: "",
    cognitiveMemoryTags: "",
    cognitiveMemoryResults: null,
    cognitiveLoading: false,
    cognitiveMemoryLoading: false,
  };
  return { state, request };
}

describe("cognitive controller", () => {
  it("loads list and selected task runtime", async () => {
    const { state, request } = createState();
    const taskA = buildTask({ id: "task-a", sessionKey: "other" });
    const taskB = buildTask({ id: "task-b", sessionKey: "main" });

    request
      .mockResolvedValueOnce({ ok: true, tasks: [taskA, taskB] })
      .mockResolvedValueOnce({
        ok: true,
        task: taskB,
        cognitivePlan: { description: "input", todos: [] },
        runtime: { events: [{ id: "e1" }] },
      });

    await loadCognitiveTask(state);

    expect(request).toHaveBeenNthCalledWith(1, "cognitive.task.list", { limit: 50 });
    expect(request).toHaveBeenNthCalledWith(2, "cognitive.task.read", {
      taskId: "task-b",
    });
    expect(state.cognitiveSelectedTaskId).toBe("task-b");
    expect(state.cognitiveTaskRecord?.id).toBe("task-b");
    expect(state.cognitiveRuntimeEvents).toHaveLength(1);
    expect(state.cognitiveLoading).toBe(false);
  });

  it("submits task then refreshes state", async () => {
    const { state, request } = createState();
    const task = buildTask();

    request
      .mockResolvedValueOnce({ ok: true, task })
      .mockResolvedValueOnce({ ok: true, tasks: [task] })
      .mockResolvedValueOnce({ ok: true, task, cognitivePlan: null, runtime: { events: [] } });

    const submitted = await submitCognitiveTask(state, {
      title: "Lifecycle",
      text: "Run end-to-end",
    });

    expect(submitted?.id).toBe("task-1");
    expect(request).toHaveBeenNthCalledWith(1, "cognitive.task.submit", {
      sessionKey: "main",
      title: "Lifecycle",
      text: "Run end-to-end",
    });
    expect(state.cognitiveSelectedTaskId).toBe("task-1");
  });

  it("calls transition/dispatch/dream/reflect with selected task and reloads", async () => {
    const { state, request } = createState();
    const task = buildTask();
    state.cognitiveTaskRecord = task;
    state.cognitiveSelectedTaskId = task.id;

    const okTask = { ok: true, task };
    request
      .mockResolvedValueOnce(okTask)
      .mockResolvedValueOnce({ ok: true, tasks: [task] })
      .mockResolvedValueOnce({ ok: true, task, cognitivePlan: null, runtime: { events: [] } })
      .mockResolvedValueOnce(okTask)
      .mockResolvedValueOnce({ ok: true, tasks: [task] })
      .mockResolvedValueOnce({ ok: true, task, cognitivePlan: null, runtime: { events: [] } })
      .mockResolvedValueOnce(okTask)
      .mockResolvedValueOnce({ ok: true, tasks: [task] })
      .mockResolvedValueOnce({ ok: true, task, cognitivePlan: null, runtime: { events: [] } })
      .mockResolvedValueOnce({ ok: true, reflection: { id: "r1" } })
      .mockResolvedValueOnce({ ok: true, tasks: [task] })
      .mockResolvedValueOnce({ ok: true, task, cognitivePlan: null, runtime: { events: [] } });

    await transitionCognitiveTask(state, "EXECUTE", "ui:execute");
    await dispatchCognitiveTask(state);
    await runCognitiveDream(state);
    await reflectCognitiveTask(state, { output: "ok", success: true });

    expect(request).toHaveBeenCalledWith("cognitive.task.transition", {
      taskId: "task-1",
      to: "EXECUTE",
      reason: "ui:execute",
    });
    expect(request).toHaveBeenCalledWith("cognitive.runtime.dispatch", { taskId: "task-1" });
    expect(request).toHaveBeenCalledWith("cognitive.cognition.dream.run", { taskId: "task-1" });
    expect(request).toHaveBeenCalledWith("cognitive.cognition.reflect", {
      taskId: "task-1",
      nodeId: undefined,
      output: "ok",
      success: true,
    });
  });

  it("queries memory, replays run, reads source context and formats selected line", async () => {
    const { state, request } = createState();
    const task = buildTask();
    state.cognitiveTaskRecord = task;
    state.cognitiveSelectedTaskId = task.id;

    request
      .mockResolvedValueOnce({
        ok: true,
        evolution: [
          {
            id: "m1",
            taskId: "task-1",
            category: "optimization_strategy",
            content: "x",
            tags: [],
            createdAt: Date.now(),
          },
        ],
        longTerm: [],
      })
      .mockResolvedValueOnce({ ok: true, events: [{ id: "e1" }] })
      .mockResolvedValueOnce({
        ok: true,
        source: {
          path: "src/file.ts",
          startLine: 4,
          endLine: 6,
          contextStartLine: 2,
          contextEndLine: 8,
          lineCount: 120,
          excerpt: [">    4 | const x = 1;", "     5 | run();", "     6 | return;"].join("\n"),
        },
      });

    const mem = await queryCognitiveMemory(state, {
      query: "x",
      tags: ["a"],
      limit: 25,
      maxResults: 6,
    });
    const replay = await replayCognitiveTask(state, "run-1", 200);
    const source = await readCognitiveSourceContext(state, {
      path: "src/file.ts",
      startLine: 4,
      endLine: 6,
      contextLines: 3,
    });

    expect(mem?.evolution).toHaveLength(1);
    expect(replay).toHaveLength(1);
    expect(source?.path).toBe("src/file.ts");

    const sidebar = formatCognitiveSourceLineSidebar({
      result: {
        text: "const x = 1",
        source: "memory",
        score: 0.91,
        path: "src/file.ts",
        startLine: 4,
        endLine: 6,
      },
      source: source!,
      lineNo: 5,
    });
    expect(sidebar).toContain("Selected line: `5`");
    expect(sidebar).toContain("Nearby Context");
  });
});
