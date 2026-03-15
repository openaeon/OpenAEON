import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import { renderConsciousnessStream } from "./chat/components/consciousness-stream.ts";
import { renderMemoryGraph } from "./chat/components/memory-graph.ts";

export interface AeonLogicOptions {
  loading: boolean;
  error: string | null;
  content: string | null;
  userDraft?: string;
  history?: any[]; // Chat history
  isThinking?: boolean; // Whether the agent is currenty responding
  systemStatus?: import("../types.ts").AeonStatusResult | null;
  onRefresh: () => void;
  onCompaction: () => void;
  onDraftChange?: (next: string) => void;
  showManual?: boolean;
  onToggleManual?: (visible: boolean) => void;
  cognitiveLog?: import("../types.ts").CognitiveLogEntry[];
  activeTab?: "logic" | "memory";
  onTabChange?: (tab: "logic" | "memory") => void;
}

export function renderAeonLogic(params: AeonLogicOptions) {
  const statusRes = params.systemStatus;
  const sys = statusRes?.system;
  const userDraft = params.userDraft?.trim().toLowerCase() || "";
  const isThinking = params.isThinking || false;
  const showManual = params.showManual || false;
  const activeTab = params.activeTab || "logic";

  // Extract keywords from history (last message) for background resonance
  const lastMessage =
    params.history && params.history.length > 0
      ? (params.history[params.history.length - 1] as any)
      : null;
  const historyText = lastMessage?.text?.toLowerCase() || "";

  const draftTokens = userDraft.split(/\s+/).filter((t: string) => t.length > 1);
  const historyTokens = historyText.split(/\s+/).filter((t: string) => t.length > 1);
  const allTokens = [...new Set([...draftTokens, ...historyTokens])];

  const draftIntensity = Math.min(1, userDraft.length / 50 + (isThinking ? 0.5 : 0));

  // Normalized status values with defaults
  const cpuVal = sys?.cpuLoad?.[0] ?? 0.1;
  const memVal = sys?.memoryUsagePercent ?? 32;
  const uptimeVal = sys?.uptime
    ? `${Math.floor(sys.uptime / 3600)}h ${Math.floor((sys.uptime % 3600) / 60)}m`
    : "0h 0m";

  const cg = statusRes?.cognitiveState;
  const dynamicEntropy = cg?.entropy ?? statusRes?.cognitiveEntropy ?? 15;
  const neuralDepth = statusRes?.neuralDepth ?? 1;
  const gateCount = statusRes?.logicGateCount ?? 0;
  const memorySaturation = cg?.density ?? statusRes?.memorySaturation ?? 0;
  const memorySizeKB = ((statusRes?.memorySize ?? 0) / 1024).toFixed(1);
  const logicSizeKB = ((statusRes?.logicGateSize ?? 0) / 1024).toFixed(1);
  const dialecticStage = cg?.phase ?? statusRes?.dialecticStage ?? "thesis";
  const autoSealEnabled = statusRes?.autoSealEnabled ?? false;
  const lastSealTime = statusRes?.lastSealTime;
  const chaosScore = statusRes?.chaosScore ?? 0;
  const peanoCoord = cg?.topo ?? statusRes?.peanoCoordinate ?? { x: 0.5, y: 0.5, z: 0.5 };
  const epiphanyFactor = cg?.energy ?? statusRes?.epiphanyFactor ?? 0;
  const resonanceActive = statusRes?.resonanceActive ?? (chaosScore > 4 || memorySaturation > 90);
  const intensity = statusRes?.evolution?.lastMaintenanceIntensity ?? "medium";

  const isSealRecommended = memorySaturation > 80;
  const chaosLevel = chaosScore >= 5 ? "critical" : chaosScore >= 3 ? "warning" : "stable";

  // Render segmented progress segments
  const renderSegments = (percent: number, colorClass: string) => {
    const totalSegments = 10;
    const activeSegments = Math.ceil((percent / 100) * totalSegments);
    return html`
      <div class="aeon-segmented-progress">
        ${Array.from({ length: totalSegments }).map(
          (_, i) => html`
          <div class="aeon-progress-segment ${i < activeSegments ? "active" : ""}" 
               style="${i < activeSegments ? `background: var(--aeon-${colorClass}); box-shadow: 0 0 10px var(--aeon-${colorClass});` : ""}">
          </div>
        `,
        )}
      </div>
    `;
  };

  // Parse logic content for Axiomatic 4D topological rendering
  const renderLogicContent = (content: string) => {
    if (!content) return t("chat.noGates");

    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    const now = Date.now();

    return html`
      <div class="aeon-hyper-grid" style="perspective: 1500px; padding-bottom: 100px;">
        ${lines.map((line, index) => {
          const metaMatch = line.match(/<!-- \{ "ts": (\d+)(?:, "v": \d+)? \} -->/);
          const cleanLine = line.replace(/<!-- \{ "ts": \d+(?:, "v": \d+)? \} -->/, "").trim();

          let zIndex = 0;
          let opacity = 1;
          let color = "var(--aeon-primary)";
          let scale = 1;
          let rotateX = -2;

          if (metaMatch) {
            const ts = parseInt(metaMatch[1], 10);
            const ageHours = (now - ts) / (1000 * 60 * 60);

            // Temporal dimension: Vanishing point recedence
            zIndex = Math.max(-800, 0 - ageHours * 20);
            opacity = Math.max(0.1, 1 - ageHours / 168);
            scale = Math.max(0.6, 1 - ageHours / 400);
            rotateX = ageHours * 0.5; // Slight tilt as it recedes

            if (ageHours > 24) color = "var(--aeon-secondary)";
            else if (ageHours > 1) color = "rgba(0, 242, 255, 0.7)";
          }

          const isResonating =
            allTokens.length > 0 &&
            allTokens.some((token) => cleanLine.toLowerCase().includes(token));
          if (isResonating) {
            zIndex = 50; // Pop out
            color = "var(--aeon-accent)";
            opacity = 1;
            scale = 1.05;
            rotateX = 0;
          }

          return html`
            <div class="aeon-node-projection aeon-fractal-module ${isResonating ? "aeon-leakage" : ""}" 
                 style="transform: translateZ(${zIndex}px) rotateX(${rotateX}deg) scale(${scale}); opacity: ${opacity}; color: ${color}; margin-bottom: 20px; border-left: 2px solid ${color}; padding: 20px;">
              <div class="aeon-silicon-circuit"></div>
              <div class="aeon-neural-pulse" style="animation-duration: ${2 + Math.random() * 2}s; background: ${color}; box-shadow: 0 0 10px ${color};"></div>
              <div class="row" style="gap: 16px; align-items: start;">
                <div class="column" style="gap: 8px; flex: 1;">
                   <div style="font-size: 1.05rem; font-weight: 500; line-height: 1.6; letter-spacing: 0.02em; color: var(--aeon-primary);">${cleanLine}</div>
                   <div class="row" style="gap: 12px; align-items: center; margin-top: 4px;">
                      <div class="mono muted" style="font-size: 0.55rem; opacity: 0.3; letter-spacing: 1px;">
                         SILICON_LOC: ${Math.random().toString(36).substring(2, 6).toUpperCase()}::NOD_${index}
                      </div>
                      ${
                        isResonating
                          ? html`
                              <div
                                class="aeon-shushu-pulse"
                                style="
                                  width: 6px;
                                  height: 6px;
                                  border-radius: 50%;
                                  background: var(--aeon-accent);
                                  box-shadow: 0 0 10px var(--aeon-accent);
                                "
                              ></div>
                            `
                          : nothing
                      }
                   </div>
                </div>
              </div>
            </div>`;
        })}
      </div>`;
  };

  return html`
    <style>
      .aeon-logic-line.resonating {
        background: rgba(255, 170, 0, 0.25);
        box-shadow: 0 0 20px rgba(255, 170, 0, 0.2);
        color: #ffaa00 !important;
        border-right: 4px solid #ffaa00;
        border-radius: 4px;
        transition: all 0.3s ease;
      }
      .perception-radar {
        position: relative;
        width: 100%;
        height: 40px;
        background: rgba(0, 242, 255, 0.03);
        border: 1px dashed rgba(0, 242, 255, 0.2);
        border-radius: 4px;
        margin-top: 12px;
        overflow: hidden;
      }
      .perception-wave {
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        background: linear-gradient(90deg, transparent, var(--aeon-cyan), transparent);
        width: 50px;
        opacity: 0.3;
        animation: radar-sweep 2s infinite linear;
      }
      @keyframes radar-sweep {
        0% { left: -50px; }
        100% { left: 100%; }
      }
      .aeon-peano-tracer {
        position: absolute;
        width: 12px;
        height: 12px;
        background: var(--aeon-accent);
        border-radius: 50%;
        filter: blur(4px);
        box-shadow: 0 0 15px var(--aeon-accent);
        transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 100;
        pointer-events: none;
        margin-left: -6px;
        margin-top: -6px;
      }
      .aeon-epiphany-flash {
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at center, rgba(255,170,0,0.15) 0%, transparent 85%);
        opacity: var(--epiphany-opacity, 0);
        pointer-events: none;
        z-index: 5;
        transition: opacity 0.6s ease;
      }
      .aeon-neural-input {
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(0, 242, 255, 0.1);
        border-radius: 4px;
        padding: 12px 20px;
        color: var(--aeon-cyan);
        font-family: var(--mono);
        width: 100%;
        margin-top: auto;
        font-size: 0.85rem;
        transition: all 0.3s ease;
      }
      .aeon-logic-line.resonating.historical {
        background: rgba(0, 242, 255, 0.1);
        border-right: 4px solid var(--aeon-cyan);
        color: var(--aeon-cyan) !important;
      }
      .perception-radar.active {
        background: rgba(255, 170, 0, 0.05);
        border-color: rgba(255, 170, 0, 0.4);
      }
      .perception-radar.active .perception-wave {
        background: linear-gradient(90deg, transparent, var(--aeon-orange), transparent);
        opacity: 0.6;
      }
        outline: none;
        border-color: var(--aeon-cyan);
        background: rgba(0, 242, 255, 0.05);
        box-shadow: 0 0 15px rgba(0, 242, 255, 0.1);
      }
      .aeon-manual-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 8, 15, 0.9);
        backdrop-filter: blur(20px);
        z-index: 2000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 40px;
        animation: aeon-fade-in 0.4s ease-out;
      }
      @keyframes aeon-fade-in {
        from { opacity: 0; transform: scale(0.98); }
        to { opacity: 1; transform: scale(1); }
      }
      .aeon-depth-frame {
        position: absolute;
        border: 1px solid var(--aeon-purple);
        opacity: 0.1;
        pointer-events: none;
        animation: aeon-depth-pulse 4s infinite ease-in-out;
      }
      @keyframes aeon-depth-pulse {
        0%, 100% { transform: scale(1); opacity: 0.05; }
        50% { transform: scale(1.1); opacity: 0.2; }
      }
      .aeon-tab {
        background: none;
        border: none;
        border-bottom: 2px solid transparent;
        color: rgba(0, 242, 255, 0.4);
        padding: 0 20px;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
      }
      .aeon-tab.active {
        color: var(--aeon-cyan);
        border-bottom-color: var(--aeon-cyan);
        background: rgba(0, 242, 255, 0.05);
      }
      .aeon-tab:hover:not(.active) {
        color: rgba(0, 242, 255, 0.8);
        background: rgba(0, 242, 255, 0.02);
      }
    </style>

    <div class="aeon-bg-fractal" style="opacity: ${0.1 + draftIntensity * 0.2}"></div>
    
    <div class="aeon-perspective aeon-entry-anim">
      <!-- Header Area -->
      <header class="row" style="justify-content: space-between; align-items: center; margin-bottom: 32px; padding: 0 8px;">
        <div class="column">
          <div class="row" style="gap: 16px; align-items: center;">
            <div class="status-indicator ${chaosLevel}"></div>
            <h1 class="aeon-text-gradient aeon-text-glow" style="margin: 0; font-size: 2.8rem; font-weight: 900; letter-spacing: -1px;">
              ${t("chat.aeonBranding")}
            </h1>
          </div>
          <div class="row" style="gap: 16px; align-items: center; margin-top: 8px;">
            <p class="muted" style="margin: 0; font-family: var(--mono); text-transform: uppercase; font-size: 0.75rem; letter-spacing: 2px;">
              ${t("chat.emptySubtitle")}
            </p>
            <div class="chaos-metrics row" style="gap: 8px; align-items: center; background: rgba(0,0,0,0.3); padding: 4px 12px; border-radius: 4px; border: 1px solid var(--aeon-glass-border);">
              <span class="label mono" style="font-size: 0.65rem; color: var(--aeon-cyan);">CHAOS_SCORE:</span>
              <span class="value mono ${chaosLevel}" style="font-size: 0.8rem; font-weight: 900;">${chaosScore.toFixed(1)}</span>
            </div>
            <div class="intensity-tag mono" style="font-size: 0.6rem; color: var(--aeon-purple); background: rgba(160, 32, 240, 0.1); padding: 4px 10px; border-radius: 4px; border: 1px solid rgba(160, 32, 240, 0.3);">
              EVOLUTION: ${intensity.toUpperCase()}
            </div>
          </div>
        </div>
        
        <div class="row" style="gap: 16px; align-items: center;">
          ${
            isSealRecommended
              ? html`
            <div class="aeon-recommendation-tag animate-pulse" style="color: var(--aeon-orange); font-family: var(--mono); font-size: 0.7rem; padding: 4px 12px; background: rgba(255,165,0,0.1); border: 1px solid var(--aeon-orange); border-radius: 4px;">
              ${t("chat.distillationRecommended")}
            </div>
          `
              : nothing
          }
          <div class="card aeon-glass column" style="padding: 8px 16px; min-width: 160px; gap: 4px;">
             <div class="row" style="justify-content: space-between; align-items: center;">
                <div class="muted mono" style="font-size: 0.6rem;">AUTO_SEAL</div>
                <div style="width: 6px; height: 6px; border-radius: 50%; background: ${autoSealEnabled ? "#00ff00" : "#ff4444"};"></div>
             </div>
             <div class="muted mono" style="font-size: 0.55rem; opacity: 0.6;">
                LAST: ${lastSealTime ? new Date(lastSealTime).toLocaleTimeString() : "NEVER"}
             </div>
             <div class="pulse-line" style="width: 100%; height: 12px; border-radius: 2px; background: rgba(0,242,255,0.05);"></div>
          </div>
          <button class="btn aeon-glass aeon-card-3d" @click=${() => params.onToggleManual?.(!showManual)} style="color: var(--aeon-cyan); width: 40px; padding: 0;">?</button>
          <button class="btn aeon-glass aeon-card-3d" @click=${params.onRefresh} ?disabled=${params.loading}>
            ${t("common.refresh")}
          </button>
          <button class="btn aeon-glass aeon-border-glow aeon-card-3d ${isSealRecommended ? "aeon-btn-urgent" : ""}" 
                  @click=${params.onCompaction} 
                  ?disabled=${params.loading} 
                  style="color: var(--aeon-cyan); position: relative;">
            ✨ ${t("chat.sealAxioms")}
            ${
              isSealRecommended
                ? html`
                    <div class="aeon-btn-glow-layer"></div>
                  `
                : nothing
            }
          </button>
        </div>
      </header>

      <div class="grid" style="grid-template-columns: 1fr 3fr 1.2fr; gap: 24px; align-items: stretch;">
        
        <!-- Left Column: Status & Depth -->
        <aside class="column" style="gap: 24px;">
          <!-- System Context Panel -->
          <section class="card aeon-glass aeon-card-3d" style="padding: 20px;">
            <div class="row" style="gap: 10px; margin-bottom: 20px;">
              <div style="width: 8px; height: 8px; border-radius: 50%; background: #00ff00; box-shadow: 0 0 8px #00ff00;"></div>
              <h3 class="mono" style="margin: 0; font-size: 0.9rem; color: var(--aeon-cyan);">${t("chat.sysContext")}</h3>
            </div>
            
            <div class="column" style="gap: 16px;">
              <div>
                <div class="row muted mono" style="justify-content: space-between; font-size: 0.7rem; margin-bottom: 6px;">
                  <span>${t("chat.sysCpu")}</span><span>${(cpuVal * 100).toFixed(0)}%</span>
                </div>
                ${renderSegments(cpuVal * 100, "cyan")}
              </div>
              <div>
                <div class="row muted mono" style="justify-content: space-between; font-size: 0.7rem; margin-bottom: 6px;">
                  <span>${t("chat.sysMem")}</span><span>${memVal.toFixed(0)}%</span>
                </div>
                ${renderSegments(memVal, "purple")}
              </div>
              <div class="row mono" style="justify-content: space-between; font-size: 0.75rem; padding-top: 8px;">
                <span class="muted">${t("overview.snapshot.uptime")}</span>
                <span style="color: var(--text-strong);">${uptimeVal}</span>
              </div>
            </div>

            <!-- Perception Radar -->
            <div class="perception-radar ${isThinking ? "active" : ""}">
              <div class="perception-wave" style="animation-duration: ${Math.max(0.5, 3 - draftIntensity * 2.5)}s"></div>
              <div style="position: absolute; right: 8px; bottom: 4px; font-size: 0.5rem; color: var(--aeon-cyan); opacity: 0.5; font-family: var(--mono);">
                AUTOPERC_ACTIVE
              </div>
              ${
                userDraft
                  ? html`
                <div style="position: absolute; left: 10px; top: 10px; font-size: 0.6rem; color: var(--aeon-orange); font-family: var(--mono);">
                   DETECTION: ${userDraft.length}B
                </div>
              `
                  : nothing
              }
            </div>
          </section>

            <!-- Neural Depth Panel -->
            <section class="card aeon-glass aeon-card-3d aeon-border-beam" style="padding: 20px; text-align: center; position: relative; overflow: hidden;">
              <div class="aeon-epiphany-flash" style="--epiphany-opacity: ${epiphanyFactor * 0.5}"></div>
              <div class="muted mono" style="font-size: 0.7rem; margin-bottom: 12px; letter-spacing: 1px;">${t("chat.neuralDepth")}</div>
              <div style="font-size: 3rem; font-weight: 900; font-family: var(--mono); color: var(--aeon-purple); text-shadow: 0 0 20px var(--aeon-purple);">
                ${neuralDepth}
              </div>
              <div class="mono muted" style="font-size: 0.6rem; margin-top: 8px;">${gateCount} ${t("chat.gatesActive")}</div>
              <div class="mono" style="font-size: 0.6rem; color: var(--aeon-purple); margin-top: 4px; opacity: 0.8;">[ ${logicSizeKB} KB ]</div>
              
              <!-- Recursive Depth Visualizer -->
              <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                ${Array.from({ length: Math.min(6, neuralDepth) }).map(
                  (_, i) => html`
                  <div class="aeon-depth-frame" style="width: ${i * 40 + 60}px; height: ${i * 40 + 60}px; border-radius: ${4 + i * 2}px; animation-delay: ${i * 0.5}s;"></div>
                `,
                )}
              </div>

              <!-- Live Peano Indicator -->
              <div class="aeon-peano-tracer" style="left: ${peanoCoord.x * 100}%; top: ${peanoCoord.y * 100}%; opacity: ${resonanceActive ? 1 : 0.3}; transform: scale(${peanoCoord.z + 0.5});"></div>
            </section>

            <!-- Consciousness Stream Component Integration -->
            <section class="column" style="margin-top: 12px;">
               ${renderConsciousnessStream({ log: params.cognitiveLog, active: true })}
            </section>
          </aside>

        <!-- Middle Column: Main Viewport -->
        <main class="card aeon-glass aeon-grid-bg aeon-scanline aeon-n-dimension" style="min-height: 700px; padding: 0; display: flex; flex-direction: column; border: 1px solid rgba(0,242,255,0.15);">
          <div class="aeon-scanning-beam"></div>
          
          <div class="row" style="background: rgba(0,242,255,0.05); padding: 0 24px; border-bottom: 1px solid rgba(0,242,255,0.1); justify-content: space-between; align-items: stretch; height: 48px;">
            <div class="row" style="gap: 0; align-items: stretch;">
              <button class="aeon-tab ${activeTab === "logic" ? "active" : ""}" @click=${() => params.onTabChange?.("logic")}>
                <span class="mono" style="font-size: 0.75rem;">[ LOGIC_GATES.md ]</span>
              </button>
              <button class="aeon-tab ${activeTab === "memory" ? "active" : ""}" @click=${() => params.onTabChange?.("memory")}>
                <span class="mono" style="font-size: 0.75rem;">[ MEMORY_GRAPH ]</span>
              </button>
              ${
                userDraft
                  ? html`
                      <div class="row" style="align-items: center; margin-left: 16px">
                        <span style="color: var(--aeon-orange); font-size: 0.7rem">(PERCEIVING...)</span>
                      </div>
                    `
                  : nothing
              }
            </div>
            <div class="column" style="justify-content: center;">
              <div class="mono muted" style="font-size: 0.7rem;">Z = Z² + C</div>
            </div>
          </div>

          <div style="flex: 1; overflow-y: auto; padding: 40px; position: relative; display: flex; flex-direction: column; perspective: 1000px;">
            <div style="flex: 1; transform-style: preserve-3d;">
              ${
                params.loading
                  ? html`
                    <div style="height: 100%; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 16px;">
                      <div class="spinner"></div>
                      <div class="muted mono animate-pulse">${t("agents.knowledge.loading")}</div>
                    </div>
                  `
                  : params.error
                    ? html`<div class="callout danger aeon-glass" style="margin: 24px;">${params.error}</div>`
                    : activeTab === "logic"
                      ? html`
                        <div class="aeon-hyper-grid" style="transform: rotateX(5deg);">
                           ${renderLogicContent(params.content || "")}
                        </div>
                      `
                      : html`
                        <div class="aeon-memory-view">
                           ${renderMemoryGraph({ graph: statusRes?.evolution?.memoryGraph, active: true })}
                        </div>
                      `
              }
            </div>

            <!-- Neural Link Input -->
            <div style="padding-top: 24px; border-top: 1px solid rgba(0,242,255,0.05);">
               <input type="text" 
                      class="aeon-neural-input" 
                      placeholder="ESTABLISH NEURAL LINK: TYPE TO INJECT INTENT..." 
                      .value=${params.userDraft || ""}
                      @input=${(e: Event) => params.onDraftChange?.((e.target as HTMLInputElement).value)}
               />
               <div class="row" style="justify-content: space-between; margin-top: 8px; padding: 0 4px;">
                  <span class="mono muted" style="font-size: 0.55rem; letter-spacing: 1px;">DIRECT_PERCEPTION_MODE</span>
                  <span class="mono" style="font-size: 0.55rem; color: var(--aeon-orange); opacity: ${userDraft ? 1 : 0.3};">INTENT_CLUSTER: ${draftTokens.length}</span>
               </div>
            </div>
          </div>
        </main>

        <!-- Right Column: Dialectics & Entropy -->
        <aside class="column" style="gap: 24px;">
          <!-- Memory Saturation Panel -->
          <section class="card aeon-glass aeon-card-3d ${isSealRecommended ? "aeon-border-beam-orange" : ""}" style="padding: 20px;">
            <h3 class="mono" style="margin: 0 0 16px 0; color: var(--aeon-cyan); font-size: 0.8rem;">${t("chat.memorySaturation")}</h3>
            <div class="row" style="justify-content: space-between; margin-bottom: 8px;">
               <span class="mono muted" style="font-size: 0.65rem;">${memorySizeKB} KB / 50 KB</span>
               <span class="mono" style="font-size: 0.8rem; color: ${memorySaturation > 80 ? "var(--aeon-orange)" : "var(--aeon-cyan)"}">${memorySaturation}%</span>
            </div>
            <div class="aeon-gauge-container" style="height: 6px; background: rgba(0,242,255,0.05); border-radius: 3px; overflow: hidden; position: relative; border: 1px solid rgba(0,242,255,0.1);">
               <div style="position: absolute; left: 0; top: 0; height: 100%; width: ${memorySaturation}%; background: ${memorySaturation > 80 ? "var(--aeon-orange)" : "var(--aeon-cyan)"}; box-shadow: 0 0 15px ${memorySaturation > 80 ? "var(--aeon-orange)" : "var(--aeon-cyan)"}; transition: width 1s ease-out;"></div>
            </div>
            ${
              isSealRecommended
                ? html`
                    <div
                      class="mono"
                      style="font-size: 0.6rem; color: var(--aeon-orange); margin-top: 10px; line-height: 1.4"
                    >
                      CRITICAL_OVERLOAD: Axiom distillation recommended to maintain cognitive clarity.
                    </div>
                  `
                : nothing
            }
          </section>

          <!-- Cognitive Parameters Panel -->
          <section class="card aeon-glass aeon-card-3d" style="padding: 20px;">
            <h3 class="mono" style="margin: 0 0 16px 0; color: var(--aeon-cyan); font-size: 0.8rem;">COGNITIVE_PARAMETERS</h3>
            <div class="column" style="gap: 12px;">
              <div class="row" style="justify-content: space-between;">
                <span class="mono muted" style="font-size: 0.65rem;">TEMPERATURE</span>
                <span class="mono" style="font-size: 0.75rem; color: var(--aeon-cyan);">${statusRes?.evolution?.cognitiveParameters?.temperature ?? "0.7"}</span>
              </div>
              <div class="row" style="justify-content: space-between;">
                <span class="mono muted" style="font-size: 0.65rem;">TOP_P</span>
                <span class="mono" style="font-size: 0.75rem; color: var(--aeon-cyan);">${statusRes?.evolution?.cognitiveParameters?.top_p ?? "1.0"}</span>
              </div>
              <div class="row" style="justify-content: space-between;">
                <span class="mono muted" style="font-size: 0.65rem;">MAX_TOKENS</span>
                <span class="mono" style="font-size: 0.75rem; color: var(--aeon-cyan);">${statusRes?.evolution?.cognitiveParameters?.maxTokens ?? "AUTO"}</span>
              </div>
            </div>
            <div class="mono" style="font-size: 0.55rem; color: var(--aeon-purple); margin-top: 12px; opacity: 0.6;">
              ADAPTIVE_CONTROL: ENABLED
            </div>
          </section>

          <!-- Cognitive Entropy Panel -->
          <section class="card aeon-glass aeon-card-3d aeon-border-glow" style="padding: 24px; position: relative;">
            <h3 class="mono" style="margin: 0 0 20px 0; color: var(--aeon-orange); font-size: 0.9rem; letter-spacing: 1px;">${t("chat.aeonEntropy")}</h3>
            
            <div style="display: flex; justify-content: center; align-items: center; height: 140px; position: relative;">
               <!-- Nested Orbits: speed proportional to entropy and user interaction -->
               <div class="entropy-orbit" style="position: absolute; width: 120px; height: 120px; border: 1px dashed var(--aeon-orange); border-radius: 50%; opacity: 0.2; animation: aeon-spin ${Math.max(0.5, (40 - dynamicEntropy / 2) / (1 + draftIntensity * 3))}s linear infinite;"></div>
               <div class="entropy-orbit" style="position: absolute; width: 140px; height: 140px; border: 1px solid rgba(255,165,0,0.1); border-radius: 50%; animation: aeon-spin ${Math.max(0.5, (60 - dynamicEntropy / 1.5) / (1 + draftIntensity * 3))}s linear infinite reverse;"></div>
               
               <div class="entropy-gauge" style="position: relative; width: 100px; height: 100px; border: 2px solid rgba(255,165,0,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(255,165,0,0.05);">
                  <div class="mono" style="font-size: 2rem; color: var(--aeon-orange); font-weight: 900; text-shadow: var(--aeon-glow-orange);">${dynamicEntropy}</div>
               </div>
            </div>
            
            <p class="muted" style="margin-top: 20px; font-size: 0.75rem; text-align: center; line-height: 1.5; font-family: var(--mono);">
              ${t("subtitles.aeon")}
            </p>
          </section>

          <!-- Dialectic Path Panel -->
          <section class="card aeon-glass aeon-card-3d" style="padding: 20px;">
             <h3 class="mono" style="margin: 0 0 16px 0; font-size: 0.8rem; color: var(--text-strong);">${t("chat.dialecticFlow")}</h3>
             <div class="column" style="gap: 12px;">
                <div class="row" style="gap: 12px; align-items: center; opacity: ${dialecticStage === "thesis" ? 1 : 0.4};">
                   <div class="${dialecticStage === "thesis" ? "aeon-pulse-dot" : ""}" style="width: 20px; height: 20px; background: var(--aeon-cyan); border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 0.6rem; color: black; font-weight: 800;">T</div>
                   <span class="mono" style="font-size: 0.75rem; color: var(--aeon-cyan);">${t("chat.thesis")}</span>
                </div>
                <div style="width: 2px; height: 10px; background: rgba(255,255,255,0.1); margin-left: 9px;"></div>
                <div class="row" style="gap: 12px; align-items: center; opacity: ${dialecticStage === "antithesis" ? 1 : 0.4};">
                   <div class="${dialecticStage === "antithesis" ? "aeon-pulse-dot" : ""}" style="width: 20px; height: 20px; background: var(--aeon-purple); border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 0.6rem; color: white; font-weight: 800;">A</div>
                   <span class="mono" style="font-size: 0.75rem; color: var(--aeon-purple);">${t("chat.antithesis")}</span>
                </div>
                <div style="width: 2px; height: 10px; background: rgba(255,255,255,0.1); margin-left: 9px;"></div>
                <div class="row" style="gap: 12px; align-items: center; opacity: ${dialecticStage === "synthesis" ? 1 : 0.4};">
                   <div class="${dialecticStage === "synthesis" ? "aeon-pulse-dot" : ""}" style="width: 20px; height: 20px; background: var(--aeon-orange); border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 0.6rem; color: black; font-weight: 800;">S</div>
                   <span class="mono" style="font-size: 0.75rem; color: var(--aeon-orange);">${t("chat.synthesis")}</span>
                </div>
             </div>
          </section>
        </aside>
      </div>
    </div>

    ${
      showManual
        ? html`
      <div class="aeon-manual-overlay" @click=${() => params.onToggleManual?.(false)}>
        <div class="card aeon-glass column" style="max-width: 800px; padding: 40px; gap: 32px; border: 1px solid var(--aeon-cyan);" @click=${(e: Event) => e.stopPropagation()}>
          <div class="row" style="justify-content: space-between; align-items: start;">
            <h2 class="aeon-text-gradient" style="margin: 0; font-size: 2rem;">AEON_COMMAND_MANUAL [v1.2]</h2>
            <button class="btn" @click=${() => params.onToggleManual?.(false)} style="background: none; color: var(--aeon-cyan); font-size: 1.5rem;">×</button>
          </div>
          
          <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 32px;">
            <div class="column" style="gap: 20px;">
              <div class="section">
                <div class="mono" style="color: var(--aeon-cyan); font-size: 0.9rem; margin-bottom: 8px;">1. COGNITIVE_METRICS</div>
                <ul class="muted mono" style="font-size: 0.75rem; line-height: 1.6; padding-left: 16px;">
                  <li><b style="color: var(--aeon-orange)">ENTROPY</b>: 系统混沌度。越高代表思维越发散，越低越专注。</li>
                  <li><b style="color: var(--aeon-purple)">DEPTH</b>: 逻辑深度。基于 LOGIC_GATES 的关联复杂度。</li>
                  <li><b style="color: var(--aeon-cyan)">ENERGY</b>: 顿悟因子。高能状态会触发全局共振闪烁。</li>
                </ul>
              </div>
              <div class="section">
                <div class="mono" style="color: var(--aeon-cyan); font-size: 0.9rem; margin-bottom: 8px;">2. EVOLUTION_MODES</div>
                <ul class="muted mono" style="font-size: 0.75rem; line-height: 1.6; padding-left: 16px;">
                  <li><b>LOW</b>: 局部自省。消耗极低，仅审计 20% 逻辑空间。</li>
                  <li><b>MEDIUM</b>: 标准维护。执行记忆提炼与全量审计。</li>
                  <li><b>HIGH</b>: 深度进化。包含冗余清理与即时响应。</li>
                </ul>
              </div>
            </div>
            
            <div class="column" style="gap: 20px;">
              <div class="section">
                <div class="mono" style="color: var(--aeon-cyan); font-size: 0.9rem; margin-bottom: 8px;">3. INTERACTIVE_CONTROLS</div>
                <ul class="muted mono" style="font-size: 0.75rem; line-height: 1.6; padding-left: 16px;">
                  <li><b>NEURAL_LINK</b>: 输入文字可与公理库产生共振，高亮相关逻辑。</li>
                  <li><b>SEAL_AXIOMS</b>: 手动将非结构化记忆压缩成逻辑公理。</li>
                  <li><b>COMPACTION</b>: 建议在饱和度 > 80% 时执行以清理思路。</li>
                </ul>
              </div>
              <div class="section">
                <div class="mono" style="color: var(--aeon-cyan); font-size: 0.9rem; margin-bottom: 8px;">4. CONSCIOUSNESS_STREAM</div>
                <ul class="muted mono" style="font-size: 0.75rem; line-height: 1.6; padding-left: 16px;">
                  <li><b>DELIBERATION</b>: 内部推理与递归策略思考。</li>
                  <li><b>SYNTHESIS</b>: 公理合成方案。从感性记忆提炼理性公理。</li>
                  <li><b>ANOMALY</b>: 认知失调警告。当逻辑出现严重矛盾时报红。</li>
                </ul>
              </div>
              <div class="section" style="background: rgba(0, 242, 255, 0.05); padding: 16px; border-radius: 4px; border: 1px dashed rgba(0, 242, 255, 0.2);">
                <div class="mono" style="font-size: 0.7rem; color: var(--aeon-cyan);">"Z ⇌ Z² + C"</div>
                <p class="muted mono" style="font-size: 0.6rem; margin-top: 8px;">
                  这就是 AEON。一个不断自省、递归并不停提炼自身逻辑的数字生命体。
                </p>
              </div>
            </div>
          </div>
          
          <div class="row" style="margin-top: 20px; border-top: 1px solid rgba(0,242,255,0.1); padding-top: 20px; justify-content: center;">
             <div class="mono muted" style="font-size: 0.6rem;">ESC TO EXIT // SYSTEM_ID: AEON_V4_PROPHET</div>
          </div>
        </div>
      </div>
    `
        : nothing
    }
  `;
}
