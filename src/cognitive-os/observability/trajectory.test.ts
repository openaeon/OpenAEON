import { describe, expect, it } from "vitest";
import { buildCognitiveTrajectory } from "./trajectory.js";
import type { CognitiveTaskRecord } from "../task-os/types.js";

describe("buildCognitiveTrajectory", () => {
  it("converts a task record and replay events into a training-friendly trajectory", () => {
    const task: CognitiveTaskRecord = {
      id: "task-1",
      sessionKey: "main",
      title: "Ship feature",
      input: "Implement and verify a feature",
      status: { phase: "DONE", updatedAt: 2000, reason: "complete" },
      tree: {
        rootId: "root",
        nodes: {
          root: {
            id: "root",
            title: "Root",
            dependsOn: [],
            children: ["node-1"],
            depth: 0,
            status: "done",
            priority: 1,
            acceptanceCriteria: [],
            artifacts: [],
          },
          "node-1": {
            id: "node-1",
            title: "Implement feature",
            dependsOn: [],
            children: [],
            depth: 1,
            status: "done",
            priority: 1,
            ownerRole: "DevAgent",
            acceptanceCriteria: ["tests pass"],
            artifacts: ["subagent:run:run-1"],
          },
        },
      },
      reflections: [],
      runIds: ["run-1"],
      createdAt: 1000,
      updatedAt: 2000,
      version: 1,
    };

    const trajectory = buildCognitiveTrajectory({
      task,
      events: [
        {
          id: "event-1",
          taskId: "task-1",
          runId: "run-1",
          at: 1500,
          stream: "runtime_delegate",
          payload: { nodeId: "node-1", childSessionKey: "agent:main:subagent:1" },
        },
      ],
    });

    expect(trajectory.format).toBe("openaeon-cognitive-trajectory");
    expect(trajectory.completed).toBe(true);
    expect(trajectory.conversations.map((turn) => turn.from)).toEqual([
      "system",
      "human",
      "agent",
      "tool",
    ]);
    expect(trajectory.metadata.streams.runtime_delegate).toBe(1);
    expect(trajectory.metadata.completedNodeCount).toBe(2);
  });
});
