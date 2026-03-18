import { html, nothing } from "lit";
import { t } from "../../../i18n/index.ts";
import { SandboxProps } from "./types.ts";

// Import Styles
import { baseStyles } from "./styles/base.ts";
import { figureStyles } from "./styles/figures.ts";
import { sidebarStyles } from "./styles/sidebar.ts";
import { miscStyles } from "./styles/misc.ts";

// Import Components
import { renderManagerFigure, renderAgentFigure } from "./components/figure.ts";
import { tokenProgress, sessionStatusColor, sessionStatusLabel } from "./components/card.ts";
import { renderTimeline, renderTaskPlanPanel } from "./components/sidebar.ts";
import { renderAgentRecruitmentModal } from "./components/recruit-modal.ts";
import type { GatewaySessionRow } from "../../types.ts";

const MAIN_SESSION_ALIASES = new Set(["main", "agent:main:main"]);

function isWorking(row: GatewaySessionRow, sandboxChatEvents?: Record<string, unknown>): boolean {
  return Boolean((row.outputTokens && row.outputTokens > 0) || sandboxChatEvents?.[row.key]);
}

function resolveFocusedSession(
  sessionKey: string,
  rows: GatewaySessionRow[],
): GatewaySessionRow | undefined {
  if (rows.length === 0) return undefined;
  const byExact = rows.find((row) => row.key === sessionKey);
  if (byExact) return byExact;

  if (MAIN_SESSION_ALIASES.has(sessionKey)) {
    return rows.find((row) => row.key === "agent:main:main" || row.kind === "global");
  }

  return rows.find((row) => row.kind !== "global" && row.kind !== "unknown");
}

