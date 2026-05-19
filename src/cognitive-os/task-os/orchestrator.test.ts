import { describe, it, expect, vi, beforeEach } from "vitest";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { TaskOrchestrator } from "./orchestrator.js";
import { readTaskRecord, writeTaskRecord } from "./store.js";
import { CognitiveAgentLoop } from "../runtime/agent-loop.js";
import { dispatchCognitiveNodeToSubagent } from "../runtime/subagent-runtime-adapter.js";
import { CognitiveTaskRecord } from "./types.js";

vi.mock("./store.js", () => ({
  readTaskRecord: vi.fn(),
  writeTaskRecord: vi.fn(),
  listTaskRecords: vi.fn(),
  taskLockFile: vi.fn(() => "/tmp/lock"),
}));
vi.mock("../runtime/agent-loop.js", () => ({
  CognitiveAgentLoop: vi.fn(function MockCognitiveAgentLoop(this: { run: unknown }) {
    this.run = vi.fn();
  }),
}));
vi.mock("../runtime/subagent-runtime-adapter.js", () => ({
  dispatchCognitiveNodeToSubagent: vi.fn(),
}));
vi.mock("../../infra/file-lock.js", () => ({
  withFileLock: (_: string, __: any, fn: () => any) => fn(),
}));

describe("TaskOrchestrator (Fractal & Parallel)", () => {
  const mockAgentLoopRun = vi.fn();
  let workspace: string;
  let orchestrator: TaskOrchestrator;

  function useStatefulRecord(initial: CognitiveTaskRecord | null = null) {
    let current = initial;
    vi.mocked(readTaskRecord).mockImplementation(async () => current);
    vi.mocked(writeTaskRecord).mockImplementation(async (_baseDir, record) => {
      current = record;
    });
    return {
      get current() {
        return current;
      },
      set current(next: CognitiveTaskRecord | null) {
        current = next;
      },
    };
  }

  function makeRecord(
    overrides: Partial<CognitiveTaskRecord> & Pick<CognitiveTaskRecord, "id" | "status" | "tree">,
  ): CognitiveTaskRecord {
    return {
      sessionKey: "session-1",
      title: "Test Task",
      input: "test",
      reflections: [],
      runIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockAgentLoopRun.mockReset();
    vi.mocked(CognitiveAgentLoop).mockImplementation(function MockCognitiveAgentLoop(this: {
      run: unknown;
    }) {
      this.run = mockAgentLoopRun;
    } as unknown as typeof CognitiveAgentLoop);
    workspace = path.join(os.tmpdir(), `aeon-test-${crypto.randomUUID()}`);
    orchestrator = new TaskOrchestrator(workspace);
    vi.mocked(dispatchCognitiveNodeToSubagent).mockResolvedValue({ accepted: false });
  });

  function mockAgentLoopDispatch(output: string, score = 0.9) {
    mockAgentLoopRun.mockResolvedValue({
      source: "cognitive_dispatch",
      memorySynced: true,
      dispatch: {
        winner: {
          output,
          score,
          provider: "gpt",
          model: "v1",
          latencyMs: 10,
          reason: "test",
        },
        candidates: [],
        degraded: false,
      },
    });
  }

  it("submits directly into execute through legal autopilot transitions", async () => {
    const state = useStatefulRecord();

    const submitted = await orchestrator.submit({
      sessionKey: "session-1",
      title: "Autopilot Task",
      text: "Implement one thing",
    });

    expect(submitted.status.phase).toBe("EXECUTE");
    expect(state.current?.status.phase).toBe("EXECUTE");
    const phases = vi.mocked(writeTaskRecord).mock.calls.map((call) => call[1].status.phase);
    expect(phases).toContain("INIT");
    expect(phases).toContain("PLAN");
    expect(phases).toContain("EXECUTE");
  });

  it("should dispatch non-dependent nodes in parallel", async () => {
    const mockRecord: CognitiveTaskRecord = {
      id: "task-1",
      sessionKey: "session-1",
      title: "Test Task",
      input: "test",
      status: { phase: "EXECUTE", updatedAt: Date.now() },
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
    mockAgentLoopDispatch("done");

    const results = await orchestrator.executeReadyNodes("task-1");

    // node-1 and node-2 should be dispatched
    expect(results.length).toBe(2);
    expect(mockAgentLoopRun).toHaveBeenCalledTimes(2);
    expect(mockAgentLoopRun).toHaveBeenCalledWith(expect.objectContaining({ nodeId: "node-1" }));
    expect(mockAgentLoopRun).toHaveBeenCalledWith(expect.objectContaining({ nodeId: "node-2" }));
  });

  it("should delegate ready nodes to subagents when accepted", async () => {
    const mockRecord: CognitiveTaskRecord = {
      id: "task-subagent",
      sessionKey: "session-1",
      title: "Subagent Task",
      input: "test",
      status: { phase: "EXECUTE", updatedAt: Date.now() },
      tree: {
        rootId: "root",
        nodes: {
          root: {
            id: "root",
            title: "root",
            depth: 0,
            status: "in_progress",
            children: ["node-1"],
            dependsOn: [],
            artifacts: [],
            acceptanceCriteria: [],
            priority: 1,
            ownerRole: "DevAgent",
          },
          "node-1": {
            id: "node-1",
            title: "Implement feature",
            depth: 1,
            status: "todo",
            children: [],
            dependsOn: [],
            artifacts: [],
            acceptanceCriteria: ["feature works"],
            priority: 1,
            ownerRole: "QAAgent",
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
    vi.mocked(dispatchCognitiveNodeToSubagent).mockResolvedValue({
      accepted: true,
      runId: "subagent-run-1",
      childSessionKey: "agent:qa:subagent:1",
    });

    await orchestrator.executeReadyNodes("task-subagent");

    expect(mockAgentLoopRun).not.toHaveBeenCalled();
    const saved = vi
      .mocked(writeTaskRecord)
      .mock.calls.map((call) => call[1])
      .find((record) => record.tree.nodes["node-1"]?.metadata?.dispatchMode === "subagent");
    expect(saved?.tree.nodes["node-1"].status).toBe("in_progress");
    expect(saved?.tree.nodes["node-1"].metadata).toEqual(
      expect.objectContaining({
        subagentRunId: "subagent-run-1",
        childSessionKey: "agent:qa:subagent:1",
        ownerRole: "QAAgent",
      }),
    );
  });

  it("should trigger decomposition when agent output has [ACTION: DECOMPOSE]", async () => {
    const mockRecord: CognitiveTaskRecord = {
      id: "task-2",
      sessionKey: "session-1",
      title: "Decomp Task",
      input: "decompose me",
      status: { phase: "EXECUTE", updatedAt: Date.now() },
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
    mockAgentLoopDispatch("I need more steps. [ACTION: DECOMPOSE] 1. First; 2. Second");

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

  describe("Recovery & Resilience", () => {
    it("advances to reflection when all executable child nodes are terminal", async () => {
      const record = makeRecord({
        id: "complete-1",
        status: { phase: "EXECUTE", updatedAt: Date.now() },
        tree: {
          rootId: "root",
          nodes: {
            root: {
              id: "root",
              title: "root",
              depth: 0,
              status: "todo",
              children: ["node-1"],
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
              status: "done",
              children: [],
              dependsOn: [],
              artifacts: ["run:1"],
              acceptanceCriteria: ["done"],
              priority: 1,
              ownerRole: "DevAgent",
            },
          },
        },
      });
      const state = useStatefulRecord(record);

      await orchestrator.executeReadyNodes("complete-1");

      expect(state.current?.status.phase).toBe("REFLECT");
    });

    it("retries failed dispatcher output with backoff before exhausting", async () => {
      const record = makeRecord({
        id: "retry-1",
        status: { phase: "EXECUTE", updatedAt: Date.now() },
        tree: {
          rootId: "node-1",
          nodes: {
            "node-1": {
              id: "node-1",
              title: "Retry Node",
              depth: 0,
              status: "todo",
              children: [],
              dependsOn: [],
              artifacts: [],
              acceptanceCriteria: ["passes"],
              priority: 1,
              ownerRole: "DevAgent",
            },
          },
        },
      });
      const state = useStatefulRecord(record);
      mockAgentLoopDispatch("not enough evidence", 0.1);

      await orchestrator.executeReadyNodes("retry-1");

      const node = state.current?.tree.nodes["node-1"];
      expect(node?.status).toBe("todo");
      expect(node?.metadata?.retryCount).toBe(1);
      expect(typeof node?.metadata?.nextRetryAt).toBe("number");
    });

    it("recovers stale delegated nodes after their lease expires", async () => {
      const record = makeRecord({
        id: "delegated-stale-1",
        status: { phase: "EXECUTE", updatedAt: Date.now() - 200_000 },
        updatedAt: Date.now() - 200_000,
        tree: {
          rootId: "node-1",
          nodes: {
            "node-1": {
              id: "node-1",
              title: "Delegated Node",
              depth: 0,
              status: "in_progress",
              children: [],
              dependsOn: [],
              artifacts: [],
              acceptanceCriteria: [],
              priority: 1,
              ownerRole: "DevAgent",
              metadata: {
                dispatchMode: "subagent",
                leaseExpiresAt: Date.now() - 1,
                updatedAt: Date.now() - 200_000,
              },
            },
          },
        },
      });
      const state = useStatefulRecord(record);
      (orchestrator as any).activeTaskIds.add("delegated-stale-1");

      await (orchestrator as any).tick();

      expect(state.current?.tree.nodes["node-1"].status).toBe("todo");
    });

    it("force starts a selected node despite dependencies and retry backoff", async () => {
      const record = makeRecord({
        id: "force-1",
        status: { phase: "EXECUTE", updatedAt: Date.now() },
        tree: {
          rootId: "root",
          nodes: {
            root: {
              id: "root",
              title: "root",
              depth: 0,
              status: "in_progress",
              children: ["dep", "node-1"],
              dependsOn: [],
              artifacts: [],
              acceptanceCriteria: [],
              priority: 1,
              ownerRole: "DevAgent",
            },
            dep: {
              id: "dep",
              title: "Dependency",
              depth: 1,
              status: "todo",
              children: [],
              dependsOn: [],
              artifacts: [],
              acceptanceCriteria: ["dep"],
              priority: 1,
              ownerRole: "DevAgent",
            },
            "node-1": {
              id: "node-1",
              title: "Forced Node",
              depth: 1,
              status: "todo",
              children: [],
              dependsOn: ["dep"],
              artifacts: [],
              acceptanceCriteria: ["forced"],
              priority: 1,
              ownerRole: "DevAgent",
              metadata: { nextRetryAt: Date.now() + 60_000 },
            },
          },
        },
      });
      const state = useStatefulRecord(record);
      mockAgentLoopDispatch("done");

      await orchestrator.forceStartNode("force-1", "node-1");

      expect(mockAgentLoopRun).toHaveBeenCalledWith(expect.objectContaining({ nodeId: "node-1" }));
      expect(state.current?.tree.nodes["node-1"].status).toBe("done");
    });

    it("should reset orphaned in_progress nodes during bootstrap", async () => {
      const orphanedRecord: CognitiveTaskRecord = {
        id: "orphaned-1",
        sessionKey: "session-1",
        title: "Orphaned Task",
        input: "test",
        status: { phase: "EXECUTE", updatedAt: Date.now() },
        tree: {
          rootId: "node-1",
          nodes: {
            "node-1": {
              id: "node-1",
              title: "Stuck Node",
              depth: 0,
              status: "in_progress",
              children: [],
              dependsOn: [],
              artifacts: [],
              acceptanceCriteria: [],
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

      const { listTaskRecords: listMock, writeTaskRecord: writeMock } = await import("./store.js");
      vi.mocked(listMock).mockResolvedValue([orphanedRecord]);

      await orchestrator.bootstrap();

      // Should have been reset and saved
      expect(writeMock).toHaveBeenCalled();
      const saved = (writeMock as any).mock.calls[0][1] as CognitiveTaskRecord;
      expect(saved.tree.nodes["node-1"].status).toBe("todo");
    });

    it("should reconcile stale nodes during tick", async () => {
      const staleRecord: CognitiveTaskRecord = {
        id: "stale-1",
        sessionKey: "session-1",
        title: "Stale Task",
        input: "test",
        status: { phase: "EXECUTE", updatedAt: Date.now() },
        tree: {
          rootId: "node-1",
          nodes: {
            "node-1": {
              id: "node-1",
              title: "Stale Node",
              depth: 0,
              status: "in_progress",
              children: [],
              dependsOn: [],
              artifacts: [],
              acceptanceCriteria: [],
              priority: 1,
              ownerRole: "DevAgent",
            },
          },
        },
        reflections: [],
        runIds: [],
        createdAt: Date.now() - 200000, // Very old
        updatedAt: Date.now() - 200000, // Very old
        version: 1,
      };

      const { readTaskRecord: readMock, writeTaskRecord: writeMock } = await import("./store.js");
      vi.mocked(readMock).mockResolvedValue(staleRecord);

      // We need to inject the taskId into activeTaskIds for tick to process it
      (orchestrator as any).activeTaskIds.add("stale-1");

      await (orchestrator as any).tick();

      // Should have detected stale node and reset it
      expect(writeMock).toHaveBeenCalled();
      const saved = (writeMock as any).mock.calls[0][1] as CognitiveTaskRecord;
      expect(saved.tree.nodes["node-1"].status).toBe("todo");
    });
  });
});
