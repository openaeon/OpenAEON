import { html, nothing } from "lit";
import { t } from "../../../../i18n/index.ts";
import type { SubagentViewModel } from "../../../types.ts";
import type { ChatLayoutProps } from "../../chat-layout.ts";
import { renderPlanExecutionLayer } from "./plan-sidebar.ts";
import { buildSubagentViewModel, getVisibleCognitivePlanTodos } from "./subagent-view-model.ts";

function renderSubagentCard(
  entry: SubagentViewModel,
  options: {
    selectedTodoId?: string | null;
    todoTitleById: Map<string, string>;
    onSelectTodoId?: (todoId: string | null) => void;
    onForceStart?: (todoId: string) => void;
  },
) {
  const statusClass =
    entry.status === "in_progress" ? "subagent-card--active" : "subagent-card--idle";
  const selectedClass =
    options.selectedTodoId && options.selectedTodoId === entry.todoId
      ? "subagent-card--selected"
      : "";
  const statusText =
    entry.status === "done"
      ? t("chat.sidebarStatusDone")
      : entry.status === "blocked"
        ? t("chat.sidebarStatusBlocked")
        : entry.status === "ready"
          ? t("chat.sidebarStatusReady")
          : entry.status === "in_progress"
            ? t("chat.sidebarStatusInProgress")
            : t("chat.sidebarStatusIdle");
  const statusIcon = entry.status === "in_progress" ? "∿" : entry.status === "done" ? "❖" : "⚬";
  const tokenUsageText =
    typeof entry.tokenUsage === "number" && Number.isFinite(entry.tokenUsage)
      ? entry.tokenUsage.toLocaleString()
      : "";
  return html`
    <div
      class="subagent-card node-card ${statusClass} ${selectedClass}"
      data-depth="${entry.depthLevel}"
      data-todo-id="${entry.todoId}"
    >
      <div class="subagent-card__header">
        <span class="subagent-card__icon node-icon">${statusIcon}</span>
        <span class="subagent-card__name node-name">${entry.title}</span>
        <div class="subagent-card__status-wrap">
          ${
            entry.status === "blocked" || entry.status === "ready"
              ? html`
                <button
                  class="subagent-card__action-btn subagent-card__action-btn--force"
                  title="Force Start"
                  @click=${(e: Event) => {
                    e.stopPropagation();
                    if (entry.todoId) options.onForceStart?.(entry.todoId);
                  }}
                >
                  ⚡
                </button>
              `
              : nothing
          }
          <span class="subagent-card__status status-badge">${statusText}</span>
        </div>
      </div>
      ${
        entry.ownerAgent
          ? html`<div class="subagent-card__task node-task">👤 ${entry.ownerAgent}</div>`
          : nothing
      }
      <div class="subagent-card__meta node-meta">
        <span class="subagent-card__chip data-chip">⟨IDP:${entry.depthLevel}⟩</span>
        ${entry.model ? html`<span class="subagent-card__chip data-chip">🤖 ${entry.model}</span>` : nothing}
        ${tokenUsageText ? html`<span class="subagent-card__chip data-chip">⚡ ${tokenUsageText} tok</span>` : nothing}
      </div>
      ${
        entry.status === "blocked" && entry.blockedBy.length > 0
          ? html`
              <div class="subagent-card__task node-task">
                ⛔ ${t("chat.sidebarBlockedBy")}:
                <span class="subagent-card__deps">
                  ${entry.blockedBy.map((depId) => {
                    const depTitle = options.todoTitleById.get(depId) ?? depId;
                    return html`
                      <button
                        class="subagent-card__dep"
                        type="button"
                        title=${`Focus dependency: ${depTitle}`}
                        @click=${() => options.onSelectTodoId?.(depId)}
                      >
                        ${depTitle}
                      </button>
                    `;
                  })}
                </span>
              </div>
            `
          : nothing
      }
      ${
        entry.lastEvent
          ? html`
              <div class="subagent-card__task node-task">↳ ${entry.lastEvent}</div>
            `
          : html`
              <div class="subagent-card__task node-task">${t("chat.sidebarNoExecutionFeedback")}</div>
            `
      }
      ${
        entry.status === "in_progress"
          ? html`
              <div class="subagent-card__pulse node-pulse"></div>
            `
          : nothing
      }
    </div>
  `;
}

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

