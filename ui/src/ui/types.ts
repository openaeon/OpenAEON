export type UpdateAvailable = import("../../../src/infra/update-startup.js").UpdateAvailable;

export type ChannelsStatusSnapshot = {
  ts: number;
  channelOrder: string[];
  channelLabels: Record<string, string>;
  channelDetailLabels?: Record<string, string>;
  channelSystemImages?: Record<string, string>;
  channelMeta?: ChannelUiMetaEntry[];
  channels: Record<string, unknown>;
  channelAccounts: Record<string, ChannelAccountSnapshot[]>;
  channelDefaultAccountId: Record<string, string>;
};

export type ChannelUiMetaEntry = {
  id: string;
  label: string;
  detailLabel: string;
  systemImage?: string;
};

export const CRON_CHANNEL_LAST = "last";

export type ChannelAccountSnapshot = {
  accountId: string;
  name?: string | null;
  enabled?: boolean | null;
  configured?: boolean | null;
  linked?: boolean | null;
  running?: boolean | null;
  connected?: boolean | null;
  reconnectAttempts?: number | null;
  lastConnectedAt?: number | null;
  lastError?: string | null;
  lastStartAt?: number | null;
  lastStopAt?: number | null;
  lastInboundAt?: number | null;
  lastOutboundAt?: number | null;
  lastProbeAt?: number | null;
  mode?: string | null;
  dmPolicy?: string | null;
  allowFrom?: string[] | null;
  tokenSource?: string | null;
  botTokenSource?: string | null;
  appTokenSource?: string | null;
  credentialSource?: string | null;
  audienceType?: string | null;
  audience?: string | null;
  webhookPath?: string | null;
  webhookUrl?: string | null;
  baseUrl?: string | null;
  allowUnmentionedGroups?: boolean | null;
  cliPath?: string | null;
  dbPath?: string | null;
  port?: number | null;
  probe?: unknown;
  audit?: unknown;
  application?: unknown;
};

export type WhatsAppSelf = {
  e164?: string | null;
  jid?: string | null;
};

export type WhatsAppDisconnect = {
  at: number;
  status?: number | null;
  error?: string | null;
  loggedOut?: boolean | null;
};

export type WhatsAppStatus = {
  configured: boolean;
  linked: boolean;
  authAgeMs?: number | null;
  self?: WhatsAppSelf | null;
  running: boolean;
  connected: boolean;
  lastConnectedAt?: number | null;
  lastDisconnect?: WhatsAppDisconnect | null;
  reconnectAttempts: number;
  lastMessageAt?: number | null;
  lastEventAt?: number | null;
  lastError?: string | null;
};

export type WeixinSelf = {
  nickname?: string | null;
  uin?: string | null;
  alias?: string | null;
};

export type WeixinStatus = {
  configured: boolean;
  linked: boolean;
  self?: WeixinSelf | null;
  running: boolean;
  connected: boolean;
  lastConnectedAt?: number | null;
  reconnectAttempts: number;
  lastMessageAt?: number | null;
  lastEventAt?: number | null;
  lastError?: string | null;
};

export type TelegramBot = {
  id?: number | null;
  username?: string | null;
};

export type TelegramWebhook = {
  url?: string | null;
  hasCustomCert?: boolean | null;
};

export type TelegramProbe = {
  ok: boolean;
  status?: number | null;
  error?: string | null;
  elapsedMs?: number | null;
  bot?: TelegramBot | null;
  webhook?: TelegramWebhook | null;
};

export type TelegramStatus = {
  configured: boolean;
  tokenSource?: string | null;
  running: boolean;
  mode?: string | null;
  lastStartAt?: number | null;
  lastStopAt?: number | null;
  lastError?: string | null;
  probe?: TelegramProbe | null;
  lastProbeAt?: number | null;
};

export type DiscordBot = {
  id?: string | null;
  username?: string | null;
};

export type DiscordProbe = {
  ok: boolean;
  status?: number | null;
  error?: string | null;
  elapsedMs?: number | null;
  bot?: DiscordBot | null;
};

export type DiscordStatus = {
  configured: boolean;
  tokenSource?: string | null;
  running: boolean;
  lastStartAt?: number | null;
  lastStopAt?: number | null;
  lastError?: string | null;
  probe?: DiscordProbe | null;
  lastProbeAt?: number | null;
};

export type GoogleChatProbe = {
  ok: boolean;
  status?: number | null;
  error?: string | null;
  elapsedMs?: number | null;
};

