export type CognitiveTaskTodo = {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "done";
  result?: string;
  dependsOn?: string[];
  ownerAgent?: string;
  acceptanceCriteria?: string[];
  riskLevel?: "low" | "medium" | "high";
  createdAt?: number;
  updatedAt?: number;
  startedAt?: number;
  completedAt?: number;
  heartbeatAt?: number;
  attemptCount?: number;
  lastProgressNote?: string;
  lastProgressAt?: number;
};

export type CognitivePlanExecutionGraph = {
  orderedTodoIds: string[];
  readyTodoIds: string[];
  blockedTodoIds: string[];
  inProgressTodoIds?: string[];
  longRunningTodoIds?: string[];
  staleTodoIds?: string[];
  blockedBy: Record<string, string[]>;
  todoTelemetry?: Record<
    string,
    {
      status?: "todo" | "in_progress" | "done";
      runtimeMs?: number;
      idleMs?: number;
      attemptCount?: number;
      lastTouchedAt?: number;
      spawn?: {
        spawned?: boolean;
        spawnAttempts?: number;
        lastSpawnError?: string;
        childSessionKey?: string;
        lastSpawnAt?: number;
      };
    }
  >;
  autoDispatch?: {
    enabled?: boolean;
    queueDepth?: number;
    runningCount?: number;
    maxConcurrent?: number;
    frozen?: boolean;
    freezeReason?: string;
    lastSpawnAt?: number;
  };
  advisories?: string[];
};

export type CognitivePlanSnapshot = {
  taskId?: string;
  sessionKey?: string;
  title?: string;
  description: string;
  nativePhase?: import("../../types.ts").CognitiveTaskPhase;
  todos: CognitiveTaskTodo[];
  phase?: "planning" | "execution" | "verification" | "complete";
  stateProjection?: import("../../types.ts").CognitiveStateProjection | null;
  invariants?: import("../../types.ts").CognitiveInvariantReport | null;
  memoryTrace?: import("../../types.ts").CognitiveMemoryTrace | null;
  architecture?: import("../../types.ts").CognitiveArchitectureProjection | null;
  replayCursor?: string | null;
  taskTree?: import("../../types.ts").TaskTree;
  runtime?: import("../../types.ts").CognitiveRuntimeSummary | null;
  currentBranchId?: string;
  branches?: Array<{
    id: string;
    status: "active" | "archived";
    createdAt: number;
    parentBranchId?: string;
    derivedFromCheckpointId?: string;
  }>;
  checkpoints?: Array<{
    checkpointId: string;
    taskId?: string;
    stageId: string;
    branchId: string;
    reason: string;
    previousCheckpointId?: string;
    sourceCheckpointId?: string;
    createdAt: number;
  }>;
  dreams?: Array<{
    dreamId: string;
    taskId: string;
    stageId: string;
    branchId: string;
    summary: string;
    keyDecisions: string[];
    risks: string[];
    nextAction: string;
    anchors: string[];
    sourceCheckpointIds: string[];
    createdAt: number;
  }>;
  verifierHistory?: Array<{
    verifierId: string;
    taskId: string;
    stageId: string;
    branchId: string;
    status: "pending" | "passed" | "failed" | "blocked";
    summary: string;
    evidence: string[];
    recommendedAction?: "forward" | "retry" | "rollback" | "branch" | "manual_review";
    createdAt: number;
  }>;
  graphEdges?: Array<{
    edgeId: string;
    from: string;
    to: string;
    relation: string;
    at: number;
  }>;
  executionGraph?: CognitivePlanExecutionGraph;
  taskRuntime?: {
    currentBranchId: string;
    branchesCount: number;
    checkpointsCount: number;
    latestCheckpointId?: string;
    latestCheckpointAt?: number;
    latestDreamId?: string;
    latestDreamSummary?: string;
    latestVerifierStatus?: "pending" | "passed" | "failed" | "blocked";
    currentBranchHistoryCount: number;
  };
  updatedAt?: number;
  recoveryState?: {
    lastBroadcastAt?: number;
    lastStaleDigest?: string;
    staleTodoNotifiedAt?: Record<string, number>;
  };
};

export type SandboxProps = {
  sessionKey: string;
  loading: boolean;
  result: import("../../types.ts").SessionsListResult | null;
  error: string | null;
  onRefresh: () => void;
  onForceRestart?: () => void;
  onSessionFocus?: (sessionKey: string) => void;
  /** Live cognitive plan derived from the cognitive task tree. */
  cognitivePlan?: CognitivePlanSnapshot | null;
  /** Live chat messages sent by agents */
  sandboxChatEvents?: import("../../types.ts").SandboxChatEvents;
  /** Map of agent IDs to their identity metadata (for avatars) */
  agentIdentityById?: Record<string, import("../../types.ts").AgentIdentityResult>;
  /** Whether the recruit agent modal is open */
  recruitModalOpen?: boolean;
  /** Callback to trigger when recruiting an agent */
  onRecruitAgent?: () => void;
  /** Callback to close the recruit modal */
  onRecruitModalClose?: () => void;
  /** Callback to change an agent's avatar */
  onAvatarSelect?: (agentId: string, avatar: string) => void;
  /** Nodes/Host machines */
  nodes?: Array<Record<string, unknown>>;
  /** System health */
  health?: import("../../types.ts").HealthSnapshot | null;
  /** Active channels */
  channels?: import("../../types.ts").ChannelsStatusSnapshot | null;
  /** Usage/Cost summary */
  usage?: import("../../types.ts").CostUsageSummary | null;
  /** Pending approvals count */
  approvalsCount?: number;
  /** Evolution & Tribal metadata */
  evolution?: import("../../types.ts").AeonStatusResult["evolution"];
  consciousness?: import("../../types.ts").AeonStatusResult["consciousness"];
  telemetry?: import("../../types.ts").AeonStatusResult["telemetry"];
  legacy?: import("../../types.ts").AeonStatusResult["legacy"];
  timestamp?: number;
  memoryPersistence?: import("../../types.ts").AeonMemoryPersistence;
  executionDelivery?: import("../../types.ts").AeonExecutionDelivery;
  eternalMode?: import("../../types.ts").AeonEternalModeStatus;
  onToggleEternalMode?: () => void;
};
