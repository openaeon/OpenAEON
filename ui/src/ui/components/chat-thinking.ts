import { LitElement, html, css, nothing, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { icons } from "../icons.ts";
import { toSanitizedMarkdownHtml } from "../markdown.ts";

@customElement("chat-thinking")
export class ChatThinking extends LitElement {
  @property({ type: String }) content = "";
  @property({ type: Number }) duration?: number;
  @property({ type: Boolean }) isStreaming = false;
  @property({ type: Number }) chaosScore = 0;
  @property({ type: Number }) epiphanyFactor = 0;
  @state() private isExpanded = false;

  connectedCallback() {
    super.connectedCallback();
    // Expand by default if currently streaming
    if (this.isStreaming) {
      this.isExpanded = true;
    }
  }

  updated(changedProperties: PropertyValues<this>) {
    if (
      changedProperties.has("isStreaming") &&
      this.isStreaming &&
      !changedProperties.get("isStreaming")
    ) {
      // If it just started streaming, auto-expand
      this.isExpanded = true;
    }
  }

  static styles = css`
    :host {
      display: block;
      margin-bottom: 8px;
    }

    .thinking-box {
      border: 1px solid var(--border, rgba(224, 224, 224, 0.4));
      background: var(--bg-accent, rgba(249, 249, 249, 0.05));
      backdrop-filter: blur(8px);
      border-radius: 12px;
      overflow: hidden;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      margin: 4px 0 12px 0;
    }

    .thinking-header {
      padding: 10px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      user-select: none;
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--muted, #8c8c8c);
      background: transparent;
    }

    .thinking-header:hover {
      background: var(--bg-hover, rgba(255, 255, 255, 0.05));
    }

    .thinking-icon {
      color: var(--accent-thinking, #818cf8); /* Soft indigo */
      display: flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
    }

    .thinking-icon.streaming {
      animation: pulse-brain 2s infinite ease-in-out;
    }

    @keyframes pulse-brain {
      0% {
        transform: scale(1);
        opacity: 0.8;
      }
      50% {
        transform: scale(1.15);
        opacity: 1;
        filter: drop-shadow(0 0 4px var(--accent-thinking));
      }
      100% {
        transform: scale(1);
        opacity: 0.8;
      }
    }

    .thinking-icon svg {
      width: 100%;
      height: 100%;
    }

    .thinking-label {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 6px;
      letter-spacing: 0.02em;
    }

    .thinking-status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--accent-thinking);
      display: inline-block;
    }

    .thinking-chevron {
      transition: transform 0.3s var(--ease-out);
      display: flex;
      align-items: center;
      color: var(--text-muted);
      opacity: 0.7;
    }

    .thinking-chevron.expanded {
      transform: rotate(180deg);
    }

    .thinking-content {
      padding: 0 14px 14px 14px;
      font-size: 0.9rem;
      line-height: 1.6;
      color: var(--text, #d9d9d9);
      border-top: 1px solid transparent;
      max-height: 0;
      opacity: 0;
      overflow: hidden;
      transition: all 0.3s var(--ease-out);
      position: relative;
    }

    .thinking-content::before {
      content: "";
      position: absolute;
      left: 14px;
      top: 12px;
      bottom: 12px;
      width: 2px;
      background: var(--accent-thinking);
      opacity: 0.15;
      border-radius: 1px;
    }

    .thinking-content-inner {
      padding-left: 16px;
    }

    .thinking-content.expanded {
      max-height: 3000px;
      opacity: 1;
      padding-top: 12px;
      border-top-color: var(--border, rgba(255, 255, 255, 0.05));
    }

    /* Skeleton loader for empty streaming state */
    .skeleton-typing {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      height: 20px;
    }
    .skeleton-dot {
      width: 6px;
      height: 6px;
      background: var(--accent-thinking, #818cf8);
      border-radius: 50%;
      opacity: 0.4;
      animation: thinkingTyping 1.4s infinite ease-in-out both;
    }
    .skeleton-dot:nth-child(1) {
      animation-delay: -0.32s;
    }
    .skeleton-dot:nth-child(2) {
      animation-delay: -0.16s;
    }
    @keyframes thinkingTyping {
      0%,
      80%,
      100% {
        transform: scale(0);
        opacity: 0.2;
      }
      40% {
        transform: scale(1);
        opacity: 1;
      }
    }

    .thinking-content :first-child {
      margin-top: 0;
    }

    .thinking-content :last-child {
      margin-bottom: 0;
    }
  `;

  private toggle() {
    this.isExpanded = !this.isExpanded;
  }

  render() {
    if (!this.content.trim()) {
      return nothing;
    }

    const durationText = this.duration !== undefined ? `${this.duration}s` : "";
    const label = this.isStreaming
      ? "AEON 深度思考 (AEON Deep Thinking)"
      : `逻辑推演 (Logic Deduction) ${durationText ? `(${durationText})` : ""}`;
    const metrics: string[] = [];
    if (this.chaosScore > 0) metrics.push(`Chaos: ${this.chaosScore.toFixed(1)}`);
    if (this.epiphanyFactor > 0) metrics.push(`Depth: ${this.epiphanyFactor}`);
    const metricsText = metrics.length > 0 ? ` [${metrics.join(" | ")}]` : "";

    return html`
      <div class="thinking-box aeon-glass-light aeon-border-glow">
        <div class="thinking-header" @click=${() => this.toggle()}>
          <span class="thinking-icon ${this.isStreaming ? "streaming" : ""}" style="${this.isStreaming ? "color: var(--aeon-cyan);" : ""}">
            ${icons.brain}
          </span>
          <span class="thinking-label" style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--aeon-cyan); opacity: 0.8; text-transform: uppercase; letter-spacing: 0.1em;">
            ${label}${metricsText}
          </span>
          <span class="thinking-chevron ${this.isExpanded ? "expanded" : ""}">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </span>
        </div>
        <div class="thinking-content ${this.isExpanded ? "expanded" : ""}">
          <div class="thinking-content-inner">
            ${
              this.content.trim()
                ? unsafeHTML(toSanitizedMarkdownHtml(this.content))
                : this.isStreaming
                  ? html`
                      <div class="skeleton-typing">
                        <div class="skeleton-dot" style="background: var(--aeon-cyan)"></div>
                        <div class="skeleton-dot" style="background: var(--aeon-purple)"></div>
                        <div class="skeleton-dot" style="background: var(--aeon-indigo)"></div>
                      </div>
                    `
                  : nothing
            }
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-thinking": ChatThinking;
  }
}
