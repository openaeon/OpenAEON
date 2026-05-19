import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CognitiveTaskRecord } from "../task-os/types.js";
import { CognitiveSqliteStore } from "./sqlite-store.js";

describe("CognitiveSqliteStore", () => {
  const workspaces: string[] = [];

  afterEach(async () => {
    await Promise.all(
      workspaces.map((workspace) => fs.rm(workspace, { recursive: true, force: true })),
    );
    workspaces.length = 0;
  });

  it("indexes tasks, events, artifacts, and trajectories for FTS search", () => {
    const workspace = path.join(os.tmpdir(), `openaeon-cognitive-store-${Date.now()}`);
    workspaces.push(workspace);
    const store = new CognitiveSqliteStore(workspace);
    const task: CognitiveTaskRecord = {
      id: "task-1",
      sessionKey: "main",
      title: "Build retrieval bridge",
      input: "Create an indexed cognitive store",
      status: { phase: "EXECUTE", updatedAt: 2 },
      tree: {
        rootId: "node-1",
        nodes: {
          "node-1": {
            id: "node-1",
            title: "Index SQLite artifacts",
            dependsOn: [],
            children: [],
            depth: 0,
            status: "done",
            priority: 1,
            acceptanceCriteria: ["FTS query finds artifacts"],
            artifacts: ["artifact:sqlite"],
          },
        },
      },
      reflections: [],
      runIds: ["run-1"],
      createdAt: 1,
      updatedAt: 2,
      version: 1,
    };

    store.indexTask(task);
    store.indexEvent({
      id: "event-1",
      taskId: "task-1",
      runId: "run-1",
      stream: "runtime_dispatch",
      at: 3,
      payload: { message: "indexed event" },
    });
    store.indexTrajectory({
      format: "openaeon-cognitive-trajectory",
      version: 1,
      taskId: "task-1",
      sessionKey: "main",
      phase: "DONE",
      completed: true,
      createdAt: 1,
      updatedAt: 4,
      conversations: [{ from: "human", value: "retrieval bridge" }],
      metadata: {
        title: "Build retrieval bridge",
        runIds: ["run-1"],
        nodeCount: 1,
        completedNodeCount: 1,
        failedNodeCount: 0,
        eventCount: 1,
        streams: { runtime_dispatch: 1 },
      },
    });

    expect(store.search("retrieval", 10).some((row) => row.taskId === "task-1")).toBe(true);
    expect(store.search("indexed", 10).some((row) => row.kind === "event")).toBe(true);
    expect(store.search("retrieval-bridge:", 10).some((row) => row.taskId === "task-1")).toBe(true);
    store.close();
  });
});
