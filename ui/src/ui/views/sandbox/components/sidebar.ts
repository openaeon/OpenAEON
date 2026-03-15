import { html, nothing } from "lit";
import { t } from "../../../../i18n/index.ts";
import type { GatewaySessionRow } from "../../../types.ts";
import type { TaskPlanSnapshot, TaskTodo } from "../types.ts";
import { sessionStatusColor, sessionStatusLabel, relativeTime } from "./card.ts";

/** ─── Timeline panel per subagent tasks ─────────────────────────────────────── */
export function renderTimeline(rows: GatewaySessionRow[]) {
  const events = rows
    .filter((r) => r.kind !== "global")
    .toSorted((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

  if (events.length === 0) {
    return html`
      <div class="sidebar-empty" style="padding-top: 0">${t("sandbox.timeline.waiting")}</div>
    `;
  }

  // Group events by Today vs Yesterday/Older
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const todayEvents = events.filter((e) => (e.updatedAt ?? 0) >= startOfToday);
  const olderEvents = events.filter((e) => (e.updatedAt ?? 0) < startOfToday);

  // Helper to render a group of events
  const renderGroup = (title: string, groupEvents: GatewaySessionRow[]) => {
    if (groupEvents.length === 0) {
      return nothing;
    }
    return html`
      <div class="timeline-group">
        <div class="timeline-group__title">${title}</div>
        ${groupEvents.map(
          (r) => html`
            <div class="timeline__item">
              <div class="timeline__dot" style="background: ${sessionStatusColor(r, false)}; box-shadow: 0 0 6px ${sessionStatusColor(r, false)};"></div>
              <div class="timeline__content">
                <div style="display: flex; gap: 8px; align-items: baseline;">
                  <span class="timeline__label">${r.label || r.key.slice(0, 14)}</span>
                  <span class="timeline__time">${relativeTime(r.updatedAt)}</span>
                </div>
                <span class="timeline__status" style="color: ${sessionStatusColor(r, false)}">${sessionStatusLabel(r, false)}</span>
                ${r.subject ? html`<div class="timeline__subject" style="font-size: 0.75rem; color: rgba(255,255,255,0.6); margin-top: 4px;">${r.subject}</div>` : nothing}
              </div>
            </div>
          `,
        )}
      </div>
    `;
  };

  return html`
    <div class="timeline">
      ${renderGroup(String(t("sandbox.timeline.today")), todayEvents)}
      ${renderGroup(String(t("sandbox.timeline.older")), olderEvents)}
    </div>
  `;
}

/** ─── Task Plan Panel (main agent's write_todos state) ──────────────────────── */
export function renderTaskPlanPanel(
  plan: TaskPlanSnapshot | null | undefined,
  workerRows?: GatewaySessionRow[],
) {
  if (!plan || plan.todos.length === 0) {
    return html`
      <div class="sidebar-empty" style="padding: 12px">
        <span>${t("sandbox.plan.resting")}</span>
      </div>
    `;
  }
  const done = plan.todos.filter((t: TaskTodo) => t.status === "done").length;
  const total = plan.todos.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const allDone = done === total;

  // Build keyword map from worker labels for association
  const workers = workerRows ?? [];
  function findLinkedWorker(todoTitle: string): GatewaySessionRow | undefined {
    const titleLower = todoTitle.toLowerCase();
    const titleWords = titleLower.split(/\s+/).filter((w) => w.length > 2);
    return workers.find((w) => {
      const label = (w.label || w.subject || "").toLowerCase();
      return titleWords.some(
        (word) => label.includes(word) || (w.subject ?? "").toLowerCase().includes(word),
      );
    });
  }

  return html`
    <div class="task-plan ${allDone ? "task-plan--complete" : ""}">
      ${plan.description ? html`<div class="task-plan__desc">${plan.description}</div>` : nothing}
      <div class="task-plan__progress-row">
        <span>${t("sandbox.plan.tasksProgress", { done: String(done), total: String(total) })}</span>
        <span>${pct}%</span>
      </div>
      <div class="task-plan__bar">
        <div
          class="task-plan__fill"
          style="width: ${pct}%; background: ${allDone ? "#10b981" : "#818cf8"};"
        ></div>
      </div>
      <div class="task-plan__list">
        ${plan.todos.map((todo: TaskTodo) => {
          const icon = todo.status === "done" ? "✅" : todo.status === "in_progress" ? "🔄" : "⏳";
          const cls =
            todo.status === "done"
              ? "task-plan__item task-plan__item--done"
              : todo.status === "in_progress"
                ? "task-plan__item task-plan__item--active"
                : "task-plan__item";
          const linked = findLinkedWorker(todo.title);
          return html`<div class="${cls}">
            ${icon} ${todo.title}
            ${
              linked
                ? html`<span class="task-plan__worker-link" title="${t("sandbox.sidebar.linked", { name: linked.label || linked.key })}">🔗</span>`
                : nothing
            }
          </div>`;
        })}
      </div>
      ${
        allDone
          ? html`
              <div class="task-plan__complete">
                <span class="task-plan__celebrate">🎉</span>
                <span>${t("sandbox.plan.allDone")}</span>
                <span class="task-plan__celebrate">🎉</span>
              </div>
              <div class="task-plan__confetti">
                ${Array.from(
                  { length: 20 },
                  (_, i) =>
                    html`<span class="confetti-piece" style="--i:${i}; --x:${Math.random() * 100}; --delay:${Math.random() * 2}s; --color:${["#818cf8", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4"][i % 6]}"></span>`,
                )}
              </div>
            `
          : nothing
      }
    </div>
  `;
}
