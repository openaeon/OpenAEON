import { html } from "lit";

export const sidebarStyles = html`
  <style>
    /* ─── Task Cards Sidebar ─── */
    .sandbox-wrap .sandbox-sidebar {
      width: 320px;
      flex-shrink: 0;
      background: rgba(15, 23, 42, 0.4);
      backdrop-filter: blur(25px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      flex-direction: column;
      z-index: 50;
      margin: 0; /* Alignment handled by parent padding */
      border-radius: 20px;
      box-shadow: 0 15px 45px rgba(0, 0, 0, 0.4);
      overflow: hidden;
    }

    .sandbox-wrap .sandbox-sidebar-header {
      padding: 16px 20px 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.3);
    }

    .sandbox-wrap .sidebar-cards {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .sandbox-wrap .sidebar-cards::-webkit-scrollbar {
      width: 4px;
    }

    .sandbox-wrap .sidebar-cards::-webkit-scrollbar-track {
      background: transparent;
    }

    .sandbox-wrap .sidebar-cards::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 2px;
    }

    /* Task Card */
    .sandbox-wrap .task-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 12px;
      overflow: hidden;
      transition: all 0.3s ease;
      position: relative;
    }

    .task-card--active {
      border-color: rgba(245, 158, 11, 0.35);
      background: rgba(245, 158, 11, 0.05);
    }

    .task-card:hover {
      border-color: rgba(139, 92, 246, 0.4);
      background: rgba(139, 92, 246, 0.06);
      transform: translateX(-4px);
    }

    .task-card__header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
    }

    .task-card__index {
      font-size: 0.65rem;
      font-weight: 800;
      color: rgba(255, 255, 255, 0.25);
      background: rgba(255, 255, 255, 0.05);
      padding: 2px 6px;
      border-radius: 6px;
      flex-shrink: 0;
    }

    .task-card__title {
      font-size: 0.8rem;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.8);
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .task-card__status {
      font-size: 0.65rem;
      font-weight: 700;
      color: #fff;
      padding: 2px 8px;
      border-radius: 10px;
      flex-shrink: 0;
      letter-spacing: 0.04em;
    }

    .task-card__body {
      padding: 0 14px 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .task-card__task {
      font-size: 0.72rem;
      color: rgba(255, 255, 255, 0.4);
      line-height: 1.4;
      border-left: 2px solid rgba(255, 255, 255, 0.08);
      padding-left: 8px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .task-card__progress-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.65rem;
      color: rgba(255, 255, 255, 0.25);
    }

    .task-card__progress-bar {
      height: 4px;
      border-radius: 2px;
      background: rgba(255, 255, 255, 0.07);
      overflow: hidden;
    }

    .task-card__progress-fill {
      height: 100%;
      border-radius: 2px;
      transition: width 0.8s ease;
      box-shadow: 0 0 8px currentColor;
    }

    .task-card__meta {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }

    .sandbox-wrap .meta-chip {
      font-size: 0.65rem;
      color: rgba(255, 255, 255, 0.35);
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.06);
      padding: 2px 8px;
      border-radius: 8px;
    }

    /* Animated working bar on active card */
    .task-card__working-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 2px;
      width: 60%;
      background: linear-gradient(90deg, transparent, #f59e0b, transparent);
      animation: scan 2.5s linear infinite;
    }

    @keyframes scan {
      0% {
        left: -60%;
      }
      100% {
        left: 100%;
      }
    }

    /* ─── Manager info card ─── */
    .sandbox-wrap .manager-info {
      padding: 12px 14px;
      margin: 12px;
      background: rgba(99, 102, 241, 0.08);
      border: 1px solid rgba(99, 102, 241, 0.25);
      border-radius: 12px;
    }

    .sandbox-wrap .manager-info__title {
      font-size: 0.7rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #818cf8;
      margin-bottom: 8px;
    }

    .sandbox-wrap .manager-info__row {
      display: flex;
      justify-content: space-between;
      font-size: 0.72rem;
      color: rgba(255, 255, 255, 0.4);
      margin-bottom: 4px;
    }

    .sandbox-wrap .manager-info__row span:last-child {
      color: rgba(255, 255, 255, 0.75);
      font-weight: 600;
    }

    /* ─── Empty state ─── */
    .sandbox-wrap .sidebar-empty {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: rgba(255, 255, 255, 0.2);
      font-size: 0.8rem;
      padding: 32px;
      text-align: center;
    }

    .sandbox-wrap .sidebar-empty svg {
      opacity: 0.3;
      width: 48px;
      height: 48px;
    }

    /* ─── Task Plan Panel ─── */
    .sandbox-wrap .task-plan {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .sandbox-wrap .task-plan__desc {
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.5);
      font-style: italic;
      border-left: 2px solid rgba(129, 140, 248, 0.4);
      padding-left: 8px;
    }
    .sandbox-wrap .task-plan__progress-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.7rem;
      color: rgba(255, 255, 255, 0.5);
    }
    .sandbox-wrap .task-plan__bar {
      height: 6px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 4px;
      overflow: hidden;
    }
    .sandbox-wrap .task-plan__fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.6s ease;
    }
    .sandbox-wrap .task-plan__list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .sandbox-wrap .task-plan__item {
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.45);
      padding: 6px 8px;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 6px;
      border-left: 2px solid rgba(255, 255, 255, 0.1);
    }
    .sandbox-wrap .task-plan__item--active {
      color: rgba(255, 255, 255, 0.9);
      background: rgba(129, 140, 248, 0.1);
      border-left-color: #818cf8;
      font-weight: 600;
    }
    .sandbox-wrap .task-plan__item--done {
      color: rgba(255, 255, 255, 0.25);
      text-decoration: line-through;
      border-left-color: rgba(16, 185, 129, 0.3);
    }
    .sandbox-wrap .task-plan__complete {
      font-size: 0.75rem;
      font-weight: 700;
      color: #10b981;
      text-align: center;
      padding: 8px;
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 8px;
      background: rgba(16, 185, 129, 0.05);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .sandbox-wrap .task-plan--complete {
      border-color: rgba(16, 185, 129, 0.4);
      animation: planCompletePulse 2s ease infinite;
    }
    @keyframes planCompletePulse {
      0%,
      100% {
        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.2);
      }
      50% {
        box-shadow: 0 0 12px 4px rgba(16, 185, 129, 0.15);
      }
    }
    .sandbox-wrap .task-plan__celebrate {
      font-size: 1.2rem;
      animation: celebrateBounce 0.6s ease infinite alternate;
    }
    @keyframes celebrateBounce {
      from {
        transform: translateY(0);
      }
      to {
        transform: translateY(-4px);
      }
    }
    .sandbox-wrap .task-plan__worker-link {
      font-size: 0.65rem;
      cursor: help;
      opacity: 0.6;
      transition: opacity 0.2s;
      margin-left: 4px;
    }
    .sandbox-wrap .task-plan__worker-link:hover {
      opacity: 1;
    }
    .sandbox-wrap .task-plan__confetti {
      position: relative;
      height: 40px;
      overflow: hidden;
      pointer-events: none;
    }
    .sandbox-wrap .confetti-piece {
      position: absolute;
      left: calc(var(--x) * 1%);
      top: -8px;
      width: 6px;
      height: 6px;
      border-radius: 2px;
      background: var(--color, #818cf8);
      animation: confettiFall 2.5s ease-out var(--delay, 0s) forwards;
      opacity: 0;
    }
    @keyframes confettiFall {
      0% {
        opacity: 1;
        transform: translateY(0) rotate(0deg);
      }
      100% {
        opacity: 0;
        transform: translateY(48px) rotate(720deg);
      }
    }

    /* ─── Office Roster ─── */
    .sandbox-wrap .roster-item {
      padding: 10px 14px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 10px;
      margin-bottom: 8px;
      transition: background 0.2s;
    }
    .sandbox-wrap .roster-item:hover {
      background: rgba(255, 255, 255, 0.04);
    }
    .sandbox-wrap .roster-item__header {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .sandbox-wrap .roster-item__icon {
      font-size: 1.1rem;
    }
    .sandbox-wrap .roster-item__name {
      font-weight: 700;
      font-size: 0.85rem;
      color: rgba(255, 255, 255, 0.9);
      flex: 1;
    }
    .sandbox-wrap .status-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .sandbox-wrap .status-indicator--online {
      background: #10b981;
      box-shadow: 0 0 8px #10b981;
    }
    .sandbox-wrap .status-indicator--working {
      background: #f59e0b;
      box-shadow: 0 0 8px #f59e0b;
      animation: pulse-dot 1.5s ease-in-out infinite;
    }
    .sandbox-wrap .status-indicator--idle {
      background: #64748b;
    }
    .sandbox-wrap .roster-item__status {
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    /* ─── Timeline ─── */
    .sandbox-wrap .timeline-group {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .sandbox-wrap .timeline-group__title {
      font-size: 0.7rem;
      font-weight: 700;
      color: #818cf8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 8px;
      margin-bottom: -4px;
      border-bottom: 1px solid rgba(129, 140, 248, 0.2);
      padding-bottom: 4px;
    }
    .sandbox-wrap .timeline {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .sandbox-wrap .timeline__item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      position: relative;
    }
    .sandbox-wrap .timeline__item:not(:last-child)::before {
      content: "";
      position: absolute;
      top: 14px;
      left: 5px;
      bottom: -16px;
      width: 1px;
      background: rgba(255, 255, 255, 0.1);
    }
    .sandbox-wrap .timeline__dot {
      width: 11px;
      height: 11px;
      border-radius: 50%;
      margin-top: 4px;
      z-index: 1;
    }
    .sandbox-wrap .timeline__content {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .sandbox-wrap .timeline__label {
      font-size: 0.8rem;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.9);
    }
    .sandbox-wrap .timeline__time {
      font-size: 0.65rem;
      color: rgba(255, 255, 255, 0.4);
    }
    .sandbox-wrap .timeline__status {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 700;
    }
  </style>
`;
