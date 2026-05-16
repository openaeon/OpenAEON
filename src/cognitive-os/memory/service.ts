import type { EvolutionMemoryEntry } from "../contracts/types.js";
import { DefaultCognitiveMemoryProvider } from "./default-provider.js";
import type { LongTermQueryResult } from "./long-term-adapter.js";
import type {
  CognitiveDelegationObservation,
  CognitiveMemoryProvider,
  CognitiveMemoryTurn,
} from "./provider.js";

export class CognitiveMemoryService {
  private readonly provider: CognitiveMemoryProvider;

  constructor(workspaceDir: string, provider?: CognitiveMemoryProvider) {
    this.provider = provider ?? new DefaultCognitiveMemoryProvider(workspaceDir);
  }

  async initialize(
    context: {
      taskId?: string;
      runId?: string;
      sessionKey?: string;
      agentId?: string;
    } = {},
  ): Promise<void> {
    if (!(await this.provider.isAvailable())) {
      return;
    }
    await this.provider.initialize(context);
  }

  async writeEvolution(params: {
    taskId: string;
    category: EvolutionMemoryEntry["category"];
    content: string;
    tags?: string[];
    runId?: string;
  }): Promise<EvolutionMemoryEntry> {
    return await this.provider.writeEvolution(params);
  }

  async queryEvolution(params: { taskId?: string; tags?: string[]; limit?: number }) {
    return await this.provider.queryEvolution(params);
  }

  async queryLongTerm(params: {
    query: string;
    agentId: string;
    sessionKey?: string;
    maxResults?: number;
  }): Promise<LongTermQueryResult[]> {
    const results = await this.provider.prefetch({
      query: params.query,
      agentId: params.agentId,
      sessionKey: params.sessionKey,
      maxResults: params.maxResults,
    });
    return results.map((result) => ({
      text: result.content,
      source: result.source,
      score: result.score ?? 0,
      path:
        typeof result.trace?.path === "string" && result.trace.path.trim()
          ? result.trace.path
          : result.source,
      startLine: typeof result.trace?.startLine === "number" ? result.trace.startLine : 1,
      endLine: typeof result.trace?.endLine === "number" ? result.trace.endLine : 1,
      citation: typeof result.trace?.citation === "string" ? result.trace.citation : undefined,
    }));
  }

  async syncTurn(turn: CognitiveMemoryTurn): Promise<void> {
    await this.provider.syncTurn(turn);
  }

  async onDelegation(observation: CognitiveDelegationObservation): Promise<void> {
    await this.provider.onDelegation(observation);
  }

  async shutdown(): Promise<void> {
    await this.provider.shutdown();
  }
}