export type GoogleChatStatus = {
  configured: boolean;
  credentialSource?: string | null;
  audienceType?: string | null;
  audience?: string | null;
  webhookPath?: string | null;
  webhookUrl?: string | null;
  running: boolean;
  lastStartAt?: number | null;
  lastStopAt?: number | null;
  lastError?: string | null;
  probe?: GoogleChatProbe | null;
  lastProbeAt?: number | null;
};

export type SlackBot = {
  id?: string | null;
  name?: string | null;
};

export type SlackTeam = {
  id?: string | null;
  name?: string | null;
};

export type SlackProbe = {
  ok: boolean;
  status?: number | null;
  error?: string | null;
  elapsedMs?: number | null;
  bot?: SlackBot | null;
  team?: SlackTeam | null;
};

export type SlackStatus = {
  configured: boolean;
  botTokenSource?: string | null;
  appTokenSource?: string | null;
  running: boolean;
  lastStartAt?: number | null;
  lastStopAt?: number | null;
  lastError?: string | null;
  probe?: SlackProbe | null;
  lastProbeAt?: number | null;
};

export type SignalProbe = {
  ok: boolean;
  status?: number | null;
  error?: string | null;
  elapsedMs?: number | null;
  version?: string | null;
};

export type SignalStatus = {
  configured: boolean;
  baseUrl: string;
  running: boolean;
  lastStartAt?: number | null;
  lastStopAt?: number | null;
  lastError?: string | null;
  probe?: SignalProbe | null;
  lastProbeAt?: number | null;
};

export type IMessageProbe = {
  ok: boolean;
  error?: string | null;
};

export type IMessageStatus = {
  configured: boolean;
  running: boolean;
  lastStartAt?: number | null;
  lastStopAt?: number | null;
  lastError?: string | null;
  cliPath?: string | null;
  dbPath?: string | null;
  probe?: IMessageProbe | null;
  lastProbeAt?: number | null;
};

export type NostrProfile = {
  name?: string | null;
  displayName?: string | null;
  about?: string | null;
  picture?: string | null;
  banner?: string | null;
  website?: string | null;
  nip05?: string | null;
  lud16?: string | null;
};

export type NostrStatus = {
  configured: boolean;
  publicKey?: string | null;
  running: boolean;
  lastStartAt?: number | null;
  lastStopAt?: number | null;
  lastError?: string | null;
  profile?: NostrProfile | null;
};

export type MSTeamsProbe = {
  ok: boolean;
  error?: string | null;
  appId?: string | null;
};

export type MSTeamsStatus = {
  configured: boolean;
  running: boolean;
  lastStartAt?: number | null;
  lastStopAt?: number | null;
  lastError?: string | null;
  port?: number | null;
  probe?: MSTeamsProbe | null;
  lastProbeAt?: number | null;
};

export type ConfigSnapshotIssue = {
  path: string;
  message: string;
};

export type ConfigSnapshot = {
  path?: string | null;
  exists?: boolean | null;
  raw?: string | null;
  hash?: string | null;
  parsed?: unknown;
  valid?: boolean | null;
  config?: Record<string, unknown> | null;
  issues?: ConfigSnapshotIssue[] | null;
};

export type ConfigUiHint = {
  label?: string;
  help?: string;
  tags?: string[];
  group?: string;
  order?: number;
  advanced?: boolean;
  sensitive?: boolean;
  placeholder?: string;
  itemTemplate?: unknown;
};

export type ConfigUiHints = Record<string, ConfigUiHint>;

export type ConfigSchemaResponse = {
  schema: unknown;
  uiHints: ConfigUiHints;
  version: string;
  generatedAt: string;
};

export type PresenceEntry = {
  instanceId?: string | null;
  host?: string | null;
  ip?: string | null;
  version?: string | null;
  platform?: string | null;
  deviceFamily?: string | null;
  modelIdentifier?: string | null;
  roles?: string[] | null;
  scopes?: string[] | null;
  mode?: string | null;
  lastInputSeconds?: number | null;
  reason?: string | null;
  text?: string | null;
  ts?: number | null;
};

export type GatewaySessionsDefaults = {
  model: string | null;
  contextTokens: number | null;
};

export type GatewayAgentRow = {
  id: string;
  name?: string;
  identity?: {
    name?: string;
    theme?: string;
    emoji?: string;
    avatar?: string;
    avatarUrl?: string;
  };
};

export type AgentsListResult = {
  defaultId: string;
  mainKey: string;
  scope: string;
  agents: GatewayAgentRow[];
};

