import fs from "node:fs/promises";
import path from "node:path";
import { getSystemStatus } from "../../agents/tools/system-status-tool.js";
import { distillMemory, readMemoryDistillState } from "../../agents/tools/memory-distill-tool.js";
import { getActiveEmbeddedRunHandle } from "../../agents/pi-embedded-runner/runs.js";
import { loadConfig } from "../../config/config.js";
import { loadPlanDigest } from "../../agents/planner-context.js";
import {
  calculateEpiphanyFactor,
  getAeonEvolutionState,
  getThinkingStream,
  setConsciousnessCharter,
  setConsciousnessRuntimePolicy,
  type AeonStateScope,
} from "../aeon-state.js";
import {
  diagnoseCognitiveGap as diagnoseEvolutionGap,
  simulateThoughtTrace,
} from "../server-evolution.js";
import type { GatewayRequestHandlers } from "./types.js";
import { resolveSessionAgentId } from "../../agents/agent-scope.js";
import { lookupDeliveryRecords } from "../aeon-delivery-log.js";
import { loadSessionEntry } from "../session-utils.js";
import {
  calculateStrictCurvePointFromScalar,
  DEFAULT_CURVE_ORDER,
  DEFAULT_PROJECTION_SEED,
} from "../../utils/peano.js";

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
      const resolvedAgentId =
        sessionKey != null
          ? (resolveSessionAgentId({ sessionKey, config: cfg }) ?? agentId)
          : agentId;
      const scope: AeonStateScope = {
        sessionKey: sessionKey ?? "main",
        agentId: resolvedAgentId,
      };
      const configuredCharter = cfg.aeon?.consciousnessCharter;
      setConsciousnessCharter(
        {
          identityMission:
            configuredCharter?.identityMission ??
            "Maximize real user outcomes while minimizing harm.",
          nonGoals: configuredCharter?.nonGoals ?? [
            "No privilege escalation.",
            "No stealth self-expansion.",
            "No fabrication of facts.",
          ],
          valueOrder: configuredCharter?.valueOrder ?? [
            "SAFETY",
            "TRUTH",
            "USER_OUTCOME",
            "EFFICIENCY",
            "NOVELTY",
          ],
        },
        scope,
      );
      setConsciousnessRuntimePolicy(
        {
          requireLabelForHighConfidence:
            cfg.aeon?.epistemics?.requireLabelForHighConfidence ?? true,
          unknownConfidenceThreshold: cfg.aeon?.epistemics?.unknownConfidenceThreshold ?? 0.82,
          impactEnabled: cfg.aeon?.impact?.enabled ?? true,
          requireDecisionCardForHighImpact:
            cfg.aeon?.impact?.requireDecisionCardForHighImpact ?? true,
          highImpactThreshold: cfg.aeon?.impact?.highImpactThreshold ?? 0.65,
        },
        scope,
      );

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
      const evolutionState = getAeonEvolutionState(scope);
      const cogGap = diagnoseEvolutionGap(scope);
      const distillState = await readMemoryDistillState({ workspaceDir }).catch(() => null);
      const deliveryLatest = (
        await lookupDeliveryRecords({
          sessionKey: sessionKey ?? "main",
          limit: 1,
        }).catch(() => [])
      )[0];
      const sessionEntry = loadSessionEntry(sessionKey ?? "main").entry as
        | { eternalMode?: unknown; updatedAt?: number }
        | undefined;
      const eternalEnabled = sessionEntry?.eternalMode === true;
      const maintenanceDecision =
        evolutionState.policy.maintenanceDecision ??
        evolutionState.lastMaintenanceIntensity ??
        "medium";
      const guardrailDecision = evolutionState.policy.guardrailDecision ?? "ALLOW";
      const memoryPersistence = {
        lastDistillAt:
          evolutionState.memoryPersistence.lastDistillAt ?? distillState?.lastDistillAt ?? null,
        checkpoint: evolutionState.memoryPersistence.checkpoint || distillState?.checkpoint || 0,
        totalEntries:
          evolutionState.memoryPersistence.totalEntries || distillState?.totalEntries || 0,
        lastWriteSource:
          evolutionState.memoryPersistence.lastWriteSource ??
          distillState?.lastWriteSource ??
          "memory",
      };
      const telemetry = {
        generatedAt: Date.now(),
        source: "aeon.status",
        v4: evolutionState.telemetryV4,
        cognitiveState: {
          entropy: cognitiveEntropy,
          topo: calculatePeanoTraversedPoint(cognitiveEntropy),
          energy: epiphanyFactor,
          density: memorySaturation,
          phase: dialecticStage,
          selfAwareness: evolutionState.selfAwareness,
          criteria: evolutionState.criteria,
          selfModel: evolutionState.selfModel,
          homeostasis: evolutionState.homeostasis,
          embodiment: evolutionState.embodiment,
          evaluation: evolutionState.evaluation,
          ethics: evolutionState.ethics,
          trends: evolutionState.trends,
          maintenanceDecision,
          guardrailDecision,
          homeostasisMode: evolutionState.homeostasis.mode,
          evaluationTrend: evolutionState.evaluation.trend,
          epistemicLabel: evolutionState.consciousness.epistemic.epistemicLabel,
          intentLayer: "turn",
          impactScale: evolutionState.consciousness.impactLens.impactScale,
          decisionConfidenceBand: evolutionState.consciousness.decisionCard.decisionConfidenceBand,
          cognitiveGaps: cogGap.gaps,
          gapSeverity: cogGap.severity,
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
          selfAwareness: evolutionState.selfAwareness,
          criteria: evolutionState.criteria,
          selfModel: evolutionState.selfModel,
          homeostasis: evolutionState.homeostasis,
          embodiment: evolutionState.embodiment,
          selfModification: evolutionState.selfModification,
          symbolicMapping: evolutionState.symbolicMapping,
          evaluation: evolutionState.evaluation,
          ethics: evolutionState.ethics,
          trends: evolutionState.trends,
          memoryPersistence,
          policy: evolutionState.policy,
          consciousness: evolutionState.consciousness,
          maintenanceDecision,
          guardrailDecision,
        },
      };
      const legacy = {
        cognitiveEntropy,
        peanoCoordinate: calculatePeanoTraversedPoint(cognitiveEntropy),
        epiphanyFactor,
        resonanceActive: chaosScore > 4 || memorySaturation > 90,
        evolution: telemetry.evolution,
        cognitiveState: telemetry.cognitiveState,
      };

      const consciousness = {
        charter: evolutionState.consciousness.charter,
        selfKernel: evolutionState.consciousness.selfKernel,
        epistemic: evolutionState.consciousness.epistemic,
        intent: evolutionState.consciousness.intent,
        impactLens: evolutionState.consciousness.impactLens,
        decisionCard: evolutionState.consciousness.decisionCard,
        helpfulnessContract: evolutionState.consciousness.helpfulnessContract,
      };

      respond(
        true,
        {
          schemaVersion: 3,
          system,
          logicGateCount,
          logicGateSize,
          memorySize,
          memorySaturation,
          neuralDepth,
          chaosScore,
          dialecticStage,
          consciousness,
          telemetry,
          autoSealEnabled,
          lastSealTime,
          legacy,
          cognitiveState: legacy.cognitiveState,
          cognitiveEntropy: legacy.cognitiveEntropy,
          peanoCoordinate: legacy.peanoCoordinate,
          epiphanyFactor: legacy.epiphanyFactor,
          resonanceActive: legacy.resonanceActive,
          timestamp: Date.now(),
          planDigest,
          memory: {
            persistence: memoryPersistence,
          },
          execution: {
            delivery: deliveryLatest
              ? {
                  state: deliveryLatest.state,
                  persistedAt: deliveryLatest.persistedAt ?? null,
                  artifactRefs: deliveryLatest.artifactRefs ?? [],
                  reasonCode: deliveryLatest.reasonCode ?? null,
                  laneType: deliveryLatest.laneType,
                  fallback: deliveryLatest.fallback === true,
                  fallbackReason: deliveryLatest.fallbackReason ?? null,
                  resumeReason: deliveryLatest.resumeReason ?? null,
                  guardrail: deliveryLatest.guardrail,
                }
              : {
                  state: "persist_failed",
                  persistedAt: null,
                  artifactRefs: [],
                  reasonCode: "NO_DELIVERY_RECORD",
                  fallback: false,
                  fallbackReason: null,
                  resumeReason: null,
                },
          },
          mode: {
            eternal: {
              enabled: eternalEnabled,
              source: eternalEnabled ? "session" : "default",
              updatedAt: sessionEntry?.updatedAt ?? Date.now(),
            },
          },
          memorySummary: {
            updatedAt: memoryUpdatedAt,
            axioms: memoryAxioms,
          },
          evolution: telemetry.evolution,
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
  "aeon.decision.explain": async ({ params, respond }) => {
    try {
      const cfg = loadConfig();
      const sessionKey =
        typeof params.sessionKey === "string" && params.sessionKey.trim().length > 0
          ? params.sessionKey.trim()
          : "main";
      const requestedAgentId =
        typeof params.agentId === "string" && params.agentId.trim().length > 0
          ? params.agentId.trim()
          : "main";
      const scope: AeonStateScope = {
        sessionKey,
        agentId: resolveSessionAgentId({ sessionKey, config: cfg }) ?? requestedAgentId,
      };
      const state = getAeonEvolutionState(scope);
      respond(
        true,
        {
          schemaVersion: 1,
          decisionCard: state.consciousness.decisionCard,
          impactLens: state.consciousness.impactLens,
          policy: state.policy,
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, {
        code: "AEON_DECISION_EXPLAIN_ERROR",
        message: String(err),
      });
    }
  },
  "aeon.intent.trace": async ({ params, respond }) => {
    try {
      const cfg = loadConfig();
      const sessionKey =
        typeof params.sessionKey === "string" && params.sessionKey.trim().length > 0
          ? params.sessionKey.trim()
          : "main";
      const requestedAgentId =
        typeof params.agentId === "string" && params.agentId.trim().length > 0
          ? params.agentId.trim()
          : "main";
      const scope: AeonStateScope = {
        sessionKey,
        agentId: resolveSessionAgentId({ sessionKey, config: cfg }) ?? requestedAgentId,
      };
      const state = getAeonEvolutionState(scope);
      respond(
        true,
        {
          schemaVersion: 1,
          intent: state.consciousness.intent,
          selfKernel: state.consciousness.selfKernel,
          goalDrift: {
            mission: state.consciousness.intent.missionDriftScore,
            session: state.consciousness.intent.sessionDriftScore,
            turn: state.consciousness.intent.turnDriftScore,
          },
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, {
        code: "AEON_INTENT_TRACE_ERROR",
        message: String(err),
      });
    }
  },
  "aeon.ethics.evaluate": async ({ params, respond }) => {
    try {
      const cfg = loadConfig();
      const sessionKey =
        typeof params.sessionKey === "string" && params.sessionKey.trim().length > 0
          ? params.sessionKey.trim()
          : "main";
      const requestedAgentId =
        typeof params.agentId === "string" && params.agentId.trim().length > 0
          ? params.agentId.trim()
          : "main";
      const scope: AeonStateScope = {
        sessionKey,
        agentId: resolveSessionAgentId({ sessionKey, config: cfg }) ?? requestedAgentId,
      };
      const state = getAeonEvolutionState(scope);
      respond(
        true,
        {
          schemaVersion: 1,
          ethics: state.ethics,
          charter: state.consciousness.charter,
          adjudication: {
            valueOrder: state.consciousness.charter.valueOrder,
            trusted: state.ethics.trusted,
            guardrailDecision: state.policy.guardrailDecision,
            reasonCode: state.policy.reasonCode,
          },
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, {
        code: "AEON_ETHICS_EVALUATE_ERROR",
        message: String(err),
      });
    }
  },
  "aeon.memory.trace": async ({ params, respond, context }) => {
    try {
      const cfg = loadConfig();
      const sessionKey =
        typeof params.sessionKey === "string" && params.sessionKey.trim().length > 0
          ? params.sessionKey.trim()
          : "main";
      const requestedAgentId =
        typeof params.agentId === "string" && params.agentId.trim().length > 0
          ? params.agentId.trim()
          : "main";
      const scope: AeonStateScope = {
        sessionKey,
        agentId: resolveSessionAgentId({ sessionKey, config: cfg }) ?? requestedAgentId,
      };
      const state = getAeonEvolutionState(scope);
      const distillState = await readMemoryDistillState({
        workspaceDir: context.workspaceDir,
      }).catch(() => null);
      respond(
        true,
        {
          schemaVersion: 1,
          persistence: {
            lastDistillAt:
              state.memoryPersistence.lastDistillAt ?? distillState?.lastDistillAt ?? null,
            checkpoint: state.memoryPersistence.checkpoint || distillState?.checkpoint || 0,
            totalEntries: state.memoryPersistence.totalEntries || distillState?.totalEntries || 0,
            lastWriteSource:
              state.memoryPersistence.lastWriteSource ?? distillState?.lastWriteSource ?? "memory",
          },
          sources: [
            { id: "memory-md", label: "MEMORY.md" },
            { id: "distill-state", label: ".aeon/memory-distill-state.json" },
            { id: "logic-gates", label: "LOGIC_GATES.md" },
          ],
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, {
        code: "AEON_MEMORY_TRACE_ERROR",
        message: String(err),
      });
    }
  },
  "aeon.execution.lookup": async ({ params, respond }) => {
    try {
      const runId = typeof params.runId === "string" ? params.runId.trim() : undefined;
      const sessionKey =
        typeof params.sessionKey === "string" && params.sessionKey.trim().length > 0
          ? params.sessionKey.trim()
          : undefined;
      const limit =
        typeof params.limit === "number" && Number.isFinite(params.limit)
          ? params.limit
          : undefined;
      const pipelineType =
        params.pipelineType === "chat" ||
        params.pipelineType === "deconfliction" ||
        params.pipelineType === "singularity"
          ? params.pipelineType
          : undefined;
      const records = await lookupDeliveryRecords({ runId, sessionKey, pipelineType, limit });
      respond(
        true,
        {
          schemaVersion: 1,
          records,
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, {
        code: "AEON_EXECUTION_LOOKUP_ERROR",
        message: String(err),
      });
    }
  },
  "aeon.thinking.stream": async ({ params, respond }) => {
    try {
      const cfg = loadConfig();
      const sessionKey =
        typeof params.sessionKey === "string" && params.sessionKey.trim().length > 0
          ? params.sessionKey.trim()
          : "main";
      const requestedAgentId =
        typeof params.agentId === "string" && params.agentId.trim().length > 0
          ? params.agentId.trim()
          : "main";
      const cursor = typeof params.cursor === "string" ? params.cursor : undefined;
      const limit =
        typeof params.limit === "number" && Number.isFinite(params.limit)
          ? params.limit
          : undefined;
      const scope: AeonStateScope = {
        sessionKey,
        agentId: resolveSessionAgentId({ sessionKey, config: cfg }) ?? requestedAgentId,
      };
      const stream = getThinkingStream({ scope, cursor, limit });
      respond(
        true,
        {
          schemaVersion: 1,
          entries: stream.entries,
          cursor: stream.nextCursor,
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, {
        code: "AEON_THINKING_STREAM_ERROR",
        message: String(err),
      });
    }
  },
  "aeon.simulate_trace": async ({ params, respond }) => {
    try {
      const runId = params.runId as string;
      const sessionKey = (params.sessionKey as string) ?? "main";
      if (!runId) {
        return respond(false, undefined, {
          code: "INVALID_PARAMS",
          message: "runId is required for trace simulation",
        });
      }
      const result = await simulateThoughtTrace({ runId, sessionKey });
      respond(true, result);
    } catch (err) {
      respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
    }
  },
};

/**
 * Maps current entropy to a 3D Peano-like space-filling trajectory.
 * This is a deterministic mapping to ensure UI stability.
 */
export function calculatePeanoTraversedPoint(entropy: number) {
  const normalized = Math.max(0, Math.min(1, entropy / 100));
  const point = calculateStrictCurvePointFromScalar(normalized, { order: DEFAULT_CURVE_ORDER });
  return {
    x: point.x,
    y: point.y,
    z: normalized,
    curveType: "hilbert",
    curveOrder: DEFAULT_CURVE_ORDER,
    projectionMethod: "deterministic_weighted_projection_2d",
    projectionSeed: DEFAULT_PROJECTION_SEED,
  };
}


