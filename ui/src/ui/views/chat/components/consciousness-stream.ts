import { html, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { t } from "../../../../i18n/index.ts";
import type { CognitiveLogEntry } from "../../../types.ts";

export interface ConsciousnessStreamProps {
  log?: CognitiveLogEntry[];
  active?: boolean;
  docked?: boolean;
  muteWhenSidebarOpen?: boolean;
  sidebarOpen?: boolean;
  epiphanyFactor?: number;
  chaosScore?: number;
  riskScore?: number;
  memorySaturation?: number;
  onBacktrack?: (runId: string) => void;
}

type StreamRenderEntry = CognitiveLogEntry & {
  dedupeCount: number;
  normalizedContent: string;
};

function normalizeContent(entry: CognitiveLogEntry): string {
  const raw = entry.content?.trim() ?? "";
  if (raw.length > 0) {
    return raw;
  }
  const focus =
    entry.metadata && typeof entry.metadata.focus === "string" ? entry.metadata.focus.trim() : "";
  const pivot =
    entry.metadata && typeof entry.metadata.pivot === "string" ? entry.metadata.pivot.trim() : "";
  if (focus.length > 0 || pivot.length > 0) {
    return [focus ? `focus=${focus}` : null, pivot ? `pivot=${pivot}` : null]
      .filter(Boolean)
      .join(" · ");
  }
  return "No structured narrative payload";
}

function compressLogEntries(entries: CognitiveLogEntry[]): StreamRenderEntry[] {
  const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp);
  const dedupeWindowMs = 5 * 60 * 1000;
  const compacted: StreamRenderEntry[] = [];
  for (const entry of sorted) {
    const normalizedContent = normalizeContent(entry);
    const prev = compacted[compacted.length - 1];
    if (
      prev &&
      prev.type === entry.type &&
      prev.normalizedContent === normalizedContent &&
      prev.timestamp - entry.timestamp <= dedupeWindowMs
    ) {
      prev.dedupeCount += 1;
      continue;
    }
    compacted.push({
      ...entry,
      normalizedContent,
      dedupeCount: 1,
    });
  }
  return compacted;
}

export function renderConsciousnessStream(props: ConsciousnessStreamProps) {
  if (!props.active || !props.log || props.log.length === 0) {
    return nothing;
  }
  if (props.muteWhenSidebarOpen && props.sidebarOpen) {
    return nothing;
  }

  const sortedLog = compressLogEntries(props.log);
  const deliberate = sortedLog.filter((entry) => entry.type === "deliberation");
  const deliberateVisible = deliberate.slice(0, 12);
  const deliberateCollapsed = deliberate.slice(12);
  const nonDeliberate = sortedLog.filter((entry) => entry.type !== "deliberation");
  const renderEntries = (entries: StreamRenderEntry[]) =>
    repeat(
      entries,
      (entry) => `${entry.timestamp}:${entry.type}:${entry.normalizedContent}`,
      (entry) => {
        const typeIcon =
          entry.type === "anomaly" ? "⚠" :
          entry.type === "dreaming" ? "⌬" :
          entry.type === "reflection" ? "∿" :
          entry.type === "synthesis" ? "❖" :
          "⚬";
        const timeStr = new Date(entry.timestamp).toLocaleTimeString([], {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        const dedupeSuffix = entry.dedupeCount > 1 ? ` ×${entry.dedupeCount}` : "";

        return html`
          <div class="consciousness-entry ${entry.type}">
            <span class="consciousness-type">${typeIcon}${dedupeSuffix}</span>
            <span class="consciousness-time">${timeStr}</span>
            <span class="consciousness-content ${entry.content?.trim() ? "" : "consciousness-content--placeholder"}"
              >${entry.normalizedContent}</span
            >
            ${entry.metadata?.focus
              ? html`<div class="consciousness-focus">⌗ ${entry.metadata.focus}</div>`
              : nothing}
            ${entry.metadata && typeof entry.metadata.eventId === "string"
              ? html`<div class="consciousness-focus">⇢ ${entry.metadata.eventId}</div>`
              : nothing}
            ${entry.metadata?.pivot
              ? html`<div class="consciousness-pivot">⇢ ${entry.metadata.pivot}</div>`
              : nothing}
            ${entry.type === "anomaly" && entry.metadata?.runId
              ? html`
                  <div class="consciousness-entry-actions">
                    <button
                      class="aeon-button aeon-button-mini aeon-button--warning"
                      @click=${() => props.onBacktrack?.(entry.metadata!.runId as string)}
                    >
                      ↺ BACKTRACK
                    </button>
                  </div>
                `
              : nothing}
          </div>
        `;
      },
    );

  return html`
    <section class="consciousness-stream aeon-glass aeon-entry-anim ${props.docked ? "docked" : ""} ${props.epiphanyFactor && props.epiphanyFactor > 0.7 ? "resonance-active" : ""}">
      <div class="consciousness-stream-header">
        <div class="aeon-shushu-pulse" style="width: 8px; height: 8px; background: var(--aeon-cyan);"></div>
        <span class="mono">${t("chat.consciousnessStream") || "CONSCIOUSNESS_STREAM"}</span>
        <span class="consciousness-count">${sortedLog.length}</span>
        <button
          class="consciousness-scroll-btn"
          title="跳到最新"
          @click=${(e: Event) => {
            const body = (e.currentTarget as HTMLElement)
              .closest(".consciousness-stream")
              ?.querySelector(".consciousness-stream-body");
            if (body) body.scrollTop = body.scrollHeight;
          }}
        >↓</button>
      </div>
      
      <!-- FCA Layer 9: Cognitive Dashboard -->
      <div class="cognitive-dashboard">
        <div class="cognitive-metric">
          <div class="cognitive-label">Epiphany</div>
          <div class="cognitive-value">${((props.epiphanyFactor ?? 0) * 10).toFixed(1)}</div>
          <div class="cognitive-bar-wrap">
            <div class="cognitive-bar cognitive-bar--epiphany" style="width: ${Math.min(100, (props.epiphanyFactor ?? 0) * 100)}%"></div>
          </div>
        </div>
        <div class="cognitive-metric">
          <div class="cognitive-label">Memory</div>
          <div class="cognitive-value">${(props.memorySaturation ?? 0).toFixed(1)}%</div>
          <div class="cognitive-bar-wrap">
            <div class="cognitive-bar cognitive-bar--memory" style="width: ${Math.min(100, props.memorySaturation ?? 0)}%"></div>
          </div>
        </div>
        <div class="cognitive-metric">
          <div class="cognitive-label">Risk</div>
          <div class="cognitive-value">${(props.riskScore ?? 0).toFixed(2)}</div>
          <div class="cognitive-bar-wrap">
            <div class="cognitive-bar cognitive-bar--risk" style="width: ${Math.min(100, (props.riskScore ?? 0) * 100)}%"></div>
          </div>
        </div>
      </div>

      <div class="consciousness-stream-body">
        ${renderEntries(nonDeliberate)}
        ${renderEntries(deliberateVisible)}
        ${
          deliberateCollapsed.length > 0
            ? html`
                <details class="consciousness-collapsed">
                  <summary>${deliberateCollapsed.length} deliberation events folded</summary>
                  <div class="consciousness-collapsed__body">${renderEntries(deliberateCollapsed)}</div>
                </details>
              `
            : nothing
        }
      </div>
    </section>
  `;
}