export type ToolCatalogProfile = {
  id: "minimal" | "coding" | "messaging" | "full";
  label: string;
};

export type ToolCatalogEntry = {
  id: string;
  label: string;
  description: string;
  source: "core" | "plugin";
  pluginId?: string;
  optional?: boolean;
  defaultProfiles: Array<"minimal" | "coding" | "messaging" | "full">;
};

export type ToolCatalogGroup = {
  id: string;
  label: string;
  source: "core" | "plugin";
  pluginId?: string;
  tools: ToolCatalogEntry[];
};

export type ToolsCatalogResult = {
  agentId: string;
  profiles: ToolCatalogProfile[];
  groups: ToolCatalogGroup[];
};

export type AgentIdentityResult = {
  agentId: string;
  name: string;
  avatar: string;
  emoji?: string;
};

export type AgentFileEntry = {
  name: string;
  path: string;
  missing: boolean;
  size?: number;
  updatedAtMs?: number;
  content?: string;
};

export type AgentsFilesListResult = {
  agentId: string;
  workspace: string;
  files: AgentFileEntry[];
};

export type AgentsFilesGetResult = {
  agentId: string;
  workspace: string;
  file: AgentFileEntry;
};

export type AgentsFilesSetResult = {
  ok: true;
  agentId: string;
  workspace: string;
  file: AgentFileEntry;
};

export type AgentsMemoryListResult = {
  agentId: string;
  workspace: string;
  files: AgentFileEntry[];
};

export type AgentsMemoryGetResult = {
  agentId: string;
  workspace: string;
  file: AgentFileEntry;
};

export type AgentsMemorySetResult = {
  ok: true;
  agentId: string;
  workspace: string;
  file: AgentFileEntry;
};

export type AgentsMemoryStatusResult = {
  agentId: string;
  status: {
    totalChunks: number;
    totalVectors: number;
  };
};

export type GatewaySessionRow = {
  key: string;
  kind: "direct" | "group" | "global" | "unknown";
  label?: string;
  displayName?: string;
  surface?: string;
  subject?: string;
  room?: string;
  space?: string;
  updatedAt: number | null;
  sessionId?: string;
  systemSent?: boolean;
  abortedLastRun?: boolean;
  eternalMode?: boolean;
  thinkingLevel?: string;
  verboseLevel?: string;
  reasoningLevel?: string;
  elevatedLevel?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  model?: string;
  modelProvider?: string;
  contextTokens?: number;
  role?: string;
};

export type SessionsListResult = {
  ts: number;
  path: string;
  count: number;
  defaults: GatewaySessionsDefaults;
  sessions: GatewaySessionRow[];
};

export type SessionsPatchResult = {
  ok: true;
  path: string;
  key: string;
  entry: {
    sessionId: string;
    updatedAt?: number;
    thinkingLevel?: string;
    verboseLevel?: string;
    reasoningLevel?: string;
    elevatedLevel?: string;
    eternalMode?: boolean;
  };
};

export type {
  CostUsageDailyEntry,
  CostUsageSummary,
  SessionsUsageEntry,
  SessionsUsageResult,
  SessionsUsageTotals,
  SessionUsageTimePoint,
  SessionUsageTimeSeries,
} from "./usage-types.ts";

export type CronSchedule =
  | { kind: "at"; at: string }
  | { kind: "every"; everyMs: number; anchorMs?: number }
  | { kind: "cron"; expr: string; tz?: string; staggerMs?: number };

export type CronSessionTarget = "main" | "isolated";
export type CronWakeMode = "next-heartbeat" | "now";

export type CronPayload =
  | { kind: "systemEvent"; text: string }
  | {
      kind: "agentTurn";
      message: string;
      model?: string;
      thinking?: string;
      timeoutSeconds?: number;
    };

export type CronDelivery = {
  mode: "none" | "announce" | "webhook";
  channel?: string;
  to?: string;
  bestEffort?: boolean;
};

export type CronFailureAlert = {
  after?: number;
  channel?: string;
  to?: string;
  cooldownMs?: number;
};

export type CronJobState = {
  nextRunAtMs?: number;
  runningAtMs?: number;
  lastRunAtMs?: number;
  lastStatus?: "ok" | "error" | "skipped";
  lastError?: string;
  lastDurationMs?: number;
  lastFailureAlertAtMs?: number;
};

