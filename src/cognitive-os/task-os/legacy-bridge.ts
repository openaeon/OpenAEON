import fs from "node:fs/promises";
import path from "node:path";
import type { CognitiveTaskRecord } from "./types.js";

type LegacyTodo = {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "done";
  result?: string;
  dependsOn?: string[];
  ownerAgent?: string;
  acceptanceCriteria?: string[];
  updatedAt?: number;
};

type LegacyTaskPlan = {
  description: string;
  todos: LegacyTodo[];
  phase: "planning" | "execution" | "verification" | "complete";
  updatedAt: number;
};

function plannerFile(workspaceDir: string, sessionKey: string): string {
  const safeKey = sessionKey.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(workspaceDir, ".openaeon", "planner", `${safeKey}.json`);
}

function mapNodeStatus(
  status: CognitiveTaskRecord["tree"]["nodes"][string]["status"],
): LegacyTodo["status"] {
  if (status === "in_progress") return "in_progress";
  if (status === "done") return "done";
  return "todo";
}

export function recordToLegacyPlan(record: CognitiveTaskRecord): LegacyTaskPlan {
  const todos = Object.values(record.tree.nodes)
    .filter((node) => node.id !== record.tree.rootId)
    .map((node) => ({
      id: node.id,
      title: node.title,
      status: mapNodeStatus(node.status),
      result: node.artifacts.length > 0 ? node.artifacts.join(", ") : undefined,
      dependsOn: node.dependsOn,
      ownerAgent: node.ownerRole,
      acceptanceCriteria: node.acceptanceCriteria,
      updatedAt: record.updatedAt,
    }));

  return {
    description: record.input,
    todos,
    phase: record.status.legacyPhase,
    updatedAt: record.updatedAt,
  };
}

export async function syncRecordToLegacyPlan(
  workspaceDir: string,
  record: CognitiveTaskRecord,
): Promise<void> {
  const file = plannerFile(workspaceDir, record.sessionKey);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const plan = recordToLegacyPlan(record);
  await fs.writeFile(file, JSON.stringify(plan, null, 2), "utf-8");
}
