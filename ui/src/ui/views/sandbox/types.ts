export type TaskTodo = {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "done";
  result?: string;
  dependsOn?: string[];
  ownerAgent?: string;
  acceptanceCriteria?: string[];
  riskLevel?: "low" | "medium" | "high";
};

export type TaskPlanExecutionGraph = {
  orderedTodoIds: string[];
  readyTodoIds: string[];
  blockedTodoIds: string[];
  blockedBy: Record<string, string[]>;
};

export type TaskPlanSnapshot = {
  description: string;
  todos: TaskTodo[];
  phase?: "planning" | "execution" | "verification" | "complete";
  executionGraph?: TaskPlanExecutionGraph;
};

export type SandboxProps = {
  sessionKey: string;
  loading: boolean;
  result: import("../../types.ts").SessionsListResult | null;
  error: string | null;
  onRefresh: () => void;
  onForceRestart?: () => void;
  onSessionFocus?: (sessionKey: string) => void;
  /** Live task plan from the main agent's planner file. Optional. */
  taskPlan?: TaskPlanSnapshot | null;
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