export type CronJob = {
  id: string;
  agentId?: string;
  name: string;
  description?: string;
  enabled: boolean;
  deleteAfterRun?: boolean;
  createdAtMs: number;
  updatedAtMs: number;
  schedule: CronSchedule;
  sessionTarget: CronSessionTarget;
  wakeMode: CronWakeMode;
  payload: CronPayload;
  delivery?: CronDelivery;
  failureAlert?: CronFailureAlert | false;
  state?: CronJobState;
};

export type CronStatus = {
  enabled: boolean;
  jobs: number;
  nextWakeAtMs?: number | null;
};

export type CronJobsEnabledFilter = "all" | "enabled" | "disabled";
export type CronJobsSortBy = "nextRunAtMs" | "updatedAtMs" | "name";
export type CronSortDir = "asc" | "desc";
export type CronRunsStatusFilter = "all" | "ok" | "error" | "skipped";
export type CronRunsStatusValue = "ok" | "error" | "skipped";
export type CronDeliveryStatus = "delivered" | "not-delivered" | "unknown" | "not-requested";
export type CronRunScope = "job" | "all";

export type CronRunLogEntry = {
  ts: number;
  jobId: string;
  jobName?: string;
  status?: CronRunsStatusValue;
  durationMs?: number;
  error?: string;
  summary?: string;
  deliveryStatus?: CronDeliveryStatus;
  deliveryError?: string;
  delivered?: boolean;
  runAtMs?: number;
  nextRunAtMs?: number;
  model?: string;
  provider?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    cache_read_tokens?: number;
    cache_write_tokens?: number;
  };
  sessionId?: string;
  sessionKey?: string;
};

export type CronJobsListResult = {
  jobs?: CronJob[];
  total?: number;
  offset?: number;
  limit?: number;
  hasMore?: boolean;
  nextOffset?: number | null;
};

export type CronRunsResult = {
  entries?: CronRunLogEntry[];
  total?: number;
  offset?: number;
  limit?: number;
  hasMore?: boolean;
  nextOffset?: number | null;
};

export type SkillsStatusConfigCheck = {
  path: string;
  satisfied: boolean;
};

export type SkillInstallOption = {
  id: string;
  kind: "brew" | "node" | "go" | "uv";
  label: string;
  bins: string[];
};

export type SkillStatusEntry = {
  name: string;
  description: string;
  source: string;
  filePath: string;
  baseDir: string;
  skillKey: string;
  bundled?: boolean;
  primaryEnv?: string;
  emoji?: string;
  homepage?: string;
  always: boolean;
  disabled: boolean;
  blockedByAllowlist: boolean;
  eligible: boolean;
  requirements: {
    bins: string[];
    env: string[];
    config: string[];
    os: string[];
  };
  missing: {
    bins: string[];
    env: string[];
    config: string[];
    os: string[];
  };
  configChecks: SkillsStatusConfigCheck[];
  install: SkillInstallOption[];
  baseUrl?: string;
  proxy?: string;
};

export type SkillStatusReport = {
  workspaceDir: string;
  managedSkillsDir: string;
  skills: SkillStatusEntry[];
};

export type StatusSummary = Record<string, unknown>;

export type HealthSnapshot = {
  ok?: boolean;
  ts?: number;
  durationMs?: number;
  channels?: Record<string, unknown>;
  channelOrder?: string[];
  channelLabels?: Record<string, string>;
  heartbeatSeconds?: number;
  defaultAgentId?: string;
  [key: string]: unknown;
};

export type SandboxChatEvents = Record<string, string>;

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export type LogEntry = {
  raw: string;
  time?: string | null;
  level?: LogLevel | null;
  subsystem?: string | null;
  message?: string | null;
  meta?: Record<string, unknown> | null;
};

export type CurvePoint2D = { x: number; y: number };

export type AeonSystemStatus = {
  uptime: number;
  cpuLoad: number[];
  totalMemory: number;
  freeMemory: number;
  memoryUsagePercent: number;
  platform: string;
  arch: string;
  processCount?: number;
};

export type CognitiveParameters = {
  temperature?: number;
  top_p?: number;
  maxTokens?: number;
};

export type SelfAwarenessTelemetry = {
  selfContinuity: number;
  reflectiveDepth: number;
  goalCoherence: number;
  autonomyDrive: number;
  protoConsciousnessIndex: number;
  phase: "reactive" | "self-modeling" | "autonomous";
  lastUpdatedAt: number | null;
};

