import fs from "node:fs/promises";
import path from "node:path";
import type { EvolutionMemoryEntry } from "../contracts/types.js";

function filePath(baseDir: string): string {
  return path.join(baseDir, "evolution-memory.jsonl");
}

export async function appendEvolutionEntry(
  baseDir: string,
  entry: EvolutionMemoryEntry,
): Promise<void> {
  await fs.mkdir(baseDir, { recursive: true });
  await fs.appendFile(filePath(baseDir), JSON.stringify(entry) + "\n", "utf-8");
}

export async function queryEvolutionEntries(
  baseDir: string,
  params: { taskId?: string; tags?: string[]; limit?: number },
): Promise<EvolutionMemoryEntry[]> {
  const limit = Math.max(1, Math.min(500, params.limit ?? 50));
  try {
    const content = await fs.readFile(filePath(baseDir), "utf-8");
    const all = content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as EvolutionMemoryEntry;
        } catch {
          return null;
        }
      })
      .filter((entry): entry is EvolutionMemoryEntry => entry !== null);

    const filtered = all.filter((entry) => {
      if (params.taskId && entry.taskId !== params.taskId) {
        return false;
      }
      if (params.tags && params.tags.length > 0) {
        return params.tags.some((tag) => entry.tags.includes(tag));
      }
      return true;
    });

    return filtered.toSorted((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  } catch {
    return [];
  }
}
