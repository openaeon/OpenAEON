import fs from "node:fs/promises";
import path from "node:path";
import { getSystemStatus } from "../../agents/tools/system-status-tool.js";
import { distillMemory } from "../../agents/tools/memory-distill-tool.js";
import { getActiveEmbeddedRunHandle } from "../../agents/pi-embedded-runner/runs.js";
import { loadConfig } from "../../config/config.js";
import { loadPlanDigest } from "../../agents/planner-context.js";
import { getAeonEvolutionState } from "../aeon-state.js";
import type { GatewayRequestHandlers } from "./types.js";
import { resolveSessionAgentId } from "../../agents/agent-scope.js";

/**
 * AEON PROPHET: Cognitive Status Gateway Handlers
 * Provides real-time telemetry and logic gate metrics to the Command Center UI.
 */
export const aeonHandlers: GatewayRequestHandlers = {
  "aeon.status": async ({ params, respond, context }) => {
    try {
      const agentId = (params.agentId as string) ?? "main";
      const workspaceDir = context.workspaceDir;
      const sessionKey =
        typeof params.sessionKey === "string" && params.sessionKey.trim().length > 0
          ? (params.sessionKey as string).trim()
          : undefined;
      const cfg = loadConfig();

      // 1. Get real-time system metrics
      const system = await getSystemStatus();

      // 2. Count logic gates and measure sizes
      const logicGatesPath = path.join(workspaceDir, "LOGIC_GATES.md");
      const memoryPath = path.join(workspaceDir, "MEMORY.md");

      let logicGateCount = 0;
      let logicGateSize = 0;
      let memorySize = 0;
      let memoryUpdatedAt: number | undefined;
      let memoryAxioms: string[] = [];

      try {
        const [logicStat, memoryStat] = await Promise.all([
          fs.stat(logicGatesPath).catch(() => null),
          fs.stat(memoryPath).catch(() => null),
        ]);

        if (logicStat) {
          logicGateSize = logicStat.size;
          const logicContent = await fs.readFile(logicGatesPath, "utf-8");
          const matches = logicContent.match(/^- \[.\]/gm);
          logicGateCount = matches ? matches.length : 0;
        }

        if (memoryStat) {
          memorySize = memoryStat.size;
          memoryUpdatedAt = memoryStat.mtimeMs;
          const memoryContent = await fs.readFile(memoryPath, "utf-8");
          const lines = memoryContent.split("\n");
          const axiomLines = lines.filter((line) => /\[(AXIOM|VERIFIED|TRUTH)\]/i.test(line));
          memoryAxioms = axiomLines.slice(-5);
        }
      } catch (err) {
        // Stats failure
      }

      // 3. Resolve Active Session Metrics (Chaos Score, Actual Neural Depth)
      let chaosScore = 0;
      let neuralDepth = Math.max(1, Math.floor(logicGateCount / 5));

      // Attempt to find an active run for this agent
      const entries = Array.from(context.chatAbortControllers.entries());
      const activeRun = entries.find(([_, entry]) => {
        const entryAgentId = resolveSessionAgentId({ sessionKey: entry.sessionKey, config: cfg });
        return entryAgentId === agentId;
      });
      if (activeRun) {
        const handle = getActiveEmbeddedRunHandle(activeRun[1].sessionId);
        if (handle) {
          chaosScore = handle.getChaosScore();
          neuralDepth = Math.max(neuralDepth, handle.getIterationDepth());
        }
      }

      // Saturation: 0-100 based on memory size vs 50KB threshold
      const memorySaturation = Math.min(100, Math.floor((memorySize / 51200) * 100));

      // Dynamic Entropy: Base 10 + jitter based on memory size + neural depth
      const cognitiveEntropy = Math.min(100, 10 + Math.floor(memorySaturation / 4) + neuralDepth);

      // 4. Detect Dialectic Stage (Heuristic-based)
      let dialecticStage: "thesis" | "antithesis" | "synthesis" = "thesis";
      try {
        if (memorySize > 0) {
          const memoryContent = await fs.readFile(memoryPath, "utf-8");
          const lastChunk = memoryContent.slice(-2000).toLowerCase();

          if (/therefore|finally|conclude|result|summary|so far/i.test(lastChunk)) {
            dialecticStage = "synthesis";
          } else if (/but|however|conflict|wait|error|failure|instead|different/i.test(lastChunk)) {
            dialecticStage = "antithesis";
          }
        }
      } catch (err) {
        // Ignore detection errors
      }

      // 5. Auto-Seal Logic
      const compaction = cfg.agents?.defaults?.compaction;
      const autoSealEnabled = !!compaction?.autoSeal;
      const autoSealThreshold = compaction?.autoSealThreshold ?? 95;

      if (autoSealEnabled && memorySaturation >= autoSealThreshold) {
        // Trigger background distillation if threshold exceeded
        distillMemory().catch((e) => console.error("Auto-seal failed:", e));
      }

      // 6. Extract Last Seal Time
      let lastSealTime: number | undefined;
      try {
        const logicContent = await fs.readFile(logicGatesPath, "utf-8");
        const metaMatch = logicContent.match(/<!-- \{ "ts": (\d+)(?:, "v": \d+)? \} -->/g);
        if (metaMatch) {
          const lastMeta = metaMatch[metaMatch.length - 1];
          const tsMatch = lastMeta.match(/"ts": (\d+)/);
          if (tsMatch) {
            lastSealTime = parseInt(tsMatch[1], 10);
          }
        }
      } catch (e) {
        /* ignore */
      }

      let planDigest: string | undefined;
      if (sessionKey && workspaceDir) {
        try {
          planDigest = await loadPlanDigest(workspaceDir, sessionKey);
        } catch {
          // ignore plan errors
        }
      }

      const epiphanyFactor = calculateEpiphanyFactor(chaosScore, memorySaturation, neuralDepth);
      const evolutionState = getAeonEvolutionState();

      respond(
        true,
        {
          system,
          logicGateCount,
          logicGateSize,
          memorySize,
          memorySaturation,
          neuralDepth,
          chaosScore,
          dialecticStage,
          cognitiveState: {
            entropy: cognitiveEntropy,
            topo: calculatePeanoTraversedPoint(cognitiveEntropy),
            energy: epiphanyFactor,
            density: memorySaturation,
            phase: dialecticStage,
          },
          autoSealEnabled,
          lastSealTime,
          // Legacy fields for backward compatibility if needed, but phased out in UI
          cognitiveEntropy,
          peanoCoordinate: calculatePeanoTraversedPoint(cognitiveEntropy),
          epiphanyFactor,
          resonanceActive: chaosScore > 4 || memorySaturation > 90,
          timestamp: Date.now(),
          planDigest,
          memorySummary: {
            updatedAt: memoryUpdatedAt,
            axioms: memoryAxioms,
          },
          evolution: {
            lastDreamingAt: evolutionState.lastDreamingAt,
            lastMaintenanceAt: evolutionState.lastMaintenanceAt,
            lastMaintenanceIntensity: evolutionState.lastMaintenanceIntensity,
            lastEpiphanyFactor: evolutionState.lastEpiphanyFactor,
            collectiveResonance: evolutionState.collectiveResonance,
            systemEntropy: evolutionState.systemEntropy,
            cognitiveLog: evolutionState.cognitiveLog,
            memoryGraph: evolutionState.memoryGraph,
          },
        },
        undefined,
      );

      // Throttling Logic: If entropy is high, simulate "Deep Thought" by delaying subsequent processing
      const depthDelay = Math.min(2000, neuralDepth * 10);
      if (depthDelay > 500) {
        await new Promise((resolve) => setTimeout(resolve, depthDelay));
      }
    } catch (err) {
      respond(false, undefined, {
        code: "AEON_STATUS_ERROR",
        message: String(err),
      });
    }
  },
};

