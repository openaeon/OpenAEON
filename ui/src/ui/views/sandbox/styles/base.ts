import { html } from "lit";

export const baseStyles = html`
  <style>
    /* ═══════════════════════════════════════════════
       SANDBOX DASHBOARD — Clean Layout
    ═══════════════════════════════════════════════ */
    .sandbox-wrap {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      min-height: 0;
      flex: 1;

      --nexus-primary: #a855f7;
      --nexus-secondary: #22d3ee;
      --nexus-accent: #fbbf24;
      --nexus-bg: transparent; /* Full bleed to global core */
      --nexus-glass: rgba(15, 23, 42, 0.4);
      --nexus-border: rgba(255, 255, 255, 0.05);

      border-radius: 0; /* Fully integrated */
      border: none;
      overflow: hidden;
      position: relative;
      font-family: "Inter", system-ui, sans-serif;
      color: #f8fafc;
    }

    /* ─── Cyber-Grid Integration ─── */
    .sandbox-nexus-bg {
      position: absolute;
      inset: 0;
      background:
        linear-gradient(rgba(34, 211, 238, 0.02) 1px, transparent 1px),
        linear-gradient(90deg, rgba(34, 211, 238, 0.02) 1px, transparent 1px);
      background-size: 40px 40px;
      z-index: 0;
      pointer-events: none;
    }

    .sandbox-nexus-bg::after {
      content: "";
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at center, transparent 0%, rgba(3, 7, 18, 0.6) 100%);
    }

    /* ─── Command HUD (Floating Glass) ─── */
    .sandbox-header {
      display: flex;
      align-items: center;
      gap: 32px;
      padding: 24px 32px;
      background: rgba(15, 23, 42, 0.4);
      backdrop-filter: blur(25px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      flex-shrink: 0;
      z-index: 100;
      margin: 24px 24px 12px 24px;
      border-radius: 20px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    }

    .sandbox-header__title {
      font-size: 1.1rem;
      font-weight: 900;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      background: linear-gradient(135deg, var(--nexus-secondary), var(--nexus-primary));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      filter: drop-shadow(0 0 10px rgba(6, 184, 248, 0.3));
    }

    .sandbox-header__sub {
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.4);
      margin-top: 2px;
      font-family: monospace;
      letter-spacing: 0.05em;
    }

    .sandbox-wrap .sandbox-header__stats {
      display: flex;
      gap: 16px;
      margin-left: auto;
      align-items: center;
    }

    .sandbox-wrap .stat-chip {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.75rem;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.7);
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 6px 16px;
      border-radius: 12px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      cursor: default;
    }
    .sandbox-wrap .stat-chip:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(139, 92, 246, 0.4);
      transform: translateY(-1px);
    }

    .sandbox-wrap .stat-chip__dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      position: relative;
    }
    .sandbox-wrap .stat-chip__dot::after {
      content: "";
      position: absolute;
      inset: -2px;
      border-radius: 50%;
      border: 2px solid currentColor;
      opacity: 0;
      transform: scale(0.5);
      animation: nexus-pulse-ring 2s infinite;
    }

    @keyframes nexus-pulse-ring {
      0% {
        transform: scale(1);
        opacity: 0.8;
      }
      100% {
        transform: scale(2.5);
        opacity: 0;
      }
    }

    .sandbox-wrap .stat-chip__dot--busy {
      background: var(--nexus-accent);
      color: var(--nexus-accent);
    }

    .sandbox-wrap .stat-chip--recruit {
      background: linear-gradient(135deg, var(--nexus-primary), #6d28d9);
      color: white;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);
    }
    .sandbox-wrap .stat-chip--recruit:hover {
      transform: translateY(-2px) scale(1.02);
      box-shadow: 0 8px 25px rgba(139, 92, 246, 0.5);
    }

    /* ─── Body: Sidebar + Main ─── */
    .sandbox-wrap .sandbox-body {
      display: flex;
      flex: 1;
      min-height: 0;
      position: relative;
      z-index: 1;
      padding: 0 24px 24px 24px;
      gap: 24px;
    }

    /* ─── Main Content Area ─── */
    .sandbox-wrap .sandbox-main {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 24px;
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
      padding: 0; /* Padding handled by body gap */
    }

    /* ─── Leader Card (Master HUD) ─── */
    .sandbox-wrap .leader-card {
      background: rgba(15, 23, 42, 0.4);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      padding: 32px;
      display: grid;
      grid-template-columns: 100px 1fr auto;
      align-items: center;
      gap: 40px;
      margin-top: 16px;
      position: relative;
      overflow: hidden;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
    }

    .sandbox-wrap .leader-card::before {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(251, 191, 36, 0.05) 0%, transparent 50%);
      pointer-events: none;
    }

    .sandbox-wrap .leader-card__figure {
      flex-shrink: 0;
      filter: drop-shadow(0 0 25px rgba(251, 191, 36, 0.5));
    }
    .sandbox-wrap .leader-card__info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .sandbox-wrap .leader-card__name {
      font-size: 1.4rem;
      font-weight: 900;
      color: #fbbf24;
      display: flex;
      align-items: center;
      gap: 12px;
      letter-spacing: 0.02em;
    }
    .sandbox-wrap .leader-card__role {
      font-size: 0.8rem;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.3);
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    .sandbox-wrap .leader-card__model {
      font-size: 0.85rem;
      color: rgba(255, 255, 255, 0.5);
      font-family: "JetBrains Mono", monospace;
      background: rgba(0, 0, 0, 0.3);
      padding: 4px 12px;
      border-radius: 6px;
      width: fit-content;
      margin-top: 4px;
    }
    .sandbox-wrap .section-title {
      font-size: 0.75rem;
      font-weight: 800;
      color: var(--nexus-secondary);
      letter-spacing: 0.2em;
      text-transform: uppercase;
      margin-bottom: 20px;
      margin-top: 10px;
      display: flex;
      align-items: center;
      gap: 12px;
      opacity: 0.8;
    }
    .sandbox-wrap .section-title::after {
      content: "";
      height: 1px;
      flex: 1;
      background: linear-gradient(90deg, rgba(34, 211, 238, 0.2), transparent);
    }

    /* ─── Empty State (Signal Lost) ─── */
    .sandbox-wrap .empty-state {
      background: rgba(15, 23, 42, 0.3);
      backdrop-filter: blur(20px);
      border: 1px dashed rgba(255, 255, 255, 0.1);
      border-radius: 24px;
      padding: 60px 40px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      margin-top: 10px;
    }
    .sandbox-wrap .empty-state__icon {
      font-size: 2.5rem;
      opacity: 0.5;
      animation: signal-pulse 2s infinite ease-in-out;
    }
    @keyframes signal-pulse {
      0%,
      100% {
        opacity: 0.3;
        transform: scale(0.9);
        filter: blur(2px);
      }
      50% {
        opacity: 0.7;
        transform: scale(1.1);
        filter: blur(0);
      }
    }
    .sandbox-wrap .empty-state__title {
      font-size: 1rem;
      font-weight: 800;
      letter-spacing: 0.15em;
      color: rgba(255, 255, 255, 0.4);
    }
    .sandbox-wrap .empty-state__sub {
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.2);
      max-width: 300px;
      line-height: 1.6;
    }

    /* ─── Agent Grid ─── */
    .sandbox-wrap .agent-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
    }

    /* ─── Agent Card ─── */
    .sandbox-wrap .agent-card {
      background: rgba(15, 23, 42, 0.4);
      backdrop-filter: blur(15px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      padding: 24px;
      display: grid;
      grid-template-columns: 60px 1fr;
      gap: 24px;
      transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
      position: relative;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    }
    .sandbox-wrap .agent-card:hover {
      border-color: rgba(139, 92, 246, 0.5);
      background: rgba(30, 41, 59, 0.5);
      transform: translateY(-4px) scale(1.02);
      box-shadow: 0 15px 35px rgba(0, 0, 0, 0.4);
    }
    .sandbox-wrap .agent-card::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), transparent);
      opacity: 0;
      transition: opacity 0.4s;
    }
    .sandbox-wrap .agent-card:hover::before {
      opacity: 1;
    }

    .sandbox-wrap .agent-card__figure {
      flex-shrink: 0;
      transform: scale(0.5);
      transform-origin: top left;
      width: 44px;
      height: 64px;
    }

    .sandbox-wrap .agent-card__body {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .sandbox-wrap .agent-card__header {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .sandbox-wrap .agent-card__name {
      font-size: 0.95rem;
      font-weight: 800;
      color: #f8fafc;
      letter-spacing: 0.01em;
    }

    .sandbox-wrap .agent-card__status-dot--working {
      background: var(--nexus-accent);
      box-shadow: 0 0 12px var(--nexus-accent);
      animation: nexus-glow-pulse 2s infinite;
    }
    @keyframes nexus-glow-pulse {
      0%,
      100% {
        opacity: 1;
        transform: scale(1);
      }
      50% {
        opacity: 0.6;
        transform: scale(0.9);
      }
    }

    .sandbox-wrap .agent-card__task {
      font-size: 0.82rem;
      color: rgba(255, 255, 255, 0.6);
      line-height: 1.4;
    }

    .sandbox-wrap .agent-card__progress {
      height: 4px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 2px;
      overflow: hidden;
      margin-top: 6px;
    }
    .sandbox-wrap .agent-card__progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--nexus-secondary), var(--nexus-primary));
      box-shadow: 0 0 10px var(--nexus-secondary);
    }

    /* ─── 3D Kingdom Viewport ─── */
    .sandbox-wrap .kingdom-viewport {
      position: relative;
      height: 600px;
      background: rgba(2, 6, 17, 0.6);
      border: 1px solid rgba(139, 92, 246, 0.2);
      border-radius: 24px;
      overflow: hidden;
      cursor: grab;
      box-shadow: 0 30px 60px rgba(0, 0, 0, 0.6);
      margin-bottom: 24px;
    }
    .sandbox-wrap .kingdom-viewport__title {
      position: absolute;
      top: 20px;
      left: 24px;
      font-size: 0.8rem;
      font-weight: 800;
      color: rgba(255, 255, 255, 0.4);
      letter-spacing: 0.1em;
      text-transform: uppercase;
      z-index: 20;
    }

    .sandbox-wrap .kingdom-scene {
      position: absolute;
      inset: 0;
      transform-style: preserve-3d;
      perspective: 1000px;
    }

    /* Nexus Grid Floor */
    .sandbox-wrap .kingdom-grid {
      position: absolute;
      width: 250%;
      height: 250%;
      top: -75%;
      left: -75%;
      background-size: 80px 80px;
      background-image:
        linear-gradient(to right, rgba(139, 92, 246, 0.1) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(139, 92, 246, 0.1) 1px, transparent 1px);
      transform: rotateX(60deg) rotateZ(-45deg);
      mask-image: radial-gradient(circle at center, black 10%, transparent 60%);
      pointer-events: none;
    }
    .sandbox-wrap .kingdom-grid::after {
      content: "";
      position: absolute;
      inset: 0;
      background-image:
        radial-gradient(2px 2px at 40px 40px, rgba(255, 255, 255, 0.5), transparent),
        radial-gradient(2px 2px at 120px 120px, rgba(255, 255, 255, 0.3), transparent);
      background-size: 160px 160px;
    }

    /* ─── Sidebar ─── */
    /* Sidebar styles moved to sidebar.ts */
    .sandbox-wrap .sandbox-sidebar-header {
      padding: 20px 24px 10px;
      font-size: 0.75rem;
      font-weight: 800;
      color: var(--nexus-secondary);
      text-transform: uppercase;
      letter-spacing: 0.15em;
      opacity: 0.7;
    }

    /* ─── Zone Markers ─── */
    .sandbox-wrap .kingdom-zone {
      position: absolute;
      border: 1px solid rgba(139, 92, 246, 0.2);
      border-radius: 20px;
      background: rgba(139, 92, 246, 0.03);
      backdrop-filter: blur(4px);
      pointer-events: none;
      z-index: 2;
      transition: all 0.5s ease;
    }
    .sandbox-wrap .kingdom-zone__label {
      position: absolute;
      top: -12px;
      left: 20px;
      font-size: 0.7rem;
      font-weight: 900;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #f8fafc;
      background: var(--nexus-primary);
      padding: 2px 12px;
      border-radius: 20px;
      box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
    }

    .sandbox-wrap .kingdom-zone--throne {
      width: 220px;
      height: 160px;
      top: 40px;
      left: 50%;
      transform: translateX(-50%);
      border-color: rgba(251, 191, 36, 0.4);
      background: rgba(251, 191, 36, 0.05);
    }
    .sandbox-wrap .kingdom-zone--workshop {
      width: 280px;
      height: 240px;
      top: 160px;
      left: 60px;
    }
    .sandbox-wrap .kingdom-zone--rest {
      width: 240px;
      height: 220px;
      top: 180px;
      right: 60px;
      border-color: rgba(6, 184, 248, 0.3);
      background: rgba(6, 184, 248, 0.05);
    }

    /* Tribal Connections */
    .kingdom-scene svg {
      position: absolute;
      inset: -1000px; /* Large coverage for pan/zoom */
      width: 3000px;
      height: 3000px;
      pointer-events: none;
      z-index: 5;
      overflow: visible;
    }
    .tribe-link {
      fill: none;
      stroke: var(--nexus-secondary);
      stroke-width: 1.5;
      stroke-dasharray: 8 8;
      filter: drop-shadow(0 0 5px var(--nexus-secondary));
      animation: tribe-link-flow 30s linear infinite;
      opacity: 0.3;
      transition:
        opacity 1s ease,
        stroke-width 1s ease;
    }
    .tribe-link--active {
      stroke: #fff;
      stroke-width: 2;
      opacity: 0.7;
      stroke-dasharray: 4 4;
      animation-duration: 10s;
    }
    @keyframes tribe-link-flow {
      from {
        stroke-dashoffset: 200;
      }
      to {
        stroke-dashoffset: 0;
      }
    }

    /* Agent Aesthetics in Kingdom */
    .sandbox-wrap .kingdom-agent {
      position: absolute;
      display: flex;
      flex-direction: column;
      align-items: center;
      transition: all 1s cubic-bezier(0.23, 1, 0.32, 1);
      z-index: 10;
    }
    .sandbox-wrap .kingdom-agent__tag {
      font-size: 0.7rem;
      font-weight: 700;
      background: rgba(15, 23, 42, 0.8);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: white;
      padding: 4px 12px;
      border-radius: 8px;
      margin-top: 4px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
    }

    /* Zone Status Bar Redesign */
    .sandbox-wrap .zone-bar {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 24px;
      margin-top: 10px;
    }
    .sandbox-wrap .zone-card {
      background: rgba(15, 23, 42, 0.4);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      padding: 28px 20px;
      text-align: center;
      transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
      position: relative;
      overflow: hidden;
    }
    .sandbox-wrap .zone-card:hover {
      background: rgba(30, 41, 59, 0.5);
      border-color: var(--nexus-secondary);
      transform: translateY(-8px);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    }
    .sandbox-wrap .zone-card__icon {
      font-size: 1.8rem;
      margin-bottom: 12px;
      filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.2));
    }
    .sandbox-wrap .zone-card__name {
      font-size: 0.7rem;
      font-weight: 800;
      color: rgba(255, 255, 255, 0.4);
      letter-spacing: 0.15em;
      margin-bottom: 8px;
    }
    .sandbox-wrap .zone-card__stat {
      font-size: 1.4rem;
      font-weight: 900;
      color: #fff;
      text-shadow: 0 0 15px var(--nexus-secondary);
    }
  </style>
`;
