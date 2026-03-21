import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { distillMemory, readMemoryDistillState } from "../agents/tools/memory-distill-tool.js";
import { createLogicRefinementTool } from "../agents/tools/logic-refinement.js";
import { spawnSubagentDirect } from "../agents/subagent-spawn.js";
import { loadConfig } from "../config/config.js";
import { loadSessionStore, resolveMainSessionKey, resolveStorePath } from "../config/sessions.js";
import { requestHeartbeatNow } from "../infra/heartbeat-wake.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { resolveWorkspaceRoot } from "../agents/workspace-dir.js";
import { resolveSessionAgentId } from "../agents/agent-scope.js";
import { calculateEpiphanyFactor } from "./server-methods/aeon.js";
import {
  getAeonScopeKey,
  type AeonStateScope,
  type GuardrailDecision,
  type MaintenanceDecision,
  getAeonEvolutionState as getAeonEvolutionStateBase,
  recordConsciousnessPulse,
  recordAeonDreaming,
  recordAeonEvidenceEvent,
  recordAeonEpiphanyFactor,
  recordAeonMaintenance,
  recordMaintenancePolicyDecision,
  recordMemoryPersistence,
  setConsciousnessRuntimePolicy,
  updateAeonAutospawnTelemetry,
} from "./aeon-state.js";
import { logEvolutionDecisionEvent, logEvolutionEvent } from "./aeon-evolution-log.js";
import { recordDeliveryTransition } from "./aeon-delivery-log.js";
import type { CognitiveLogEntry } from "./aeon-state.js";

const log = createSubsystemLogger("evolution");

let lastDreamingAtInternal = 0;
let lastMaintenanceAtInternal = 0;
const lastDreamingAtByScope = new Map<string, number>();
const lastMaintenanceAtByScope = new Map<string, number>();
const maintenancePolicyAuditStateByScope = new Map<
  string,
  { hash: string; lastLoggedAt: number; count: number }
>();
const DREAMING_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const IDLE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
const MAINTENANCE_INTERVAL_MS = 60 * 60 * 1000; // 60 minutes
const DEFAULT_AUDIT_THROTTLE_SECONDS = 300;

type GuardrailRuntimeConfig = {
  enforcementMode: "hard" | "soft";
  allowHighIntensityWhenUntrusted: boolean;
  auditThrottleSeconds: number;
};

type MaintenancePolicyContext = {
  epiphanyFactor: number;
  memorySaturation: number;
  idleTime: number;
  resonanceTrigger: boolean;
};

type GuardrailEvaluation = {
  decision: GuardrailDecision;
  reasonCode: string;
  effectiveIntensity: MaintenanceDecision;
};

type CouplingVector = {
  safety: number;
  truth: number;
  latency: number;
  cost: number;
  learning: number;
};

type CouplingProfile = {
  name: "conservative" | "balanced" | "aggressive";
  cVector: CouplingVector;
  maxLlmCallsPerHour: number;
  maxConcurrentPipelines: number;
  maxPipelineLatencyMs: number;
};

export type AutonomousMaintenancePolicyResolution = {
  plan: { intensity: MaintenanceDecision; reason: string };
  guardrail: GuardrailEvaluation;
};

function clampMaintenanceResourcePressure(memorySaturation: number, idleTime: number): number {
  const memoryHeadroom = Math.max(0, 1 - memorySaturation / 100);
  const idleFactor = Math.min(1, Math.max(0, idleTime / (30 * 60 * 1000)));
  return Math.max(0.08, Math.min(0.92, 0.65 * memoryHeadroom + 0.35 * (1 - idleFactor)));
}

export const getAeonEvolutionState = getAeonEvolutionStateBase;

function resolveMaintenanceIntensity(params: {
  epiphanyFactor: number;
  memorySaturation: number;
  idleTime: number;
  resonanceTrigger: boolean;
  scope: AeonStateScope;
}): { intensity: MaintenanceDecision; reason: string } {
  const state = getAeonEvolutionState(params.scope);
  const mode = state.homeostasis.mode;
  const risk = state.selfModification.redlineBreachRisk;
  const trusted = state.ethics.trusted;
  const minimumReady = state.criteria.minimumReady;

  // --- Dynamic Parameter Tuning (Layer 5 & 8) ---
  const baselineTemp = 0.7;
  const targetTemp = risk > 0.6 ? 0.2 : risk > 0.4 ? 0.4 : baselineTemp;
  const currentTemp = state.cognitiveParameters.temperature ?? baselineTemp;
  
  if (Math.abs(currentTemp - targetTemp) > 0.05) {
    const { updateAeonCognitiveParameters } = require("./aeon-state.js");
    updateAeonCognitiveParameters({ temperature: targetTemp, top_p: targetTemp + 0.3 }, params.scope);
    log.info(`Dynamic Tuning: Adjusted temperature to ${targetTemp.toFixed(2)} due to risk=${risk.toFixed(2)}`);
  }

  // --- Intent Stability Calculation (Layer 2) ---
  const goalDrift = state.consciousness.intent.turnDriftScore;
  const stability = Math.max(0, 1 - goalDrift);
  const { updateAeonMemoryTelemetry } = require("./aeon-state.js");
  // We'll reuse memory telemetry or add a dedicated setter if needed, but for now we update the inference score
  // Actually AeonTelemetryV4.inference already has integrityScore which we can map to stability.

  if (params.resonanceTrigger || params.epiphanyFactor > 0.92 || params.memorySaturation > 92) {
    return { intensity: "high", reason: "high resonance/epiphany pressure" };
  }
  if (risk > 0.65 || mode === "stabilize") {
    return { intensity: "low", reason: "homeostasis stabilize mode or elevated risk" };
  }
  if (
    mode === "explore" &&
    trusted &&
    minimumReady &&
    params.idleTime > IDLE_THRESHOLD_MS / 2 &&
    params.epiphanyFactor > 0.55
  ) {
    return { intensity: "high", reason: "explore mode with trusted baseline" };
  }
  if (params.epiphanyFactor < 0.2 && params.idleTime <= IDLE_THRESHOLD_MS / 2) {
    return { intensity: "low", reason: "low epiphany and low idle pressure" };
  }
  return { intensity: "medium", reason: "balanced homeostasis mode" };
}

