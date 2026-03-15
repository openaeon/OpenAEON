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

// Kingdom viewport interaction state
let kvScale = 1.0;
let kvPanX = 0;
let kvPanY = 0;
let kvDragging = false;
let kvLastX = 0;
let kvLastY = 0;
let kvRaf: number | null = null;

export function renderSandbox(props: SandboxProps) {
  const rows = props.result?.sessions || [];
  const activeSessions = rows.filter((r) => r.kind !== "global" && r.kind !== "unknown");
  const globalSession = rows.find((r) => r.key === "agent:main:main");

  // Calculate aggregate stats
  const totalBusy = activeSessions.filter((r) => r.outputTokens && r.outputTokens > 0).length;
  const totalIdle = activeSessions.length - totalBusy;
  const healthPercent = Number((props.health as any)?.percent) || 100;
  const healthStatus = String((props.health as any)?.status || "OPTIMAL");
  const healthColor = healthPercent > 80 ? "#10b981" : healthPercent > 40 ? "#f59e0b" : "#ef4444";
  const totalTokens = rows.reduce((acc, r) => acc + (r.totalTokens || 0), 0);

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
          <div class="sandbox-header__sub">// NEURAL_SANDBOX_STATION_V4</div>
        </div>
        <div class="sandbox-header__metrics" style="display: flex; align-items: center; gap: 40px; margin-left: auto; padding-right: 20px;">
            <div class="metric-group" style="display: flex; flex-direction: column; gap: 4px;">
              <div class="resonance-label" style="font-size: 0.65rem; color: var(--nexus-secondary); font-weight: 800; letter-spacing: 0.1em; opacity: 0.8;">RESONANCE_FLUX</div>
              <div class="resonance-meter" style="width: 140px; height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px; overflow: hidden; position: relative;">
                  <div class="resonance-fill" style="width: ${(props.evolution?.collectiveResonance || 0) * 100}%; height: 100%; background: linear-gradient(90deg, var(--nexus-secondary), #fff); box-shadow: 0 0 10px var(--nexus-secondary); transition: width 1s ease;"></div>
              </div>
            </div>
            <div class="metric-group" style="display: flex; flex-direction: column; gap: 4px;">
              <div class="resonance-label" style="font-size: 0.65rem; color: #f43f5e; font-weight: 800; letter-spacing: 0.1em; opacity: 0.8;">STABILITY_MATRIX</div>
              <div class="resonance-meter" style="width: 140px; height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px; overflow: hidden; position: relative;">
                  <div class="resonance-fill" style="width: ${100 - (props.evolution?.systemEntropy || 0)}%; height: 100%; background: linear-gradient(90deg, #f43f5e, #fb7185); box-shadow: 0 0 10px #f43f5e; transition: width 1s ease;"></div>
              </div>
            </div>
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
          <div class="sandbox-sidebar-header">BLUEPRINTS // 方案核心</div>
          <div class="sidebar-cards">
            ${renderTaskPlanPanel(props.taskPlan, activeSessions)}
          </div>

          ${
            activeSessions.length > 0
              ? html`
                  <div class="sandbox-sidebar-header">ACTIVE_NEXUS // 活跃节点</div>
                `
              : nothing
          }
          ${
            activeSessions.length > 0
              ? html`
            <div class="sidebar-cards" style="padding-top: 0;">
              ${activeSessions.map((row) => {
                const isWorking = row.outputTokens && row.outputTokens > 0;
                const roleEmoji = row.role === "manager" ? "🎩" : "🦞";
                return html`
                  <div class="roster-item" style="margin-bottom: 6px;">
                    <div class="roster-item__header">
                      <span class="roster-item__icon" style="font-size: 0.9rem;">${roleEmoji}</span>
                      <span class="roster-item__name" style="font-size: 0.75rem;">${row.label || row.key.slice(0, 10)}</span>
                      <div class="status-indicator ${isWorking ? "status-indicator--working" : "status-indicator--idle"}" style="width: 6px; height: 6px;"></div>
                    </div>
                  </div>
                `;
              })}
            </div>
          `
              : nothing
          }

          <div class="sandbox-sidebar-header" style="margin-top: auto; border-top: 1px solid rgba(255,255,255,0.05);">CHRONOLOGY // 历史</div>
          <div class="sidebar-cards" style="max-height: 200px; flex: none;">
             <!-- Tribal Resonance Logs -->
             <div class="tribe-logs">
                ${(props.evolution?.cognitiveLog || [])
                  .slice(-3)
                  .reverse()
                  .map(
                    (log) => html`
                   <div class="tribe-log-entry" style="font-size: 0.65rem; color: rgba(255,255,255,0.5); padding: 4px 8px; border-left: 2px solid var(--nexus-secondary); background: rgba(255,255,255,0.02); margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      ${log.content}
                   </div>
                `,
                  )}
             </div>
          </div>
        </div>

        <!-- Main Content -->
        <div class="sandbox-main">
          <!-- Leader Section (Holographic HUD) -->
          <div class="nexus-leader-section">
            <div class="leader-card">
              <div class="leader-card__figure">
                ${renderManagerFigure(totalBusy > 0)}
              </div>
              <div class="leader-card__info">
                <div class="leader-card__role" style="font-size: 0.65rem; opacity: 0.5; letter-spacing: 0.2em;">ORCHESTRATOR_UNIT</div>
                <div class="leader-card__name" style="font-size: 1.5rem; font-weight: 900; background: linear-gradient(135deg, #fff, var(--nexus-secondary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">AEON ELDER</div>
                <div class="leader-card__status" style="margin-top: 8px; font-size: 0.7rem; display: flex; align-items: center; gap: 8px;">
                  <div class="leader-card__status-dot" style="width: 8px; height: 8px; border-radius: 50%; background: ${totalBusy > 0 ? "var(--nexus-accent)" : "#10b981"}; box-shadow: 0 0 10px ${totalBusy > 0 ? "var(--nexus-accent)" : "#10b981"};"></div>
                  CORE_STATE: ${totalBusy > 0 ? "RESONANCE_ACTIVE" : "STABLE"}
                </div>
              </div>
              <div class="leader-stats" style="display: flex; gap: 32px; padding: 0 24px; border-left: 1px solid rgba(255,255,255,0.1);">
                  <div class="stat-box" style="text-align: right;">
                    <div class="stat-box__label" style="font-size: 0.6rem; opacity: 0.4; font-weight: 800;">ACTIVE_AGENTS</div>
                    <div class="stat-box__value" style="font-size: 1.2rem; font-weight: 900; color: var(--nexus-secondary);">${activeSessions.length}</div>
                  </div>
                  <div class="stat-box" style="text-align: right;">
                    <div class="stat-box__label" style="font-size: 0.6rem; opacity: 0.4; font-weight: 800;">COGNITIVE_LOAD</div>
                    <div class="stat-box__value" style="font-size: 1.2rem; font-weight: 900; color: var(--nexus-accent);">${Math.round((totalBusy / (activeSessions.length || 1)) * 100)}%</div>
                  </div>
              </div>
            </div>
          </div>

          <!-- 3D Kingdom Viewport -->
          <div class="nexus-viewport-section">
            <div class="section-title">REAL-TIME TOPOLOGY // 王国动态</div>
            <div class="kingdom-viewport"
                 @wheel=${(e: WheelEvent) => {
                   e.preventDefault();
                   const delta = e.deltaY > 0 ? 0.92 : 1.08;
                   kvScale = Math.min(Math.max(0.5, kvScale * delta), 2.5);
                   const scene = (e.currentTarget as HTMLElement).querySelector(
                     ".kingdom-scene",
                   ) as HTMLElement;
                   if (scene) {
                     if (kvRaf) return;
                     kvRaf = requestAnimationFrame(() => {
                       scene.style.transform = `translate(${kvPanX}px, ${kvPanY}px) scale(${kvScale})`;
                       kvRaf = null;
                     });
                   }
                 }}
                 @pointerdown=${(e: PointerEvent) => {
                   if (e.button !== 0) return;
                   kvDragging = true;
                   kvLastX = e.clientX;
                   kvLastY = e.clientY;
                   (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                 }}
                 @pointermove=${(e: PointerEvent) => {
                   if (!kvDragging) return;
                   kvPanX += e.clientX - kvLastX;
                   kvPanY += e.clientY - kvLastY;
                   kvLastX = e.clientX;
                   kvLastY = e.clientY;
                   const scene = (e.currentTarget as HTMLElement).querySelector(
                     ".kingdom-scene",
                   ) as HTMLElement;
                   if (scene) {
                     if (kvRaf) return;
                     kvRaf = requestAnimationFrame(() => {
                       scene.style.transform = `translate(${kvPanX}px, ${kvPanY}px) scale(${kvScale})`;
                       kvRaf = null;
                     });
                   }
                 }}
                 @pointerup=${() => {
                   kvDragging = false;
                 }}
                 @pointercancel=${() => {
                   kvDragging = false;
                 }}>
              <div class="kingdom-viewport__title">🦞 LOBSTER_CITADEL_OS // ${activeSessions.length} UNITS ONLINE</div>
              <div class="kingdom-scene ${props.evolution?.systemEntropy && props.evolution.systemEntropy > 50 ? "kingdom-scene--unstable" : ""}" 
                   style="transform: translate(${kvPanX}px, ${kvPanY}px) scale(${kvScale});">
                <div class="kingdom-grid"></div>

                <!-- Zone markers -->
                <div class="kingdom-zone kingdom-zone--throne">
                  <div class="kingdom-zone__label">CITADEL</div>
                </div>
                <div class="kingdom-zone kingdom-zone--workshop">
                  <div class="kingdom-zone__label">WORKSHOP</div>
                </div>
                <div class="kingdom-zone kingdom-zone--rest">
                  <div class="kingdom-zone__label">OASIS</div>
                </div>

                ${(() => {
                  const positions = new Map<string, { x: number; y: number; isWorking: boolean }>();
                  const workingAgents = activeSessions.filter((r) =>
                    Boolean(r.outputTokens && r.outputTokens > 0),
                  );
                  const idleAgents = activeSessions.filter(
                    (r) => !(r.outputTokens && r.outputTokens > 0),
                  );

                  // Calculate positions with Subject-based Clustering
                  const subjectClusters = new Map<string, string[]>();
                  activeSessions.forEach((r) => {
                    const sub = r.subject || "IDLE";
                    if (!subjectClusters.has(sub)) subjectClusters.set(sub, []);
                    subjectClusters.get(sub)!.push(r.key);
                  });

                  let clusterIdx = 0;
                  subjectClusters.forEach((keys, sub) => {
                    keys.forEach((key, i) => {
                      const row = activeSessions.find((r) => r.key === key)!;
                      const isWorking = Boolean(row.outputTokens && row.outputTokens > 0);

                      // Cluster-based offset
                      const clusterX = isWorking ? 80 + clusterIdx * 150 : 520;
                      const clusterY = isWorking ? 220 : 240;

                      positions.set(key, {
                        x: clusterX + (i % 2) * 60,
                        y: clusterY + Math.floor(i / 2) * 80 + (clusterIdx % 2) * 40,
                        isWorking,
                      });
                    });
                    if (sub !== "IDLE") clusterIdx++;
                  });

                  // Render Tribal Tethers (SVG)
                  const tethers: any[] = [];
                  const keys = Array.from(positions.keys());

                  // Elder Tethers
                  if (totalBusy > 0) {
                    workingAgents.forEach((w) => {
                      const pW = positions.get(w.key)!;
                      tethers.push(
                        html`<line class="tribe-link" x1="${1000 + 470 + 30}" y1="${1000 + 80 + 30}" x2="${pW.x + 30 + 1000}" y2="${pW.y + 30 + 1000}" style="opacity: 0.2;" />`,
                      );
                    });
                  }

                  for (let i = 0; i < keys.length; i++) {
                    for (let j = i + 1; j < keys.length; j++) {
                      const a = activeSessions.find((r) => r.key === keys[i]);
                      const b = activeSessions.find((r) => r.key === keys[j]);
                      if (
                        a?.subject &&
                        b?.subject &&
                        (a.subject === b.subject ||
                          a.subject.includes(b.subject) ||
                          b.subject.includes(a.subject))
                      ) {
                        const pA = positions.get(keys[i])!;
                        const pB = positions.get(keys[j])!;
                        // Offset to center of figure (roughly 30,30 from top-left)
                        tethers.push(
                          html`<line class="tribe-link tribe-link--active" x1="${pA.x + 30 + 1000}" y1="${pA.y + 30 + 1000}" x2="${pB.x + 30 + 1000}" y2="${pB.y + 30 + 1000}" />`,
                        );
                      }
                    }
                  }

                  return html`
                    <svg viewBox="0 0 3000 3000">${tethers}</svg>
                    
                    ${Array.from(subjectClusters.entries()).map(([sub, keys], idx) => {
                      if (sub === "IDLE") return nothing;
                      // Find first agent in cluster to get baseline position
                      const p = positions.get(keys[0])!;
                      return html`
                        <div class="cluster-label" style="position: absolute; top: ${p.y - 30}px; left: ${p.x}px; color: var(--nexus-secondary); font-size: 0.6rem; font-weight: 800; background: rgba(0,0,0,0.4); padding: 2px 8px; border-radius: 4px; backdrop-filter: blur(4px); pointer-events: none; z-index: 15; white-space: nowrap;">
                          📡 SHARED_INTENT: ${sub.toUpperCase()}
                        </div>
                      `;
                    })}

                    <!-- Leader (Manager) -->
                    <div class="kingdom-agent kingdom-agent--leader" style="top: 80px; left: 470px;">
                      <div class="kingdom-agent__figure">
                        ${renderManagerFigure(totalBusy > 0, props.evolution?.collectiveResonance ? props.evolution.collectiveResonance >= 0.6 : false)}
                      </div>
                      <div class="kingdom-agent__tag">👑 ELDER</div>
                    </div>

                    ${activeSessions.map((row) => {
                      const pos = positions.get(row.key)!;
                      const isWorking = pos.isWorking;
                      const globalResonance = props.evolution?.collectiveResonance || 0;
                      const isResonant =
                        globalResonance >= 0.6 || (isWorking && globalResonance >= 0.3);

                      const roleEmoji = row.role === "manager" ? "🎩" : "🦞";
                      const codeSnippets = ["{...}", "RUN()", "EXE", "LINK", "SYNC", "ACK"];
                      const snippet = codeSnippets[Math.floor(Math.random() * codeSnippets.length)];

                      return html`
                        <div class="kingdom-agent ${isWorking ? "kingdom-agent--working" : ""}" style="top: ${pos.y}px; left: ${pos.x}px;">
                          ${isWorking ? html`<div class="kingdom-agent__particles">${snippet}</div>` : nothing}
                          <div class="kingdom-agent__figure">
                            ${renderAgentFigure(row, props.agentIdentityById?.[row.key]?.avatar, isResonant)}
                          </div>
                          <div class="kingdom-agent__tag">${roleEmoji} ${row.label || row.key.slice(0, 8)}</div>
                          ${row.subject ? html`<div class="kingdom-agent__task-hint">${row.subject.slice(0, 20)}</div>` : nothing}
                        </div>
                      `;
                    })}
                  `;
                })()}

                ${
                  activeSessions.length === 0
                    ? html`
                        <div
                          style="
                            position: absolute;
                            top: 50%;
                            left: 50%;
                            transform: translate(-50%, -50%);
                            text-align: center;
                            z-index: 15;
                          "
                        >
                          <div style="font-size: 3rem; opacity: 0.2; filter: grayscale(1)">🦞</div>
                          <div
                            style="
                              font-size: 0.8rem;
                              color: rgba(255, 255, 255, 0.2);
                              letter-spacing: 0.3em;
                              margin-top: 10px;
                            "
                          >
                            IDLE_STATE
                          </div>
                        </div>
                      `
                    : nothing
                }
              </div>
            </div>
          </div>

          <!-- Agent Work Grid -->
          <div class="nexus-agent-grid-section">
            <div class="section-title">AGENT_HUD // 探针矩阵</div>
            ${
              activeSessions.length === 0
                ? html`
                    <div class="empty-state">
                      <div class="empty-state__icon">📡</div>
                      <div class="empty-state__title">NO ACTIVE SIGNALS</div>
                      <div class="empty-state__sub">Swarms are currently docked. Initiate routine to deploy.</div>
                    </div>
                  `
                : html`
                <div class="agent-grid">
                  ${activeSessions.map((row) => {
                    const isWorking = Boolean(row.outputTokens && row.outputTokens > 0);
                    const progress = tokenProgress(row);
                    const roleEmoji = row.role === "manager" ? "🎩" : "🦞";

                    return html`
                      <div class="agent-card ${isWorking ? "agent-card--working" : "agent-card--idle"}">
                        <div class="agent-card__figure">
                          ${renderAgentFigure(row, props.agentIdentityById?.[row.key]?.avatar)}
                        </div>
                        <div class="agent-card__body">
                          <div class="agent-card__header">
                             <div class="agent-card__name">${row.label || row.key.slice(0, 16)}</div>
                             <div class="agent-card__status-dot ${isWorking ? "agent-card__status-dot--working" : "agent-card__status-dot--idle"}"></div>
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
            <div class="section-title">SYSTEM_REGIONS // 区域概标</div>
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
                <div class="zone-card__icon">🖥️</div>
                <div class="zone-card__name">CLUSTER</div>
                <div class="zone-card__stat">${(props.nodes || []).length} NODE</div>
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
