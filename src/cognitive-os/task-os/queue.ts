import fs from "node:fs/promises";
import path from "node:path";
import { withFileLock } from "../../infra/file-lock.js";
import type { TaskNode } from "../contracts/types.js";
import { COGNITIVE_POLICY } from "./policy.js";

export type QueueEntry = {
  key: string;
  taskId: string;
  nodeId: string;
  priority: number;
  status: "pending" | "claimed";
  attempts: number;
  claimOwner?: string;
  leaseUntil?: number;
  lastHeartbeatAt?: number;
  createdAt: number;
  updatedAt: number;
};

type QueueState = {
  version: 1;
  entries: Record<string, QueueEntry>;
};

function queueFile(baseDir: string): string {
  return path.join(baseDir, "queue.json");
}

function queueLockFile(baseDir: string): string {
  return path.join(baseDir, "queue.lock");
}

function entryKey(taskId: string, nodeId: string): string {
  return `${taskId}:${nodeId}`;
}

async function readQueueState(baseDir: string): Promise<QueueState> {
  try {
    const raw = await fs.readFile(queueFile(baseDir), "utf-8");
    const parsed = JSON.parse(raw) as QueueState;
    if (parsed && parsed.version === 1 && parsed.entries && typeof parsed.entries === "object") {
      return parsed;
    }
  } catch {
    // ignore and re-init
  }
  return { version: 1, entries: {} };
}

async function writeQueueState(baseDir: string, state: QueueState): Promise<void> {
  await fs.mkdir(baseDir, { recursive: true });
  await fs.writeFile(queueFile(baseDir), JSON.stringify(state, null, 2), "utf-8");
}

async function withQueueState<T>(
  baseDir: string,
  fn: (state: QueueState) => Promise<T>,
): Promise<T> {
  return await withFileLock(queueLockFile(baseDir), COGNITIVE_POLICY.LOCK_OPTIONS, async () => {
    const state = await readQueueState(baseDir);
    const result = await fn(state);
    await writeQueueState(baseDir, state);
    return result;
  });
}

function releaseExpiredClaims(state: QueueState, now: number): void {
  for (const key of Object.keys(state.entries)) {
    const entry = state.entries[key];
    if (entry.status === "claimed" && (entry.leaseUntil ?? 0) <= now) {
      state.entries[key] = {
        ...entry,
        status: "pending",
        claimOwner: undefined,
        leaseUntil: undefined,
        updatedAt: now,
      };
    }
  }
}

export async function reconcileTaskQueue(
  baseDir: string,
  params: {
    taskId: string;
    nodes: TaskNode[];
  },
): Promise<void> {
  const now = Date.now();
  await withQueueState(baseDir, async (state) => {
    releaseExpiredClaims(state, now);

    const nodeById = new Map(params.nodes.map((node) => [node.id, node]));

    for (const key of Object.keys(state.entries)) {
      const entry = state.entries[key];
      if (entry.taskId !== params.taskId) continue;
      const node = nodeById.get(entry.nodeId);
      if (!node) {
        delete state.entries[key];
        continue;
      }
      if (node.status === "done" || node.status === "failed" || node.status === "blocked") {
        delete state.entries[key];
        continue;
      }
      if (entry.status === "pending") {
        state.entries[key] = {
          ...entry,
          priority: node.priority,
          updatedAt: now,
        };
      }
    }

    for (const node of params.nodes) {
      if (node.status !== "todo") continue;
      const ready = node.dependsOn.every((depId) => nodeById.get(depId)?.status === "done");
      if (!ready) continue;
      const key = entryKey(params.taskId, node.id);
      const existing = state.entries[key];
      if (!existing) {
        state.entries[key] = {
          key,
          taskId: params.taskId,
          nodeId: node.id,
          priority: node.priority,
          status: "pending",
          attempts: 0,
          createdAt: now,
          updatedAt: now,
        };
      }
    }
  });
}

export async function claimTaskNodes(
  baseDir: string,
  params: {
    taskId: string;
    owner: string;
    maxCount: number;
    leaseMs?: number;
  },
): Promise<QueueEntry[]> {
  const now = Date.now();
  const leaseMs = params.leaseMs ?? COGNITIVE_POLICY.DEFAULT_NODE_LEASE_MS;

  return await withQueueState(baseDir, async (state) => {
    releaseExpiredClaims(state, now);

    const candidates = Object.values(state.entries)
      .filter((entry) => entry.taskId === params.taskId && entry.status === "pending")
      .toSorted((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return a.createdAt - b.createdAt;
      })
      .slice(0, Math.max(1, params.maxCount));

    const claimed: QueueEntry[] = [];
    for (const entry of candidates) {
      const next: QueueEntry = {
        ...entry,
        status: "claimed",
        claimOwner: params.owner,
        leaseUntil: now + leaseMs,
        attempts: entry.attempts + 1,
        updatedAt: now,
      };
      state.entries[entry.key] = next;
      claimed.push(next);
    }

    return claimed;
  });
}

export async function heartbeatTaskClaim(
  baseDir: string,
  params: {
    key: string;
    owner: string;
    leaseMs?: number;
  },
): Promise<boolean> {
  const now = Date.now();
  const leaseMs = params.leaseMs ?? COGNITIVE_POLICY.DEFAULT_NODE_LEASE_MS;
  return await withQueueState(baseDir, async (state) => {
    const entry = state.entries[params.key];
    if (!entry || entry.status !== "claimed" || entry.claimOwner !== params.owner) {
      return false;
    }
    state.entries[params.key] = {
      ...entry,
      leaseUntil: now + leaseMs,
      lastHeartbeatAt: now,
      updatedAt: now,
    };
    return true;
  });
}

export async function completeTaskClaim(
  baseDir: string,
  params: {
    key: string;
    owner: string;
  },
): Promise<void> {
  await withQueueState(baseDir, async (state) => {
    const entry = state.entries[params.key];
    if (!entry) return;
    if (entry.status === "claimed" && entry.claimOwner !== params.owner) return;
    delete state.entries[params.key];
  });
}

export async function queueStats(
  baseDir: string,
  taskId?: string,
): Promise<{ pending: number; claimed: number }> {
  const state = await readQueueState(baseDir);
  let pending = 0;
  let claimed = 0;
  for (const entry of Object.values(state.entries)) {
    if (taskId && entry.taskId !== taskId) continue;
    if (entry.status === "pending") pending += 1;
    if (entry.status === "claimed") claimed += 1;
  }
  return { pending, claimed };
}
