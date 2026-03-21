import { html, nothing } from "lit";
import { ref } from "lit/directives/ref.js";
import { repeat } from "lit/directives/repeat.js";
import {
  renderMessageGroup,
  renderReadingIndicatorGroup,
  renderStreamingGroup,
} from "../chat/grouped-render.ts";
import { normalizeMessage, normalizeRoleForGrouping } from "../chat/message-normalizer.ts";
import { icons } from "../icons.ts";
import { detectTextDirection } from "../text-direction.ts";
import type {
  GatewaySessionRow,
  SessionsListResult,
  ChatManualState,
  ChatManualMode,
  ChatManualSection,
  ManualRuntimeSnapshot,
  SubagentViewModel,
} from "../types.ts";
import type { ChatItem, MessageGroup } from "../types/chat-types.ts";
import type { ChatAttachment, ChatQueueItem } from "../ui-types.ts";
import { renderMarkdownSidebar } from "./markdown-sidebar.ts";
import "../components/resizable-divider.ts";
import "./chat-layout.ts";
import {
  buildSubagentViewModel,
} from "./chat/components/subagent-view-model.ts";

export type CompactionIndicatorStatus = {
  active: boolean;
  startedAt: number | null;
  completedAt: number | null;
};

export type FallbackIndicatorStatus = {
  phase?: "active" | "cleared";
  selected: string;
  active: string;
  previous?: string;
  reason?: string;
  attempts: string[];
  occurredAt: number;
};
import type { TaskPlanSnapshot } from "../views/sandbox.ts";

export type ChatProps = {
  performanceMode?: "performance" | "balanced" | "visual";
  sessionKey: string;
  onSessionKeyChange: (next: string) => void;
  thinkingLevel: string | null;
  showThinking: boolean;
  loading: boolean;
  sending: boolean;
  canAbort?: boolean;
  compactionStatus?: CompactionIndicatorStatus | null;
  fallbackStatus?: FallbackIndicatorStatus | null;
  messages: unknown[];
  toolMessages: unknown[];
  stream: string | null;
  streamThinking?: string | null;
  streamStartedAt: number | null;
  assistantAvatarUrl?: string | null;
  draft: string;
  queue: ChatQueueItem[];
  connected: boolean;
  canSend: boolean;
  disabledReason: string | null;
  error: string | null;
  sessions: SessionsListResult | null;
  // Focus mode
  focusMode: boolean;
  // Task Plan (from sandbox state)
  taskPlan?: TaskPlanSnapshot | null;
  executionWatchdog?: {
    active: boolean;
    degraded: boolean;
    reason: string | null;
    retryCount: number;
  };
  // Sidebar state
  sidebarOpen?: boolean;
  sidebarContent?: string | null;
  sidebarError?: string | null;
  splitRatio?: number;
  assistantName: string;
  assistantAvatar: string | null;
  // Image attachments
  attachments?: ChatAttachment[];
  onAttachmentsChange?: (attachments: ChatAttachment[]) => void;
  // Scroll control
  showNewMessages?: boolean;
  onScrollToBottom?: () => void;
  // Event handlers
  onRefresh: () => void;
  onToggleFocusMode: () => void;
  onDraftChange: (next: string) => void;
  onSend: () => void;
  onAbort?: () => void;
  onQueueRemove: (id: string) => void;
  onNewSession: () => void;
  onOpenSandbox?: () => void;
  onOpenAeon?: () => void;
  eternalMode?: boolean;
  onToggleEternalMode?: () => void;
  onOpenSidebar?: (content: string) => void;
  onCloseSidebar?: () => void;
  onSplitRatioChange?: (ratio: number) => void;
  onChatScroll?: (event: Event) => void;
  webSearchEnabled?: boolean;
  onToggleWebSearch?: (enabled: boolean) => void;
  // Plan approval
  onApprovePlan?: () => void;
  onQuickCommand?: (command: ChatQuickCommand) => void;
  // Subagent details for sidebar
  sandboxChatEvents?: import("../types.ts").SandboxChatEvents;
  sandboxSessions?: GatewaySessionRow[];
  subagentViewModel?: SubagentViewModel[];
  subagentMatchMode?: "owner_first" | "balanced" | "fuzzy";
  cognitiveLog?: import("../types.ts").CognitiveLogEntry[];
  executionDelivery?: import("../types.ts").AeonExecutionDelivery;
  fractalState?: import("../types.ts").FractalThemeState;
  manualState?: ChatManualState;
  manualRuntime?: ManualRuntimeSnapshot;
  onManualToggle?: (
    visible: boolean,
    options?: { mode?: ChatManualMode; section?: ChatManualSection },
  ) => void;
  onManualModeChange?: (mode: ChatManualMode) => void;
  onManualSectionChange?: (section: ChatManualSection) => void;
  chaosScore: number;
  epiphanyFactor: number;
  riskScore: number;
  memorySaturation: number;
};

export type ChatQuickCommand = {
  name: string;
  args: string[];
  raw: string;
};

