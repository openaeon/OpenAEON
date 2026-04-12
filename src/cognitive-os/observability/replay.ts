import type { TaskReplayEvent } from "../contracts/types.js";
import { queryCognitiveEvents } from "./event-bus.js";

export function replayRun(params: {
  taskId: string;
  runId: string;
  limit?: number;
}): TaskReplayEvent[] {
  return queryCognitiveEvents({
    taskId: params.taskId,
    runId: params.runId,
    limit: params.limit,
  }).map((entry) => ({
    id: entry.id,
    taskId: entry.taskId,
    runId: entry.runId,
    at: entry.at,
    stream: entry.stream,
    payload: entry.payload,
  }));
}
