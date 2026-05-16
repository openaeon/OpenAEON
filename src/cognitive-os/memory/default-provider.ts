import crypto from "node:crypto";
import path from "node:path";
import type { EvolutionMemoryEntry } from "../contracts/types.js";
import { appendEvolutionEntry, queryEvolutionEntries } from "./evolution-store.js";
import { queryLongTermKnowledge } from "./long-term-adapter.js";
import type {
  CognitiveDelegationObservation,
  CognitiveMemoryContext,
  CognitiveMemoryProvider,
  CognitiveMemoryProviderQuery,
  CognitiveMemoryProviderResult,
  CognitiveMemoryTurn,
  CognitiveMemoryWrite,
} from "./provider.js";

export class DefaultCognitiveMemoryProvider implements CognitiveMemoryProvider {
  readonly name = "default";

  constructor(private readonly workspaceDir: string) {}

  isAvailable(): boolean {
    return true;
  }

  initialize(_context: CognitiveMemoryContext): void {
    // Default provider is file-backed and has no connection lifecycle.
  }

  async prefetch(query: CognitiveMemoryProviderQuery): Promise<CognitiveMemoryProviderResult[]> {
    const results = await queryLongTermKnowledge({
      query: query.query,
      agentId: query.agentId ?? "cognitive",
      sessionKey: query.sessionKey,
      maxResults: query.maxResults,
    });
    return results.map((result) => ({
      source: result.source,
      content: result.text,
      score: result.score,
      trace: {
        path: result.path,
        startLine: result.startLine,
        endLine: result.endLine,
        citation: result.citation,
      },
    }));
  }

  async writeEvolution(params: CognitiveMemoryWrite): Promise<EvolutionMemoryEntry> {
    const entry: EvolutionMemoryEntry = {
      id: crypto.randomUUID(),
      taskId: params.taskId ?? "global",
      category: params.category,
      content: params.content,
      tags: params.tags ?? [],
      runId: params.runId,
      createdAt: Date.now(),
    };
    await appendEvolutionEntry(path.join(this.workspaceDir, ".openaeon", "memory"), entry);
    return entry;
  }

  async queryEvolution(params: {
    taskId?: string;
    tags?: string[];
    limit?: number;
  }): Promise<EvolutionMemoryEntry[]> {
    return await queryEvolutionEntries(path.join(this.workspaceDir, ".openaeon", "memory"), params);
  }

  async syncTurn(turn: CognitiveMemoryTurn): Promise<void> {
    if (!turn.taskId || !turn.assistantContent.trim()) {
      return;
    }
    await this.writeEvolution({
      taskId: turn.taskId,
      runId: turn.runId,
      category: "success_path",
      content: turn.assistantContent.trim(),
      tags: ["turn", turn.sessionKey ?? "session"],
    });
  }

  async onDelegation(observation: CognitiveDelegationObservation): Promise<void> {
    if (!observation.taskId || !observation.result.trim()) {
      return;
    }
    await this.writeEvolution({
      taskId: observation.taskId,
      runId: observation.runId,
      category: "success_path",
      content: `Delegated: ${observation.task}\nResult: ${observation.result}`,
      tags: ["delegation", observation.childSessionKey ?? "subagent"],
    });
  }

  shutdown(): void {
    // Default provider writes synchronously and has nothing to flush.
  }
}
