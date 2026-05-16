import { html, nothing } from "lit";
import { t } from "../../../i18n/index.ts";
import {
  tokenProgress,
  relativeTime,
  sessionStatusColor,
  sessionStatusLabel,
} from "./components/card.ts";
import { renderAgentRecruitmentModal } from "./components/recruit-modal.ts";
import { renderTimeline, renderCognitivePlanPanel } from "./components/sidebar.ts";
import { SandboxProps } from "./types.ts";
import type { GatewaySessionRow, SandboxChatEvents } from "../../types.ts";

const MAIN_SESSION_ALIASES = new Set(["main", "agent:main:main"]);

function isWorking(row: GatewaySessionRow, sandboxChatEvents?: SandboxChatEvents): boolean {
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

function renderSparkline(values: number[] | undefined, stroke = "#60a5fa") {
  const points = (values ?? []).map((entry) => Math.max(0, Math.min(1, Number(entry) || 0)));
  if (points.length < 2) {
    return html`<div class="sparkline-empty">${t("sandbox.consciousness.emptyTrend")}</div>`;
  }
  const width = 160;
  const height = 36;
  const step = width / (points.length - 1);
  const polyline = points
    .map(
      (value, index) => `${Math.round(index * step)},${Math.round((1 - value) * (height - 4)) + 2}`,
    )
    .join(" ");
  return html`
    <svg class="sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      <polyline points="${polyline}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>
    </svg>
  `;
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

  const totalBusy = activeSessions.filter((r) => isWorking(r, props.sandboxChatEvents)).length;
  const totalIdle = Math.max(0, activeSessions.length - totalBusy);
  const healthPercent = props.health?.ok === false ? 0 : 100;
  const healthColor = healthPercent > 80 ? "#22c55e" : healthPercent > 40 ? "#f59e0b" : "#ef4444";
  const totalTokens = rows.reduce((acc, r) => acc + (r.totalTokens || 0), 0);
  const globalRuntimeTokens = props.usage?.totals?.totalTokens ?? totalTokens;
  const relatedTimelineRows =
    focusedIsMain || !focusedSession
      ? activeSessions
      : activeSessions.filter((r) => focusedList.some((x) => x.key === r.key));
  const telemetry = props.telemetry;
  const evolution = telemetry?.evolution ?? props.evolution;
  const cognitive = telemetry?.cognitiveState ?? props.legacy?.cognitiveState;
  const selfAwareness = evolution?.selfAwareness ?? cognitive?.selfAwareness;
  const criteria = evolution?.criteria ?? cognitive?.criteria;
  const selfModel = evolution?.selfModel ?? cognitive?.selfModel;
  const homeostasis = evolution?.homeostasis ?? cognitive?.homeostasis;
  const selfModification = evolution?.selfModification;
  const ethics = evolution?.ethics ?? cognitive?.ethics;
  const trends = evolution?.trends ?? cognitive?.trends;
  const consciousness = evolution?.consciousness ?? props.consciousness;
  const policy = evolution?.policy;
  const guardrailDecision = policy?.guardrailDecision ?? evolution?.guardrailDecision ?? "ALLOW";
  const maintenanceDecision =
    policy?.maintenanceDecision ?? evolution?.maintenanceDecision ?? "balanced";
  const reasonCode = policy?.reasonCode || "NA";
  const telemetryTimestamp = telemetry?.generatedAt ?? props.timestamp;
  const telemetrySource = telemetry?.source ?? "legacy";
  const memoryPersistence = props.memoryPersistence ?? evolution?.memoryPersistence;
  const delivery = props.executionDelivery;
  const eternal = props.eternalMode;
  const ct = (key: string, fallback: string) => {
    const value = t(key);
    return !value || value === key ? fallback : String(value);
  };

  const asRatio = (value: unknown): number => {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return 0;
    }
    return Math.max(0, Math.min(1, num));
  };
  const asPercent = (value: unknown): string => `${Math.round(asRatio(value) * 100)}%`;
  const badge = (ok: boolean | undefined): string =>
    ok ? ct("common.yes", "PASS") : ct("common.no", "WAIT");

  const renderMetricCard = (
    title: string,
    value: string,
    caption: string,
    trend: number[] | undefined,
    color: string,
  ) => html`
    <article class="metric-card">
      <div class="metric-card__head">
        <span class="metric-card__title">${title}</span>
        <span class="metric-card__value">${value}</span>
      </div>
      <div class="metric-card__sparkline">${renderSparkline(trend, color)}</div>
      <div class="metric-card__caption">${caption}</div>
    </article>
  `;

  const renderSessionPill = (row: GatewaySessionRow, label?: string) => {
    const rowIsWorking = isWorking(row, props.sandboxChatEvents);
    const statusColor = sessionStatusColor(row, rowIsWorking);
    const selected = focusedSession?.key === row.key;
    return html`
      <button
        type="button"
        class="sbx-session-pill"
        aria-pressed=${selected ? "true" : "false"}
        aria-label=${t("sandbox.a11y.focusSession", { session: label || row.label || row.key })}
        style=${`border-color:${selected ? `${statusColor}88` : "rgba(148,163,184,0.28)"}; background:${
          selected ? "rgba(37,99,235,0.14)" : "rgba(15,23,42,0.72)"
        };`}
        @click=${() => props.onSessionFocus?.(row.key)}
      >
        <div class="sbx-session-pill__head">
          <span class="sbx-session-pill__name">${label || row.label || row.key}</span>
          <span class="sbx-session-pill__state" style=${`background:${statusColor};`}></span>
        </div>
        <div class="sbx-session-pill__meta">
          <span>${sessionStatusLabel(row, rowIsWorking)}</span>
          <span>${relativeTime(row.updatedAt)}</span>
        </div>
      </button>
    `;
  };

  return html`
      <div class="sandbox-v2 ${evolution?.singularityActive ? "sandbox-v2--singularity" : ""}">
      <style>
        .sandbox-v2 {
          --bg: #020617;
          --panel: rgba(15, 23, 42, 0.86);
          --panel-border: rgba(148, 163, 184, 0.22);
          --text: #e2e8f0;
          --text-subtle: #94a3b8;
          --accent: #38bdf8;
          --good: #22c55e;
          --warn: #f59e0b;
          --danger: #ef4444;
          color: var(--text);
          min-height: 100%;
          padding: 18px;
          background:
            radial-gradient(circle at 8% 8%, rgba(14, 165, 233, 0.24), transparent 35%),
            radial-gradient(circle at 92% 0%, rgba(99, 102, 241, 0.18), transparent 36%),
            linear-gradient(180deg, #030712 0%, #020617 55%, #01030a 100%);
        }

        .sandbox-v2--singularity {
          box-shadow: inset 0 0 120px rgba(56, 189, 248, 0.1);
        }

        .sandbox-v2 .sbx-shell {
          display: grid;
          gap: 14px;
        }

        .sandbox-v2 .sbx-topbar {
          display: grid;
          grid-template-columns: 1.4fr auto;
          gap: 14px;
          align-items: center;
          padding: 14px 16px;
          background: linear-gradient(145deg, rgba(15, 23, 42, 0.95), rgba(15, 23, 42, 0.84));
          border: 1px solid var(--panel-border);
          border-radius: 16px;
        }

        .sandbox-v2 .sbx-topbar__title {
          display: grid;
          gap: 4px;
        }

        .sandbox-v2 .sbx-topbar__eyebrow {
          font-size: 0.72rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--text-subtle);
        }

        .sandbox-v2 .sbx-topbar__headline {
          font-size: 1.2rem;
          font-weight: 700;
        }

        .sandbox-v2 .sbx-topbar__summary {
          color: var(--text-subtle);
          font-size: 0.82rem;
        }

        .sandbox-v2 .sbx-topbar__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-end;
        }

        .sandbox-v2 .sbx-chip,
        .sandbox-v2 .sbx-chip-button {
          border: 1px solid var(--panel-border);
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 0.78rem;
          line-height: 1;
          background: rgba(15, 23, 42, 0.68);
          color: var(--text);
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .sandbox-v2 .sbx-chip-button {
          cursor: pointer;
        }

        .sandbox-v2 .sbx-chip-button:hover {
          border-color: rgba(56, 189, 248, 0.4);
          background: rgba(30, 41, 59, 0.92);
        }

        .sandbox-v2 .sbx-status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .sandbox-v2 .sbx-layout {
          display: grid;
          grid-template-columns: 280px minmax(0, 1fr) 340px;
          gap: 14px;
        }

        .sandbox-v2 .sbx-panel {
          background: var(--panel);
          border: 1px solid var(--panel-border);
          border-radius: 14px;
          padding: 14px;
          overflow: hidden;
        }

        .sandbox-v2 .sbx-panel + .sbx-panel {
          margin-top: 12px;
        }

        .sandbox-v2 .sbx-panel__title {
          font-size: 0.86rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #cbd5e1;
          margin-bottom: 10px;
        }

        .sandbox-v2 .sbx-session-stack {
          display: grid;
          gap: 8px;
          max-height: 50vh;
          overflow: auto;
          padding-right: 2px;
        }

        .sandbox-v2 .sbx-session-pill {
          width: 100%;
          text-align: left;
          border-radius: 12px;
          padding: 10px;
          border: 1px solid var(--panel-border);
          color: var(--text);
          cursor: pointer;
          transition: border-color 120ms ease;
        }

        .sandbox-v2 .sbx-session-pill:hover {
          border-color: rgba(56, 189, 248, 0.5);
        }

        .sandbox-v2 .sbx-session-pill__head {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          align-items: center;
          margin-bottom: 4px;
        }

        .sandbox-v2 .sbx-session-pill__name {
          font-size: 0.83rem;
          font-weight: 600;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sandbox-v2 .sbx-session-pill__state {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex: 0 0 auto;
        }

        .sandbox-v2 .sbx-session-pill__meta {
          display: flex;
          justify-content: space-between;
          gap: 6px;
          color: var(--text-subtle);
          font-size: 0.72rem;
        }

        .sandbox-v2 .sbx-stream {
          min-height: 250px;
        }

        .sandbox-v2 .agent-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
          gap: 10px;
        }

        .sandbox-v2 .agent-tile {
          border: 1px solid var(--panel-border);
          border-radius: 12px;
          padding: 10px;
          background: rgba(2, 6, 23, 0.58);
          text-align: left;
          color: var(--text);
          cursor: pointer;
        }

        .sandbox-v2 .agent-tile:hover {
          border-color: rgba(56, 189, 248, 0.44);
        }

        .sandbox-v2 .agent-tile__head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .sandbox-v2 .agent-tile__task {
          margin-top: 8px;
          font-size: 0.74rem;
          color: var(--text-subtle);
          min-height: 32px;
        }

        .sandbox-v2 .agent-tile__bar {
          margin-top: 8px;
          width: 100%;
          height: 5px;
          border-radius: 999px;
          background: rgba(51, 65, 85, 0.8);
          overflow: hidden;
        }

        .sandbox-v2 .agent-tile__fill {
          height: 100%;
          background: linear-gradient(90deg, #0ea5e9, #6366f1);
        }

        .sandbox-v2 .agent-tile__meta {
          margin-top: 8px;
          display: flex;
          justify-content: space-between;
          gap: 8px;
          color: var(--text-subtle);
          font-size: 0.7rem;
        }

        .sandbox-v2 .metric-grid {
          display: grid;
          gap: 10px;
        }

        .sandbox-v2 .metric-card {
          border: 1px solid var(--panel-border);
          border-radius: 12px;
          padding: 10px;
          background: rgba(2, 6, 23, 0.58);
        }

        .sandbox-v2 .metric-card__head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }

        .sandbox-v2 .metric-card__title {
          color: #cbd5e1;
          font-size: 0.74rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .sandbox-v2 .metric-card__value {
          font-weight: 700;
          font-size: 0.9rem;
        }

        .sandbox-v2 .metric-card__sparkline {
          margin: 8px 0 4px;
          min-height: 36px;
        }

        .sandbox-v2 .metric-card__caption {
          color: var(--text-subtle);
          font-size: 0.72rem;
        }

        .sandbox-v2 .sparkline {
          width: 100%;
          height: 36px;
        }

        .sandbox-v2 .sparkline-empty {
          color: var(--text-subtle);
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .sandbox-v2 .decision-list {
          display: grid;
          gap: 8px;
          color: #cbd5e1;
          font-size: 0.78rem;
        }

        .sandbox-v2 .decision-list strong {
          color: #f8fafc;
          font-size: 0.74rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-right: 6px;
        }

        .sandbox-v2 .matrix-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .sandbox-v2 .matrix-cell {
          border: 1px solid var(--panel-border);
          border-radius: 10px;
          padding: 8px;
          background: rgba(2, 6, 23, 0.58);
          font-size: 0.72rem;
        }

        .sandbox-v2 .matrix-cell__label {
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-subtle);
          margin-bottom: 4px;
        }

        .sandbox-v2 .matrix-cell__values {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          color: #e2e8f0;
        }

        .sandbox-v2 .system-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        .sandbox-v2 .system-cell {
          border: 1px solid var(--panel-border);
          border-radius: 10px;
          padding: 10px;
          background: rgba(2, 6, 23, 0.58);
        }

        .sandbox-v2 .system-cell__label {
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-subtle);
        }

        .sandbox-v2 .system-cell__value {
          margin-top: 6px;
          font-size: 1rem;
          font-weight: 700;
        }

        .sandbox-v2 .sbx-error-box {
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid rgba(239, 68, 68, 0.5);
          color: #fecaca;
          background: rgba(127, 29, 29, 0.3);
          font-size: 0.82rem;
        }

        .sandbox-v2 .sbx-muted {
          color: var(--text-subtle);
          font-size: 0.76rem;
        }

        @media (max-width: 1280px) {
          .sandbox-v2 .sbx-layout {
            grid-template-columns: 240px minmax(0, 1fr);
          }
          .sandbox-v2 .sbx-right-rail {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 900px) {
          .sandbox-v2 {
            padding: 12px;
          }
          .sandbox-v2 .sbx-topbar {
            grid-template-columns: 1fr;
          }
          .sandbox-v2 .sbx-topbar__actions {
            justify-content: flex-start;
          }
          .sandbox-v2 .sbx-layout {
            grid-template-columns: 1fr;
          }
          .sandbox-v2 .system-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      </style>

      <div class="sbx-shell">
        <section class="sbx-topbar">
          <div class="sbx-topbar__title">
            <div class="sbx-topbar__eyebrow">${ct("sandbox.v2.eyebrow", "Sandbox Operations")}</div>
            <div class="sbx-topbar__headline">${ct("sandbox.v2.headline", "AEON Conscious Orchestration Deck")}</div>
            <div class="sbx-topbar__summary">
              ${ct("sandbox.v2.summary", "A live control surface for sessions, policy decisions, and consciousness telemetry.")}
            </div>
          </div>
          <div class="sbx-topbar__actions">
            <span class="sbx-chip" style=${`border-color:${healthColor}66;`}>
              <span class="sbx-status-dot" style=${`background:${healthColor};`}></span>
              ${ct("sandbox.v2.health", "Health")} ${healthPercent}%
            </span>
            <span class="sbx-chip">${ct("sandbox.v2.busy", "Busy")} ${totalBusy}</span>
            <span class="sbx-chip">${ct("sandbox.v2.idle", "Idle")} ${totalIdle}</span>
            <span class="sbx-chip">${ct("sandbox.v2.phase", "Phase")} ${selfAwareness?.phase || "reactive"}</span>
            <span class="sbx-chip">Eternal ${eternal?.enabled ? "ON" : "OFF"}</span>
            <button type="button" class="sbx-chip-button" @click=${props.onRefresh}>${ct("common.refresh", "Refresh")}</button>
            <button type="button" class="sbx-chip-button" @click=${props.onToggleEternalMode}>
              ${eternal?.enabled ? "Disable" : "Enable"} Eternal
            </button>
            <button type="button" class="sbx-chip-button" @click=${props.onForceRestart}>/new</button>
            <button type="button" class="sbx-chip-button" @click=${props.onRecruitAgent}>${ct("sandbox.header.recruit", "Recruit")}</button>
          </div>
        </section>

        ${props.error ? html`<div class="sbx-error-box">${props.error}</div>` : nothing}

        <section class="sbx-layout">
          <aside class="sbx-left-rail">
            <div class="sbx-panel">
              <div class="sbx-panel__title">${ct("sandbox.v2.sessions", "Session Focus")}</div>
              <div class="sbx-session-stack">
                ${
                  globalSession
                    ? renderSessionPill(
                        globalSession,
                        ct("sandbox.v2.mainOrchestrator", "Main Orchestrator"),
                      )
                    : html`<div class="sbx-muted">${ct("sandbox.v2.mainNotFound", "Main session not found")}</div>`
                }
                ${activeSessions.map((row) => renderSessionPill(row))}
              </div>
            </div>

            <div class="sbx-panel">
              <div class="sbx-panel__title">${ct("sandbox.v2.plan", "Live Task Plan")}</div>
              ${renderCognitivePlanPanel(props.cognitivePlan, activeSessions)}
            </div>
          </aside>

          <main class="sbx-main-rail">
            <div class="sbx-panel">
              <div class="sbx-panel__title">${ct("sandbox.v2.timeline", "Execution Timeline")}</div>
              <div class="sbx-stream">${renderTimeline(relatedTimelineRows)}</div>
            </div>

            <div class="sbx-panel">
              <div class="sbx-panel__title">${ct("sandbox.v2.agents", "Active Agents")}</div>
              ${
                focusedList.length === 0
                  ? html`<div class="sbx-muted">${ct("sandbox.v2.noAgents", "No active agents in this scope.")}</div>`
                  : html`
                      <div class="agent-grid">
                        ${focusedList.map((row) => {
                          const rowIsWorking = isWorking(row, props.sandboxChatEvents);
                          const progress = tokenProgress(row);
                          const selected = focusedSession?.key === row.key;
                          return html`
                            <button
                              type="button"
                              class="agent-tile"
                              style=${selected ? "border-color: rgba(56,189,248,0.75);" : ""}
                              aria-pressed=${selected ? "true" : "false"}
                              aria-label=${t("sandbox.a11y.focusSession", { session: row.label || row.key })}
                              @click=${() => props.onSessionFocus?.(row.key)}
                            >
                              <div class="agent-tile__head">
                                <span>${row.label || row.key}</span>
                                <span class="sbx-status-dot" style=${`background:${sessionStatusColor(row, rowIsWorking)};`}></span>
                              </div>
                              <div class="agent-tile__task">${row.subject || ct("sandbox.v2.awaitingTask", "Awaiting task")}</div>
                              <div class="agent-tile__bar">
                                <div class="agent-tile__fill" style=${`width:${progress}%;`}></div>
                              </div>
                              <div class="agent-tile__meta">
                                <span>${(row.totalTokens || 0).toLocaleString()} tok</span>
                                <span>${relativeTime(row.updatedAt)}</span>
                              </div>
                            </button>
                          `;
                        })}
                      </div>
                    `
              }
            </div>

            <div class="sbx-panel">
              <div class="sbx-panel__title">${ct("sandbox.v2.system", "System Snapshot")}</div>
              <div class="system-grid">
                <div class="system-cell">
                  <div class="system-cell__label">${ct("sandbox.v2.approvals", "Approvals")}</div>
                  <div class="system-cell__value">${props.approvalsCount || 0}</div>
                </div>
                <div class="system-cell">
                  <div class="system-cell__label">${ct("sandbox.v2.channels", "Channels")}</div>
                  <div class="system-cell__value">${props.channels?.channelMeta?.length || 0}</div>
                </div>
                <div class="system-cell">
                  <div class="system-cell__label">${ct("sandbox.v2.runtimeTokens", "Runtime Tokens")}</div>
                  <div class="system-cell__value">${Math.round(globalRuntimeTokens / 1000)}k</div>
                </div>
                <div class="system-cell">
                  <div class="system-cell__label">${ct("sandbox.v2.selfAwareness", "Self Awareness")}</div>
                  <div class="system-cell__value">${asPercent(selfAwareness?.protoConsciousnessIndex)}</div>
                </div>
                <div class="system-cell">
                  <div class="system-cell__label">Delivery</div>
                  <div class="system-cell__value">${delivery?.state || "unknown"}</div>
                </div>
                <div class="system-cell">
                  <div class="system-cell__label">Memory CP</div>
                  <div class="system-cell__value">${memoryPersistence?.checkpoint ?? 0}</div>
                </div>
              </div>
            </div>
          </main>

          <aside class="sbx-right-rail">
            <div class="sbx-panel">
              <div class="sbx-panel__title">${ct("sandbox.v2.consciousness", "Consciousness Telemetry")}</div>
              <div class="sbx-muted" style="margin-bottom: 10px;">
                ${t("sandbox.consciousness.source", {
                  source: telemetrySource,
                  timestamp:
                    telemetryTimestamp != null
                      ? new Date(telemetryTimestamp).toLocaleString()
                      : t("common.na"),
                })}
              </div>
              <div class="metric-grid">
                ${renderMetricCard(
                  ct("sandbox.consciousness.cards.criteria", "Criteria"),
                  asPercent(criteria?.overallScore),
                  `${ct("sandbox.consciousness.labels.minimum", "Minimum")}: ${badge(Boolean(criteria?.minimumReady))} · ${ct("sandbox.consciousness.labels.advanced", "Advanced")}: ${badge(Boolean(criteria?.advancedReady))}`,
                  trends?.criteriaOverall,
                  "#0ea5e9",
                )}
                ${renderMetricCard(
                  ct("sandbox.consciousness.cards.selfKernel", "Self Kernel"),
                  String(consciousness?.selfKernel?.integrityState || "STABLE"),
                  `${ct("sandbox.consciousness.labels.identity", "Identity")}: ${asPercent(consciousness?.selfKernel?.identityContinuityScore ?? selfModel?.narrative?.identityContinuity)} · ${ct("sandbox.consciousness.labels.drift", "Drift")}: ${asPercent(consciousness?.selfKernel?.goalDriftScore)}`,
                  trends?.metacognitiveControl,
                  "#818cf8",
                )}
                ${renderMetricCard(
                  ct("sandbox.consciousness.cards.homeostasis", "Homeostasis"),
                  String(homeostasis?.mode || "balanced"),
                  `${ct("sandbox.consciousness.labels.stability", "Stability")}: ${asPercent(homeostasis?.stability)} · ${ct("sandbox.consciousness.labels.exploreDrive", "Explore Drive")}: ${asPercent(homeostasis?.explorationDrive)}`,
                  trends?.homeostasisStability,
                  "#22c55e",
                )}
                ${renderMetricCard(
                  ct("sandbox.consciousness.cards.guardrails", "Guardrails"),
                  String(guardrailDecision),
                  `${ct("sandbox.consciousness.labels.auditable", "Auditable")}: ${badge(Boolean(ethics?.auditable))} · ${ct("sandbox.consciousness.labels.selfModRisk", "Self-mod Risk")}: ${asPercent(selfModification?.redlineBreachRisk)}`,
                  trends?.selfModificationRisk,
                  "#ef4444",
                )}
              </div>
            </div>

            <div class="sbx-panel">
              <div class="sbx-panel__title">${ct("sandbox.v2.policy", "Policy Decision")}</div>
              <div class="decision-list">
                <div><strong>${ct("sandbox.v2.maintenance", "Maintenance")}</strong>${String(maintenanceDecision)}</div>
                <div><strong>${ct("sandbox.v2.guardrail", "Guardrail")}</strong>${String(guardrailDecision)}</div>
                <div><strong>${ct("sandbox.v2.reasonCode", "Reason Code")}</strong>${reasonCode}</div>
                <div><strong>${ct("sandbox.v2.epistemic", "Epistemic")}</strong>${String(consciousness?.epistemic?.epistemicLabel || "INFERENCE")}</div>
              </div>
            </div>

            <div class="sbx-panel">
              <div class="sbx-panel__title">${ct("sandbox.v2.decisionCard", "Decision Card")}</div>
              <div class="decision-list">
                <div><strong>${ct("sandbox.v2.why", "Why")}</strong>${consciousness?.decisionCard?.why || ct("common.na", "N/A")}</div>
                <div><strong>${ct("sandbox.v2.whyNot", "Why Not")}</strong>${consciousness?.decisionCard?.whyNot || ct("common.na", "N/A")}</div>
                <div><strong>${ct("sandbox.v2.counterfactual", "Counterfactual")}</strong>${consciousness?.decisionCard?.counterfactual || ct("common.na", "N/A")}</div>
                <div><strong>${ct("sandbox.v2.rollback", "Rollback")}</strong>${consciousness?.decisionCard?.rollbackPlan || ct("common.na", "N/A")}</div>
              </div>
            </div>

            <div class="sbx-panel">
              <div class="sbx-panel__title">${ct("sandbox.v2.impact", "Impact Lens")}</div>
              <div class="sbx-muted" style="margin-bottom: 8px;">
                ${ct("sandbox.v2.timeframe", "Timeframe")}: ${String(consciousness?.impactLens?.timeframe || "immediate")} ·
                ${ct("sandbox.v2.reversibility", "Reversibility")}: ${asPercent(consciousness?.impactLens?.reversibilityScore)}
              </div>
              <div class="matrix-grid">
                ${(
                  Object.entries(consciousness?.impactLens?.benefitRiskMatrix || {}) as Array<
                    [string, { benefit: number; risk: number }]
                  >
                ).map(
                  ([scale, entry]) => html`
                    <div class="matrix-cell">
                      <div class="matrix-cell__label">${scale}</div>
                      <div class="matrix-cell__values">
                        <span>${ct("sandbox.v2.benefit", "Benefit")} ${Math.round((entry?.benefit || 0) * 100)}</span>
                        <span>${ct("sandbox.v2.risk", "Risk")} ${Math.round((entry?.risk || 0) * 100)}</span>
                      </div>
                    </div>
                  `,
                )}
              </div>
              ${
                !consciousness?.impactLens?.benefitRiskMatrix ||
                Object.keys(consciousness.impactLens.benefitRiskMatrix).length === 0
                  ? html`<div class="sbx-muted">${ct("sandbox.v2.noImpactData", "No impact matrix data yet.")}</div>`
                  : nothing
              }
            </div>
          </aside>
        </div>
      </div>

      ${renderAgentRecruitmentModal(
        Boolean(props.recruitModalOpen),
        () => props.onRecruitModalClose?.(),
        (avatarId) => props.onAvatarSelect?.("new", avatarId),
      )}
    </div>
  `;
}
