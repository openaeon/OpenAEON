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
  CognitiveMemoryToolCall,
  CognitiveMemoryToolSchema,
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

  queuePrefetch(_query: CognitiveMemoryProviderQuery): void {
    // File-backed memory is cheap enough to query synchronously on demand.
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

  getToolSchemas(): CognitiveMemoryToolSchema[] {
    return [];
  }

  handleToolCall(call: CognitiveMemoryToolCall): string {
    return JSON.stringify({
      error: `Default memory provider does not expose tool '${call.toolName}'.`,
    });
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

  onTurnStart(_turn: CognitiveMemoryContext & { turnNumber: number; message: string }): void {
    // Default provider has no turn-local scheduler.
  }

  async onSessionEnd(context: CognitiveMemoryContext & { messages?: unknown[] }): Promise<void> {
    if (!context.taskId || !Array.isArray(context.messages) || context.messages.length === 0) {
      return;
    }
    await this.writeEvolution({
      taskId: context.taskId,
      runId: context.runId,
      category: "optimization_strategy",
      content: `Session ended with ${context.messages.length} message(s).`,
      tags: ["session_end", context.sessionKey ?? "session"],
    });
  }

  onPreCompress(context: CognitiveMemoryContext & { messages: unknown[] }): string {
    if (!context.messages.length) {
      return "";
    }
    return `Preserve Cognitive memory cues from ${context.messages.length} message(s) before compression.`;
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

  async onMemoryWrite(
    event: CognitiveMemoryContext & {
      action: "add" | "replace" | "remove";
      target: "short" | "long" | "evolution";
      content: string;
    },
  ): Promise<void> {
    if (event.target !== "evolution" || !event.taskId || !event.content.trim()) {
      return;
    }
    await this.writeEvolution({
      taskId: event.taskId,
      runId: event.runId,
      category: "optimization_strategy",
      content: `${event.action}: ${event.content}`,
      tags: ["memory_write", event.target],
    });
  }

  getConfigSchema(): [] {
    return [];
  }

  saveConfig(_values: Record<string, unknown>): void {
    // Default provider uses workspace-local files and has no setup fields.
  }

  shutdown(): void {
    // Default provider writes synchronously and has nothing to flush.
  }
}
