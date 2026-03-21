import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import { renderConsciousnessStream } from "./chat/components/consciousness-stream.ts";
import { hudStyles } from "./chat/styles/hud.ts";
import { renderMemoryGraph } from "./chat/components/memory-graph.ts";
import { renderPeanoMap } from "./chat/components/peano-map.ts";

export interface AeonLogicOptions {
  loading: boolean;
  error: string | null;
  content: string | null;
  userDraft?: string;
  history?: unknown[];
  isThinking?: boolean;
  systemStatus?: import("../types.ts").AeonStatusResult | null;
  onRefresh: () => void;
  onCompaction: () => void;
  onDraftChange?: (next: string) => void;
  showManual?: boolean;
  onToggleManual?: (visible: boolean) => void;
  cognitiveLog?: import("../types.ts").CognitiveLogEntry[];
  liveThinking?: string | null;
  activeTab?: "logic" | "memory";
  viewMode?: "narrative" | "evidence";
  onTabChange?: (tab: "logic" | "memory") => void;
  onViewModeChange?: (mode: "narrative" | "evidence") => void;
  onBacktrack?: (runId: string) => void;
}

type ParsedLogicLine = {
  text: string;
  ts: number | null;
  highlighted: boolean;
};

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function formatPercent(value: number): string {
  return `${clampPercent(value).toFixed(0)}%`;
}

function formatTs(ts: number | null | undefined): string {
  if (!ts) {
    return t("chat.aeonNever");
  }
  return new Date(ts).toLocaleString();
}

function formatUptime(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) {
    return "0h 0m";
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function parseLogicLines(content: string, draft: string): ParsedLogicLine[] {
  const tokens = draft
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 1);
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const tsMatch = /<!--\s*\{\s*"ts":\s*(\d+)(?:,\s*"v":\s*\d+)?\s*\}\s*-->/.exec(line);
      const text = line.replace(/<!--\s*\{[^}]+\}\s*-->/g, "").trim();
      const highlighted =
        tokens.length > 0 && tokens.some((token) => text.toLowerCase().includes(token));
      return { text, ts: tsMatch ? Number(tsMatch[1]) : null, highlighted };
    });
}

function renderCoreMetric(
  label: string,
  value: string,
  sub: string,
  glow: "cyan" | "amber" | "violet",
) {
  return html`
    <article class="aeon-life-metric aeon-life-metric--${glow}">
      <div class="aeon-life-metric__label">${label}</div>
      <div class="aeon-life-metric__value">${value}</div>
      <div class="aeon-life-metric__sub">${sub}</div>
    </article>
  `;
}

function renderIdentityTimeline(log: import("../types.ts").CognitiveLogEntry[] | undefined) {
  const timeline = [...(log ?? [])].sort((a, b) => b.timestamp - a.timestamp).slice(0, 8);
  if (timeline.length === 0) {
    return html`<div class="aeon-life-note">${t("chat.aeonNoTimelineEvents")}</div>`;
  }
  return html`
    <div class="aeon-life-timeline">
      ${timeline.map((entry) => {
        const typeIcon =
          entry.type === "anomaly" ? "⚠" :
          entry.type === "dreaming" ? "⌬" :
          entry.type === "reflection" ? "∿" :
          entry.type === "synthesis" ? "❖" :
          "⚬";
        return html`
          <article class="aeon-life-timeline__item">
            <div class="aeon-life-timeline__dot"></div>
            <div class="aeon-life-timeline__body">
              <div class="aeon-life-timeline__head">
                <strong>${typeIcon} ${timelineTypeLabel(entry.type)}</strong>
                <span>${new Date(entry.timestamp).toLocaleTimeString()}</span>
              </div>
              <div class="aeon-life-timeline__text">${entry.content}</div>
            </div>
          </article>
        `;
      })}
    </div>
  `;
}

