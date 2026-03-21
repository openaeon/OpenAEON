import { html, nothing } from "lit";
import { t } from "../../../../i18n/index.ts";
import type { SubagentViewModel } from "../../../types.ts";
import type { ChatLayoutProps } from "../../chat-layout.ts";
import { renderPlanExecutionLayer } from "./plan-sidebar.ts";
import { buildSubagentViewModel, getVisiblePlanTodos } from "./subagent-view-model.ts";

function renderSubagentCard(entry: SubagentViewModel) {
  const statusClass = entry.status === "in_progress" ? "subagent-card--active" : "subagent-card--idle";
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
    <div class="subagent-card node-card ${statusClass}" data-depth="${entry.depthLevel}">
      <div class="subagent-card__header">
        <span class="subagent-card__icon node-icon">${statusIcon}</span>
        <span class="subagent-card__name node-name">${entry.title}</span>
        <span class="subagent-card__status status-badge">${statusText}</span>
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
              <div class="subagent-card__task node-task">⛔ ${t("chat.sidebarBlockedBy")}: ${entry.blockedBy.join(", ")}</div>
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

export function renderSubagentSidebar(props: ChatLayoutProps) {
  const models =
    props.subagentViewModel ??
    buildSubagentViewModel({
      taskPlan: props.taskPlan,
      sandboxChatEvents: props.sandboxChatEvents,
      sessions: props.sandboxSessions,
    });
  const visibleTodos = getVisiblePlanTodos(props.taskPlan);
  if (models.length === 0 && visibleTodos.length === 0) {
    return nothing;
  }
  const phase = props?.taskPlan?.phase || "execution";
  const hasExecutionLayer = visibleTodos.length > 0;

  return html`
    <div class="orchestration-sidebar">
      <section class="orchestration-section orchestration-section--agents">
        <header class="orchestration-section__header">
          <span class="plan-sidebar-title fractal-glitch" data-text="${t("chat.sidebarRoster")}">${t("chat.sidebarRoster")}</span>
          <span class="plan-sidebar-phase plan-sidebar-phase--${phase}">${phase.toUpperCase()}</span>
        </header>
        <div class="plan-sidebar-desc data-desc">Subagent Layer / 真实活跃代理</div>
        <div class="orchestration-section__body">
          ${
            models.length > 0
              ? html`
                  <div class="subagent-list">${models.map((entry) => renderSubagentCard(entry))}</div>
                `
              : html`<div class="sidebar-empty">${t("chat.sidebarWaitingTaskAssignment")}</div>`
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
