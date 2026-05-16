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
  updatedAt: number;
  reason?: string;
};

export type CognitiveStateProjection = {
  taskId: string;
  at: number;
  z: {
    phase: CognitiveTaskPhase;
    activeNodeIds: string[];
    blockedNodeIds: string[];
    failedNodeIds: string[];
    confidence: number;
  };
  phi: {
    completedNodeIds: string[];
    retryPressure: number;
    learningSignals: string[];
  };
  c: {
    sessionKey: string;
    externalSignals: string[];
  };
  r: {
    reflectionVerdict: "pass" | "warn" | "fail" | "pending";
    correctionSignals: string[];
  };
  zNext: {
    recommendedPhase: CognitiveTaskPhase;
    invariantReady: boolean;
  };
};

export type CognitiveInvariantCheckId =
  | "identity"
  | "goal_consistency"
  | "safety_boundary"
  | "evidence_coherence"
  | "permission_validity"
  | "explainability";

export type CognitiveInvariantCheck = {
  id: CognitiveInvariantCheckId;
  status: "pass" | "warn" | "fail";
  summary: string;
  evidence: string[];
};

export type CognitiveInvariantReport = {
  id: string;
  taskId: string;
  at: number;
  phase: CognitiveTaskPhase;
  status: "pass" | "warn" | "fail";
  checks: CognitiveInvariantCheck[];
  blocked: boolean;
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

export type CognitiveMemoryTrace = {
  shortTermExpiresAt?: number;
  longTermSources: Array<{
    source: string;
    score?: number;
    path?: string;
  }>;
  evolutionStrategyHits: EvolutionMemoryEntry[];
};

export type CognitiveSystemLayerId =
  | "perception"
  | "understanding"
  | "reasoning"
  | "planning"
  | "verification"
  | "memory"
  | "governance"
  | "collaboration";

export type CognitiveSystemLayer = {
  id: CognitiveSystemLayerId;
  index: number;
  label: string;
  status: "idle" | "active" | "verified" | "blocked";
  signals: string[];
};

export type CognitiveCapabilityLevel = {
  level: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  label: string;
  active: boolean;
  score: number;
};

export type CognitiveSpaceId = "G" | "W" | "T" | "B" | "E";

export type CognitiveSpaceProjection = {
  id: CognitiveSpaceId;
  label: string;
  permeability: "low" | "medium" | "high";
  stability: "low" | "medium" | "high";
  active: boolean;
  signals: string[];
};

export type CognitiveOperatingStep = {
  index: number;
  id:
    | "input_reception"
    | "intent_understanding"
    | "state_update"
    | "planning_decision"
    | "execution_invocation"
    | "verification_reflection"
    | "memory_update"
    | "induction_check";
  label: string;
  status: "pending" | "active" | "done" | "blocked";
};

export type CognitiveSubsystemProjection = {
  id:
    | "state_modeler"
    | "intent_reasoning"
    | "planning_decision"
    | "tool_execution"
    | "verification_reflection"
    | "memory_learning"
    | "safety_governance";
  label: string;
  status: "idle" | "active" | "verified" | "blocked";
  metrics: Record<string, number | string>;
};

export type CognitiveArchitectureProjection = {
  version: "3.0";
  formula: "Z -> Z^2 + C + R -> Z+1";
  layers: CognitiveSystemLayer[];
  capabilityLadder: CognitiveCapabilityLevel[];
  spaces: CognitiveSpaceProjection[];
  operatingLoop: CognitiveOperatingStep[];
  subsystems: CognitiveSubsystemProjection[];
  roadmap: Array<{
    phase: 1 | 2 | 3 | 4;
    label: string;
    active: boolean;
  }>;
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
  evidence?: string[];
  toolEvents?: Array<Record<string, unknown>>;
  acceptanceMatched?: boolean;
  recoverySignal?: string;
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

export type CognitiveRuntimeSummary = {
  phase: CognitiveTaskPhase;
  queue: { pending: number; claimed: number };
  retries: { total: number; pendingBackoff: number; exhausted: number };
  delegations: { active: number; overdue: number };
  checkpoint: { lastRunId?: string; runCount: number };
  dream: { ready: boolean; lastDreamAt?: number };
  replayCursor: string | null;
  providers: Array<{ provider: string; lastModel?: string; success: number; failed: number }>;
  invariants?: CognitiveInvariantReport;
  stateProjection?: CognitiveStateProjection;
  memoryTrace?: CognitiveMemoryTrace;
  architecture?: CognitiveArchitectureProjection;
};