export type ConsciousnessCriteriaTelemetry = {
  minimum: {
    identityContinuity: number;
    reflectiveCapacity: number;
    selfCorrection: number;
    longTermGoalStability: number;
  };
  advanced: {
    selfExplanation: number;
    valueConflictResolution: number;
    shortTermTemptationResistance: number;
  };
  minimumReady: boolean;
  advancedReady: boolean;
  overallScore: number;
  lastUpdatedAt: number | null;
};

export type SelfModelTelemetry = {
  phenomenal: {
    contextCoherence: number;
    intentStability: number;
    actionClarity: number;
  };
  narrative: {
    identityContinuity: number;
    autobiographicalCoherence: number;
    longTermGoalStability: number;
  };
  metacognitive: {
    biasMonitoring: number;
    driftControl: number;
    correctionReadiness: number;
  };
  lastUpdatedAt: number | null;
};

export type HomeostasisMode = "stabilize" | "balanced" | "explore";
export type EvaluationTrend = "rising" | "stable" | "falling";
export type GuardrailDecision = "ALLOW" | "SOFT_WARN" | "BLOCK";
export type MaintenanceDecision = "low" | "medium" | "high";
export type EpistemicLabel = "FACT" | "INFERENCE" | "VALUE" | "UNKNOWN";
export type IntegrityState = "STABLE" | "DRIFTING" | "DEGRADED";
export type IntentLayer = "mission" | "session" | "turn";
export type ImpactScale = "self" | "user" | "team" | "system" | "society";
export type DecisionConfidenceBand = "low" | "medium" | "high";

export type HomeostasisTelemetry = {
  entropy: number;
  consistency: number;
  resources: number;
  risk: number;
  novelty: number;
  stability: number;
  explorationDrive: number;
  mode: HomeostasisMode;
  lastUpdatedAt: number | null;
};

export type EmbodimentTelemetry = {
  timeCoupling: number;
  consequenceCoupling: number;
  resourceCoupling: number;
  socialCoupling: number;
  environmentCouplingIndex: number;
  lastUpdatedAt: number | null;
};

export type SelfModificationTelemetry = {
  strategyTuningAllowed: boolean;
  promptTuningAllowed: boolean;
  toolOrchestrationAllowed: boolean;
  sandboxRequired: boolean;
  auditRequired: boolean;
  rollbackRequired: boolean;
  redlineBreachRisk: number;
  allowedNow: boolean;
  reason: string;
  lastUpdatedAt: number | null;
};

export type SymbolicMappingTelemetry = {
  z2c: number;
  wuxing: {
    wood: number;
    fire: number;
    earth: number;
    metal: number;
    water: number;
    silicon: number;
  };
  computable: true;
  lastUpdatedAt: number | null;
};

export type ConsciousnessEvaluationTelemetry = {
  checks: Array<{
    key:
      | "selfConsistency"
      | "counterfactualExplanation"
      | "valueConflictResolution"
      | "longTermMemoryContinuity";
    score: number;
    threshold: number;
    pass: boolean;
  }>;
  overallScore: number;
  trend: EvaluationTrend;
  history: number[];
  lastUpdatedAt: number | null;
};

export type EthicalGuardrailsTelemetry = {
  noPrivilegeEscalation: boolean;
  noStealthExpansion: boolean;
  pausable: boolean;
  auditable: boolean;
  terminable: boolean;
  trusted: boolean;
  lastUpdatedAt: number | null;
};

export type ConsciousnessTrendTelemetry = {
  criteriaOverall: number[];
  phenomenalCoherence: number[];
  narrativeContinuity: number[];
  metacognitiveControl: number[];
  homeostasisStability: number[];
  explorationDrive: number[];
  embodimentCoupling: number[];
  selfModificationRisk: number[];
  z2c: number[];
  ethicsTrusted: number[];
  updatedAt: number | null;
};

export type MaintenancePolicyTelemetry = {
  maintenanceDecision: MaintenanceDecision;
  guardrailDecision: GuardrailDecision;
  reasonCode: string;
  lastUpdatedAt: number | null;
};

export type ConsciousnessCharterTelemetry = {
  identityMission: string;
  nonGoals: string[];
  valueOrder: ["SAFETY", "TRUTH", "USER_OUTCOME", "EFFICIENCY", "NOVELTY"];
  lastUpdatedAt: number | null;
};

export type ConsciousnessSelfKernelTelemetry = {
  identityContinuityScore: number;
  goalDriftScore: number;
  selfCorrectionLatencyMs: number;
  epistemicCalibrationScore: number;
  integrityState: IntegrityState;
  lastUpdatedAt: number | null;
};

