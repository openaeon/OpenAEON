import { afterEach, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  completeCognitiveNodeFromSubagent,
  extractCognitiveTaskLink,
} from "./subagent-writeback.js";
import { COGNITIVE_POLICY } from "./policy.js";
import { readTaskRecord, writeTaskRecord } from "./store.js";
import type { CognitiveTaskRecord } from "./types.js";

function taskStoreDir(workspaceDir: string): string {
  return path.join(workspaceDir, ".openaeon", "cognitive", "tasks");
}

describe("subagent Cognitive writeback", () => {
  const workspaces: string[] = [];

  afterEach(async () => {
    await Promise.all(
      workspaces.map((workspace) => fs.rm(workspace, { recursive: true, force: true })),
    );
    workspaces.length = 0;
  });

  it("extracts Cognitive linkage from shared context", () => {
    expect(
      extractCognitiveTaskLink({
        cognitiveTask: {
          taskId: "task-1",
          nodeId: "node-1",
          runId: "run-1",
          role: "DevAgent",
        },
      }),
    ).toEqual({
      taskId: "task-1",
      nodeId: "node-1",
      runId: "run-1",
      role: "DevAgent",
    });
  });

  it("ignores descendant parentCognitiveTask context to prevent duplicate parent writeback", () => {
    expect(
      extractCognitiveTaskLink({
        parentCognitiveTask: {
          taskId: "task-1",
          nodeId: "node-1",
          runId: "parent-run",
          role: "DevAgent",
        },
      }),
    ).toBeNull();
  });

  it("marks a delegated node done and advances execution to verify", async () => {
    const workspace = path.join(os.tmpdir(), `aeon-writeback-${crypto.randomUUID()}`);
    workspaces.push(workspace);
    const record: CognitiveTaskRecord = {
      id: "task-1",
      sessionKey: "session-1",
      title: "Delegated task",
      input: "Ship the feature",
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
            status: "in_progress",
            children: [],
            dependsOn: [],
            artifacts: [],
            acceptanceCriteria: ["feature works"],
            priority: 1,
            ownerRole: "DevAgent",
            metadata: {
              dispatchMode: "subagent",
              subagentRunId: "run-subagent",
            },
          },
        },
      },
      reflections: [],
      runIds: ["run-dispatch"],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };
    await writeTaskRecord(taskStoreDir(workspace), record);

    const updated = await completeCognitiveNodeFromSubagent({
      workspaceDir: workspace,
      taskId: "task-1",
      nodeId: "node-1",
      subagentRunId: "run-subagent",
      childSessionKey: "agent:main:subagent:1",
      outcome: { status: "ok" },
      outputText: "All acceptance checks passed.",
    });

    const persisted = await readTaskRecord(taskStoreDir(workspace), "task-1");
    expect(updated?.status.phase).toBe("VERIFY");
    expect(persisted?.tree.nodes["node-1"].status).toBe("done");
    expect(persisted?.tree.nodes["node-1"].artifacts).toEqual(
      expect.arrayContaining([
        "subagent:run:run-subagent",
        "subagent:session:agent:main:subagent:1",
      ]),
    );
    expect(persisted?.reflections).toHaveLength(1);
    expect(persisted?.runIds).toContain("run-subagent");
  });

  it("retries failed delegated nodes with backoff before exhaustion", async () => {
    const workspace = path.join(os.tmpdir(), `aeon-writeback-${crypto.randomUUID()}`);
    workspaces.push(workspace);
    const record: CognitiveTaskRecord = {
      id: "task-retry",
      sessionKey: "session-1",
      title: "Delegated retry task",
      input: "Ship the feature",
      status: { phase: "EXECUTE", updatedAt: Date.now() },
      tree: {
        rootId: "node-1",
        nodes: {
          "node-1": {
            id: "node-1",
            title: "Implement feature",
            depth: 0,
            status: "in_progress",
            children: [],
            dependsOn: [],
            artifacts: [],
            acceptanceCriteria: ["feature works"],
            priority: 1,
            ownerRole: "DevAgent",
            metadata: {
              dispatchMode: "subagent",
              subagentRunId: "run-subagent",
            },
          },
        },
      },
      reflections: [],
      runIds: ["run-dispatch"],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };
    await writeTaskRecord(taskStoreDir(workspace), record);

    const updated = await completeCognitiveNodeFromSubagent({
      workspaceDir: workspace,
      taskId: "task-retry",
      nodeId: "node-1",
      subagentRunId: "run-subagent",
      childSessionKey: "agent:main:subagent:1",
      outcome: { status: "error", error: "first failure" },
    });

    const node = updated?.tree.nodes["node-1"];
    expect(node?.status).toBe("todo");
    expect(node?.metadata?.retryCount).toBe(1);
    expect(typeof node?.metadata?.nextRetryAt).toBe("number");
    expect(updated?.status.phase).toBe("EXECUTE");
  });

  it("routes exhausted delegated failures through reflection", async () => {
    const workspace = path.join(os.tmpdir(), `aeon-writeback-${crypto.randomUUID()}`);
    workspaces.push(workspace);
    const record: CognitiveTaskRecord = {
      id: "task-exhausted",
      sessionKey: "session-1",
      title: "Delegated exhausted task",
      input: "Ship the feature",
      status: { phase: "EXECUTE", updatedAt: Date.now() },
      tree: {
        rootId: "node-1",
        nodes: {
          "node-1": {
            id: "node-1",
            title: "Implement feature",
            depth: 0,
            status: "in_progress",
            children: [],
            dependsOn: [],
            artifacts: [],
            acceptanceCriteria: ["feature works"],
            priority: 1,
            ownerRole: "DevAgent",
            metadata: {
              dispatchMode: "subagent",
              retryCount: COGNITIVE_POLICY.MAX_RETRIES - 1,
              subagentRunId: "run-subagent",
            },
          },
        },
      },
      reflections: [],
      runIds: ["run-dispatch"],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };
    await writeTaskRecord(taskStoreDir(workspace), record);

    const updated = await completeCognitiveNodeFromSubagent({
      workspaceDir: workspace,
      taskId: "task-exhausted",
      nodeId: "node-1",
      subagentRunId: "run-subagent",
      childSessionKey: "agent:main:subagent:1",
      outcome: { status: "error", error: "final failure" },
    });

    expect(updated?.tree.nodes["node-1"].status).toBe("failed");
    expect(updated?.status.phase).toBe("REFLECT");
  });
});
