import crypto from "node:crypto";
import path from "node:path";
import type { EvolutionMemoryEntry } from "../contracts/types.js";
import { appendEvolutionEntry, queryEvolutionEntries } from "./evolution-store.js";
import { queryLongTermKnowledge } from "./long-term-adapter.js";

export class CognitiveMemoryService {
  constructor(private readonly workspaceDir: string) {}

  async writeEvolution(params: {
    taskId: string;
    category: EvolutionMemoryEntry["category"];
    content: string;
    tags?: string[];
    runId?: string;
  }): Promise<EvolutionMemoryEntry> {
    const entry: EvolutionMemoryEntry = {
      id: crypto.randomUUID(),
      taskId: params.taskId,
      category: params.category,
      content: params.content,
      tags: params.tags ?? [],
      runId: params.runId,
      createdAt: Date.now(),
    };
    await appendEvolutionEntry(path.join(this.workspaceDir, ".openaeon", "memory"), entry);
    return entry;
  }

  async queryEvolution(params: { taskId?: string; tags?: string[]; limit?: number }) {
    return await queryEvolutionEntries(path.join(this.workspaceDir, ".openaeon", "memory"), params);
  }

  async queryLongTerm(params: {
    query: string;
    agentId: string;
    sessionKey?: string;
    maxResults?: number;
  }) {
    return await queryLongTermKnowledge(params);
  }
}