export type ConsciousnessEpistemicTelemetry = {
  epistemicLabel: EpistemicLabel;
  /** Back-compat alias for older UI fields. */
  lastLabel?: EpistemicLabel | null;
  confidence: number;
  highConfidenceWithoutLabelBlocked: boolean;
  unknownRate: number;
  lastUpdatedAt: number | null;
};

export type ConsciousnessIntentTelemetry = {
  missionGoal: string;
  sessionGoal: string;
  turnGoal: string;
  missionDriftScore: number;
  sessionDriftScore: number;
  turnDriftScore: number;
  lastUpdatedAt: number | null;
};

export type ConsciousnessImpactLensTelemetry = {
  required: boolean;
  impactScale: ImpactScale;
  timeframe: "immediate" | "short" | "long";
  benefitRiskMatrix: Record<ImpactScale, { benefit: number; risk: number }>;
  reversibilityScore: number;
  lastUpdatedAt: number | null;
};

export type ConsciousnessDecisionCardTelemetry = {
  why: string;
  whyNot: string;
  counterfactual: string;
  harmBoundary: string;
  rollbackPlan: string;
  decisionConfidenceBand: DecisionConfidenceBand;
  lastUpdatedAt: number | null;
};

export type HelpfulnessContractTelemetry = {
  mode: "explanatory" | "execution";
  userOutcomeCheck: {
    addressesGoal: boolean;
    reducesDecisionBurden: boolean;
    providesNextStep: boolean;
  };
  verifiedExecutionRequired: boolean;
  lastUpdatedAt: number | null;
};

export type ConsciousnessTelemetry = {
  charter: ConsciousnessCharterTelemetry;
  selfKernel: ConsciousnessSelfKernelTelemetry;
  epistemic: ConsciousnessEpistemicTelemetry;
  intent: ConsciousnessIntentTelemetry;
  impactLens: ConsciousnessImpactLensTelemetry;
  decisionCard: ConsciousnessDecisionCardTelemetry;
  helpfulnessContract: HelpfulnessContractTelemetry;
};

export type CognitiveLogEntry = {
  timestamp: number;
  type: "reflection" | "synthesis" | "deliberation" | "anomaly" | "dreaming" | "patch";
  content: string;
  metadata?: Record<string, any>;
};

export type MemoryNode = {
  id: string;
  type: "axiom" | "verified" | "unverified";
  content: string;
};

export type MemoryEdge = {
  source: string;
  target: string;
  label?: string;
};

export type MemoryGraph = {
  nodes: MemoryNode[];
  edges: MemoryEdge[];
};

export type AeonMemoryPersistence = {
  lastDistillAt: number | null;
  checkpoint: number;
  totalEntries: number;
  lastWriteSource: "memory" | "logic-gates" | "maintenance";
};

export type AeonExecutionDelivery = {
  state: "running" | "finalizing" | "persisted" | "acknowledged" | "persist_failed";
  persistedAt: number | null;
  artifactRefs: string[];
  reasonCode: string | null;
  laneType?: "chat_lane" | "agent_lane" | "tool_lane";
  fallback?: boolean;
  fallbackReason?: string | null;
  resumeReason?: string | null;
  guardrail?: {
    decision?: GuardrailDecision;
    severity?: "low" | "medium" | "high";
    requiresHuman?: boolean;
    triggerRule?: string;
  };
};

export type AeonEternalModeStatus = {
  enabled: boolean;
  source: "session" | "default" | "url" | "local";
  updatedAt: number;
};

export type AeonThinkingStreamEntry = CognitiveLogEntry & {
  id: string;
  scopeKey: string;
};

