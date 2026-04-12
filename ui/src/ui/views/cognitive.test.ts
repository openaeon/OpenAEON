import { describe, expect, it } from "vitest";
import type { CognitiveTaskRecord } from "../types.ts";
import type { CognitiveLongTermEntry } from "../controllers/cognitive.ts";
import {
  formatMemoryResultSidebar,
  formatMemorySourceSidebar,
  renderCognitiveView,
  type CognitiveViewProps,
} from "./cognitive.ts";

function collectTemplateText(input: unknown): string {
  if (input == null) {
    return "";
  }
  if (typeof input === "string" || typeof input === "number" || typeof input === "boolean") {
    return String(input);
  }
  if (Array.isArray(input)) {
    return input.map((item) => collectTemplateText(item)).join(" ");
  }
  if (typeof input === "object" && "strings" in (input as Record<string, unknown>)) {
    const template = input as { strings: ReadonlyArray<string>; values?: unknown[] };
    return [
      template.strings.join(" "),
      ...(template.values ?? []).map((value) => collectTemplateText(value)),
    ].join(" ");
  }
  return "";
}

function buildTask(overrides: Partial<CognitiveTaskRecord> = {}): CognitiveTaskRecord {
  return {
    id: "task-1",
    sessionKey: "main",
    title: "Stabilize pipeline",
    input: "Do work",
    status: {
      phase: "PLAN",
      legacyPhase: "planning",
      updatedAt: Date.now(),
      reason: "ui",
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

function createProps(overrides: Partial<CognitiveViewProps> = {}): CognitiveViewProps {
  return {
    sessionKey: "main",
    taskPlan: null,
    cognitiveTask: null,
    cognitiveTaskList: [],
    cognitiveSelectedTaskId: null,
    cognitiveRuntimeEvents: [],
    cognitiveLegacyPlan: null,
    cognitiveSubmitTitle: "",
    cognitiveSubmitText: "",
    cognitiveMemoryQuery: "",
    cognitiveMemoryTags: "",
    cognitiveMemoryResults: null,
    cognitiveReplayRunId: null,
    cognitiveReplayEvents: [],
    cognitiveReplayLoading: false,
    cognitiveLoading: false,
    cognitiveMemoryLoading: false,
    cognitiveSourceContext: null,
    cognitiveSourceSelectedLine: null,
    sandboxChatEvents: {},
    aeonStatus: null,
    chatMessages: [],
    chatToolMessages: [],
    onRefresh: () => undefined,
    onSelectTask: () => undefined,
    onSubmitTask: () => undefined,
    onTransition: () => undefined,
    onDispatch: () => undefined,
    onDream: () => undefined,
    onReflect: () => undefined,
    onMemoryQueryChange: () => undefined,
    onMemoryTagsChange: () => undefined,
    onRunMemoryQuery: () => undefined,
    onSubmitTitleChange: () => undefined,
    onSubmitTextChange: () => undefined,
    onInspectMemoryResult: () => undefined,
    onTraceMemoryResult: () => undefined,
    onSourceLineSelect: () => undefined,
    onReplayRun: () => undefined,
    ...overrides,
  };
}

describe("cognitive view helpers", () => {
  it("formats memory result sidebar with core fields", () => {
    const result: CognitiveLongTermEntry = {
      text: "const value = 1;",
      source: "memory",
      score: 0.91,
      path: "src/runtime.ts",
      startLine: 11,
      endLine: 16,
      citation: "runtime:11-16",
    };

    const formatted = formatMemoryResultSidebar(result);
    expect(formatted).toContain("# Memory Match");
    expect(formatted).toContain("src/runtime.ts");
    expect(formatted).toContain("11-16");
    expect(formatted).toContain("runtime:11-16");
  });

  it("formats source sidebar with context details", () => {
    const result: CognitiveLongTermEntry = {
      text: "return output;",
      source: "memory",
      score: 0.78,
      path: "src/graph.ts",
      startLine: 20,
      endLine: 24,
    };
    const formatted = formatMemorySourceSidebar(result, {
      path: "src/graph.ts",
      startLine: 20,
      endLine: 24,
      contextStartLine: 18,
      contextEndLine: 29,
      lineCount: 240,
      excerpt: "> 20 | return output;",
    });

    expect(formatted).toContain("# Source Context");
    expect(formatted).toContain("src/graph.ts:20-24");
    expect(formatted).toContain("18-29");
    expect(formatted).toContain("Lines in file: `240`");
  });

  it("builds template for idle state", () => {
    const view = renderCognitiveView(createProps());
    const values = Array.from(view.values);
    const text = collectTemplateText(view);

    expect(values).toContain("idle");
    expect(text).toContain("Cognitive OS");
    expect(text).toContain("Task Composer");
    expect(text).toContain("Kernel Stream");
  });

  it("builds template for active task state", () => {
    const task = buildTask({
      title: "Execute migration",
      status: { phase: "EXECUTE", legacyPhase: "execution", updatedAt: Date.now() },
    });
    const view = renderCognitiveView(
      createProps({
        cognitiveTask: task,
        cognitiveTaskList: [task],
      }),
    );

    const values = Array.from(view.values);
    expect(values).toContain("live_run");
    expect(values).toContain("LIVE_RUN");
  });

  it("includes source foldout content when source context exists", () => {
    const view = renderCognitiveView(
      createProps({
        cognitiveSourceContext: {
          path: "src/source.ts",
          startLine: 10,
          endLine: 12,
          contextStartLine: 8,
          contextEndLine: 14,
          lineCount: 50,
          excerpt: ["> 10 | run();", "  11 | done();", "  12 | return;"].join("\n"),
        },
      }),
    );

    const text = collectTemplateText(view);
    expect(text).toContain("src/source.ts");
    expect(text).toContain("Source Context");
  });
});
