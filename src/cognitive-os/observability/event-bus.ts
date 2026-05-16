import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type CognitiveEvent = {
  id: string;
  stream: string;
  taskId: string;
  runId: string;
  at: number;
  payload: Record<string, unknown>;
};

const EVENT_STORE: CognitiveEvent[] = [];
let EVENT_STORE_FILE: string | null = null;

function defaultEventFile(workspaceDir: string): string {
  return path.join(workspaceDir, ".openaeon", "cognitive", "events", "events.jsonl");
}

export function configureCognitiveEventStore(workspaceDir: string): void {
  const nextFile = defaultEventFile(workspaceDir);
  if (EVENT_STORE_FILE === nextFile) return;
  EVENT_STORE_FILE = nextFile;
  EVENT_STORE.length = 0;

  try {
    const raw = fs.readFileSync(nextFile, "utf-8");
    const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as CognitiveEvent;
        if (
          parsed &&
          typeof parsed.id === "string" &&
          typeof parsed.taskId === "string" &&
          typeof parsed.runId === "string" &&
          typeof parsed.stream === "string"
        ) {
          EVENT_STORE.push(parsed);
        }
      } catch {
        // Ignore malformed lines and keep loading.
      }
    }
  } catch {
    // Missing file is expected for fresh workspaces.
  }
}

export function publishCognitiveEvent(params: Omit<CognitiveEvent, "id" | "at">): CognitiveEvent {
  const event: CognitiveEvent = {
    id: crypto.randomUUID(),
    at: Date.now(),
    ...params,
  };
  EVENT_STORE.push(event);
  if (EVENT_STORE_FILE) {
    try {
      fs.mkdirSync(path.dirname(EVENT_STORE_FILE), { recursive: true });
      fs.appendFileSync(EVENT_STORE_FILE, `${JSON.stringify(event)}\n`, "utf-8");
    } catch {
      // Best-effort persistence. Runtime should not fail on telemetry writes.
    }
  }
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
