import { html, nothing } from "lit";
import { t } from "../../../../i18n/index.ts";
import { extractToolCards } from "../../../chat/tool-cards.ts";
import type { GatewaySessionRow } from "../../../types.ts";
import type { TaskPlanSnapshot, TaskTodo } from "../types.ts";

/** ─── Task status helpers ────────────────────────────────────────────────────── */
export function tokenProgress(row: GatewaySessionRow): number {
  if (!row.outputTokens || !row.inputTokens) {
    return 0;
  }
  const ratio = row.outputTokens / (row.inputTokens + row.outputTokens);
  return Math.min(100, Math.round(ratio * 100));
}

export function relativeTime(ts: number | null | undefined): string {
  if (!ts) {
    return "—";
  }
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) {
    return String(t("sandbox.relativeTime.secondsAgo", { seconds: String(secs) }));
  }
  if (secs < 3600) {
    return String(t("sandbox.relativeTime.minutesAgo", { minutes: String(Math.floor(secs / 60)) }));
  }
  return String(t("sandbox.relativeTime.hoursAgo", { hours: String(Math.floor(secs / 3600)) }));
}

export function sessionStatusLabel(row: GatewaySessionRow, isWorking: boolean): string {
  if (row.role === "manager") {
    if (isWorking) return t("sandbox.card.orchestrating");
    if (row.abortedLastRun) return t("sandbox.card.blocked");
    return t("sandbox.card.monitoring");
  }
  if (isWorking) return t("sandbox.card.executingTask");
  if (row.abortedLastRun) return t("sandbox.card.errorStuck");
  return t("sandbox.card.standby");
}

export function sessionStatusColor(row: GatewaySessionRow, isWorking: boolean): string {
  if (row.abortedLastRun) {
    return "var(--color-danger, #ef4444)";
  }
  if (isWorking) {
    return "#f59e0b";
  }
  return "#64748b";
}

/** ─── Task info floating card per subagent ──────────────────────────────────── */
export function renderTaskCard(
  row: GatewaySessionRow,
  index: number,
  sandboxChatEvents?: Record<string, unknown>,
  taskPlan?: TaskPlanSnapshot | null,
) {
  const progress = tokenProgress(row);
  const isWorking = Boolean(
    (row.outputTokens && row.outputTokens > 0) || (sandboxChatEvents && sandboxChatEvents[row.key]),
  );
  const status = sessionStatusLabel(row, isWorking);
  const statusColor = sessionStatusColor(row, isWorking);
  const totalTokens = ((row.inputTokens ?? 0) + (row.outputTokens ?? 0)).toLocaleString();
  const rolePrefix = row.role === "manager" ? "🎩" : "🦞";
  const roleLabel = row.role === "manager" ? t("sandbox.card.manager") : t("sandbox.card.worker");

  // Kingdom role detection
  let kingdomRole = "";
  const label = (row.label || "").toLowerCase();
  if (label.includes("leader") || label.includes("大长老") || label.includes("king"))
    kingdomRole = "龙虾大长老";
  else if (
    label.includes("chieftain") ||
    label.includes("酋长") ||
    label.includes("marshal") ||
    label.includes("元帅") ||
    label.includes("priest") ||
    label.includes("祭司")
  )
    kingdomRole = "龙虾酋长";
  else if (
    label.includes("lord") ||
    label.includes("领主") ||
    label.includes("general") ||
    label.includes("将军")
  )
    kingdomRole = "龙虾领主";
  else if (
    label.includes("warrior") ||
    label.includes("勇士") ||
    label.includes("citizen") ||
    label.includes("公民")
  )
    kingdomRole = "龙虾勇士";
  else if (
    label.includes("recruit") ||
    label.includes("新兵") ||
    label.includes("subject") ||
    label.includes("子民")
  )
    kingdomRole = "龙虾子民";

  let executionPhase = "";
  if (isWorking && sandboxChatEvents) {
    const message = sandboxChatEvents[row.key];
    if (message) {
      const cards = extractToolCards(message);
      const lastCall = [...cards].reverse().find((c) => c.kind === "call");
      if (lastCall) {
        const t_name = lastCall.name.toLowerCase();
        if (
          t_name.includes("browser") ||
          t_name.includes("search") ||
          t_name.includes("fetch") ||
          t_name.includes("read") ||
          t_name.includes("list")
        ) {
          executionPhase = t("sandbox.card.researching");
        } else if (
          t_name.includes("exec") ||
          t_name.includes("run") ||
          t_name.includes("replace") ||
          t_name.includes("edit") ||
          t_name.includes("write") ||
          t_name.includes("bash")
        ) {
          executionPhase = t("sandbox.card.coding");
        } else if (
          t_name.includes("subagent") ||
          t_name.includes("plan") ||
          t_name.includes("todo")
        ) {
          executionPhase = t("sandbox.card.planning");
        } else if (
          t_name.includes("test") ||
          t_name.includes("verify") ||
          t_name.includes("check")
        ) {
          executionPhase = t("sandbox.card.verifying");
        } else {
          executionPhase = t("sandbox.card.executingTools");
        }
      } else {
        executionPhase = t("sandbox.card.synthesizing");
      }
    }
  }

  let linkedTask: TaskTodo | undefined;
  if (taskPlan && taskPlan.todos) {
    const wLabel = (row.label || row.subject || "").toLowerCase();
    linkedTask = taskPlan.todos.find((t) => {
      const titleWords = t.title
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2);
      return titleWords.some((w) => wLabel.includes(w));
    });
  }

  return html`
    <div class="task-card ${isWorking ? "task-card--active" : "task-card--idle"}">
      <div class="task-card__header">
        <span class="task-card__index">${rolePrefix} #${index + 1}</span>
        <span class="task-card__title">${row.label || row.key.slice(0, 14)}</span>
        <span class="task-card__status" style="background: ${statusColor};">${status}</span>
      </div>
      <div class="task-card__body">
        ${row.subject ? html`<div class="task-card__task">${row.subject}</div>` : nothing}
        <div class="task-card__progress-row">
          <span>${t("sandbox.card.progress")}</span>
          <span>${progress}%</span>
        </div>
        <div class="task-card__progress-bar">
          <div class="task-card__progress-fill" style="width: ${progress}%; background: ${statusColor};"></div>
        </div>
        <div class="task-card__meta">
          ${kingdomRole ? html`<span class="meta-chip" style="color:#facc15;border-color:rgba(250,204,21,0.5);font-weight:bold;">${kingdomRole}</span>` : nothing}
          ${html`<span class="meta-chip" style="color:#94a3b8;border-color:rgba(148,163,184,0.3);">${roleLabel}</span>`}
          ${executionPhase ? html`<span class="meta-chip" style="color:#818cf8;border-color:rgba(129,140,248,0.5);">${executionPhase}</span>` : nothing}
          ${linkedTask ? html`<span class="meta-chip" style="color:#10b981;border-color:rgba(16,185,129,0.5);" title="${linkedTask.title}">🔗 ${t("tabs.tasks")}: ${linkedTask.title.slice(0, 15)}${linkedTask.title.length > 15 ? "..." : ""}</span>` : nothing}
          ${row.model ? html`<span class="meta-chip">🤖 ${row.model}</span>` : nothing}
          ${row.outputTokens ? html`<span class="meta-chip">⚡ ${totalTokens} tok</span>` : nothing}
          <span class="meta-chip">🕐 ${relativeTime(row.updatedAt)}</span>
        </div>
      </div>
      ${
        isWorking
          ? html`
              <div class="task-card__working-bar"></div>
            `
          : nothing
      }
    </div>
  `;
}
