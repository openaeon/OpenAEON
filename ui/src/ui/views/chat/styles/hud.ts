import { css } from "lit";

export const hudStyles = css`
  /* HUD Shared Aesthetics */
  .consciousness-stream {
    position: relative;
    width: 100%;
    min-height: 280px;
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    border-radius: 12px;
    border: 1px solid rgba(56, 189, 248, 0.22);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
    padding: 0;
    overflow: hidden;
    background: linear-gradient(165deg, rgba(8, 14, 30, 0.82), rgba(2, 6, 23, 0.92));
    backdrop-filter: blur(28px);
    -webkit-backdrop-filter: blur(28px);
  }

  .consciousness-stream-header {
    background: rgba(56, 189, 248, 0.08);
    padding: 12px 16px;
    border-bottom: 1px solid rgba(56, 189, 248, 0.12);
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.15em;
    color: rgba(125, 211, 252, 0.7);
    text-transform: uppercase;
  }

  .consciousness-count {
    margin-left: auto;
    font-size: 10px;
    color: rgba(148, 211, 255, 0.9);
    background: rgba(2, 6, 23, 0.55);
    border: 1px solid rgba(56, 189, 248, 0.24);
    border-radius: 999px;
    padding: 2px 8px;
    line-height: 1.2;
    font-family: var(--fractal-font-mono);
  }

  .consciousness-stream-body {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .consciousness-entry {
    padding: 10px 12px;
    border-left: 2px solid rgba(148, 163, 184, 0.3);
    background: rgba(15, 23, 42, 0.45);
    transition: all 0.2s ease;
    overflow: hidden;
    border-radius: 6px;
    margin-bottom: 4px;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
  }

  .consciousness-entry:hover {
    background: rgba(15, 23, 42, 0.65);
    border-left-color: rgba(255, 255, 255, 0.5);
  }

  .consciousness-entry-meta {
    display: flex;
    justify-content: space-between;
    margin-bottom: 6px;
    font-family: var(--fractal-font-mono);
    font-size: 9px;
    line-height: 1;
    gap: 10px;
    letter-spacing: 0.02em;
  }

  .consciousness-type {
    font-weight: 700;
    opacity: 0.9;
  }

  .consciousness-time {
    opacity: 0.4;
    font-variant-numeric: tabular-nums;
  }

  .consciousness-content {
    font-size: 12px;
    line-height: 1.6;
    color: #e2e8f0;
    font-family: var(--fractal-font-mono);
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .consciousness-content--placeholder {
    color: rgba(148, 163, 184, 0.88);
    font-style: italic;
  }

  .consciousness-focus,
  .consciousness-pivot {
    margin-top: 6px;
    font-size: 10px;
    font-family: var(--fractal-font-mono);
    padding: 4px 8px;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.3);
    display: inline-block;
  }

  .consciousness-focus {
    color: var(--aeon-cyan, #22d3ee);
    border-left: 2px solid var(--aeon-cyan, #22d3ee);
  }

  .consciousness-pivot {
    color: var(--aeon-orange, #fb923c);
    border-left: 2px solid var(--aeon-orange, #fb923c);
  }

  /* Formula Rail HUD */
  .formula-rail {
    position: relative;
    width: 100%;
    flex: 0 0 auto;
    max-height: min(30vh, 280px);
    z-index: 0;
    border-radius: 12px;
    padding: 12px 16px;
    border: 1px solid rgba(56, 189, 248, 0.22);
    background: linear-gradient(165deg, rgba(8, 14, 30, 0.82), rgba(2, 6, 23, 0.92));
    box-shadow: 
      0 12px 40px rgba(0, 0, 0, 0.6),
      inset 0 0 20px rgba(56, 189, 248, 0.05);
    backdrop-filter: blur(28px);
    -webkit-backdrop-filter: blur(28px);
    overflow: hidden;
  }

  .formula-rail::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.4), transparent);
    animation: scanner-loop 3s linear infinite;
  }

  @keyframes scanner-loop {
    0% { top: 0; opacity: 0; }
    10% { opacity: 0.8; }
    90% { opacity: 0.8; }
    100% { top: 100%; opacity: 0; }
  }

  .formula-rail__title {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    margin-bottom: 12px;
    color: rgba(125, 211, 252, 0.7);
    font-family: var(--fractal-font-title);
    opacity: 0.8;
  }

  .formula-rail__item {
    border-left: 1px solid var(--formula-phase-idle, rgba(148, 163, 184, 0.4));
    padding: 8px 12px;
    margin-bottom: 8px;
    background: rgba(15, 23, 42, 0.4);
    border-radius: 4px;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    position: relative;
    overflow: hidden;
  }

  .formula-rail__item.active {
    border-left-width: 2px;
    border-left-color: var(--formula-phase-active, #2dd4bf);
    background: rgba(15, 23, 42, 0.6);
    box-shadow: 0 4px 12px rgba(45, 212, 191, 0.1);
  }

  .formula-rail__item.error {
    border-left-width: 2px;
    border-left-color: var(--formula-phase-error, #fb923c);
    background: rgba(251, 146, 60, 0.05);
  }

  .formula-rail__expr {
    font-size: 11px;
    color: #f8fafc;
    font-family: var(--fractal-font-mono);
    line-height: 1.4;
    letter-spacing: -0.01em;
  }

  .formula-rail__value {
    margin-top: 3px;
    font-size: 10px;
    color: #94a3b8;
    font-family: var(--fractal-font-mono);
    opacity: 0.9;
  }

  /* Cognitive Dashboard HUD Extension */
  :host {
    --hud-epiphany-active: #c084fc; /* Purple for Epiphany */
    --hud-memory-saturated: #2dd4bf; /* Teal for Memory */
    --hud-redline-risk: #f43f5e; /* Rose for Risk */
  }

  .cognitive-dashboard {
    margin-top: 12px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    padding: 0 4px;
  }

  .cognitive-metric {
    background: rgba(15, 23, 42, 0.4);
    border-radius: 4px;
    padding: 6px 8px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .cognitive-label {
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(148, 163, 184, 0.7);
    font-weight: 700;
  }

  .cognitive-value {
    font-size: 14px;
    font-weight: 600;
    font-family: var(--fractal-font-mono);
    color: #f8fafc;
  }

  .cognitive-bar-wrap {
    height: 3px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 1px;
    overflow: hidden;
  }

  .cognitive-bar {
    height: 100%;
    transition: width 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .cognitive-bar--epiphany { background: var(--hud-epiphany-active); }
  .cognitive-bar--memory { background: var(--hud-memory-saturated); }
  .cognitive-bar--risk { background: var(--hud-redline-risk); }

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
    0% { background: rgba(244, 63, 94, 0.1); }
    50% { background: rgba(244, 63, 94, 0.25); }
    100% { background: rgba(244, 63, 94, 0.1); }
  }

  @keyframes resonance-glimmer {
    0% { box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5), 0 0 0px var(--hud-epiphany-active); }
    50% { box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5), 0 0 15px var(--hud-epiphany-active); }
    100% { box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5), 0 0 0px var(--hud-epiphany-active); }
  }

  .consciousness-stream.resonance-active {
    animation: resonance-glimmer 2s infinite ease-in-out;
    border-color: var(--hud-epiphany-active) !important;
  }
`;
