/* oxlint-disable typescript-eslint/no-unnecessary-boolean-literal-compare */
import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { t } from "../../i18n/index.ts";
import { icons } from "../icons.ts";
import type { ChatProps } from "./chat.ts";

import { renderMarkdownSidebar } from "./markdown-sidebar.ts";
import "../components/chat-input-area.ts";
import "../components/resizable-divider.ts";

// Import Refactored Styles
import { chatLayoutStyles } from "./chat/styles/layout.ts";
import { chatSidebarStyles } from "./chat/styles/sidebar.ts";
import { chatEmptyStateStyles } from "./chat/styles/empty-state.ts";
import { chatManualPanelStyles } from "./chat/styles/manual-panel.ts";

// Import Refactored Components
import { renderEmptyState } from "./chat/components/empty-state.ts";
import { renderChatManualPanel } from "./chat/components/manual-panel.ts";
import { renderStickyPlanBar, renderPlanSidebar } from "./chat/components/plan-sidebar.ts";
import { renderSubagentSidebar } from "./chat/components/subagent-sidebar.ts";
import { renderConsciousnessStream } from "./chat/components/consciousness-stream.ts";
import { getVisiblePlanTodos } from "./chat/components/subagent-view-model.ts";

export type ChatLayoutProps = ChatProps & {
  // Pass through props from the functional renderChat function
};

@customElement("chat-layout")
export class ChatLayout extends LitElement {
  @property({ type: Object }) props!: ChatLayoutProps;

  static styles = [
    chatLayoutStyles,
    chatSidebarStyles,
    chatEmptyStateStyles,
    chatManualPanelStyles,
  ];

