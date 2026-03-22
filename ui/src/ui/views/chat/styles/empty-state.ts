import { css } from "lit";

export const chatEmptyStateStyles = css`
  /* ---- Fractal Empty state (Z⇋Z²+C Theme) ---- */
  .chat-empty-state.fractal-nexus {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    flex: 1;
    padding: 60px 24px 24px;
    min-height: 400px;
    position: relative;
    overflow: hidden;
    border-radius: 14px;
    border: 1px solid rgba(45, 212, 191, 0.18);
    background:
      radial-gradient(130% 85% at 50% 0%, rgba(56, 189, 248, 0.12), transparent 68%),
      radial-gradient(90% 80% at 0% 100%, rgba(129, 140, 248, 0.16), transparent 64%),
      radial-gradient(90% 80% at 100% 100%, rgba(34, 211, 238, 0.1), transparent 62%),
      rgba(5, 14, 33, 0.7);
    box-shadow:
      inset 0 0 0 1px rgba(56, 189, 248, 0.08),
      inset 0 20px 60px rgba(2, 6, 23, 0.55),
      0 20px 44px rgba(2, 6, 23, 0.42);
  }

  .chat-empty-state > * {
    position: relative;
    z-index: 2;
  }

  .chat-empty-field {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    overflow: hidden;
  }

  .chat-empty-field__grid,
  .chat-empty-field__rings,
  .chat-empty-field__formula,
  .chat-empty-field__noise {
    position: absolute;
    inset: 0;
  }

  .chat-empty-field__grid {
    background-image:
      linear-gradient(rgba(45, 212, 191, 0.1) 1px, transparent 1px),
      linear-gradient(90deg, rgba(45, 212, 191, 0.1) 1px, transparent 1px);
    background-size: 36px 36px;
    opacity: 0.26;
    mask-image: radial-gradient(circle at 50% 44%, black 42%, transparent 92%);
    animation: emptyGridBreath 10s ease-in-out infinite;
  }

  .chat-empty-field__rings {
    background:
      radial-gradient(circle at 50% 30%, rgba(196, 181, 253, 0.26), transparent 42%),
      radial-gradient(circle at 26% 70%, rgba(56, 189, 248, 0.2), transparent 38%),
      radial-gradient(circle at 76% 72%, rgba(45, 212, 191, 0.16), transparent 40%);
    opacity: 0.8;
    animation: emptyRingDrift 16s ease-in-out infinite;
  }

  .chat-empty-field__formula {
    opacity: 0.35;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='520' height='240' viewBox='0 0 520 240'%3E%3Ctext x='24' y='42' fill='rgba(103,232,249,0.32)' font-size='15' font-family='monospace'%3EZ%E2%86%92Z%C2%B2%2BC%3C/text%3E%3Ctext x='80' y='100' fill='rgba(196,181,253,0.24)' font-size='13' font-family='monospace'%3ER(n%2B1)%3Df(R(n)%2Cintent%2Centropy)%3C/text%3E%3Ctext x='36' y='152' fill='rgba(45,212,191,0.22)' font-size='12' font-family='monospace'%3E%E2%88%87%20stability%20-%20%CE%BB%C2%B7risk%20%2B%20novelty%3C/text%3E%3Ctext x='200' y='204' fill='rgba(251,191,36,0.2)' font-size='11' font-family='monospace'%3Eargmin%28drift%29%20%7C%20guardrail%3C/text%3E%3C/svg%3E");
    background-size: 740px 320px;
    animation: emptyFormulaShift 24s linear infinite;
  }

  .chat-empty-field__noise {
    opacity: 0.24;
    background-image:
      radial-gradient(circle at 15% 26%, rgba(255, 255, 255, 0.12) 0.5px, transparent 1.6px),
      radial-gradient(circle at 68% 42%, rgba(56, 189, 248, 0.14) 0.6px, transparent 1.8px),
      radial-gradient(circle at 44% 78%, rgba(167, 139, 250, 0.14) 0.7px, transparent 2px);
    background-size:
      180px 180px,
      220px 220px,
      240px 240px;
    animation: emptyNoiseFloat 30s linear infinite;
  }

  @keyframes emptyGridBreath {
    0%,
    100% {
      transform: scale(1);
      opacity: 0.22;
    }
    50% {
      transform: scale(1.02);
      opacity: 0.34;
    }
  }

  @keyframes emptyRingDrift {
    0%,
    100% {
      transform: translate3d(0, 0, 0) scale(1);
    }
    50% {
      transform: translate3d(-1.2%, 1.5%, 0) scale(1.03);
    }
  }

  @keyframes emptyFormulaShift {
    0% {
      background-position: 0 0;
    }
    100% {
      background-position: 740px -320px;
    }
  }

  @keyframes emptyNoiseFloat {
    0% {
      background-position:
        0 0,
        0 0,
        0 0;
    }
    100% {
      background-position:
        -140px 110px,
        120px -90px,
        -90px 130px;
    }
  }

  .fractal-core {
    position: relative;
    width: 140px;
    height: 140px;
    margin-bottom: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    filter: drop-shadow(0 0 36px rgba(99, 102, 241, 0.52));
  }

  .fractal-core::before,
  .fractal-core::after {
    content: "";
    position: absolute;
    inset: -24%;
    border-radius: 50%;
    pointer-events: none;
  }

  .fractal-core::before {
    border: 1px dashed rgba(125, 211, 252, 0.26);
    animation: coreEchoOrbit 14s linear infinite;
  }

  .fractal-core::after {
    background:
      radial-gradient(circle, rgba(196, 181, 253, 0.18) 0 1px, transparent 1px 100%),
      radial-gradient(circle, rgba(45, 212, 191, 0.14) 0 1px, transparent 1px 100%);
    background-size:
      22px 22px,
      34px 34px;
    mask-image: radial-gradient(circle, black 26%, transparent 72%);
    opacity: 0.55;
    animation: coreSeedDrift 18s linear infinite;
  }

  .fractal-ring {
    position: absolute;
    border-radius: 50%;
    border: 1px solid rgba(139, 92, 246, 0.3);
    box-shadow: 0 0 15px inset rgba(99, 102, 241, 0.1);
  }

  .fractal-ring--1 {
    width: 100%;
    height: 100%;
    border-top-color: #c084fc;
    border-bottom-color: #818cf8;
    animation: spinFractal 8s linear infinite;
  }

  .fractal-ring--2 {
    width: 75%;
    height: 75%;
    border-left-color: #2dd4bf;
    border-right-color: #3b82f6;
    animation: spinFractal 12s linear infinite reverse;
  }

  .fractal-ring--3 {
    width: 50%;
    height: 50%;
    border-top-color: #f472b6;
    border-bottom-color: #c084fc;
    animation: spinFractal 5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }

  .fractal-core-eye {
    width: 16px;
    height: 16px;
    background: #ffffff;
    border-radius: 50%;
    box-shadow:
      0 0 20px 4px #c084fc,
      0 0 40px 8px #818cf8;
    animation: pulseEye 3s ease-in-out infinite alternate;
  }

  @keyframes spinFractal {
    100% {
      transform: rotate(360deg);
    }
  }

  @keyframes pulseEye {
    0% {
      transform: scale(0.9);
      opacity: 0.8;
    }
    100% {
      transform: scale(1.2);
      opacity: 1;
      box-shadow:
        0 0 30px 8px #c084fc,
        0 0 60px 12px #818cf8;
    }
  }

  @keyframes coreEchoOrbit {
    0% {
      transform: rotate(0deg) scale(1);
      opacity: 0.45;
    }
    50% {
      transform: rotate(180deg) scale(1.07);
      opacity: 0.72;
    }
    100% {
      transform: rotate(360deg) scale(1);
      opacity: 0.45;
    }
  }

  @keyframes coreSeedDrift {
    0% {
      background-position:
        0 0,
        0 0;
      transform: scale(1);
    }
    100% {
      background-position:
        88px -66px,
        -54px 92px;
      transform: scale(1.08);
    }
  }

  .aeon-text {
    font-family: var(--font-mono, monospace);
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 0.25em;
    color: var(--text-color, #f8fafc);
    margin: 0 0 16px 0;
    text-transform: uppercase;
    background: var(--text-gradient, linear-gradient(135deg, #c084fc 0%, #3b82f6 50%, #2dd4bf 100%));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    text-shadow: var(--text-glow, 0 0 20px rgba(139, 92, 246, 0.4));
  }

  :host-context([data-theme="light"]) .aeon-text {
    --text-gradient: linear-gradient(135deg, #7c3aed 0%, #2563eb 50%, #0d9488 100%);
    --text-glow: 0 0 20px rgba(139, 92, 246, 0.15);
  }

  .chat-empty-subtitle {
    font-family: var(--font-sans, sans-serif);
    font-size: 14px;
    color: var(--muted-color, #b4c4db);
    margin: 0 0 48px 0;
    max-width: 500px;
    line-height: 1.6;
    letter-spacing: 0.05em;
  }

  .chat-empty-actions {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    max-width: 480px;
    z-index: 2;
  }

  .chat-sensory-nodes {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    width: 100%;
    max-width: 600px;
    justify-content: center;
    margin-top: 24px;
    z-index: 2;
  }

  .sensory-node {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 18px;
    background: rgba(139, 92, 246, 0.1);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(139, 92, 246, 0.2);
    border-radius: 20px;
    color: rgba(255, 255, 255, 0.72);
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    letter-spacing: 0.1em;
    position: relative;
    overflow: hidden;
    white-space: nowrap;
    box-shadow: 0 8px 20px rgba(2, 6, 23, 0.22);
  }

  .sensory-node::after {
    content: "";
    position: absolute;
    top: 0;
    left: -100%;
    width: 40px;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.15), transparent);
    animation: nexus-scan 4s infinite linear;
  }

  .sensory-node-icon {
    font-size: 14px;
    color: var(--nexus-secondary, #22d3ee);
    opacity: 0.8;
  }

  @keyframes nexus-scan {
    0% {
      left: -100%;
    }
    100% {
      left: 200%;
    }
  }

  .chat-usage-examples {
    margin-top: 48px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    width: 100%;
    z-index: 2;
  }

  .chat-usage-examples label {
    font-size: 10px;
    font-weight: 800;
    color: rgba(255, 255, 255, 0.42);
    letter-spacing: 0.3em;
    text-transform: uppercase;
  }

  .example-pill-cloud {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: center;
    max-width: 500px;
  }

  .example-pill {
    padding: 8px 16px;
    background: rgba(56, 189, 248, 0.08);
    border: 1px solid rgba(125, 211, 252, 0.22);
    border-radius: 12px;
    color: rgba(227, 241, 255, 0.86);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.25s ease;
  }

  .example-pill:hover {
    border-color: rgba(45, 212, 191, 0.6);
    background: rgba(45, 212, 191, 0.14);
    transform: translateY(-1px);
  }

  :host-context([data-theme="light"]) .chat-empty-state.fractal-nexus {
    background:
      radial-gradient(120% 70% at 50% 0%, rgba(99, 102, 241, 0.14), transparent 60%),
      radial-gradient(80% 60% at 0% 100%, rgba(14, 165, 233, 0.12), transparent 60%),
      radial-gradient(80% 60% at 100% 90%, rgba(45, 212, 191, 0.10), transparent 55%),
      rgba(255, 255, 255, 0.82);
    border-color: rgba(99, 102, 241, 0.22);
    box-shadow:
      inset 0 0 0 1px rgba(99, 102, 241, 0.1),
      inset 0 -20px 60px rgba(240, 242, 255, 0.6),
      0 16px 36px rgba(99, 102, 241, 0.08);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }

  @media (prefers-reduced-motion: reduce) {
    .fractal-core::before,
    .fractal-core::after,
    .fractal-ring--1,
    .fractal-ring--2,
    .fractal-ring--3,
    .fractal-core-eye,
    .chat-empty-field__grid,
    .chat-empty-field__rings,
    .chat-empty-field__formula,
    .chat-empty-field__noise,
    .sensory-node::after {
      animation: none !important;
    }
  }

  :host-context([data-theme="light"]) .sensory-node {
    background: rgba(99, 102, 241, 0.07);
    border-color: rgba(99, 102, 241, 0.28);
    color: #3730a3;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.08);
  }

  :host-context([data-theme="light"]) .sensory-node-icon {
    color: #4f46e5;
  }

  :host-context([data-theme="light"]) .example-pill {
    background: rgba(99, 102, 241, 0.06);
    border-color: rgba(99, 102, 241, 0.22);
    color: #4338ca;
  }

  :host-context([data-theme="light"]) .example-pill:hover {
    background: rgba(99, 102, 241, 0.14);
    border-color: rgba(99, 102, 241, 0.5);
    color: #3730a3;
    transform: translateY(-1px);
  }

  :host-context([data-theme="light"]) .chat-usage-examples label {
    color: rgba(71, 85, 105, 0.65);
  }

  :host-context([data-theme="light"]) .chat-empty-subtitle {
    color: #64748b;
  }
`;
