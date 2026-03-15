import { html, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { t } from "../../../../i18n/index.ts";
import type { CognitiveLogEntry } from "../../../types.ts";

export interface ConsciousnessStreamProps {
  log?: CognitiveLogEntry[];
  active?: boolean;
}

export function renderConsciousnessStream(props: ConsciousnessStreamProps) {
  if (!props.active || !props.log || props.log.length === 0) {
    return nothing;
  }

  const sortedLog = [...props.log].sort((a, b) => b.timestamp - a.timestamp);

  return html`
    <div class="consciousness-stream aeon-glass aeon-entry-anim">
      <div class="consciousness-stream-header">
        <div class="aeon-shushu-pulse" style="width: 8px; height: 8px; background: var(--aeon-cyan);"></div>
        <span class="mono">${t("chat.consciousnessStream") || "CONSCIOUSNESS_STREAM"}</span>
      </div>
      <div class="consciousness-stream-body">
        ${repeat(
          sortedLog,
          (entry) => entry.timestamp + entry.type,
          (entry) => html`
            <div class="consciousness-entry ${entry.type}">
              <div class="consciousness-entry-meta">
                <span class="consciousness-type">${entry.type.toUpperCase()}</span>
                <span class="consciousness-time">${new Date(entry.timestamp).toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
              </div>
              <div class="consciousness-content">${entry.content}</div>
              ${entry.metadata?.focus ? html`<div class="consciousness-focus">FOCUS: ${entry.metadata.focus}</div>` : nothing}
              ${entry.metadata?.pivot ? html`<div class="consciousness-pivot">PIVOT: ${entry.metadata.pivot}</div>` : nothing}
            </div>
          `,
        )}
      </div>
    </div>

    <style>
      .consciousness-stream {
        position: fixed;
        right: 24px;
        top: 80px;
        width: 320px;
        max-height: 400px;
        z-index: 1000;
        display: flex;
        flex-direction: column;
        border: 1px solid rgba(0, 242, 255, 0.2);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        padding: 0;
        overflow: hidden;
      }
      .consciousness-stream-header {
        background: rgba(0, 242, 255, 0.1);
        padding: 8px 16px;
        border-bottom: 1px solid rgba(0, 242, 255, 0.1);
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 0.7rem;
        letter-spacing: 1px;
        color: var(--aeon-cyan);
      }
      .consciousness-stream-body {
        flex: 1;
        overflow-y: auto;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .consciousness-entry {
        padding: 8px;
        border-left: 2px solid rgba(255, 255, 255, 0.1);
        background: rgba(255, 255, 255, 0.02);
        transition: all 0.3s ease;
      }
      .consciousness-entry-meta {
        display: flex;
        justify-content: space-between;
        margin-bottom: 4px;
        font-family: var(--mono);
        font-size: 0.55rem;
      }
      .consciousness-type {
        opacity: 0.8;
      }
      .consciousness-time {
        opacity: 0.4;
      }
      .consciousness-content {
        font-size: 0.75rem;
        line-height: 1.4;
        color: var(--text-base);
      }
      .consciousness-focus, .consciousness-pivot {
        margin-top: 4px;
        font-size: 0.6rem;
        font-family: var(--mono);
        padding: 2px 6px;
        border-radius: 2px;
        background: rgba(0,0,0,0.2);
      }
      .consciousness-focus { color: var(--aeon-cyan); }
      .consciousness-pivot { color: var(--aeon-orange); }

      /* Type specifics */
      .reflection { border-left-color: var(--aeon-cyan); }
      .synthesis { border-left-color: var(--aeon-orange); }
      .deliberation { border-left-color: var(--aeon-purple); }
      .anomaly { border-left-color: #ff4444; background: rgba(255, 0, 0, 0.05); }
      .dreaming { border-left-color: #888; font-style: italic; }

      .consciousness-stream-body::-webkit-scrollbar {
        width: 4px;
      }
      .consciousness-stream-body::-webkit-scrollbar-thumb {
        background: rgba(0, 242, 255, 0.2);
        border-radius: 2px;
      }
    </style>
  `;
}
