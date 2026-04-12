import { html, nothing } from "lit";
import type { AeonStatusResult, SandboxChatEvents, CognitiveTaskRecord } from "../types.ts";
import type { TaskPlanSnapshot } from "./sandbox.ts";
import type {
  CognitiveLongTermEntry,
  CognitiveMemoryQueryResult,
  CognitiveTaskEvent,
} from "../controllers/cognitive.ts";

type CognitiveTaskPhase =
  | "INIT"
  | "PLAN"
  | "EXECUTE"
  | "VERIFY"
  | "REFLECT"
  | "DONE"
  | "FAILED"
  | "ROLLED_BACK";

const PRIMARY_PHASES: CognitiveTaskPhase[] = ["PLAN", "EXECUTE", "VERIFY", "REFLECT", "DONE"];

const PHASE_PROGRESS: Record<CognitiveTaskPhase, number> = {
  INIT: 6,
  PLAN: 22,
  EXECUTE: 46,
  VERIFY: 64,
  REFLECT: 82,
  DONE: 100,
  FAILED: 100,
  ROLLED_BACK: 100,
};

export type CognitiveViewProps = {
  sessionKey: string;
  taskPlan: TaskPlanSnapshot | null;
  cognitiveTask: CognitiveTaskRecord | null;
  cognitiveTaskList: CognitiveTaskRecord[];
  cognitiveSelectedTaskId: string | null;
  cognitiveRuntimeEvents: CognitiveTaskEvent[];
  cognitiveLegacyPlan: unknown | null;
  cognitiveSubmitTitle: string;
  cognitiveSubmitText: string;
  cognitiveMemoryQuery: string;
  cognitiveMemoryTags: string;
  cognitiveMemoryResults: CognitiveMemoryQueryResult | null;
  cognitiveReplayRunId: string | null;
  cognitiveReplayEvents: CognitiveTaskEvent[];
  cognitiveReplayLoading: boolean;
  cognitiveLoading: boolean;
  cognitiveMemoryLoading: boolean;
  cognitiveSourceContext: {
    path: string;
    startLine: number;
    endLine: number;
    contextStartLine: number;
    contextEndLine: number;
    lineCount: number;
    excerpt: string;
  } | null;
  cognitiveSourceSelectedLine: number | null;
  sandboxChatEvents: SandboxChatEvents;
  aeonStatus: AeonStatusResult | null;
  chatMessages: unknown[];
  chatToolMessages: unknown[];
  onRefresh: () => void;
  onSelectTask: (taskId: string | null) => void;
  onSubmitTask: () => void;
  onTransition: (to: CognitiveTaskPhase, reason?: string) => void;
  onDispatch: () => void;
  onDream: () => void;
  onReflect: () => void;
  onMemoryQueryChange: (next: string) => void;
  onMemoryTagsChange: (next: string) => void;
  onRunMemoryQuery: () => void;
  onSubmitTitleChange: (next: string) => void;
  onSubmitTextChange: (next: string) => void;
  onInspectMemoryResult: (result: CognitiveLongTermEntry) => void;
  onTraceMemoryResult: (result: CognitiveLongTermEntry) => void;
  onSourceLineSelect: (lineNo: number) => void;
  onReplayRun: (runId: string) => void;
};

type SourceContext = NonNullable<CognitiveViewProps["cognitiveSourceContext"]>;