const COMPACTION_TOAST_DURATION_MS = 5000;
const FALLBACK_TOAST_DURATION_MS = 8000;

function adjustTextareaHeight(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function renderCompactionIndicator(status: CompactionIndicatorStatus | null | undefined) {
  if (!status) {
    return nothing;
  }

  // Show "compacting..." while active
  if (status.active) {
    return html`
      <div class="compaction-indicator compaction-indicator--active" role="status" aria-live="polite">
        ${icons.loader} Compacting context...
      </div>
    `;
  }

  // Show "compaction complete" briefly after completion
  if (status.completedAt) {
    const elapsed = Date.now() - status.completedAt;
    if (elapsed < COMPACTION_TOAST_DURATION_MS) {
      return html`
        <div class="compaction-indicator compaction-indicator--complete" role="status" aria-live="polite">
          ${icons.check} Context compacted
        </div>
      `;
    }
  }

  return nothing;
}

function renderFallbackIndicator(status: FallbackIndicatorStatus | null | undefined) {
  if (!status) {
    return nothing;
  }
  const phase = status.phase ?? "active";
  const elapsed = Date.now() - status.occurredAt;
  if (elapsed >= FALLBACK_TOAST_DURATION_MS) {
    return nothing;
  }
  const details = [
    `Selected: ${status.selected}`,
    phase === "cleared" ? `Active: ${status.selected}` : `Active: ${status.active}`,
    phase === "cleared" && status.previous ? `Previous fallback: ${status.previous}` : null,
    status.reason ? `Reason: ${status.reason}` : null,
    status.attempts.length > 0 ? `Attempts: ${status.attempts.slice(0, 3).join(" | ")}` : null,
  ]
    .filter(Boolean)
    .join(" • ");
  const message =
    phase === "cleared"
      ? `Fallback cleared: ${status.selected}`
      : `Fallback active: ${status.active}`;
  const className =
    phase === "cleared"
      ? "compaction-indicator compaction-indicator--fallback-cleared"
      : "compaction-indicator compaction-indicator--fallback";
  const icon = phase === "cleared" ? icons.check : icons.brain;
  return html`
    <div
      class=${className}
      role="status"
      aria-live="polite"
      title=${details}
    >
      ${icon} ${message}
    </div>
  `;
}

export function renderChat(props: ChatProps) {
  const activeSession = props.sessions?.sessions?.find((row) => row.key === props.sessionKey);
  const reasoningLevel = activeSession?.reasoningLevel ?? "off";
  const showReasoning = props.showThinking && reasoningLevel !== "off";
  const fractalState = props.fractalState ?? deriveFractalState(props);
  const assistantIdentity = {
    name: props.assistantName,
    avatar: props.assistantAvatar ?? props.assistantAvatarUrl ?? null,
  };

  const subagentViewModel =
    props.subagentViewModel ??
    buildSubagentViewModel({
      taskPlan: props.taskPlan,
      sandboxChatEvents: props.sandboxChatEvents,
      sessions: props.sandboxSessions,
      matchMode: props.subagentMatchMode,
    });

  return html`
    <chat-layout .props=${{ ...props, fractalState, subagentViewModel }}>
      <div slot="messages" style="display: contents;">
        ${
          props.loading
            ? html`
                <div class="muted">Loading chat…</div>
              `
            : nothing
        }
        ${repeat(
          buildChatItems(props),
          (item) => item.key,
          (item) => {
            if (item.kind === "divider") {
              return html`
                <div class="chat-divider" role="separator" data-ts=${String(item.timestamp)}>
                  <span class="chat-divider__line"></span>
                  <span class="chat-divider__label">${item.label}</span>
                  <span class="chat-divider__line"></span>
                </div>
              `;
            }

            if (item.kind === "reading-indicator") {
              return renderReadingIndicatorGroup(assistantIdentity);
            }

            if (item.kind === "stream") {
              return renderStreamingGroup(
                item.text,
                item.startedAt,
                props.onOpenSidebar,
                assistantIdentity,
                item.thinking,
                showReasoning,
                props.chaosScore,
                props.epiphanyFactor,
              );
            }

            if (item.kind === "group") {
              return renderMessageGroup(item, {
                onOpenSidebar: props.onOpenSidebar,
                showReasoning,
                assistantName: props.assistantName,
                assistantAvatar: assistantIdentity.avatar,
              });
            }

            return nothing;
          },
        )}
      </div>
    </chat-layout>
  `;
}

function deriveFractalState(props: ChatProps): import("../types.ts").FractalThemeState {
  const chaos = Math.max(0, Math.min(1, (props.chaosScore ?? 0) / 10));
  const resonance = Math.max(0, Math.min(1, props.epiphanyFactor ?? 0));
  const depthRaw = 1 + Math.round((chaos * 0.65 + resonance * 0.35) * 3);
  const depthLevel = Math.max(1, Math.min(4, depthRaw)) as 1 | 2 | 3 | 4;
  const running = Boolean(props.stream?.trim());
  const delivery = props.executionDelivery?.state ?? "persist_failed";
  const formulaPhase = delivery === "persist_failed" ? "error" : running ? "active" : "idle";
  const deliveryBand =
    delivery === "persist_failed"
      ? "warn"
      : delivery === "persisted" || delivery === "acknowledged"
        ? "safe"
        : "pending";
  const noiseLevel = Math.max(0.08, Math.min(0.9, 0.15 + chaos * 0.55));
  return {
    depthLevel,
    resonanceLevel: resonance,
    formulaPhase,
    noiseLevel,
    deliveryBand,
  };
}

const CHAT_HISTORY_RENDER_LIMIT = 200;

function groupMessages(items: ChatItem[]): Array<ChatItem | MessageGroup> {
  const result: Array<ChatItem | MessageGroup> = [];
  let currentGroup: MessageGroup | null = null;

  for (const item of items) {
    if (item.kind !== "message") {
      if (currentGroup) {
        result.push(currentGroup);
        currentGroup = null;
      }
      result.push(item);
      continue;
    }

    const normalized = normalizeMessage(item.message);
    const role = normalizeRoleForGrouping(normalized.role);
    const timestamp = normalized.timestamp || Date.now();

    if (!currentGroup || currentGroup.role !== role) {
      if (currentGroup) {
        result.push(currentGroup);
      }
      currentGroup = {
        kind: "group",
        key: `group:${role}:${item.key}`,
        role,
        messages: [{ message: item.message, key: item.key }],
        timestamp,
        isStreaming: false,
      };
    } else {
      currentGroup.messages.push({ message: item.message, key: item.key });
    }
  }

  if (currentGroup) {
    result.push(currentGroup);
  }
  return result;
}

function buildChatItems(props: ChatProps): Array<ChatItem | MessageGroup> {
  const items: ChatItem[] = [];
  const history = Array.isArray(props.messages) ? props.messages : [];
  const tools = Array.isArray(props.toolMessages) ? props.toolMessages : [];
  const historyStart = Math.max(0, history.length - CHAT_HISTORY_RENDER_LIMIT);
  if (historyStart > 0) {
    items.push({
      kind: "message",
      key: "chat:history:notice",
      message: {
        role: "system",
        content: `Showing last ${CHAT_HISTORY_RENDER_LIMIT} messages (${historyStart} hidden).`,
        timestamp: Date.now(),
      },
    });
  }
  for (let i = historyStart; i < history.length; i++) {
    const msg = history[i];
    const normalized = normalizeMessage(msg);
    const raw = msg as Record<string, unknown>;
    const marker = raw.__openaeon as Record<string, unknown> | undefined;
    if (marker && marker.kind === "compaction") {
      items.push({
        kind: "divider",
        key:
          typeof marker.id === "string"
            ? `divider:compaction:${marker.id}`
            : `divider:compaction:${normalized.timestamp}:${i}`,
        label: "Compaction",
        timestamp: normalized.timestamp ?? Date.now(),
      });
      continue;
    }

    if (!props.showThinking && normalized.role.toLowerCase() === "toolresult") {
      continue;
    }

    items.push({
      kind: "message",
      key: messageKey(msg, i),
      message: msg,
    });
  }
  if (props.showThinking) {
    for (let i = 0; i < tools.length; i++) {
      items.push({
        kind: "message",
        key: messageKey(tools[i], i + history.length),
        message: tools[i],
      });
    }
  }

  if (props.stream !== null) {
    const key = `stream:${props.sessionKey}:${props.streamStartedAt ?? "live"}`;
    if (props.stream.trim().length > 0) {
      items.push({
        kind: "stream",
        key,
        text: props.stream,
        thinking: props.streamThinking ?? undefined,
        startedAt: props.streamStartedAt ?? Date.now(),
      });
    } else if (props.streamThinking?.trim()) {
      items.push({
        kind: "stream",
        key,
        text: "",
        thinking: props.streamThinking,
        startedAt: props.streamStartedAt ?? Date.now(),
      });
    } else {
      items.push({ kind: "reading-indicator", key });
    }
  }

  return groupMessages(items);
}

function messageKey(message: unknown, index: number): string {
  const m = message as Record<string, unknown>;
  const toolCallId = typeof m.toolCallId === "string" ? m.toolCallId : "";
  if (toolCallId) {
    return `tool:${toolCallId}`;
  }
  const id = typeof m.id === "string" ? m.id : "";
  if (id) {
    return `msg:${id}`;
  }
  const messageId = typeof m.messageId === "string" ? m.messageId : "";
  if (messageId) {
    return `msg:${messageId}`;
  }
  const timestamp = typeof m.timestamp === "number" ? m.timestamp : null;
  const role = typeof m.role === "string" ? m.role : "unknown";
  if (timestamp != null) {
    return `msg:${role}:${timestamp}:${index}`;
  }
  return `msg:${role}:${index}`;
}
