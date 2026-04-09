import os from "node:os";
import path from "node:path";
import { resolveStateDir } from "../../config/paths.js";
import { loadJsonFile, saveJsonFile } from "../../infra/json-file.js";
import type { RunRecord, RunState, TerminationReason } from "./types.js";

const STORE_VERSION = 1 as const;

type PersistedRunRegistry = {
  version: typeof STORE_VERSION;
  runs: RunRecord[];
};

const RUN_STATES: RunState[] = ["starting", "running", "exiting", "exited"];
const TERMINATION_REASONS: TerminationReason[] = [
  "manual-cancel",
  "overall-timeout",
  "no-output-timeout",
  "orphaned",
  "spawn-error",
  "signal",
  "exit",
];

function isRunState(value: unknown): value is RunState {
  return typeof value === "string" && RUN_STATES.includes(value as RunState);
}

function isTerminationReason(value: unknown): value is TerminationReason {
  return typeof value === "string" && TERMINATION_REASONS.includes(value as TerminationReason);
}

function normalizeNullableNumber(value: unknown): number | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}

function normalizeRunRecord(value: unknown): RunRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Partial<RunRecord>;
  if (
    typeof record.runId !== "string" ||
    typeof record.sessionId !== "string" ||
    typeof record.backendId !== "string" ||
    !isRunState(record.state) ||
    typeof record.startedAtMs !== "number" ||
    !Number.isFinite(record.startedAtMs) ||
    typeof record.lastOutputAtMs !== "number" ||
    !Number.isFinite(record.lastOutputAtMs) ||
    typeof record.createdAtMs !== "number" ||
    !Number.isFinite(record.createdAtMs) ||
    typeof record.updatedAtMs !== "number" ||
    !Number.isFinite(record.updatedAtMs)
  ) {
    return null;
  }

  const normalized: RunRecord = {
    runId: record.runId,
    sessionId: record.sessionId,
    backendId: record.backendId,
    state: record.state,
    startedAtMs: record.startedAtMs,
    lastOutputAtMs: record.lastOutputAtMs,
    createdAtMs: record.createdAtMs,
    updatedAtMs: record.updatedAtMs,
    ...(typeof record.scopeKey === "string" && record.scopeKey.trim()
      ? { scopeKey: record.scopeKey.trim() }
      : {}),
    ...(typeof record.pid === "number" && Number.isFinite(record.pid) ? { pid: record.pid } : {}),
    ...(typeof record.processGroupId === "number" && Number.isFinite(record.processGroupId)
      ? { processGroupId: record.processGroupId }
      : {}),
    ...(isTerminationReason(record.terminationReason)
      ? { terminationReason: record.terminationReason }
      : {}),
    ...(normalizeNullableNumber(record.exitCode) !== undefined
      ? { exitCode: normalizeNullableNumber(record.exitCode) }
      : {}),
    ...((typeof record.exitSignal === "number" && Number.isFinite(record.exitSignal)) ||
    typeof record.exitSignal === "string"
      ? { exitSignal: record.exitSignal }
      : {}),
  };

  return normalized;
}

export function resolveProcessSupervisorStorePath(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.OPENAEON_SUPERVISOR_STORE_PATH?.trim();
  if (explicit) {
    return path.resolve(explicit);
  }
  if ((env.VITEST || env.NODE_ENV === "test") && !env.OPENAEON_STATE_DIR?.trim()) {
    return path.join(
      os.tmpdir(),
      "openaeon-test-state",
      String(process.pid),
      "process",
      "runs.json",
    );
  }
  return path.join(resolveStateDir(env), "process", "runs.json");
}

export function loadProcessSupervisorRuns(
  pathname = resolveProcessSupervisorStorePath(),
): RunRecord[] {
  const raw = loadJsonFile(pathname);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return [];
  }
  const parsed = raw as Partial<PersistedRunRegistry>;
  if (parsed.version !== STORE_VERSION || !Array.isArray(parsed.runs)) {
    return [];
  }
  const normalized: RunRecord[] = [];
  for (const item of parsed.runs) {
    const run = normalizeRunRecord(item);
    if (run) {
      normalized.push(run);
    }
  }
  return normalized;
}

export function saveProcessSupervisorRuns(
  runs: RunRecord[],
  pathname = resolveProcessSupervisorStorePath(),
) {
  const payload: PersistedRunRegistry = {
    version: STORE_VERSION,
    runs,
  };
  saveJsonFile(pathname, payload);
}