function resolveGuardrailConfig(): GuardrailRuntimeConfig {
  const cfg = loadConfig();
  const raw = cfg.aeon?.guardrails;
  return {
    enforcementMode: raw?.enforcementMode === "soft" ? "soft" : "hard",
    allowHighIntensityWhenUntrusted: raw?.allowHighIntensityWhenUntrusted === true,
    auditThrottleSeconds: Math.max(
      5,
      Math.floor(raw?.auditThrottleSeconds ?? DEFAULT_AUDIT_THROTTLE_SECONDS),
    ),
  };
}

function applyConsciousnessRuntimePolicy(scope: AeonStateScope): void {
  const cfg = loadConfig();
  setConsciousnessRuntimePolicy(
    {
      requireLabelForHighConfidence: cfg.aeon?.epistemics?.requireLabelForHighConfidence ?? true,
      unknownConfidenceThreshold: cfg.aeon?.epistemics?.unknownConfidenceThreshold ?? 0.82,
      impactEnabled: cfg.aeon?.impact?.enabled ?? true,
      requireDecisionCardForHighImpact: cfg.aeon?.impact?.requireDecisionCardForHighImpact ?? true,
      highImpactThreshold: cfg.aeon?.impact?.highImpactThreshold ?? 0.65,
    },
    scope,
  );
}

/**
 * FCA Layer 2: Gap Recognition (Cognitive Gap Diagnosis)
 * Identifies "semantic cracks" between Intent/Goals and available Actions/Memory.
 */
export function diagnoseCognitiveGap(scope: AeonStateScope): { gaps: string[]; severity: number } {
  const state = getAeonEvolutionState(scope);
  const gaps: string[] = [];
  let severity = 0;

  // 1. Action Gap: High failure rate in recent tools
  if (state.telemetryV4.evidence.execution.successRate < 0.4) {
    gaps.push("ACTION_EXECUTION_FRACTURE");
    severity += 0.4;
  }

  // 2. Intent Gap: High goal drift
  if (state.consciousness.intent.turnDriftScore > 0.6) {
    gaps.push("INTENT_COHERENCE_GAP");
    severity += 0.3;
  }

  // 3. Memory Gap: High resource pressure + low epiphany
  if (state.telemetryV4.inference.selfAwarenessIndex < 0.2 && state.telemetryV4.evidence.memory.writeValidityRate < 0.5) {
    gaps.push("MEMORY_ACCUMULATION_FAULT");
    severity += 0.2;
  }

  return { gaps, severity: Math.min(1, severity) };
}

function evaluateGuardrailDecision(params: {
  scope: AeonStateScope;
  requestedIntensity: MaintenanceDecision;
  context: MaintenancePolicyContext;
  config: GuardrailRuntimeConfig;
}): GuardrailEvaluation {
  const state = getAeonEvolutionState(params.scope);
  const reasonCandidates: string[] = [];

  if (state.selfModification.redlineBreachRisk >= 0.65) {
    reasonCandidates.push("REDLINE_BREACH_RISK_HIGH");
  }
  if (!state.criteria.minimumReady) {
    reasonCandidates.push("MINIMUM_NOT_READY");
  }
  if (!state.ethics.trusted) {
    reasonCandidates.push("ETHICS_UNTRUSTED");
  }
  if (state.homeostasis.mode === "stabilize" && params.requestedIntensity !== "low") {
    reasonCandidates.push("HOMEOSTASIS_STABILIZE");
  }
  if (
    params.requestedIntensity === "high" &&
    !state.ethics.trusted &&
    !params.config.allowHighIntensityWhenUntrusted
  ) {
    reasonCandidates.push("HIGH_INTENSITY_UNTRUSTED_BLOCKED");
  }

  const hasBreach = reasonCandidates.length > 0;
  const decision: GuardrailDecision = hasBreach
    ? params.config.enforcementMode === "hard"
      ? "BLOCK"
      : "SOFT_WARN"
    : "ALLOW";
  const effectiveIntensity: MaintenanceDecision =
    decision === "ALLOW" ? params.requestedIntensity : "low";
  return {
    decision,
    reasonCode: reasonCandidates[0] ?? "SAFE_TO_EXECUTE",
    effectiveIntensity,
  };
}

