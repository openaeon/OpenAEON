import { css } from "lit";
import { hudStyles } from "./hud.ts";

export const chatLayoutStyles = css`
  :host {
    --fractal-depth-1: 0.22;
    --fractal-depth-2: 0.38;
    --fractal-depth-3: 0.56;
    --fractal-depth-4: 0.78;
    --silicon-glow-primary: rgba(45, 212, 191, 0.36);
    --silicon-glow-secondary: rgba(56, 189, 248, 0.28);
    --silicon-glow-alert: rgba(245, 158, 11, 0.36);
    --formula-phase-idle: rgba(148, 163, 184, 0.4);
    --formula-phase-active: rgba(45, 212, 191, 0.95);
    --formula-phase-error: rgba(251, 146, 60, 0.95);
    --aeon-cyan: #22d3ee;
    --aeon-orange: #fb923c;
    --aeon-purple: #c084fc;
    --mystic-noise-low: 0.14;
    --mystic-noise-high: 0.6;
    --fractal-font-title: "Space Grotesk", "Orbitron", "Aldrich", sans-serif;
    --fractal-font-body: "IBM Plex Sans", "Segoe UI", sans-serif;
    --fractal-font-mono: "JetBrains Mono", "IBM Plex Mono", "Fira Code", monospace;
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: hidden;
    font-family: var(--fractal-font-body);
  }

  .chat {
    display: flex;
    flex-direction: column;
    flex: 1;
    height: 100%;
    overflow: hidden;
    background: var(
      --fractal-bg,
      radial-gradient(circle at 10% 20%, rgba(15, 23, 42, 1) 0%, rgba(5, 5, 15, 1) 100%)
    );
    border-radius: var(--radius-lg);
    box-shadow: var(--fractal-shadow, inset 0 0 100px rgba(0, 0, 0, 0.5));
    position: relative;
    padding: 16px; /* Space around the floating cards */
    /* Remove base border to avoid red/gray conflicting lines */
    border: none;
    isolation: isolate;
  }

  /* Apply glowing animated gradient border via mask to chat container */
  .chat::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    padding: 1px;
    background: var(
      --chat-border-glow,
      linear-gradient(135deg, rgba(0, 240, 255, 0.5), rgba(139, 92, 246, 0.2), rgba(225, 29, 72, 0.4))
    );
    mask:
      linear-gradient(#fff 0 0) content-box,
      linear-gradient(#fff 0 0);
    -webkit-mask:
      linear-gradient(#fff 0 0) content-box,
      linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
    z-index: 10;
  }

  :host-context([data-theme="light"]) .chat {
    --chat-border-glow: linear-gradient(
      135deg,
      rgba(14, 165, 233, 0.5),
      rgba(168, 85, 247, 0.3),
      rgba(236, 72, 153, 0.3)
    );
    --fractal-bg: radial-gradient(
      circle at 10% 20%,
      #ffffff 0%,
      #f8fafc 50%,
      rgba(224, 231, 255, 0.6) 100%
    );
    --fractal-shadow: inset 0 0 60px rgba(255, 255, 255, 0.9);
  }

  /* Fractal background subtle noise/glow */
  .chat::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(
      --fractal-glow,
      radial-gradient(ellipse at 80% 80%, rgba(139, 92, 246, 0.05) 0%, transparent 50%),
      radial-gradient(ellipse at 20% 80%, rgba(59, 130, 246, 0.05) 0%, transparent 50%)
    );
    pointer-events: none;
    z-index: 0;
  }

  :host-context([data-theme="light"]) .chat::after {
    --fractal-glow:
      radial-gradient(ellipse at 80% 80%, rgba(14, 165, 233, 0.15) 0%, transparent 50%),
      radial-gradient(ellipse at 20% 80%, rgba(168, 85, 247, 0.15) 0%, transparent 50%);
  }

  .chat-split-container {
    display: flex;
    flex: 1;
    overflow: hidden;
    z-index: 1; /* keep above the background pseudo-element */
    gap: 12px; /* Spacer for resizer */
  }

  .chat-cosmos {
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
  }

  .chat-cosmos__grid,
  .chat-cosmos__edge-pulse,
  .chat-cosmos__recursive-web,
  .chat-cosmos__rings,
  .chat-cosmos__branchfield,
  .chat-cosmos__emergence,
  .chat-cosmos__lifelines,
  .chat-cosmos__formula-cloud {
    position: absolute;
    inset: 0;
    pointer-events: none;
    transition: none;
    will-change: auto;
  }

  .chat-cosmos__grid {
    background-image:
      linear-gradient(rgba(56, 189, 248, 0.08) 1px, transparent 1px),
      linear-gradient(90deg, rgba(56, 189, 248, 0.08) 1px, transparent 1px);
    background-size: 40px 40px;
    opacity: calc(0.2 + var(--fractal-resonance) * 0.2);
    mask-image: radial-gradient(circle at 55% 50%, black 45%, transparent 90%);
  }

  .chat-cosmos__recursive-web {
    opacity: 0.16;
    background-image:
      radial-gradient(circle at 50% 50%, rgba(125, 211, 252, 0.2) 0.6px, transparent 1.8px),
      radial-gradient(circle at 50% 50%, rgba(196, 181, 253, 0.16) 0.7px, transparent 2px);
    background-size:
      46px 46px,
      78px 78px;
    background-position:
      0 0,
      16px 12px;
    mask-image:
      radial-gradient(circle at 50% 50%, black 26%, transparent 82%),
      linear-gradient(180deg, transparent 6%, black 35%, black 65%, transparent 94%);
    animation: none;
  }

  .chat-cosmos__rings {
    background:
      radial-gradient(circle at 80% 20%, rgba(45, 212, 191, 0.08), transparent 44%),
      radial-gradient(circle at 20% 80%, rgba(129, 140, 248, 0.08), transparent 45%);
    animation: none;
  }

  .chat-cosmos__branchfield {
    opacity: 0.12;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='520' height='320' viewBox='0 0 520 320'%3E%3Cg fill='none' stroke='rgba(45,212,191,0.19)' stroke-width='1'%3E%3Cpath d='M20 278 C60 248 100 248 140 278 C180 308 220 308 260 278 C300 248 340 248 380 278 C420 308 460 308 500 278'/%3E%3Cpath d='M60 250 C90 220 120 220 150 250 C180 280 210 280 240 250 C270 220 300 220 330 250 C360 280 390 280 420 250'/%3E%3Cpath d='M110 222 C132 200 154 200 176 222 C198 244 220 244 242 222 C264 200 286 200 308 222 C330 244 352 244 374 222'/%3E%3C/g%3E%3Cg fill='none' stroke='rgba(129,140,248,0.17)' stroke-width='0.8'%3E%3Cpath d='M250 284 L250 240 L228 216 L210 198 L194 178'/%3E%3Cpath d='M250 240 L272 216 L290 198 L306 178'/%3E%3Cpath d='M228 216 L210 214 L194 208'/%3E%3Cpath d='M272 216 L290 214 L306 208'/%3E%3C/g%3E%3C/svg%3E");
    background-size: 760px 460px;
    background-position: 0 0;
    mask-image: radial-gradient(circle at 50% 62%, black 32%, transparent 88%);
    animation: none;
  }

  .chat-cosmos__emergence {
    opacity: 0.08;
    background:
      repeating-radial-gradient(
        circle at 50% 56%,
        rgba(125, 211, 252, 0.16) 0 1px,
        transparent 1px 22px
      ),
      repeating-radial-gradient(
        circle at 50% 56%,
        rgba(45, 212, 191, 0.1) 0 1px,
        transparent 1px 40px
      );
    mask-image: radial-gradient(circle at 50% 58%, black 30%, transparent 86%);
    transform-origin: 50% 56%;
    animation: none;
  }

  .chat-cosmos__lifelines {
    opacity: 0.1;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='620' height='360' viewBox='0 0 620 360'%3E%3Cg fill='none' stroke='rgba(103,232,249,0.2)' stroke-width='1'%3E%3Cpath d='M50 300 C115 252 168 252 230 300 C292 348 338 348 400 300 C462 252 515 252 570 300'/%3E%3Cpath d='M50 260 C115 212 168 212 230 260 C292 308 338 308 400 260 C462 212 515 212 570 260'/%3E%3Cpath d='M90 220 C146 182 194 182 244 220 C294 258 340 258 390 220 C440 182 488 182 542 220'/%3E%3C/g%3E%3Cg fill='none' stroke='rgba(196,181,253,0.19)' stroke-width='0.9'%3E%3Cpath d='M312 312 L312 268 L290 246 L272 224 L258 205'/%3E%3Cpath d='M312 268 L334 246 L352 224 L366 205'/%3E%3Cpath d='M290 246 L272 244 L258 236'/%3E%3Cpath d='M334 246 L352 244 L366 236'/%3E%3C/g%3E%3C/svg%3E");
    background-size: 840px 500px;
    background-position: 0 0;
    mask-image: radial-gradient(circle at 50% 64%, black 42%, transparent 90%);
    animation: none;
  }

  .chat-cosmos__formula-cloud {
    opacity: 0.09;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='160' viewBox='0 0 320 160'%3E%3Ctext x='20' y='40' fill='rgba(103,232,249,0.22)' font-size='14' font-family='monospace'%3EZ%E2%86%92Z%C2%B2%2BC%3C/text%3E%3Ctext x='78' y='84' fill='rgba(196,181,253,0.18)' font-size='12' font-family='monospace'%3ER(n%2B1)%3Df(R(n)%2Cintent%2Centropy)%3C/text%3E%3Ctext x='45' y='126' fill='rgba(251,191,36,0.16)' font-size='11' font-family='monospace'%3Eargmin(risk)%20%7C%20guardrail%3C/text%3E%3C/svg%3E");
    background-size: 560px 280px;
    animation: none;
  }

  .chat[data-performance-mode="performance"] .chat-cosmos,
  .chat[data-performance-mode="performance"]::after,
  .chat[data-performance-mode="performance"]::before {
    display: none;
  }

  .chat[data-performance-mode="balanced"] .chat-cosmos__grid {
    opacity: 0.12;
  }

  .chat[data-performance-mode="balanced"] .chat-cosmos__recursive-web,
  .chat[data-performance-mode="balanced"] .chat-cosmos__rings,
  .chat[data-performance-mode="balanced"] .chat-cosmos__branchfield,
  .chat[data-performance-mode="balanced"] .chat-cosmos__emergence,
  .chat[data-performance-mode="balanced"] .chat-cosmos__lifelines,
  .chat[data-performance-mode="balanced"] .chat-cosmos__formula-cloud,
  .chat[data-performance-mode="balanced"] .chat-cosmos__edge-pulse {
    opacity: 0.06;
    filter: none !important;
  }

  /* Stability mode: keep cosmos layers static to avoid visible flicker on long sessions. */
  .chat-cosmos__edge-pulse,
  .chat-cosmos__recursive-web,
  .chat-cosmos__rings,
  .chat-cosmos__branchfield,
  .chat-cosmos__emergence,
  .chat-cosmos__lifelines,
  .chat-cosmos__formula-cloud {
    animation: none !important;
    transition: none !important;
    filter: none !important;
  }

  @keyframes recursiveWebShift {
    0% {
      background-position:
        0 0,
        16px 12px;
      transform: scale(1);
    }
    50% {
      background-position:
        26px -18px,
        -12px 30px;
      transform: scale(1.015);
    }
    100% {
      background-position:
        52px -36px,
        -40px 48px;
      transform: scale(1);
    }
  }

  @keyframes fractalRingDrift {
    0% {
      transform: translate3d(0, 0, 0) scale(1);
    }
    50% {
      transform: translate3d(-1%, 1%, 0) scale(1.03);
    }
    100% {
      transform: translate3d(0, 0, 0) scale(1);
    }
  }

  @keyframes formulaCloudShift {
    0% {
      background-position: 0 0;
    }
    100% {
      background-position: 560px -280px;
    }
  }

  @keyframes edgePulseFlow {
    0% {
      transform: rotate(0deg) scale(1);
      opacity: 0.26;
    }
    50% {
      transform: rotate(180deg) scale(1.008);
      opacity: 0.4;
    }
    100% {
      transform: rotate(360deg) scale(1);
      opacity: 0.26;
    }
  }

  @keyframes branchFieldDrift {
    0% {
      background-position: 0 0;
      transform: translate3d(0, 0, 0) scale(1);
    }
    50% {
      background-position: 180px -90px;
      transform: translate3d(-1.2%, 0.8%, 0) scale(1.018);
    }
    100% {
      background-position: 360px -180px;
      transform: translate3d(0, 0, 0) scale(1);
    }
  }

  @keyframes emergenceBloom {
    0% {
      transform: scale(1) rotate(0deg);
      filter: saturate(1);
    }
    50% {
      transform: scale(1.04) rotate(180deg);
      filter: saturate(1.25);
    }
    100% {
      transform: scale(1) rotate(360deg);
      filter: saturate(1);
    }
  }

  @keyframes lifeLinesFlow {
    0% {
      background-position: 0 0;
      transform: translate3d(0, 0, 0);
    }
    50% {
      background-position: 210px -100px;
      transform: translate3d(-1.2%, 0.7%, 0);
    }
    100% {
      background-position: 420px -200px;
      transform: translate3d(0, 0, 0);
    }
  }

  .chat-main {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    position: relative;

    /* Floating Glass Card */
    background: var(--glass-bg, rgba(15, 23, 42, 0.6));
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid var(--glass-border, rgba(139, 92, 246, 0.2));
    border-radius: 16px;
    box-shadow: 0 8px 32px var(--glass-shadow, rgba(0, 0, 0, 0.4));
    overflow: hidden;
  }

  .chat-main--with-formula::after {
    content: "";
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(340px, 38%);
    pointer-events: none;
    border-left: 1px solid rgba(56, 189, 248, 0.16);
    background:
      linear-gradient(180deg, rgba(2, 6, 23, 0.4) 0%, rgba(2, 6, 23, 0.25) 100%),
      radial-gradient(circle at 50% 16%, rgba(14, 165, 233, 0.12), transparent 52%),
      radial-gradient(circle at 50% 78%, rgba(45, 212, 191, 0.1), transparent 58%);
    z-index: 1;
  }

  .chat-main--with-formula .chat-thread,
  .chat-main--with-formula .chat-main-status,
  .chat-main--with-formula .chat-input-wrapper {
    padding-right: min(360px, 40%);
  }

  :host-context([data-theme="light"]) .chat-main {
    --glass-bg: rgba(255, 255, 255, 0.5);
    --glass-border: rgba(99, 102, 241, 0.2);
    --glass-shadow: 0 8px 32px rgba(99, 102, 241, 0.05), inset 0 0 40px rgba(255, 255, 255, 0.6);
  }

  .chat-thread {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    scroll-behavior: smooth;
    position: relative;
    z-index: 2;
  }

  .chat-thread--empty {
    padding: 16px 24px 12px;
    display: flex;
  }

  .chat-thread--empty .chat-empty-state {
    flex: 1;
    min-height: clamp(460px, 62vh, 760px);
  }

  .chat-main-status {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: 12px 12px 0;
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid rgba(45, 212, 191, 0.24);
    background: linear-gradient(90deg, rgba(45, 212, 191, 0.12), rgba(59, 130, 246, 0.08));
    position: relative;
    z-index: 3;
  }

  .chat-main-status__left {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    min-width: 0;
  }

  .chat-main-status__badge {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: #2dd4bf;
    font-family: var(--fractal-font-title);
  }

  .chat-main-status__item {
    font-size: 11px;
    color: var(--muted-color, #94a3b8);
    white-space: nowrap;
  }

  .chat-main-status__item--button {
    background: transparent;
    border: 1px solid transparent;
    border-radius: 7px;
    padding: 2px 6px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .chat-main-status__item--button:hover {
    border-color: rgba(45, 212, 191, 0.35);
    color: #d7fcf5;
    background: rgba(45, 212, 191, 0.12);
  }

  .chat-main-status__actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .chat-main-status__btn {
    font-size: 11px;
    border: 1px solid var(--border-color);
    background: transparent;
    color: var(--text-color);
    border-radius: 6px;
    padding: 4px 8px;
    cursor: pointer;
  }

  .chat-main-status__btn:hover {
    background: var(--surface-2);
  }

  .callout {
    padding: 12px 16px;
    border-radius: 6px;
    background: var(--surface-2);
    border-left: 4px solid var(--primary-color);
    margin: 16px;
    font-size: 14px;
  }

  .callout.danger {
    border-left-color: var(--danger-color);
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger-color);
  }

  .chat-focus-exit {
    position: absolute;
    top: 16px;
    right: 16px;
    z-index: 10;
    background: var(--surface-2);
    border: 1px solid var(--border-color);
    border-radius: 50%;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--text-color);
    opacity: 0.7;
    transition: all 0.2s;
  }

  .chat-focus-exit:hover {
    opacity: 1;
    background: var(--surface-3);
  }

  .chat-input-wrapper {
    padding: 0 24px 8px;
    background: transparent;
    position: relative;
    z-index: 10;
  }

  .chat-tagline {
    text-align: center;
    font-size: 12px;
    color: var(--muted-color, #94a3b8);
    padding: 8px 0 16px;
    letter-spacing: 0.01em;
    font-family: var(--fractal-font-title);
  }

  .chat-utility-rail {
    position: absolute;
    right: 18px;
    top: 96px;
    width: min(440px, 46%);
    bottom: 12px;
    z-index: 4;
    display: flex;
    flex-direction: column;
    gap: 12px;
    pointer-events: none;
    align-items: stretch;
  }

  /* HUD-Specific Styles (Moved to hud.ts) */
  \${hudStyles}

  .chat[data-fractal-depth="3"] .chat-main,
  .chat[data-fractal-depth="4"] .chat-main {
    box-shadow:
      0 14px 42px rgba(2, 132, 199, 0.25),
      0 0 0 1px rgba(56, 189, 248, 0.16);
  }

  .chat[data-fractal-depth="3"] .chat-cosmos__recursive-web,
  .chat[data-fractal-depth="4"] .chat-cosmos__recursive-web {
    opacity: 0.18;
  }

  .chat[data-fractal-depth="3"] .chat-cosmos__edge-pulse,
  .chat[data-fractal-depth="4"] .chat-cosmos__edge-pulse {
    opacity: 0.2;
  }

  .chat[data-fractal-depth="4"] .chat-cosmos__branchfield {
    opacity: 0.16;
  }

  .chat[data-fractal-depth="4"] .chat-cosmos__emergence {
    opacity: 0.12;
  }

  .chat[data-fractal-depth="3"] .chat-cosmos__lifelines,
  .chat[data-fractal-depth="4"] .chat-cosmos__lifelines {
    opacity: 0.11;
  }

  .chat[data-delivery-band="warn"] .chat-main-status {
    border-color: rgba(251, 146, 60, 0.38);
    background: linear-gradient(90deg, rgba(251, 146, 60, 0.16), rgba(59, 130, 246, 0.08));
  }

  .chat[data-formula-phase="active"] .formula-rail {
    box-shadow:
      0 12px 36px rgba(2, 6, 23, 0.7),
      0 0 20px rgba(45, 212, 191, 0.18);
  }

  /* Consciousness Stream HUD (Moved to hud.ts) */
  .consciousness-content--placeholder {
    color: rgba(148, 163, 184, 0.88);
    font-style: italic;
  }

  @media (hover: hover) {
    .consciousness-entry:hover .consciousness-content {
      -webkit-line-clamp: initial;
    }
  }

  .consciousness-focus,
  .consciousness-pivot {
    margin-top: 5px;
    font-size: 0.68rem;
    font-family: var(--fractal-font-mono);
    padding: 3px 7px;
    border-radius: 2px;
    background: rgba(0, 0, 0, 0.35);
  }

  .consciousness-focus {
    color: var(--aeon-cyan);
  }

  .consciousness-pivot {
    color: var(--aeon-orange);
  }

  .consciousness-collapsed {
    border-top: 1px solid rgba(0, 242, 255, 0.15);
    padding-top: 8px;
  }

  .consciousness-collapsed summary {
    cursor: pointer;
    color: rgba(0, 242, 255, 0.85);
    font-size: 0.7rem;
  }

  .consciousness-collapsed__body {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .reflection {
    border-left-color: var(--aeon-cyan);
  }

  .synthesis {
    border-left-color: var(--aeon-orange);
  }

  .deliberation {
    border-left-color: var(--aeon-purple);
  }

  .anomaly {
    border-left-color: #ff4444;
    background: rgba(255, 0, 0, 0.05);
  }

  .dreaming {
    border-left-color: #888;
    font-style: italic;
  }

  .consciousness-stream-body::-webkit-scrollbar {
    width: 4px;
  }

  .consciousness-stream-body::-webkit-scrollbar-thumb {
    background: rgba(0, 242, 255, 0.2);
    border-radius: 2px;
  }

  .chat[data-formula-phase="active"] .chat-cosmos__recursive-web {
    opacity: 0.16;
  }

  .chat[data-formula-phase="active"] .chat-cosmos__edge-pulse {
    opacity: 0.18;
  }

  .chat[data-formula-phase="active"] .chat-cosmos__emergence {
    opacity: 0.08;
  }

  .chat[data-formula-phase="error"] .chat-cosmos__branchfield {
    opacity: 0.12;
  }

  .chat[data-formula-phase="error"] .chat-cosmos__lifelines {
    opacity: 0.1;
  }

  .chat[data-formula-phase="error"] .chat-cosmos__edge-pulse {
    opacity: 0.12;
  }

  /* ---- Message Animations ---- */
  .chat-bubble--anim-enter {
    animation: messagePop 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    opacity: 0;
    transform-origin: bottom left;
  }
  @keyframes messagePop {
    0% {
      opacity: 0;
      transform: translateY(12px) scale(0.98);
    }
    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @media (max-width: 1260px) {
    .chat-main--with-formula::after {
      display: none;
    }

    .chat-main--with-formula .chat-thread,
    .chat-main--with-formula .chat-main-status,
    .chat-main--with-formula .chat-input-wrapper {
      padding-right: 24px;
    }
    .chat-utility-rail {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .chat-cosmos__edge-pulse,
    .chat-cosmos__recursive-web,
    .chat-cosmos__rings,
    .chat-cosmos__branchfield,
    .chat-cosmos__emergence,
    .chat-cosmos__lifelines,
    .chat-cosmos__formula-cloud {
      animation: none !important;
    }
  }
`;
