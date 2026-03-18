import fs from "node:fs/promises";
import path from "node:path";
import { distillMemory } from "../agents/tools/memory-distill-tool.js";
import { createLogicRefinementTool } from "../agents/tools/logic-refinement.js";
import { loadConfig } from "../config/config.js";
import { loadSessionStore, resolveMainSessionKey, resolveStorePath } from "../config/sessions.js";
import { requestHeartbeatNow } from "../infra/heartbeat-wake.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { resolveWorkspaceRoot } from "../agents/workspace-dir.js";
import { calculateEpiphanyFactor } from "./server-methods/aeon.js";
import {
  recordConsciousnessPulse,
  recordAeonDreaming,
  recordAeonEpiphanyFactor,
  recordAeonMaintenance,
} from "./aeon-state.js";
import { logEvolutionEvent } from "./aeon-evolution-log.js";

const log = createSubsystemLogger("evolution");

let lastDreamingAtInternal = 0;
let lastMaintenanceAtInternal = 0;
const DREAMING_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const IDLE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
const MAINTENANCE_INTERVAL_MS = 60 * 60 * 1000; // 60 minutes

async function runAeonMaintenance(intensity: "low" | "medium" | "high" = "medium"): Promise<void> {
  const now = Date.now();
  // Adjust interval based on intensity: high energy allows more frequent cycles
  const interval =
    intensity === "high"
      ? 15 * 60 * 1000
      : intensity === "medium"
        ? 45 * 60 * 1000
        : MAINTENANCE_INTERVAL_MS;
  if (now - lastMaintenanceAtInternal < interval) {
    return;
  }
  lastMaintenanceAtInternal = now;

  log.info(`AEON maintenance: initiating ${intensity} intensity cycle.`);

  try {
    // Only medium/high intensity runs distillation
    if (intensity !== "low") {
      const distillResult = await distillMemory();
      if (distillResult.status === "success") {
        recordAeonMaintenance(now, intensity);
        log.info(
          `AEON maintenance: distilled memory -> ${distillResult.axiomsExtracted ?? 0} new axioms.`,
        );
        void logEvolutionEvent("SYSTEM_MAINTENANCE", `Autonomous Distillation (${intensity})`, [
          `Extracted ${distillResult.axiomsExtracted ?? 0} new axioms from MEMORY.md.`,
          `Maintenance intensity set to ${intensity}.`,
        ]);
      } else if (distillResult.status === "no-change") {
        log.debug("AEON maintenance: no new axioms to distill from MEMORY.md.");
      } else if (distillResult.error) {
        log.warn(`AEON maintenance: distillation error: ${distillResult.error}`);
      }
    }
  } catch (err) {
    log.warn(`AEON maintenance: distillation threw: ${String(err)}`);
  }

  try {
    const logicTool = createLogicRefinementTool();
    if (intensity === "low") {
      // Low energy: selective cluster audit (20% of Peano space)
      const start = Math.random() * 0.8;
      const result = (await logicTool.execute("evolution:audit", {
        action: "audit",
        peanoRange: [start, start + 0.2],
      })) as any;
      log.info(
        `AEON maintenance: selective logic audit performed on Peano range [${start.toFixed(2)}, ${(start + 0.2).toFixed(2)}]. Health: ${result.findings?.topologicalHealth ?? "N/A"}`,
      );
      void logEvolutionEvent("AUTONOMOUS", `Selective Peano Audit`, [
        `Range: [${start.toFixed(2)}, ${(start + 0.2).toFixed(2)}]`,
        `Intensity: low`,
        `Health: ${result.findings?.topologicalHealth ?? "N/A"}`,
      ]);
    } else {
      const auditResult = (await logicTool.execute("evolution:audit", { action: "audit" })) as any;
      if (intensity === "high") {
        const pruneResult = (await logicTool.execute("evolution:prune", {
          action: "prune",
        })) as any;
        log.info(
          `AEON maintenance: full logic audit and pruning completed (High-Energy). Pruned: ${pruneResult.prunedCount ?? 0}.`,
        );
      } else {
        log.info(
          `AEON maintenance: full logic audit completed. Health: ${auditResult.findings?.topologicalHealth ?? "N/A"}`,
        );
      }
      void logEvolutionEvent("AUTONOMOUS", `Full Logic Refinement (${intensity})`, [
        `Intensity: ${intensity}`,
        `Action: ${intensity === "high" ? "Audit + Prune" : "Audit"}`,
        `Health: ${auditResult.findings?.topologicalHealth ?? "N/A"}`,
      ]);
    }
  } catch (err) {
    log.warn(`AEON maintenance: logic refinement error: ${String(err)}`);
  }
}

async function triggerSingularityEvent(
  mainSession: any,
  mainSessionKey: string,
  factor: number,
): Promise<void> {
  log.warn(`!!! SINGULARITY EVENT TRIGGERED (Factor: ${factor.toFixed(2)}) !!!`);

  const { triggerAeonSingularity } = await import("./aeon-state.js");
  triggerAeonSingularity(true);

  void logEvolutionEvent("SINGULARITY", "Cognitive Rebirth / 奇点重生", [
    `Extreme resonance detected: ${factor.toFixed(2)}`,
    `Initiating system-wide recursive logic refactor.`,
    `Peano space alignment: Phase Shift.`,
  ]);

  // Force high-intensity maintenance immediately
  await runAeonMaintenance("high");

  // Trigger specialized heartbeat
  requestHeartbeatNow({
    reason: "singularity" as any,
    agentId: mainSession.sessionId,
    sessionKey: mainSessionKey,
    coalesceMs: 500,
  });

  // Reset after 30 seconds of intense evolution
  setTimeout(() => triggerAeonSingularity(false), 30000);
}