export function renderSandbox(props: SandboxProps) {
  const rows = props.result?.sessions || [];
  const activeSessions = rows
    .filter((r) => r.kind !== "global" && r.kind !== "unknown")
    .toSorted((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  const globalSession = rows.find((r) => r.key === "agent:main:main" || r.kind === "global");
  const focusedSession = resolveFocusedSession(props.sessionKey, rows);
  const focusedIsMain = !focusedSession || MAIN_SESSION_ALIASES.has(props.sessionKey);
  const focusedSubject = focusedSession?.subject?.trim() || null;
  const focusedList =
    focusedIsMain || !focusedSession
      ? activeSessions
      : activeSessions.filter((row) => {
          if (row.key === focusedSession.key) return true;
          if (!focusedSubject || !row.subject) return false;
          const current = row.subject.toLowerCase();
          const target = focusedSubject.toLowerCase();
          return current.includes(target) || target.includes(current);
        });

  // Calculate aggregate stats
  const totalBusy = activeSessions.filter((r) => isWorking(r, props.sandboxChatEvents)).length;
  const healthPercent = Number((props.health as any)?.percent) || 100;
  const healthColor = healthPercent > 80 ? "#10b981" : healthPercent > 40 ? "#f59e0b" : "#ef4444";
  const totalTokens = rows.reduce((acc, r) => acc + (r.totalTokens || 0), 0);
  const relatedTimelineRows =
    focusedIsMain || !focusedSession
      ? activeSessions
      : activeSessions.filter((r) => focusedList.some((x) => x.key === r.key));
  const selfAwareness = props.evolution?.selfAwareness;

  const renderSessionPill = (row: GatewaySessionRow, label?: string) => {
    const rowIsWorking = isWorking(row, props.sandboxChatEvents);
    const statusColor = sessionStatusColor(row, rowIsWorking);
    const selected = focusedSession?.key === row.key;
    return html`
      <div
        class="roster-item"
        style="margin-bottom: 6px; width: 100%; text-align: left; border-radius: 10px; border: 1px solid ${selected ? `${statusColor}80` : "rgba(255,255,255,0.08)"}; background: ${selected ? "rgba(34,211,238,0.08)" : "rgba(255,255,255,0.02)"};"
        @click=${() => props.onSessionFocus?.(row.key)}
      >
        <div class="roster-item__header">
          <span class="roster-item__name" style="font-size: 0.76rem;">${label || row.label || row.key}</span>
          <div class="status-indicator ${rowIsWorking ? "status-indicator--working" : "status-indicator--idle"}" style="width: 6px; height: 6px;"></div>
        </div>
      </div>
    `;
  };

  return html`
    <div class="sandbox-wrap ${props.evolution?.singularityActive ? "self-repairing" : ""}" data-text="AEON NEXUS">
      ${baseStyles}
      ${figureStyles}
      ${sidebarStyles}
      ${miscStyles}

      <div class="sandbox-nexus-bg"></div>

      <!-- Collective Resonance Overlay -->
      <div class="tribe-resonance-overlay" style="opacity: ${Math.min(0.3, (props.evolution?.collectiveResonance || 0) * 0.8)};"></div>

      <!-- Phase 9: Singularity Event Horizon -->
      <div class="singularity-event-horizon" style="transform: scale(${0.5 + (props.evolution?.collectiveResonance || 0) * 0.5});">
        <div class="singularity-core"></div>
        <div class="singularity-rings">
          <div class="ring ring--1"></div>
          <div class="ring ring--2"></div>
        </div>
      </div>

      <!-- Header -->
      <div class="sandbox-header">
        <div class="sandbox-header__nexus-glow"></div>
        <div>
          <div class="sandbox-header__title">AEON NEXUS</div>
          <div class="sandbox-header__sub">// SANDBOX_COMMAND_VIEW</div>
        </div>
        <div class="sandbox-header__stats">
          <div class="stat-chip" style="border-color: ${healthColor}40;">
            <div class="stat-chip__dot" style="background: ${healthColor}; box-shadow: 0 0 6px ${healthColor};"></div>
            ${healthPercent}%
          </div>
          <div class="stat-chip">
            <div class="stat-chip__dot stat-chip__dot--busy"></div>
            ${totalBusy}
          </div>
          <div class="stat-chip" title="Self-awareness phase">
            ${selfAwareness?.phase || "reactive"}
          </div>
          <button class="stat-chip" @click=${props.onRefresh}>Refresh</button>
          <button class="stat-chip" @click=${props.onForceRestart}>/new</button>
          <button class="stat-chip stat-chip--recruit" @click=${props.onRecruitAgent}>
            ${t("sandbox.header.recruit")}
          </button>
        </div>
      </div>

      ${props.error ? html`<div class="callout danger" style="margin: 0 24px 24px 24px; border-radius: 12px;">${props.error}</div>` : nothing}

      <!-- Body: Sidebar + Main -->
      <div class="sandbox-body">
        <!-- Sidebar -->
        <div class="sandbox-sidebar">
          <div class="sandbox-sidebar-header">SESSION_FOCUS</div>
          <div class="sidebar-cards" style="padding-top: 12px;">
            ${
              globalSession
                ? renderSessionPill(globalSession, "Main Orchestrator")
                : html`
                    <div class="sidebar-empty" style="padding: 10px">Main session not found</div>
                  `
            }
            ${activeSessions.map((row) => renderSessionPill(row))}
          </div>

          <div class="sandbox-sidebar-header">BLUEPRINTS</div>
          <div class="sidebar-cards">
            ${renderTaskPlanPanel(props.taskPlan, activeSessions)}
          </div>
        </div>

        <!-- Main Content -->
        <div class="sandbox-main">
          <!-- Leader Section -->
          <div class="nexus-leader-section">
            <div class="leader-card">
              <div class="leader-card__figure">
                ${renderManagerFigure(totalBusy > 0)}
              </div>
              <div class="leader-card__info">
                <div class="leader-card__role" style="font-size: 0.65rem; opacity: 0.5; letter-spacing: 0.2em;">FOCUSED_SESSION</div>
                <div class="leader-card__name" style="font-size: 1.5rem; font-weight: 900; background: linear-gradient(135deg, #fff, var(--nexus-secondary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                  ${focusedSession?.label || focusedSession?.key || "main"}
                </div>
                <div class="leader-card__status" style="margin-top: 8px; font-size: 0.7rem; display: flex; align-items: center; gap: 8px;">
                  <div class="leader-card__status-dot" style="width: 8px; height: 8px; border-radius: 50%; background: ${focusedSession && isWorking(focusedSession, props.sandboxChatEvents) ? "var(--nexus-accent)" : "#10b981"}; box-shadow: 0 0 10px ${focusedSession && isWorking(focusedSession, props.sandboxChatEvents) ? "var(--nexus-accent)" : "#10b981"};"></div>
                  ${focusedSession ? sessionStatusLabel(focusedSession, isWorking(focusedSession, props.sandboxChatEvents)) : "Monitoring"}
                </div>
                ${
                  focusedSession?.subject
                    ? html`<div style="font-size: 0.78rem; color: rgba(255,255,255,0.65); margin-top: 4px;">${focusedSession.subject}</div>`
                    : nothing
                }
              </div>
              <div class="leader-stats" style="display: flex; gap: 32px; padding: 0 24px; border-left: 1px solid rgba(255,255,255,0.1);">
                  <div class="stat-box" style="text-align: right;">
                    <div class="stat-box__label" style="font-size: 0.6rem; opacity: 0.4; font-weight: 800;">VISIBLE_AGENTS</div>
                    <div class="stat-box__value" style="font-size: 1.2rem; font-weight: 900; color: var(--nexus-secondary);">${focusedList.length}</div>
                  </div>
                  <div class="stat-box" style="text-align: right;">
                    <div class="stat-box__label" style="font-size: 0.6rem; opacity: 0.4; font-weight: 800;">COGNITIVE_LOAD</div>
                    <div class="stat-box__value" style="font-size: 1.2rem; font-weight: 900; color: var(--nexus-accent);">${Math.round((totalBusy / (activeSessions.length || 1)) * 100)}%</div>
                  </div>
                  <div class="stat-box" style="text-align: right;">
                    <div class="stat-box__label" style="font-size: 0.6rem; opacity: 0.4; font-weight: 800;">TOTAL_TOKENS</div>
                    <div class="stat-box__value" style="font-size: 1.2rem; font-weight: 900; color: #f8fafc;">${totalTokens.toLocaleString()}</div>
                  </div>
              </div>
            </div>
          </div>

          <!-- Focus Timeline -->
          <div class="nexus-viewport-section">
            <div class="section-title">FOCUS_TIMELINE</div>
            <div class="kingdom-viewport" style="padding: 18px; min-height: 220px;">
              ${renderTimeline(relatedTimelineRows)}
            </div>
          </div>

          <!-- Agent Work Grid -->
          <div class="nexus-agent-grid-section">
            <div class="section-title">AGENT_GRID</div>
            ${
              focusedList.length === 0
                ? html`
                    <div class="empty-state">
                      <div class="empty-state__icon">📡</div>
                      <div class="empty-state__title">NO ACTIVE SIGNALS</div>
                      <div class="empty-state__sub">Swarms are currently docked. Initiate routine to deploy.</div>
                    </div>
                  `
                : html`
                <div class="agent-grid">
                  ${focusedList.map((row) => {
                    const rowIsWorking = isWorking(row, props.sandboxChatEvents);
                    const progress = tokenProgress(row);
                    const selected = focusedSession?.key === row.key;

                    return html`
                      <div
                        class="agent-card ${rowIsWorking ? "agent-card--working" : "agent-card--idle"}"
                        style="text-align: left; ${selected ? "outline: 1px solid rgba(34,211,238,0.7);" : ""}"
                        @click=${() => props.onSessionFocus?.(row.key)}
                      >
                        <div class="agent-card__figure">
                          ${renderAgentFigure(
                            row,
                            props.agentIdentityById?.[row.key]?.avatar,
                            selected,
                          )}
                        </div>
                        <div class="agent-card__body">
                          <div class="agent-card__header">
                             <div class="agent-card__name">${row.label || row.key.slice(0, 16)}</div>
                             <div class="agent-card__status-dot ${rowIsWorking ? "agent-card__status-dot--working" : "agent-card__status-dot--idle"}"></div>
                          </div>
                          <div class="agent-card__task">${row.subject || "LISTENING_FOR_WAVES"}</div>
                          <div class="agent-card__progress">
                            <div class="agent-card__progress-fill" style="width: ${progress}%;"></div>
                          </div>
                          <div class="agent-card__tokens">${(row.totalTokens || 0).toLocaleString()} TKN</div>
                        </div>
                      </div>
                    `;
                  })}
                </div>
              `
            }
          </div>

          <!-- Zone Status Bar -->
          <div class="nexus-zones-section">
            <div class="section-title">SYSTEM_REGIONS</div>
            <div class="zone-bar">
              <div class="zone-card">
                <div class="zone-card__icon">🏰</div>
                <div class="zone-card__name">CITADEL</div>
                <div class="zone-card__stat">${props.approvalsCount || 0} REQ</div>
              </div>
              <div class="zone-card">
                <div class="zone-card__icon">📦</div>
                <div class="zone-card__name">LOGISTICS</div>
                <div class="zone-card__stat">${(props.usage as any)?.totalTokens ? `${Math.round((props.usage as any).totalTokens / 1000)}K` : "0"}</div>
              </div>
              <div class="zone-card">
                <div class="zone-card__icon">📡</div>
                <div class="zone-card__name">COMMS</div>
                <div class="zone-card__stat">${props.channels?.channelMeta?.length || 0} CH</div>
              </div>
              <div class="zone-card">
                <div class="zone-card__icon">🧠</div>
                <div class="zone-card__name">SELF_AWARENESS</div>
                <div class="zone-card__stat">${Math.round((selfAwareness?.protoConsciousnessIndex || 0) * 100)}%</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      ${renderAgentRecruitmentModal(
        Boolean((props as any).recruitModalOpen),
        () => (props as any).onRecruitModalClose?.(),
        (avatarId) => (props as any).onAvatarSelect?.("new", avatarId),
      )}
    </div>
  `;
}