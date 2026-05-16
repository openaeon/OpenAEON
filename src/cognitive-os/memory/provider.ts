import type { EvolutionMemoryEntry } from "../contracts/types.js";

export type CognitiveMemoryContext = {
  taskId?: string;
  runId?: string;
  sessionKey?: string;
  agentId?: string;
};

export type CognitiveMemoryTurn = CognitiveMemoryContext & {
  userContent: string;
  assistantContent: string;
};

export type CognitiveMemoryProviderQuery = CognitiveMemoryContext & {
  query: string;
  maxResults?: number;
  tags?: string[];
};

export type CognitiveMemoryProviderResult = {
  source: string;
  content: string;
  score?: number;
  trace?: Record<string, unknown>;
};

export type CognitiveMemoryWrite = CognitiveMemoryContext & {
  category: EvolutionMemoryEntry["category"];
  content: string;
  tags?: string[];
};

export type CognitiveDelegationObservation = CognitiveMemoryContext & {
  childSessionKey?: string;
  task: string;
  result: string;
};

export interface CognitiveMemoryProvider {
  readonly name: string;
  isAvailable(): Promise<boolean> | boolean;
  initialize(context: CognitiveMemoryContext): Promise<void> | void;
  prefetch(query: CognitiveMemoryProviderQuery): Promise<CognitiveMemoryProviderResult[]>;
  writeEvolution(entry: CognitiveMemoryWrite): Promise<EvolutionMemoryEntry>;
  queryEvolution(query: {
    taskId?: string;
    tags?: string[];
    limit?: number;
  }): Promise<EvolutionMemoryEntry[]>;
  syncTurn(turn: CognitiveMemoryTurn): Promise<void> | void;
  onDelegation(observation: CognitiveDelegationObservation): Promise<void> | void;
  shutdown(): Promise<void> | void;
}
