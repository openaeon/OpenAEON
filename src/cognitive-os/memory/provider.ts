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

export type CognitiveMemoryToolSchema = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type CognitiveMemoryToolCall = CognitiveMemoryContext & {
  toolName: string;
  args: Record<string, unknown>;
};

export type CognitiveMemoryConfigField = {
  key: string;
  description: string;
  required?: boolean;
  secret?: boolean;
  default?: string;
  choices?: string[];
  envVar?: string;
  url?: string;
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
  queuePrefetch(query: CognitiveMemoryProviderQuery): Promise<void> | void;
  writeEvolution(entry: CognitiveMemoryWrite): Promise<EvolutionMemoryEntry>;
  queryEvolution(query: {
    taskId?: string;
    tags?: string[];
    limit?: number;
  }): Promise<EvolutionMemoryEntry[]>;
  getToolSchemas(): CognitiveMemoryToolSchema[];
  handleToolCall(call: CognitiveMemoryToolCall): Promise<string> | string;
  syncTurn(turn: CognitiveMemoryTurn): Promise<void> | void;
  onTurnStart(
    turn: CognitiveMemoryContext & { turnNumber: number; message: string },
  ): Promise<void> | void;
  onSessionEnd(context: CognitiveMemoryContext & { messages?: unknown[] }): Promise<void> | void;
  onPreCompress(
    context: CognitiveMemoryContext & { messages: unknown[] },
  ): Promise<string> | string;
  onDelegation(observation: CognitiveDelegationObservation): Promise<void> | void;
  onMemoryWrite(
    event: CognitiveMemoryContext & {
      action: "add" | "replace" | "remove";
      target: "short" | "long" | "evolution";
      content: string;
    },
  ): Promise<void> | void;
  getConfigSchema(): CognitiveMemoryConfigField[];
  saveConfig(values: Record<string, unknown>): Promise<void> | void;
  shutdown(): Promise<void> | void;
}