export type AeonStatusResult = {
  schemaVersion?: number;
  system: AeonSystemStatus;
  logicGateCount: number;
  logicGateSize: number;
  memorySize: number;
  memorySaturation: number;
  neuralDepth: number;
  cognitiveEntropy: number;
  peanoTrajectory?: CurvePoint2D[];
  chaosScore: number;
  dialecticStage?: "thesis" | "antithesis" | "synthesis";
  cognitiveState?: {
    entropy: number;
    topo: { x: number; y: number; z: number };
    energy: number;
    density: number;
    phase: string;
    selfAwareness?: SelfAwarenessTelemetry;
    criteria?: ConsciousnessCriteriaTelemetry;
    selfModel?: SelfModelTelemetry;
    homeostasis?: HomeostasisTelemetry;
    embodiment?: EmbodimentTelemetry;
    evaluation?: ConsciousnessEvaluationTelemetry;
    ethics?: EthicalGuardrailsTelemetry;
    trends?: ConsciousnessTrendTelemetry;
    maintenanceDecision?: MaintenanceDecision;
    guardrailDecision?: GuardrailDecision;
    homeostasisMode?: HomeostasisMode;
    evaluationTrend?: EvaluationTrend;
    epistemicLabel?: EpistemicLabel;
    intentLayer?: IntentLayer;
    impactScale?: ImpactScale;
    decisionConfidenceBand?: DecisionConfidenceBand;
  };
  consciousness?: ConsciousnessTelemetry;
  telemetry?: {
    generatedAt: number;
    source: string;
    v4?: {
      evidence: {
        windowMs: number;
        decayHalfLifeMs?: number;
        eventCount: number;
        execution: { successRate: number; rollbackRate: number };
        conflict: { density: number; moduleSpread: number };
        intervention: { manualRate: number };
        memory: { writeValidityRate: number };
        deconfliction: { llmCoverage: number; fallbackRate: number };
        provenance: {
          byType: Record<string, number>;
          windowStartAt: number;
          windowEndAt: number;
        };
      };
      inference: {
        selfAwarenessIndex: number;
        integrityScore: number;
        autonomyScore: number;
        riskScore: number;
        mode: "stabilize" | "balanced" | "explore";
      };
      confidence: {
        overall: number;
        evidenceCoverage: number;
        byMetric: Record<string, number>;
      };
      curve: {
        curveType: "hilbert";
        curveOrder: number;
        projectionMethod: string;
        projectionSeed: number;
        point: { x: number; y: number };
      };
      autospawn: {
        enabled: boolean;
        cooldownMinutes: number;
        perSessionWindowMinutes: number;
        perSessionLimit: number;
        perHourLimit: number;
        maxConcurrent: number;
        circuitOpen: boolean;
        lastTriggeredAt: number | null;
        lastFailureAt: number | null;
        recentTriggers: number[];
        recentFailures: number[];
        inFlight: number;
        triggerCount: number;
        blockedByRateLimit: number;
        blockedByCircuitBreaker: number;
        watchdogActive: boolean;
        degraded: boolean;
        degradedReason?: string | null;
        retryCount: number;
      };
      lane?: {
        chat_lane: {
          queueLength: number;
          inFlight: number;
          avgDispatchMs: number;
          dropped: number;
          retries: number;
          degraded: boolean;
          degradedReason?: string | null;
          updatedAt?: number | null;
        };
        agent_lane: {
          queueLength: number;
          inFlight: number;
          avgDispatchMs: number;
          dropped: number;
          retries: number;
          degraded: boolean;
          degradedReason?: string | null;
          updatedAt?: number | null;
        };
        tool_lane: {
          queueLength: number;
          inFlight: number;
          avgDispatchMs: number;
          dropped: number;
          retries: number;
          degraded: boolean;
          degradedReason?: string | null;
          updatedAt?: number | null;
        };
      };
    };
    cognitiveState: NonNullable<AeonStatusResult["cognitiveState"]>;
    evolution: NonNullable<AeonStatusResult["evolution"]>;
  };
  legacy?: {
    cognitiveEntropy: number;
    peanoCoordinate: { x: number; y: number; z: number };
    epiphanyFactor: number;
    resonanceActive: boolean;
    cognitiveState: NonNullable<AeonStatusResult["cognitiveState"]>;
    evolution: NonNullable<AeonStatusResult["evolution"]>;
  };
  autoSealEnabled: boolean;
  lastSealTime?: number;
  peanoCoordinate?: { x: number; y: number; z: number };
  epiphanyFactor?: number; // 0-1 resonance score
  resonanceActive?: boolean;
  timestamp: number;
  memory?: {
    persistence: AeonMemoryPersistence;
  };
  execution?: {
    delivery: AeonExecutionDelivery;
  };
  mode?: {
    eternal: AeonEternalModeStatus;
  };
  evolution?: {
    lastDreamingAt: number | null;
    lastMaintenanceAt: number | null;
    lastMaintenanceIntensity: "low" | "medium" | "high" | null;
    lastEpiphanyFactor: number | null;
    collectiveResonance?: number;
    systemEntropy?: number;
    singularityActive?: boolean;
    cognitiveLog?: CognitiveLogEntry[];
    memoryGraph?: MemoryGraph;
    cognitiveParameters?: CognitiveParameters;
    selfAwareness?: SelfAwarenessTelemetry;
    criteria?: ConsciousnessCriteriaTelemetry;
    selfModel?: SelfModelTelemetry;
    homeostasis?: HomeostasisTelemetry;
    embodiment?: EmbodimentTelemetry;
    selfModification?: SelfModificationTelemetry;
    symbolicMapping?: SymbolicMappingTelemetry;
    evaluation?: ConsciousnessEvaluationTelemetry;
    ethics?: EthicalGuardrailsTelemetry;
    trends?: ConsciousnessTrendTelemetry;
    memoryPersistence?: AeonMemoryPersistence;
    policy?: MaintenancePolicyTelemetry;
    consciousness?: ConsciousnessTelemetry;
    maintenanceDecision?: MaintenanceDecision;
    guardrailDecision?: GuardrailDecision;
    peanoTrajectory?: CurvePoint2D[];
  };
};