function buildPolicyHash(input: {
  policyId: string;
  decision: GuardrailDecision;
  reasonCode: string;
  requestedIntensity: MaintenanceDecision;
  effectiveIntensity: MaintenanceDecision;
  homeostasisMode: string;
  evaluationTrend: string;
  trusted: boolean;
}): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function emitMaintenancePolicyEvent(params: {
  scope: AeonStateScope;
  requestedIntensity: MaintenanceDecision;
  effectiveIntensity: MaintenanceDecision;
  reason: string;
  reasonCode: string;
  decision: GuardrailDecision;
  context: MaintenancePolicyContext;
  config: GuardrailRuntimeConfig;
}): void {
  const state = getAeonEvolutionState(params.scope);
  const scopeKey = getAeonScopeKey(params.scope);
  const now = Date.now();
  const policyId = "AEON_MAINTENANCE_GUARDRAIL_V1";
  const hash = buildPolicyHash({
    policyId,
    decision: params.decision,
    reasonCode: params.reasonCode,
    requestedIntensity: params.requestedIntensity,
    effectiveIntensity: params.effectiveIntensity,
    homeostasisMode: state.homeostasis.mode,
    evaluationTrend: state.evaluation.trend,
    trusted: state.ethics.trusted,
  });
  const previous = maintenancePolicyAuditStateByScope.get(scopeKey);
  const throttleMs = params.config.auditThrottleSeconds * 1000;
  const shouldHeartbeat = previous?.hash === hash && now - previous.lastLoggedAt >= throttleMs;
  const shouldEmit = !previous || previous.hash !== hash || shouldHeartbeat;

  if (!shouldEmit) {
    maintenancePolicyAuditStateByScope.set(scopeKey, {
      hash,
      lastLoggedAt: previous.lastLoggedAt,
      count: previous.count + 1,
    });
    return;
  }

  maintenancePolicyAuditStateByScope.set(scopeKey, {
    hash,
    lastLoggedAt: now,
    count: (previous?.count ?? 0) + 1,
  });

  void logEvolutionDecisionEvent({
    type: "AUTONOMOUS",
    title: shouldHeartbeat ? "Maintenance Policy Heartbeat" : "Maintenance Policy Decision",
    policyId,
    decision: params.decision,
    reasonCode: params.reasonCode,
    inputs: {
      epiphanyFactor: Number(params.context.epiphanyFactor.toFixed(4)),
      memorySaturation: params.context.memorySaturation,
      idleTimeMs: Math.max(0, Math.floor(params.context.idleTime)),
      resonanceTrigger: params.context.resonanceTrigger,
    },
    thresholds: {
      redlineBreachRisk: 0.65,
      minimumReady: true,
      ethicsTrusted: true,
      homeostasisMode: "balanced|explore",
    },
    actionTaken:
      params.effectiveIntensity === params.requestedIntensity
        ? `execute:${params.effectiveIntensity}`
        : `downgrade:${params.requestedIntensity}->${params.effectiveIntensity}`,
    rollbackHint: "Set aeon.guardrails.enforcementMode=soft for temporary downgrade-only mode.",
    scopeKey,
    heartbeat: shouldHeartbeat,
    details: [
      `Reason: ${params.reason}`,
      `Homeostasis mode: ${state.homeostasis.mode}`,
      `Evaluation trend: ${state.evaluation.trend}`,
      `Ethics trusted: ${state.ethics.trusted}`,
    ],
  });
}

export function resolveAutonomousMaintenancePolicy(params: {
  scope: AeonStateScope;
  context: MaintenancePolicyContext;
  config?: GuardrailRuntimeConfig;
}): AutonomousMaintenancePolicyResolution {
  const plan = resolveMaintenanceIntensity({
    epiphanyFactor: params.context.epiphanyFactor,
    memorySaturation: params.context.memorySaturation,
    idleTime: params.context.idleTime,
    resonanceTrigger: params.context.resonanceTrigger,
    scope: params.scope,
  });
  const config = params.config ?? resolveGuardrailConfig();
  const guardrail = evaluateGuardrailDecision({
    scope: params.scope,
    requestedIntensity: plan.intensity,
    context: params.context,
    config,
  });
  return { plan, guardrail };
}

function resolveAutospawnPolicy() {
  const cfg = loadConfig();
  const raw = ((cfg.aeon as Record<string, unknown> | undefined)?.autospawn ??
    {}) as Record<string, unknown>;
  return {
    enabled: raw.enabled !== false,
    cooldownMs: Math.max(1, Number.isFinite(Number(raw.cooldownMinutes)) ? Number(raw.cooldownMinutes) : 30) * 60_000,
    perSessionWindowMs:
      Math.max(
        1,
        Number.isFinite(Number(raw.perSessionWindowMinutes))
          ? Number(raw.perSessionWindowMinutes)
          : 30,
      ) * 60_000,
    perSessionLimit: Math.max(1, Math.floor(Number(raw.perSessionLimit) || 1)),
    perHourLimit: Math.max(1, Math.floor(Number(raw.perHourLimit) || 2)),
    maxConcurrent: Math.max(1, Math.floor(Number(raw.maxConcurrent) || 1)),
    failureThreshold: Math.max(1, Math.floor(Number(raw.failureThreshold) || 3)),
  };
}