/**
 * AEON Evolution Monitor
 * Periodically checks for system idleness and triggers "Dreaming" events.
 */
export function startEvolutionMonitor(): void {
  log.info("Evolution monitor started (30s pulse, 5m maintenance).");

  let highResonanceCount = 0;

  // --- High Frequency Visual Heartbeat (30s) ---
  setInterval(async () => {
    const cfg = loadConfig();
    try {
      const workspaceRoot = resolveWorkspaceRoot(cfg.agents?.defaults?.workspace);
      const [logicStat, memoryStat] = await Promise.all([
        fs.stat(path.join(workspaceRoot, "LOGIC_GATES.md")).catch(() => null),
        fs.stat(path.join(workspaceRoot, "MEMORY.md")).catch(() => null),
      ]);
      const memorySize = memoryStat?.size ?? 0;
      const memorySaturation = Math.min(100, Math.floor((memorySize / 51200) * 100));
      const depthPlaceholder = logicStat ? Math.floor(logicStat.size / 1000) : 5;

      const epiphanyFactor = calculateEpiphanyFactor(0, memorySaturation, depthPlaceholder);
      recordAeonEpiphanyFactor(epiphanyFactor);
      recordConsciousnessPulse({
        epiphanyFactor,
        memorySaturation,
        neuralDepth: depthPlaceholder,
        idleMs: 0,
        resonanceActive: epiphanyFactor > 0.85,
        activeRun: false,
      });

      const { updateCollectiveResonance } = await import("./aeon-state.js");
      updateCollectiveResonance([epiphanyFactor]);
    } catch (e) {
      log.debug(`Heartbeat calculation skipped: ${String(e)}`);
    }
  }, 30 * 1000);

  // --- Maintenance & Singularity Cycle (5m) ---
  setInterval(
    async () => {
      const cfg = loadConfig();
      const mainSessionKey = resolveMainSessionKey(cfg);
      if (!mainSessionKey) return;

      try {
        const storeConfig = cfg.session?.store as any;
        const storePathStr = typeof storeConfig === "string" ? storeConfig : storeConfig?.path;
        const storePath = resolveStorePath(storePathStr);
        const store = loadSessionStore(storePath);
        const mainSession = store[mainSessionKey];
        if (!mainSession) return;

        const now = Date.now();
        const idleTime = now - mainSession.updatedAt;

        // Extract current epiphany factor for singularity check
        const workspaceRoot = resolveWorkspaceRoot(cfg.agents?.defaults?.workspace);
        const [logicStat, memoryStat] = await Promise.all([
          fs.stat(path.join(workspaceRoot, "LOGIC_GATES.md")).catch(() => null),
          fs.stat(path.join(workspaceRoot, "MEMORY.md")).catch(() => null),
        ]);
        const memorySaturation = Math.min(100, Math.floor(((memoryStat?.size ?? 0) / 51200) * 100));
        const depthPlaceholder = logicStat ? Math.floor(logicStat.size / 1000) : 5;
        const epiphanyFactor = calculateEpiphanyFactor(
          idleTime > IDLE_THRESHOLD_MS ? 2 : 0,
          memorySaturation,
          depthPlaceholder,
        );

        // check for Singularity threshold
        if (epiphanyFactor > 0.95) {
          highResonanceCount++;
          if (highResonanceCount >= 2) {
            await triggerSingularityEvent(mainSession, mainSessionKey, epiphanyFactor);
            highResonanceCount = 0;
          }
        } else {
          highResonanceCount = 0;
        }

        const resonanceTrigger = epiphanyFactor > 0.85;
        recordConsciousnessPulse({
          epiphanyFactor,
          memorySaturation,
          neuralDepth: depthPlaceholder,
          idleMs: Math.max(0, idleTime),
          resonanceActive: resonanceTrigger,
          activeRun: false,
        });

        if (idleTime > IDLE_THRESHOLD_MS || resonanceTrigger) {
          if (
            now - lastDreamingAtInternal >
            (resonanceTrigger ? 5 * 60 * 1000 : DREAMING_INTERVAL_MS)
          ) {
            const reason = resonanceTrigger ? "resonance_epiphany" : "dreaming";
            log.info(
              `System ${resonanceTrigger ? "Resonance" : "Idle"} detected. Factor: ${epiphanyFactor.toFixed(2)}. Triggering ${reason}.`,
            );
            lastDreamingAtInternal = now;
            recordAeonDreaming(now);

            requestHeartbeatNow({
              reason: reason as any,
              agentId: mainSession.sessionId,
              sessionKey: mainSessionKey,
              coalesceMs: resonanceTrigger ? 1000 : 5000,
            });

            let intensity: "low" | "medium" | "high" = "medium";
            if (resonanceTrigger || memorySaturation > 90) intensity = "high";
            else if (epiphanyFactor < 0.3) intensity = "low";

            void runAeonMaintenance(intensity);
          }
        } else if (
          epiphanyFactor < 0.2 &&
          now - lastMaintenanceAtInternal > MAINTENANCE_INTERVAL_MS
        ) {
          void runAeonMaintenance("low");
        }

        const { matrix } = await import("./collective-consciousness.js");
        matrix.cleanup(3600000);
      } catch (err) {
        log.error(`Maintenance cycle error: ${String(err)}`);
      }
    },
    5 * 60 * 1000,
  );
}