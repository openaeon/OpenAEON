import crypto from "node:crypto";

export type CognitiveEvent = {
  id: string;
  stream: string;
  taskId: string;
  runId: string;
  at: number;
  payload: Record<string, unknown>;
};

const EVENT_STORE: CognitiveEvent[] = [];

export function publishCognitiveEvent(params: Omit<CognitiveEvent, "id" | "at">): CognitiveEvent {
  const event: CognitiveEvent = {
    id: crypto.randomUUID(),
    at: Date.now(),
    ...params,
  };
  EVENT_STORE.push(event);
  return event;
}

export function queryCognitiveEvents(params: {
  taskId?: string;
  runId?: string;
  stream?: string;
  limit?: number;
}): CognitiveEvent[] {
  const limit = Math.max(1, Math.min(1000, params.limit ?? 200));
  const filtered = EVENT_STORE.filter((entry) => {
    if (params.taskId && entry.taskId !== params.taskId) return false;
    if (params.runId && entry.runId !== params.runId) return false;
    if (params.stream && entry.stream !== params.stream) return false;
    return true;
  });
  return filtered.slice(-limit);
}