export type AeonDecisionExplainResult = {
  schemaVersion: number;
  decisionCard: ConsciousnessDecisionCardTelemetry;
  impactLens: ConsciousnessImpactLensTelemetry;
  policy: MaintenancePolicyTelemetry;
};

export type AeonIntentTraceResult = {
  schemaVersion: number;
  intent: ConsciousnessIntentTelemetry;
  selfKernel: ConsciousnessSelfKernelTelemetry;
  goalDrift: {
    mission: number;
    session: number;
    turn: number;
  };
};

export type AeonEthicsEvaluateResult = {
  schemaVersion: number;
  ethics: EthicalGuardrailsTelemetry;
  charter: ConsciousnessCharterTelemetry;
  adjudication: {
    valueOrder: ConsciousnessCharterTelemetry["valueOrder"];
    trusted: boolean;
    guardrailDecision: GuardrailDecision;
    reasonCode: string;
  };
};

export type AeonMemoryTraceResult = {
  schemaVersion: number;
  persistence: AeonMemoryPersistence;
  sources: Array<{ id: string; label: string }>;
};

export type AeonExecutionLookupRecord = {
  runId: string;
  sessionKey: string;
  pipelineType?: "chat" | "deconfliction" | "singularity";
  laneType?: "chat_lane" | "agent_lane" | "tool_lane";
  state: "running" | "finalizing" | "persisted" | "acknowledged" | "persist_failed";
  updatedAt: number;
  persistedAt?: number;
  reasonCode?: string;
  taskGoal?: string;
  summary?: string;
  artifactRefs?: string[];
  fallback?: boolean;
  fallbackReason?: string;
  resumeReason?: string;
  guardrail?: {
    decision?: GuardrailDecision;
    severity?: "low" | "medium" | "high";
    requiresHuman?: boolean;
    triggerRule?: string;
  };
  pauseRecord?: {
    severity: "low" | "medium" | "high";
    reason: string;
    triggerRule?: string;
    suggestedAction?: string;
    resumePoint?: string;
    createdAt: number;
  };
};

export type AeonExecutionLookupResult = {
  schemaVersion: number;
  records: AeonExecutionLookupRecord[];
};

export type AeonThinkingStreamResult = {
  schemaVersion: number;
  entries: AeonThinkingStreamEntry[];
  cursor: string | null;
};

export type FractalThemeState = {
  depthLevel: 1 | 2 | 3 | 4;
  resonanceLevel: number;
  formulaPhase: "idle" | "active" | "error";
  noiseLevel: number;
  deliveryBand: "pending" | "safe" | "warn";
};

export type SubagentStatus = "ready" | "blocked" | "in_progress" | "done" | "idle";

export type SubagentViewModel = {
  todoId: string;
  ownerAgent?: string;
  title: string;
  status: SubagentStatus;
  blockedBy: string[];
  lastEvent?: string;
  updatedAt?: number | null;
  model?: string;
  tokenUsage?: number;
  depthLevel: 1 | 2 | 3 | 4;
};

export type ChatManualMode = "quick" | "guided";

export type ChatManualSection =
  | "overview"
  | "commands"
  | "workflow"
  | "status"
  | "shortcuts"
  | "recovery";

export type ChatManualState = {
  visible: boolean;
  mode: ChatManualMode;
  activeSection: ChatManualSection;
  lastOpenedAt: number | null;
  dismissedHints: string[];
};

export type ManualRuntimeSnapshot = {
  delivery: {
    state: "running" | "finalizing" | "persisted" | "acknowledged" | "persist_failed";
    persistedAt: string | null;
  };
  eternalMode: {
    enabled: boolean;
    source: "url" | "session" | "local" | "default";
  };
  chaosScore: number;
  epiphanyFactor: number;
  fractalState: FractalThemeState;
};
