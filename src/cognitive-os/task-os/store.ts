import fs from "node:fs/promises";
import path from "node:path";
import type { CognitiveTaskRecord } from "./types.js";
import { getCognitiveSqliteStore } from "../store/sqlite-store.js";

function taskFile(baseDir: string, taskId: string): string {
  return path.join(baseDir, `${taskId}.json`);
}

export function taskLockFile(baseDir: string, taskId: string): string {
  return path.join(baseDir, `${taskId}.lock`);
}

export async function readTaskRecord(
  baseDir: string,
  taskId: string,
): Promise<CognitiveTaskRecord | null> {
  try {
    const content = await fs.readFile(taskFile(baseDir, taskId), "utf-8");
    return JSON.parse(content) as CognitiveTaskRecord;
  } catch {
    return null;
  }
}

export async function writeTaskRecord(baseDir: string, record: CognitiveTaskRecord): Promise<void> {
  await fs.mkdir(baseDir, { recursive: true });
  await fs.writeFile(taskFile(baseDir, record.id), JSON.stringify(record, null, 2), "utf-8");
  const workspaceDir = path.dirname(path.dirname(path.dirname(baseDir)));
  getCognitiveSqliteStore(workspaceDir)?.indexTask(record);
}

export async function listTaskRecords(baseDir: string, limit = 50): Promise<CognitiveTaskRecord[]> {
  try {
    const names = (await fs.readdir(baseDir)).filter((entry) => entry.endsWith(".json"));
    const records: CognitiveTaskRecord[] = [];
    for (const name of names) {
      try {
        const raw = await fs.readFile(path.join(baseDir, name), "utf-8");
        records.push(JSON.parse(raw) as CognitiveTaskRecord);
      } catch {
        // ignore malformed record
      }
    }
    return records
      .toSorted((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, Math.max(1, Math.min(500, Math.floor(limit))));
  } catch {
    return [];
  }
}
