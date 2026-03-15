import { html, nothing } from "lit";
import { t } from "../../../../i18n/index.ts";
import type { ChatLayoutProps } from "../../chat-layout.ts";
import { renderPlanSidebar } from "./plan-sidebar.ts";

export function renderSubagentSidebar(props: ChatLayoutProps) {
  const sessions = props?.sandboxSessions;
  if (!sessions || sessions.length === 0) {
    return nothing;
  }
  const phase = props?.taskPlan?.phase || "execution";

  return html`
    <div class="plan-sidebar-panel fractal-sidebar">
      <div class="plan-sidebar-header">
        <span class="plan-sidebar-title fractal-glitch" data-text="${t("chat.sidebarRoster")}">${t("chat.sidebarRoster")}</span>
        <span class="plan-sidebar-phase plan-sidebar-phase--${phase}">${phase.toUpperCase()}</span>
      </div>

      <div class="subagent-list">
        <!-- The Dynamic Fractal Neural Overlay -->
        <svg class="node-path-svg" preserveAspectRatio="none">
          <defs>
            <linearGradient id="fractal-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#c084fc" stop-opacity="0.8" />
              <stop offset="50%" stop-color="#818cf8" stop-opacity="0.9" />
              <stop offset="100%" stop-color="#2dd4bf" stop-opacity="0.8" />
            </linearGradient>
          </defs>
          ${sessions.map((_, idx) => {
            if (idx === 0) return nothing;
            // Draw a bezier curve from the previous node to current
            // Each card is roughly 120px tall (with gap)
            const y1 = (idx - 1) * 140 + 70;
            const y2 = idx * 140 + 70;
            return html`
              <path class="fractal-line" 
                    d="M 24 ${y1} C 24 ${(y1 + y2) / 2}, 0 ${(y1 + y2) / 2}, 24 ${y2}" />
            `;
          })}
        </svg>

        ${sessions.map((row, idx) => {
          const isWorking = Boolean(row.outputTokens && row.outputTokens > 0);
          const tokens = (row.totalTokens ?? 0).toLocaleString();
          const statusClass = isWorking ? "subagent-card--active" : "subagent-card--idle";
          const statusText = isWorking ? t("chat.sidebarWorking") : t("chat.sidebarIdle");
          const statusIcon = isWorking ? "∿" : "⚬";

          // Simulated or actual recursion depth for visual branching
          // If the backend provides iterationDepth, we use it; fallback to index-based for visual variety
          const depth = (row as any).iterationDepth ?? (idx % 4) + 1;

          return html`
            <div class="subagent-card node-card ${statusClass}" data-depth="${depth}" style="animation-delay: ${idx * 0.1}s">
              <div class="subagent-card__header">
                <span class="subagent-card__icon node-icon">${statusIcon}</span>
                <span class="subagent-card__name node-name">${row.label || row.key.slice(0, 14)}</span>
                <span class="subagent-card__status status-badge">${statusText}</span>
              </div>
              ${row.subject ? html`<div class="subagent-card__task node-task">📋 ${row.subject}</div>` : nothing}
              <div class="subagent-card__meta node-meta">
                <span class="subagent-card__chip data-chip">⟨IDP:${depth}⟩</span>
                ${row.model ? html`<span class="subagent-card__chip data-chip">🤖 ${row.model}</span>` : nothing}
                ${row.outputTokens ? html`<span class="subagent-card__chip data-chip">⚡ ${tokens} tok</span>` : nothing}
              </div>
              ${
                isWorking
                  ? html`
                      <div class="subagent-card__pulse node-pulse"></div>
                    `
                  : nothing
              }
            </div>
          `;
        })}
      </div>

      <!-- Combine plan sidebar underneath if data exists -->
      ${renderPlanSidebar(props)}
    </div>
  `;
}
