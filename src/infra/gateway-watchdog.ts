import { createSubsystemLogger } from "../logging/subsystem.js";
import { checkGatewayHealth } from "../commands/doctor-gateway-health.js";
import { defaultRuntime } from "../runtime.js";
import { loadConfig } from "../config/config.js";
import { triggerOPENAEONRestart } from "./restart.js";
import { inspectGitMaintenance } from "./git-maintenance.js";
import { findGitRoot } from "./git-root.js";

const log = createSubsystemLogger("watchdog");

const WATCHDOG_INTERVAL_MS = 30_000; // 30 seconds between health checks
const WATCHDOG_RESTART_COOLDOWN_MS = 60_000; // min 60s between auto-restarts
const WATCHDOG_MAX_RETRIES = 3;

export type WatchdogEventKind =
  | "gateway_healthy"
  | "gateway_down_detected"
  | "restart_triggered"
  | "restart_failed"
  | "watchdog_exhausted"
  | "git_maintenance_applied";

export interface WatchdogEvent {
  kind: WatchdogEventKind;
  detail?: string;
  timestamp: number;
}

export type WatchdogSubscriber = (event: WatchdogEvent) => void;

export interface GatewayWatchdogHandle {
  stop: () => void;
}

function emit(subscriber: WatchdogSubscriber | undefined, event: WatchdogEvent) {
  if (subscriber) {
    try {
      subscriber(event);
    } catch {
      // don't let subscriber errors crash the watchdog
    }
  }
}

/**
 * Starts a background watchdog that periodically checks gateway health
 * and automatically attempts recovery when issues are detected.
 *
 * Key behaviors inspired by EvoMap/evolver:
 * - Detects gateway down and triggers SIGUSR1 restart
 * - Clears git locks before restart attempts
 * - Respects cooldown to avoid restart storms
 * - Stops after `maxRetries` consecutive failures (avoids infinite loops)
 * - Fully disabled in test environments
 */
export function startGatewayWatchdog(opts: {
  intervalMs?: number;
  cooldownMs?: number;
  maxRetries?: number;
  subscriber?: WatchdogSubscriber;
}): GatewayWatchdogHandle {
  // Never run in test or when explicitly disabled
  if (
    process.env.VITEST ||
    process.env.NODE_ENV === "test" ||
    process.env.OPENAEON_WATCHDOG === "off"
  ) {
    return { stop: () => {} };
  }

  const intervalMs = opts.intervalMs ?? WATCHDOG_INTERVAL_MS;
  const cooldownMs = opts.cooldownMs ?? WATCHDOG_RESTART_COOLDOWN_MS;
  const maxRetries = opts.maxRetries ?? WATCHDOG_MAX_RETRIES;
  const { subscriber } = opts;

  let consecutiveFailures = 0;
  let lastRestartAt = 0;
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  async function tick() {
    if (stopped) return;
    if (consecutiveFailures >= maxRetries) {
      // Watchdog exhausted – stop polling to avoid restart storms
      if (timer) clearInterval(timer);
      emit(subscriber, {
        kind: "watchdog_exhausted",
        detail: `Gateway remained down after ${maxRetries} consecutive restart attempts. Manual intervention required.`,
        timestamp: Date.now(),
      });
      log.error(`watchdog exhausted after ${maxRetries} failed restart attempts`);
      return;
    }

    try {
      const cfg = loadConfig();
      const { healthOk } = await checkGatewayHealth({
        runtime: defaultRuntime,
        cfg,
        timeoutMs: 5000,
      });

      if (healthOk) {
        consecutiveFailures = 0;
        emit(subscriber, { kind: "gateway_healthy", timestamp: Date.now() });
        return;
      }

      // Gateway is down
      consecutiveFailures += 1;
      emit(subscriber, {
        kind: "gateway_down_detected",
        detail: `Gateway health check failed (attempt ${consecutiveFailures}/${maxRetries})`,
        timestamp: Date.now(),
      });
      log.warn(`watchdog: gateway down (attempt ${consecutiveFailures}/${maxRetries})`);

      // Respect cooldown between restart attempts
      const msSinceLastRestart = Date.now() - lastRestartAt;
      if (lastRestartAt > 0 && msSinceLastRestart < cooldownMs) {
        log.info(
          `watchdog: waiting ${Math.round((cooldownMs - msSinceLastRestart) / 1000)}s cooldown before restart`,
        );
        return;
      }

      // Pre-restart: clear any git locks that might block install/update
      const gitRoot = findGitRoot(process.cwd());
      if (gitRoot) {
        const maintenance = inspectGitMaintenance({ cwd: gitRoot, repair: true });
        if (maintenance?.issues.some((i) => i.repaired)) {
          emit(subscriber, {
            kind: "git_maintenance_applied",
            detail: "Cleared stale git locks before restart.",
            timestamp: Date.now(),
          });
          log.info("watchdog: cleared stale git locks before restart");
        }
      }

      // Trigger restart
      lastRestartAt = Date.now();
      const result = triggerOPENAEONRestart();
      if (result.ok) {
        emit(subscriber, {
          kind: "restart_triggered",
          detail: `Restart triggered via ${result.method}`,
          timestamp: Date.now(),
        });
        log.info(`watchdog: restart triggered via ${result.method}`);
      } else {
        emit(subscriber, {
          kind: "restart_failed",
          detail: result.detail,
          timestamp: Date.now(),
        });
        log.error(`watchdog: restart failed: ${result.detail}`);
      }
    } catch (err) {
      log.error(`watchdog tick error: ${String(err)}`);
    }
  }

  timer = setInterval(() => {
    tick().catch((err) => log.error(`watchdog tick uncaught: ${String(err)}`));
  }, intervalMs);

  // Unref so the watchdog doesn't prevent process exit
  if (typeof timer.unref === "function") {
    timer.unref();
  }

  log.info(
    `watchdog started (interval=${intervalMs}ms, cooldown=${cooldownMs}ms, maxRetries=${maxRetries})`,
  );

  return {
    stop() {
      stopped = true;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      log.info("watchdog stopped");
    },
  };
}
