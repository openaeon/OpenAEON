import { html } from "lit";

export const miscStyles = html`
  <style>
    /* ─── Recruit Agent Modal ─── */
    .sandbox-recruit-modal {
      position: fixed;
      inset: 0;
      z-index: 2000;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(8px);
      animation: sandbox-fade-in 0.3s ease;
    }
    @keyframes sandbox-fade-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    .sandbox-recruit-content {
      width: 800px;
      max-width: 90vw;
      height: 600px;
      background: #1e293b;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: sandbox-scale-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes sandbox-scale-up {
      from {
        transform: scale(0.9) translateY(20px);
        opacity: 0;
      }
      to {
        transform: scale(1) translateY(0);
        opacity: 1;
      }
    }

    .sandbox-recruit-header {
      padding: 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .sandbox-recruit-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: #f8fafc;
    }
    .sandbox-recruit-close {
      cursor: pointer;
      color: #94a3b8;
      font-size: 1.5rem;
      border: none;
      background: none;
    }

    .sandbox-recruit-tabs {
      display: flex;
      gap: 24px;
      padding: 0 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .sandbox-recruit-tab {
      padding: 16px 0;
      border-bottom: 2px solid transparent;
      color: #94a3b8;
      font-weight: 600;
      cursor: pointer;
    }
    .sandbox-recruit-tab--active {
      color: #8b5cf6;
      border-color: #8b5cf6;
    }

    .sandbox-recruit-grid {
      flex: 1;
      padding: 24px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      overflow-y: auto;
    }
    .recruit-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .recruit-card:hover {
      background: rgba(255, 255, 255, 0.06);
      border-color: #8b5cf660;
      transform: translateY(-4px);
    }
    .recruit-card__preview {
      height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 10px;
      pointer-events: none;
    }
    .recruit-card__name {
      font-weight: 700;
      color: #f8fafc;
      font-size: 1.1rem;
    }
    .recruit-card__role {
      font-size: 0.8rem;
      color: #94a3b8;
    }
    .recruit-card__btn {
      margin-top: auto;
      width: 100%;
    }

    .sandbox-wrap .stat-chip--recruit {
      cursor: pointer;
      transition: all 0.2s ease;
      background: rgba(168, 85, 247, 0.1);
      border: 1px solid rgba(168, 85, 247, 0.3);
    }
    .sandbox-wrap .stat-chip--recruit:hover {
      background: rgba(168, 85, 247, 0.2);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(168, 85, 247, 0.2);
    }

    /* ─── Nexus Tribe Resonance ─── */
    .tribe-resonance-overlay {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 5;
      background: radial-gradient(circle at center, var(--nexus-secondary) 0%, transparent 70%);
      mix-blend-mode: screen;
      transition: opacity 2s ease-in-out;
    }

    .tribe-log-entry {
      animation: nexus-slide-in 0.4s ease-out;
      position: relative;
      overflow: hidden;
    }
    .tribe-log-entry::after {
      content: "";
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 4px;
      background: var(--nexus-secondary);
      box-shadow: 0 0 10px var(--nexus-secondary);
      animation: nexus-pulse 2s infinite;
    }

    @keyframes nexus-slide-in {
      from {
        transform: translateX(50px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    @keyframes nexus-pulse {
      0%,
      100% {
        opacity: 0.5;
      }
      50% {
        opacity: 1;
      }
    }

    /* Phase 9: Singularity CSS */
    .singularity-event-horizon {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 200px;
      height: 200px;
      margin-top: -100px;
      margin-left: -100px;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      z-index: 1;
      transition: transform 2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .singularity-core {
      width: 40px;
      height: 40px;
      background: radial-gradient(circle, #fff 0%, #22d3ee 40%, #000 100%);
      border-radius: 50%;
      box-shadow:
        0 0 50px #22d3ee,
        0 0 100px rgba(34, 211, 238, 0.4);
      animation: singularity-pulse 4s ease-in-out infinite;
    }

    @keyframes singularity-pulse {
      0%,
      100% {
        transform: scale(1);
        opacity: 0.8;
        box-shadow: 0 0 50px #22d3ee;
      }
      50% {
        transform: scale(1.2);
        opacity: 1;
        box-shadow:
          0 0 80px #22d3ee,
          0 0 150px rgba(34, 211, 238, 0.6);
      }
    }

    .singularity-rings .ring {
      position: absolute;
      top: 50%;
      left: 50%;
      border: 1px solid rgba(34, 211, 238, 0.3);
      border-radius: 50%;
      transform: translate(-50%, -50%);
    }

    .ring--1 {
      width: 100px;
      height: 100px;
      animation: singularity-spin 10s linear infinite;
    }
    .ring--2 {
      width: 160px;
      height: 160px;
      animation: singularity-spin 15s linear reverse infinite;
      border-style: dashed !important;
    }

    @keyframes singularity-spin {
      from {
        transform: translate(-50%, -50%) rotate(0deg);
      }
      to {
        transform: translate(-50%, -50%) rotate(360deg);
      }
    }

    /* Self-Repair Glitch Effect */
    @keyframes self-repair-glitch {
      0% {
        clip: rect(44px, 450px, 56px, 0);
        transform: skew(0.5deg);
      }
      5% {
        clip: rect(2px, 450px, 12px, 0);
        transform: skew(0.8deg);
      }
      10% {
        clip: rect(0, 0, 0, 0);
      }
      15% {
        clip: rect(67px, 450px, 92px, 0);
        transform: skew(0.2deg);
      }
      20% {
        clip: rect(0, 0, 0, 0);
      }
    }
    .self-repairing {
      animation: self-repair-glitch 2s infinite linear alternate-reverse;
      position: relative;
    }
    .self-repairing::before {
      content: attr(data-text);
      position: absolute;
      left: -2px;
      text-shadow: 2px 0 var(--nexus-secondary);
      top: 0;
      color: white;
      background: transparent;
      overflow: hidden;
      clip: rect(0, 900px, 0, 0);
      animation: self-repair-glitch 3s infinite linear alternate-reverse;
    }
    /* ─── Stability Heatmap Overlay ─── */
    .sandbox-wrap .kingdom-scene--unstable {
      filter: drop-shadow(0 0 40px rgba(244, 63, 94, 0.2));
      transition: filter 2s ease-in-out;
    }

    .sandbox-wrap .kingdom-scene--unstable .kingdom-grid {
      border-color: rgba(244, 63, 94, 0.1);
      background-image: radial-gradient(
        circle at 50% 50%,
        rgba(244, 63, 94, 0.05) 0%,
        transparent 70%
      );
    }

    /* ─── HUD Micro-Animations ─── */
    @keyframes nexus-hud-pulse {
      0%,
      100% {
        transform: scale(1);
        opacity: 1;
      }
      50% {
        transform: scale(1.02);
        opacity: 0.8;
      }
    }
    .resonance-fill {
      animation: nexus-hud-pulse 2s ease-in-out infinite;
    }
  </style>
`;