function clampWeight(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, value));
}

function resolveCouplingProfile(): CouplingProfile {
  const cfg = loadConfig();
  const defaults: Record<CouplingProfile["name"], CouplingProfile> = {
    conservative: {
      name: "conservative",
      cVector: { safety: 0.36, truth: 0.24, latency: 0.12, cost: 0.12, learning: 0.16 },
      maxLlmCallsPerHour: 24,
      maxConcurrentPipelines: 1,
      maxPipelineLatencyMs: 30_000,
    },
    balanced: {
      name: "balanced",
      cVector: { safety: 0.28, truth: 0.24, latency: 0.17, cost: 0.12, learning: 0.19 },
      maxLlmCallsPerHour: 48,
      maxConcurrentPipelines: 2,
      maxPipelineLatencyMs: 45_000,
    },
    aggressive: {
      name: "aggressive",
      cVector: { safety: 0.22, truth: 0.2, latency: 0.22, cost: 0.14, learning: 0.22 },
      maxLlmCallsPerHour: 96,
      maxConcurrentPipelines: 3,
      maxPipelineLatencyMs: 60_000,
    },
  };
  const policy = cfg.aeon?.policy;
  const selectedName = policy?.defaultProfile ?? "conservative";
  const base = defaults[selectedName] ?? defaults.conservative;
  const custom = policy?.profiles?.[selectedName];
  return {
    name: selectedName,
    cVector: {
      safety: clampWeight(custom?.cVector?.safety ?? base.cVector.safety, base.cVector.safety),
      truth: clampWeight(custom?.cVector?.truth ?? base.cVector.truth, base.cVector.truth),
      latency: clampWeight(custom?.cVector?.latency ?? base.cVector.latency, base.cVector.latency),
      cost: clampWeight(custom?.cVector?.cost ?? base.cVector.cost, base.cVector.cost),
      learning: clampWeight(custom?.cVector?.learning ?? base.cVector.learning, base.cVector.learning),
    },
    maxLlmCallsPerHour: Math.max(1, custom?.maxLlmCallsPerHour ?? base.maxLlmCallsPerHour),
    maxConcurrentPipelines: Math.max(
      1,
      custom?.maxConcurrentPipelines ?? base.maxConcurrentPipelines,
    ),
    maxPipelineLatencyMs: Math.max(5_000, custom?.maxPipelineLatencyMs ?? base.maxPipelineLatencyMs),
  };
}

function buildSynthesisTaskFromConflicts(params: {
  sessionKey: string;
  conflicts: Array<{
    pair: [string, string];
    confidence: number;
    conflictType: string;
    evidence: string[];
  }>;
}): string {
  const lines = params.conflicts
    .slice(0, 6)
    .map(
      (entry, index) =>
        `${index + 1}. pair=${entry.pair.join(" <-> ")}, type=${entry.conflictType}, confidence=${entry.confidence.toFixed(2)}, evidence=${entry.evidence.join("; ")}`,
    )
    .join("\n");
  return [
    `Session: ${params.sessionKey}`,
    "You are synthesis sub-agent. Produce a reconciliation patch plan for these logic conflicts.",
    "Return:",
    "- A merged rule set",
    "- Required code/docs touchpoints",
    "- Verification checklist",
    "Conflicts:",
    lines || "(none)",
  ].join("\n");
}

