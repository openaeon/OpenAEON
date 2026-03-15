/* oxlint-disable typescript-eslint/no-unnecessary-boolean-literal-compare */
import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { icons } from "../icons.ts";
import type { ChatProps } from "./chat.ts";

import { renderMarkdownSidebar } from "./markdown-sidebar.ts";
import "../components/chat-input-area.ts";
import "../components/resizable-divider.ts";

// Import Refactored Styles
import { chatLayoutStyles } from "./chat/styles/layout.ts";
import { chatSidebarStyles } from "./chat/styles/sidebar.ts";
import { chatEmptyStateStyles } from "./chat/styles/empty-state.ts";

// Import Refactored Components
import { renderEmptyState } from "./chat/components/empty-state.ts";
import { renderStickyPlanBar, renderPlanSidebar } from "./chat/components/plan-sidebar.ts";
import { renderSubagentSidebar } from "./chat/components/subagent-sidebar.ts";
import { renderConsciousnessStream } from "./chat/components/consciousness-stream.ts";

export type ChatLayoutProps = ChatProps & {
  // Pass through props from the functional renderChat function
};

@customElement("chat-layout")
export class ChatLayout extends LitElement {
  @property({ type: Object }) props!: ChatLayoutProps;

  static styles = [chatLayoutStyles, chatSidebarStyles, chatEmptyStateStyles];

  render() {
    if (!this.props) {
      return nothing;
    }

    const toolSidebarOpen = Boolean(this.props.sidebarOpen && this.props.onCloseSidebar);
    const planPhase = this.props?.taskPlan?.phase;
    const hasPlanData = (this.props.taskPlan?.todos?.length ?? 0) > 0;

    // Determine active sessions, excluding the main orchestrator agent
    const activeWorkers = (this.props.sandboxSessions ?? []).filter(
      (r) => r.kind !== "global" && !r.systemSent,
    );

    // Sidebar conditions
    const hasPlanSidebar = planPhase === "planning" && hasPlanData;
    const hasSubagentSidebar =
      activeWorkers.length > 0 ||
      ((planPhase === "execution" || planPhase === "verification" || planPhase === "complete") &&
        hasPlanData);

    // Determine if sidebar should be open and what type
    const sidebarOpen = toolSidebarOpen || hasPlanSidebar || hasSubagentSidebar;
    const splitRatio = this.props.splitRatio ?? 0.6;

    return html`
      <section class="chat">
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
          <div class="chat-main" style="flex: ${sidebarOpen ? `0 0 ${splitRatio * 100}%` : "1 1 100%"}">
            ${renderStickyPlanBar(this.props)}
            
            <div 
              class="chat-thread" 
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
        ${renderConsciousnessStream({ log: this.props.cognitiveLog, active: true })}
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-layout": ChatLayout;
  }
}