function matchesQuery(entry: SubagentViewModel, query: string): boolean {
  if (!query) {
    return true;
  }
  const haystack = [
    entry.title,
    entry.ownerAgent,
    entry.model,
    entry.lastEvent,
    entry.status,
    ...entry.blockedBy,
  ]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

type SidebarControls = {
  query: string;
  onQueryChange?: (next: string) => void;
  statusFilter?: "all" | "running" | "blocked" | "done" | "ready";
  onStatusFilterChange?: (next: "all" | "running" | "blocked" | "done" | "ready") => void;
  selectedTodoId?: string | null;
  onSelectTodoId?: (todoId: string | null) => void;
  onCreateAgent?: () => void;
  autopilotEnabled?: boolean;
  onToggleAutopilot?: (enabled: boolean) => void;
  autopilotMaxConcurrent?: number;
  onAutopilotMaxConcurrentChange?: (maxConcurrent: number) => void;
  onAutopilotDispatchNow?: () => void;
  onForceStart?: (todoId: string) => void;
};

function matchStatus(
  entry: SubagentViewModel,
  statusFilter: NonNullable<SidebarControls["statusFilter"]>,
): boolean {
  if (statusFilter === "all") {
    return true;
  }
  if (statusFilter === "running") {
    return entry.status === "in_progress";
  }
  if (statusFilter === "blocked") {
    return entry.status === "blocked";
  }
  if (statusFilter === "done") {
    return entry.status === "done";
  }
  if (statusFilter === "ready") {
    return entry.status === "ready";
  }
  return true;
}

function getCollaborationHint(params: {
  blockedCount: number;
  readyCount: number;
  runningCount: number;
  staleCount: number;
  longRunningCount: number;
}): { text: string; action?: "dispatch" | "focus_blocked" | "reset" } {
  if (params.staleCount > 0) {
    return { text: t("chat.staleHint"), action: "reset" };
  }
  if (params.longRunningCount > 0) {
    return { text: t("chat.longRunningHint"), action: "focus_blocked" };
  }
  if (params.blockedCount > 0) {
    return { text: t("chat.blockedHint"), action: "focus_blocked" };
  }
  if (params.readyCount > 0 && params.runningCount === 0) {
    return { text: t("chat.readyHint"), action: "dispatch" };
  }
  if (params.runningCount > 0) {
    return { text: t("chat.runningHint") };
  }
  return { text: t("chat.noCollaborationHint") };
}

export function renderSubagentSidebar(props: ChatLayoutProps, controls?: SidebarControls) {
  const models =
    props.subagentViewModel ??
    buildSubagentViewModel({
      cognitivePlan: props.cognitivePlan,
      sandboxChatEvents: props.sandboxChatEvents,
      sessions: props.sandboxSessions,
    });
  const query = normalizeQuery(controls?.query ?? "");
  const statusFilter = controls?.statusFilter ?? "all";
  const selectedTodoId = controls?.selectedTodoId ?? null;
  const todoTitleById = new Map(models.map((entry) => [entry.todoId, entry.title]));
  const filteredModels = models.filter(
    (entry) =>
      matchesQuery(entry, query) &&
      matchStatus(entry, statusFilter) &&
      (!selectedTodoId ||
        entry.todoId === selectedTodoId ||
        entry.blockedBy.includes(selectedTodoId)),
  );
  const runningCount = models.filter((entry) => entry.status === "in_progress").length;
  const blockedCount = models.filter((entry) => entry.status === "blocked").length;
  const doneCount = models.filter((entry) => entry.status === "done").length;
  const readyCount = models.filter((entry) => entry.status === "ready").length;
  const visibleTodos = getVisibleCognitivePlanTodos(props.cognitivePlan);
  const blockedEdges = visibleTodos.reduce(
    (acc, todo) => acc + (props.cognitivePlan?.executionGraph?.blockedBy?.[todo.id]?.length ?? 0),
    0,
  );
  const staleCount = props.cognitivePlan?.executionGraph?.staleTodoIds?.length ?? 0;
  const longRunningCount = props.cognitivePlan?.executionGraph?.longRunningTodoIds?.length ?? 0;
  const collaborationHint = getCollaborationHint({
    blockedCount,
    readyCount,
    runningCount,
    staleCount,
    longRunningCount,
  });
  if (models.length === 0 && visibleTodos.length === 0) {
    return nothing;
  }
  const phase = props?.cognitivePlan?.phase || "execution";
  const hasExecutionLayer = visibleTodos.length > 0;
  const autoDispatch = props.cognitivePlan?.executionGraph?.autoDispatch;
  const autopilotEnabled = controls?.autopilotEnabled ?? autoDispatch?.enabled ?? true;
  const autopilotMaxConcurrent = Math.max(
    1,
    Math.min(8, controls?.autopilotMaxConcurrent ?? autoDispatch?.maxConcurrent ?? 2),
  );
  const queueDepth = autoDispatch?.queueDepth ?? readyCount;
  const effectiveRunningCount = autoDispatch?.runningCount ?? runningCount;
  const availableSlots = Math.max(0, autopilotMaxConcurrent - effectiveRunningCount);
  const parallelPressure = Math.max(0, queueDepth - availableSlots);
  const parallelHint =
    parallelPressure > 0
      ? t("chat.backlogHint", { count: String(parallelPressure) })
      : t("chat.parallelHealthy");
  const autopilotLabel = autoDispatch?.frozen
    ? `Frozen · ${autoDispatch.freezeReason ?? "policy"}`
    : `${t("chat.queue")} ${queueDepth} · ${t("chat.running")} ${effectiveRunningCount} · Max ${autopilotMaxConcurrent}x`;

  return html`
    <div class="orchestration-sidebar">
      <section class="orchestration-controls">
        <div class="orchestration-controls__autopilot">
          <span class="orchestration-controls__autopilot-label">${t("chat.autopilot")}</span>
          <button
            type="button"
            class="orchestration-controls__autopilot-toggle"
            data-enabled=${autopilotEnabled ? "true" : "false"}
            @click=${() => controls?.onToggleAutopilot?.(!autopilotEnabled)}
          >
            ${autopilotEnabled ? "ON" : "OFF"}
          </button>
          <span class="orchestration-controls__autopilot-meta">${autopilotLabel}</span>
        </div>
        <div class="orchestration-controls__parallel">
          <span class="orchestration-controls__parallel-label">${t("chat.parallelism")}</span>
          <div class="orchestration-controls__parallel-presets" role="group" aria-label="Max concurrent agents">
            ${([1, 2, 3, 4, 6] as const).map(
              (preset) => html`
                <button
                  type="button"
                  class="orchestration-controls__parallel-btn ${
                    autopilotMaxConcurrent === preset
                      ? "orchestration-controls__parallel-btn--active"
                      : ""
                  }"
                  @click=${() => controls?.onAutopilotMaxConcurrentChange?.(preset)}
                >
                  ${preset}x
                </button>
              `,
            )}
            <button
              type="button"
              class="orchestration-controls__dispatch"
              ?disabled=${!autopilotEnabled}
              @click=${() => controls?.onAutopilotDispatchNow?.()}
            >
              ${t("chat.dispatchNow")}
            </button>
          </div>
          <div class="orchestration-controls__parallel-meta">${parallelHint}</div>
        </div>
        <button
          class="orchestration-controls__create"
          type="button"
          @click=${() => controls?.onCreateAgent?.()}
        >
          + ${t("chat.newAgent")}
        </button>
        <label class="orchestration-controls__search-wrap" aria-label="Search agents">
          <span class="orchestration-controls__search-icon">⌕</span>
          <input
            class="orchestration-controls__search"
            type="text"
            placeholder="${t("chat.searchAgentsPlaceholder")}"
            .value=${controls?.query ?? ""}
            @input=${(event: Event) =>
              controls?.onQueryChange?.((event.target as HTMLInputElement).value)}
          />
        </label>
        <div class="orchestration-controls__stats" role="status" aria-live="polite">
          <span class="orchestration-controls__chip">${t("chat.fleet")} ${models.length}</span>
          <span class="orchestration-controls__chip orchestration-controls__chip--running">
            ${t("chat.running")} ${runningCount}
          </span>
          <span class="orchestration-controls__chip orchestration-controls__chip--blocked">
            ${t("chat.sidebarStatusBlocked")} ${blockedCount}
          </span>
          <span class="orchestration-controls__chip orchestration-controls__chip--done">
            ${t("chat.sidebarStatusDone")} ${doneCount}
          </span>
        </div>
        <div class="orchestration-controls__filters" role="tablist" aria-label="Filter agents">
          ${(["all", "running", "blocked", "ready", "done"] as const).map(
            (filter) => html`
              <button
                type="button"
                class="orchestration-controls__filter ${
                  statusFilter === filter ? "orchestration-controls__filter--active" : ""
                }"
                @click=${() => controls?.onStatusFilterChange?.(filter)}
              >
                ${filter}
              </button>
            `,
          )}
        </div>
        <div class="orchestration-controls__actions">
          <button
            type="button"
            class="orchestration-controls__action"
            @click=${() => controls?.onStatusFilterChange?.("ready")}
          >
            ${t("chat.focusReady")}
          </button>
          <button
            type="button"
            class="orchestration-controls__action"
            @click=${() => controls?.onStatusFilterChange?.("blocked")}
          >
            ${t("chat.focusBlocked")}
          </button>
          <button
            type="button"
            class="orchestration-controls__action"
            @click=${() => {
              controls?.onStatusFilterChange?.("all");
              controls?.onSelectTodoId?.(null);
            }}
          >
            ${t("chat.resetFocus")}
          </button>
        </div>
      </section>
      <section class="orchestration-handoff">
        <header class="orchestration-handoff__header">${t("chat.collaborationFlow")}</header>
        <div class="orchestration-handoff__metrics">
          <span>${t("chat.ready")} ${readyCount}</span>
          <span>${t("chat.blockedLinks")} ${blockedEdges}</span>
          <span>${t("chat.running")} ${runningCount}</span>
          <span>${t("chat.stale")} ${staleCount}</span>
          <span>${t("chat.longRunning")} ${longRunningCount}</span>
        </div>
        <div class="orchestration-handoff__hint">
          ${
            collaborationHint.action
              ? html`
                  <button
                    type="button"
                    class="orchestration-handoff__action-btn"
                    @click=${() => {
                      if (collaborationHint.action === "dispatch") {
                        controls?.onAutopilotDispatchNow?.();
                      } else if (collaborationHint.action === "focus_blocked") {
                        controls?.onStatusFilterChange?.("blocked");
                      } else if (collaborationHint.action === "reset") {
                        controls?.onStatusFilterChange?.("all");
                        controls?.onSelectTodoId?.(null);
                      }
                    }}
                  >
                    ${collaborationHint.text}
                  </button>
                `
              : collaborationHint.text
          }
        </div>
        ${
          selectedTodoId
            ? html`
                <div class="orchestration-handoff__focus">
                  ${t("chat.focus")}: ${todoTitleById.get(selectedTodoId) ?? selectedTodoId}
                  <button
                    type="button"
                    class="orchestration-handoff__focus-clear"
                    @click=${() => controls?.onSelectTodoId?.(null)}
                  >
                    ${t("chat.clear")}
                  </button>
                </div>
              `
            : nothing
        }
      </section>
      <section class="orchestration-section orchestration-section--agents">
        <header class="orchestration-section__header">
          <span class="plan-sidebar-title fractal-glitch" data-text="${t("chat.sidebarRoster")}">${t("chat.sidebarRoster")}</span>
          <span class="plan-sidebar-phase plan-sidebar-phase--${phase}">${phase.toUpperCase()}</span>
        </header>
        <div class="plan-sidebar-desc data-desc">Subagent Layer / 真实活跃代理</div>
        <div class="orchestration-section__body">
          ${
            filteredModels.length > 0
              ? html`
                  <div class="subagent-list">
                    ${filteredModels.map((entry) =>
                      renderSubagentCard(entry, {
                        selectedTodoId,
                        todoTitleById,
                        onSelectTodoId: controls?.onSelectTodoId,
                        onForceStart: controls?.onForceStart,
                      }),
                    )}
                  </div>
                `
              : html`
                  <div class="sidebar-empty">
                    ${
                      models.length > 0
                        ? t("chat.noAgentsMatched")
                        : t("chat.sidebarWaitingTaskAssignment")
                    }
                  </div>
                `
          }
        </div>
      </section>
      ${
        hasExecutionLayer
          ? html`
              <section class="orchestration-section orchestration-section--plan">
                <header class="orchestration-section__header">
                  <span class="plan-sidebar-title aeon-title">${t("chat.sidebarPlan")}</span>
                  <span class="plan-sidebar-phase plan-sidebar-phase--${phase}">${phase.toUpperCase()}</span>
                </header>
                <div class="plan-sidebar-desc data-desc">Plan Execution Layer / 执行状态机</div>
                <div class="orchestration-section__body orchestration-section__body--plan">
                  ${renderPlanExecutionLayer(props, { wrapPanel: false })}
                </div>
              </section>
            `
          : nothing
      }
    </div>
  `;
}
