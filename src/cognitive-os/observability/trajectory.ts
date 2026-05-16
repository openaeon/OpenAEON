import type { TaskNode, TaskReplayEvent } from "../contracts/types.js";
import type { CognitiveTaskRecord } from "../task-os/types.js";

export type CognitiveTrajectoryTurn = {
  from: "system" | "human" | "agent" | "tool";
  value: string;
  at?: number;
  metadata?: Record<string, unknown>;
};

export type CognitiveTrajectory = {
  format: "openaeon-cognitive-trajectory";
  version: 1;
  taskId: string;
  sessionKey: string;
  phase: CognitiveTaskRecord["status"]["phase"];
  completed: boolean;
  createdAt: number;
  updatedAt: number;
  conversations: CognitiveTrajectoryTurn[];
  metadata: {
    title: string;
    runIds: string[];
    nodeCount: number;
    completedNodeCount: number;
    failedNodeCount: number;
    eventCount: number;
    streams: Record<string, number>;
  };
};

function summarizeNode(node: TaskNode): string {
  const criteria =
    node.acceptanceCriteria.length > 0
      ? `\nAcceptance:\n${node.acceptanceCriteria.map((entry) => `- ${entry}`).join("\n")}`
      : "";
  return [
    `Node ${node.id}: ${node.title}`,
    `Status: ${node.status}`,
    `Role: ${node.ownerRole ?? "DevAgent"}`,
    criteria,
  ]
    .filter(Boolean)
    .join("\n");
}

function eventToTurn(event: TaskReplayEvent): CognitiveTrajectoryTurn {
  const payload = JSON.stringify(event.payload, null, 2);
  if (event.stream.includes("dispatch") || event.stream.includes("delegate")) {
    return {
      from: "tool",
      value: `[${event.stream}]\n${payload}`,
      at: event.at,
      metadata: {
        stream: event.stream,
        runId: event.runId,
      },
    };
  }
  return {
    from: "agent",
    value: `[${event.stream}]\n${payload}`,
    at: event.at,
    metadata: {
      stream: event.stream,
      runId: event.runId,
    },
  };
}

export function buildCognitiveTrajectory(input: {
  task: CognitiveTaskRecord;
  events: TaskReplayEvent[];
}): CognitiveTrajectory {
  const nodes = Object.values(input.task.tree.nodes);
  const streams: Record<string, number> = {};
  for (const event of input.events) {
    streams[event.stream] = (streams[event.stream] ?? 0) + 1;
  }

  const systemTurn: CognitiveTrajectoryTurn = {
    from: "system",
    value: [
      "OpenAEON Cognitive OS execution trajectory.",
      `Phase: ${input.task.status.phase}`,
      `Reason: ${input.task.status.reason ?? "n/a"}`,
    ].join("\n"),
    at: input.task.createdAt,
  };
  const humanTurn: CognitiveTrajectoryTurn = {
    from: "human",
    value: input.task.input,
    at: input.task.createdAt,
    metadata: {
      title: input.task.title,
      sessionKey: input.task.sessionKey,
    },
  };
  const planTurn: CognitiveTrajectoryTurn = {
    from: "agent",
    value: nodes.map(summarizeNode).join("\n\n---\n\n"),
    at: input.task.updatedAt,
    metadata: {
      kind: "task_tree",
      rootId: input.task.tree.rootId,
    },
  };

  return {
    format: "openaeon-cognitive-trajectory",
    version: 1,
    taskId: input.task.id,
    sessionKey: input.task.sessionKey,
    phase: input.task.status.phase,
    completed: input.task.status.phase === "DONE",
    createdAt: input.task.createdAt,
    updatedAt: input.task.updatedAt,
    conversations: [systemTurn, humanTurn, planTurn, ...input.events.map(eventToTurn)],
    metadata: {
      title: input.task.title,
      runIds: input.task.runIds,
      nodeCount: nodes.length,
      completedNodeCount: nodes.filter((node) => node.status === "done").length,
      failedNodeCount: nodes.filter((node) => node.status === "failed").length,
      eventCount: input.events.length,
      streams,
    },
  };
}
