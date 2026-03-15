import { css } from "lit";

export const chatLayoutStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: hidden;
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
  .chat::before {
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

  :host-context([data-theme="light"]) .chat::before {
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
`;
