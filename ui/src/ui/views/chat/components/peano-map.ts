import { html, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { t } from "../../../../i18n/index.ts";
import type { CurvePoint2D } from "../../../types.ts";

export interface PeanoMapProps {
  trajectory?: CurvePoint2D[];
  active?: boolean;
}

export function renderPeanoMap(props: PeanoMapProps) {
  if (!props.active) {
    return nothing;
  }

  const trajectory = props.trajectory ?? [];
  
  if (trajectory.length === 0) {
    return html`
      <div class="peano-map-container aeon-glass aeon-entry-anim" style="display:flex;align-items:center;justify-content:center;height:300px;">
        <div class="mono" style="opacity:0.7;">${t("sandbox.consciousness.emptyTrend") || "AWAITING_COGNITIVE_TRAJECTORY"}</div>
      </div>
    `;
  }

  const width = 600;
  const height = 400;
  
  // Scale trajectory to fit SVG viewBox
  const points = trajectory.map(p => ({
    x: p.x * width,
    y: p.y * height
  }));

  const polylinePath = points.map(p => `${p.x},${p.y}`).join(" ");
  const lastPoint = points[points.length - 1];

  return html`
    <div class="peano-map-container aeon-glass aeon-entry-anim">
      <div class="peano-map-header">
        <div class="aeon-shushu-pulse" style="width: 8px; height: 8px; background: var(--aeon-cyan, #2dd4bf);"></div>
        <span class="mono">${t("aeon.peanoMap") || "COGNITIVE_TRAJECTORY_MAP"}</span>
      </div>
      <div class="peano-map-body">
        <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3.5" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style="stop-color:rgba(45, 212, 191, 0.1); stop-opacity:0.2" />
              <stop offset="100%" style="stop-color:rgba(45, 212, 191, 1); stop-opacity:1" />
            </linearGradient>
          </defs>

          <!-- Trajectory Path -->
          <polyline 
            points="${polylinePath}" 
            fill="none" 
            stroke="url(#pathGradient)" 
            stroke-width="2.5" 
            stroke-linecap="round" 
            stroke-linejoin="round"
            filter="url(#glow)"
            class="peano-path"
          />

          <!-- Points -->
          ${repeat(
            points,
            (_, i) => i,
            (p, i) => html`
              <circle 
                cx="${p.x}" 
                cy="${p.y}" 
                r="${i === points.length - 1 ? 5 : 2}" 
                class="peano-dot ${i === points.length - 1 ? "current" : ""}"
                style="opacity: ${0.2 + (i / points.length) * 0.8}"
              >
                <title>T-${points.length - 1 - i}</title>
              </circle>
            `
          )}

          <!-- Current Position Marker -->
          <g class="current-marker" transform="translate(${lastPoint.x}, ${lastPoint.y})">
            <circle r="8" fill="rgba(45, 212, 191, 0.2)" class="marker-pulse" />
            <circle r="3" fill="#2dd4bf" />
          </g>
        </svg>
      </div>
    </div>

    <style>
      .peano-map-container {
        width: 100%;
        height: 380px;
        display: flex;
        flex-direction: column;
        border: 1px solid rgba(45, 212, 191, 0.2);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        margin-top: 12px;
        overflow: hidden;
        background: rgba(15, 23, 42, 0.4);
      }
      .peano-map-header {
        background: rgba(45, 212, 191, 0.1);
        padding: 8px 16px;
        border-bottom: 1px solid rgba(45, 212, 191, 0.1);
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 0.7rem;
        letter-spacing: 1px;
        color: #2dd4bf;
      }
      .peano-map-body {
        flex: 1;
        background: radial-gradient(circle at center, rgba(45, 212, 191, 0.05), transparent);
        position: relative;
        padding: 10px;
      }
      .peano-path {
        stroke-dasharray: 1000;
        stroke-dashoffset: 1000;
        animation: drawPath 3s ease-out forwards;
      }
      @keyframes drawPath {
        to { stroke-dashoffset: 0; }
      }
      .peano-dot {
        fill: #2dd4bf;
        transition: all 0.3s ease;
      }
      .peano-dot.current {
        fill: #fff;
        filter: drop-shadow(0 0 4px #2dd4bf);
      }
      .marker-pulse {
        animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
      }
      @keyframes pulse-ring {
        0% { transform: scale(0.3); opacity: 0.8; }
        80%, 100% { transform: scale(2.5); opacity: 0; }
      }
      .peano-map-body svg {
        filter: drop-shadow(0 0 10px rgba(0,0,0,0.5));
      }
    </style>
  `;
}