function timelineTypeLabel(type: import("../types.ts").CognitiveLogEntry["type"]): string {
  if (type === "reflection") return t("chat.aeonTimelineTypeReflection");
  if (type === "synthesis") return t("chat.aeonTimelineTypeSynthesis");
  if (type === "deliberation") return t("chat.aeonTimelineTypeDeliberation");
  if (type === "anomaly") return t("chat.aeonTimelineTypeAnomaly");
  if (type === "dreaming") return t("chat.aeonTimelineTypeDreaming");
  if (type === "patch") return t("chat.aeonTimelineTypePatch");
  return type;
}

function localizeEnumValue(value: string): string {
  const key = value.trim().toLowerCase();
  const map: Record<string, string> = {
    allow: t("chat.aeonEnumAllow"),
    soft_warn: t("chat.aeonEnumSoftWarn"),
    block: t("chat.aeonEnumBlock"),
    stable: t("chat.aeonEnumStable"),
    drifting: t("chat.aeonEnumDrifting"),
    degraded: t("chat.aeonEnumDegraded"),
    unknown: t("chat.aeonEnumUnknown"),
    balanced: t("chat.aeonEnumBalanced"),
    stabilize: t("chat.aeonEnumStabilize"),
    explore: t("chat.aeonEnumExplore"),
  };
  return map[key] ?? value;
}

