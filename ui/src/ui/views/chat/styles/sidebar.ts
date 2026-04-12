import { css } from "lit";

export const chatSidebarStyles = css`
  .chat-sidebar {
    flex: 0 0 38%;
    max-width: 520px;
    background: #11141c;
    border: none;
    border-radius: 0;
    box-shadow: none;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: opacity 0.2s ease;
    min-height: 0;
  }

  :host-context([data-theme="light"]) .chat-sidebar {
    --glass-bg: rgba(255, 255, 255, 0.72);
    --glass-border: var(--border);
    --glass-shadow: 0 4px 12px rgba(99, 102, 241, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.9);
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.75) 0%, rgba(248, 249, 255, 0.8) 100%);
  }
  .chat-sidebar[hidden] {
    transform: translateX(20px);
    opacity: 0;
    pointer-events: none;
  }

  /* ---- Sticky Task Plan Bar (Fractal Matrix) ---- */
  .fractal-sticky {
    position: sticky;
    top: 0;
    z-index: 5;
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    background: var(--sticky-bg, rgba(15, 23, 42, 0.7));
    border-bottom: 1px solid var(--sticky-border, rgba(139, 92, 246, 0.3));
    padding: 12px 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    font-size: 13.5px;
    transition: all 0.3s ease;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  }
  :host-context([data-theme="light"]) .fractal-sticky {
    --sticky-bg: rgba(255, 255, 255, 0.85);
    --sticky-border: rgba(99, 102, 241, 0.2);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  }
  .neo-icon {
    font-size: 18px;
    color: var(--neo-icon-color, #c084fc);
    flex-shrink: 0;
    text-shadow: var(--neo-icon-shadow, 0 0 10px rgba(192, 132, 252, 0.5));
  }
  :host-context([data-theme="light"]) .neo-icon {
    --neo-icon-color: #7c3aed;
    --neo-icon-shadow: 0 0 10px rgba(124, 58, 237, 0.2);
  }
  .aeon-text-sm {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #e2e8f0;
    font-family: var(--font-mono, monospace);
    font-weight: 600;
    letter-spacing: 0.05em;
  }
  .data-numbers {
    flex-shrink: 0;
    color: #94a3b8;
    font-family: var(--font-mono, monospace);
    font-variant-numeric: tabular-nums;
    font-size: 12px;
  }

  .flux-bar {
    width: 100%;
    height: 4px;
    border-radius: 2px;
    background: rgba(30, 41, 59, 0.8);
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.5);
    overflow: hidden;
    position: relative;
  }
  .flux-bar--large {
    height: 6px;
    border-radius: 3px;
  }
  .chat-plan-sticky__bar.flux-bar {
    width: 60px;
    flex-shrink: 0;
  }

  .flux-fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #818cf8, #c084fc);
    box-shadow: 0 0 10px #c084fc;
    transition: width 0.8s cubic-bezier(0.16, 1, 0.3, 1);
    position: relative;
  }
  .flux-fill::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
    animation: fluxFlow 2s linear infinite;
  }
  .flux-fill--done {
    background: linear-gradient(90deg, #10b981, #2dd4bf);
    box-shadow: 0 0 10px #2dd4bf;
  }
  @keyframes fluxFlow {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }

  /* ---- Phase Indicators ---- */
  .matrix-phases {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }
  .matrix-phase {
    font-size: 10px;
    padding: 4px 8px;
    border-radius: 4px;
    background: rgba(30, 41, 59, 0.6);
    color: #64748b;
    font-family: var(--font-mono, monospace);
    border: 1px solid rgba(255, 255, 255, 0.05);
    transition: all 0.3s ease;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  .matrix-phase--active {
    background: rgba(139, 92, 246, 0.15);
    color: #e879f9;
    border-color: rgba(139, 92, 246, 0.4);
    box-shadow: 0 0 15px rgba(139, 92, 246, 0.2);
  }

  /* ---- Sidebar Panels ---- */
  .fractal-panel,
  .fractal-sidebar {
    display: flex;
    flex-direction: column;
    padding: 24px 20px;
    gap: 20px;
    background: transparent;
    animation: none;
  }

  .orchestration-sidebar {
    display: grid;
    grid-template-rows: auto auto minmax(220px, 40%) minmax(220px, 60%);
    gap: 10px;
    padding: 12px;
    min-height: 0;
    height: 100%;
    background: #131722;
  }

  .orchestration-controls {
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 12px;
    background: #171b24;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .orchestration-controls__autopilot {
    border: 1px solid rgba(148, 163, 184, 0.22);
    background: rgba(15, 23, 42, 0.56);
    border-radius: 10px;
    padding: 8px 10px;
    display: grid;
    grid-template-columns: auto auto 1fr;
    align-items: center;
    gap: 8px;
  }

  .orchestration-controls__autopilot-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #cbd5e1;
    font-family: var(--font-mono, monospace);
  }

  .orchestration-controls__autopilot-toggle {
    border: 1px solid rgba(148, 163, 184, 0.3);
    background: rgba(15, 23, 42, 0.72);
    color: #cbd5e1;
    border-radius: 999px;
    padding: 2px 10px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
  }

  .orchestration-controls__autopilot-toggle[data-enabled="true"] {
    border-color: rgba(34, 197, 94, 0.45);
    color: #86efac;
  }

  .orchestration-controls__autopilot-meta {
    font-size: 11px;
    color: #94a3b8;
    justify-self: end;
    font-family: var(--font-mono, monospace);
  }

  .orchestration-controls__create {
    width: 100%;
    border: 1px solid rgba(96, 165, 250, 0.45);
    background: linear-gradient(135deg, rgba(147, 197, 253, 0.9), rgba(96, 165, 250, 0.88));
    color: #0f172a;
    border-radius: 10px;
    padding: 9px 12px;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.02em;
    cursor: pointer;
    transition: filter 0.15s ease;
  }

  .orchestration-controls__create:hover {
    filter: brightness(1.06);
  }

  .orchestration-controls__search-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid rgba(148, 163, 184, 0.24);
    background: rgba(2, 6, 23, 0.58);
    border-radius: 10px;
    padding: 0 10px;
    min-height: 38px;
  }

  .orchestration-controls__search-icon {
    color: #94a3b8;
    font-size: 14px;
    line-height: 1;
  }

  .orchestration-controls__search {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: #e2e8f0;
    font-size: 12px;
    padding: 8px 0;
  }

  .orchestration-controls__search::placeholder {
    color: #94a3b8;
  }

  .orchestration-controls__stats {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .orchestration-controls__filters {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .orchestration-controls__filter {
    border: 1px solid rgba(148, 163, 184, 0.25);
    background: rgba(15, 23, 42, 0.56);
    color: #94a3b8;
    border-radius: 999px;
    padding: 3px 10px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    cursor: pointer;
  }

  .orchestration-controls__filter--active {
    color: #dbeafe;
    border-color: rgba(96, 165, 250, 0.45);
    background: rgba(59, 130, 246, 0.24);
  }

  .orchestration-controls__chip {
    border: 1px solid rgba(148, 163, 184, 0.28);
    background: rgba(15, 23, 42, 0.58);
    color: #cbd5e1;
    border-radius: 999px;
    padding: 3px 8px;
    font-size: 11px;
    font-family: var(--font-mono, monospace);
  }

  .orchestration-controls__chip--running {
    border-color: rgba(45, 212, 191, 0.35);
    color: #5eead4;
  }

  .orchestration-controls__chip--blocked {
    border-color: rgba(251, 146, 60, 0.35);
    color: #fdba74;
  }

  .orchestration-controls__chip--done {
    border-color: rgba(74, 222, 128, 0.3);
    color: #86efac;
  }

  .orchestration-handoff {
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 12px;
    background: #161a23;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .orchestration-handoff__header {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #cbd5e1;
    font-family: var(--font-mono, monospace);
  }

  .orchestration-handoff__metrics {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 10px;
    font-size: 11px;
    color: #94a3b8;
    font-family: var(--font-mono, monospace);
  }

  .orchestration-handoff__hint {
    font-size: 12px;
    color: #e2e8f0;
    line-height: 1.45;
    border-left: 2px solid rgba(59, 130, 246, 0.4);
    padding-left: 8px;
  }

  .orchestration-handoff__focus {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 11px;
    color: #bfdbfe;
    background: rgba(30, 58, 138, 0.25);
    border: 1px solid rgba(96, 165, 250, 0.35);
    border-radius: 8px;
    padding: 6px 8px;
  }

  .orchestration-handoff__focus-clear {
    border: 1px solid rgba(148, 163, 184, 0.32);
    background: rgba(15, 23, 42, 0.7);
    color: #cbd5e1;
    border-radius: 6px;
    padding: 2px 6px;
    font-size: 10px;
    cursor: pointer;
  }

  .orchestration-section {
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 12px;
    background: #161a23;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .orchestration-section__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 12px 8px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.14);
  }

  .orchestration-section .data-desc {
    margin: 8px 10px 0;
    padding: 8px 10px;
    font-size: 12px;
  }

  .orchestration-section__body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 10px;
  }

  .sidebar-empty {
    border: 1px dashed rgba(148, 163, 184, 0.28);
    border-radius: 10px;
    padding: 12px;
    color: #94a3b8;
    font-size: 12px;
    text-align: center;
    background: rgba(15, 23, 42, 0.42);
  }

  .orchestration-section__body--plan .matrix-header {
    display: none;
  }

  .matrix-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(139, 92, 246, 0.2);
    padding-bottom: 12px;
    margin-bottom: 4px;
  }
  .aeon-title,
  .fractal-glitch {
    font-family: var(--font-mono, monospace);
    font-size: 14px;
    font-weight: 700;
    color: #e2e8f0;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    text-shadow: 0 0 10px rgba(192, 132, 252, 0.4);
  }

  .data-desc {
    font-size: 13px;
    color: #cbd5e1;
    line-height: 1.6;
    padding: 12px 16px;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(139, 92, 246, 0.15);
    border-radius: 6px;
    border-left: 3px solid #c084fc;
    font-family: var(--font-sans, sans-serif);
  }

  .matrix-progress {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: rgba(15, 23, 42, 0.4);
    padding: 16px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }
  .data-row {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    font-family: var(--font-mono, monospace);
    color: #94a3b8;
    letter-spacing: 0.05em;
  }

  /* ---- Data Nodes (Todos) ---- */
  .matrix-nodelist {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .matrix-node {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .matrix-node-box {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 8px;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(139, 92, 246, 0.15);
    transition: all 0.3s ease;
  }
  .plan-sidebar-todo--done.matrix-node-box {
    border-color: rgba(45, 212, 191, 0.3);
    background: rgba(15, 23, 42, 0.4);
  }
  .plan-sidebar-todo--done .node-text {
    color: #64748b;
    text-decoration: line-through;
  }
  .plan-sidebar-todo--done .node-status-icon {
    color: #2dd4bf;
    text-shadow: 0 0 8px rgba(45, 212, 191, 0.5);
  }
  .plan-sidebar-todo--in_progress.matrix-node-box {
    border-color: rgba(192, 132, 252, 0.5);
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(15, 23, 42, 0.8));
    box-shadow: 0 0 15px rgba(139, 92, 246, 0.15);
  }
  .plan-sidebar-todo--in_progress .node-status-icon {
    color: #e879f9;
    animation: pulseIcon 2s infinite;
  }
  @keyframes pulseIcon {
    0%,
    100% {
      opacity: 1;
      text-shadow: 0 0 10px #e879f9;
      transform: scale(1);
    }
    50% {
      opacity: 0.6;
      text-shadow: 0 0 2px #e879f9;
      transform: scale(0.9);
    }
  }

  .node-status-icon {
    font-size: 16px;
    color: #64748b;
    margin-top: 2px;
  }
  .node-text {
    flex: 1;
    font-size: 13px;
    line-height: 1.5;
    color: #e2e8f0;
    font-family: var(--font-sans, sans-serif);
  }

  .matrix-node-result {
    margin-left: 28px;
    padding: 10px 14px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 6px;
    border-left: 2px solid #2dd4bf;
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    overflow-wrap: break-word;
    border-right: 1px solid rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid rgba(255, 255, 255, 0.02);
  }
  .aeon-subtitle {
    color: #2dd4bf;
    margin-bottom: 6px;
    letter-spacing: 0.05em;
  }
  .data-text {
    color: #94a3b8;
    white-space: pre-wrap;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .matrix-node-result:hover .data-text {
    -webkit-line-clamp: initial;
    color: #cbd5e1;
  }

  /* ---- Evolution Nodes (Network Graph) ---- */
  .subagent-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    position: relative;
    padding-left: 0;
    margin-top: 0;
    padding-bottom: 2px;
  }

  .node-card {
    position: relative;
    padding: 12px;
    border-radius: 10px;
    background: #1a1f2a;
    border: 1px solid rgba(148, 163, 184, 0.2);
    transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
    z-index: 2;
    box-shadow: none;
    animation: none;
  }

  .subagent-card--selected.node-card {
    border-color: rgba(96, 165, 250, 0.75);
    box-shadow:
      0 0 0 1px rgba(96, 165, 250, 0.45),
      0 8px 26px rgba(30, 58, 138, 0.45);
  }

  /* Recursive Color Indexing based on depth (provided via data-depth) */
  .node-card[data-depth="1"] {
    --fractal-accent: #c084fc;
    --fractal-glow: rgba(192, 132, 252, 0.5);
  }
  .node-card[data-depth="2"] {
    --fractal-accent: #818cf8;
    --fractal-glow: rgba(129, 140, 248, 0.5);
  }
  .node-card[data-depth="3"] {
    --fractal-accent: #2dd4bf;
    --fractal-glow: rgba(45, 212, 191, 0.5);
  }
  .node-card[data-depth="4"] {
    --fractal-accent: #f472b6;
    --fractal-glow: rgba(244, 114, 182, 0.5);
  }

  .node-card::before {
    content: none;
  }

  .node-card::after {
    content: none;
  }

  .subagent-card--active.node-card {
    background: rgba(13, 13, 40, 0.9);
    border-color: var(--fractal-accent, #c084fc);
    transform: none;
  }
  .subagent-card--active.node-card::before {
    opacity: 1;
  }

  .subagent-card__header {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .node-icon {
    font-size: 20px;
    color: var(--fractal-accent, #c084fc);
    text-shadow: 0 0 10px var(--fractal-accent, #c084fc);
    animation: none;
  }

  .node-name {
    font-family: var(--font-mono, monospace);
    font-size: 14px;
    font-weight: 700;
    color: #f8fafc;
    flex: 1;
    letter-spacing: 0.05em;
  }

  .status-badge {
    font-size: 10px;
    padding: 4px 10px;
    border-radius: 20px;
    font-family: var(--font-mono, monospace);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .node-task {
    font-size: 12.5px;
    color: #94a3b8;
    margin-top: 12px;
    line-height: 1.6;
    padding-left: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .subagent-card__deps {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-left: 6px;
    vertical-align: middle;
  }

  .subagent-card__dep {
    border: 1px solid rgba(251, 146, 60, 0.34);
    background: rgba(124, 45, 18, 0.24);
    color: #fdba74;
    border-radius: 999px;
    padding: 1px 7px;
    font-size: 10px;
    cursor: pointer;
  }

  .subagent-card__dep:hover {
    filter: brightness(1.08);
  }
  @media (hover: hover) {
    .node-card:hover .node-task {
      -webkit-line-clamp: initial;
      color: #cbd5e1;
    }
  }

  .node-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
    padding-left: 0;
  }
  .data-chip {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    padding: 4px 10px;
    border-radius: 6px;
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(139, 92, 246, 0.2);
    color: #e2e8f0;
  }

  .node-pulse {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--fractal-accent, #c084fc), transparent);
    animation: none;
  }
  :host-context([data-theme="light"]) .node-pulse {
    --pulse-color: #8b5cf6;
  }
  .chat[data-performance-mode="balanced"] .flux-fill::after,
  .chat[data-performance-mode="balanced"] .node-card,
  .chat[data-performance-mode="balanced"] .node-icon,
  .chat[data-performance-mode="balanced"] .node-pulse,
  .chat[data-performance-mode="balanced"] .plan-sidebar-todo--in_progress .node-status-icon {
    animation: none !important;
    transform: none !important;
  }

  .chat[data-performance-mode="performance"] .chat-sidebar {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    background: rgba(2, 6, 23, 0.9);
  }

  .chat[data-performance-mode="performance"] .orchestration-section,
  .chat[data-performance-mode="performance"] .node-card,
  .chat[data-performance-mode="performance"] .matrix-progress,
  .chat[data-performance-mode="performance"] .matrix-node-box {
    box-shadow: none;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }

  /* ---- Buttons & Completion ---- */
  .matrix-actions {
    margin-top: 24px;
  }
  .matrix-complete {
    text-align: center;
    font-family: var(--font-mono, monospace);
    font-size: 14px;
    color: var(--complete-color, #2dd4bf);
    padding: 16px;
    background: var(--complete-bg, rgba(45, 212, 191, 0.1));
    border: 1px solid var(--complete-border, rgba(45, 212, 191, 0.3));
    border-radius: 8px;
    box-shadow: var(--complete-shadow, inset 0 0 15px rgba(45, 212, 191, 0.1));
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  :host-context([data-theme="light"]) .matrix-complete {
    --complete-color: #0f766e;
    --complete-bg: #f0fdfa;
    --complete-border: #5eead4;
    --complete-shadow: none;
  }

  /* ---- Tool Cards (Fractal Tech Aesthetic) ---- */
  .chat-tool-card {
    background: rgba(15, 23, 42, 0.4);
    border: 1px solid rgba(139, 92, 246, 0.2);
    border-radius: 12px;
    padding: 14px;
    margin: 10px 0;
    position: relative;
    overflow: hidden;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    backdrop-filter: blur(8px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  }

  .chat-tool-card--clickable {
    cursor: pointer;
  }
  .chat-tool-card--clickable:hover {
    background: rgba(139, 92, 246, 0.1);
    border-color: rgba(139, 92, 246, 0.5);
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(139, 92, 246, 0.2);
  }

  .chat-tool-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .chat-tool-card__title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    font-weight: 700;
    color: #f8fafc;
    font-family: var(--font-mono, monospace);
    letter-spacing: 0.05em;
  }

  .chat-tool-card__icon {
    font-size: 16px;
    color: #c084fc;
    filter: drop-shadow(0 0 5px rgba(192, 132, 252, 0.5));
  }

  .chat-tool-card__detail {
    font-size: 11px;
    color: #94a3b8;
    background: rgba(0, 0, 0, 0.3);
    padding: 6px 10px;
    border-radius: 4px;
    font-family: var(--font-mono, monospace);
    margin-top: 8px;
    border-left: 2px solid rgba(139, 92, 246, 0.5);
  }

  /* Structured JSON Result Styling */
  .json-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 10px;
  }

  .json-card-group {
    background: rgba(0, 0, 0, 0.25);
    border-radius: 8px;
    padding: 12px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .json-card-group__title {
    font-size: 10px;
    text-transform: uppercase;
    color: #c084fc;
    font-weight: 800;
    letter-spacing: 0.15em;
    margin-bottom: 8px;
    opacity: 0.8;
  }

  .json-kv {
    display: flex;
    gap: 12px;
    font-size: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    padding: 4px 0;
  }

  .json-key {
    color: #818cf8;
    font-family: var(--font-mono, monospace);
    font-weight: 600;
    min-width: 80px;
  }

  .json-val {
    color: #e2e8f0;
    flex: 1;
    word-break: break-all;
  }

  .chat-tool-card__preview.mono {
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    color: #64748b;
    padding: 10px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 6px;
    margin-top: 10px;
    white-space: pre-wrap;
    max-height: 120px;
    overflow-y: auto;
  }

  .chat[data-visual-mode="professional"] .chat-sidebar {
    background: #11161f;
    border-left: 1px solid rgba(148, 163, 184, 0.2);
  }

  .chat[data-visual-mode="professional"] .fractal-sticky {
    background: #151b25;
    border-bottom: 1px solid rgba(148, 163, 184, 0.22);
    box-shadow: none;
    padding: 10px 14px;
    gap: 10px;
  }

  .chat[data-visual-mode="professional"] .orchestration-sidebar {
    background: #11161f;
    gap: 8px;
    padding: 10px;
  }

  .chat[data-visual-mode="professional"] .orchestration-controls,
  .chat[data-visual-mode="professional"] .orchestration-controls__autopilot {
    background: #161d29;
    border-color: rgba(148, 163, 184, 0.24);
  }

  .chat[data-visual-mode="professional"] .orchestration-controls__create {
    background: rgba(56, 189, 248, 0.14);
    color: #dbeafe;
    border-color: rgba(56, 189, 248, 0.42);
  }

  .chat[data-visual-mode="professional"] .orchestration-controls__search-wrap {
    background: rgba(2, 6, 23, 0.55);
    border-color: rgba(148, 163, 184, 0.24);
  }

  .chat[data-visual-density="compact"] .fractal-sticky {
    padding: 8px 10px;
  }

  .chat[data-visual-density="compact"] .orchestration-sidebar {
    padding: 8px;
    gap: 6px;
  }
`;
