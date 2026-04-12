export type LegacyTaskPlanPhase = "planning" | "execution" | "verification" | "complete";

export type CognitiveTaskPhase =
  | "INIT"
  | "PLAN"
  | "EXECUTE"
  | "VERIFY"
  | "REFLECT"
  | "DONE"
  | "FAILED"
  | "ROLLED_BACK";

export type AgentRole = "DevAgent" | "QAAgent" | "OpsAgent" | "SalesAgent";

export type ModelProvider = "gpt" | "claude" | "gemini";

export type CognitiveTaskStatus = {
  phase: CognitiveTaskPhase;
  legacyPhase: LegacyTaskPlanPhase;
  updatedAt: number;
  reason?: string;
};

export type TaskNode = {
  id: string;
  title: string;
  description?: string;
  ownerRole?: AgentRole;
  dependsOn: string[];
  parentId?: string;
  children: string[];
  depth: number;
  status: "todo" | "in_progress" | "done" | "blocked" | "failed";
  priority: number;
  acceptanceCriteria: string[];
  artifacts: string[];
  metadata?: Record<string, unknown>;
};

export type TaskTree = {
  rootId: string;
  nodes: Record<string, TaskNode>;
};

export type TaskReplayEvent = {
  id: string;
  taskId: string;
  runId: string;
  at: number;
  stream: string;
  payload: Record<string, unknown>;
};

export type ReflectionRecord = {
  id: string;
  taskId: string;
  nodeId?: string;
  at: number;
  verdict: "pass" | "warn" | "fail";
  findings: string[];
  optimizations: string[];
};

export type DreamRecord = {
  id: string;
  taskId: string;
  at: number;
  summary: string;
  strategyUpdates: string[];
  sourceRunIds: string[];
};

export type EvolutionMemoryEntry = {
  id: string;
  taskId: string;
  category: "success_path" | "failure_case" | "optimization_strategy";
  content: string;
  tags: string[];
  runId?: string;
  createdAt: number;
};

export type AgentDispatchRequest = {
  taskId: string;
  nodeId: string;
  prompt: string;
  role: AgentRole;
  providers: ModelProvider[];
  timeoutMs: number;
  context?: string[]; // Layer 1 & 2: Hilbert-sorted snippets
};

export type AgentDispatchCandidate = {
  provider: ModelProvider;
  model: string;
  output: string;
  score: number;
  reason: string;
  latencyMs: number;
  failed?: boolean;
  error?: string;
};

export type AgentDispatchResult = {
  winner: AgentDispatchCandidate;
  candidates: AgentDispatchCandidate[];
  degraded: boolean;
};

export type WorldCapabilityType = "browser" | "api" | "filesystem" | "database";

export type WorldCapability = {
  id: string;
  type: WorldCapabilityType;
  label: string;
  enabled: boolean;
  metadata?: Record<string, unknown>;
};