function fmtTime(value?: number | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function phaseBadge(phase?: string) {
  const value = phase || "unknown";
  return html`<span class="pill primary"><span class="mono">${value}</span></span>`;
}

function statCard(label: string, value: unknown, detail?: unknown) {
  return html`<div class="stat-card cog-stat-card">
    <div class="stat-label">${label}</div>
    <div class="stat-value">${value}</div>
    ${detail ? html`<div class="muted cog-stat-detail">${detail}</div>` : nothing}
  </div>`;
}

function formatMemoryLocation(result: CognitiveLongTermEntry): string {
  return `${result.path}:${result.startLine}-${result.endLine}`;
}

function escapeCodeFence(value: string): string {
  return value.replace(/```/g, "\\`\\`\\`");
}

function parseExcerptLine(
  line: string,
): { lineNo: number; content: string; isMatch: boolean } | null {
  const match = line.match(/^([ >])\s+(\d+)\s+\|\s?(.*)$/);
  if (!match) {
    return null;
  }
  return {
    isMatch: match[1] === ">",
    lineNo: Number(match[2]),
    content: match[3] ?? "",
  };
}

function eventPreview(entry: CognitiveTaskEvent): string {
  if (typeof entry.payload === "string") {
    return entry.payload;
  }
  try {
    return JSON.stringify(entry.payload);
  } catch {
    return String(entry.payload);
  }
}

function activeTaskStatus(task: CognitiveTaskRecord | null, loading: boolean): string {
  if (loading) {
    return "SYNCING";
  }
  if (!task) {
    return "IDLE";
  }
  return task.status.phase === "DONE" ? "READY" : "LIVE_RUN";
}

function resolvePhase(task: CognitiveTaskRecord | null): CognitiveTaskPhase {
  const phase = task?.status.phase;
  if (
    phase === "INIT" ||
    phase === "PLAN" ||
    phase === "EXECUTE" ||
    phase === "VERIFY" ||
    phase === "REFLECT" ||
    phase === "DONE" ||
    phase === "FAILED" ||
    phase === "ROLLED_BACK"
  ) {
    return phase;
  }
  return "INIT";
}

function cardHeader(label: string, title: string, status?: unknown) {
  return html`
    <header class="cog-card-header">
      <div>
        <div class="cog-kicker">${label}</div>
        <h3 class="cog-card-title">${title}</h3>
      </div>
      ${status ? html`<div class="cog-card-status">${status}</div>` : nothing}
    </header>
  `;
}

function renderTaskComposer(props: CognitiveViewProps, activeTask: CognitiveTaskRecord | null) {
  const tasks = props.cognitiveTaskList;
  const activeId = props.cognitiveSelectedTaskId ?? activeTask?.id ?? null;

  return html`
    <section class="aeon-fractal-module aeon-card-3d cog-panel cog-task-composer">
      ${cardHeader("Submit", "Task Composer", phaseBadge(activeTask?.status.phase))}
      <div class="cog-panel-body">
        <label class="cog-field">
          <span class="cog-field-label">Task Title</span>
          <input
            class="input cog-input"
            type="text"
            .value=${props.cognitiveSubmitTitle}
            @input=${(event: Event) => props.onSubmitTitleChange((event.target as HTMLInputElement).value)}
            placeholder="Initialize heuristic protocol..."
          />
        </label>

        <label class="cog-field">
          <span class="cog-field-label">Description</span>
          <textarea
            class="input cog-input cog-textarea"
            rows="5"
            .value=${props.cognitiveSubmitText}
            @input=${(event: Event) => props.onSubmitTextChange((event.target as HTMLTextAreaElement).value)}
            placeholder="Describe the objective for the cognitive node..."
          ></textarea>
        </label>

        <div class="cog-actions">
          <button class="btn cog-btn-primary" type="button" ?disabled=${props.cognitiveLoading} @click=${props.onSubmitTask}>
            Launch Task
          </button>
          <button class="btn btn--secondary" type="button" ?disabled=${props.cognitiveLoading} @click=${props.onRefresh}>
            Save Draft
          </button>
        </div>

        <div class="cog-divider"></div>

        <div class="cog-task-list-head">
          <span class="cog-field-label">Task Registry</span>
          <span class="mono muted">${tasks.length}</span>
        </div>

        <div class="cog-task-list" role="list">
          ${
            tasks.length === 0
              ? html`
                  <div class="muted cog-empty">No cognitive tasks yet. Submit one to start.</div>
                `
              : tasks.map((task) => {
                  const active = task.id === activeId;
                  return html`
                    <button
                      type="button"
                      class="cog-task-item ${active ? "is-active" : ""}"
                      @click=${() => props.onSelectTask(task.id)}
                    >
                      <div class="cog-task-item-row">
                        <div class="cog-task-dot ${
                          task.status.phase === "DONE"
                            ? "ok"
                            : task.status.phase === "FAILED"
                              ? "warn"
                              : task.status.phase === "EXECUTE"
                                ? "critical"
                                : "warn"
                        }"></div>
                        <strong class="cog-task-title">${task.title}</strong>
                        <span class="mono cog-task-version">v${task.version}</span>
                      </div>
                      <div class="cog-task-item-meta">
                        <span class="mono">${task.id}</span>
                        <span>${task.status.phase} · ${fmtTime(task.updatedAt)}</span>
                      </div>
                    </button>
                  `;
                })
          }
        </div>
      </div>
    </section>
  `;
}

function renderPriorityCard(task: CognitiveTaskRecord | null) {
  const score = task
    ? Math.min(100, 25 + task.runIds.length * 9 + task.reflections.length * 4)
    : 38;
  return html`
    <section class="aeon-fractal-module aeon-card-3d cog-panel cog-priority-panel">
      <div class="cog-panel-body">
        <div class="cog-priority-head">
          <span class="cog-kicker">Priority Weight</span>
          <span class="mono">${score}%</span>
        </div>
        <div class="cog-progress-track">
          <div class="cog-progress-fill" style=${`width: ${score}%`}></div>
        </div>
        <div class="cog-priority-scale">
          <span>Stable</span>
          <span>Override</span>
        </div>
      </div>
    </section>
  `;
}

function renderEngineCard(props: CognitiveViewProps, activeTask: CognitiveTaskRecord | null) {
  const phase = resolvePhase(activeTask);
  const activeIndex = Math.max(
    0,
    PRIMARY_PHASES.findIndex((item) => item === phase),
  );
  const progress = PHASE_PROGRESS[phase] ?? 0;
  const lastRunId = activeTask?.runIds[activeTask.runIds.length - 1] ?? null;

  return html`
    <section class="aeon-fractal-module aeon-card-3d cog-panel cog-engine-panel">
      ${cardHeader(
        "Processing",
        "Cognitive Engine",
        html`<span class="cog-live-dot"></span><span class="mono">${activeTask ? "LIVE_RUN" : "IDLE"}</span>`,
      )}
      <div class="cog-panel-body">
        <div class="cog-stage-line" style=${`--cog-stage-progress:${progress}%`}>
          ${PRIMARY_PHASES.map((item, index) => {
            const done = index < activeIndex;
            const current = index === activeIndex;
            return html`
              <div class="cog-stage ${done ? "is-done" : ""} ${current ? "is-current" : ""}">
                <div class="cog-stage-node">${item.slice(0, 1)}</div>
                <span>${item}</span>
              </div>
            `;
          })}
        </div>

        <div class="cog-engine-actions">
          ${(
            [
              "PLAN",
              "EXECUTE",
              "VERIFY",
              "REFLECT",
              "DONE",
              "FAILED",
              "ROLLED_BACK",
            ] as CognitiveTaskPhase[]
          ).map(
            (nextPhase) => html`
              <button
                class="btn btn--sm"
                type="button"
                ?disabled=${props.cognitiveLoading || !activeTask}
                @click=${() => props.onTransition(nextPhase, `ui:${nextPhase.toLowerCase()}`)}
              >
                ${nextPhase}
              </button>
            `,
          )}
          <button class="btn btn--sm" type="button" ?disabled=${props.cognitiveLoading || !activeTask} @click=${props.onDispatch}>Dispatch</button>
          <button class="btn btn--sm" type="button" ?disabled=${props.cognitiveLoading || !activeTask} @click=${props.onDream}>Dream</button>
          <button class="btn btn--sm" type="button" ?disabled=${props.cognitiveLoading || !activeTask} @click=${props.onReflect}>Reflect</button>
          ${
            lastRunId
              ? html`<button class="btn btn--sm" type="button" @click=${() => props.onReplayRun(lastRunId)}>Replay Latest</button>`
              : nothing
          }
        </div>
      </div>
    </section>
  `;
}

function renderKernelStream(props: CognitiveViewProps) {
  const runtimeEvents = props.cognitiveRuntimeEvents.slice(-16).reverse();

  return html`
    <section class="aeon-fractal-module aeon-card-3d cog-panel cog-kernel-panel">
      ${cardHeader(
        "Runtime",
        "Kernel Stream",
        html`
          <span class="cog-dot-ok"></span><span class="cog-dot-warn"></span>
        `,
      )}
      <div class="cog-panel-body cog-kernel-body">
        ${
          runtimeEvents.length === 0
            ? html`
                <div class="muted cog-empty">No runtime events recorded yet.</div>
              `
            : runtimeEvents.map(
                (entry) => html`
                <div class="cog-log-row">
                  <span class="mono cog-log-time">${fmtTime(Date.now()).split(" ").pop() ?? "--:--:--"}</span>
                  <span class="mono cog-log-stream">[${entry.stream}]</span>
                  <span class="cog-log-text">${eventPreview(entry)}</span>
                </div>
              `,
              )
        }
      </div>
    </section>
  `;
}

function renderNetworkMap(activeTask: CognitiveTaskRecord | null) {
  const runCount = activeTask?.runIds.length ?? 0;
  return html`
    <section class="aeon-fractal-module aeon-card-3d cog-panel cog-map-panel">
      <div class="cog-panel-body cog-map-body">
        <div class="cog-map-node n1"></div>
        <div class="cog-map-node n2"></div>
        <div class="cog-map-node n3"></div>
        <div class="cog-map-node n4"></div>
        <svg class="cog-map-svg" viewBox="0 0 100 44" preserveAspectRatio="none" aria-hidden="true">
          <line x1="16" y1="23" x2="40" y2="11"></line>
          <line x1="16" y1="23" x2="48" y2="34"></line>
          <line x1="40" y1="11" x2="74" y2="23"></line>
          <line x1="48" y1="34" x2="74" y2="23"></line>
        </svg>
        <div class="cog-map-caption">MAPPING SYNAPSE ACTIVE · ${runCount} RUNS</div>
      </div>
    </section>
  `;
}

function renderReplayFoldout(props: CognitiveViewProps) {
  const events = props.cognitiveReplayEvents;
  return html`
    <details class="cog-foldout">
      <summary>
        <span>Run Replay</span>
        <span class="mono muted">${props.cognitiveReplayLoading ? "loading" : `${events.length} events`}</span>
      </summary>
      <div class="cog-foldout-body">
        ${
          events.length === 0
            ? html`
                <div class="muted cog-empty">No replay loaded yet.</div>
              `
            : events.map(
                (entry) => html`
                <div class="cog-inline-card">
                  <div class="cog-inline-head">
                    <strong>${entry.stream}</strong>
                    <span class="mono muted">${entry.runId}</span>
                  </div>
                  <pre class="mono cog-json">${JSON.stringify(entry.payload, null, 2)}</pre>
                </div>
              `,
              )
        }
      </div>
    </details>
  `;
}

function renderMemoryBridge(props: CognitiveViewProps) {
  const evolution = props.cognitiveMemoryResults?.evolution ?? [];
  const longTerm = props.cognitiveMemoryResults?.longTerm ?? [];

  return html`
    <section class="aeon-fractal-module aeon-card-3d cog-panel cog-memory-panel">
      ${cardHeader("Memory", "Memory Bridge")}
      <div class="cog-panel-body">
        <div class="cog-query-grid">
          <label class="cog-field">
            <span class="cog-field-label">Query</span>
            <input
              class="input cog-input"
              type="text"
              .value=${props.cognitiveMemoryQuery}
              @input=${(event: Event) => props.onMemoryQueryChange((event.target as HTMLInputElement).value)}
              placeholder="search memory"
            />
          </label>
          <label class="cog-field">
            <span class="cog-field-label">Tags</span>
            <input
              class="input cog-input"
              type="text"
              .value=${props.cognitiveMemoryTags}
              @input=${(event: Event) => props.onMemoryTagsChange((event.target as HTMLInputElement).value)}
              placeholder="dream, verifier"
            />
          </label>
          <button class="btn" type="button" ?disabled=${props.cognitiveMemoryLoading} @click=${props.onRunMemoryQuery}>
            ${props.cognitiveMemoryLoading ? "Querying..." : "Query"}
          </button>
        </div>

        <div class="cog-memory-summary">
          <p>
            Retrieved ${longTerm.length} context shards and ${evolution.length} evolution entries from memory.
          </p>
        </div>

        <div class="cog-tag-row">
          ${(props.cognitiveMemoryTags || "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
            .slice(0, 5)
            .map((tag) => html`<span class="cog-chip">#${tag}</span>`)}
          ${
            !props.cognitiveMemoryTags.trim() && longTerm.length === 0
              ? html`
                  <span class="cog-chip">#no_results</span>
                `
              : nothing
          }
        </div>

        <div class="cog-memory-lists">
          <div>
            <div class="cog-field-label">Evolution</div>
            <div class="cog-mini-list">
              ${
                evolution.length === 0
                  ? html`
                      <div class="muted cog-empty">No evolution memory yet.</div>
                    `
                  : evolution.slice(0, 4).map(
                      (entry) => html`
                      <div class="cog-inline-card">
                        <div class="cog-inline-head">
                          <strong>${entry.category}</strong>
                          <span class="mono muted">${fmtTime(entry.createdAt)}</span>
                        </div>
                        <div class="muted">${entry.content}</div>
                      </div>
                    `,
                    )
              }
            </div>
          </div>
          <div>
            <div class="cog-field-label">Long-term Matches</div>
            <div class="cog-mini-list">
              ${
                longTerm.length === 0
                  ? html`
                      <div class="muted cog-empty">No long-term matches.</div>
                    `
                  : longTerm.slice(0, 5).map(
                      (item) => html`
                      <div class="cog-inline-card">
                        <div class="cog-inline-head">
                          <strong>${item.path}</strong>
                          <span class="mono muted">${item.score.toFixed(2)}</span>
                        </div>
                        <div class="mono muted">${formatMemoryLocation(item)}</div>
                        <div class="cog-memory-text">${item.text}</div>
                        <div class="cog-inline-actions">
                          <button type="button" class="btn btn--sm" @click=${() => props.onInspectMemoryResult(item)}>Open Source</button>
                          <button type="button" class="btn btn--sm btn--secondary" @click=${() => props.onTraceMemoryResult(item)}>Trace Graph</button>
                        </div>
                      </div>
                    `,
                    )
              }
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderSignals(props: CognitiveViewProps) {
  const cognitiveState =
    props.aeonStatus?.telemetry?.cognitiveState ?? props.aeonStatus?.legacy?.cognitiveState ?? null;
  const entropy =
    typeof cognitiveState?.entropy === "number" ? cognitiveState.entropy.toFixed(3) : "-";
  const memLoad =
    typeof cognitiveState?.density === "number" ? `${Math.round(cognitiveState.density)}%` : "-";
  const toolUsage = props.chatToolMessages.length;
  const messages = props.chatMessages.length;

  return html`
    <section class="aeon-fractal-module aeon-card-3d cog-panel cog-signals-panel">
      ${cardHeader("System", "System Signals")}
      <div class="cog-panel-body">
        <div class="cog-signals-grid">
          ${statCard("Entropy", html`<span class="mono">${entropy}</span>`)}
          ${statCard("Mem Load", html`<span class="mono">${memLoad}</span>`)}
          ${statCard("Tool Usage", html`<span class="mono">${toolUsage}</span>`)}
          ${statCard("Messages", html`<span class="mono">${messages}</span>`)}
        </div>

        <div class="cog-field-label">Live Telemetry</div>
        <div class="cog-telemetry-bars" aria-label="live telemetry bars">
          ${[28, 44, 67, 52, 31, 79, 62, 86, 47, 23].map(
            (value) => html`<span style=${`height:${value}%`}></span>`,
          )}
        </div>
      </div>
    </section>
  `;
}

function renderSourceFoldout(props: CognitiveViewProps) {
  const source = props.cognitiveSourceContext;
  if (!source) {
    return html`
      <details class="cog-foldout">
        <summary>
          <span>Source Context</span>
          <span class="muted">No source selected</span>
        </summary>
        <div class="cog-foldout-body muted">Pick a memory result to inspect source context.</div>
      </details>
    `;
  }
  return html`
    <details class="cog-foldout">
      <summary>
        <span>Source Context</span>
        <span class="mono muted">${source.path}</span>
      </summary>
      <div class="cog-foldout-body">
        ${renderSourceViewer(props, source)}
      </div>
    </details>
  `;
}

function renderSourceViewer(props: CognitiveViewProps, source: SourceContext) {
  const lines = source.excerpt.split(/\r?\n/).map(parseExcerptLine).filter(Boolean) as Array<{
    lineNo: number;
    content: string;
    isMatch: boolean;
  }>;
  const selectedLine = props.cognitiveSourceSelectedLine ?? source.startLine;
  const selectedIndex = lines.findIndex((line) => line.lineNo === selectedLine);
  const selectedEntry = selectedIndex >= 0 ? (lines[selectedIndex] ?? null) : null;
  const nearbyLines =
    selectedIndex >= 0
      ? lines.slice(Math.max(0, selectedIndex - 2), Math.min(lines.length, selectedIndex + 3))
      : [];

  return html`
    <div class="cog-inline-card">
      <div class="cog-inline-head">
        <strong>${source.path}</strong>
        <span class="mono muted">${source.contextStartLine}-${source.contextEndLine}</span>
      </div>
      ${
        selectedEntry
          ? html`
            <div class="cog-inline-summary">
              <div class="muted">Selected line ${selectedLine}</div>
              <div class="mono">${selectedEntry.content || "(blank line)"}</div>
              ${
                nearbyLines.length > 0
                  ? html`
                    <div class="cog-source-list mono" style="margin-top: 8px;">
                      ${nearbyLines.map(
                        (line) => html`
                          <div
                            class="cog-source-line ${line.lineNo === selectedLine ? "is-selected" : ""} ${line.isMatch ? "is-match" : ""}"
                            style="pointer-events: none;"
                          >
                            <span>${String(line.lineNo).padStart(4, " ")}</span>
                            <span>${line.content || " "}</span>
                          </div>
                        `,
                      )}
                    </div>
                  `
                  : nothing
              }
            </div>
          `
          : nothing
      }
      <div class="cog-source-list mono">
        ${lines.map((line) => {
          const isSelected = line.lineNo === selectedLine;
          const isMatch = line.isMatch;
          return html`
            <button
              type="button"
              class="cog-source-line ${isSelected ? "is-selected" : ""} ${isMatch ? "is-match" : ""}"
              @click=${() => props.onSourceLineSelect(line.lineNo)}
            >
              <span>${String(line.lineNo).padStart(4, " ")}</span>
              <span>${line.content || " "}</span>
            </button>
          `;
        })}
      </div>
    </div>
  `;
}

function renderBridgeFoldout(props: CognitiveViewProps) {
  const legacyPlan =
    ((props.cognitiveLegacyPlan && typeof props.cognitiveLegacyPlan === "object"
      ? props.cognitiveLegacyPlan
      : null) as TaskPlanSnapshot | null) ?? props.taskPlan;
  const legacyNodes = legacyPlan?.todos?.length ?? 0;
  const graphEdges = legacyPlan?.graphEdges?.length ?? 0;

  return html`
    <details class="cog-foldout">
      <summary>
        <span>Legacy Plan Snapshot</span>
        <span class="mono muted">${legacyPlan?.phase ?? "-"}</span>
      </summary>
      <div class="cog-foldout-body">
        <div class="cog-signals-grid">
          ${statCard("Phase", phaseBadge(legacyPlan?.phase), legacyPlan?.description ?? "-")}
          ${statCard("Todos", html`<span class="mono">${legacyNodes}</span>`, "legacy bridge")}
          ${statCard("Edges", html`<span class="mono">${graphEdges}</span>`, "graph memory")}
        </div>
      </div>
    </details>
  `;
}

function renderPlaybackBar(task: CognitiveTaskRecord | null) {
  const phase = resolvePhase(task);
  const progress = PHASE_PROGRESS[phase] ?? 0;
  return html`
    <footer class="cog-playback-bar">
      <div class="cog-playback-controls">
        <button class="cog-icon-btn" type="button" aria-label="replay">R</button>
        <button class="cog-icon-btn cog-icon-btn--active" type="button" aria-label="play">P</button>
        <button class="cog-icon-btn" type="button" aria-label="next">N</button>
      </div>
      <div class="cog-playback-track-wrap">
        <div class="cog-playback-meta">
          <span class="mono">${task ? (fmtTime(task.updatedAt).split(" ").pop() ?? "--:--") : "--:--"}</span>
          <span class="mono">REAL_TIME_SYNC</span>
        </div>
        <div class="cog-playback-track">
          <div class="cog-playback-progress" style=${`width:${progress}%`}></div>
          <div class="cog-playback-head" style=${`left:${progress}%`}></div>
        </div>
      </div>
      <div class="cog-playback-right">
        <div>
          <span>Current Step</span>
          <strong>${phase}</strong>
        </div>
        <div>
          <span>Node Cluster</span>
          <strong>REGION_US_EAST_01</strong>
        </div>
      </div>
    </footer>
  `;
}

export function formatMemoryResultSidebar(result: CognitiveLongTermEntry): string {
  const citation = result.citation?.trim();
  const snippet = result.text.trim() || "(no snippet available)";
  return [
    `# Memory Match`,
    ``,
    `- Path: \`${result.path}\``,
    `- Lines: \`${result.startLine}-${result.endLine}\``,
    `- Score: \`${result.score.toFixed(2)}\``,
    citation ? `- Citation: \`${citation}\`` : null,
    ``,
    `## Snippet`,
    `\`\`\`text`,
    escapeCodeFence(snippet),
    `\`\`\``,
    ``,
    `## Trace`,
    `Use this source location to jump back into the original memory trail or open the matching file view.`,
  ]
    .filter((line): line is string => line != null)
    .join("\n");
}

export function formatMemorySourceSidebar(
  result: CognitiveLongTermEntry,
  source: {
    path: string;
    startLine: number;
    endLine: number;
    contextStartLine: number;
    contextEndLine: number;
    lineCount: number;
    excerpt: string;
  },
): string {
  const citation = result.citation?.trim();
  const hasContext =
    source.contextStartLine !== result.startLine || source.contextEndLine !== result.endLine;
  return [
    `# Source Context`,
    ``,
    `- Match: \`${result.path}:${result.startLine}-${result.endLine}\``,
    `- Opened: \`${source.path}:${source.contextStartLine}-${source.contextEndLine}\``,
    `- Score: \`${result.score.toFixed(2)}\``,
    `- Lines in file: \`${source.lineCount}\``,
    citation ? `- Citation: \`${citation}\`` : null,
    hasContext ? `- Context window: \`${source.contextStartLine}-${source.contextEndLine}\`` : null,
    ``,
    `## Excerpt`,
    `\`\`\`text`,
    escapeCodeFence(source.excerpt),
    `\`\`\``,
    ``,
    `## Next Step`,
    `Trace this result back through the task graph if the source path maps to a todo, checkpoint, or dream node.`,
  ]
    .filter((line): line is string => line != null)
    .join("\n");
}

export function renderCognitiveView(props: CognitiveViewProps) {
  const activeTask =
    props.cognitiveTask ??
    props.cognitiveTaskList.find((task) => task.id === props.cognitiveSelectedTaskId) ??
    null;
  const currentStatus = activeTaskStatus(activeTask, props.cognitiveLoading);

  return html`
    <div class="aeon-silicon-nexus cog-page aeon-grid-bg" data-page-state=${currentStatus.toLowerCase()}>
      <div class="aeon-bg-fractal"></div>
      <div class="aeon-formula-motif">AEON_OS :: COGNITIVE_CONTROL</div>

      <header class="cog-header">
        <div>
          <h1 class="cog-title">Cognitive OS</h1>
          <div class="cog-subtitle">Operational cognition console</div>
        </div>
        <div class="cog-header-status">
          <span class="cog-live-dot"></span>
          <span class="mono">${currentStatus}</span>
        </div>
      </header>

      <div class="cog-layout">
        <aside class="cog-left-col">
          ${renderTaskComposer(props, activeTask)}
          ${renderPriorityCard(activeTask)}
        </aside>

        <section class="cog-center-col">
          ${renderEngineCard(props, activeTask)}
          ${renderKernelStream(props)}
          ${renderNetworkMap(activeTask)}
          ${renderReplayFoldout(props)}
        </section>

        <aside class="cog-right-col">
          ${renderMemoryBridge(props)}
          ${renderSignals(props)}
          ${renderSourceFoldout(props)}
          ${renderBridgeFoldout(props)}
        </aside>
      </div>

      ${renderPlaybackBar(activeTask)}
      ${nothing}
    </div>
  `;
}
