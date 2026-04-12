import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskOrchestrator } from "./orchestrator.js";
import { readTaskRecord, writeTaskRecord } from "./store.js";
import { dispatchAgentTask } from "../runtime/dispatcher.js";
import { CognitiveTaskRecord } from "./types.js";

vi.mock("./store.js");
vi.mock("../runtime/dispatcher.js");
vi.mock("../../infra/file-lock.js", () => ({
  withFileLock: (_: string, __: any, fn: () => any) => fn(),
}));

describe("TaskOrchestrator (Fractal & Parallel)", () => {
  const workspace = "/tmp/aeon-test";
  let orchestrator: TaskOrchestrator;

  beforeEach(() => {
    vi.clearAllMocks();
    orchestrator = new TaskOrchestrator(workspace);
  });

  it("should dispatch non-dependent nodes in parallel", async () => {
    const mockRecord: CognitiveTaskRecord = {
      id: "task-1",
      sessionKey: "session-1",
      title: "Test Task",
      input: "test",
      status: { phase: "EXECUTE", legacyPhase: "execution", updatedAt: Date.now() },
      tree: {
        rootId: "root",
        nodes: {
          root: {
            id: "root",
            title: "root",
            depth: 0,
            status: "in_progress",
            children: ["node-1", "node-2"],
            dependsOn: [],
            artifacts: [],
            acceptanceCriteria: [],
            priority: 1,
            ownerRole: "DevAgent",
          },
          "node-1": {
            id: "node-1",
            title: "Node 1",
            depth: 1,
            status: "todo",
            children: [],
            dependsOn: [],
            artifacts: [],
            acceptanceCriteria: ["test"],
            priority: 1,
            ownerRole: "DevAgent",
          },
          "node-2": {
            id: "node-2",
            title: "Node 2",
            depth: 1,
            status: "todo",
            children: [],
            dependsOn: [],
            artifacts: [],
            acceptanceCriteria: ["test"],
            priority: 1,
            ownerRole: "DevAgent",
          },
        },
      },
      reflections: [],
      runIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    vi.mocked(readTaskRecord).mockResolvedValue(mockRecord);
    vi.mocked(dispatchAgentTask).mockResolvedValue({
      winner: {
        output: "done",
        score: 0.9,
        provider: "gpt",
        model: "v1",
        latencyMs: 10,
        reason: "test",
      },
      candidates: [],
      degraded: false,
    });

    const results = await orchestrator.executeReadyNodes("task-1");

    // node-1 and node-2 should be dispatched
    expect(results.length).toBe(2);
    expect(dispatchAgentTask).toHaveBeenCalledTimes(2);
    expect(dispatchAgentTask).toHaveBeenCalledWith(expect.objectContaining({ nodeId: "node-1" }));
    expect(dispatchAgentTask).toHaveBeenCalledWith(expect.objectContaining({ nodeId: "node-2" }));
  });

  it("should trigger decomposition when agent output has [ACTION: DECOMPOSE]", async () => {
    const mockRecord: CognitiveTaskRecord = {
      id: "task-2",
      sessionKey: "session-1",
      title: "Decomp Task",
      input: "decompose me",
      status: { phase: "EXECUTE", legacyPhase: "execution", updatedAt: Date.now() },
      tree: {
        rootId: "root",
        nodes: {
          root: {
            id: "root",
            title: "root",
            depth: 0,
            status: "todo",
            children: [],
            dependsOn: [],
            artifacts: [],
            acceptanceCriteria: ["test"],
            priority: 1,
            ownerRole: "DevAgent",
          },
        },
      },
      reflections: [],
      runIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    vi.mocked(readTaskRecord).mockResolvedValue(mockRecord);
    vi.mocked(dispatchAgentTask).mockResolvedValue({
      winner: {
        output: "I need more steps. [ACTION: DECOMPOSE] 1. First; 2. Second",
        score: 0.9,
        provider: "gpt",
        model: "v1",
        latencyMs: 10,
        reason: "test",
      },
      candidates: [],
      degraded: false,
    });

    await orchestrator.executeReadyNodes("task-2");

    // The record should be updated with new child nodes
    const persistCall = vi
      .mocked(writeTaskRecord)
      .mock.calls.find((call) => Object.keys(call[1].tree.nodes).length > 1);
    expect(persistCall).toBeDefined();
    const updatedRecord = persistCall![1];
    expect(Object.keys(updatedRecord.tree.nodes).length).toBeGreaterThan(1);
    expect(updatedRecord.tree.nodes["root"].children.length).toBeGreaterThan(0);
    expect(updatedRecord.tree.nodes["root"].status).toBe("todo"); // Reset to todo for children
  });
});
