import { html, nothing } from "lit";
import { t } from "../../../../i18n/index.ts";
import type { ChatLayoutProps } from "../../chat-layout.ts";

export function renderStickyPlanBar(props: ChatLayoutProps) {
  const plan = props?.taskPlan;
  if (!plan || !plan.todos || plan.todos.length === 0) {
    return nothing;
  }
  const done = plan.todos.filter((t: { status: string }) => t.status === "done").length;
  const total = plan.todos.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const allDone = done === total;
  const phase = plan.phase || "execution";

  const phaseSteps = [
    { key: "planning", icon: "⚲", label: "PLANNING" },
    { key: "execution", icon: "∿", label: "EXECUTION" },
    { key: "verification", icon: "⊗", label: "VERIFICATION" },
  ];

  return html`
    <div class="chat-plan-sticky fractal-sticky ${allDone ? "chat-plan-sticky--complete" : ""}">
      <span class="chat-plan-sticky__icon neo-icon">${allDone ? "❖" : "⟠"}</span>
      <span class="chat-plan-sticky__desc aeon-text-sm">${plan.description || "System Blueprint"}</span>
      <div class="chat-plan-sticky__phases matrix-phases">
        ${phaseSteps.map(
          (s) => html`
            <span class="chat-plan-phase matrix-phase ${phase === s.key ? "chat-plan-phase--active matrix-phase--active" : ""} ${phase === "complete" && s.key === "verification" ? "chat-plan-phase--active matrix-phase--active" : ""}">
              ${s.icon} ${s.label}
            </span>
          `,
        )}
      </div>
      <span class="chat-plan-sticky__stats data-numbers">${done}/${total} (${pct}%)</span>
      <div class="chat-plan-sticky__bar flux-bar">
        <div
          class="chat-plan-sticky__fill flux-fill ${allDone ? "chat-plan-sticky__fill--done flux-fill--done" : ""}"
          style="width: ${pct}%"
        ></div>
      </div>
      ${
        allDone
          ? html`
            <div class="chat-plan-confetti matrix-particles">
              ${Array.from(
                { length: 12 },
                (_, i) =>
                  html`<span class="chat-confetti-piece matrix-particle" style="--i:${i}; --x:${Math.random() * 100}; --delay:${Math.random() * 2}s; --color:${["#818cf8", "#10b981", "#c084fc", "#3b82f6", "#2dd4bf", "#6366f1"][i % 6]}"></span>`,
              )}
            </div>
          `
          : nothing
      }
    </div>
  `;
}

export function renderPlanSidebar(props: ChatLayoutProps) {
  const plan = props?.taskPlan;
  if (!plan || !plan.todos || plan.todos.length === 0) {
    return nothing;
  }
  const phase = plan.phase || "execution";
  const isPlanning = phase === "planning";
  const done = plan.todos.filter((t: { status: string }) => t.status === "done").length;
  const total = plan.todos.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return html`
    <div class="plan-sidebar-panel fractal-panel">
      <div class="plan-sidebar-header matrix-header">
        <span class="plan-sidebar-title aeon-title">${t("chat.sidebarPlan")}</span>
        <span class="plan-sidebar-phase plan-sidebar-phase--${phase}">${phase.toUpperCase()}</span>
      </div>

      ${plan.description ? html`<div class="plan-sidebar-desc data-desc">${plan.description}</div>` : nothing}

      <div class="plan-sidebar-progress matrix-progress">
        <div class="plan-sidebar-progress-row data-row">
          <span>PROGRESS / 进度</span>
          <span class="data-numbers">${done}/${total} (${pct}%)</span>
        </div>
        <div class="plan-sidebar-bar flux-bar flux-bar--large">
          <div class="plan-sidebar-fill flux-fill flux-fill--large" style="width: ${pct}%; background: ${done === total && total > 0 ? "linear-gradient(90deg, #10b981, #2dd4bf)" : "linear-gradient(90deg, #6366f1, #c084fc)"};"></div>
        </div>
      </div>

      <div class="plan-sidebar-todos matrix-nodelist">
        ${plan.todos.map(
          (todo: { id: string; title: string; status: string; result?: string }) => html`
            <div class="plan-sidebar-todo-container matrix-node">
              <div class="plan-sidebar-todo plan-sidebar-todo--${todo.status} matrix-node-box">
                <span class="plan-sidebar-todo-icon node-status-icon">${todo.status === "done" ? "❖" : todo.status === "in_progress" ? "∿" : "⚬"}</span>
                <span class="plan-sidebar-todo-text node-text">${todo.title}</span>
              </div>
              ${
                todo.status === "done" && todo.result
                  ? html`
                    <div class="plan-sidebar-todo-result matrix-node-result">
                      <div class="plan-sidebar-todo-result-title aeon-subtitle">${t("chat.sidebarResultTitle")}</div>
                      <div class="plan-sidebar-todo-result-content data-text">${todo.result}</div>
                    </div>
                  `
                  : nothing
              }
            </div>
          `,
        )}
      </div>

      ${
        isPlanning && props.onApprovePlan
          ? html`
            <div class="plan-sidebar-actions matrix-actions">
              <button
                class="plan-sidebar-approve-btn neon-btn neon-btn--primary"
                @click=${() => props.onApprovePlan?.()}
              >
                Approve and Execute
              </button>
            </div>
          `
          : done === total && total > 0
            ? html`
              <div class="plan-sidebar-actions plan-sidebar-complete matrix-complete">
                ${t("sandbox.plan.allDone")}
              </div>
            `
            : nothing
      }
    </div>
  `;
}