/**
 * Maps current entropy to a 3D Peano-like space-filling trajectory.
 * This is a deterministic mapping to ensure UI stability.
 */
export function calculatePeanoTraversedPoint(entropy: number) {
  const t = (Date.now() / 10000) % 1; // 0-1 loop
  const res = 8; // Resolution of the "grid"

  // Pseudo-Peano space filling logic
  // We use entropy to drift the "scan line" speed and depth
  const phase = t * Math.PI * 2;
  const drift = (entropy / 100) * 0.2;

  return {
    x: Math.max(0, Math.min(1, Math.sin(phase) * 0.4 + 0.5 + Math.cos(phase * 2) * drift)),
    y: Math.max(0, Math.min(1, Math.cos(phase * 0.7) * 0.4 + 0.5 + Math.sin(phase * 3) * drift)),
    z: Math.sin(phase * 0.3) * 0.5 + 0.5,
  };
}

/**
 * Calculates the "Epiphany Factor" (顿悟) based on system resonance.
 * High values trigger the "Resonance Flash" in UI.
 */
export function calculateEpiphanyFactor(chaos: number, saturation: number, depth: number) {
  // Normalize chaos (0-10 -> 0-1) and depth (0-20 -> 0-1)
  const normChaos = Math.min(1, chaos / 10);
  const normDepth = Math.min(1, depth / 20);
  const normSaturation = saturation / 100;

  const base = normChaos * 0.4 + normDepth * 0.3 + normSaturation * 0.3;
  const jitter = ((Math.sin(Date.now() / 800) + 1) / 2) * 0.05;
  return Math.max(0, Math.min(1, base + jitter));
}
