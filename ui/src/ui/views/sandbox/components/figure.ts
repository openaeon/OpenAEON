import { html, nothing } from "lit";
import type { GatewaySessionRow } from "../../../types.ts";

export const AVATAR_CHARACTERS = [
  { id: "codex", name: "Codex", role: "AI Researcher" },
  { id: "claude", name: "Claude", role: "Logic Expert" },
  { id: "gemini", name: "Gemini", role: "Multi-modal Specialist" },
  { id: "qwen", name: "Qwen", role: "Reasoning Ninja" },
  { id: "cursor", name: "Cursor", role: "Stealth Coder" },
  { id: "molty", name: "Molty", role: "Senior Fabricator" },
];

function getKingdomTier(label: string): number {
  const l = label.toLowerCase();
  if (l.includes("elder") || l.includes("大长老") || l.includes("king") || l.includes("国王"))
    return 0;
  if (
    l.includes("chieftain") ||
    l.includes("酋长") ||
    l.includes("marshal") ||
    l.includes("元帅") ||
    l.includes("priest") ||
    l.includes("祭司")
  )
    return 1;
  if (l.includes("lord") || l.includes("领主") || l.includes("general") || l.includes("将军"))
    return 2;
  if (l.includes("warrior") || l.includes("勇士") || l.includes("citizen") || l.includes("公民")) {
    if (l.includes("recruit") || l.includes("新兵") || l.includes("subject") || l.includes("子民"))
      return 4;
    return 3;
  }
  return 3; // Default to warrior/citizen
}

/** 3D CSS Manager Figure */
export function renderManagerFigure(busy: boolean, resonant: boolean = false) {
  const activity = busy ? "commanding" : "coffee";
  return html`
    <div class="figure figure--manager figure--tier-0 ${busy ? "figure--busy" : "figure--idle"} figure--${activity} ${resonant ? "figure--elder-aura" : ""}">
      ${
        activity === "commanding"
          ? html`
              <div class="figure__hologram">
                <div class="hologram__grid"></div>
                <div class="hologram__data hologram__data--1"></div>
                <div class="hologram__data hologram__data--2"></div>
                <div class="hologram__data hologram__data--3"></div>
              </div>
            `
          : nothing
      }
      ${
        activity === "coffee"
          ? html`
              <div class="figure__cup"></div>
            `
          : nothing
      }
      <div class="figure__aura figure__aura--tier-0"></div>
      <div class="figure__crown figure__crown--boss">
        <div class="crown__point crown__point--l"></div>
        <div class="crown__point crown__point--lc"></div>
        <div class="crown__point crown__point--c"></div>
        <div class="crown__point crown__point--rc"></div>
        <div class="crown__point crown__point--r"></div>
        <div class="crown__band"></div>
        <div class="crown__gem"></div>
      </div>
      <div class="figure__head">
        <div class="figure__face">
          <div class="figure__eye figure__eye--l"></div>
          <div class="figure__eye figure__eye--r"></div>
        </div>
        <div class="figure__head-side figure__head-side--l"></div>
        <div class="figure__head-side figure__head-side--r"></div>
        <div class="figure__head-top"></div>
      </div>
      <div class="figure__body">
        <div class="figure__body-side figure__body-side--l"></div>
        <div class="figure__body-side figure__body-side--r"></div>
        <div class="figure__body-top"></div>
        <div class="figure__badge"></div>
      </div>
      <div class="figure__arm figure__arm--l"></div>
      <div class="figure__arm figure__arm--r"></div>
      <div class="figure__legs">
        <div class="figure__leg figure__leg--l"></div>
        <div class="figure__leg figure__leg--r"></div>
      </div>
      <div class="figure__shadow"></div>
    </div>
  `;
}

/** Generic 3D CSS Agent Figure */
export function renderAgentFigure(
  row: GatewaySessionRow,
  avatar?: string,
  resonant: boolean = false,
) {
  const isWorking = Boolean(row.outputTokens && row.outputTokens > 0);
  const modelStr = (row.model || "").toLowerCase();
  const labelStr = (row.label || "").toLowerCase();
  const tier = getKingdomTier(row.label || "");

  let activity = "coffee";
  if (isWorking) {
    if (
      modelStr.includes("vision") ||
      modelStr.includes("claude") ||
      labelStr.includes("search") ||
      labelStr.includes("analyze")
    ) {
      activity = "mining";
    } else {
      activity = "typing";
    }
  }

  // Determine which character class to use
  let avatarClass = "";
  const avatarId = avatar?.toLowerCase() || (row.label || "").toLowerCase();
  if (["codex", "claude", "gemini", "qwen", "cursor", "molty"].includes(avatarId)) {
    avatarClass = `figure--${avatarId}`;
  } else if (row.role === "manager") {
    avatarClass = "figure--manager";
  } else {
    avatarClass = "figure--worker";
  }

  const tierClass = `figure--tier-${tier}`;

  return html`
    <div class="figure ${avatarClass} ${tierClass} ${isWorking ? "figure--busy" : "figure--idle"} figure--${activity} ${resonant ? "figure--resonant" : ""}">
      ${
        activity === "mining"
          ? html`
              <div class="figure__pickaxe"></div>
            `
          : nothing
      }
      ${
        activity === "coffee"
          ? html`
              <div class="figure__cup"></div>
            `
          : nothing
      }
      ${
        avatarClass === "figure--worker" || avatarId === "molty"
          ? html`
              <div class="figure__antenna figure__antenna--l"></div>
              <div class="figure__antenna figure__antenna--r"></div>
            `
          : nothing
      }
      
      <!-- Tiered Royal/Status Elements -->
      ${
        tier <= 1
          ? html`
        <div class="figure__aura figure__aura--tier-${tier}"></div>
        <div class="figure__crown figure__crown--tier-${tier}">
          <div class="crown__point crown__point--l"></div>
          <div class="crown__point crown__point--c"></div>
          <div class="crown__point crown__point--r"></div>
          <div class="crown__band"></div>
        </div>
      `
          : tier === 2
            ? html`
                <div class="figure__aura figure__aura--tier-2"></div>
              `
            : nothing
      }

      <div class="figure__head">
        <div class="figure__face">
          <div class="figure__eye figure__eye--l"></div>
          <div class="figure__eye figure__eye--r"></div>
        </div>
        <div class="figure__head-side figure__head-side--l"></div>
        <div class="figure__head-side figure__head-side--r"></div>
        <div class="figure__head-top"></div>
      </div>
      <div class="figure__body">
        <div class="figure__body-side figure__body-side--l"></div>
        <div class="figure__body-side figure__body-side--r"></div>
        <div class="figure__body-top"></div>
        ${
          tier <= 2 || avatarId === "codex" || avatarId === "gemini"
            ? html`
                <div class="figure__badge"></div>
              `
            : nothing
        }
      </div>
      ${
        avatarClass === "figure--worker" || avatarId === "molty"
          ? html`
              <div class="figure__claw figure__claw--l">
                <div class="claw__upper"></div>
                <div class="claw__lower"></div>
              </div>
              <div class="figure__claw figure__claw--r">
                <div class="claw__upper"></div>
                <div class="claw__lower"></div>
              </div>
            `
          : html`
              <div class="figure__arm figure__arm--l"></div>
              <div class="figure__arm figure__arm--r"></div>
            `
      }
      <div class="figure__legs">
        <div class="figure__leg figure__leg--l"></div>
        <div class="figure__leg figure__leg--r"></div>
      </div>
      <div class="figure__shadow"></div>
    </div>
  `;
}

export function renderWorkerFigure(row: GatewaySessionRow) {
  return renderAgentFigure(row);
}
