/* oxlint-disable typescript-eslint/no-unnecessary-boolean-literal-compare */
import { LitElement, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { icons } from "../icons.ts";
import type { ChatProps } from "./chat.ts";
import { t, I18nController } from "../../i18n/index.ts";

import "../components/chat-input-area.ts";
import "../components/resizable-divider.ts";

// Import Refactored Styles
import { chatLayoutStyles } from "./chat/styles/layout.ts";
import { chatSidebarStyles } from "./chat/styles/sidebar.ts";
import { chatEmptyStateStyles } from "./chat/styles/empty-state.ts";
import { chatManualPanelStyles } from "./chat/styles/manual-panel.ts";

// Import Refactored Components
import { renderEmptyState } from "./chat/components/empty-state.ts";
import { renderSubagentSidebar } from "./chat/components/subagent-sidebar.ts";
import { getVisibleCognitivePlanTodos } from "./chat/components/subagent-view-model.ts";

export type ChatLayoutProps = ChatProps & {
  // Pass through props from the functional renderChat function
};

@customElement("chat-layout")
export class ChatLayout extends LitElement {
  private i18nController = new I18nController(this);
  @property({ type: Object }) props!: ChatLayoutProps;
  @state() private agentQuery = "";
  @state() private agentStatusFilter: "all" | "running" | "blocked" | "done" | "ready" = "all";
  @state() private selectedAgentTodoId: string | null = null;

  static styles = [
    chatLayoutStyles,
    chatSidebarStyles,
    chatEmptyStateStyles,
    chatManualPanelStyles,
  ];

  @state() private sidebarActiveTab: "runtime" | "tasks" | "memory" | "invariants" = "runtime";

  render() {
    if (!this.props) {
      return nothing;
    }

    const plan = this.props.cognitivePlan;
    const planPhase = plan?.phase ?? "planning";
    const visibleTodos = getVisibleCognitivePlanTodos(this.props.cognitivePlan);
    const splitRatio = this.props.splitRatio ?? 0.6;
    const activeSession = this.props.sessions?.sessions?.find(
      (row) => row.key === this.props.sessionKey,
    );
    const sessionWorking = Boolean(
      (activeSession?.outputTokens ?? 0) > 0 ||
      (this.props.stream && this.props.stream.trim().length > 0),
    );
    const sessionModel = activeSession?.model || "auto";
    const sessionThinking = this.props.thinkingLevel || "default";
    const fractal = this.props.fractalState ?? {
      depthLevel: 2 as const,
      resonanceLevel: 0.35,
      formulaPhase: "idle" as const,
      noiseLevel: 0.2,
      deliveryBand: "pending" as const,
    };
    const visualMode = this.props.visualMode ?? "professional";
    const visualDensity = this.props.visualDensity ?? "comfortable";
    const performanceMode = this.props.performanceMode ?? "balanced";
    const pageState = this.props.executionWatchdog?.degraded
      ? "recovery"
      : sessionWorking || Boolean(this.props.sending) || Boolean(this.props.stream?.trim())
        ? "executing"
        : (this.props.messages?.length ?? 0) > 0
          ? "chatting"
          : "empty";
    const architecture = plan?.architecture ?? plan?.runtime?.architecture ?? null;
    const projection = plan?.stateProjection ?? plan?.runtime?.stateProjection ?? null;
    const invariants = plan?.invariants ?? plan?.runtime?.invariants ?? null;
    const memoryTrace = plan?.memoryTrace ?? plan?.runtime?.memoryTrace ?? null;
    const runtimePhase = plan?.nativePhase ?? plan?.runtime?.phase ?? planPhase;
    const blockedCount = plan?.executionGraph?.blockedTodoIds?.length ?? 0;
    const runningCount = (this.props.subagentViewModel ?? []).filter(
      (agent) => agent.status === "in_progress",
    ).length;
    const activeCapability =
      [...(architecture?.capabilityLadder ?? [])].reverse().find((level) => level.active)?.label ??
      "L1 Perception";

    return html`
      <section
        class="chat"
        data-fractal-depth=${String(fractal.depthLevel)}
        data-formula-phase=${fractal.formulaPhase}
        data-delivery-band=${fractal.deliveryBand}
        data-performance-mode=${performanceMode}
        data-visual-mode=${visualMode}
        data-visual-density=${visualDensity}
        data-page-state=${pageState}
        style=${`--fractal-noise-level:${fractal.noiseLevel};--fractal-resonance:${fractal.resonanceLevel};`}
      >
        <style>
          .workbench-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 24px;
            background: rgba(2, 6, 23, 0.9);
            border-bottom: 1px solid rgba(148, 163, 184, 0.1);
            color: #e2e8f0;
            backdrop-filter: blur(12px);
            z-index: 100;
          }
          .workbench-logo {
            font-size: 18px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 12px;
            background: linear-gradient(to right, #f8fafc, #94a3b8);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          .workbench-nav {
            display: flex;
            align-items: center;
            gap: 16px;
          }
          .nav-item {
            display: flex;
            align-items: center;
            gap: 8px;
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid rgba(148, 163, 184, 0.1);
            border-radius: 6px;
            padding: 4px 12px;
            font-size: 12px;
          }
          .nav-label { color: #64748b; font-weight: 500; }
          .nav-value { color: #cbd5e1; font-weight: 600; }
          .status-live {
            color: #2dd4bf;
            display: flex;
            align-items: center;
            gap: 6px;
            font-weight: 600;
          }
          .status-live::before {
            content: "";
            width: 6px;
            height: 6px;
            background: #2dd4bf;
            border-radius: 50%;
            box-shadow: 0 0 10px #2dd4bf;
            animation: pulse 2s infinite;
          }
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
          .workbench-icon-button {
            color: #64748b;
            border: 1px solid rgba(148, 163, 184, 0.08);
            background: rgba(15, 23, 42, 0.55);
            width: 32px;
            height: 32px;
            border-radius: 10px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: color 0.2s, border-color 0.2s, background 0.2s;
          }
          .workbench-icon-button:hover {
            color: #cbd5e1;
            border-color: rgba(45, 212, 191, 0.28);
            background: rgba(45, 212, 191, 0.08);
          }

          .cognitive-state-bar {
            display: grid;
            grid-template-columns: 180px repeat(5, 1fr);
            gap: 1px;
            background: rgba(148, 163, 184, 0.1);
            border-bottom: 1px solid rgba(148, 163, 184, 0.1);
          }
          .cog-bar-item {
            background: rgba(2, 6, 23, 0.8);
            padding: 14px 24px;
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .cog-bar-label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; }
          .cog-bar-content { display: flex; align-items: center; justify-content: space-between; }
          .cog-bar-ring {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border: 2px solid rgba(148, 163, 184, 0.05);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: 800;
            position: relative;
          }
          .cog-bar-ring::after {
            content: "";
            position: absolute;
            inset: -2px;
            border-radius: 50%;
            border: 2px solid var(--ring-color);
            border-top-color: transparent;
            transform: rotate(45deg);
          }

          .main-workspace {
            display: flex;
            flex: 1;
            overflow: hidden;
            background:
              radial-gradient(circle at 12% 18%, rgba(45, 212, 191, 0.08), transparent 28%),
              radial-gradient(circle at 84% 22%, rgba(56, 189, 248, 0.07), transparent 28%),
              linear-gradient(135deg, #020617 0%, #08111f 50%, #030712 100%);
          }
          .workspace-rail {
            width: 64px;
            border-right: 1px solid rgba(148, 163, 184, 0.1);
            background: rgba(2, 6, 23, 0.48);
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            padding: 18px 10px;
          }
          .rail-button {
            width: 40px;
            height: 40px;
            border-radius: 14px;
            border: 1px solid rgba(148, 163, 184, 0.1);
            background: rgba(15, 23, 42, 0.62);
            color: #94a3b8;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s;
          }
          .rail-button:hover,
          .rail-button[data-active="true"] {
            color: #2dd4bf;
            border-color: rgba(45, 212, 191, 0.32);
            background: rgba(45, 212, 191, 0.1);
            box-shadow: 0 0 20px rgba(45, 212, 191, 0.12);
          }
          .chat-history-area {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-width: 0;
          }
          .chat-thread-container {
            flex: 1;
            overflow-y: auto;
            padding: 32px;
            display: flex;
            flex-direction: column;
            gap: 32px;
          }

          .chat-sidebar {
            background: rgba(2, 6, 23, 0.5);
            display: flex;
            flex-direction: column;
            border-left: 1px solid rgba(148, 163, 184, 0.1);
            min-width: 320px;
            max-width: 460px;
          }
          .sidebar-header {
            padding: 20px 24px;
            font-size: 13px;
            font-weight: 700;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            border-bottom: 1px solid rgba(148, 163, 184, 0.1);
          }
          .sidebar-tabs {
            display: flex;
            padding: 0 24px;
            gap: 20px;
            border-bottom: 1px solid rgba(148, 163, 184, 0.05);
          }
          .sidebar-tab {
            font-size: 12px;
            color: #475569;
            cursor: pointer;
            padding: 12px 0;
            font-weight: 600;
            position: relative;
            transition: color 0.2s;
          }
          .sidebar-tab:hover { color: #94a3b8; }
          .sidebar-tab.active { color: #2dd4bf; }
          .sidebar-tab.active::after {
            content: "";
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: #2dd4bf;
            box-shadow: 0 0 8px rgba(45, 212, 191, 0.5);
          }
          .sidebar-content {
            flex: 1;
            overflow-y: auto;
            padding: 24px;
          }

          .agent-card {
            background: rgba(30, 41, 59, 0.3);
            border: 1px solid rgba(148, 163, 184, 0.1);
            border-radius: 12px;
            padding: 14px;
            margin-bottom: 12px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            transition: border-color 0.2s;
          }
          .agent-card:hover { border-color: rgba(45, 212, 191, 0.3); }
          .agent-card-header { display: flex; align-items: center; justify-content: space-between; }
          .agent-meta { display: flex; align-items: center; gap: 12px; }
          .agent-avatar {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            background: rgba(45, 212, 191, 0.1);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 800;
            color: #2dd4bf;
            border: 1px solid rgba(45, 212, 191, 0.2);
          }
          .agent-status-dot { width: 8px; height: 8px; border-radius: 50%; }
          .status-running { background: #10b981; box-shadow: 0 0 8px #10b981; }
          .status-idle { background: #64748b; }
          .progress-track { height: 4px; background: rgba(255,255,255,0.03); border-radius: 2px; overflow: hidden; }
          .progress-fill { height: 100%; background: #2dd4bf; border-radius: 2px; transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
          .dock-summary {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            margin-bottom: 16px;
          }
          .dock-metric {
            border: 1px solid rgba(148, 163, 184, 0.08);
            border-radius: 10px;
            background: rgba(15, 23, 42, 0.42);
            padding: 10px;
          }
          .dock-metric__label {
            color: #64748b;
            font-size: 9px;
            font-weight: 800;
            letter-spacing: 0.12em;
            text-transform: uppercase;
          }
          .dock-metric__value {
            color: #e2e8f0;
            font-size: 16px;
            font-weight: 900;
            margin-top: 4px;
          }
          .runtime-note,
          .memory-card,
          .invariant-card {
            border: 1px solid rgba(148, 163, 184, 0.08);
            border-radius: 12px;
            background: rgba(15, 23, 42, 0.36);
            padding: 12px;
          }
          .runtime-note {
            color: #94a3b8;
            font-size: 11px;
            line-height: 1.45;
            margin-bottom: 12px;
          }
          .invariant-card[data-status="pass"] { border-color: rgba(34, 197, 94, 0.18); }
          .invariant-card[data-status="warn"] { border-color: rgba(245, 158, 11, 0.24); }
          .invariant-card[data-status="fail"] { border-color: rgba(239, 68, 68, 0.28); }
          @media (max-width: 1120px) {
            .cognitive-state-bar {
              grid-template-columns: 1fr 1fr;
            }
            .workspace-rail {
              display: none;
            }
            .chat-sidebar {
              display: none;
            }
            resizable-divider {
              display: none;
            }
          }
        </style>

        <!-- Workbench Header -->
        <header class="workbench-header">
          <div class="workbench-logo">
            <span style="-webkit-text-fill-color: initial; color: #2dd4bf; font-size: 20px;">⌘</span>
            <span>OpenAEON <span style="font-weight: 400; opacity: 0.6;">${t("chat.workbench")}</span></span>
          </div>
          <div class="workbench-nav">
            <div class="nav-item">
              <span class="nav-label">${t("chat.model")}</span>
              <span class="nav-value">${sessionModel}</span>
            </div>
            <div class="nav-item">
              <span class="nav-label">${t("chat.session")}</span>
              <span class="nav-value" style="color: #2dd4bf;">${this.props.sessionKey?.split(":").pop()}</span>
            </div>
            <div class="nav-item">
              <span class="nav-label">${t("chat.think")}</span>
              <span class="nav-value">${sessionThinking}</span>
            </div>
            <div class="nav-item">
              <span class="nav-label">${t("chat.state")}</span>
              <span class=${pageState === "executing" ? "status-live" : ""} style=${pageState !== "executing" ? "color: #cbd5e1; font-weight: 600;" : ""}>${pageState.toUpperCase()}</span>
            </div>
          </div>
          <div style="display: flex; gap: 20px; align-items: center;">
            <button class="workbench-icon-button" type="button" title="Runtime notifications">${icons.radio}</button>
            <div style="width: 32px; height: 32px; border-radius: 10px; background: linear-gradient(135deg, #1e293b, #0f172a); border: 1px solid rgba(148, 163, 184, 0.2); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; color: #2dd4bf; cursor: pointer;">${(this.props.assistantName || "A")[0].toUpperCase()}</div>
          </div>
        </header>

        <!-- Cognitive State Bar -->
        <div class="cognitive-state-bar">
          <div class="cog-bar-item" style="background: rgba(15, 23, 42, 0.9); border-right: 1px solid rgba(148, 163, 184, 0.1);">
            <div class="cog-bar-label">${t("chat.cognitiveTelemetry")}</div>
            <div style="font-size: 14px; font-weight: 700; color: #f8fafc; display: flex; align-items: center; gap: 8px;">
              <span style="color: #2dd4bf;">●</span> ${t("chat.systemPulse")}
            </div>
          </div>
          ${[
            {
              symbol: "Z",
              label: t("chat.currentState"),
              color: "#2dd4bf",
              value:
                projection?.z?.confidence != null ? Math.round(projection.z.confidence * 100) : 0,
              caption: `${projection?.z?.activeNodeIds?.length ?? runningCount} ${t("common.active")}`,
            },
            {
              symbol: "Z²",
              label: t("chat.selfEvolution"),
              color: "#38bdf8",
              value:
                projection?.phi?.retryPressure != null
                  ? Math.max(0, 100 - Math.round(projection.phi.retryPressure * 100))
                  : 0,
              caption: `${projection?.phi?.completedNodeIds?.length ?? 0} ${t("common.completed")}`,
            },
            {
              symbol: "C",
              label: t("chat.externalInput"),
              color: "#a7f3d0",
              value: projection?.c?.externalSignals?.length ?? 0,
              caption: t("chat.signals"),
            },
            {
              symbol: "R",
              label: t("chat.reflection"),
              color: "#fbbf24",
              value:
                projection?.r?.reflectionVerdict === "fail"
                  ? 32
                  : projection?.r?.reflectionVerdict === "warn"
                    ? 68
                    : projection?.r?.reflectionVerdict === "pass"
                      ? 100
                      : 0,
              caption: projection?.r?.reflectionVerdict ?? t("common.pending"),
            },
            {
              symbol: "Z+1",
              label: t("chat.nextState"),
              color: "#86efac",
              value: projection?.zNext?.invariantReady
                ? 100
                : invariants?.blocked
                  ? 0
                  : projection?.zNext?.recommendedPhase
                    ? 50
                    : 0,
              caption: String(projection?.zNext?.recommendedPhase ?? runtimePhase),
            },
          ].map(
            (item) => html`
              <div class="cog-bar-item">
                <div class="cog-bar-content">
                  <div style="display:flex; flex-direction:column; gap: 2px;">
                    <span style=${`color:${item.color}; font-weight: 900; font-size: 18px; letter-spacing: -0.02em;`}>${item.symbol}</span>
                    <span class="cog-bar-label">${item.label}</span>
                    <span style="font-size: 10px; color: #64748b; font-weight: 700;">${item.caption}</span>
                  </div>
                  <div class="cog-bar-ring" style=${`--ring-color: ${item.color}; color: ${item.color};`}>
                    ${typeof item.value === "number" && item.value > 10 ? `${item.value}%` : item.value}
                  </div>
                </div>
              </div>
            `,
          )}
        </div>

        <!-- Main Workspace -->
        <div class="main-workspace">
          <nav class="workspace-rail" aria-label="OpenAEON workbench rail">
            <button class="rail-button" data-active="true" type="button" title="${t("chat.chat")}">${icons.message}</button>
            <button class="rail-button" type="button" title="${t("chat.cognitiveRuntime")}">${icons.brain}</button>
            <button class="rail-button" type="button" title="${t("chat.memory")}">${icons.scrollText}</button>
            <button class="rail-button" type="button" title="${t("chat.artifacts")}">${icons.folder}</button>
            <button class="rail-button" type="button" title="${t("nav.settings")}">${icons.settings}</button>
          </nav>
          <!-- Chat History -->
          <div class="chat-history-area">
            <div class="chat-thread-container" @scroll=${this.props.onChatScroll}>
              ${
                this.props.messages && this.props.messages.length > 0
                  ? html`
                      <slot name="messages"></slot>
                    `
                  : renderEmptyState(this.props)
              }
            </div>

            <!-- Input Area -->
            <div style="padding: 32px; border-top: 1px solid rgba(148, 163, 184, 0.05); background: rgba(2, 6, 23, 0.4); backdrop-filter: blur(8px);">
              <chat-input-area
                .draft=${this.props.draft}
                .connected=${this.props.connected}
                .sending=${this.props.sending}
                .canAbort=${Boolean(this.props.canAbort && this.props.onAbort)}
                .attachments=${this.props.attachments ?? []}
                @draft-change=${(e: CustomEvent) => this.props.onDraftChange(e.detail.draft)}
                @attachments-change=${(e: CustomEvent) => this.props.onAttachmentsChange?.(e.detail.attachments)}
                @local-command=${(e: CustomEvent) => this.props.onQuickCommand?.(e.detail)}
                @send=${(e: CustomEvent<{ message: string; mode?: string }>) => this.props.onSend(e.detail.message, { mode: e.detail.mode })}
                @abort=${() => this.props.onAbort?.()}
                @new-session=${() => this.props.onNewSession()}
              ></chat-input-area>

              <div style="display: flex; align-items: center; gap: 32px; margin-top: 20px; font-size: 11px; color: #475569; font-weight: 600;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; font-size: 10px;">${t("chat.context")}</span>
                  <span style="color: #2dd4bf; background: rgba(45,212,191,0.06); padding: 3px 10px; border-radius: 6px; border: 1px solid rgba(45,212,191,0.12); font-family: monospace;">${this.props.sessionKey?.split(":").pop()}</span>
                </div>
                <div>${t("chat.memory")}: <span style="color: #94a3b8; font-family: monospace;">${((this.props.aeonSystemStatus?.memorySize ?? 0) / 1024).toFixed(1)}k</span></div>
                <div>${t("chat.artifacts")}: <span style="color: #94a3b8; font-family: monospace;">${this.props.aeonSystemStatus?.execution?.delivery?.artifactRefs?.length ?? 0}</span></div>
                <div style="display: flex; align-items: center; gap: 8px; margin-left: auto; color: #64748b; font-size: 14px; cursor: pointer;">
                  <span style="color: #2dd4bf; animation: pulse 2s infinite; font-size: 11px; margin-right: 4px;">●</span>
                  <span style="font-size: 11px; color: #475569;">${t("chat.activeGoal")}: ${this.props.aeonSystemStatus?.evolution?.consciousness?.intent?.sessionGoal ?? t("chat.awaitingMission")}</span>
                  <span style="margin-left: 8px; font-weight: normal; opacity: 0.6;">+</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Resizable Divider -->
          <resizable-divider
            .splitRatio=${splitRatio}
            @resize=${(e: CustomEvent) => this.props.onSplitRatioChange?.(e.detail.splitRatio)}
          ></resizable-divider>

          <!-- Sidebar -->
          <aside class="chat-sidebar" style="width: ${splitRatio > 0 ? (1 - splitRatio) * 100 : 30}%">
            <div class="sidebar-header">${t("chat.cognitiveRuntime")}</div>
            <div class="sidebar-tabs">
              <div class="sidebar-tab ${this.sidebarActiveTab === "runtime" ? "active" : ""}" @click=${() => (this.sidebarActiveTab = "runtime")}>${t("chat.agents")}</div>
              <div class="sidebar-tab ${this.sidebarActiveTab === "tasks" ? "active" : ""}" @click=${() => (this.sidebarActiveTab = "tasks")}>${t("chat.tasks")}</div>
              <div class="sidebar-tab ${this.sidebarActiveTab === "memory" ? "active" : ""}" @click=${() => (this.sidebarActiveTab = "memory")}>${t("chat.memory")}</div>
              <div class="sidebar-tab ${this.sidebarActiveTab === "invariants" ? "active" : ""}" @click=${() => (this.sidebarActiveTab = "invariants")}>${t("chat.invariants")}</div>
            </div>
            <div class="sidebar-content">
              ${
                this.sidebarActiveTab === "runtime"
                  ? html`
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <div style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 800; margin-bottom: 12px;">${t("chat.parallelAgentOrchestration")}</div>
                  <div class="dock-summary">
                    <div class="dock-metric">
                      <div class="dock-metric__label">${t("chat.phase")}</div>
                      <div class="dock-metric__value">${String(runtimePhase).toUpperCase()}</div>
                    </div>
                    <div class="dock-metric">
                      <div class="dock-metric__label">${t("chat.running")}</div>
                      <div class="dock-metric__value">${runningCount}</div>
                    </div>
                    <div class="dock-metric">
                      <div class="dock-metric__label">${t("chat.activeCapability")}</div>
                      <div class="dock-metric__value">${activeCapability}</div>
                    </div>
                  </div>
                  <div class="runtime-note">
                    ${architecture?.formula ?? "Z -> Z^2 + C + R -> Z+1"} · blocked ${blockedCount}.
                    ${unsafeHTML(t("chat.runtimeNote"))}
                  </div>
                  ${(this.props.subagentViewModel?.length ? this.props.subagentViewModel : []).map(
                    (agent) => {
                      const role = agent.ownerAgent || "Agent";
                      const status = agent.status ?? "idle";
                      const isRunning = status === "in_progress";
                      const isBlocked = status === "blocked";
                      const pct =
                        status === "done"
                          ? 100
                          : status === "in_progress"
                            ? 64
                            : status === "blocked"
                              ? 38
                              : 18;
                      const color = isRunning ? "#2dd4bf" : isBlocked ? "#f59e0b" : "#94a3b8";
                      return html`
                      <div class="agent-card" data-status=${status}>
                        <div class="agent-card-header">
                          <div class="agent-meta">
                            <div class="agent-avatar" style=${`background: ${color}15; color: ${color}; border-color: ${color}30;`}>
                              ${role.slice(0, 2).toUpperCase()}
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 2px; min-width: 0;">
                              <span class="agent-name">${role}</span>
                              <span style="font-size: 10px; color: #64748b; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                ${agent.title || "Ready for assignment"}
                              </span>
                            </div>
                          </div>
                          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
                            <div style="display: flex; align-items: center; gap: 6px;">
                              <div class="agent-status-dot" style=${`background: ${isRunning ? "#10b981" : isBlocked ? "#f59e0b" : "#64748b"}; ${isRunning ? "box-shadow: 0 0 8px #10b981;" : ""}`}></div>
                              <span style=${`font-size: 10px; color: ${color}; font-weight: 800; text-transform: uppercase;`}>${status}</span>
                            </div>
                            ${
                              agent.blockedBy?.length
                                ? html`<span style="font-size: 10px; color: #f59e0b;">blocked by ${agent.blockedBy.length}</span>`
                                : nothing
                            }
                          </div>
                        </div>
                        <div class="progress-track">
                          <div class="progress-fill" style=${`width: ${pct}%; background: ${color};`}></div>
                        </div>
                        <div style="font-size: 10px; color: #64748b;">
                          ${agent.lastEvent ?? (isRunning ? "Executing node lease" : "No active lease")}
                        </div>
                      </div>
                    `;
                    },
                  )}
                  ${
                    !this.props.subagentViewModel?.length
                      ? html`
                          <div
                            style="
                              font-size: 12px;
                              color: #64748b;
                              padding: 16px;
                              text-align: center;
                              border: 1px dashed #334155;
                              border-radius: 8px;
                            "
                          >
                            No active agents in cognitive runtime.
                          </div>
                        `
                      : nothing
                  }
                </div>
              `
                  : nothing
              }

              ${
                this.sidebarActiveTab === "tasks"
                  ? html`
                <div style="height: 100%; display: flex; flex-direction: column;">
                  <div style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 800; margin-bottom: 16px;">Task Hierarchy</div>
                  ${renderSubagentSidebar(this.props, {
                    query: this.agentQuery,
                    onQueryChange: (q) => (this.agentQuery = q),
                    statusFilter: this.agentStatusFilter,
                    onStatusFilterChange: (f) => (this.agentStatusFilter = f),
                    selectedTodoId: this.selectedAgentTodoId,
                    onSelectTodoId: (id) => (this.selectedAgentTodoId = id),
                    autopilotEnabled: this.props.autopilotEnabled,
                    onToggleAutopilot: this.props.onToggleAutopilot,
                    autopilotMaxConcurrent: this.props.autopilotMaxConcurrent,
                    onAutopilotMaxConcurrentChange: this.props.onAutopilotMaxConcurrentChange,
                    onAutopilotDispatchNow: this.props.onAutopilotDispatchNow,
                    onForceStart: (todoId) => this.props.onForceStartTodo?.(todoId),
                    onCreateAgent: this.props.onSpawnAgentsFromPlan,
                  })}
                </div>
              `
                  : nothing
              }

              ${
                this.sidebarActiveTab === "memory"
                  ? html`
                <div style="display: flex; flex-direction: column; gap: 16px;">
                  <div style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 800; margin-bottom: 8px;">Memory Trace</div>
                  <div class="memory-card">
                    <div style="font-size: 11px; color: #64748b; font-weight: 800; text-transform: uppercase;">Short-term Context</div>
                    <div style="font-size: 12px; color: #cbd5e1; margin-top: 6px;">
                      ${
                        memoryTrace?.shortTermExpiresAt
                          ? `expires ${new Date(memoryTrace.shortTermExpiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                          : "active for current session"
                      }
                    </div>
                  </div>
                  ${(memoryTrace?.longTermSources ?? []).slice(0, 5).map(
                    (source) => html`
                      <div class="memory-card">
                        <div style="font-size: 12px; color: #e2e8f0; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                          ${source.source}
                        </div>
                        <div style="font-size: 10px; color: #64748b; margin-top: 4px;">
                          ${source.path ?? "RAG source"} ${source.score != null ? `· ${(source.score * 100).toFixed(0)}%` : ""}
                        </div>
                      </div>
                    `,
                  )}
                  ${(memoryTrace?.evolutionStrategyHits ?? []).slice(0, 4).map(
                    (hit) => html`
                      <div class="memory-card">
                        <div style="font-size: 10px; color: #2dd4bf; font-weight: 900; text-transform: uppercase;">${hit.category}</div>
                        <div style="font-size: 12px; color: #cbd5e1; line-height: 1.45; margin-top: 5px;">${hit.content}</div>
                      </div>
                    `,
                  )}
                  ${
                    (memoryTrace?.longTermSources.length ?? 0) === 0 &&
                    (memoryTrace?.evolutionStrategyHits.length ?? 0) === 0
                      ? html`
                          <div class="runtime-note">No Cognitive memory trace attached to this run yet.</div>
                        `
                      : nothing
                  }
                </div>
              `
                  : nothing
              }

              ${
                this.sidebarActiveTab === "invariants"
                  ? html`
                <div style="display: flex; flex-direction: column; gap: 16px;">
                  <div style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 800; margin-bottom: 8px;">
                    Invariant Engine ${invariants?.blocked ? "· BLOCKING" : ""}
                  </div>
                  ${(invariants?.checks ?? []).map(
                    (item) => html`
                      <div class="invariant-card" data-status=${item.status}>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                          <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="font-size: 10px; font-weight: 800; color: #64748b; background: rgba(148,163,184,0.1); padding: 2px 4px; border-radius: 4px;">${item.id}</span>
                            <span style="font-size: 12px; font-weight: 600; color: #cbd5e1;">${item.summary}</span>
                          </div>
                          <span style=${`font-size: 9px; color: ${item.status === "pass" ? "#10b981" : item.status === "warn" ? "#f59e0b" : "#ef4444"}; font-weight: 900; text-transform: uppercase; border: 1px solid currentColor; padding: 1px 4px; border-radius: 3px;`}>
                            ${item.status}
                          </span>
                        </div>
                        <div style="font-size: 10px; color: #64748b; margin-left: 26px;">
                          ${item.evidence[0] ?? "No evidence recorded yet"}
                        </div>
                      </div>
                    `,
                  )}
                  ${
                    (invariants?.checks.length ?? 0) === 0
                      ? html`
                          <div class="runtime-note">
                            Invariant checks will appear after transition, dispatch, reflect, or dream.
                          </div>
                        `
                      : nothing
                  }
                </div>
              `
                  : nothing
              }
            </div>
          </aside>
        </div>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-layout": ChatLayout;
  }
}
