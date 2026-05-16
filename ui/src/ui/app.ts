import { LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { i18n, I18nController, isSupportedLocale } from "../i18n/index.ts";
import {
  handleChannelConfigReload as handleChannelConfigReloadInternal,
  handleChannelConfigSave as handleChannelConfigSaveInternal,
  handleNostrProfileCancel as handleNostrProfileCancelInternal,
  handleNostrProfileEdit as handleNostrProfileEditInternal,
  handleNostrProfileFieldChange as handleNostrProfileFieldChangeInternal,
  handleNostrProfileImport as handleNostrProfileImportInternal,
  handleNostrProfileSave as handleNostrProfileSaveInternal,
  handleNostrProfileToggleAdvanced as handleNostrProfileToggleAdvancedInternal,
  handleWhatsAppLogout as handleWhatsAppLogoutInternal,
  handleWhatsAppStart as handleWhatsAppStartInternal,
  handleWhatsAppWait as handleWhatsAppWaitInternal,
  handleWeixinLogout as handleWeixinLogoutInternal,
  handleWeixinStart as handleWeixinStartInternal,
  handleWeixinWait as handleWeixinWaitInternal,
} from "./app-channels.ts";
import {
  handleAbortChat as handleAbortChatInternal,
  handleSendChat as handleSendChatInternal,
  removeQueuedMessage as removeQueuedMessageInternal,
} from "./app-chat.ts";
import { DEFAULT_CRON_FORM, DEFAULT_LOG_LEVEL_FILTERS } from "./app-defaults.ts";
import type { EventLogEntry } from "./app-events.ts";
import { connectGateway as connectGatewayInternal } from "./app-gateway.ts";
import {
  handleConnected,
  handleDisconnected,
  handleFirstUpdated,
  handleUpdated,
} from "./app-lifecycle.ts";
import { renderApp } from "./app-render.ts";
import {
  exportLogs as exportLogsInternal,
  handleChatScroll as handleChatScrollInternal,
  handleLogsScroll as handleLogsScrollInternal,
  resetChatScroll as resetChatScrollInternal,
  scheduleChatScroll as scheduleChatScrollInternal,
} from "./app-scroll.ts";
import {
  applySettings as applySettingsInternal,
  loadCron as loadCronInternal,
  loadOverview as loadOverviewInternal,
  setTab as setTabInternal,
  setTheme as setThemeInternal,
  onPopState as onPopStateInternal,
  refreshActiveTab as refreshActiveTabInternal,
} from "./app-settings.ts";
import { loadSessions as loadSessionsInternal } from "./controllers/sessions.ts";
import {
  resetToolStream as resetToolStreamInternal,
  type ToolStreamEntry,
  type CompactionStatus,
  type FallbackStatus,
} from "./app-tool-stream.ts";
import type { AppViewState } from "./app-view-state.ts";
import type { CognitivePlanConfirmDialog } from "./app-view-state.ts";
import { type AeonState, loadAeonLogic } from "./controllers/aeon.ts";
import {
  dispatchCognitiveTask,
  loadCognitiveTask,
  queryCognitiveMemory,
  formatCognitiveSourceLineSidebar,
  type CognitiveSourceContext,
  readCognitiveSourceContext,
  reflectCognitiveTask,
  replayCognitiveTask,
  runCognitiveDream,
  selectCognitiveTask,
  submitCognitiveTask,
  transitionCognitiveTask,
  type CognitiveLongTermEntry,
} from "./controllers/cognitive.ts";
import { formatMemoryResultSidebar, formatMemorySourceSidebar } from "./views/cognitive.ts";
import { normalizeAssistantIdentity } from "./assistant-identity.ts";
import { loadAssistantIdentity as loadAssistantIdentityInternal } from "./controllers/assistant-identity.ts";
import type { CronFieldErrors } from "./controllers/cron.ts";
import type { DevicePairingList } from "./controllers/devices.ts";
import type { ExecApprovalRequest } from "./controllers/exec-approval.ts";
import type { ExecApprovalsFile, ExecApprovalsSnapshot } from "./controllers/exec-approvals.ts";
import { loadSandboxCognitivePlan } from "./controllers/sandbox.ts";
import type { SkillMessage } from "./controllers/skills.ts";
import type { GatewayBrowserClient, GatewayHelloOk } from "./gateway.ts";
import type { Tab } from "./navigation.ts";
import { loadSettings, type UiSettings } from "./storage.ts";
import type { ResolvedTheme, ThemeMode } from "./theme.ts";
import type {
  AgentsListResult,
  AgentsFilesListResult,
  AgentIdentityResult,
  AgentsMemoryGetResult,
  AgentsMemoryListResult,
  AgentsMemoryStatusResult,
  ConfigSnapshot,
  ConfigUiHints,
  CronJob,
  CronRunLogEntry,
  CronStatus,
  HealthSnapshot,
  LogEntry,
  LogLevel,
  PresenceEntry,
  ChannelsStatusSnapshot,
  SessionsListResult,
  SkillStatusReport,
  ToolsCatalogResult,
  StatusSummary,
  AeonStatusResult,
  ChatManualMode,
  ChatManualSection,
  NostrProfile,
} from "./types.ts";
import { type ChatAttachment, type ChatQueueItem, type CronFormState } from "./ui-types.ts";
import { generateUUID } from "./uuid.ts";
import type { NostrProfileFormState } from "./views/channels.nostr-profile-form.ts";

declare global {
  interface Window {
    __OPENAEON_CONTROL_UI_BASE_PATH__?: string;
  }
}

const bootAssistantIdentity = normalizeAssistantIdentity({});

function resolveOnboardingMode(): boolean {
  if (!window.location.search) {
    return false;
  }
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("onboarding");
  if (!raw) {
    return false;
  }
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

@customElement("openaeon-app")
export class OPENAEONApp extends LitElement {
  private i18nController = new I18nController(this);
  clientInstanceId = generateUUID();
  @state() settings: UiSettings = loadSettings();
  constructor() {
    super();
    if (isSupportedLocale(this.settings.locale)) {
      void i18n.setLocale(this.settings.locale);
    }
  }
  @state() password = "";
  @state() tab: Tab = "chat";
  @state() onboarding = resolveOnboardingMode();
  @state() connected = false;
  @state() theme: ThemeMode = this.settings.theme ?? "system";
  @state() themeResolved: ResolvedTheme = "dark";
  @state() hello: GatewayHelloOk | null = null;
  @state() lastError: string | null = null;
  @state() lastErrorCode: string | null = null;
  @state() eventLog: EventLogEntry[] = [];
  private eventLogBuffer: EventLogEntry[] = [];
  private toolStreamSyncTimer: number | null = null;
  private sidebarCloseTimer: number | null = null;

  @state() assistantName = bootAssistantIdentity.name;
  @state() assistantAvatar = bootAssistantIdentity.avatar;
  @state() assistantAgentId = bootAssistantIdentity.agentId ?? null;

  @state() sessionKey = this.settings.sessionKey;
  @state() chatLoading = false;
  @state() chatSending = false;
  @state() chatMessage = "";
  @state() chatMessages: unknown[] = [];
  @state() chatToolMessages: unknown[] = [];
  @state() sandboxRecruitModalOpen = false;
  @state() chatStream: string | null = null;
  @state() chatStreamThinking: string | null = null;
  @state() chatStreamStartedAt: number | null = null;
  @state() chatRunId: string | null = null;
  @state() sandboxChatEvents: import("./types.js").SandboxChatEvents = {};
  @state() compactionStatus: CompactionStatus | null = null;
  @state() fallbackStatus: FallbackStatus | null = null;
  @state() chatAvatarUrl: string | null = null;
  @state() chatThinkingLevel: string | null = null;
  @state() chatChaosScore = 0;
  @state() chatEpiphanyFactor = 0;
  @state() chatQueue: ChatQueueItem[] = [];
  @state() chatAttachments: ChatAttachment[] = [];
  @state() chatManualRefreshInFlight = false;
  @state() chatWebSearchEnabled = this.settings.chatWebSearchEnabled ?? true;
  @state() chatManualVisible = false;
  @state() chatManualMode: ChatManualMode = "quick";
  @state() chatManualSection: ChatManualSection = "overview";
  @state() chatManualLastOpenedAt: number | null = null;
  @state() chatManualDismissedHints: string[] = [];
  // Sidebar state for tool output viewing
  @state() sidebarOpen = false;
  @state() sidebarContent: string | null = null;
  @state() sidebarError: string | null = null;
  @state() splitRatio = this.settings.splitRatio;

  @state() nodesLoading = false;
  @state() nodes: Array<Record<string, unknown>> = [];
  @state() devicesLoading = false;
  @state() devicesError: string | null = null;
  @state() devicesList: DevicePairingList | null = null;
  @state() execApprovalsLoading = false;
  @state() execApprovalsSaving = false;
  @state() execApprovalsDirty = false;
  @state() execApprovalsSnapshot: ExecApprovalsSnapshot | null = null;
  @state() execApprovalsForm: ExecApprovalsFile | null = null;
  @state() execApprovalsSelectedAgent: string | null = null;
  @state() execApprovalsTarget: "gateway" | "node" = "gateway";
  @state() execApprovalsTargetNodeId: string | null = null;
  @state() execApprovalQueue: ExecApprovalRequest[] = [];
  @state() execApprovalBusy = false;
  @state() execApprovalError: string | null = null;
  @state() pendingGatewayUrl: string | null = null;
  @state() cognitivePlanConfirmDialog: CognitivePlanConfirmDialog | null = null;
  @state() cognitivePlanGraphEdges: Array<{
    edgeId: string;
    from: string;
    to: string;
    relation: string;
    at: number;
  }> = [];
  @state() cognitivePlanGraphLoading = false;
  @state() cognitivePlanGraphError: string | null = null;
  @state() cognitivePlanGraphNodeId = "";
  @state() cognitivePlanGraphRelation = "";
  @state() cognitivePlanGraphAutoTrack = true;
  @state() cognitivePlanGraphPage = 1;
  @state() cognitivePlanGraphPageSize = 15;
  @state() cognitivePlanGraphTrail: string[] = [];
  @state() cognitivePlanGraphExpandedRelation = "";
  @state() cognitivePlanGraphSourceBreadcrumb: string | null = null;
  @state() cognitivePlanGraphSourceMemory: CognitiveLongTermEntry | null = null;
  @state() cognitivePlanGraphSourceContext: CognitiveSourceContext | null = null;
  @state() cognitivePlanGraphSourceSelectedLine: number | null = null;
  @state() cognitivePlanFocusTodoId: string | null = null;
  private cognitivePlanConfirmResolver: ((confirmed: boolean) => void) | null = null;

  @state() configLoading = false;
  @state() configRaw = "{\n}\n";
  @state() configRawOriginal = "";
  @state() configValid: boolean | null = null;
  @state() configIssues: unknown[] = [];
  @state() configSaving = false;
  @state() configApplying = false;
  @state() updateRunning = false;
  @state() applySessionKey = this.settings.lastActiveSessionKey;
  @state() configSnapshot: ConfigSnapshot | null = null;
  @state() configSchema: unknown = null;
  @state() configSchemaVersion: string | null = null;
  @state() configSchemaLoading = false;
  @state() configUiHints: ConfigUiHints = {};
  @state() configForm: Record<string, unknown> | null = null;
  @state() configFormOriginal: Record<string, unknown> | null = null;
  @state() configFormDirty = false;
  @state() configFormMode: "form" | "raw" = "form";
  @state() configSearchQuery = "";
  @state() configActiveSection: string | null = null;
  @state() configActiveSubsection: string | null = null;

  @state() channelsLoading = false;
  @state() channelsSnapshot: ChannelsStatusSnapshot | null = null;
  @state() channelsError: string | null = null;
  @state() channelsLastSuccess: number | null = null;
  @state() whatsappLoginMessage: string | null = null;
  @state() whatsappLoginQrDataUrl: string | null = null;
  @state() whatsappLoginConnected: boolean | null = null;
  @state() whatsappBusy = false;
  @state() weixinLoginMessage: string | null = null;
  @state() weixinLoginQrDataUrl: string | null = null;
  @state() weixinLoginConnected: boolean | null = null;
  @state() weixinBusy = false;
  @state() nostrProfileFormState: NostrProfileFormState | null = null;
  @state() nostrProfileAccountId: string | null = null;

  @state() presenceLoading = false;
  @state() presenceEntries: PresenceEntry[] = [];
  @state() presenceError: string | null = null;
  @state() presenceStatus: string | null = null;

  @state() agentsLoading = false;
  @state() agentsList: AgentsListResult | null = null;
  @state() agentsError: string | null = null;
  @state() agentsSelectedId: string | null = null;
  @state() toolsCatalogLoading = false;
  @state() toolsCatalogError: string | null = null;
  @state() toolsCatalogResult: ToolsCatalogResult | null = null;
  @state() agentsPanel: "overview" | "files" | "tools" | "skills" | "channels" | "cron" =
    "overview";
  @state() agentFilesLoading = false;
  @state() agentFilesError: string | null = null;
  @state() agentFilesList: AgentsFilesListResult | null = null;
  @state() agentFileContents: Record<string, string> = {};
  @state() agentFileDrafts: Record<string, string> = {};
  @state() agentFileActive: string | null = null;
  @state() agentFileSaving = false;
  @state() agentIdentityLoading = false;
  @state() agentIdentityError: string | null = null;
  @state() agentIdentityById: Record<string, AgentIdentityResult> = {};
  @state() agentSkillsLoading = false;
  @state() agentSkillsError: string | null = null;
  @state() agentSkillsReport: SkillStatusReport | null = null;
  @state() agentSkillsAgentId: string | null = null;

  @state() agentKnowledgeLoading = false;
  @state() agentKnowledgeError: string | null = null;
  @state() agentKnowledgeList: AgentsMemoryListResult | null = null;
  @state() agentKnowledgeStatus: AgentsMemoryStatusResult | null = null;
  @state() agentKnowledgeFileContents: Record<string, string> = {};
  @state() agentKnowledgeFileDrafts: Record<string, string> = {};
  @state() agentKnowledgeFileActive: string | null = null;
  @state() agentKnowledgeSaving = false;

  @state() aeonLogicLoading = false;
  @state() aeonLogicError: string | null = null;
  @state() aeonLogicContent: string | null = null;
  @state() aeonSystemStatus: AeonStatusResult | null = null;
  @state() aeonThinkingCursor: string | null = null;
  @state() aeonThinkingEvents: import("./types.ts").AeonThinkingStreamEntry[] = [];
  @state() cognitiveTaskRecord: import("./types.ts").CognitiveTaskRecord | null = null;
  @state() cognitiveTaskList: import("./types.ts").CognitiveTaskRecord[] = [];
  @state() cognitiveSelectedTaskId: string | null = null;
  @state() cognitiveRuntimeEvents: import("./controllers/cognitive.ts").CognitiveTaskEvent[] = [];
  @state() cognitiveSubmitTitle = "";
  @state() cognitiveSubmitText = "";
  @state() cognitiveMemoryQuery = "";
  @state() cognitiveMemoryTags = "";
  @state() cognitiveMemoryResults:
    | import("./controllers/cognitive.ts").CognitiveMemoryQueryResult
    | null = null;
  @state() cognitiveReplayRunId: string | null = null;
  @state() cognitiveReplayEvents: import("./controllers/cognitive.ts").CognitiveTaskEvent[] = [];
  @state() cognitiveReplayLoading = false;
  @state() cognitiveLoading = false;
  @state() cognitiveMemoryLoading = false;
  @state() cognitiveSourceContext:
    | import("./controllers/cognitive.ts").CognitiveSourceContext
    | null = null;
  @state() cognitiveSourceSelectedLine: number | null = null;
  @state() cognitiveSelectedMemoryResult:
    | import("./controllers/cognitive.ts").CognitiveLongTermEntry
    | null = null;
  @state() aeonEternalMode = this.settings.aeonEternalMode ?? false;
  @state() aeonEternalModeSource: "url" | "session" | "local" | "default" = "default";
  aeonEternalHydratedSessionKey: string | null = null;
  @state() aeonActiveTab: "logic" | "memory" = "logic";
  @state() aeonViewMode: "narrative" | "evidence" = "narrative";
  @state() aeonManualVisible = false;

  // Sandbox / Deep Agents cognitive plan state
  @state() sandboxCognitivePlan: import("./views/sandbox.js").CognitivePlanSnapshot | null = null;
  @state() sandboxCognitivePlanLoading = false;
  @state() sandboxCognitivePlanError: string | null = null;
  @state() executionWatchdog: {
    active: boolean;
    degraded: boolean;
    reason: string | null;
    retryCount: number;
    stagnantPolls: number;
    startedAt: number | null;
    lastProgressAt: number | null;
    lastDigest: string | null;
    lastRetryAt: number | null;
  } = {
    active: false,
    degraded: false,
    reason: null,
    retryCount: 0,
    stagnantPolls: 0,
    startedAt: null,
    lastProgressAt: null,
    lastDigest: null,
    lastRetryAt: null,
  };
  executionAutoQueued = false;
  /** Suppresses automatic cognitive-plan re-fetches; default true to avoid showing stale data on load. Lifted when user sends a real message. */
  sandboxCognitivePlanSuppressed = true;
  sandboxPollTimer: ReturnType<typeof setInterval> | null = null;

  @state() sessionsLoading = false;
  @state() sessionsResult: SessionsListResult | null = null;
  @state() sessionsError: string | null = null;
  @state() sessionsFilterActive = "";
  @state() sessionsFilterLimit = "120";
  @state() sessionsIncludeGlobal = true;
  @state() sessionsIncludeUnknown = false;
  @state() sessionsHideCron = true;

  @state() usageLoading = false;
  @state() usageResult: import("./types.js").SessionsUsageResult | null = null;
  @state() usageCostSummary: import("./types.js").CostUsageSummary | null = null;
  @state() usageError: string | null = null;
  @state() usageStartDate = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  @state() usageEndDate = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  @state() usageSelectedSessions: string[] = [];
  @state() usageSelectedDays: string[] = [];
  @state() usageSelectedHours: number[] = [];
  @state() usageChartMode: "tokens" | "cost" = "tokens";
  @state() usageDailyChartMode: "total" | "by-type" = "by-type";
  @state() usageTimeSeriesMode: "cumulative" | "per-turn" = "per-turn";
  @state() usageTimeSeriesBreakdownMode: "total" | "by-type" = "by-type";
  @state() usageTimeSeries: import("./types.js").SessionUsageTimeSeries | null = null;
  @state() usageTimeSeriesLoading = false;
  @state() usageTimeSeriesCursorStart: number | null = null;
  @state() usageTimeSeriesCursorEnd: number | null = null;
  @state() usageSessionLogs: import("./views/usage.js").SessionLogEntry[] | null = null;
  @state() usageSessionLogsLoading = false;
  @state() usageSessionLogsExpanded = false;
  // Applied query (used to filter the already-loaded sessions list client-side).
  @state() usageQuery = "";
  // Draft query text (updates immediately as the user types; applied via debounce or "Search").
  @state() usageQueryDraft = "";
  @state() usageSessionSort: "tokens" | "cost" | "recent" | "messages" | "errors" = "recent";
  @state() usageSessionSortDir: "desc" | "asc" = "desc";
  @state() usageRecentSessions: string[] = [];
  @state() usageTimeZone: "local" | "utc" = "local";
  @state() usageContextExpanded = false;
  @state() usageHeaderPinned = false;
  @state() usageSessionsTab: "all" | "recent" = "all";
  @state() usageVisibleColumns: string[] = [
    "channel",
    "agent",
    "provider",
    "model",
    "messages",
    "tools",
    "errors",
    "duration",
  ];
  @state() usageLogFilterRoles: import("./views/usage.js").SessionLogRole[] = [];
  @state() usageLogFilterTools: string[] = [];
  @state() usageLogFilterHasTools = false;
  @state() usageLogFilterQuery = "";

  // Non-reactive (don’t trigger renders just for timer bookkeeping).
  usageQueryDebounceTimer: number | null = null;

  @state() cronLoading = false;
  @state() cronJobsLoadingMore = false;
  @state() cronJobs: CronJob[] = [];
  @state() cronJobsTotal = 0;
  @state() cronJobsHasMore = false;
  @state() cronJobsNextOffset: number | null = null;
  @state() cronJobsLimit = 50;
  @state() cronJobsQuery = "";
  @state() cronJobsEnabledFilter: import("./types.js").CronJobsEnabledFilter = "all";
  @state() cronJobsScheduleKindFilter: import("./controllers/cron.js").CronJobsScheduleKindFilter =
    "all";
  @state() cronJobsLastStatusFilter: import("./controllers/cron.js").CronJobsLastStatusFilter =
    "all";
  @state() cronJobsSortBy: import("./types.js").CronJobsSortBy = "nextRunAtMs";
  @state() cronJobsSortDir: import("./types.js").CronSortDir = "asc";
  @state() cronStatus: CronStatus | null = null;
  @state() cronError: string | null = null;
  @state() cronForm: CronFormState = { ...DEFAULT_CRON_FORM };
  @state() cronFieldErrors: CronFieldErrors = {};
  @state() cronEditingJobId: string | null = null;
  @state() cronRunsJobId: string | null = null;
  @state() cronRunsLoadingMore = false;
  @state() cronRuns: CronRunLogEntry[] = [];
  @state() cronRunsTotal = 0;
  @state() cronRunsHasMore = false;
  @state() cronRunsNextOffset: number | null = null;
  @state() cronRunsLimit = 50;
  @state() cronRunsScope: import("./types.js").CronRunScope = "all";
  @state() cronRunsStatuses: import("./types.js").CronRunsStatusValue[] = [];
  @state() cronRunsDeliveryStatuses: import("./types.js").CronDeliveryStatus[] = [];
  @state() cronRunsStatusFilter: import("./types.js").CronRunsStatusFilter = "all";
  @state() cronRunsQuery = "";
  @state() cronRunsSortDir: import("./types.js").CronSortDir = "desc";
  @state() cronModelSuggestions: string[] = [];
  @state() cronBusy = false;

  @state() updateAvailable: import("./types.js").UpdateAvailable | null = null;

  @state() skillsLoading = false;
  @state() skillsReport: SkillStatusReport | null = null;
  @state() skillsError: string | null = null;
  @state() skillsFilter = "";
  @state() skillEdits: Record<string, string> = {};
  @state() skillsBusyKey: string | null = null;
  @state() skillMessages: Record<string, SkillMessage> = {};

  @state() debugLoading = false;
  @state() debugStatus: StatusSummary | null = null;
  @state() debugHealth: HealthSnapshot | null = null;
  @state() debugModels: unknown[] = [];
  @state() debugHeartbeat: unknown = null;
  @state() debugCallMethod = "";
  @state() debugCallParams = "{}";
  @state() debugCallResult: string | null = null;
  @state() debugCallError: string | null = null;

  @state() logsLoading = false;
  @state() logsError: string | null = null;
  @state() logsFile: string | null = null;
  @state() logsEntries: LogEntry[] = [];
  @state() logsFilterText = "";
  @state() logsLevelFilters: Record<LogLevel, boolean> = {
    ...DEFAULT_LOG_LEVEL_FILTERS,
  };
  @state() logsAutoFollow = true;
  @state() logsTruncated = false;
  @state() logsCursor: number | null = null;
  @state() logsLastFetchAt: number | null = null;
  @state() logsLimit = 500;
  @state() logsMaxBytes = 250_000;
  @state() logsAtBottom = true;

  client: GatewayBrowserClient | null = null;
  private chatScrollFrame: number | null = null;
  private chatScrollTimeout: number | null = null;
  private chatHasAutoScrolled = false;
  private chatUserNearBottom = true;
  @state() chatNewMessagesBelow = false;
  private nodesPollInterval: number | null = null;
  private logsPollInterval: number | null = null;
  private debugPollInterval: number | null = null;
  private aeonPollInterval: number | null = null;
  private logsScrollFrame: number | null = null;
  private toolStreamById = new Map<string, ToolStreamEntry>();
  private toolStreamOrder: string[] = [];
  refreshSessionsAfterChat = new Set<string>();
  basePath = "";
  private popStateHandler = () =>
    onPopStateInternal(this as unknown as Parameters<typeof onPopStateInternal>[0]);
  private themeMedia: MediaQueryList | null = null;
  private themeMediaHandler: ((event: MediaQueryListEvent) => void) | null = null;
  private topbarObserver: ResizeObserver | null = null;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    handleConnected(this as unknown as Parameters<typeof handleConnected>[0]);
  }

  protected firstUpdated() {
    handleFirstUpdated(this as unknown as Parameters<typeof handleFirstUpdated>[0]);
  }

  disconnectedCallback() {
    handleDisconnected(this as unknown as Parameters<typeof handleDisconnected>[0]);
    super.disconnectedCallback();
  }

  protected updated(changed: Map<PropertyKey, unknown>) {
    handleUpdated(this as unknown as Parameters<typeof handleUpdated>[0], changed);
  }

  connect() {
    connectGatewayInternal(this as unknown as Parameters<typeof connectGatewayInternal>[0]);
  }

  handleChatScroll(event: Event) {
    handleChatScrollInternal(
      this as unknown as Parameters<typeof handleChatScrollInternal>[0],
      event,
    );
  }

  handleLogsScroll(event: Event) {
    handleLogsScrollInternal(
      this as unknown as Parameters<typeof handleLogsScrollInternal>[0],
      event,
    );
  }

  exportLogs(lines: string[], label: string) {
    exportLogsInternal(lines, label);
  }

  resetToolStream() {
    resetToolStreamInternal(this as unknown as Parameters<typeof resetToolStreamInternal>[0]);
  }

  resetChatScroll() {
    resetChatScrollInternal(this as unknown as Parameters<typeof resetChatScrollInternal>[0]);
  }

  scrollToBottom(opts?: { smooth?: boolean }) {
    resetChatScrollInternal(this as unknown as Parameters<typeof resetChatScrollInternal>[0]);
    scheduleChatScrollInternal(
      this as unknown as Parameters<typeof scheduleChatScrollInternal>[0],
      true,
      Boolean(opts?.smooth),
    );
  }

  async setTab(next: Tab) {
    if (next === "aeon") {
      void this.handleAeonLogicRefresh();
    }
    if (next === "cognitive") {
      void this.handleCognitiveRefresh();
    }
    await setTabInternal(this as any, next);
  }

  async refreshActiveTab() {
    if (this.tab === "aeon") {
      void this.handleAeonLogicRefresh();
    }
    if (this.tab === "cognitive") {
      void this.handleCognitiveRefresh();
    }
    await refreshActiveTabInternal(this as any);
  }

  async loadAssistantIdentity() {
    await loadAssistantIdentityInternal(this);
  }

  applySettings(next: UiSettings) {
    applySettingsInternal(this as unknown as Parameters<typeof applySettingsInternal>[0], next);
  }

  setTheme(next: ThemeMode, context?: Parameters<typeof setThemeInternal>[2]) {
    setThemeInternal(this as unknown as Parameters<typeof setThemeInternal>[0], next, context);
  }

  async loadOverview() {
    await loadOverviewInternal(this as unknown as Parameters<typeof loadOverviewInternal>[0]);
  }

  async loadCron() {
    await loadCronInternal(this as unknown as Parameters<typeof loadCronInternal>[0]);
  }

  async handleAbortChat() {
    await handleAbortChatInternal(this as unknown as Parameters<typeof handleAbortChatInternal>[0]);
  }

  removeQueuedMessage(id: string) {
    removeQueuedMessageInternal(
      this as unknown as Parameters<typeof removeQueuedMessageInternal>[0],
      id,
    );
  }

  async handleSendChat(
    messageOverride?: string,
    opts?: Parameters<typeof handleSendChatInternal>[2],
  ) {
    await handleSendChatInternal(
      this as unknown as Parameters<typeof handleSendChatInternal>[0],
      messageOverride,
      opts,
    );
  }

  async handleWhatsAppStart(force: boolean) {
    await handleWhatsAppStartInternal(this, force);
  }

  async handleWhatsAppWait() {
    await handleWhatsAppWaitInternal(this);
  }

  async handleWhatsAppLogout() {
    await handleWhatsAppLogoutInternal(this);
  }

  async handleWeixinStart(force: boolean) {
    await handleWeixinStartInternal(this, force);
  }

  async handleWeixinWait() {
    await handleWeixinWaitInternal(this);
  }

  async handleWeixinLogout() {
    await handleWeixinLogoutInternal(this);
  }

  async handleChannelConfigSave() {
    await handleChannelConfigSaveInternal(this);
  }

  async handleChannelConfigReload() {
    await handleChannelConfigReloadInternal(this);
  }

  handleNostrProfileEdit(accountId: string, profile: NostrProfile | null) {
    handleNostrProfileEditInternal(this, accountId, profile);
  }

  handleNostrProfileCancel() {
    handleNostrProfileCancelInternal(this);
  }

  handleNostrProfileFieldChange(field: keyof NostrProfile, value: string) {
    handleNostrProfileFieldChangeInternal(this, field, value);
  }

  async handleNostrProfileSave() {
    await handleNostrProfileSaveInternal(this);
  }

  async handleNostrProfileImport() {
    await handleNostrProfileImportInternal(this);
  }

  handleNostrProfileToggleAdvanced() {
    handleNostrProfileToggleAdvancedInternal(this);
  }

  setChatMessage(next: string) {
    this.chatMessage = next;
  }

  async handleExecApprovalDecision(decision: "allow-once" | "allow-always" | "deny") {
    const active = this.execApprovalQueue[0];
    if (!active || !this.client || this.execApprovalBusy) {
      return;
    }
    this.execApprovalBusy = true;
    this.execApprovalError = null;
    try {
      await this.client.request("exec.approval.resolve", {
        id: active.id,
        decision,
      });
      this.execApprovalQueue = this.execApprovalQueue.filter((entry) => entry.id !== active.id);
    } catch (err) {
      this.execApprovalError = `Exec approval failed: ${String(err)}`;
    } finally {
      this.execApprovalBusy = false;
    }
  }

  handleGatewayUrlConfirm() {
    const nextGatewayUrl = this.pendingGatewayUrl;
    if (!nextGatewayUrl) {
      return;
    }
    this.pendingGatewayUrl = null;
    applySettingsInternal(this as unknown as Parameters<typeof applySettingsInternal>[0], {
      ...this.settings,
      gatewayUrl: nextGatewayUrl,
    });
    this.connect();
  }

  handleGatewayUrlCancel() {
    this.pendingGatewayUrl = null;
  }

  requestCognitivePlanConfirmation(dialog: CognitivePlanConfirmDialog): Promise<boolean> {
    if (this.cognitivePlanConfirmResolver) {
      this.cognitivePlanConfirmResolver(false);
      this.cognitivePlanConfirmResolver = null;
    }
    this.cognitivePlanConfirmDialog = dialog;
    return new Promise((resolve) => {
      this.cognitivePlanConfirmResolver = resolve;
    });
  }

  handleCognitivePlanConfirmDecision(confirmed: boolean) {
    const resolver = this.cognitivePlanConfirmResolver;
    this.cognitivePlanConfirmResolver = null;
    this.cognitivePlanConfirmDialog = null;
    resolver?.(confirmed);
  }

  // Sidebar handlers for tool output viewing
  handleOpenSidebar(content: string) {
    if (this.sidebarCloseTimer != null) {
      window.clearTimeout(this.sidebarCloseTimer);
      this.sidebarCloseTimer = null;
    }
    this.sidebarContent = content;
    this.sidebarError = null;
    this.sidebarOpen = true;
  }

  handleCloseSidebar() {
    this.sidebarOpen = false;
    // Clear content after transition
    if (this.sidebarCloseTimer != null) {
      window.clearTimeout(this.sidebarCloseTimer);
    }
    this.sidebarCloseTimer = window.setTimeout(() => {
      if (this.sidebarOpen) {
        return;
      }
      this.sidebarContent = null;
      this.sidebarError = null;
      this.sidebarCloseTimer = null;
    }, 200);
  }

  handleSplitRatioChange(ratio: number) {
    const newRatio = Math.max(0.4, Math.min(0.7, ratio));
    this.splitRatio = newRatio;
    this.applySettings({ ...this.settings, splitRatio: newRatio });
  }

  handleToggleWebSearch(enabled: boolean) {
    this.chatWebSearchEnabled = enabled;
    this.applySettings({ ...this.settings, chatWebSearchEnabled: enabled });
  }

  handleRecruitModalOpen() {
    this.sandboxRecruitModalOpen = true;
  }

  handleRecruitModalClose() {
    this.sandboxRecruitModalOpen = false;
  }

  async handleAgentAvatarChange(agentId: string, avatar: string) {
    if (!this.client) return;
    try {
      await this.client.request("agents.update", {
        agentId,
        avatar,
      });
      this.sandboxRecruitModalOpen = false;
      // Refresh to show updated avatar
      await this.loadSandboxData();
    } catch (err) {
      console.error("Failed to update agent avatar:", err);
    }
  }

  async handleAeonLogicRefresh() {
    await loadAeonLogic(this as unknown as AeonState);
  }

  async handleCognitiveRefresh() {
    await loadCognitiveTask(this as any);
  }

  async handleCognitiveSelectTask(taskId: string | null) {
    this.cognitiveReplayRunId = null;
    this.cognitiveReplayEvents = [];
    this.cognitiveSourceContext = null;
    this.cognitiveSourceSelectedLine = null;
    this.cognitiveSelectedMemoryResult = null;
    this.cognitivePlanGraphSourceBreadcrumb = null;
    this.cognitivePlanGraphSourceMemory = null;
    this.cognitivePlanGraphSourceContext = null;
    this.cognitivePlanGraphSourceSelectedLine = null;
    await selectCognitiveTask(this as any, taskId);
  }

  async handleCognitiveSubmitTask() {
    const text = this.cognitiveSubmitText.trim();
    if (!text) {
      return;
    }
    await submitCognitiveTask(this as any, {
      title: this.cognitiveSubmitTitle,
      text,
    });
    this.cognitiveSubmitTitle = "";
    this.cognitiveSubmitText = "";
  }

  async handleCognitiveTransition(
    to: "INIT" | "PLAN" | "EXECUTE" | "VERIFY" | "REFLECT" | "DONE" | "FAILED" | "ROLLED_BACK",
    reason?: string,
  ) {
    await transitionCognitiveTask(this as any, to, reason);
  }

  async handleCognitiveDispatch() {
    await dispatchCognitiveTask(this as any);
  }

  async handleCognitiveDream() {
    await runCognitiveDream(this as any);
  }

  async handleCognitiveReflect() {
    const latestEvent = [...this.cognitiveRuntimeEvents].at(-1);
    const output = latestEvent
      ? JSON.stringify(latestEvent.payload, null, 2)
      : (this.cognitiveTaskRecord?.input ?? "");
    const nodeId =
      latestEvent && typeof latestEvent.payload["nodeId"] === "string"
        ? String(latestEvent.payload["nodeId"])
        : undefined;
    await reflectCognitiveTask(this as any, {
      nodeId,
      output,
      success: true,
    });
  }

  async handleCognitiveMemoryQuery() {
    const tags = this.cognitiveMemoryTags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    await queryCognitiveMemory(this as any, {
      query: this.cognitiveMemoryQuery,
      tags,
      limit: 25,
      maxResults: 6,
    });
  }

  async handleCognitiveReplay(runId: string) {
    this.cognitiveReplayLoading = true;
    try {
      const events = await replayCognitiveTask(this as any, runId);
      if (!events) {
        return;
      }
      this.cognitiveReplayRunId = runId;
      this.cognitiveReplayEvents =
        events as import("./controllers/cognitive.ts").CognitiveTaskEvent[];
    } finally {
      this.cognitiveReplayLoading = false;
    }
  }

  private findCognitivePlanTodoByMemoryResult(result: CognitiveLongTermEntry) {
    const todos = Array.isArray(this.sandboxCognitivePlan?.todos)
      ? this.sandboxCognitivePlan.todos
      : [];
    const needles = [
      result.path,
      result.citation ?? "",
      result.text,
      result.path.split(/[\\/]/).pop() ?? "",
    ]
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    return todos.find((todo) => {
      const haystack = [
        todo.id,
        todo.title,
        todo.result ?? "",
        todo.ownerAgent ?? "",
        ...(Array.isArray(todo.acceptanceCriteria) ? todo.acceptanceCriteria : []),
      ]
        .map((value) => String(value).trim().toLowerCase())
        .filter(Boolean);
      return needles.some((needle) => haystack.some((field) => field.includes(needle)));
    });
  }

  private resolveTodoFocusFromGraphNode(nodeId: string): string | null {
    const normalized = nodeId.trim();
    if (!normalized) {
      return null;
    }
    const todos = Array.isArray(this.sandboxCognitivePlan?.todos)
      ? this.sandboxCognitivePlan.todos
      : [];
    const visibleTodos = todos.filter(
      (todo) => todo.status !== "done" || !String(todo.result ?? "").includes("placeholder"),
    );
    if (normalized.startsWith("todo:")) {
      const todoId = normalized.slice("todo:".length).trim();
      if (!todoId) {
        return null;
      }
      return visibleTodos.some((todo) => todo.id === todoId) ? todoId : null;
    }
    if (normalized.startsWith("task:")) {
      const taskId = normalized.slice("task:".length).trim();
      if (taskId && visibleTodos.some((todo) => todo.id === taskId)) {
        return taskId;
      }
    }
    if (visibleTodos.some((todo) => todo.id === normalized)) {
      return normalized;
    }
    if (normalized === "stage:planning") {
      return visibleTodos.find((todo) => todo.status === "todo")?.id ?? null;
    }
    if (normalized === "stage:execution") {
      return (
        visibleTodos.find((todo) => todo.status === "in_progress")?.id ??
        visibleTodos.find((todo) => todo.status === "todo")?.id ??
        null
      );
    }
    if (normalized === "stage:verification") {
      return visibleTodos.find((todo) => todo.status === "done")?.id ?? null;
    }
    return null;
  }

  private async queryCognitivePlanGraph(
    query: { nodeId?: string; relation?: string },
    originBreadcrumb?: string | null,
  ) {
    if (!this.connected || !this.sessionKey) {
      return [];
    }
    const normalizedNodeId = (query.nodeId ?? "").trim();
    const normalizedRelation = (query.relation ?? "").trim();
    const normalizedBreadcrumb = originBreadcrumb?.trim() ? originBreadcrumb.trim() : null;
    this.cognitivePlanGraphSourceBreadcrumb = normalizedBreadcrumb;
    if (!normalizedBreadcrumb) {
      this.cognitivePlanGraphSourceMemory = null;
      this.cognitivePlanGraphSourceContext = null;
      this.cognitivePlanGraphSourceSelectedLine = null;
    }
    this.cognitivePlanGraphLoading = true;
    this.cognitivePlanGraphError = null;
    this.cognitivePlanGraphNodeId = normalizedNodeId;
    this.cognitivePlanGraphRelation = normalizedRelation;
    this.cognitivePlanGraphPage = 1;
    if (normalizedNodeId) {
      const trail = this.cognitivePlanGraphTrail.filter((entry) => entry !== normalizedNodeId);
      this.cognitivePlanGraphTrail = [...trail, normalizedNodeId].slice(-12);
    }
    this.cognitivePlanFocusTodoId = this.resolveTodoFocusFromGraphNode(normalizedNodeId);
    try {
      const sourceEdges = Array.isArray(this.sandboxCognitivePlan?.graphEdges)
        ? this.sandboxCognitivePlan!.graphEdges
        : [];
      this.cognitivePlanGraphEdges = sourceEdges.filter((edge) => {
        if (
          normalizedNodeId &&
          !edge.from.includes(normalizedNodeId) &&
          !edge.to.includes(normalizedNodeId)
        ) {
          return false;
        }
        if (normalizedRelation && edge.relation !== normalizedRelation) {
          return false;
        }
        return true;
      });
      return this.cognitivePlanGraphEdges;
    } catch (err) {
      this.cognitivePlanGraphError = `Failed to query graph memory: ${String(err)}`;
      return [];
    } finally {
      this.cognitivePlanGraphLoading = false;
    }
  }

  async handleInspectMemoryResult(result: CognitiveLongTermEntry) {
    this.cognitiveSelectedMemoryResult = result;
    this.handleOpenSidebar(formatMemoryResultSidebar(result));
    this.cognitiveSourceContext = null;
    this.cognitiveSourceSelectedLine = null;
    try {
      const source = await readCognitiveSourceContext(this as any, {
        path: result.path,
        startLine: result.startLine,
        endLine: result.endLine,
        contextLines: 5,
      });
      if (!source) {
        return;
      }
      this.cognitiveSourceContext = source;
      this.cognitiveSourceSelectedLine = result.startLine;
      this.handleOpenSidebar(formatMemorySourceSidebar(result, source));
    } catch (err) {
      this.handleOpenSidebar(
        `${formatMemoryResultSidebar(result)}\n\n---\n\nFailed to load source context: ${String(err)}`,
      );
    }
  }

  handleSourceLineSelect(lineNo: number) {
    if (!this.cognitiveSourceContext) {
      return;
    }
    const normalized = Math.max(
      this.cognitiveSourceContext.contextStartLine,
      Math.min(this.cognitiveSourceContext.contextEndLine, Math.floor(lineNo)),
    );
    this.cognitiveSourceSelectedLine = normalized;
    if (this.cognitiveSelectedMemoryResult) {
      this.handleOpenSidebar(
        formatCognitiveSourceLineSidebar({
          result: this.cognitiveSelectedMemoryResult,
          source: this.cognitiveSourceContext,
          lineNo: normalized,
        }),
      );
    }
  }

  async handleTraceMemoryResult(result: CognitiveLongTermEntry) {
    const matchedTodo = this.findCognitivePlanTodoByMemoryResult(result);
    void this.setTab("chat");
    this.cognitivePlanGraphExpandedRelation = "";
    const sourceBreadcrumb = `${result.path}:${result.startLine}-${result.endLine}`;
    this.cognitivePlanGraphSourceMemory = result;
    this.cognitivePlanGraphSourceContext = this.cognitiveSourceContext;
    this.cognitivePlanGraphSourceSelectedLine =
      this.cognitiveSourceSelectedLine ?? result.startLine;
    if (matchedTodo) {
      await this.queryCognitivePlanGraph({ nodeId: matchedTodo.id }, sourceBreadcrumb);
      return;
    }
    await this.queryCognitivePlanGraph({ nodeId: result.path.trim() }, sourceBreadcrumb);
  }

  async handleOpenCognitiveSource() {
    const memory = this.cognitivePlanGraphSourceMemory;
    const source = this.cognitivePlanGraphSourceContext;
    const selectedLine = this.cognitivePlanGraphSourceSelectedLine;
    if (!memory) {
      return;
    }
    void this.setTab("cognitive");
    this.cognitiveSelectedMemoryResult = memory;
    if (source) {
      this.cognitiveSourceContext = source;
      this.cognitiveSourceSelectedLine = selectedLine ?? source.startLine;
      this.handleOpenSidebar(formatMemorySourceSidebar(memory, source));
      return;
    }
    await this.handleInspectMemoryResult(memory);
    if (selectedLine != null) {
      this.handleSourceLineSelect(selectedLine);
    }
  }

  async handleReopenCognitiveMemory() {
    const memory = this.cognitivePlanGraphSourceMemory;
    if (!memory) {
      return;
    }
    void this.setTab("cognitive");
    await this.handleInspectMemoryResult(memory);
  }

  async handleToggleEternalMode(next: boolean, source: "local" | "url" = "local") {
    this.aeonEternalMode = next;
    this.aeonEternalModeSource = source;
    this.applySettings({
      ...this.settings,
      aeonEternalMode: next,
    });
    if (!this.client || !this.connected || !this.sessionKey) {
      return;
    }
    try {
      await this.client.request("sessions.patch", {
        key: this.sessionKey,
        eternalMode: next,
      });
      this.aeonEternalHydratedSessionKey = this.sessionKey;
    } catch (err) {
      this.lastError = `Failed to persist eternal mode: ${String(err)}`;
    }
  }

  async handleAeonBacktrack(runId: string) {
    if (!this.client || !this.connected) return;
    try {
      this.aeonLogicLoading = true;
      const result = await this.client.request("aeon.simulate_trace", {
        runId,
        sessionKey: this.sessionKey,
      });
      console.log("Backtrack simulation result:", result);
      this.handleOpenSidebar(JSON.stringify(result, null, 2));
    } catch (err) {
      this.lastError = `Replay failed: ${String(err)}`;
    } finally {
      this.aeonLogicLoading = false;
    }
  }

  async handleAeonLogicCompaction() {
    if (!this.client || !this.connected) return;
    try {
      await this.handleSendChat("/seal", { restoreDraft: true });
    } catch (err) {
      console.error("Failed to trigger seal:", err);
    }
  }

  handleToggleAeonManual(visible: boolean) {
    this.aeonManualVisible = visible;
  }

  handleAeonTabChange(tab: "logic" | "memory") {
    this.aeonActiveTab = tab;
  }

  handleAeonViewModeChange(mode: "narrative" | "evidence") {
    this.aeonViewMode = mode;
  }

  handleToggleChatManual(
    visible: boolean,
    options?: { mode?: ChatManualMode; section?: ChatManualSection },
  ) {
    this.chatManualVisible = visible;
    if (visible) {
      this.chatManualLastOpenedAt = Date.now();
      if (options?.mode) {
        this.chatManualMode = options.mode;
      }
      if (options?.section) {
        this.chatManualSection = options.section;
      }
    }
  }

  async loadSandboxData() {
    // Helper to reload data after changes
    if (this.tab === "sandbox") {
      await loadSessionsInternal(this);
    }
  }

  render() {
    return renderApp(this as unknown as AppViewState);
  }
}
