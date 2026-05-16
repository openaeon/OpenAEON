import { afterEach, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { TaskNode } from "../contracts/types.js";
import { COGNITIVE_POLICY } from "./policy.js";
import { claimTaskNodes, reconcileTaskQueue, queueStats } from "./queue.js";

function queueDir(workspaceDir: string): string {
  return path.join(workspaceDir, ".openaeon", "cognitive", "queue");
}

function buildNode(input: {
  id: string;
  status: TaskNode["status"];
  dependsOn?: string[];
}): TaskNode {
  return {
    id: input.id,
    title: input.id,
    depth: 1,
    status: input.status,
    children: [],
    dependsOn: input.dependsOn ?? [],
    artifacts: [],
    acceptanceCriteria: [],
    priority: 1,
    ownerRole: "DevAgent",
  };
}

describe("task queue reconcile", () => {
  const workspaces: string[] = [];

  afterEach(async () => {
    await Promise.all(
      workspaces.map((workspace) => fs.rm(workspace, { recursive: true, force: true })),
    );
    workspaces.length = 0;
  });

  it("does not enqueue blocked todo nodes when dependencies are not ready", async () => {
    const workspace = path.join(os.tmpdir(), `aeon-queue-${crypto.randomUUID()}`);
    workspaces.push(workspace);
    const baseDir = queueDir(workspace);
    const prevSpeculative = COGNITIVE_POLICY.AGGRESSIVE_AUTOPILOT.SPECULATIVE_DISPATCH;
    COGNITIVE_POLICY.AGGRESSIVE_AUTOPILOT.SPECULATIVE_DISPATCH = false;
    try {
      await reconcileTaskQueue(baseDir, {
        taskId: "task-1",
        nodes: [
          buildNode({ id: "dep", status: "todo" }),
          buildNode({ id: "child", status: "todo", dependsOn: ["dep"] }),
        ],
      });

      const stats = await queueStats(baseDir, "task-1");
      expect(stats.pending).toBe(1);
      const claims = await claimTaskNodes(baseDir, {
        taskId: "task-1",
        owner: "test",
        maxCount: 5,
      });
      expect(claims.map((entry) => entry.nodeId)).toEqual(["dep"]);
    } finally {
      COGNITIVE_POLICY.AGGRESSIVE_AUTOPILOT.SPECULATIVE_DISPATCH = prevSpeculative;
    }
  });

  it("enqueues dependent node when speculative dispatch is enabled and dependency is in progress", async () => {
    const workspace = path.join(os.tmpdir(), `aeon-queue-${crypto.randomUUID()}`);
    workspaces.push(workspace);
    const baseDir = queueDir(workspace);
    const prevSpeculative = COGNITIVE_POLICY.AGGRESSIVE_AUTOPILOT.SPECULATIVE_DISPATCH;
    COGNITIVE_POLICY.AGGRESSIVE_AUTOPILOT.SPECULATIVE_DISPATCH = true;
    try {
      await reconcileTaskQueue(baseDir, {
        taskId: "task-2",
        nodes: [
          buildNode({ id: "dep", status: "in_progress" }),
          buildNode({ id: "child", status: "todo", dependsOn: ["dep"] }),
        ],
      });

      const claims = await claimTaskNodes(baseDir, {
        taskId: "task-2",
        owner: "test",
        maxCount: 5,
      });
      expect(claims.map((entry) => entry.nodeId)).toEqual(["child"]);
    } finally {
      COGNITIVE_POLICY.AGGRESSIVE_AUTOPILOT.SPECULATIVE_DISPATCH = prevSpeculative;
    }
  });

  it("releases expired claims back to pending", async () => {
    const workspace = path.join(os.tmpdir(), `aeon-queue-${crypto.randomUUID()}`);
    workspaces.push(workspace);
    const baseDir = queueDir(workspace);

    await reconcileTaskQueue(baseDir, {
      taskId: "task-3",
      nodes: [buildNode({ id: "node-1", status: "todo" })],
    });
    const claimed = await claimTaskNodes(baseDir, {
      taskId: "task-3",
      owner: "test",
      maxCount: 1,
      leaseMs: 1,
    });
    expect(claimed).toHaveLength(1);

    await new Promise((resolve) => setTimeout(resolve, 5));
    await reconcileTaskQueue(baseDir, {
      taskId: "task-3",
      nodes: [buildNode({ id: "node-1", status: "todo" })],
    });

    expect(await queueStats(baseDir, "task-3")).toEqual({ pending: 1, claimed: 0 });
  });

  it("waits until nextRetryAt before re-enqueueing retry nodes", async () => {
    const workspace = path.join(os.tmpdir(), `aeon-queue-${crypto.randomUUID()}`);
    workspaces.push(workspace);
    const baseDir = queueDir(workspace);
    const retryNode = buildNode({ id: "node-1", status: "todo" });

    await reconcileTaskQueue(baseDir, {
      taskId: "task-4",
      nodes: [
        {
          ...retryNode,
          metadata: { nextRetryAt: Date.now() + 60_000 },
        },
      ],
    });
    expect(await queueStats(baseDir, "task-4")).toEqual({ pending: 0, claimed: 0 });

    await reconcileTaskQueue(baseDir, {
      taskId: "task-4",
      nodes: [
        {
          ...retryNode,
          metadata: { nextRetryAt: Date.now() - 1 },
        },
      ],
    });
    expect(await queueStats(baseDir, "task-4")).toEqual({ pending: 1, claimed: 0 });
  });
});
