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
  }

  .fractal-core {
    position: relative;
    width: 140px;
    height: 140px;
    margin-bottom: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    filter: drop-shadow(0 0 30px rgba(99, 102, 241, 0.4));
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
    color: var(--muted-color, #94a3b8);
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
    background: rgba(139, 92, 246, 0.05);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(139, 92, 246, 0.1);
    border-radius: 20px;
    color: rgba(255, 255, 255, 0.5);
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    letter-spacing: 0.1em;
    position: relative;
    overflow: hidden;
    white-space: nowrap;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
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
    color: rgba(255, 255, 255, 0.2);
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
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    color: rgba(255, 255, 255, 0.4);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  :host-context([data-theme="light"]) .sensory-node {
    background: rgba(139, 92, 246, 0.1);
    border-color: rgba(99, 102, 241, 0.4);
    color: #475569;
    box-shadow: 0 4px 15px rgba(99, 102, 241, 0.1);
  }

  :host-context([data-theme="light"]) .sensory-node-icon {
    color: #4f46e5;
  }

  :host-context([data-theme="light"]) .example-pill {
    background: rgba(0, 0, 0, 0.05);
    border-color: rgba(0, 0, 0, 0.1);
    color: #64748b;
  }

  :host-context([data-theme="light"]) .example-pill:hover {
    background: rgba(139, 92, 246, 0.15);
    border-color: #7c3aed;
    color: #4c1d95;
  }

  :host-context([data-theme="light"]) .chat-usage-examples label {
    color: rgba(0, 0, 0, 0.4);
  }
`;
