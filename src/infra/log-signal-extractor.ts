import fs from "node:fs/promises";
import { createReadStream } from "node:fs";

export type SignalKind =
  | "gateway_down"
  | "config_mismatch"
  | "recurring_error"
  | "channel_auth_invalid"
  | "git_lock_detected";

export interface SignalReport {
  kind: SignalKind;
  frequency: number;
  evidence: string;
  metadata?: Record<string, unknown>;
}

const DEFAULT_MAX_LOG_SIZE_BYTES = 100 * 1024; // 100KB
const RECURRING_THRESHOLD = 3;

/**
 * Extracts signals from log content based on known patterns.
 */
export function extractSignalsFromText(text: string): SignalReport[] {
  const reports: SignalReport[] = [];

  // 1. Gateway Down Signal
  if (
    text.includes("gateway closed") ||
    text.includes("ECONNREFUSED") ||
    text.includes("Connection refused")
  ) {
    reports.push({
      kind: "gateway_down",
      frequency: 1,
      evidence: "Log contains gateway connection failure indicators.",
    });
  }

  // 2. Git Lock Detected
  if (text.includes("index.lock") || text.includes("Another git process seems to be running")) {
    reports.push({
      kind: "git_lock_detected",
      frequency: 1,
      evidence: "Log indicates git index.lock is blocking operations.",
    });
  }

  // 3. Channel Auth Errors
  if (
    text.includes("401 Unauthorized") ||
    text.includes("invalid token") ||
    text.includes("authentication failed")
  ) {
    reports.push({
      kind: "channel_auth_invalid",
      frequency: 1,
      evidence: "Detected authentication failures in recent communication logs.",
    });
  }

  // 4. Recurring Errors (Heuristic)
  const errorLines = text.split("\n").filter((l) => l.includes("ERROR") || l.includes("error:"));
  const errorCounts: Record<string, number> = {};

  for (const line of errorLines) {
    // Basic normalization: strip timestamps and line numbers
    const normalized = line.replace(/^\d{4}-\d{2}-\d{2}.*?\s/, "").trim();
    if (normalized) {
      errorCounts[normalized] = (errorCounts[normalized] || 0) + 1;
    }
  }

  for (const [error, count] of Object.entries(errorCounts)) {
    if (count >= RECURRING_THRESHOLD) {
      reports.push({
        kind: "recurring_error",
        frequency: count,
        evidence: `Error occurred ${count} times: ${error.slice(0, 100)}...`,
        metadata: { originalError: error },
      });
    }
  }

  return reports;
}

/**
 * Reads the tail of a log file and extracts signals.
 */
export async function extractSignalsFromLogFile(
  logPath: string,
  maxBytes = DEFAULT_MAX_LOG_SIZE_BYTES,
): Promise<SignalReport[]> {
  try {
    const stats = await fs.stat(logPath);
    const start = Math.max(0, stats.size - maxBytes);

    // We use a small hack to read the tail of the file easily
    const buffer = Buffer.alloc(Math.min(stats.size, maxBytes));
    const fd = await fs.open(logPath, "r");
    try {
      await fd.read(buffer, 0, buffer.length, start);
    } finally {
      await fd.close();
    }

    const text = buffer.toString("utf-8");
    return extractSignalsFromText(text);
  } catch (err) {
    // If log doesn't exist, maybe it's not started yet or configured differently
    return [];
  }
}