  render() {
    if (!this.props) {
      return nothing;
    }

    const toolSidebarOpen = Boolean(this.props.sidebarOpen && this.props.onCloseSidebar);
    const planPhase = this.props?.taskPlan?.phase ?? "planning";
    const visibleTodos = getVisiblePlanTodos(this.props.taskPlan);
    const hasPlanData = visibleTodos.length > 0;

    // Sidebar conditions
    const hasPlanSidebar = planPhase === "planning" && hasPlanData;
    const hasSubagentSidebar =
      (planPhase === "execution" || planPhase === "verification" || planPhase === "complete") &&
      hasPlanData;

    // Determine if sidebar should be open and what type
    const sidebarOpen = toolSidebarOpen || hasPlanSidebar || hasSubagentSidebar;
    const splitRatio = this.props.splitRatio ?? 0.6;
    const activeSession = this.props.sessions?.sessions?.find(
      (row) => row.key === this.props.sessionKey,
    );
    const isMainSession =
      this.props.sessionKey === "main" || this.props.sessionKey === "agent:main:main";
    const sessionWorking = Boolean(
      (activeSession?.outputTokens ?? 0) > 0 ||
      (this.props.stream && this.props.stream.trim().length > 0),
    );
    const sessionStatusLabel = sessionWorking ? t("chat.sidebarWorking") : t("chat.sidebarIdle");
    const sessionModel = activeSession?.model || "auto";
    const sessionThinking = this.props.thinkingLevel || "default";
    // Use null when no delivery info — avoids showing the misleading "persist_failed" default
    const deliveryState: string | null = this.props.executionDelivery?.state ?? null;
    const persistedAt = this.props.executionDelivery?.persistedAt ?? null;
    const deliveryHint = persistedAt
      ? new Date(persistedAt).toLocaleTimeString([], {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : "pending";
    const deliveryLabel = t("chat.sidebarDelivery") || "delivery";
    const persistedLabel = t("chat.sidebarPersisted") || "persisted";
    const eternalLabel = this.props.eternalMode
      ? t("chat.eternalOn") || "Eternal: ON"
      : t("chat.eternalOff") || "Eternal: OFF";
    const eternalToggleLabel = this.props.eternalMode
      ? t("chat.eternalDisable") || "Disable Eternal"
      : t("chat.eternalEnable") || "Enable Eternal";
    const fractal = this.props.fractalState ?? {
      depthLevel: 2 as const,
      resonanceLevel: 0.35,
      formulaPhase: "idle" as const,
      noiseLevel: 0.2,
      deliveryBand: "pending" as const,
    };
    const formulaMetrics = buildFormulaMetrics({
      chaosScore: this.props.chaosScore,
      epiphanyFactor: this.props.epiphanyFactor,
      deliveryState,
      depthLevel: fractal.depthLevel,
      sessionWorking,
    });
    // Hide the rail entirely when there is no meaningful signal yet
    const hasSignal =
      (this.props.epiphanyFactor ?? 0) > 0 ||
      (this.props.chaosScore ?? 0) > 0 ||
      deliveryState !== null;
    const showUtilityRail = !sidebarOpen && hasSignal;
    const performanceMode = this.props.performanceMode ?? "balanced";

    return html`
      <section
        class="chat"
        data-fractal-depth=${String(fractal.depthLevel)}
        data-formula-phase=${fractal.formulaPhase}
        data-delivery-band=${fractal.deliveryBand}
        data-performance-mode=${performanceMode}
        style=${`--fractal-noise-level:${fractal.noiseLevel};--fractal-resonance:${fractal.resonanceLevel};`}
      >
        <div class="chat-cosmos" aria-hidden="true">
          <div class="chat-cosmos__edge-pulse"></div>
          <div class="chat-cosmos__grid"></div>
          <div class="chat-cosmos__recursive-web"></div>
          <div class="chat-cosmos__rings"></div>
          <div class="chat-cosmos__branchfield"></div>
          <div class="chat-cosmos__emergence"></div>
          <div class="chat-cosmos__lifelines"></div>
          <div class="chat-cosmos__formula-cloud"></div>
        </div>
        ${this.props.error ? html`<div class="callout danger">${this.props.error}</div>` : nothing}

        ${
          this.props.focusMode
            ? html`
          <button
            class="chat-focus-exit"
            type="button"
            @click=${this.props.onToggleFocusMode}
            aria-label="Exit focus mode"
            title="Exit focus mode"
          >
            ${icons.x}
          </button>
        `
            : nothing
        }

        <div class="chat-split-container ${sidebarOpen ? "chat-split-container--open" : ""}">
          <div
            class="chat-main ${!sidebarOpen ? "chat-main--with-formula" : ""}"
            style="flex: ${sidebarOpen ? `0 0 ${splitRatio * 100}%` : "1 1 100%"}"
          >
            ${
              showUtilityRail
                ? html`
                    <aside class="chat-utility-rail" aria-label=${t("chat.formulaRailLabel") || "AEON metrics rail"}>
                      <section class="formula-rail">
                        <div class="formula-rail__header">
                          <span class="formula-rail__icon">⬡</span>
                          <span class="formula-rail__label">AEON</span>
                          <span class="formula-rail__phase ${formulaMetrics.phase}">${formulaMetrics.phase}</span>
                        </div>
                        <div class="formula-rail__metrics">
                          ${formulaMetrics.cards.map(
                            (card) => html`
                              <div class="formula-metric ${card.state}">
                                <div class="formula-metric__label">${card.label}</div>
                                <div class="formula-metric__value">${card.value}</div>
                                <div class="formula-metric__bar-wrap">
                                  <div class="formula-metric__bar" style="width:${card.pct}%"></div>
                                </div>
                              </div>
                            `,
                          )}
                        </div>
                        <div class="formula-rail__equation">
                          <span class="formula-rail__eq-text">Z→Z²+C</span>
                          <span class="formula-rail__eq-text">R(n+1)=f(R,𝑒)</span>
                          <span class="formula-rail__eq-text ${formulaMetrics.deliveryState}">${formulaMetrics.deliveryLabel}</span>
                        </div>
                      </section>
                      ${renderConsciousnessStream({
                        log: this.props.cognitiveLog,
                        active: true,
                        docked: true,
                        muteWhenSidebarOpen: false,
                        sidebarOpen: false,
                        epiphanyFactor: this.props.epiphanyFactor,
                        chaosScore: this.props.chaosScore,
                        riskScore: this.props.riskScore,
                        memorySaturation: this.props.memorySaturation,
                      })}
                    </aside>
                  `
                : nothing
            }
            ${
              isMainSession
                ? html`
                    <div class="chat-main-status" role="status" aria-live="polite">
                      <div class="chat-main-status__left">
                        <span class="chat-main-status__badge">${t("chat.mainSessionMode") || "MAIN SESSION MODE"}</span>
                        <button
                          type="button"
                          class="chat-main-status__item chat-main-status__item--button"
                          @click=${() => this.props.onManualSectionChange?.("overview")}
                        >
                          ${sessionStatusLabel}
                        </button>
                        <span class="chat-main-status__item">${sessionModel}</span>
                        <span class="chat-main-status__item">thinking: ${sessionThinking}</span>
                        <button
                          type="button"
                          class="chat-main-status__item chat-main-status__item--button"
                          @click=${() => this.props.onManualSectionChange?.("status")}
                        >
                          ${deliveryLabel}: ${deliveryState}
                        </button>
                        <span class="chat-main-status__item">${persistedLabel}: ${deliveryHint}</span>
                        <button
                          type="button"
                          class="chat-main-status__item chat-main-status__item--button"
                          @click=${() => this.props.onManualSectionChange?.("status")}
                        >
                          ${eternalLabel}
                        </button>
                      </div>
                      <div class="chat-main-status__actions">
                        <button
                          type="button"
                          class="chat-main-status__btn"
                          @click=${() => this.props.onOpenSandbox?.()}
                        >
                          ${t("tabs.sandbox")}
                        </button>
                        <button
                          type="button"
                          class="chat-main-status__btn"
                          @click=${() => this.props.onOpenAeon?.()}
                        >
                          ${t("tabs.aeon")}
                        </button>
                        <button
                          type="button"
                          class="chat-main-status__btn"
                          @click=${() => this.props.onToggleEternalMode?.()}
                        >
                          ${eternalToggleLabel}
                        </button>
                      </div>
                    </div>
                  `
                : nothing
            }
            ${renderStickyPlanBar(this.props)}
            ${
              this.props.executionWatchdog?.degraded
                ? html`
                    <div class="callout warning" role="status" aria-live="polite">
                      Execution watchdog degraded: ${this.props.executionWatchdog.reason ?? "No progress detected in execution phase."}
                    </div>
                  `
                : nothing
            }
            
            <div
              class="chat-thread ${this.props.messages && this.props.messages.length > 0 ? "" : "chat-thread--empty"}"
              role="log" 
              aria-live="polite"
              @scroll=${this.props.onChatScroll}
            >
              ${
                this.props.messages && this.props.messages.length > 0
                  ? html`
                      <slot name="messages"></slot>
                    `
                  : renderEmptyState(this.props)
              }
            </div>

            <div class="chat-input-wrapper">
              <chat-input-area
                .draft=${this.props.draft}
                .connected=${this.props.connected}
                .sending=${this.props.sending}
                .canAbort=${Boolean(this.props.canAbort && this.props.onAbort)}
                .attachments=${this.props.attachments ?? []}
                @draft-change=${(e: CustomEvent) => this.props.onDraftChange(e.detail.draft)}
                @attachments-change=${(e: CustomEvent) => this.props.onAttachmentsChange?.(e.detail.attachments)}
                @local-command=${(e: CustomEvent) => this.props.onQuickCommand?.(e.detail)}
                @send=${() => this.props.onSend()}
                @abort=${() => this.props.onAbort?.()}
                @new-session=${() => this.props.onNewSession()}
              ></chat-input-area>
              <div class="chat-tagline">Works for you, grows with you</div>
            </div>
          </div>

          ${
            sidebarOpen
              ? html`
            <resizable-divider
              .splitRatio=${splitRatio}
              @resize=${(e: CustomEvent) => this.props.onSplitRatioChange?.(e.detail.splitRatio)}
            ></resizable-divider>
            <div class="chat-sidebar">
              ${
                toolSidebarOpen
                  ? renderMarkdownSidebar({
                      content: this.props.sidebarContent ?? null,
                      error: this.props.sidebarError ?? null,
                      onClose: this.props.onCloseSidebar ?? (() => {}),
                      onViewRawText: () => {
                        if (!this.props.sidebarContent || !this.props.onOpenSidebar) {
                          return;
                        }
                        this.props.onOpenSidebar(`\`\`\`\n${this.props.sidebarContent}\n\`\`\``);
                      },
                    })
                  : hasSubagentSidebar
                    ? renderSubagentSidebar(this.props)
                    : renderPlanSidebar(this.props)
              }
            </div>
          `
              : nothing
          }
        </div>
        ${
          this.props.manualState && this.props.manualRuntime
            ? renderChatManualPanel({
                manualState: this.props.manualState,
                manualRuntime: this.props.manualRuntime,
                props: this.props,
              })
            : nothing
        }
      </section>
    `;
  }
}

/** Returns display data for the compact AEON metric cards in the formula rail. */
function buildFormulaMetrics(params: {
  chaosScore: number;
  epiphanyFactor: number;
  deliveryState: string | null;
  depthLevel: number;
  sessionWorking: boolean;
}) {
  const chaos    = Number.isFinite(params.chaosScore)    ? params.chaosScore    : 0;
  const resonance= Number.isFinite(params.epiphanyFactor)? params.epiphanyFactor: 0;
  const phase    = params.sessionWorking ? "active" : "idle";

  // Delivery display
  const ds = params.deliveryState;
  const deliveryLabel   = ds === null ? "—" : ds;
  const deliveryState   = ds === "persist_failed" ? "error" : ds === null ? "muted" : "ok";

  return {
    phase,
    deliveryState,
    deliveryLabel,
    cards: [
      {
        label: "Epiphany",
        value: resonance.toFixed(2),
        pct: Math.min(100, resonance * 100),
        state: resonance > 0.7 ? "active" : "idle",
      },
      {
        label: "Chaos",
        value: chaos.toFixed(1),
        pct: Math.min(100, chaos * 10),
        state: params.sessionWorking ? "active" : "idle",
      },
      {
        label: `Δdepth`,
        value: String(params.depthLevel),
        pct: Math.min(100, params.depthLevel * 25),
        state: "idle",
      },
    ],
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-layout": ChatLayout;
  }
}
