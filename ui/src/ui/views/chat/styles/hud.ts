import { css } from "lit";

export const hudStyles = css`
  /* ────────────────────────────────────────────────
     FORMULA RAIL  –  compact header + metric cards
  ──────────────────────────────────────────────── */
  .formula-rail {
    position: relative;
    width: 100%;
    flex: 0 0 auto;
    z-index: 0;
    border-radius: 10px;
    padding: 10px 12px 8px;
    border: 1px solid rgba(56, 189, 248, 0.18);
    background: linear-gradient(165deg, rgba(8, 14, 30, 0.84), rgba(2, 6, 23, 0.94));
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5), inset 0 0 12px rgba(56, 189, 248, 0.04);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* Header row: icon · AEON label · phase badge */
  .formula-rail__header {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .formula-rail__icon {
    font-size: 12px;
    color: rgba(56, 189, 248, 0.7);
  }

  .formula-rail__label {
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: rgba(125, 211, 252, 0.65);
    font-family: var(--fractal-font-title);
    flex: 1;
  }

  .formula-rail__phase {
    font-size: 8px;
    font-family: var(--fractal-font-mono);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    padding: 2px 7px;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.2);
    color: rgba(148, 163, 184, 0.6);
    background: rgba(15, 23, 42, 0.4);
  }

  .formula-rail__phase.active {
    color: rgba(45, 212, 191, 0.9);
    border-color: rgba(45, 212, 191, 0.3);
    background: rgba(45, 212, 191, 0.08);
  }

  /* 3-column metric card grid */
  .formula-rail__metrics {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .formula-metric {
    background: rgba(15, 23, 42, 0.5);
    border-radius: 6px;
    padding: 6px 8px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    display: flex;
    flex-direction: column;
    gap: 3px;
    transition: border-color 0.3s ease;
  }

  .formula-metric.active {
    border-color: rgba(45, 212, 191, 0.25);
    background: rgba(45, 212, 191, 0.05);
  }

  .formula-metric.error {
    border-color: rgba(244, 63, 94, 0.3);
    background: rgba(244, 63, 94, 0.06);
  }

  .formula-metric__label {
    font-size: 7px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: rgba(148, 163, 184, 0.55);
    font-weight: 700;
  }

  .formula-metric__value {
    font-size: 15px;
    font-weight: 600;
    font-family: var(--fractal-font-mono);
    color: #f1f5f9;
    line-height: 1;
  }

  .formula-metric.active .formula-metric__value {
    color: #2dd4bf;
  }

  .formula-metric.error .formula-metric__value {
    color: #f43f5e;
  }

  .formula-metric__bar-wrap {
    height: 2px;
    background: rgba(255, 255, 255, 0.07);
    border-radius: 1px;
    overflow: hidden;
  }

  .formula-metric__bar {
    height: 100%;
    border-radius: 1px;
    background: rgba(125, 211, 252, 0.5);
    transition: width 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .formula-metric.active .formula-metric__bar {
    background: linear-gradient(90deg, #22d3ee, #2dd4bf);
  }

  .formula-metric.error .formula-metric__bar {
    background: #f43f5e;
  }

  /* Bottom equation strip */
  .formula-rail__equation {
    display: flex;
    gap: 8px;
    padding-top: 6px;
    border-top: 1px solid rgba(56, 189, 248, 0.08);
    flex-wrap: nowrap;
    overflow: hidden;
  }

  .formula-rail__eq-text {
    font-size: 9px;
    font-family: var(--fractal-font-mono);
    color: rgba(148, 163, 184, 0.4);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .formula-rail__eq-text.error {
    color: rgba(244, 63, 94, 0.7);
  }

  .formula-rail__eq-text.ok {
    color: rgba(45, 212, 191, 0.6);
  }

  .formula-rail__eq-text.muted {
    color: rgba(148, 163, 184, 0.25);
  }



  /* ────────────────────────────────────────────────
     COGNITIVE DASHBOARD  –  3 mini metric pills
  ──────────────────────────────────────────────── */
  :host {
    --hud-epiphany-active: #c084fc;
    --hud-memory-saturated: #2dd4bf;
    --hud-redline-risk: #f43f5e;
  }

  .cognitive-dashboard {
    display: flex;
    gap: 6px;
    padding: 8px 4px 0;
  }

  .cognitive-metric {
    flex: 1;
    background: rgba(15, 23, 42, 0.45);
    border-radius: 6px;
    padding: 5px 7px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .cognitive-label {
    font-size: 7px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: rgba(148, 163, 184, 0.6);
    font-weight: 700;
    white-space: nowrap;
  }

  .cognitive-value {
    font-size: 13px;
    font-weight: 600;
    font-family: var(--fractal-font-mono);
    color: #f1f5f9;
    line-height: 1;
  }

  .cognitive-bar-wrap {
    height: 2px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 1px;
    overflow: hidden;
  }

  .cognitive-bar {
    height: 100%;
    transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    border-radius: 1px;
  }

  .cognitive-bar--epiphany { background: var(--hud-epiphany-active); }
  .cognitive-bar--memory   { background: var(--hud-memory-saturated); }
  .cognitive-bar--risk     { background: var(--hud-redline-risk); }

  /* ────────────────────────────────────────────────
     CONSCIOUSNESS STREAM  –  compact log list
  ──────────────────────────────────────────────── */
  .consciousness-stream {
    position: relative;
    width: 100%;
    flex: 1 1 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    border-radius: 10px;
    border: 1px solid rgba(56, 189, 248, 0.18);
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
    overflow: hidden;
    background: linear-gradient(165deg, rgba(8, 14, 30, 0.84), rgba(2, 6, 23, 0.94));
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
  }

  .consciousness-stream.resonance-active {
    border-color: var(--hud-epiphany-active);
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45), 0 0 12px var(--hud-epiphany-active);
  }

  .consciousness-stream-header {
    background: rgba(56, 189, 248, 0.06);
    padding: 8px 12px;
    border-bottom: 1px solid rgba(56, 189, 248, 0.1);
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.15em;
    color: rgba(125, 211, 252, 0.6);
    text-transform: uppercase;
    flex-shrink: 0;
  }

  .consciousness-count {
    margin-left: auto;
    font-size: 9px;
    color: rgba(148, 211, 255, 0.8);
    background: rgba(2, 6, 23, 0.55);
    border: 1px solid rgba(56, 189, 248, 0.2);
    border-radius: 999px;
    padding: 1px 7px;
    font-family: var(--fractal-font-mono);
  }

  /* Scroll-to-bottom button inside the stream header */
  .consciousness-scroll-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: rgba(56, 189, 248, 0.08);
    border: 1px solid rgba(56, 189, 248, 0.2);
    color: rgba(125, 211, 252, 0.65);
    font-size: 12px;
    line-height: 1;
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  }

  .consciousness-scroll-btn:hover {
    background: rgba(56, 189, 248, 0.18);
    border-color: rgba(56, 189, 248, 0.45);
    color: #7dd3fc;
  }

  .consciousness-scroll-btn:active {
    background: rgba(56, 189, 248, 0.28);
    transform: scale(0.92);
  }



  .consciousness-stream-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    scrollbar-width: thin;
    scrollbar-color: rgba(0, 242, 255, 0.2) transparent;
  }

  .consciousness-stream-body::-webkit-scrollbar { width: 3px; }
  .consciousness-stream-body::-webkit-scrollbar-thumb {
    background: rgba(0, 242, 255, 0.2);
    border-radius: 2px;
  }

  /* Single-row entry */
  .consciousness-entry {
    display: flex;
    align-items: baseline;
    gap: 6px;
    padding: 4px 8px;
    border-left: 2px solid rgba(148, 163, 184, 0.2);
    background: rgba(15, 23, 42, 0.3);
    border-radius: 5px;
    overflow: hidden;
    transition: background 0.15s ease, border-left-color 0.15s ease;
    cursor: default;
    min-width: 0;
  }

  .consciousness-entry:hover {
    background: rgba(15, 23, 42, 0.55);
    border-left-color: rgba(255, 255, 255, 0.4);
  }

  /* Type color bands */
  .consciousness-entry.reflection  { border-left-color: rgba(34, 211, 238, 0.5); }
  .consciousness-entry.synthesis   { border-left-color: rgba(251, 146, 60, 0.5); }
  .consciousness-entry.deliberation{ border-left-color: rgba(192, 132, 252, 0.5); }
  .consciousness-entry.anomaly     { border-left-color: rgba(244, 63, 94, 0.7); background: rgba(244, 63, 94, 0.04); }
  .consciousness-entry.dreaming    { border-left-color: rgba(148, 163, 184, 0.3); }

  /* Meta row: type icon + time — inline */
  .consciousness-entry-meta {
    display: contents; /* collapse meta so type + time are inline with content */
  }

  .consciousness-type {
    font-size: 9px;
    font-weight: 700;
    font-family: var(--fractal-font-mono);
    letter-spacing: 0.04em;
    opacity: 0.7;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .consciousness-time {
    font-size: 9px;
    font-family: var(--fractal-font-mono);
    opacity: 0.35;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }

  .consciousness-content {
    flex: 1;
    font-size: 11px;
    line-height: 1.4;
    color: rgba(226, 232, 240, 0.85);
    font-family: var(--fractal-font-mono);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    min-width: 0;
  }

  /* On hover: expand the content to 2 lines */
  .consciousness-entry:hover .consciousness-content {
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .consciousness-content--placeholder {
    color: rgba(148, 163, 184, 0.5);
    font-style: italic;
  }

  /* FOCUS / EVENT / PIVOT badges — hidden by default, show on hover */
  .consciousness-focus,
  .consciousness-pivot {
    display: none;
  }

  .consciousness-entry:hover .consciousness-focus,
  .consciousness-entry:hover .consciousness-pivot {
    display: block;
    font-size: 9px;
    font-family: var(--fractal-font-mono);
    padding: 2px 6px;
    border-radius: 3px;
    background: rgba(0, 0, 0, 0.3);
    margin-top: 3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .consciousness-entry:hover .consciousness-focus { color: var(--aeon-cyan, #22d3ee); }
  .consciousness-entry:hover .consciousness-pivot  { color: var(--aeon-orange, #fb923c); }

  .consciousness-entry-actions {
    margin-top: 4px;
  }

  .consciousness-collapsed {
    border-top: 1px solid rgba(0, 242, 255, 0.12);
    padding-top: 6px;
    margin-top: 2px;
  }

  .consciousness-collapsed summary {
    cursor: pointer;
    color: rgba(0, 242, 255, 0.7);
    font-size: 9px;
    font-family: var(--fractal-font-mono);
    letter-spacing: 0.04em;
  }

  .consciousness-collapsed__body {
    margin-top: 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  /* Exec alert overlay */
  .human-gate-overlay {
    position: absolute;
    inset: 0;
    background: rgba(244, 63, 94, 0.15);
    backdrop-filter: blur(4px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 100;
    border: 2px solid var(--hud-redline-risk);
    animation: pulse-red 2s infinite;
  }

  @keyframes pulse-red {
    0%   { background: rgba(244, 63, 94, 0.1); }
    50%  { background: rgba(244, 63, 94, 0.25); }
    100% { background: rgba(244, 63, 94, 0.1); }
  }

  /* ────────────────────────────────────────────────
     LIGHT MODE OVERRIDES (Celestial Theme)
  ──────────────────────────────────────────────── */

  :host-context([data-theme="light"]) .formula-rail,
  :host-context([data-theme="light"]) .consciousness-stream {
    background: linear-gradient(165deg, rgba(255, 255, 255, 0.94), rgba(248, 249, 255, 0.96));
    border-color: var(--border);
    box-shadow: 
      0 8px 32px rgba(99, 102, 241, 0.05),
      inset 0 1px 0 rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }

  :host-context([data-theme="light"]) .formula-rail__label {
    color: var(--accent-muted);
    font-weight: 600;
  }

  :host-context([data-theme="light"]) .formula-rail__icon {
    color: var(--accent);
    opacity: 0.8;
  }

  :host-context([data-theme="light"]) .formula-rail__phase {
    color: var(--muted);
    border-color: var(--border);
    background: var(--bg-accent);
  }

  :host-context([data-theme="light"]) .formula-rail__phase.active {
    color: var(--ok);
    border-color: var(--ok-subtle);
    background: var(--ok-subtle);
  }

  :host-context([data-theme="light"]) .formula-metric {
    background: rgba(255, 255, 255, 0.4);
    border-color: var(--border);
  }

  :host-context([data-theme="light"]) .formula-metric__label {
    color: var(--muted);
    font-weight: 500;
  }

  :host-context([data-theme="light"]) .formula-metric__value {
    color: var(--text-strong);
  }

  :host-context([data-theme="light"]) .formula-metric.active .formula-metric__value {
    color: var(--ok);
  }

  :host-context([data-theme="light"]) .formula-metric__bar-wrap {
    background: var(--bg-accent);
  }

  :host-context([data-theme="light"]) .formula-metric__bar {
    background: var(--border-strong);
  }

  :host-context([data-theme="light"]) .formula-metric.active .formula-metric__bar {
    background: linear-gradient(90deg, var(--ok), #34d399);
  }

  :host-context([data-theme="light"]) .formula-rail__eq-text {
    color: var(--muted);
    opacity: 0.5;
  }

  :host-context([data-theme="light"]) .formula-rail__equation {
    border-top-color: var(--border);
  }

  /* Consciousness stream light */
  :host-context([data-theme="light"]) .consciousness-stream-header {
    background: rgba(99, 102, 241, 0.03);
    border-bottom-color: var(--border);
    color: var(--text-strong);
    font-weight: 600;
  }

  :host-context([data-theme="light"]) .consciousness-count {
    color: var(--accent-muted);
    background: var(--bg);
    border-color: var(--border);
  }

  :host-context([data-theme="light"]) .consciousness-scroll-btn {
    background: var(--bg-accent);
    border-color: var(--border);
    color: var(--muted);
  }

  :host-context([data-theme="light"]) .consciousness-scroll-btn:hover {
    background: var(--bg-hover);
    border-color: var(--border-strong);
    color: var(--text-strong);
  }

  :host-context([data-theme="light"]) .consciousness-entry {
    background: rgba(255, 255, 255, 0.3);
    border-left-color: var(--border-strong);
  }

  :host-context([data-theme="light"]) .consciousness-entry:hover {
    background: rgba(255, 255, 255, 0.7);
  }

  :host-context([data-theme="light"]) .consciousness-entry.reflection  { border-left-color: #06b6d4; }
  :host-context([data-theme="light"]) .consciousness-entry.synthesis   { border-left-color: #f97316; }
  :host-context([data-theme="light"]) .consciousness-entry.deliberation{ border-left-color: #8b5cf6; }
  :host-context([data-theme="light"]) .consciousness-entry.anomaly     { border-left-color: #ef4444; background: rgba(239, 68, 68, 0.03); }

  :host-context([data-theme="light"]) .consciousness-type { color: var(--muted); font-weight: 500; }
  :host-context([data-theme="light"]) .consciousness-time { color: var(--muted); opacity: 0.6; }

  :host-context([data-theme="light"]) .consciousness-content {
    color: var(--text);
  }

  :host-context([data-theme="light"]) .consciousness-stream-body::-webkit-scrollbar-thumb {
    background: var(--border);
  }
`;


