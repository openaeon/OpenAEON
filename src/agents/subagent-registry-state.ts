import {
  loadSubagentRegistryFromDisk,
  saveSubagentRegistryToDisk,
} from "./subagent-registry.store.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import type { SubagentRunRecord } from "./subagent-registry.types.js";

const log = createSubsystemLogger("subagent-registry-state");
const MAX_PERSIST_RETRIES = 5;
const BASE_PERSIST_RETRY_MS = 250;
const MAX_PERSIST_RETRY_MS = 4_000;

let pendingPersistSnapshot: Map<string, SubagentRunRecord> | null = null;
let persistRetryCount = 0;
let persistRetryTimer: NodeJS.Timeout | null = null;

function cloneRuns(runs: Map<string, SubagentRunRecord>) {
  return new Map(runs.entries());
}

function clearPersistRetryTimer() {
  if (!persistRetryTimer) {
    return;
  }
  clearTimeout(persistRetryTimer);
  persistRetryTimer = null;
}

function computeRetryDelayMs(retryCount: number) {
  const exponent = Math.max(0, retryCount - 1);
  return Math.min(BASE_PERSIST_RETRY_MS * 2 ** exponent, MAX_PERSIST_RETRY_MS);
}

function tryPersistSnapshot(snapshot: Map<string, SubagentRunRecord>) {
  try {
    saveSubagentRegistryToDisk(snapshot);
    return true;
  } catch (err) {
    log.warn(`subagent registry persist failed: ${String(err)}`);
    return false;
  }
}

function schedulePersistRetry() {
  if (persistRetryTimer || !pendingPersistSnapshot) {
    return;
  }
  const delayMs = computeRetryDelayMs(persistRetryCount);
  persistRetryTimer = setTimeout(() => {
    persistRetryTimer = null;
    if (!pendingPersistSnapshot) {
      return;
    }
    const snapshot = pendingPersistSnapshot;
    if (tryPersistSnapshot(snapshot)) {
      pendingPersistSnapshot = null;
      persistRetryCount = 0;
      return;
    }
    persistRetryCount += 1;
    if (persistRetryCount > MAX_PERSIST_RETRIES) {
      log.error("subagent registry persist retries exhausted; dropping pending snapshot");
      pendingPersistSnapshot = null;
      persistRetryCount = 0;
      return;
    }
    schedulePersistRetry();
  }, delayMs);
  persistRetryTimer.unref?.();
}

export function persistSubagentRunsToDisk(runs: Map<string, SubagentRunRecord>) {
  const snapshot = cloneRuns(runs);
  // When retries are already queued, keep only the latest snapshot.
  if (persistRetryTimer || pendingPersistSnapshot) {
    pendingPersistSnapshot = snapshot;
    return;
  }
  if (tryPersistSnapshot(snapshot)) {
    return;
  }
  pendingPersistSnapshot = snapshot;
  persistRetryCount = 1;
  schedulePersistRetry();
}

export function restoreSubagentRunsFromDisk(params: {
  runs: Map<string, SubagentRunRecord>;
  mergeOnly?: boolean;
}) {
  const restored = loadSubagentRegistryFromDisk();
  if (restored.size === 0) {
    return 0;
  }
  let added = 0;
  for (const [runId, entry] of restored.entries()) {
    if (!runId || !entry) {
      continue;
    }
    if (params.mergeOnly && params.runs.has(runId)) {
      continue;
    }
    params.runs.set(runId, entry);
    added += 1;
  }
  return added;
}

export async function flushSubagentRegistryPersistenceForTests() {
  clearPersistRetryTimer();
  while (pendingPersistSnapshot) {
    const snapshot = pendingPersistSnapshot;
    if (tryPersistSnapshot(snapshot)) {
      pendingPersistSnapshot = null;
      persistRetryCount = 0;
      return;
    }
    persistRetryCount += 1;
    if (persistRetryCount > MAX_PERSIST_RETRIES) {
      pendingPersistSnapshot = null;
      persistRetryCount = 0;
      return;
    }
  }
}

export function resetSubagentRegistryPersistenceStateForTests() {
  clearPersistRetryTimer();
  pendingPersistSnapshot = null;
  persistRetryCount = 0;
}

export function getSubagentRunsSnapshotForRead(
  inMemoryRuns: Map<string, SubagentRunRecord>,
): Map<string, SubagentRunRecord> {
  const merged = new Map<string, SubagentRunRecord>();
  const shouldReadDisk = !(process.env.VITEST || process.env.NODE_ENV === "test");
  if (shouldReadDisk) {
    try {
      // Persisted state lets other worker processes observe active runs.
      for (const [runId, entry] of loadSubagentRegistryFromDisk().entries()) {
        merged.set(runId, entry);
      }
    } catch {
      // Ignore disk read failures and fall back to local memory.
    }
  }
  for (const [runId, entry] of inMemoryRuns.entries()) {
    merged.set(runId, entry);
  }
  return merged;
}
