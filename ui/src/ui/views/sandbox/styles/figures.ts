import { html } from "lit";

export const figureStyles = html`
  <style>
    /* ─── FIGURES ─── */
    .sandbox-wrap .figure {
      position: relative;
      transform-style: preserve-3d;
      animation: sandbox-bob 3.5s ease-in-out infinite;
      transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      filter: drop-shadow(0 0 8px rgba(34, 211, 238, 0.2));
    }

    /* Nexus Holographic Effect */
    .sandbox-wrap .figure::after {
      content: "";
      position: absolute;
      inset: -15% -25%;
      background: linear-gradient(transparent 0%, rgba(34, 211, 238, 0.15) 50%, transparent 100%);
      background-size: 100% 3px;
      animation: nexus-hologram-scan 3s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      pointer-events: none;
      opacity: 0.5;
      z-index: 50;
      mix-blend-mode: overlay;
    }

    .sandbox-wrap .figure::before {
      content: "";
      position: absolute;
      top: 50%;
      left: 50%;
      width: 12px;
      height: 12px;
      background: var(--nexus-secondary);
      border-radius: 50%;
      transform: translate(-50%, -50%);
      filter: blur(8px);
      box-shadow: 0 0 20px var(--nexus-secondary);
      opacity: 0.6;
      animation: nexus-core-pulse 2s ease-in-out infinite;
    }

    @keyframes nexus-core-pulse {
      0%,
      100% {
        opacity: 0.4;
        transform: translate(-50%, -50%) scale(1);
      }
      50% {
        opacity: 0.8;
        transform: translate(-50%, -50%) scale(1.5);
      }
    }

    .sandbox-wrap .figure:hover {
      filter: drop-shadow(0 0 20px var(--nexus-secondary)) brightness(1.3);
      transform: scale(1.1) rotateY(10deg);
    }

    /* Tribal Resonance Effects */
    @keyframes tribe-resonant-pulse {
      0%,
      100% {
        filter: drop-shadow(0 0 10px var(--nexus-secondary));
        transform: translateY(0);
      }
      50% {
        filter: drop-shadow(0 0 35px var(--nexus-secondary));
        transform: translateY(-8px) scale(1.05);
      }
    }
    .figure--resonant {
      animation: tribe-resonant-pulse 2.5s ease-in-out infinite !important;
    }

    .figure--elder-aura {
      box-shadow: 0 0 30px rgba(251, 191, 36, 0.3);
      filter: drop-shadow(0 0 10px #fbbf24);
    }

    @keyframes sandbox-pickaxe-swing {
      0%,
      100% {
        transform: rotate(-30deg) translateY(0);
      }
      50% {
        transform: rotate(60deg) translateY(10px);
      }
    }
    .sandbox-wrap .figure__pickaxe {
      position: absolute;
      top: 30px;
      right: -10px;
      width: 8px;
      height: 60px;
      background: linear-gradient(180deg, #9ca3af 0%, #4b5563 100%);
      border-radius: 4px;
      transform-origin: top center;
      z-index: 10;
      pointer-events: none;
    }
    .sandbox-wrap .figure__pickaxe::before {
      content: "";
      position: absolute;
      top: -6px;
      left: -15px;
      width: 38px;
      height: 16px;
      background: linear-gradient(90deg, #cbd5e1 0%, #64748b 100%);
      border-radius: 4px;
    }
    .sandbox-wrap .figure--mining .figure__pickaxe {
      animation: sandbox-pickaxe-swing 0.8s ease-in-out infinite;
    }

    @keyframes sandbox-steam {
      0% {
        opacity: 0;
        transform: translateY(0) scale(0.8);
      }
      50% {
        opacity: 0.8;
      }
      100% {
        opacity: 0;
        transform: translateY(-25px) scale(1.2);
      }
    }
    .sandbox-wrap .figure__cup {
      position: absolute;
      bottom: 20px;
      right: -12px;
      width: 18px;
      height: 20px;
      background: #fcd34d;
      border-radius: 3px 3px 8px 8px;
      z-index: 10;
      box-shadow: inset -3px -3px 6px rgba(217, 119, 6, 0.4);
      pointer-events: none;
    }
    .sandbox-wrap .figure__cup::before {
      content: "";
      position: absolute;
      top: 2px;
      right: -6px;
      width: 8px;
      height: 12px;
      border: 3px solid #fcd34d;
      border-radius: 0 6px 6px 0;
    }
    .sandbox-wrap .figure--coffee .figure__cup::after {
      content: "";
      position: absolute;
      top: -8px;
      left: 3px;
      width: 12px;
      height: 12px;
      background: radial-gradient(circle, rgba(255, 255, 255, 0.7) 0%, transparent 70%);
      border-radius: 50%;
      animation: sandbox-steam 2.5s infinite linear;
    }

    /* Boss commanding hologram */
    .sandbox-wrap .figure__hologram {
      position: absolute;
      top: 20px;
      left: -30px;
      width: 100px;
      height: 60px;
      background: rgba(34, 211, 238, 0.1);
      border: 1px solid rgba(34, 211, 238, 0.5);
      border-radius: 4px;
      backdrop-filter: blur(2px);
      transform: rotateY(-20deg) rotateX(10deg);
      z-index: 20;
      pointer-events: none;
      box-shadow: 0 0 20px rgba(34, 211, 238, 0.2);
      animation: sandbox-hologram-float 2s ease-in-out infinite;
    }

    @keyframes sandbox-hologram-float {
      0%,
      100% {
        transform: rotateY(-20deg) rotateX(10deg) translateY(0);
        opacity: 0.8;
      }
      50% {
        transform: rotateY(-20deg) rotateX(10deg) translateY(-5px);
        opacity: 1;
      }
    }

    .sandbox-wrap .hologram__grid {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(34, 211, 238, 0.1) 1px, transparent 1px),
        linear-gradient(90deg, rgba(34, 211, 238, 0.1) 1px, transparent 1px);
      background-size: 10px 10px;
    }

    .sandbox-wrap .hologram__data {
      position: absolute;
      height: 4px;
      background: #22d3ee;
      border-radius: 2px;
      box-shadow: 0 0 5px #22d3ee;
    }

    .sandbox-wrap .hologram__data--1 {
      top: 15px;
      left: 10px;
      width: 40px;
      animation: sandbox-hologram-scan 3s infinite;
    }
    .sandbox-wrap .hologram__data--2 {
      top: 30px;
      left: 10px;
      width: 60px;
      animation: sandbox-hologram-scan 3s infinite 0.5s;
    }

    @keyframes sandbox-hologram-scan {
      0% {
        transform: scaleX(0);
        opacity: 0;
      }
      10%,
      90% {
        transform: scaleX(1);
        opacity: 1;
      }
      100% {
        transform: scaleX(0);
        opacity: 0;
      }
    }

    /* Boss Aura */
    @keyframes sandbox-boss-aura {
      0%,
      100% {
        transform: translateX(-50%) scale(1);
        opacity: 0.7;
      }
      50% {
        transform: translateX(-50%) scale(1.15);
        opacity: 1;
        filter: blur(8px);
      }
    }

    /* ─── Qiaobang Tiered Visuals ─── */
    .sandbox-wrap .figure--tier-0 {
      transform: scale(1.1);
    }
    .sandbox-wrap .figure--tier-1 {
      transform: scale(1.05);
    }
    .sandbox-wrap .figure--tier-2 {
      transform: scale(1);
    }
    .sandbox-wrap .figure--tier-3 {
      transform: scale(0.95);
    }
    .sandbox-wrap .figure--tier-4 {
      transform: scale(0.85);
    }

    /* Tiered Auras */
    .sandbox-wrap .figure__aura--tier-0 {
      background: radial-gradient(
        circle,
        rgba(234, 179, 8, 0.4) 0%,
        rgba(234, 179, 8, 0.1) 50%,
        transparent 75%
      );
      width: 160px;
      height: 160px;
      animation: sandbox-boss-aura 5s ease-in-out infinite;
      filter: blur(5px);
    }
    .sandbox-wrap .figure__aura--tier-1 {
      background: radial-gradient(
        circle,
        rgba(56, 189, 248, 0.3) 0%,
        rgba(56, 189, 248, 0.05) 50%,
        transparent 75%
      );
      width: 130px;
      height: 130px;
      animation: sandbox-aura-pulse 4s ease-in-out infinite;
    }
    .sandbox-wrap .figure__aura--tier-2 {
      background: radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, transparent 70%);
      width: 110px;
      height: 110px;
      animation: sandbox-aura-pulse 5s ease-in-out infinite;
    }

    /* Tiered Crowns */
    .sandbox-wrap .figure__crown--tier-0 .crown__point {
      border-bottom-color: #fbbf24;
    }
    .sandbox-wrap .figure__crown--tier-0 .crown__band {
      background: linear-gradient(180deg, #fcd34d 0%, #d97706 100%);
    }

    .sandbox-wrap .figure__crown--tier-1 .crown__point {
      border-bottom-color: #94a3b8;
      filter: drop-shadow(0 0 5px #64748b);
    }
    .sandbox-wrap .figure__crown--tier-1 .crown__band {
      background: linear-gradient(180deg, #cbd5e1 0%, #64748b 100%);
      box-shadow: 0 0 10px rgba(148, 163, 184, 0.6);
    }

    /* Tiered Badges */
    .sandbox-wrap .figure--tier-0 .figure__badge {
      background: radial-gradient(circle, #fbbf24, #d97706);
      box-shadow: 0 0 15px #fbbf24;
    }
    .sandbox-wrap .figure--tier-1 .figure__badge {
      background: radial-gradient(circle, #cbd5e1, #64748b);
      box-shadow: 0 0 12px #94a3b8;
    }
    .sandbox-wrap .figure--tier-2 .figure__badge {
      background: radial-gradient(circle, #34d399, #059669);
      box-shadow: 0 0 8px #34d399;
    }

    .sandbox-wrap .figure__crown--boss .crown__gem {
      position: absolute;
      top: 2px;
      left: 50%;
      transform: translateX(-50%);
      width: 8px;
      height: 8px;
      background: #22d3ee;
      clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
      box-shadow: 0 0 10px #22d3ee;
      z-index: 5;
      animation: sandbox-gem-glow 2s ease-in-out infinite;
    }

    @keyframes sandbox-gem-glow {
      0%,
      100% {
        box-shadow: 0 0 10px #22d3ee;
        filter: brightness(1);
      }
      50% {
        box-shadow:
          0 0 25px #22d3ee,
          0 0 40px rgba(34, 211, 238, 0.6);
        filter: brightness(1.4);
      }
    }

    /* Crown */
    .sandbox-wrap .figure__crown {
      position: relative;
      width: 34px;
      height: 20px;
      margin: 0 auto 2px;
    }

    .sandbox-wrap .crown__point {
      position: absolute;
      bottom: 8px;
      width: 0;
      height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-bottom: 18px solid #fbbf24;
      filter: drop-shadow(0 0 5px #d97706);
    }

    .sandbox-wrap .crown__point--l {
      left: 2px;
      border-bottom-width: 10px;
    }

    .sandbox-wrap .crown__point--lc {
      left: 30%;
      transform: translateX(-50%);
      border-bottom-width: 12px;
      border-bottom-color: #fbbf24;
    }

    .sandbox-wrap .crown__point--c {
      left: 50%;
      transform: translateX(-50%);
      border-bottom-color: #fcd34d;
      border-bottom-width: 18px;
      border-left-width: 5px;
      border-right-width: 5px;
    }

    .sandbox-wrap .crown__point--rc {
      left: 70%;
      transform: translateX(-50%);
      border-bottom-width: 12px;
      border-bottom-color: #fbbf24;
    }

    .sandbox-wrap .crown__point--r {
      right: 2px;
      border-bottom-width: 10px;
    }

    /* Boss Commanding Arms */
    @keyframes sandbox-command {
      0%,
      100% {
        transform: rotate(-20deg) translateY(0);
      }
      50% {
        transform: rotate(-10deg) translateY(-4px);
      }
    }
    .sandbox-wrap .figure--commanding .figure__arm--l {
      animation: sandbox-command 0.2s ease-in-out infinite;
    }
    .sandbox-wrap .figure--commanding .figure__arm--r {
      animation: sandbox-command 0.2s ease-in-out infinite 0.1s;
    }

    .sandbox-wrap .crown__band {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 10px;
      background: linear-gradient(180deg, #fcd34d 0%, #d97706 100%);
      border-radius: 2px;
      box-shadow:
        0 0 15px rgba(245, 158, 11, 0.9),
        inset 0 2px 2px rgba(255, 255, 255, 0.5);
    }

    /* Manager Specific 3D Glowing Enhancement */
    .figure--manager .figure__head {
      filter: drop-shadow(0 0 10px rgba(99, 102, 241, 0.5));
    }
    .figure--manager .figure__face {
      background: radial-gradient(circle at 30% 30%, #c7d2fe 0%, #818cf8 100%);
      box-shadow:
        inset -2px -2px 6px rgba(0, 0, 0, 0.2),
        inset 2px 2px 6px rgba(255, 255, 255, 0.7);
    }
    .figure--manager .figure__body::before {
      background: radial-gradient(circle at 30% 30%, #4338ca 0%, #1e1b4b 100%);
      box-shadow:
        inset -3px -3px 8px rgba(0, 0, 0, 0.4),
        inset 2px 2px 5px rgba(255, 255, 255, 0.2);
    }
    .figure--manager .figure__badge {
      background: radial-gradient(circle, #fbbf24, #d97706);
      box-shadow:
        0 0 15px #fbbf24,
        0 0 25px rgba(251, 191, 36, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.3);
    }
    .figure--manager .figure__eye {
      background: #0f172a;
      box-shadow: 0 0 2px rgba(255, 255, 255, 0.2);
    }
    .figure--manager .figure__cup {
      background: radial-gradient(circle at 30% 30%, #fcd34d 0%, #d97706 100%);
      box-shadow:
        0 0 10px rgba(245, 158, 11, 0.4),
        inset -2px -2px 4px rgba(0, 0, 0, 0.2);
    }

    /* Head */
    .sandbox-wrap .figure__head {
      position: relative;
      width: 34px;
      height: 34px;
      margin: 0 auto 2px;
    }

    .sandbox-wrap .figure__face {
      position: absolute;
      inset: 0;
      background: linear-gradient(140deg, #c7d2fe 0%, #818cf8 100%);
      border-radius: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      box-shadow: inset 0 -5px 8px rgba(0, 0, 0, 0.25);
    }

    .sandbox-wrap .figure--worker .figure__face {
      background: linear-gradient(140deg, #fca5a5 0%, #ef4444 100%);
    }

    .sandbox-wrap .figure__eye {
      width: 6px;
      height: 7px;
      border-radius: 50% 50% 40% 40%;
      background: #0f172a;
    }

    .sandbox-wrap .figure--busy .figure__eye {
      animation: sandbox-blink 3s ease-in-out infinite;
    }

    @keyframes sandbox-blink {
      0%,
      92%,
      100% {
        transform: scaleY(1);
      }
      96% {
        transform: scaleY(0.1);
      }
    }

    .sandbox-wrap .figure__head-side--l {
      position: absolute;
      top: 4px;
      left: -7px;
      width: 7px;
      height: 26px;
      background: linear-gradient(90deg, #3730a3, #4f46e5);
      border-radius: 3px 0 0 3px;
    }

    .sandbox-wrap .figure__head-side--r {
      position: absolute;
      top: 4px;
      right: -7px;
      width: 7px;
      height: 26px;
      background: linear-gradient(270deg, #3730a3, #4f46e5);
      border-radius: 0 3px 3px 0;
    }

    .sandbox-wrap .figure--worker .figure__head-side--l,
    .sandbox-wrap .figure--worker .figure__head-side--r {
      background: linear-gradient(90deg, #991b1b, #dc2626);
    }

    .sandbox-wrap .figure__head-top {
      position: absolute;
      top: -6px;
      left: 0;
      right: 0;
      height: 6px;
      background: #6366f1;
      border-radius: 3px 3px 0 0;
    }

    .sandbox-wrap .figure--worker .figure__head-top {
      background: #ef4444;
    }

    /* Body */
    .sandbox-wrap .figure__body {
      position: relative;
      width: 38px;
      height: 40px;
      margin: 0 auto;
    }

    .sandbox-wrap .figure--manager .figure__body::before {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(150deg, #3730a3, #1e1b4b);
      border-radius: 3px;
      box-shadow: inset 0 -5px 10px rgba(0, 0, 0, 0.3);
    }

    .sandbox-wrap .figure--worker .figure__body::before {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(150deg, #9f1239, #4c0519);
      border-radius: 3px;
      box-shadow: inset 0 -5px 10px rgba(0, 0, 0, 0.3);
    }

    .sandbox-wrap .figure__body-side--l {
      position: absolute;
      top: 4px;
      left: -8px;
      width: 8px;
      height: 32px;
      background: linear-gradient(90deg, #1e1b4b, #312e81);
      border-radius: 3px 0 0 3px;
      box-shadow: inset 1px 0 2px rgba(255, 255, 255, 0.1);
    }

    .sandbox-wrap .figure__body-side--r {
      position: absolute;
      top: 4px;
      right: -8px;
      width: 8px;
      height: 32px;
      background: linear-gradient(270deg, #1e1b4b, #312e81);
      border-radius: 0 3px 3px 0;
      box-shadow: inset -1px 0 2px rgba(255, 255, 255, 0.1);
    }

    .sandbox-wrap .figure--worker .figure__body-side--l,
    .sandbox-wrap .figure--worker .figure__body-side--r {
      background: linear-gradient(90deg, #4c0519, #7f1d1d);
    }

    .sandbox-wrap .figure__body-top {
      position: absolute;
      top: -6px;
      left: 0;
      right: 0;
      height: 6px;
      background: #6366f1;
      border-radius: 3px 3px 0 0;
      box-shadow: inset 0 2px 3px rgba(255, 255, 255, 0.3);
    }

    .sandbox-wrap .figure--worker .figure__body-top {
      background: #dc2626;
    }

    .sandbox-wrap .figure__badge {
      position: absolute;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      width: 14px;
      height: 14px;
      background: radial-gradient(circle, #fcd34d, #d97706);
      border-radius: 50%;
      box-shadow: 0 0 8px rgba(252, 211, 77, 0.9);
      z-index: 2;
    }

    /* Arms */
    .sandbox-wrap .figure__arm {
      position: absolute;
      width: 8px;
      height: 30px;
      border-radius: 4px;
      top: 60px;
      background: linear-gradient(180deg, #6366f1, #3730a3);
      transform-origin: top center;
      animation: sandbox-arm-l 2s ease-in-out infinite;
    }

    .sandbox-wrap .figure__arm--l {
      left: 10px;
      animation-name: sandbox-arm-l;
    }

    .sandbox-wrap .figure__arm--r {
      right: 10px;
      animation-name: sandbox-arm-r;
    }

    @keyframes sandbox-arm-l {
      0%,
      100% {
        transform: rotate(-12deg);
      }
      50% {
        transform: rotate(-28deg);
      }
    }

    @keyframes sandbox-arm-r {
      0%,
      100% {
        transform: rotate(12deg);
      }
      50% {
        transform: rotate(28deg);
      }
    }

    /* Lobster antenna */
    .sandbox-wrap .figure__antenna {
      position: absolute;
      width: 3px;
      height: 20px;
      background: linear-gradient(180deg, rgba(239, 68, 68, 0) 0%, #ef4444 100%);
      border-radius: 2px;
      top: -28px;
    }

    .sandbox-wrap .figure__antenna--l {
      left: 7px;
      transform-origin: bottom center;
      transform: rotate(-18deg);
      animation: sandbox-ant-l 2.5s ease-in-out infinite;
    }

    .sandbox-wrap .figure__antenna--r {
      right: 7px;
      transform-origin: bottom center;
      transform: rotate(18deg);
      animation: sandbox-ant-r 2.5s ease-in-out infinite 0.5s;
    }

    @keyframes sandbox-ant-l {
      0%,
      100% {
        transform: rotate(-18deg);
      }
      50% {
        transform: rotate(-30deg);
      }
    }

    @keyframes sandbox-ant-r {
      0%,
      100% {
        transform: rotate(18deg);
      }
      50% {
        transform: rotate(30deg);
      }
    }

    /* Lobster Claws */
    .sandbox-wrap .figure__claw {
      position: absolute;
      top: 56px;
      display: flex;
      flex-direction: column;
      gap: 3px;
      transform-origin: top center;
    }

    .sandbox-wrap .figure__claw--l {
      left: -2px;
      animation: sandbox-claw-l 1.8s ease-in-out infinite;
    }

    .sandbox-wrap .figure__claw--r {
      right: -2px;
      animation: sandbox-claw-r 1.8s ease-in-out infinite 0.9s;
    }

    .sandbox-wrap .claw__upper,
    .sandbox-wrap .claw__lower {
      width: 18px;
      height: 9px;
      background: linear-gradient(90deg, #dc2626, #9f1239);
      border-radius: 2px;
    }

    .sandbox-wrap .claw__upper {
      border-radius: 2px 10px 0 2px;
    }

    .sandbox-wrap .claw__lower {
      border-radius: 2px 0 10px 2px;
      transform-origin: left;
      transform: rotate(6deg);
    }

    @keyframes sandbox-claw-l {
      0%,
      100% {
        transform: rotate(-20deg);
      }
      50% {
        transform: rotate(-36deg);
      }
    }

    @keyframes sandbox-claw-r {
      0%,
      100% {
        transform: rotate(20deg);
      }
      50% {
        transform: rotate(36deg);
      }
    }

    /* Legs */
    .sandbox-wrap .figure__legs {
      display: flex;
      justify-content: center;
      gap: 5px;
      margin-top: 2px;
    }

    .sandbox-wrap .figure__leg {
      width: 9px;
      height: 22px;
      border-radius: 0 0 4px 4px;
    }

    .sandbox-wrap .figure--manager .figure__leg {
      background: linear-gradient(180deg, #312e81, #1e1b4b);
    }

    .sandbox-wrap .figure--worker .figure__leg {
      background: linear-gradient(180deg, #7f1d1d, #4c0519);
    }

    .sandbox-wrap .figure__leg--l {
      transform-origin: top center;
      animation: sandbox-leg-l 0.7s ease-in-out infinite;
    }

    .sandbox-wrap .figure__leg--r {
      transform-origin: top center;
      animation: sandbox-leg-r 0.7s ease-in-out infinite;
    }

    @keyframes sandbox-leg-l {
      0%,
      100% {
        transform: rotate(5deg);
      }
      50% {
        transform: rotate(-5deg);
      }
    }

    @keyframes sandbox-leg-r {
      0%,
      100% {
        transform: rotate(-5deg);
      }
      50% {
        transform: rotate(5deg);
      }
    }

    .sandbox-wrap .figure--idle .figure__leg--l,
    .sandbox-wrap .figure--idle .figure__leg--r,
    .sandbox-wrap .figure--idle .figure__claw--l,
    .sandbox-wrap .figure--idle .figure__claw--r,
    .sandbox-wrap .figure--idle .figure__arm--l,
    .sandbox-wrap .figure--idle .figure__arm--r {
      animation: none;
    }

    /* Avatar Characters - Volumetric 3D Enhancement */
    .sandbox-wrap .figure--codex .figure__face {
      background: radial-gradient(circle at 30% 30%, #f8fafc 0%, #cbd5e1 100%);
      box-shadow:
        inset -2px -2px 5px rgba(0, 0, 0, 0.1),
        inset 2px 2px 5px rgba(255, 255, 255, 0.8);
    }
    .sandbox-wrap .figure--codex .figure__body::before {
      background: radial-gradient(circle at 30% 30%, #94a3b8 0%, #475569 100%);
    }
    .sandbox-wrap .figure--codex .figure__badge {
      background: radial-gradient(circle, #22d3ee, #0891b2);
      box-shadow:
        0 0 12px #22d3ee,
        0 0 20px rgba(34, 211, 238, 0.4);
    }

    .sandbox-wrap .figure--claude .figure__face {
      background: radial-gradient(circle at 30% 30%, #ffedd5 0%, #fed7aa 100%);
      box-shadow:
        inset -3px -3px 6px rgba(0, 0, 0, 0.1),
        inset 2px 2px 4px rgba(255, 255, 255, 0.7);
    }
    .sandbox-wrap .figure--claude .figure__head-top {
      background: #78350f;
      height: 14px;
      top: -14px;
      border-radius: 12px 12px 0 0;
      box-shadow: inset 0 2px 4px rgba(255, 255, 255, 0.2);
    }
    .sandbox-wrap .figure--claude .figure__body::before {
      background: radial-gradient(circle at 30% 30%, #f97316 0%, #9a3412 100%);
    }

    .sandbox-wrap .figure--gemini .figure__face {
      background: radial-gradient(circle at 30% 30%, #fae8ff 0%, #f5d0fe 100%);
    }
    .sandbox-wrap .figure--gemini .figure__head-top {
      background: #2e1065;
      height: 16px;
      top: -16px;
      border-radius: 12px 12px 0 0;
    }
    .sandbox-wrap .figure--gemini .figure__body::before {
      background: radial-gradient(circle at 30% 30%, #a855f7 0%, #6b21a8 100%);
    }
    .sandbox-wrap .figure--gemini .figure__badge {
      background: radial-gradient(circle, #fcd34d, #d97706);
      box-shadow: 0 0 10px #fcd34d;
    }

    .sandbox-wrap .figure--qwen .figure__face {
      background: radial-gradient(circle at 30% 30%, #e0f2fe 0%, #bae6fd 100%);
    }
    .sandbox-wrap .figure--qwen .figure__eye {
      background: #1e3a8a;
      box-shadow: 0 0 5px rgba(30, 58, 138, 0.5);
    }
    .sandbox-wrap .figure--qwen .figure__head-top {
      background: #1e3a8a;
      height: 12px;
      top: -12px;
      border-radius: 50% 50% 0 0;
    }
    .sandbox-wrap .figure--qwen .figure__body::before {
      background: radial-gradient(circle at 30% 30%, #2563eb 0%, #1e3a8a 100%);
    }

    .sandbox-wrap .figure--cursor .figure__face {
      background: radial-gradient(circle at 30% 30%, #334155 0%, #0f172a 100%);
    }
    .sandbox-wrap .figure--cursor .figure__eye {
      background: #94a3b8;
      box-shadow: 0 0 5px #94a3b8;
    }
    .sandbox-wrap .figure--cursor .figure__body::before {
      background: radial-gradient(circle at 30% 30%, #1e293b 0%, #020617 100%);
    }

    .sandbox-wrap .figure--molty .figure__face {
      background: radial-gradient(circle at 30% 30%, #fca5a5 0%, #ef4444 100%);
      box-shadow: inset -2px -2px 6px rgba(0, 0, 0, 0.2);
    }
    .sandbox-wrap .figure--molty .figure__body::before {
      background: radial-gradient(circle at 30% 30%, #dc2626 0%, #7f1d1d 100%);
    }

    .sandbox-wrap .figure--idle {
      filter: brightness(0.6) saturate(0.5) contrast(1.1);
    }

    .sandbox-wrap .figure__shadow {
      position: absolute;
      bottom: -15px;
      left: 50%;
      transform: translateX(-50%);
      width: 44px;
      height: 12px;
      background: rgba(0, 0, 0, 0.45);
      border-radius: 50%;
      filter: blur(4px);
      z-index: -1;
    }

    /* ─── Agent Slots ─── */
    .sandbox-wrap .agent-slot {
      position: absolute;
      pointer-events: none;
      transition:
        top 1s cubic-bezier(0.4, 0, 0.2, 1),
        left 1s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 0;
      height: 0;
      will-change: top, left;
      z-index: 2;
    }

    .sandbox-wrap .agent-slot > * {
      pointer-events: auto;
    }

    .sandbox-wrap .agent-slot:hover {
      z-index: 10;
      transform: translateY(-12px) scale(1.05);
    }

    .sandbox-wrap .agent-slot:hover .figure {
      filter: drop-shadow(0 0 20px rgba(139, 92, 246, 0.8));
    }

    .sandbox-wrap .agent-name-tag {
      font-size: 0.65rem;
      background: rgba(15, 23, 42, 0.8);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.9);
      padding: 4px 8px;
      border-radius: 4px;
      margin-top: -6px;
      text-align: center;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
      white-space: nowrap;
    }

    .sandbox-wrap .agent-status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-top: 4px;
    }

    .sandbox-wrap .agent-status-dot--working {
      background: #f59e0b;
      box-shadow: 0 0 8px #f59e0b;
      animation: sandbox-sd 1.5s ease-in-out infinite;
    }

    .sandbox-wrap .agent-status-dot--idle {
      background: #475569;
    }

    .sandbox-wrap .agent-status-dot--aborted {
      background: #ef4444;
      box-shadow: 0 0 8px #ef4444;
    }

    @keyframes sandbox-sd {
      0%,
      100% {
        box-shadow: 0 0 6px #f59e0b;
      }
      50% {
        box-shadow:
          0 0 16px #f59e0b,
          0 0 30px rgba(245, 158, 11, 0.4);
      }
    }
  </style>
`;