export function renderAeonLogic(params: AeonLogicOptions) {
  const status = params.systemStatus;
  const telemetry = status?.telemetry;
  const telemetryV4 = telemetry?.v4;
  const cognitive = telemetry?.cognitiveState ?? status?.cognitiveState;
  const evolution = telemetry?.evolution ?? status?.evolution;
  const system = status?.system;

  const entropy = cognitive?.entropy ?? status?.cognitiveEntropy ?? 0;
  const memorySaturation = cognitive?.density ?? status?.memorySaturation ?? 0;
  const neuralDepth = status?.neuralDepth ?? 0;
  const chaosScore = status?.chaosScore ?? 0;
  const guardrailDecision = cognitive?.guardrailDecision ?? evolution?.guardrailDecision ?? "ALLOW";
  const maintenanceDecision =
    cognitive?.maintenanceDecision ?? evolution?.maintenanceDecision ?? "balanced";
  const integrity = status?.consciousness?.selfKernel?.integrityState ?? "STABLE";
  const identityContinuity = status?.consciousness?.selfKernel?.identityContinuityScore ?? 0;
  const goalDrift = status?.consciousness?.selfKernel?.goalDriftScore ?? 0;
  const calibration = status?.consciousness?.selfKernel?.epistemicCalibrationScore ?? 0;
  const trusted =
    guardrailDecision === "BLOCK"
      ? false
      : guardrailDecision === "ALLOW" || guardrailDecision === "SOFT_WARN"
        ? true
        : null;
  const epistemic =
    status?.consciousness?.epistemic?.epistemicLabel ?? cognitive?.epistemicLabel ?? "UNKNOWN";

  const recommendSeal = memorySaturation >= 80;
  const activeTab = params.activeTab ?? "logic";
  const viewMode = params.viewMode ?? "narrative";
  const logicLines = parseLogicLines(params.content ?? "", params.userDraft ?? "");
  const hitLines = logicLines.filter((line) => line.highlighted);
  const renderLines = (hitLines.length > 0 ? hitLines : logicLines).slice(0, 36);

  const liveThinking = params.liveThinking?.trim() ?? "";
  const streamLog = liveThinking
    ? [
        ...(params.cognitiveLog ?? []),
        {
          timestamp: Date.now(),
          type: "deliberation" as const,
          content: liveThinking.length > 420 ? `${liveThinking.slice(0, 420)}...` : liveThinking,
          metadata: { focus: "live-stream" },
        },
      ]
    : params.cognitiveLog;

  const pulse = Math.max(0.2, Math.min(1, entropy / 25));

  return html`
    <style>
      \${hudStyles.cssText}
      .aeon-life {
        display: grid;
        gap: 16px;
      }
      .aeon-life-hero {
        position: relative;
        overflow: hidden;
        border-radius: 16px;
        border: 1px solid rgba(45, 212, 191, 0.3);
        background:
          radial-gradient(circle at 12% 20%, rgba(45, 212, 191, 0.18), transparent 35%),
          radial-gradient(circle at 88% 75%, rgba(168, 85, 247, 0.2), transparent 36%),
          linear-gradient(120deg, rgba(2, 6, 23, 0.95), rgba(15, 23, 42, 0.88));
        padding: 20px;
      }
      .aeon-life-hero::after {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          repeating-linear-gradient(
            90deg,
            rgba(148, 163, 184, 0.05) 0,
            rgba(148, 163, 184, 0.05) 1px,
            transparent 1px,
            transparent 28px
          );
      }
      .aeon-life-header {
        position: relative;
        z-index: 2;
        display: grid;
        grid-template-columns: 1.4fr auto;
        gap: 12px;
        align-items: center;
      }
      .aeon-life-title {
        margin: 0;
        font-size: 30px;
        font-weight: 800;
        letter-spacing: -0.02em;
      }
      .aeon-life-subtitle {
        margin-top: 8px;
        color: var(--text-muted, #94a3b8);
        line-height: 1.5;
      }
      .aeon-life-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: flex-end;
      }
      .aeon-life-pulse {
        margin-top: 12px;
        display: grid;
        grid-template-columns: 140px 1fr;
        gap: 12px;
        align-items: center;
        position: relative;
        z-index: 2;
      }
      .aeon-life-core {
        width: 120px;
        height: 120px;
        border-radius: 50%;
        border: 1px solid rgba(45, 212, 191, 0.5);
        display: grid;
        place-items: center;
        position: relative;
        background: radial-gradient(circle, rgba(45, 212, 191, 0.25), rgba(2, 6, 23, 0.2));
        box-shadow: 0 0 0 12px rgba(45, 212, 191, 0.08), 0 0 0 26px rgba(168, 85, 247, 0.06);
        animation: aeon-life-heartbeat calc(2.8s - ${pulse.toFixed(2)}s) ease-in-out infinite;
      }
      .aeon-life-core__value {
        font-size: 22px;
        font-weight: 700;
      }
      .aeon-life-core__label {
        font-size: 11px;
        color: var(--text-muted, #94a3b8);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .aeon-life-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .aeon-life-chip {
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.3);
        padding: 4px 10px;
        background: rgba(15, 23, 42, 0.7);
        font-size: 12px;
      }
      .aeon-life-chip.warn {
        border-color: rgba(251, 146, 60, 0.45);
        color: #fdba74;
      }
      .aeon-life-grid {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 10px;
      }
      .aeon-life-metric {
        border-radius: 12px;
        border: 1px solid var(--border-color);
        padding: 12px;
        background: rgba(15, 23, 42, 0.52);
      }
      .aeon-life-metric__label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--text-muted, #94a3b8);
      }
      .aeon-life-metric__value {
        margin-top: 6px;
        font-size: 21px;
        font-weight: 700;
      }
      .aeon-life-metric__sub {
        margin-top: 4px;
        font-size: 12px;
        color: var(--text-muted, #94a3b8);
      }
      .aeon-life-metric--cyan .aeon-life-metric__value {
        color: #67e8f9;
      }
      .aeon-life-metric--amber .aeon-life-metric__value {
        color: #fbbf24;
      }
      .aeon-life-metric--violet .aeon-life-metric__value {
        color: #c4b5fd;
      }
      .aeon-life-main {
        display: grid;
        grid-template-columns: 1.75fr 1fr;
        gap: 12px;
        min-height: 620px;
      }
      .aeon-life-card {
        border-radius: 14px;
        border: 1px solid var(--border-color);
        background: rgba(15, 23, 42, 0.54);
        padding: 14px;
      }
      .aeon-life-tabs {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
        flex-wrap: wrap;
      }
      .aeon-life-tab {
        border: 1px solid var(--border-color);
        background: transparent;
        border-radius: 10px;
        color: var(--text-muted, #94a3b8);
        padding: 6px 12px;
        font-size: 12px;
        cursor: pointer;
      }
      .aeon-life-tab.active {
        color: #d1fae5;
        border-color: rgba(45, 212, 191, 0.45);
        background: rgba(45, 212, 191, 0.12);
      }
      .aeon-life-evidence {
        display: grid;
        gap: 10px;
      }
      .aeon-life-evidence-block {
        border: 1px solid rgba(148, 163, 184, 0.22);
        border-radius: 10px;
        padding: 10px;
        background: rgba(2, 6, 23, 0.35);
      }
      .aeon-life-evidence-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .aeon-life-evidence-row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px;
        font-size: 12px;
        padding: 4px 0;
        border-bottom: 1px dashed rgba(148, 163, 184, 0.18);
      }
      .aeon-life-evidence-row:last-child {
        border-bottom: none;
      }
      .aeon-life-logic {
        display: grid;
        gap: 8px;
        max-height: 470px;
        overflow: auto;
      }
      .aeon-life-logic-row {
        border: 1px solid rgba(148, 163, 184, 0.22);
        border-radius: 10px;
        padding: 10px;
      }
      .aeon-life-logic-row.hit {
        border-color: rgba(45, 212, 191, 0.5);
        background: rgba(45, 212, 191, 0.1);
      }
      .aeon-life-logic-text {
        line-height: 1.45;
      }
      .aeon-life-logic-meta {
        margin-top: 8px;
        font-size: 11px;
        color: var(--text-muted, #94a3b8);
      }
      .aeon-life-intent {
        margin-top: 12px;
      }
      .aeon-life-intent input {
        width: 100%;
        border: 1px solid var(--border-color);
        border-radius: 10px;
        padding: 10px 12px;
        background: rgba(2, 6, 23, 0.55);
        color: var(--text-color);
      }
      .aeon-life-side {
        display: flex;
        flex-direction: column;
        gap: 12px;
        align-content: start;
        max-height: calc(100vh - 240px);
        overflow-y: auto;
      }
      .aeon-life-side .consciousness-stream {
        min-height: 420px;
        flex: 1;
      }
      .aeon-life-kv {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px;
        border-bottom: 1px dashed rgba(148, 163, 184, 0.22);
        padding: 8px 0;
        font-size: 13px;
      }
      .aeon-life-kv:last-child {
        border-bottom: none;
      }
      .aeon-life-note {
        margin-top: 8px;
        font-size: 12px;
        color: var(--text-muted, #94a3b8);
        line-height: 1.45;
      }
      .aeon-life-timeline {
        display: grid;
        gap: 8px;
        max-height: 220px;
        overflow: auto;
      }
      .aeon-life-timeline__item {
        display: grid;
        grid-template-columns: 14px 1fr;
        gap: 8px;
      }
      .aeon-life-timeline__dot {
        width: 8px;
        height: 8px;
        margin-top: 6px;
        border-radius: 50%;
        background: #67e8f9;
        box-shadow: 0 0 8px rgba(103, 232, 249, 0.7);
      }
      .aeon-life-timeline__body {
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 8px;
        padding: 8px;
      }
      .aeon-life-timeline__head {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        font-size: 11px;
        color: var(--text-muted, #94a3b8);
      }
      .aeon-life-timeline__text {
        margin-top: 6px;
        font-size: 11px;
        line-height: 1.5;
        font-family: var(--fractal-font-mono);
        color: #e2e8f0;
      }
      .aeon-life-manual {
        position: fixed;
        inset: 0;
        background: rgba(2, 6, 23, 0.78);
        z-index: 1200;
        display: grid;
        place-items: center;
        padding: 20px;
      }
      .aeon-life-manual__panel {
        width: min(860px, 100%);
        border: 1px solid var(--border-color);
        border-radius: 14px;
        background: rgba(15, 23, 42, 0.98);
        padding: 20px;
      }
      .aeon-life-manual__grid {
        margin-top: 14px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      .aeon-life-manual__item {
        border: 1px solid var(--border-color);
        border-radius: 10px;
        padding: 12px;
      }
      .aeon-life-manual__item h4 {
        margin: 0 0 8px;
        font-size: 14px;
      }
      .aeon-life-manual__item p {
        margin: 0;
        font-size: 13px;
        color: var(--text-muted, #94a3b8);
        line-height: 1.45;
      }
      @keyframes aeon-life-heartbeat {
        0%, 100% { transform: scale(1); }
        25% { transform: scale(1.035); }
        55% { transform: scale(1.01); }
      }
      @media (max-width: 1120px) {
        .aeon-life-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .aeon-life-main {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 760px) {
        .aeon-life-header {
          grid-template-columns: 1fr;
        }
        .aeon-life-actions {
          justify-content: flex-start;
        }
        .aeon-life-pulse {
          grid-template-columns: 1fr;
        }
        .aeon-life-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .aeon-life-manual__grid {
          grid-template-columns: 1fr;
        }
      }
    </style>

    <section class="aeon-life aeon-entry-anim">
      <header class="aeon-life-hero">
        <div class="aeon-life-header">
          <div>
            <h1 class="aeon-life-title">${t("chat.aeonChamberTitle")}</h1>
            <div class="aeon-life-subtitle">
              ${t("chat.aeonChamberSubtitle")}
            </div>
          </div>
          <div class="aeon-life-actions">
            <button class="btn" @click=${() => params.onToggleManual?.(!(params.showManual ?? false))}>
              ${t("chat.aeonWhatIs")}
            </button>
            <button class="btn" @click=${params.onRefresh} ?disabled=${params.loading}>
              ${t("common.refresh")}
            </button>
            <button class="btn primary" @click=${params.onCompaction} ?disabled=${params.loading}>
              ${t("chat.sealAxioms")}
            </button>
          </div>
        </div>

        <div class="aeon-life-pulse">
          <div class="aeon-life-core">
            <div class="aeon-life-core__value">${entropy.toFixed(1)}</div>
            <div class="aeon-life-core__label">entropy pulse</div>
          </div>
          <div class="aeon-life-chips">
            <span class="aeon-life-chip">${t("chat.aeonGuardrail")}: ${localizeEnumValue(String(guardrailDecision))}</span>
            <span class="aeon-life-chip">${t("chat.aeonMaintenance")}: ${localizeEnumValue(String(maintenanceDecision))}</span>
            <span class="aeon-life-chip">${t("chat.aeonIntegrity")}: ${localizeEnumValue(String(integrity))}</span>
            <span class="aeon-life-chip">${t("chat.aeonEpistemic")}: ${localizeEnumValue(String(epistemic))}</span>
            ${
              recommendSeal
                ? html`<span class="aeon-life-chip warn">${t("chat.aeonMemorySealRecommend")}</span>`
                : nothing
            }
          </div>
        </div>
      </header>

      <section class="aeon-life-grid">
        ${renderCoreMetric(t("chat.aeonMetricMemorySaturation"), formatPercent(memorySaturation), `${((status?.memorySize ?? 0) / 1024).toFixed(1)} KB`, "amber")}
        ${renderCoreMetric(t("chat.aeonMetricNeuralDepth"), String(neuralDepth), t("chat.aeonMetricLogicGates", { count: String(status?.logicGateCount ?? 0) }), "violet")}
        ${renderCoreMetric(t("chat.aeonMetricIdentityContinuity"), identityContinuity.toFixed(2), t("chat.aeonMetricGoalDrift", { score: goalDrift.toFixed(2) }), "cyan")}
        ${renderCoreMetric(t("chat.aeonMetricCalibration"), calibration.toFixed(2), t("chat.aeonMetricTrusted", { state: trusted == null ? t("chat.aeonEnumUnknown") : trusted ? t("chat.aeonTrustedYes") : t("chat.aeonTrustedNo") }), "cyan")}
        ${renderCoreMetric(t("chat.aeonMetricHostCpu"), formatPercent((system?.cpuLoad?.[0] ?? 0) * 100), t("chat.aeonMetricUptime", { uptime: formatUptime(system?.uptime) }), "violet")}
        ${renderCoreMetric(t("chat.aeonMetricChaosScore"), chaosScore.toFixed(1), t("chat.aeonMetricChaosHint"), "amber")}
      </section>

      <section class="aeon-life-main">
        <article class="aeon-life-card">
          <div class="aeon-life-tabs">
            <button class="aeon-life-tab ${viewMode === "narrative" ? "active" : ""}" @click=${() => params.onViewModeChange?.("narrative")}>
              Narrative
            </button>
            <button class="aeon-life-tab ${viewMode === "evidence" ? "active" : ""}" @click=${() => params.onViewModeChange?.("evidence")}>
              Evidence
            </button>
            <button class="aeon-life-tab ${activeTab === "logic" ? "active" : ""}" @click=${() => params.onTabChange?.("logic")}>
              ${t("chat.aeonTabLogicTissue")}
            </button>
            <button class="aeon-life-tab ${activeTab === "memory" ? "active" : ""}" @click=${() => params.onTabChange?.("memory")}>
              ${t("chat.aeonTabMemoryGraph")}
            </button>
          </div>

          ${
            params.loading
              ? html`<div class="muted">${t("chat.aeonBooting")}</div>`
              : params.error
                ? html`<div class="callout danger">${params.error}</div>`
                : viewMode === "evidence"
                  ? html`
                    <section class="aeon-life-evidence">
                      ${renderPeanoMap({ 
                        trajectory: status?.telemetry?.evolution?.peanoTrajectory ?? status?.peanoTrajectory, 
                        active: true 
                      })}
                      <article class="aeon-life-evidence-block">
                        <h4 style="margin:0 0 8px;">telemetry.v4.evidence</h4>
                        <div class="aeon-life-evidence-grid">
                          <div class="aeon-life-evidence-row"><span>windowMs</span><strong>${telemetryV4?.evidence.windowMs ?? 0}</strong></div>
                          <div class="aeon-life-evidence-row"><span>eventCount</span><strong>${telemetryV4?.evidence.eventCount ?? 0}</strong></div>
                          <div class="aeon-life-evidence-row"><span>execution.successRate</span><strong>${(telemetryV4?.evidence.execution.successRate ?? 0).toFixed(3)}</strong></div>
                          <div class="aeon-life-evidence-row"><span>execution.rollbackRate</span><strong>${(telemetryV4?.evidence.execution.rollbackRate ?? 0).toFixed(3)}</strong></div>
                          <div class="aeon-life-evidence-row"><span>conflict.density</span><strong>${(telemetryV4?.evidence.conflict.density ?? 0).toFixed(3)}</strong></div>
                          <div class="aeon-life-evidence-row"><span>memory.writeValidityRate</span><strong>${(telemetryV4?.evidence.memory.writeValidityRate ?? 0).toFixed(3)}</strong></div>
                          <div class="aeon-life-evidence-row"><span>deconfliction.llmCoverage</span><strong>${(telemetryV4?.evidence.deconfliction.llmCoverage ?? 0).toFixed(3)}</strong></div>
                          <div class="aeon-life-evidence-row"><span>deconfliction.fallbackRate</span><strong>${(telemetryV4?.evidence.deconfliction.fallbackRate ?? 0).toFixed(3)}</strong></div>
                        </div>
                      </article>
                      <article class="aeon-life-evidence-block">
                        <h4 style="margin:0 0 8px;">telemetry.v4.inference + confidence</h4>
                        <div class="aeon-life-evidence-grid">
                          <div class="aeon-life-evidence-row"><span>inference.selfAwarenessIndex</span><strong>${(telemetryV4?.inference.selfAwarenessIndex ?? 0).toFixed(3)}</strong></div>
                          <div class="aeon-life-evidence-row"><span>inference.integrityScore</span><strong>${(telemetryV4?.inference.integrityScore ?? 0).toFixed(3)}</strong></div>
                          <div class="aeon-life-evidence-row"><span>inference.autonomyScore</span><strong>${(telemetryV4?.inference.autonomyScore ?? 0).toFixed(3)}</strong></div>
                          <div class="aeon-life-evidence-row"><span>inference.riskScore</span><strong>${(telemetryV4?.inference.riskScore ?? 0).toFixed(3)}</strong></div>
                          <div class="aeon-life-evidence-row"><span>confidence.overall</span><strong>${(telemetryV4?.confidence.overall ?? 0).toFixed(3)}</strong></div>
                          <div class="aeon-life-evidence-row"><span>confidence.coverage</span><strong>${(telemetryV4?.confidence.evidenceCoverage ?? 0).toFixed(3)}</strong></div>
                        </div>
                      </article>
                      <article class="aeon-life-evidence-block">
                        <h4 style="margin:0 0 8px;">telemetry.v4.curve + autospawn</h4>
                        <div class="aeon-life-evidence-grid">
                          <div class="aeon-life-evidence-row"><span>curveType/order</span><strong>${telemetryV4?.curve.curveType ?? "hilbert"}/${telemetryV4?.curve.curveOrder ?? 0}</strong></div>
                          <div class="aeon-life-evidence-row"><span>projection</span><strong>${telemetryV4?.curve.projectionMethod ?? "deterministic-2d"}</strong></div>
                          <div class="aeon-life-evidence-row"><span>projectionSeed</span><strong>${telemetryV4?.curve.projectionSeed ?? 0}</strong></div>
                          <div class="aeon-life-evidence-row"><span>curve.point</span><strong>(${telemetryV4?.curve.point.x ?? 0}, ${telemetryV4?.curve.point.y ?? 0})</strong></div>
                          <div class="aeon-life-evidence-row"><span>autospawn.enabled</span><strong>${String(telemetryV4?.autospawn.enabled ?? false)}</strong></div>
                          <div class="aeon-life-evidence-row"><span>autospawn.circuitOpen</span><strong>${String(telemetryV4?.autospawn.circuitOpen ?? false)}</strong></div>
                          <div class="aeon-life-evidence-row"><span>autospawn.inFlight</span><strong>${telemetryV4?.autospawn.inFlight ?? 0}</strong></div>
                          <div class="aeon-life-evidence-row"><span>autospawn.triggerCount</span><strong>${telemetryV4?.autospawn.triggerCount ?? 0}</strong></div>
                          <div class="aeon-life-evidence-row"><span>autospawn.watchdogActive</span><strong>${String(telemetryV4?.autospawn.watchdogActive ?? false)}</strong></div>
                          <div class="aeon-life-evidence-row"><span>autospawn.degraded</span><strong>${String(telemetryV4?.autospawn.degraded ?? false)}</strong></div>
                          <div class="aeon-life-evidence-row"><span>autospawn.retryCount</span><strong>${telemetryV4?.autospawn.retryCount ?? 0}</strong></div>
                        </div>
                      </article>
                    </section>
                  `
                  : activeTab === "memory"
                    ? html`${renderMemoryGraph({ graph: evolution?.memoryGraph, active: true })}`
                    : html`
                    <div class="aeon-life-note">
                      ${
                        hitLines.length > 0
                          ? t("chat.aeonResonanceActive", { count: String(hitLines.length) })
                          : t("chat.aeonNoResonance")
                      }
                    </div>
                    <div class="aeon-life-logic">
                      ${
                        renderLines.length === 0
                          ? html`<div class="muted">${t("chat.noGates")}</div>`
                          : renderLines.map(
                              (line) => html`
                              <article class="aeon-life-logic-row ${line.highlighted ? "hit" : ""}">
                                <div class="aeon-life-logic-text">${line.text}</div>
                                <div class="aeon-life-logic-meta">${t("chat.aeonUpdated")}: ${formatTs(line.ts)}</div>
                              </article>
                            `,
                            )
                      }
                    </div>
                  `
          }

          <div class="aeon-life-intent">
            <input
              type="text"
              placeholder=${t("chat.aeonIntentPlaceholder")}
              .value=${params.userDraft ?? ""}
              @input=${(event: Event) => params.onDraftChange?.((event.target as HTMLInputElement).value)}
            />
          </div>
        </article>

        <aside class="aeon-life-side">
          <article class="aeon-life-card">
            <h3 style="margin: 0 0 8px;">${t("chat.aeonWhyHumansUseThis")}</h3>
            <div class="aeon-life-kv"><span>${t("chat.aeonItDoes")}</span><strong>${t("chat.aeonItDoesValue")}</strong></div>
            <div class="aeon-life-kv"><span>${t("chat.aeonItDoesNot")}</span><strong>${t("chat.aeonItDoesNotValue")}</strong></div>
            <div class="aeon-life-kv"><span>${t("chat.aeonMainKpi")}</span><strong>${t("chat.aeonMainKpiValue")}</strong></div>
            <div class="aeon-life-kv"><span>${t("chat.aeonSafetyFloor")}</span><strong>${t("chat.aeonSafetyFloorValue")}</strong></div>
            <div class="aeon-life-note">
              ${t("chat.aeonMeaningNote")}
            </div>
          </article>

          <article class="aeon-life-card">
            <h3 style="margin: 0 0 8px;">${t("chat.aeonLiveDecisionTrace")}</h3>
            <div class="aeon-life-kv"><span>${t("chat.aeonGuardrail")}</span><strong>${localizeEnumValue(String(guardrailDecision))}</strong></div>
            <div class="aeon-life-kv"><span>${t("chat.aeonMaintenance")}</span><strong>${localizeEnumValue(String(maintenanceDecision))}</strong></div>
            <div class="aeon-life-kv"><span>${t("chat.aeonTimestamp")}</span><strong>${formatTs(telemetry?.generatedAt ?? status?.timestamp)}</strong></div>
            ${
              status?.consciousness?.decisionCard?.why
                ? html`<div class="aeon-life-note"><strong>${t("chat.aeonDecisionWhy")}:</strong> ${status.consciousness.decisionCard.why}</div>`
                : nothing
            }
          </article>

          <article class="aeon-life-card">
            <h3 style="margin: 0 0 8px;">${t("chat.aeonIdentityTimeline")}</h3>
            ${renderIdentityTimeline(streamLog)}
          </article>

          ${renderConsciousnessStream({ 
            log: streamLog, 
            active: true,
            onBacktrack: params.onBacktrack,
            epiphanyFactor: telemetryV4?.inference.riskScore != null ? status?.epiphanyFactor : undefined, // Check if we have systemStatus
            memorySaturation: status?.memorySaturation,
            riskScore: telemetryV4?.inference.riskScore,
          })}
        </aside>
      </section>
    </section>

    ${
      (params.showManual ?? false)
        ? html`
          <div class="aeon-life-manual" @click=${() => params.onToggleManual?.(false)}>
            <section class="aeon-life-manual__panel" @click=${(event: Event) => event.stopPropagation()}>
              <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
                <h2 style="margin:0;font-size:22px;">${t("chat.aeonWhatPanelTitle")}</h2>
                <button class="btn" @click=${() => params.onToggleManual?.(false)}>${t("common.close")}</button>
              </div>
              <div class="aeon-life-manual__grid">
                <article class="aeon-life-manual__item">
                  <h4>${t("chat.aeonManualStep1Title")}</h4>
                  <p>${t("chat.aeonManualStep1Body")}</p>
                </article>
                <article class="aeon-life-manual__item">
                  <h4>${t("chat.aeonManualStep2Title")}</h4>
                  <p>${t("chat.aeonManualStep2Body")}</p>
                </article>
                <article class="aeon-life-manual__item">
                  <h4>${t("chat.aeonManualStep3Title")}</h4>
                  <p>${t("chat.aeonManualStep3Body")}</p>
                </article>
                <article class="aeon-life-manual__item">
                  <h4>${t("chat.aeonManualStep4Title")}</h4>
                  <p>${t("chat.aeonManualStep4Body")}</p>
                </article>
              </div>
            </section>
          </div>
        `
        : nothing
    }
  `;
}