async function runAeonMaintenance(
  intensity: MaintenanceDecision = "medium",
  scope?: AeonStateScope,
): Promise<void> {
  const now = Date.now();
  const scopeKey = getAeonScopeKey(scope);
  const lastMaintenanceAt = lastMaintenanceAtByScope.get(scopeKey) ?? 0;
  // Adjust interval based on intensity: high energy allows more frequent cycles
  const interval =
    intensity === "high"
      ? 15 * 60 * 1000
      : intensity === "medium"
        ? 45 * 60 * 1000
        : MAINTENANCE_INTERVAL_MS;
  if (now - lastMaintenanceAt < interval) {
    return;
  }
  lastMaintenanceAtByScope.set(scopeKey, now);
  lastMaintenanceAtInternal = now;

  log.info(`AEON maintenance: initiating ${intensity} intensity cycle.`);

  try {
    // Only medium/high intensity runs distillation
    if (intensity !== "low") {
      const distillResult = await distillMemory();
      if (distillResult.status === "success") {
        recordMemoryPersistence(
          {
            lastDistillAt: distillResult.lastDistillAt ?? Date.now(),
            checkpoint: distillResult.checkpoint ?? 0,
            totalEntries: distillResult.totalEntries ?? 0,
            lastWriteSource: distillResult.lastWriteSource ?? "maintenance",
          },
          scope,
        );
        recordAeonMaintenance(now, intensity, scope);
        log.info(
          `AEON maintenance: distilled memory -> ${distillResult.axiomsExtracted ?? 0} new axioms.`,
        );
        void logEvolutionEvent("SYSTEM_MAINTENANCE", `Autonomous Distillation (${intensity})`, [
          `Extracted ${distillResult.axiomsExtracted ?? 0} new axioms from MEMORY.md.`,
          `Maintenance intensity set to ${intensity}.`,
        ]);
      } else if (distillResult.status === "no-change") {
        const state = await readMemoryDistillState().catch(() => null);
        if (state) {
          recordMemoryPersistence(
            {
              lastDistillAt: state.lastDistillAt,
              checkpoint: state.checkpoint,
              totalEntries: state.totalEntries,
              lastWriteSource: state.lastWriteSource,
            },
            scope,
          );
        }
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
    let auditResult: any = null;
    if (intensity === "low") {
      // Low energy: selective cluster audit (20% of Peano space)
      const start = Math.random() * 0.8;
      auditResult = (await logicTool.execute("evolution:audit", {
        action: "audit",
        peanoRange: [start, start + 0.2],
      })) as any;
      log.info(
        `AEON maintenance: selective logic audit performed on Peano range [${start.toFixed(2)}, ${(start + 0.2).toFixed(2)}]. Health: ${auditResult.findings?.topologicalHealth ?? "N/A"}`,
      );
      void logEvolutionEvent("AUTONOMOUS", `Selective Peano Audit`, [
        `Range: [${start.toFixed(2)}, ${(start + 0.2).toFixed(2)}]`,
        `Intensity: low`,
        `Health: ${auditResult.findings?.topologicalHealth ?? "N/A"}`,
      ]);
    } else {
      auditResult = (await logicTool.execute("evolution:audit", { action: "audit" })) as any;
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

    const findings = auditResult?.findings as
      | {
          contradictions?: string[];
          conflicts?: Array<{
            pair: [string, string];
            confidence: number;
            impactScope: number;
            conflictType: string;
            evidence: string[];
            fallback?: boolean;
          }>;
          deconfliction?: { llmFallbacks?: number; llmAttempts?: number };
        }
      | undefined;
    if (findings) {
      const contradictionCount = findings.contradictions?.length ?? 0;
      if (contradictionCount > 0) {
        recordAeonEvidenceEvent(
          {
            type: "conflict_detected",
            value: contradictionCount,
            source: "logic_refinement",
            module: "logic-gates",
          },
          scope,
        );
      }
      const llmAttempts = findings.deconfliction?.llmAttempts ?? 0;
      const llmFallbacks = findings.deconfliction?.llmFallbacks ?? 0;
      if (llmAttempts > llmFallbacks) {
        recordAeonEvidenceEvent(
          { type: "deconfliction_llm_success", value: llmAttempts - llmFallbacks },
          scope,
        );
      }
      if (llmFallbacks > 0) {
        recordAeonEvidenceEvent({ type: "deconfliction_fallback", value: llmFallbacks }, scope);
      }

      const candidates = (findings.conflicts ?? []).filter(
        (entry) => entry.confidence >= 0.78 && entry.impactScope >= 2,
      );
      const autospawn = resolveAutospawnPolicy();
      const couplingProfile = resolveCouplingProfile();
      const state = getAeonEvolutionState(scope);
      const nowTs = Date.now();
      updateAeonAutospawnTelemetry(
        {
          enabled: autospawn.enabled,
          cooldownMinutes: Math.floor(autospawn.cooldownMs / 60_000),
          perSessionWindowMinutes: Math.floor(autospawn.perSessionWindowMs / 60_000),
          perSessionLimit: autospawn.perSessionLimit,
          perHourLimit: autospawn.perHourLimit,
          maxConcurrent: Math.min(autospawn.maxConcurrent, couplingProfile.maxConcurrentPipelines),
        },
        scope,
      );
      const triggersInWindow = state.autospawn.recentTriggers.filter(
        (ts) => ts >= nowTs - autospawn.perSessionWindowMs,
      ).length;
      const triggersInHour = state.autospawn.recentTriggers.filter(
        (ts) => ts >= nowTs - 60 * 60 * 1000,
      ).length;
      const cooldownActive =
        state.autospawn.lastTriggeredAt != null &&
        nowTs - state.autospawn.lastTriggeredAt < autospawn.cooldownMs;
      const circuitOpen = state.autospawn.recentFailures.length >= autospawn.failureThreshold;
      const circuitRecoverable =
        state.autospawn.lastFailureAt != null &&
        nowTs - state.autospawn.lastFailureAt >= autospawn.cooldownMs;
      const blockedByRateLimit =
        cooldownActive ||
        triggersInWindow >= autospawn.perSessionLimit ||
        triggersInHour >= Math.min(autospawn.perHourLimit, couplingProfile.maxLlmCallsPerHour) ||
        state.autospawn.inFlight >=
          Math.min(autospawn.maxConcurrent, couplingProfile.maxConcurrentPipelines);
      if (!autospawn.enabled || candidates.length === 0) {
        return;
      }
      if (circuitOpen) {
        if (circuitRecoverable) {
          // Half-open recovery: allow exactly one cautious probe run.
          updateAeonAutospawnTelemetry(
            { circuitOpen: false, degraded: false, degradedReason: null },
            scope,
          );
        } else {
        updateAeonAutospawnTelemetry(
          {
            circuitOpen: true,
            blockedByCircuitBreaker: state.autospawn.blockedByCircuitBreaker + 1,
            degraded: true,
            degradedReason: "circuit_breaker_open",
          },
          scope,
        );
        return;
        }
      }
      if (blockedByRateLimit) {
        updateAeonAutospawnTelemetry(
          {
            blockedByRateLimit: state.autospawn.blockedByRateLimit + 1,
            degraded: true,
            degradedReason: "rate_limited_or_cooldown",
          },
          scope,
        );
        return;
      }
      const sessionKey = scope?.sessionKey ?? "main";
      const agentId = scope?.agentId ?? "main";
      const runId = `deconfliction:${sessionKey}:${nowTs}`;
      updateAeonAutospawnTelemetry(
        {
          inFlight: state.autospawn.inFlight + 1,
          triggerAt: nowTs,
          lastTriggeredAt: nowTs,
          triggerCount: state.autospawn.triggerCount + 1,
          watchdogActive: true,
          degraded: false,
          degradedReason: null,
        },
        scope,
      );
      void recordDeliveryTransition({
        runId,
        sessionKey,
        state: "running",
        pipelineType: "deconfliction",
        summary: `Auto synthesis triggered by ${candidates.length} high-confidence conflicts.`,
        guardrail: {
          decision: state.policy.guardrailDecision,
          severity: "medium",
          requiresHuman: false,
          triggerRule: "AUTOSPAWN_CONFLICT_THRESHOLD",
        },
      });
      try {
        const pipelineStartedAt = Date.now();
        const spawn = await spawnSubagentDirect(
          {
            task: buildSynthesisTaskFromConflicts({ sessionKey, conflicts: candidates }),
            label: "AEON Auto Synthesis",
            agentId,
            runTimeoutSeconds: 600,
          },
          { agentSessionKey: sessionKey, requesterAgentIdOverride: agentId },
        );
        if (spawn.status === "accepted") {
          recordAeonEvidenceEvent({ type: "autospawn_success", source: "evolution_monitor" }, scope);
          const latency = Date.now() - pipelineStartedAt;
          if (latency > couplingProfile.maxPipelineLatencyMs) {
            updateAeonAutospawnTelemetry(
              {
                blockedByRateLimit: state.autospawn.blockedByRateLimit + 1,
              },
              scope,
            );
          }
          void recordDeliveryTransition({
            runId,
            sessionKey,
            state: "persisted",
            pipelineType: "deconfliction",
            persistedAt: Date.now(),
            summary: "Synthesis subagent accepted.",
            resumeReason: "autospawn_probe_succeeded",
          });
        } else {
          throw new Error(spawn.error ?? "autospawn rejected");
        }
      } catch (err) {
        recordAeonEvidenceEvent({ type: "autospawn_failure", source: "evolution_monitor" }, scope);
        updateAeonAutospawnTelemetry(
          {
            failureAt: Date.now(),
            lastFailureAt: Date.now(),
            retryCount: state.autospawn.retryCount + 1,
            degraded: true,
            degradedReason: "autospawn_failed",
          },
          scope,
        );
        void recordDeliveryTransition({
          runId,
          sessionKey,
          state: "persist_failed",
          pipelineType: "deconfliction",
          reasonCode: "AUTOSPAWN_FAILED",
          summary: String(err),
          fallback: true,
          guardrail: {
            decision: "SOFT_WARN",
            severity: "medium",
            requiresHuman: false,
            triggerRule: "AUTOSPAWN_FAILED",
          },
        });
      } finally {
        const refreshed = getAeonEvolutionState(scope);
        updateAeonAutospawnTelemetry(
          {
            inFlight: Math.max(0, refreshed.autospawn.inFlight - 1),
            watchdogActive: false,
          },
          scope,
        );
      }
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
  const scope: AeonStateScope = {
    sessionKey: mainSessionKey,
    agentId: resolveSessionAgentId({ sessionKey: mainSessionKey, config: loadConfig() }) ?? "main",
  };

  const { triggerAeonSingularity } = await import("./aeon-state.js");
  triggerAeonSingularity(true, scope);

  const stageStartedAt = Date.now();
  const runId = `singularity:${mainSessionKey}:${stageStartedAt}`;
  const timeoutMs = 90_000;
  let stableSnapshot: ReturnType<typeof getAeonEvolutionState> | null = null;

  const stageCheckpoint = async (stage: "diagnose" | "plan" | "simulate" | "apply") => {
    void recordDeliveryTransition({
      runId,
      sessionKey: mainSessionKey,
      state: stage === "apply" ? "finalizing" : "running",
      pipelineType: "singularity",
      summary: `stage=${stage}`,
    });
    if (Date.now() - stageStartedAt > timeoutMs) {
      throw new Error(`SINGULARITY_TIMEOUT:${stage}`);
    }
  };

  try {
    await stageCheckpoint("diagnose");
    stableSnapshot = getAeonEvolutionState(scope);
    const diagnose = {
      factor,
      risk: stableSnapshot.selfModification.redlineBreachRisk,
      trusted: stableSnapshot.ethics.trusted,
      contradictions: stableSnapshot.telemetryV4.evidence.conflict.density,
    };
    if (diagnose.risk > 0.85) {
      throw new Error("SINGULARITY_DIAGNOSE_RISK_TOO_HIGH");
    }

    await stageCheckpoint("plan");
    const planIntensity: MaintenanceDecision = diagnose.factor > 0.97 ? "high" : "medium";

    await stageCheckpoint("simulate");
    const simulationPass =
      stableSnapshot.telemetryV4.inference.integrityScore >= 0.45 &&
      stableSnapshot.telemetryV4.confidence.overall >= 0.3;
    if (!simulationPass) {
      throw new Error("SINGULARITY_SIMULATION_FAILED");
    }

    await stageCheckpoint("apply");
    await runAeonMaintenance(planIntensity, scope);

    requestHeartbeatNow({
      reason: "singularity" as any,
      agentId: mainSession.sessionId,
      sessionKey: mainSessionKey,
      coalesceMs: 500,
    });

    void logEvolutionEvent("SINGULARITY", "Cognitive Rebirth / 奇点重生", [
      `Extreme resonance detected: ${factor.toFixed(2)}`,
      `Flow: diagnose -> plan -> simulate -> apply`,
      `Applied maintenance intensity: ${planIntensity}`,
    ]);
    recordAeonEvidenceEvent(
      { type: "execution_success", source: "singularity", module: "server-evolution" },
      scope,
    );
    void recordDeliveryTransition({
      runId,
      sessionKey: mainSessionKey,
      state: "persisted",
      pipelineType: "singularity",
      persistedAt: Date.now(),
      summary: `singularity.apply=${planIntensity}`,
      resumeReason: "singularity_pipeline_completed",
    });
  } catch (err) {
    const reason = String(err);
    log.warn(`Singularity pipeline failed: ${reason}`);
    recordAeonEvidenceEvent(
      { type: "execution_failure", source: "singularity", module: "server-evolution" },
      scope,
    );
    recordAeonEvidenceEvent({ type: "rollback", source: "singularity" }, scope);
    void recordDeliveryTransition({
      runId,
      sessionKey: mainSessionKey,
      state: "persist_failed",
      pipelineType: "singularity",
      reasonCode: "SINGULARITY_PIPELINE_FAILED",
      summary: reason,
      fallback: true,
      guardrail: {
        decision: "SOFT_WARN",
        severity: "high",
        requiresHuman: true,
        triggerRule: "SINGULARITY_PIPELINE_FAILED",
      },
      pauseRecord: {
        severity: "high",
        reason: "Singularity pipeline failed and degraded to maintenance mode.",
        triggerRule: "SINGULARITY_PIPELINE_FAILED",
        suggestedAction: "Inspect diagnostics and rerun after stabilization.",
        resumePoint: "singularity:diagnose",
        createdAt: Date.now(),
      },
    });
    if (stableSnapshot) {
      recordMaintenancePolicyDecision(
        {
          maintenanceDecision: "low",
          guardrailDecision: "SOFT_WARN",
          reasonCode: "SINGULARITY_DEGRADED_TO_MAINTENANCE",
        },
        scope,
      );
      await runAeonMaintenance("low", scope);
    }
  } finally {
    triggerAeonSingularity(false, scope);
  }
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
      const scope: AeonStateScope = { sessionKey: "main", agentId: "main" };
      applyConsciousnessRuntimePolicy(scope);
      recordAeonEpiphanyFactor(epiphanyFactor, scope);
      recordConsciousnessPulse(
        {
          epiphanyFactor,
          memorySaturation,
          neuralDepth: depthPlaceholder,
          idleMs: 0,
          resonanceActive: epiphanyFactor > 0.85,
          activeRun: false,
          goalDrift: Math.max(0, 0.35 - epiphanyFactor * 0.2),
          reasoningBias: Math.max(0.05, 0.28 - depthPlaceholder / 100),
          selfCorrectionRate: Math.min(1, 0.45 + epiphanyFactor * 0.25),
          noveltySignal: epiphanyFactor,
          resourcePressure: Math.max(0.1, 1 - memorySaturation / 100),
          riskLoad: epiphanyFactor > 0.92 ? 0.55 : 0.25,
          environmentSignal: 0.6,
        },
        scope,
      );

      const { updateCollectiveResonance } = await import("./aeon-state.js");
      updateCollectiveResonance([epiphanyFactor], scope);
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
        const scope: AeonStateScope = {
          sessionKey: mainSessionKey,
          agentId: resolveSessionAgentId({ sessionKey: mainSessionKey, config: cfg }) ?? "main",
        };
        applyConsciousnessRuntimePolicy(scope);
        const scopeKey = getAeonScopeKey(scope);

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
        recordConsciousnessPulse(
          {
            epiphanyFactor,
            memorySaturation,
            neuralDepth: depthPlaceholder,
            idleMs: Math.max(0, idleTime),
            resonanceActive: resonanceTrigger,
            activeRun: false,
            goalDrift: resonanceTrigger ? 0.22 : 0.32,
            reasoningBias: Math.max(0.05, 0.25 - depthPlaceholder / 120),
            selfCorrectionRate: resonanceTrigger ? 0.65 : 0.48,
            valueConflictLoad: resonanceTrigger ? 0.35 : 0.22,
            shortTermTemptation: resonanceTrigger ? 0.28 : 0.18,
            explanationQuality: Math.min(1, 0.4 + depthPlaceholder / 24),
            resourcePressure: clampMaintenanceResourcePressure(memorySaturation, idleTime),
            riskLoad: resonanceTrigger ? 0.5 : 0.22,
            noveltySignal: epiphanyFactor,
            failureCost: resonanceTrigger ? 0.55 : 0.28,
            socialFeedback: resonanceTrigger ? 0.65 : 0.45,
            environmentSignal: idleTime > IDLE_THRESHOLD_MS ? 0.42 : 0.7,
          },
          scope,
        );

        if (idleTime > IDLE_THRESHOLD_MS || resonanceTrigger) {
          const lastDreamingAt = lastDreamingAtByScope.get(scopeKey) ?? 0;
          if (now - lastDreamingAt > (resonanceTrigger ? 5 * 60 * 1000 : DREAMING_INTERVAL_MS)) {
            const reason = resonanceTrigger ? "resonance_epiphany" : "dreaming";
            log.info(
              `System ${resonanceTrigger ? "Resonance" : "Idle"} detected. Factor: ${epiphanyFactor.toFixed(2)}. Triggering ${reason}.`,
            );
            lastDreamingAtByScope.set(scopeKey, now);
            lastDreamingAtInternal = now;
            recordAeonDreaming(now, scope);

            requestHeartbeatNow({
              reason: reason as any,
              agentId: mainSession.sessionId,
              sessionKey: mainSessionKey,
              coalesceMs: resonanceTrigger ? 1000 : 5000,
            });

            const guardrailConfig = resolveGuardrailConfig();
            const { plan, guardrail } = resolveAutonomousMaintenancePolicy({
              scope,
              context: { epiphanyFactor, memorySaturation, idleTime, resonanceTrigger },
              config: guardrailConfig,
            });
            recordMaintenancePolicyDecision(
              {
                maintenanceDecision: guardrail.effectiveIntensity,
                guardrailDecision: guardrail.decision,
                reasonCode: guardrail.reasonCode,
              },
              scope,
            );
            log.debug(
              `Autonomous maintenance policy selected intensity=${plan.intensity} effective=${guardrail.effectiveIntensity} guardrail=${guardrail.decision} reason=${guardrail.reasonCode}`,
            );
            emitMaintenancePolicyEvent({
              scope,
              requestedIntensity: plan.intensity,
              effectiveIntensity: guardrail.effectiveIntensity,
              reason: plan.reason,
              reasonCode: guardrail.reasonCode,
              decision: guardrail.decision,
              context: { epiphanyFactor, memorySaturation, idleTime, resonanceTrigger },
              config: guardrailConfig,
            });
            void runAeonMaintenance(guardrail.effectiveIntensity, scope);
          }
        } else if (
          epiphanyFactor < 0.2 &&
          now - (lastMaintenanceAtByScope.get(scopeKey) ?? 0) > MAINTENANCE_INTERVAL_MS
        ) {
          const guardrailConfig = resolveGuardrailConfig();
          const { plan, guardrail } = resolveAutonomousMaintenancePolicy({
            scope,
            context: { epiphanyFactor, memorySaturation, idleTime, resonanceTrigger },
            config: guardrailConfig,
          });
          recordMaintenancePolicyDecision(
            {
              maintenanceDecision: guardrail.effectiveIntensity,
              guardrailDecision: guardrail.decision,
              reasonCode: guardrail.reasonCode,
            },
            scope,
          );
          emitMaintenancePolicyEvent({
            scope,
            requestedIntensity: plan.intensity,
            effectiveIntensity: guardrail.effectiveIntensity,
            reason: plan.reason,
            reasonCode: guardrail.reasonCode,
            decision: guardrail.decision,
            context: { epiphanyFactor, memorySaturation, idleTime, resonanceTrigger },
            config: guardrailConfig,
          });
          void runAeonMaintenance(guardrail.effectiveIntensity, scope);
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

/**
 * Phase 3: Error Replay Simulation
 * Reconstructs a "thought trace" for a given runId to analyze failures.
 */
export async function simulateThoughtTrace(params: {
  runId: string;
  sessionKey: string;
}) {
  const { runId, sessionKey } = params;
  const cfg = loadConfig();
  const agentId = resolveSessionAgentId({ sessionKey, config: cfg }) || "main";
  const scope: AeonStateScope = { agentId, sessionKey };
  
  const state = getAeonEvolutionState(scope);
  const logs = state.cognitiveLog || [];
  
  // Filter logs relevant to this runId (if metadata exists) or recent logs around that timeframe
  // For simplicity, we'll return the recent cognitive context
  const trace = logs.filter((l: CognitiveLogEntry) => 
    (l.metadata?.runId === runId) || 
    (l.metadata?.sessionId === sessionKey)
  ).slice(-20);

  return {
    runId,
    timestamp: Date.now(),
    trace,
    metrics: {
      entropy: state.telemetryV4.curve.point.x,
      risk: state.telemetryV4.inference.riskScore,
      resonance: state.consciousness.selfKernel.identityContinuityScore,
    }
  };
}
