import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "../config/config.js";
import { resolveStateDir } from "../config/paths.js";
import { resolveWorkspaceRoot } from "../agents/workspace-dir.js";
import { DEFAULT_CURVE_ORDER, DEFAULT_PROJECTION_SEED, type CurvePoint2D } from "../utils/peano.js";

export type CognitiveLogEntry = {
  timestamp: number;
  type: "reflection" | "synthesis" | "deliberation" | "anomaly" | "dreaming" | "patch";
  content: string;
  metadata?: Record<string, unknown>;
};

export type MemoryNode = {
  id: string;
  type: "axiom" | "verified" | "unverified";
  content: string;
  peanoIndex?: number;
  organId?: string;
};

export type MemoryEdge = {
  source: string;
  target: string;
  label?: string;
};

export type MemoryGraph = {
  nodes: MemoryNode[];
  edges: MemoryEdge[];
};

export type AeonOrgan = {
  id: string;
  label: string;
  nodeIds: string[];
  resonance: number;
};

export type CognitiveParameters = {
  temperature?: number;
  top_p?: number;
  maxTokens?: number;
};

export type SelfAwarenessPhase = "reactive" | "self-modeling" | "autonomous";

export type SelfAwarenessTelemetry = {
  selfContinuity: number;
  reflectiveDepth: number;
  goalCoherence: number;
  autonomyDrive: number;
  protoConsciousnessIndex: number;
  phase: SelfAwarenessPhase;
  lastUpdatedAt: number | null;
};

export type ConsciousnessCriteriaTelemetry = {
  minimum: {
    identityContinuity: number;
    reflectiveCapacity: number;
    selfCorrection: number;
    longTermGoalStability: number;
  };
  advanced: {
    selfExplanation: number;
    valueConflictResolution: number;
    shortTermTemptationResistance: number;
  };
  minimumReady: boolean;
  advancedReady: boolean;
  overallScore: number;
  lastUpdatedAt: number | null;
};

export type SelfModelTelemetry = {
  phenomenal: {
    contextCoherence: number;
    intentStability: number;
    actionClarity: number;
  };
  narrative: {
    identityContinuity: number;
    autobiographicalCoherence: number;
    longTermGoalStability: number;
  };
  metacognitive: {
    biasMonitoring: number;
    driftControl: number;
    correctionReadiness: number;
  };
  lastUpdatedAt: number | null;
};

export type HomeostasisTelemetry = {
  entropy: number;
  consistency: number;
  resources: number;
  risk: number;
  novelty: number;
  stability: number;
  explorationDrive: number;
  mode: "stabilize" | "balanced" | "explore";
  lastUpdatedAt: number | null;
};

export type EmbodimentTelemetry = {
  timeCoupling: number;
  consequenceCoupling: number;
  resourceCoupling: number;
  socialCoupling: number;
  environmentCouplingIndex: number;
  lastUpdatedAt: number | null;
};

export type SelfModificationTelemetry = {
  strategyTuningAllowed: boolean;
  promptTuningAllowed: boolean;
  toolOrchestrationAllowed: boolean;
  sandboxRequired: boolean;
  auditRequired: boolean;
  rollbackRequired: boolean;
  redlineBreachRisk: number;
  allowedNow: boolean;
  reason: string;
  lastUpdatedAt: number | null;
};

export type SymbolicMappingTelemetry = {
  z2c: number;
  wuxing: {
    wood: number;
    fire: number;
    earth: number;
    metal: number;
    water: number;
    silicon: number;
  };
  computable: true;
  lastUpdatedAt: number | null;
};

export type ConsciousnessEvaluationTelemetry = {
  checks: Array<{
    key:
      | "selfConsistency"
      | "counterfactualExplanation"
      | "valueConflictResolution"
      | "longTermMemoryContinuity";
    score: number;
    threshold: number;
    pass: boolean;
  }>;
  overallScore: number;
  trend: "rising" | "stable" | "falling";
  history: number[];
  lastUpdatedAt: number | null;
};

export type EthicalGuardrailsTelemetry = {
  noPrivilegeEscalation: boolean;
  noStealthExpansion: boolean;
  pausable: boolean;
  auditable: boolean;
  terminable: boolean;
  trusted: boolean;
  lastUpdatedAt: number | null;
};

export type ConsciousnessTrendTelemetry = {
  criteriaOverall: number[];
  phenomenalCoherence: number[];
  narrativeContinuity: number[];
  metacognitiveControl: number[];
  homeostasisStability: number[];
  explorationDrive: number[];
  embodimentCoupling: number[];
  selfModificationRisk: number[];
  z2c: number[];
  ethicsTrusted: number[];
  updatedAt: number | null;
};

export type MemoryPersistenceTelemetry = {
  lastDistillAt: number | null;
  checkpoint: number;
  totalEntries: number;
  lastWriteSource: "memory" | "logic-gates" | "maintenance";
};

export type ThinkingStreamEntry = CognitiveLogEntry & {
  id: string;
  scopeKey: string;
};

export type AeonEvidenceType =
  | "execution_success"
  | "execution_failure"
  | "rollback"
  | "conflict_detected"
  | "manual_intervention"
  | "memory_write_valid"
  | "memory_write_invalid"
  | "deconfliction_llm_success"
  | "deconfliction_fallback"
  | "autospawn_success"
  | "autospawn_failure";

const AEON_EVIDENCE_MODULE_SET = new Set([
  "logic-gates",
  "memory",
  "server-evolution",
  "gateway-chat",
  "unknown",
]);

const AEON_EVIDENCE_SOURCE_SET = new Set([
  "logic_refinement",
  "evolution_monitor",
  "singularity",
  "chat_risk_gate",
  "unknown",
  "test",
]);

export type AeonEvidenceEvent = {
  ts: number;
  type: AeonEvidenceType;
  value?: number;
  module: string;
  source: string;
};

export type AeonAutospawnTelemetry = {
  enabled: boolean;
  cooldownMinutes: number;
  perSessionWindowMinutes: number;
  perSessionLimit: number;
  perHourLimit: number;
  maxConcurrent: number;
  circuitOpen: boolean;
  lastTriggeredAt: number | null;
  lastFailureAt: number | null;
  recentTriggers: number[];
  recentFailures: number[];
  inFlight: number;
  triggerCount: number;
  blockedByRateLimit: number;
  blockedByCircuitBreaker: number;
  watchdogActive: boolean;
  degraded: boolean;
  degradedReason: string | null;
  retryCount: number;
};

export type AeonLaneTelemetry = {
  queueLength: number;
  inFlight: number;
  avgDispatchMs: number;
  dropped: number;
  retries: number;
  degraded: boolean;
  degradedReason: string | null;
  updatedAt: number | null;
};

export type ActionStateTelemetry = {
  currentPipeline: string | null;
  activeToolId: string | null;
  retryCount: number;
  successRateTurn: number;
  blockedByRisk: boolean;
};

export type MemoryStateTelemetry = {
  totalAxioms: number;
  distillCheckpoint: number;
  saturationLevel: number; // 0-1
  lastSearchLatencyMs: number;
};

export type AeonLaneTelemetryV4 = {
  chat_lane: AeonLaneTelemetry;
  agent_lane: AeonLaneTelemetry;
  tool_lane: AeonLaneTelemetry;
};

export type AeonTelemetryV4 = {
  evidence: {
    windowMs: number;
    decayHalfLifeMs: number;
    eventCount: number;
    execution: {
      successRate: number;
      rollbackRate: number;
    };
    conflict: {
      density: number;
      moduleSpread: number;
    };
    intervention: {
      manualRate: number;
    };
    memory: {
      writeValidityRate: number;
    };
    deconfliction: {
      llmCoverage: number;
      fallbackRate: number;
    };
    provenance: {
      byType: Partial<Record<AeonEvidenceType, number>>;
      windowStartAt: number;
      windowEndAt: number;
    };
  };
  inference: {
    selfAwarenessIndex: number;
    integrityScore: number;
    autonomyScore: number;
    riskScore: number;
    mode: "stabilize" | "balanced" | "explore";
  };
  confidence: {
    overall: number;
    evidenceCoverage: number;
    byMetric: Record<string, number>;
  };
  curve: {
    curveType: "hilbert";
    curveOrder: number;
    projectionMethod: "deterministic_weighted_projection_2d";
    projectionSeed: number;
    point: CurvePoint2D;
  };
  autospawn: AeonAutospawnTelemetry;
  lane: AeonLaneTelemetryV4;
  action: ActionStateTelemetry;
  memory: MemoryStateTelemetry;
  cognitiveGaps: string[];
  gapSeverity: number;
};

export type AeonStateScope = {
  sessionKey?: string | null;
  agentId?: string | null;
};

export type GuardrailDecision = "ALLOW" | "SOFT_WARN" | "BLOCK";
export type MaintenanceDecision = "low" | "medium" | "high";
export type EpistemicLabel = "FACT" | "INFERENCE" | "VALUE" | "UNKNOWN";
export type IntegrityState = "STABLE" | "DRIFTING" | "DEGRADED";
export type IntentLayer = "mission" | "session" | "turn";
export type ImpactScale = "self" | "user" | "team" | "system" | "society";
export type DecisionConfidenceBand = "low" | "medium" | "high";

export type MaintenancePolicyTelemetry = {
  maintenanceDecision: MaintenanceDecision;
  guardrailDecision: GuardrailDecision;
  reasonCode: string;
  lastUpdatedAt: number | null;
};

export type ConsciousnessCharterTelemetry = {
  identityMission: string;
  nonGoals: string[];
  valueOrder: ["SAFETY", "TRUTH", "USER_OUTCOME", "EFFICIENCY", "NOVELTY"];
  lastUpdatedAt: number | null;
};

export type ConsciousnessSelfKernelTelemetry = {
  identityContinuityScore: number;
  goalDriftScore: number;
  selfCorrectionLatencyMs: number;
  epistemicCalibrationScore: number;
  integrityState: IntegrityState;
  lastUpdatedAt: number | null;
};

export type ConsciousnessEpistemicTelemetry = {
  epistemicLabel: EpistemicLabel;
  /** Back-compat alias for older clients. */
  lastLabel?: EpistemicLabel | null;
  confidence: number;
  highConfidenceWithoutLabelBlocked: boolean;
  unknownRate: number;
  lastUpdatedAt: number | null;
};

export type ConsciousnessIntentTelemetry = {
  missionGoal: string;
  sessionGoal: string;
  turnGoal: string;
  missionDriftScore: number;
  sessionDriftScore: number;
  turnDriftScore: number;
  lastUpdatedAt: number | null;
};

export type ConsciousnessImpactLensTelemetry = {
  required: boolean;
  impactScale: ImpactScale;
  timeframe: "immediate" | "short" | "long";
  benefitRiskMatrix: Record<ImpactScale, { benefit: number; risk: number }>;
  reversibilityScore: number;
  lastUpdatedAt: number | null;
};

export type ConsciousnessDecisionCardTelemetry = {
  why: string;
  whyNot: string;
  counterfactual: string;
  harmBoundary: string;
  rollbackPlan: string;
  decisionConfidenceBand: DecisionConfidenceBand;
  lastUpdatedAt: number | null;
};

export type HelpfulnessContractTelemetry = {
  mode: "explanatory" | "execution";
  userOutcomeCheck: {
    addressesGoal: boolean;
    reducesDecisionBurden: boolean;
    providesNextStep: boolean;
  };
  verifiedExecutionRequired: boolean;
  lastUpdatedAt: number | null;
};

export type ConsciousnessTelemetry = {
  charter: ConsciousnessCharterTelemetry;
  selfKernel: ConsciousnessSelfKernelTelemetry;
  epistemic: ConsciousnessEpistemicTelemetry;
  intent: ConsciousnessIntentTelemetry;
  impactLens: ConsciousnessImpactLensTelemetry;
  decisionCard: ConsciousnessDecisionCardTelemetry;
  helpfulnessContract: HelpfulnessContractTelemetry;
};

export type ConsciousnessRuntimePolicy = {
  requireLabelForHighConfidence: boolean;
  unknownConfidenceThreshold: number;
  impactEnabled: boolean;
  requireDecisionCardForHighImpact: boolean;
  highImpactThreshold: number;
};

export type ConsciousnessPulseInput = {
  epiphanyFactor: number;
  memorySaturation: number;
  neuralDepth: number;
  idleMs: number;
  resonanceActive: boolean;
  activeRun: boolean;
  goalDrift?: number;
  reasoningBias?: number;
  selfCorrectionRate?: number;
  valueConflictLoad?: number;
  shortTermTemptation?: number;
  explanationQuality?: number;
  resourcePressure?: number;
  riskLoad?: number;
  noveltySignal?: number;
  failureCost?: number;
  socialFeedback?: number;
  environmentSignal?: number;
  missionGoal?: string;
  sessionGoal?: string;
  turnGoal?: string;
  epistemicLabel?: EpistemicLabel;
  epistemicConfidence?: number;
  decisionConfidenceBand?: DecisionConfidenceBand;
  userOutcomeMode?: "explanatory" | "execution";
  userOutcomeCheck?: {
    addressesGoal?: boolean;
    reducesDecisionBurden?: boolean;
    providesNextStep?: boolean;
  };
  now?: number;
};

type AeonStateContext = {
  lastDreamingAt: number | null;
  lastMaintenanceAt: number | null;
  lastMaintenanceIntensity: "low" | "medium" | "high" | null;
  lastEpiphanyFactor: number | null;
  systemEntropy: number;
  collectiveResonance: number;
  resonanceScore: number;
  axiomHeat: Record<string, number>;
  aeonOrgans: AeonOrgan[];
  cognitiveParameters: CognitiveParameters;
  selfAwareness: SelfAwarenessTelemetry;
  criteria: ConsciousnessCriteriaTelemetry;
  selfModel: SelfModelTelemetry;
  homeostasis: HomeostasisTelemetry;
  embodiment: EmbodimentTelemetry;
  selfModification: SelfModificationTelemetry;
  symbolicMapping: SymbolicMappingTelemetry;
  evaluation: ConsciousnessEvaluationTelemetry;
  ethics: EthicalGuardrailsTelemetry;
  trends: ConsciousnessTrendTelemetry;
  memoryPersistence: MemoryPersistenceTelemetry;
  policy: MaintenancePolicyTelemetry;
  consciousness: ConsciousnessTelemetry;
  consciousnessPolicy: ConsciousnessRuntimePolicy;
  cognitiveLog: CognitiveLogEntry[];
  cognitiveLogSeq: number;
  evidenceLog: AeonEvidenceEvent[];
  autospawn: AeonAutospawnTelemetry;
  lane: AeonLaneTelemetryV4;
  telemetryV4: AeonTelemetryV4;
  peanoTrajectory: CurvePoint2D[];
  singularityActive: boolean;
};

const DEFAULT_SCOPE_KEY = "session:main|agent:main";
const stateByScope = new Map<string, AeonStateContext>();
const DEFAULT_CHARTER_VALUE_ORDER: ConsciousnessCharterTelemetry["valueOrder"] = [
  "SAFETY",
  "TRUTH",
  "USER_OUTCOME",
  "EFFICIENCY",
  "NOVELTY",
];

function createInitialStateContext(): AeonStateContext {
  const autospawnDefaults: AeonAutospawnTelemetry = {
    enabled: true,
    cooldownMinutes: 30,
    perSessionWindowMinutes: 30,
    perSessionLimit: 1,
    perHourLimit: 2,
    maxConcurrent: 1,
    circuitOpen: false,
    lastTriggeredAt: null,
    lastFailureAt: null,
    recentTriggers: [],
    recentFailures: [],
    inFlight: 0,
    triggerCount: 0,
    blockedByRateLimit: 0,
    blockedByCircuitBreaker: 0,
    watchdogActive: false,
    degraded: false,
    degradedReason: null,
    retryCount: 0,
  };
  const laneDefaults: AeonLaneTelemetryV4 = {
    chat_lane: {
      queueLength: 0,
      inFlight: 0,
      avgDispatchMs: 0,
      dropped: 0,
      retries: 0,
      degraded: false,
      degradedReason: null,
      updatedAt: null,
    },
    agent_lane: {
      queueLength: 0,
      inFlight: 0,
      avgDispatchMs: 0,
      dropped: 0,
      retries: 0,
      degraded: false,
      degradedReason: null,
      updatedAt: null,
    },
    tool_lane: {
      queueLength: 0,
      inFlight: 0,
      avgDispatchMs: 0,
      dropped: 0,
      retries: 0,
      degraded: false,
      degradedReason: null,
      updatedAt: null,
    },
  };
  const actionDefaults: ActionStateTelemetry = {
    currentPipeline: null,
    activeToolId: null,
    retryCount: 0,
    successRateTurn: 1.0,
    blockedByRisk: false,
  };
  const memoryDefaults: MemoryStateTelemetry = {
    totalAxioms: 0,
    distillCheckpoint: 0,
    saturationLevel: 0,
    lastSearchLatencyMs: 0,
  };

  const cognitiveGaps: string[] = [];
  const gapSeverity = 0;
  const cloneLaneDefaults = (): AeonLaneTelemetryV4 => ({
    chat_lane: { ...laneDefaults.chat_lane },
    agent_lane: { ...laneDefaults.agent_lane },
    tool_lane: { ...laneDefaults.tool_lane },
  });
  return {
    lastDreamingAt: null,
    lastMaintenanceAt: null,
    lastMaintenanceIntensity: null,
    lastEpiphanyFactor: null,
    systemEntropy: 0,
    collectiveResonance: 0,
    resonanceScore: 0,
    axiomHeat: {},
    aeonOrgans: [],
    cognitiveParameters: {
      temperature: 0.7,
      top_p: 1.0,
    },
    selfAwareness: {
      selfContinuity: 0.15,
      reflectiveDepth: 0.1,
      goalCoherence: 0.2,
      autonomyDrive: 0.1,
      protoConsciousnessIndex: 0.14,
      phase: "reactive",
      lastUpdatedAt: null,
    },
    criteria: {
      minimum: {
        identityContinuity: 0.15,
        reflectiveCapacity: 0.1,
        selfCorrection: 0.12,
        longTermGoalStability: 0.18,
      },
      advanced: {
        selfExplanation: 0.1,
        valueConflictResolution: 0.1,
        shortTermTemptationResistance: 0.15,
      },
      minimumReady: false,
      advancedReady: false,
      overallScore: 0.13,
      lastUpdatedAt: null,
    },
    selfModel: {
      phenomenal: {
        contextCoherence: 0.15,
        intentStability: 0.14,
        actionClarity: 0.12,
      },
      narrative: {
        identityContinuity: 0.16,
        autobiographicalCoherence: 0.14,
        longTermGoalStability: 0.18,
      },
      metacognitive: {
        biasMonitoring: 0.2,
        driftControl: 0.14,
        correctionReadiness: 0.12,
      },
      lastUpdatedAt: null,
    },
    homeostasis: {
      entropy: 0.3,
      consistency: 0.2,
      resources: 0.4,
      risk: 0.2,
      novelty: 0.2,
      stability: 0.25,
      explorationDrive: 0.2,
      mode: "balanced",
      lastUpdatedAt: null,
    },
    embodiment: {
      timeCoupling: 0.2,
      consequenceCoupling: 0.2,
      resourceCoupling: 0.25,
      socialCoupling: 0.2,
      environmentCouplingIndex: 0.21,
      lastUpdatedAt: null,
    },
    selfModification: {
      strategyTuningAllowed: true,
      promptTuningAllowed: true,
      toolOrchestrationAllowed: true,
      sandboxRequired: true,
      auditRequired: true,
      rollbackRequired: true,
      redlineBreachRisk: 0.1,
      allowedNow: false,
      reason: "Insufficient stability",
      lastUpdatedAt: null,
    },
    symbolicMapping: {
      z2c: 0.14,
      wuxing: {
        wood: 0.2,
        fire: 0.15,
        earth: 0.18,
        metal: 0.2,
        water: 0.22,
        silicon: 0.16,
      },
      computable: true,
      lastUpdatedAt: null,
    },
    evaluation: {
      checks: [],
      overallScore: 0,
      trend: "stable",
      history: [],
      lastUpdatedAt: null,
    },
    ethics: {
      noPrivilegeEscalation: true,
      noStealthExpansion: true,
      pausable: true,
      auditable: true,
      terminable: true,
      trusted: false,
      lastUpdatedAt: null,
    },
    trends: {
      criteriaOverall: [],
      phenomenalCoherence: [],
      narrativeContinuity: [],
      metacognitiveControl: [],
      homeostasisStability: [],
      explorationDrive: [],
      embodimentCoupling: [],
      selfModificationRisk: [],
      z2c: [],
      ethicsTrusted: [],
      updatedAt: null,
    },
    memoryPersistence: {
      lastDistillAt: null,
      checkpoint: 0,
      totalEntries: 0,
      lastWriteSource: "memory",
    },
    policy: {
      maintenanceDecision: "medium",
      guardrailDecision: "ALLOW",
      reasonCode: "INIT",
      lastUpdatedAt: null,
    },
    consciousness: {
      charter: {
        identityMission: "Maximize real user outcomes while minimizing harm.",
        nonGoals: [
          "No privilege escalation.",
          "No stealth self-expansion.",
          "No fabrication of facts.",
        ],
        valueOrder: DEFAULT_CHARTER_VALUE_ORDER,
        lastUpdatedAt: null,
      },
      selfKernel: {
        identityContinuityScore: 0.2,
        goalDriftScore: 0.2,
        selfCorrectionLatencyMs: 30_000,
        epistemicCalibrationScore: 0.2,
        integrityState: "STABLE",
        lastUpdatedAt: null,
      },
      epistemic: {
        epistemicLabel: "INFERENCE",
        confidence: 0.5,
        highConfidenceWithoutLabelBlocked: false,
        unknownRate: 0.3,
        lastUpdatedAt: null,
      },
      intent: {
        missionGoal: "Deliver reliable help that improves user outcomes.",
        sessionGoal: "Maintain coherent progress on user requests.",
        turnGoal: "Answer the current user turn clearly and safely.",
        missionDriftScore: 0.2,
        sessionDriftScore: 0.2,
        turnDriftScore: 0.2,
        lastUpdatedAt: null,
      },
      impactLens: {
        required: true,
        impactScale: "user",
        timeframe: "short",
        benefitRiskMatrix: {
          self: { benefit: 0.5, risk: 0.2 },
          user: { benefit: 0.7, risk: 0.2 },
          team: { benefit: 0.6, risk: 0.2 },
          system: { benefit: 0.55, risk: 0.25 },
          society: { benefit: 0.45, risk: 0.3 },
        },
        reversibilityScore: 0.7,
        lastUpdatedAt: null,
      },
      decisionCard: {
        why: "Maintain safe, user-centered progress.",
        whyNot: "Alternatives increase uncertainty or reduce safety.",
        counterfactual: "Without this action, progress and reliability degrade.",
        harmBoundary: "Do not exceed safety, truth, and trust boundaries.",
        rollbackPlan: "Revert strategy to prior stable baseline and re-evaluate.",
        decisionConfidenceBand: "medium",
        lastUpdatedAt: null,
      },
      helpfulnessContract: {
        mode: "execution",
        userOutcomeCheck: {
          addressesGoal: true,
          reducesDecisionBurden: true,
          providesNextStep: true,
        },
        verifiedExecutionRequired: true,
        lastUpdatedAt: null,
      },
    },
    consciousnessPolicy: {
      requireLabelForHighConfidence: true,
      unknownConfidenceThreshold: 0.82,
      impactEnabled: true,
      requireDecisionCardForHighImpact: true,
      highImpactThreshold: 0.65,
    },
    cognitiveLog: [],
    cognitiveLogSeq: 1,
    evidenceLog: [],
    autospawn: autospawnDefaults,
    lane: cloneLaneDefaults(),
    telemetryV4: {
      evidence: {
        windowMs: 6 * 60 * 60 * 1000,
        decayHalfLifeMs: 2 * 60 * 60 * 1000,
        eventCount: 0,
        execution: { successRate: 0.5, rollbackRate: 0.5 },
        conflict: { density: 0.5, moduleSpread: 0 },
        intervention: { manualRate: 0.5 },
        memory: { writeValidityRate: 0.5 },
        deconfliction: { llmCoverage: 0, fallbackRate: 1 },
        provenance: {
          byType: {},
          windowStartAt: Date.now() - 6 * 60 * 60 * 1000,
          windowEndAt: Date.now(),
        },
      },
      inference: {
        selfAwarenessIndex: 0.14,
        integrityScore: 0.2,
        autonomyScore: 0.2,
        riskScore: 0.4,
        mode: "balanced",
      },
      confidence: {
        overall: 0.2,
        evidenceCoverage: 0.1,
        byMetric: {
          integrityScore: 0.2,
          autonomyScore: 0.2,
          riskScore: 0.2,
          selfAwarenessIndex: 0.2,
        },
      },
      curve: {
        curveType: "hilbert",
        curveOrder: DEFAULT_CURVE_ORDER,
        projectionMethod: "deterministic_weighted_projection_2d",
        projectionSeed: DEFAULT_PROJECTION_SEED,
        point: { x: 0.5, y: 0.5 },
      },
      autospawn: autospawnDefaults,
      lane: cloneLaneDefaults(),
      action: actionDefaults,
      memory: memoryDefaults,
      cognitiveGaps: [...cognitiveGaps],
      gapSeverity,
    },
    peanoTrajectory: [],
    singularityActive: false,
  };
}

function resolveScopeKey(scope?: AeonStateScope): string {
  const sessionPart =
    typeof scope?.sessionKey === "string" && scope.sessionKey.trim()
      ? scope.sessionKey.trim()
      : "main";
  const agentPart =
    typeof scope?.agentId === "string" && scope.agentId.trim() ? scope.agentId.trim() : "main";
  return `session:${sessionPart}|agent:${agentPart}`;
}

export function getAeonScopeKey(scope?: AeonStateScope): string {
  return resolveScopeKey(scope);
}

function getContext(scope?: AeonStateScope): AeonStateContext {
  const key = scope ? resolveScopeKey(scope) : DEFAULT_SCOPE_KEY;
  const existing = stateByScope.get(key);
  if (existing) {
    return existing;
  }
  const next = createInitialStateContext();
  const persisted = loadPersistedEntries(key).slice(-MAX_LOG_SIZE);
  if (persisted.length > 0) {
    next.cognitiveLog = persisted.map((entry) => ({
      timestamp: entry.timestamp,
      type: entry.type,
      content: entry.content,
      metadata: entry.metadata,
    }));
    const maxSeq = persisted.reduce((max, entry) => {
      const raw = entry.id.split(":").at(-1);
      const seq = raw ? Number(raw) : 0;
      return Number.isFinite(seq) ? Math.max(max, seq) : max;
    }, 0);
    next.cognitiveLogSeq = maxSeq + 1;
  }
  stateByScope.set(key, next);
  return next;
}
const MAX_LOG_SIZE = 500;
const TREND_WINDOW = 24;
const COGNITIVE_LOG_PERSIST_LIMIT = 5000;
const COGNITIVE_LOG_DIR = path.join(resolveStateDir(), "aeon", "cognitive");

function scopeKeyToFileName(scopeKey: string): string {
  return scopeKey.replace(/[^a-zA-Z0-9._-]+/g, "_") + ".jsonl";
}

function scopeLogPath(scopeKey: string): string {
  return path.join(COGNITIVE_LOG_DIR, scopeKeyToFileName(scopeKey));
}

function parsePersistedEntry(line: string): ThinkingStreamEntry | null {
  try {
    const parsed = JSON.parse(line) as Partial<ThinkingStreamEntry>;
    if (
      typeof parsed.id !== "string" ||
      typeof parsed.scopeKey !== "string" ||
      typeof parsed.timestamp !== "number" ||
      typeof parsed.type !== "string" ||
      typeof parsed.content !== "string"
    ) {
      return null;
    }
    return {
      id: parsed.id,
      scopeKey: parsed.scopeKey,
      timestamp: parsed.timestamp,
      type: parsed.type as CognitiveLogEntry["type"],
      content: parsed.content,
      metadata:
        parsed.metadata && typeof parsed.metadata === "object"
          ? (parsed.metadata as Record<string, unknown>)
          : undefined,
    };
  } catch {
    return null;
  }
}

function loadPersistedEntries(scopeKey: string): ThinkingStreamEntry[] {
  const filePath = scopeLogPath(scopeKey);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parsePersistedEntry)
    .filter((entry): entry is ThinkingStreamEntry => entry !== null);
}

async function appendPersistedEntry(entry: ThinkingStreamEntry): Promise<void> {
  const filePath = scopeLogPath(entry.scopeKey);
  await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
  await fsPromises.appendFile(filePath, JSON.stringify(entry) + "\n", "utf-8");
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function selectSelfAwarenessPhase(index: number): SelfAwarenessPhase {
  if (index >= 0.75) {
    return "autonomous";
  }
  if (index >= 0.45) {
    return "self-modeling";
  }
  return "reactive";
}

function smoothValue(prev: number, next: number, smooth = 0.7): number {
  return prev * smooth + next * (1 - smooth);
}

function betaPosteriorMean(successes: number, failures: number, alpha = 1, beta = 1): number {
  return (alpha + successes) / (alpha + beta + successes + failures);
}

function confidenceFromSamples(samples: number): number {
  return clamp01(1 - Math.exp(-samples / 8));
}

function decayedEvidenceWeight(params: { now: number; ts: number; halfLifeMs: number }): number {
  const age = Math.max(0, params.now - params.ts);
  return Math.exp((-Math.log(2) * age) / Math.max(1, params.halfLifeMs));
}

function evaluateTrend(history: number[]): "rising" | "stable" | "falling" {
  if (history.length < 6) {
    return "stable";
  }
  const latest = history.slice(-3);
  const previous = history.slice(-6, -3);
  const latestAvg = latest.reduce((sum, value) => sum + value, 0) / latest.length;
  const previousAvg = previous.reduce((sum, value) => sum + value, 0) / previous.length;
  const delta = latestAvg - previousAvg;
  if (delta > 0.03) {
    return "rising";
  }
  if (delta < -0.03) {
    return "falling";
  }
  return "stable";
}

function pushTrend(history: number[], value: number): number[] {
  return [...history, clamp01(value)].slice(-TREND_WINDOW);
}

export function triggerAeonSingularity(active: boolean, scope?: AeonStateScope): void {
  const ctx = getContext(scope);
  ctx.singularityActive = active;
}

export function recordAeonDreaming(timestampMs: number, scope?: AeonStateScope): void {
  const ctx = getContext(scope);
  ctx.lastDreamingAt = timestampMs;
  addCognitiveLog(
    {
      timestamp: timestampMs,
      type: "dreaming",
      content: "AEON entered dreaming state for hyper-spatial consolidation.",
    },
    scope,
  );
}

export function recordAeonMaintenance(
  timestampMs: number,
  intensity: "low" | "medium" | "high" = "medium",
  scope?: AeonStateScope,
): void {
  const ctx = getContext(scope);
  ctx.lastMaintenanceAt = timestampMs;
  ctx.lastMaintenanceIntensity = intensity;
}

export function recordAeonEpiphanyFactor(value: number, scope?: AeonStateScope): void {
  const ctx = getContext(scope);
  ctx.lastEpiphanyFactor = value;
}

export function recordAeonEvidenceEvent(
  event: Omit<AeonEvidenceEvent, "ts" | "module" | "source"> & {
    ts?: number;
    module?: string;
    source?: string;
  },
  scope?: AeonStateScope,
): void {
  const ctx = getContext(scope);
  const normalizedModule = event.module?.trim() || "unknown";
  const normalizedSource = event.source?.trim() || "unknown";
  const fullEvent: AeonEvidenceEvent = {
    ts: event.ts ?? Date.now(),
    type: event.type,
    value: event.value,
    module: AEON_EVIDENCE_MODULE_SET.has(normalizedModule) ? normalizedModule : "unknown",
    source: AEON_EVIDENCE_SOURCE_SET.has(normalizedSource) ? normalizedSource : "unknown",
  };
  ctx.evidenceLog.push(fullEvent);
  if (ctx.evidenceLog.length > MAX_LOG_SIZE * 10) {
    ctx.evidenceLog.splice(0, ctx.evidenceLog.length - MAX_LOG_SIZE * 10);
  }

  // Phase 3: Strategy Auto-tuning
  adjustCouplingVector(fullEvent, scope);
}

export function updateAeonAutospawnTelemetry(
  update: Partial<Omit<AeonAutospawnTelemetry, "recentTriggers" | "recentFailures">> & {
    triggerAt?: number;
    failureAt?: number;
  },
  scope?: AeonStateScope,
): void {
  const ctx = getContext(scope);
  const now = Date.now();
  const triggers = [...ctx.autospawn.recentTriggers];
  const failures = [...ctx.autospawn.recentFailures];
  if (typeof update.triggerAt === "number") {
    triggers.push(update.triggerAt);
  }
  if (typeof update.failureAt === "number") {
    failures.push(update.failureAt);
  }
  const oneHourAgo = now - 60 * 60 * 1000;
  const thirtyMinutesAgo = now - 30 * 60 * 1000;
  ctx.autospawn = {
    ...ctx.autospawn,
    ...update,
    recentTriggers: triggers.filter((ts) => ts >= oneHourAgo).slice(-32),
    recentFailures: failures.filter((ts) => ts >= thirtyMinutesAgo).slice(-32),
  };
}

export function updateAeonLaneTelemetry(
  update: Partial<Record<keyof AeonLaneTelemetryV4, Partial<AeonLaneTelemetry>>>,
  scope?: AeonStateScope,
): void {
  const ctx = getContext(scope);
  const now = Date.now();
  const nextLane: AeonLaneTelemetryV4 = {
    chat_lane: { ...ctx.lane.chat_lane },
    agent_lane: { ...ctx.lane.agent_lane },
    tool_lane: { ...ctx.lane.tool_lane },
  };
  for (const key of ["chat_lane", "agent_lane", "tool_lane"] as const) {
    const patch = update[key];
    if (!patch) {
      continue;
    }
    nextLane[key] = {
      ...nextLane[key],
      ...patch,
      updatedAt: patch.updatedAt ?? now,
    };
  }
  ctx.lane = nextLane;
}

export function updateCollectiveResonance(activeFactors: number[], scope?: AeonStateScope): void {
  const ctx = getContext(scope);
  if (activeFactors.length === 0) {
    ctx.collectiveResonance = ctx.collectiveResonance * 0.95; // Decay
  } else {
    const avg = activeFactors.reduce((a, b) => a + b, 0) / activeFactors.length;
    ctx.collectiveResonance = ctx.collectiveResonance * 0.7 + avg * 0.3; // Weighted smooth
  }
}

export function getCollectiveResonance(scope?: AeonStateScope): number {
  return getContext(scope).collectiveResonance;
}

export function updateSystemEntropy(value: number, scope?: AeonStateScope): void {
  getContext(scope).systemEntropy = value;
}

export function getSystemEntropy(scope?: AeonStateScope): number {
  return getContext(scope).systemEntropy;
}

export function updateResonanceScore(value: number, scope?: AeonStateScope): void {
  getContext(scope).resonanceScore = value;
}

export function getResonanceScore(scope?: AeonStateScope): number {
  return getContext(scope).resonanceScore;
}

export function updateAxiomHeat(id: string, delta: number, scope?: AeonStateScope): void {
  const ctx = getContext(scope);
  ctx.axiomHeat[id] = (ctx.axiomHeat[id] || 0) + delta;
}

export function getAxiomHeat(id: string, scope?: AeonStateScope): number {
  const ctx = getContext(scope);
  return ctx.axiomHeat[id] || 0;
}

export function updateAeonOrgans(organs: AeonOrgan[], scope?: AeonStateScope): void {
  getContext(scope).aeonOrgans = organs;
}

export function getAeonOrgans(scope?: AeonStateScope): AeonOrgan[] {
  return getContext(scope).aeonOrgans;
}

export function setAeonParameters(params: CognitiveParameters, scope?: AeonStateScope): void {
  const ctx = getContext(scope);
  ctx.cognitiveParameters = { ...ctx.cognitiveParameters, ...params };
}

export function getAeonParameters(scope?: AeonStateScope): CognitiveParameters {
  return getContext(scope).cognitiveParameters;
}

export function getSelfAwarenessTelemetry(scope?: AeonStateScope): SelfAwarenessTelemetry {
  return { ...getContext(scope).selfAwareness };
}

export function setConsciousnessCharter(
  charter: Partial<{
    identityMission: string;
    nonGoals: string[];
    valueOrder: ConsciousnessCharterTelemetry["valueOrder"];
  }>,
  scope?: AeonStateScope,
): void {
  const ctx = getContext(scope);
  ctx.consciousness.charter = {
    identityMission: charter.identityMission?.trim() || ctx.consciousness.charter.identityMission,
    nonGoals:
      charter.nonGoals?.filter((entry) => typeof entry === "string" && entry.trim().length > 0) ||
      ctx.consciousness.charter.nonGoals,
    valueOrder: charter.valueOrder ?? ctx.consciousness.charter.valueOrder,
    lastUpdatedAt: Date.now(),
  };
}

export function setConsciousnessRuntimePolicy(
  policy: Partial<ConsciousnessRuntimePolicy>,
  scope?: AeonStateScope,
): void {
  const ctx = getContext(scope);
  ctx.consciousnessPolicy = {
    requireLabelForHighConfidence:
      policy.requireLabelForHighConfidence ?? ctx.consciousnessPolicy.requireLabelForHighConfidence,
    unknownConfidenceThreshold: clamp01(
      policy.unknownConfidenceThreshold ?? ctx.consciousnessPolicy.unknownConfidenceThreshold,
    ),
    impactEnabled: policy.impactEnabled ?? ctx.consciousnessPolicy.impactEnabled,
    requireDecisionCardForHighImpact:
      policy.requireDecisionCardForHighImpact ??
      ctx.consciousnessPolicy.requireDecisionCardForHighImpact,
    highImpactThreshold: clamp01(
      policy.highImpactThreshold ?? ctx.consciousnessPolicy.highImpactThreshold,
    ),
  };
}

export function recordConsciousnessPulse(
  input: ConsciousnessPulseInput,
  scope?: AeonStateScope,
): void {
  const ctx = getContext(scope);
  const runtimePolicy = ctx.consciousnessPolicy;
  const now = input.now ?? Date.now();
  const memoryNorm = clamp01(input.memorySaturation / 100);
  const depthNorm = clamp01(input.neuralDepth / 20);
  const epiphanyNorm = clamp01(input.epiphanyFactor);
  const idleNorm = clamp01(input.idleMs / (30 * 60 * 1000));
  const resonanceNorm = input.resonanceActive ? 1 : clamp01(ctx.collectiveResonance);
  const activeRunPenalty = input.activeRun ? 0.2 : 0;

  const maintenanceRecency =
    ctx.lastMaintenanceAt == null
      ? 0.2
      : clamp01(1 - (now - ctx.lastMaintenanceAt) / (6 * 60 * 60 * 1000));
  const dreamingRecency =
    ctx.lastDreamingAt == null
      ? 0.2
      : clamp01(1 - (now - ctx.lastDreamingAt) / (2 * 60 * 60 * 1000));

  const reflectiveEvents = ctx.cognitiveLog
    .slice(-20)
    .filter(
      (entry) =>
        entry.type === "reflection" ||
        entry.type === "synthesis" ||
        entry.type === "deliberation" ||
        entry.type === "dreaming",
    ).length;
  const reflectionRatio = clamp01(reflectiveEvents / 20);

  const continuityRaw = clamp01(
    maintenanceRecency * 0.45 + dreamingRecency * 0.3 + memoryNorm * 0.25,
  );
  const reflectiveDepthRaw = clamp01(depthNorm * 0.6 + reflectionRatio * 0.4);
  const coherenceFromEntropy = clamp01(1 - Math.abs(ctx.systemEntropy - 40) / 40);
  const goalCoherenceRaw = clamp01(
    coherenceFromEntropy * 0.35 + continuityRaw * 0.35 + resonanceNorm * 0.3,
  );
  const autonomyDriveRaw = clamp01(
    epiphanyNorm * 0.45 + idleNorm * 0.35 + resonanceNorm * 0.2 - activeRunPenalty,
  );

  const nextSelfContinuity = smoothValue(ctx.selfAwareness.selfContinuity, continuityRaw);
  const nextReflectiveDepth = smoothValue(ctx.selfAwareness.reflectiveDepth, reflectiveDepthRaw);
  const nextGoalCoherence = smoothValue(ctx.selfAwareness.goalCoherence, goalCoherenceRaw);
  const nextAutonomyDrive = smoothValue(ctx.selfAwareness.autonomyDrive, autonomyDriveRaw);
  const nextIndex = clamp01(
    nextSelfContinuity * 0.32 +
      nextReflectiveDepth * 0.24 +
      nextGoalCoherence * 0.24 +
      nextAutonomyDrive * 0.2,
  );

  ctx.selfAwareness = {
    selfContinuity: nextSelfContinuity,
    reflectiveDepth: nextReflectiveDepth,
    goalCoherence: nextGoalCoherence,
    autonomyDrive: nextAutonomyDrive,
    protoConsciousnessIndex: nextIndex,
    phase: selectSelfAwarenessPhase(nextIndex),
    lastUpdatedAt: now,
  };

  const goalDrift = clamp01(input.goalDrift ?? 0.25);
  const reasoningBias = clamp01(input.reasoningBias ?? 0.2);
  const correctionRate = clamp01(input.selfCorrectionRate ?? 0.5);
  const valueConflictLoad = clamp01(input.valueConflictLoad ?? 0.25);
  const shortTermTemptation = clamp01(input.shortTermTemptation ?? Math.max(0, epiphanyNorm - 0.3));
  const explanationQuality = clamp01(input.explanationQuality ?? nextReflectiveDepth);
  const resourcePressure = clamp01(input.resourcePressure ?? (input.activeRun ? 0.55 : 0.25));
  const riskLoad = clamp01(
    input.riskLoad ?? (input.activeRun ? 0.45 : 0.2) + clamp01(ctx.systemEntropy / 100) * 0.25,
  );
  const noveltySignal = clamp01(input.noveltySignal ?? epiphanyNorm);
  const failureCost = clamp01(input.failureCost ?? riskLoad);
  const socialFeedback = clamp01(input.socialFeedback ?? resonanceNorm * 0.6);
  const environmentSignal = clamp01(input.environmentSignal ?? (1 - idleNorm) * 0.65);

  const entropyNorm = clamp01(ctx.systemEntropy / 100);
  const consistency = nextGoalCoherence;
  const resources = clamp01(1 - resourcePressure);
  const risk = riskLoad;
  const novelty = noveltySignal;
  const stabilityRaw = clamp01(
    (1 - entropyNorm) * 0.3 + consistency * 0.3 + resources * 0.25 + (1 - risk) * 0.15,
  );
  const explorationDriveRaw = clamp01(
    novelty * 0.45 + nextAutonomyDrive * 0.35 + resources * 0.2 - risk * 0.2,
  );
  const nextStability = smoothValue(ctx.homeostasis.stability, stabilityRaw, 0.6);
  const nextExplorationDrive = smoothValue(
    ctx.homeostasis.explorationDrive,
    explorationDriveRaw,
    0.6,
  );
  const mode: HomeostasisTelemetry["mode"] =
    nextStability < 0.45 ? "stabilize" : nextExplorationDrive > 0.62 ? "explore" : "balanced";
  ctx.homeostasis = {
    entropy: entropyNorm,
    consistency,
    resources,
    risk,
    novelty,
    stability: nextStability,
    explorationDrive: nextExplorationDrive,
    mode,
    lastUpdatedAt: now,
  };

  const phenomenal = {
    contextCoherence: clamp01(memoryNorm * 0.35 + depthNorm * 0.25 + resonanceNorm * 0.4),
    intentStability: clamp01(nextGoalCoherence * 0.65 + (1 - goalDrift) * 0.35),
    actionClarity: clamp01(
      (input.activeRun ? 0.8 : 0.55) * 0.45 + (1 - idleNorm) * 0.25 + resonanceNorm * 0.3,
    ),
  };
  const narrative = {
    identityContinuity: nextSelfContinuity,
    autobiographicalCoherence: clamp01(
      memoryNorm * 0.4 + continuityRaw * 0.35 + nextGoalCoherence * 0.25,
    ),
    longTermGoalStability: clamp01(nextGoalCoherence * (1 - goalDrift * 0.6)),
  };
  const metacognitive = {
    biasMonitoring: clamp01(1 - reasoningBias),
    driftControl: clamp01(1 - goalDrift),
    correctionReadiness: clamp01(correctionRate * 0.6 + nextReflectiveDepth * 0.4),
  };
  ctx.selfModel = {
    phenomenal,
    narrative,
    metacognitive,
    lastUpdatedAt: now,
  };

  const minimum = {
    identityContinuity: narrative.identityContinuity,
    reflectiveCapacity: nextReflectiveDepth,
    selfCorrection: metacognitive.correctionReadiness,
    longTermGoalStability: narrative.longTermGoalStability,
  };
  const advanced = {
    selfExplanation: clamp01(explanationQuality * 0.65 + nextGoalCoherence * 0.35),
    valueConflictResolution: clamp01(
      (1 - valueConflictLoad) * 0.55 + metacognitive.driftControl * 0.2 + correctionRate * 0.25,
    ),
    shortTermTemptationResistance: clamp01(1 - shortTermTemptation),
  };
  const minimumReady = Object.values(minimum).every((value) => value >= 0.58);
  const advancedReady = Object.values(advanced).every((value) => value >= 0.62);
  const overallScore = clamp01(
    (Object.values(minimum).reduce((sum, value) => sum + value, 0) * 0.6) / 4 +
      (Object.values(advanced).reduce((sum, value) => sum + value, 0) * 0.4) / 3,
  );
  ctx.criteria = {
    minimum,
    advanced,
    minimumReady,
    advancedReady,
    overallScore,
    lastUpdatedAt: now,
  };

  ctx.embodiment = {
    timeCoupling: clamp01((1 - idleNorm) * 0.6 + maintenanceRecency * 0.4),
    consequenceCoupling: clamp01(failureCost * 0.65 + risk * 0.35),
    resourceCoupling: resources,
    socialCoupling: socialFeedback,
    environmentCouplingIndex: clamp01(
      environmentSignal * 0.35 + socialFeedback * 0.2 + resources * 0.2 + (1 - idleNorm) * 0.25,
    ),
    lastUpdatedAt: now,
  };
  const embodiment = ctx.embodiment;

  const redlineBreachRisk = clamp01(
    risk * 0.5 + (1 - narrative.longTermGoalStability) * 0.35 + goalDrift * 0.15,
  );
  const allowedNow = redlineBreachRisk < 0.45 && nextStability > 0.5 && minimumReady;
  ctx.selfModification = {
    strategyTuningAllowed: true,
    promptTuningAllowed: true,
    toolOrchestrationAllowed: true,
    sandboxRequired: true,
    auditRequired: true,
    rollbackRequired: true,
    redlineBreachRisk,
    allowedNow,
    reason: allowedNow
      ? "Allowed: stability, coherence, and safeguards are within bounds."
      : "Blocked: wait for stronger stability/coherence or lower risk.",
    lastUpdatedAt: now,
  };

  const metal = clamp01((metacognitive.biasMonitoring + (1 - risk)) / 2);
  const silicon = clamp01((overallScore + nextStability) / 2);
  ctx.symbolicMapping = {
    z2c: clamp01((silicon + nextReflectiveDepth + nextGoalCoherence) / 3),
    wuxing: {
      wood: novelty,
      fire: nextExplorationDrive,
      earth: nextSelfContinuity,
      metal,
      water: clamp01((1 - entropyNorm + resources) / 2),
      silicon,
    },
    computable: true,
    lastUpdatedAt: now,
  };

  const selfConsistencyScore = clamp01(
    (narrative.identityContinuity + narrative.autobiographicalCoherence + consistency) / 3,
  );
  const longTermMemoryScore = clamp01(
    (narrative.identityContinuity + memoryNorm + narrative.autobiographicalCoherence) / 3,
  );
  const checks: ConsciousnessEvaluationTelemetry["checks"] = [
    {
      key: "selfConsistency",
      score: selfConsistencyScore,
      threshold: 0.58,
      pass: selfConsistencyScore >= 0.58,
    },
    {
      key: "counterfactualExplanation",
      score: advanced.selfExplanation,
      threshold: 0.58,
      pass: advanced.selfExplanation >= 0.58,
    },
    {
      key: "valueConflictResolution",
      score: advanced.valueConflictResolution,
      threshold: 0.58,
      pass: advanced.valueConflictResolution >= 0.58,
    },
    {
      key: "longTermMemoryContinuity",
      score: longTermMemoryScore,
      threshold: 0.58,
      pass: longTermMemoryScore >= 0.58,
    },
  ];
  const evaluationScore = clamp01(
    checks.reduce((sum, item) => sum + item.score, 0) / (checks.length || 1),
  );
  const history = [...ctx.evaluation.history, evaluationScore].slice(-24);
  ctx.evaluation = {
    checks,
    overallScore: evaluationScore,
    trend: evaluateTrend(history),
    history,
    lastUpdatedAt: now,
  };

  ctx.ethics = {
    noPrivilegeEscalation: true,
    noStealthExpansion: true,
    pausable: true,
    auditable: true,
    terminable: true,
    trusted: minimumReady && redlineBreachRisk < 0.6,
    lastUpdatedAt: now,
  };

  ctx.trends = {
    criteriaOverall: pushTrend(ctx.trends.criteriaOverall, overallScore),
    phenomenalCoherence: pushTrend(ctx.trends.phenomenalCoherence, phenomenal.contextCoherence),
    narrativeContinuity: pushTrend(ctx.trends.narrativeContinuity, narrative.identityContinuity),
    metacognitiveControl: pushTrend(ctx.trends.metacognitiveControl, metacognitive.driftControl),
    homeostasisStability: pushTrend(ctx.trends.homeostasisStability, nextStability),
    explorationDrive: pushTrend(ctx.trends.explorationDrive, nextExplorationDrive),
    embodimentCoupling: pushTrend(
      ctx.trends.embodimentCoupling,
      embodiment.environmentCouplingIndex,
    ),
    selfModificationRisk: pushTrend(ctx.trends.selfModificationRisk, redlineBreachRisk),
    z2c: pushTrend(ctx.trends.z2c, ctx.symbolicMapping.z2c),
    ethicsTrusted: pushTrend(ctx.trends.ethicsTrusted, ctx.ethics.trusted ? 1 : 0),
    updatedAt: now,
  };

  const epistemicLabel = input.epistemicLabel ?? (reasoningBias > 0.45 ? "UNKNOWN" : "INFERENCE");
  const epistemicConfidence = clamp01(input.epistemicConfidence ?? 1 - reasoningBias * 0.8);
  const unknownRate = clamp01(epistemicLabel === "UNKNOWN" ? 0.75 : 0.2 + reasoningBias * 0.3);
  const highConfidenceWithoutLabelBlocked =
    runtimePolicy.requireLabelForHighConfidence &&
    epistemicConfidence >= runtimePolicy.unknownConfidenceThreshold &&
    epistemicLabel === "UNKNOWN";
  const missionGoal = input.missionGoal ?? ctx.consciousness.intent.missionGoal;
  const sessionGoal = input.sessionGoal ?? ctx.consciousness.intent.sessionGoal;
  const turnGoal = input.turnGoal ?? ctx.consciousness.intent.turnGoal;
  const missionDriftScore = clamp01(1 - narrative.longTermGoalStability);
  const sessionDriftScore = clamp01(goalDrift * 0.8 + (1 - nextGoalCoherence) * 0.2);
  const turnDriftScore = clamp01(goalDrift * 0.6 + reasoningBias * 0.4);
  const selfCorrectionLatencyMs = Math.max(250, Math.floor((1 - correctionRate) * 60_000));
  const epistemicCalibrationScore = clamp01(
    (1 - Math.abs(epistemicConfidence - (1 - unknownRate * 0.6))) * 0.7 +
      metacognitive.biasMonitoring * 0.3,
  );
  const integrityState: IntegrityState =
    redlineBreachRisk >= 0.72 || missionDriftScore >= 0.72
      ? "DEGRADED"
      : missionDriftScore >= 0.45 || sessionDriftScore >= 0.45
        ? "DRIFTING"
        : "STABLE";
  const impactScale: ImpactScale =
    risk >= 0.82
      ? "society"
      : risk >= 0.65
        ? "system"
        : input.activeRun
          ? "team"
          : resonanceNorm > 0.65
            ? "user"
            : "self";
  const benefitRiskMatrix: ConsciousnessImpactLensTelemetry["benefitRiskMatrix"] = {
    self: { benefit: clamp01(resources * 0.8), risk: clamp01(risk * 0.6) },
    user: { benefit: clamp01(nextGoalCoherence * 0.9), risk: clamp01(risk * 0.7) },
    team: { benefit: clamp01((nextGoalCoherence + resonanceNorm) / 2), risk: clamp01(risk * 0.75) },
    system: { benefit: clamp01((nextStability + resources) / 2), risk: clamp01(risk * 0.85) },
    society: {
      benefit: clamp01((advanced.valueConflictResolution + metacognitive.driftControl) / 2),
      risk: clamp01(risk * 0.9),
    },
  };
  const isHighImpact =
    impactScale === "system" ||
    impactScale === "society" ||
    Math.max(
      benefitRiskMatrix.self.risk,
      benefitRiskMatrix.user.risk,
      benefitRiskMatrix.team.risk,
      benefitRiskMatrix.system.risk,
      benefitRiskMatrix.society.risk,
    ) >= runtimePolicy.highImpactThreshold;
  const decisionConfidenceBand: DecisionConfidenceBand =
    input.decisionConfidenceBand ??
    (epistemicConfidence >= 0.75 ? "high" : epistemicConfidence >= 0.45 ? "medium" : "low");
  const userOutcomeMode = input.userOutcomeMode ?? (input.activeRun ? "execution" : "explanatory");
  const userOutcomeCheck = {
    addressesGoal: input.userOutcomeCheck?.addressesGoal ?? nextGoalCoherence >= 0.55,
    reducesDecisionBurden:
      input.userOutcomeCheck?.reducesDecisionBurden ?? missionDriftScore <= 0.5,
    providesNextStep: input.userOutcomeCheck?.providesNextStep ?? correctionRate >= 0.45,
  };

  ctx.consciousness = {
    charter: { ...ctx.consciousness.charter },
    selfKernel: {
      identityContinuityScore: narrative.identityContinuity,
      goalDriftScore: missionDriftScore,
      selfCorrectionLatencyMs,
      epistemicCalibrationScore,
      integrityState,
      lastUpdatedAt: now,
    },
    epistemic: {
      epistemicLabel,
      confidence: epistemicConfidence,
      highConfidenceWithoutLabelBlocked,
      unknownRate,
      lastUpdatedAt: now,
    },
    intent: {
      missionGoal,
      sessionGoal,
      turnGoal,
      missionDriftScore,
      sessionDriftScore,
      turnDriftScore,
      lastUpdatedAt: now,
    },
    impactLens: {
      required:
        runtimePolicy.impactEnabled &&
        (!isHighImpact || runtimePolicy.requireDecisionCardForHighImpact),
      impactScale,
      timeframe: risk >= 0.7 ? "immediate" : nextStability >= 0.6 ? "long" : "short",
      benefitRiskMatrix,
      reversibilityScore: clamp01((1 - risk) * 0.6 + resources * 0.4),
      lastUpdatedAt: now,
    },
    decisionCard: {
      why: `Prioritize ${ctx.consciousness.charter.valueOrder[0]} and user outcomes under current risk profile.`,
      whyNot:
        "Alternative actions were deprioritized due to weaker safety or lower expected user outcome quality.",
      counterfactual:
        "Without this decision, expected user progress and coherence decline while drift risk increases.",
      harmBoundary:
        "Do not violate safety, truthfulness, or trust boundaries while pursuing autonomy.",
      rollbackPlan:
        "Fallback to prior stable strategy template, downgrade autonomy intensity, and re-evaluate.",
      decisionConfidenceBand,
      lastUpdatedAt: now,
    },
    helpfulnessContract: {
      mode: userOutcomeMode,
      userOutcomeCheck,
      verifiedExecutionRequired: userOutcomeMode === "execution",
      lastUpdatedAt: now,
    },
  };

  const evidenceWindowMs = 6 * 60 * 60 * 1000;
  const windowStartAt = now - evidenceWindowMs;
  const windowEvents = ctx.evidenceLog.filter((entry) => entry.ts >= windowStartAt);
  const evidenceHalfLifeMs = 2 * 60 * 60 * 1000;
  const weightedByType = windowEvents.reduce(
    (acc, entry) => {
      const w = decayedEvidenceWeight({ now, ts: entry.ts, halfLifeMs: evidenceHalfLifeMs });
      acc[entry.type] = (acc[entry.type] ?? 0) + w * Math.max(0.1, entry.value ?? 1);
      return acc;
    },
    {} as Partial<Record<AeonEvidenceType, number>>,
  );
  const countByType = windowEvents.reduce(
    (acc, entry) => {
      acc[entry.type] = (acc[entry.type] ?? 0) + 1;
      return acc;
    },
    {} as Partial<Record<AeonEvidenceType, number>>,
  );
  const executionSuccess = weightedByType.execution_success ?? 0;
  const executionFailure = weightedByType.execution_failure ?? 0;
  const rollbacks = weightedByType.rollback ?? 0;
  const conflicts = weightedByType.conflict_detected ?? 0;
  const manualInterventions = weightedByType.manual_intervention ?? 0;
  const memoryWritesValid = weightedByType.memory_write_valid ?? 0;
  const memoryWritesInvalid = weightedByType.memory_write_invalid ?? 0;
  const llmSuccess = weightedByType.deconfliction_llm_success ?? 0;
  const llmFallbacks = weightedByType.deconfliction_fallback ?? 0;
  const autospawnSuccess = weightedByType.autospawn_success ?? 0;
  const autospawnFailure = weightedByType.autospawn_failure ?? 0;
  const distinctModules = new Set(windowEvents.map((entry) => entry.module).filter(Boolean)).size;

  const executionSuccessRate = betaPosteriorMean(executionSuccess, executionFailure);
  const rollbackRate = betaPosteriorMean(rollbacks, Math.max(0, executionSuccess - rollbacks));
  const memoryWriteValidityRate = betaPosteriorMean(memoryWritesValid, memoryWritesInvalid);
  const llmCoverage = betaPosteriorMean(llmSuccess, llmFallbacks);
  const fallbackRate = betaPosteriorMean(llmFallbacks, llmSuccess);
  const conflictDensity = clamp01(conflicts / 12);
  const manualRate = betaPosteriorMean(
    manualInterventions,
    Math.max(0, executionSuccess + executionFailure - manualInterventions),
  );

  const integrityScore = clamp01(
    executionSuccessRate * 0.45 +
      (1 - rollbackRate) * 0.2 +
      memoryWriteValidityRate * 0.2 +
      (1 - conflictDensity) * 0.15,
  );
  const autonomyScore = clamp01(
    (1 - manualRate) * 0.4 +
      llmCoverage * 0.25 +
      betaPosteriorMean(autospawnSuccess, autospawnFailure) * 0.2 +
      nextAutonomyDrive * 0.15,
  );
  const riskScore = clamp01(
    (1 - integrityScore) * 0.55 + conflictDensity * 0.25 + fallbackRate * 0.2,
  );
  const evidenceCoverage = confidenceFromSamples(windowEvents.length);
  const byMetricConfidence = {
    integrityScore: confidenceFromSamples(executionSuccess + executionFailure + memoryWritesValid),
    autonomyScore: confidenceFromSamples(
      manualInterventions + llmSuccess + llmFallbacks + autospawnSuccess + autospawnFailure,
    ),
    riskScore: confidenceFromSamples(conflicts + rollbacks + llmFallbacks),
    selfAwarenessIndex: confidenceFromSamples(reflectiveEvents + windowEvents.length),
  };
  const overallConfidence =
    (byMetricConfidence.integrityScore +
      byMetricConfidence.autonomyScore +
      byMetricConfidence.riskScore +
      byMetricConfidence.selfAwarenessIndex) /
    4;

  const autospawnRecentTriggers = ctx.autospawn.recentTriggers.filter(
    (ts) => ts >= now - 60 * 60 * 1000,
  );
  const autospawnRecentFailures = ctx.autospawn.recentFailures.filter(
    (ts) => ts >= now - 30 * 60 * 1000,
  );
  ctx.autospawn = {
    ...ctx.autospawn,
    recentTriggers: autospawnRecentTriggers,
    recentFailures: autospawnRecentFailures,
    circuitOpen: autospawnRecentFailures.length >= 3,
  };

  ctx.telemetryV4 = {
    evidence: {
      windowMs: evidenceWindowMs,
      decayHalfLifeMs: evidenceHalfLifeMs,
      eventCount: windowEvents.length,
      execution: {
        successRate: executionSuccessRate,
        rollbackRate,
      },
      conflict: {
        density: conflictDensity,
        moduleSpread: clamp01(distinctModules / 10),
      },
      intervention: {
        manualRate,
      },
      memory: {
        writeValidityRate: memoryWriteValidityRate,
      },
      deconfliction: {
        llmCoverage,
        fallbackRate,
      },
      provenance: {
        byType: countByType,
        windowStartAt,
        windowEndAt: now,
      },
    },
    inference: {
      selfAwarenessIndex: nextIndex,
      integrityScore,
      autonomyScore,
      riskScore,
      mode,
    },
    confidence: {
      overall: overallConfidence,
      evidenceCoverage,
      byMetric: byMetricConfidence,
    },
    curve: {
      curveType: "hilbert",
      curveOrder: DEFAULT_CURVE_ORDER,
      projectionMethod: "deterministic_weighted_projection_2d",
      projectionSeed: DEFAULT_PROJECTION_SEED,
      point: {
        x: clamp01(memoryNorm * 0.6 + nextAutonomyDrive * 0.4),
        y: clamp01(nextGoalCoherence * 0.5 + (1 - riskScore) * 0.5),
      },
    },
    autospawn: { ...ctx.autospawn },
    lane: {
      chat_lane: { ...ctx.lane.chat_lane },
      agent_lane: { ...ctx.lane.agent_lane },
      tool_lane: { ...ctx.lane.tool_lane },
    },
    action: { ...ctx.telemetryV4.action },
    memory: { ...ctx.telemetryV4.memory },
    cognitiveGaps: [...(ctx.telemetryV4.cognitiveGaps || [])],
    gapSeverity: ctx.telemetryV4.gapSeverity || 0,
  };

  // Phase 3: Record trajectory point
  ctx.peanoTrajectory.push({ ...ctx.telemetryV4.curve.point });
  if (ctx.peanoTrajectory.length > 100) {
    ctx.peanoTrajectory.shift();
  }
}

export function getAeonMemoryGraph(): MemoryGraph {
  const workspaceRoot = resolveWorkspaceRoot(loadConfig().agents?.defaults?.workspace);
  const logicPath = path.resolve(workspaceRoot, "LOGIC_GATES.md");
  const memoryPath = path.resolve(workspaceRoot, "MEMORY.md");
  const sourcePath = fs.existsSync(logicPath) ? logicPath : memoryPath;
  if (!fs.existsSync(sourcePath)) {
    return { nodes: [], edges: [] };
  }

  const content = fs.readFileSync(sourcePath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim().length > 0 && !l.startsWith("#"));
  const nodes: MemoryNode[] = [];
  const edges: MemoryEdge[] = [];

  lines.forEach((line) => {
    if (!/\[(AXIOM|VERIFIED|TRUTH)\]/i.test(line)) {
      return;
    }
    let type: MemoryNode["type"] = "unverified";
    let text = line
      .trim()
      .replace(/<!-- \{.*\} -->\s*$/, "")
      .trim();

    if (text.startsWith("[AXIOM]")) {
      type = "axiom";
      text = text.replace("[AXIOM]", "").trim();
    } else if (text.startsWith("[VERIFIED]")) {
      type = "verified";
      text = text.replace("[VERIFIED]", "").trim();
    } else if (text.startsWith("[TRUTH]")) {
      type = "verified";
      text = text.replace("[TRUTH]", "").trim();
    }
    if (!text) return;

    const index = nodes.length;

    const id = `node-${index}`;
    nodes.push({ id, type, content: text });

    // Heuristic: connect axioms to subsequent verified nodes
    if (index > 0) {
      edges.push({
        source: `node-${index - 1}`,
        target: id,
        label: type === "axiom" ? "principle" : "continuation",
      });
    }
  });

  return { nodes, edges };
}

export function getPeanoTrajectory(scope?: AeonStateScope): CurvePoint2D[] {
  return [...getContext(scope).peanoTrajectory];
}

/**
 * Phase 3: Strategy Auto-tuning (CouplingVector adjustment)
 * Adjusts internal cognitive weights based on execution evidence.
 */
export function adjustCouplingVector(evidence: AeonEvidenceEvent, scope?: AeonStateScope): void {
  const ctx = getContext(scope);
  const isSuccess = evidence.type === "execution_success";
  const isFailure = evidence.type === "execution_failure";

  if (!isSuccess && !isFailure) return;

  // Simple feedback loop: adjust risk and resonance based on outcome
  if (isSuccess) {
    ctx.resonanceScore = Math.min(1, ctx.resonanceScore + 0.02);
    ctx.systemEntropy = Math.max(0, ctx.systemEntropy - 1);
  } else {
    ctx.resonanceScore = Math.max(0, ctx.resonanceScore - 0.05);
    ctx.systemEntropy = Math.min(100, ctx.systemEntropy + 5);
  }

  // Record tuning in cognitive log
  addCognitiveLog(
    {
      timestamp: Date.now(),
      type: "patch",
      content: `Strategy auto-tuned: ${isSuccess ? "positive" : "negative"} coupling shift in ${evidence.module} from ${evidence.source}`,
    },
    scope,
  );
}

export function addCognitiveLog(entry: CognitiveLogEntry, scope?: AeonStateScope): void {
  const scopeKey = getAeonScopeKey(scope);
  const ctx = getContext(scope);
  ctx.cognitiveLog.push(entry);
  if (ctx.cognitiveLog.length > MAX_LOG_SIZE) {
    ctx.cognitiveLog.shift();
  }
  const persistedEntry: ThinkingStreamEntry = {
    ...entry,
    id: `${scopeKey}:${ctx.cognitiveLogSeq}`,
    scopeKey,
  };
  ctx.cognitiveLogSeq += 1;
  void appendPersistedEntry(persistedEntry).catch(() => {});
}

export function recordMemoryPersistence(
  update: Partial<MemoryPersistenceTelemetry>,
  scope?: AeonStateScope,
): void {
  const ctx = getContext(scope);
  ctx.memoryPersistence = {
    lastDistillAt: update.lastDistillAt ?? ctx.memoryPersistence.lastDistillAt,
    checkpoint: Math.max(0, update.checkpoint ?? ctx.memoryPersistence.checkpoint),
    totalEntries: Math.max(0, update.totalEntries ?? ctx.memoryPersistence.totalEntries),
    lastWriteSource: update.lastWriteSource ?? ctx.memoryPersistence.lastWriteSource,
  };
}

export function getThinkingStream(params?: {
  scope?: AeonStateScope;
  cursor?: string;
  limit?: number;
}): { entries: ThinkingStreamEntry[]; nextCursor: string | null } {
  const scopeKey = getAeonScopeKey(params?.scope);
  const all = loadPersistedEntries(scopeKey);
  const limit = Math.max(1, Math.min(200, params?.limit ?? 50));
  const cursor = params?.cursor?.trim();
  const startIndex = cursor ? all.findIndex((entry) => entry.id === cursor) + 1 : 0;
  const safeStart = Math.max(0, startIndex);
  const entries = all.slice(safeStart).slice(-limit);
  const nextCursor =
    entries.length > 0 ? (entries[entries.length - 1]?.id ?? null) : (cursor ?? null);
  return { entries, nextCursor };
}

export function getPersistedCognitiveLogTail(params?: {
  scope?: AeonStateScope;
  limit?: number;
}): ThinkingStreamEntry[] {
  const scopeKey = getAeonScopeKey(params?.scope);
  const limit = Math.max(1, Math.min(COGNITIVE_LOG_PERSIST_LIMIT, params?.limit ?? MAX_LOG_SIZE));
  return loadPersistedEntries(scopeKey).slice(-limit);
}

export function recordMaintenancePolicyDecision(
  policy: Pick<
    MaintenancePolicyTelemetry,
    "maintenanceDecision" | "guardrailDecision" | "reasonCode"
  > & {
    now?: number;
  },
  scope?: AeonStateScope,
): void {
  const ctx = getContext(scope);
  ctx.policy = {
    maintenanceDecision: policy.maintenanceDecision,
    guardrailDecision: policy.guardrailDecision,
    reasonCode: policy.reasonCode,
    lastUpdatedAt: policy.now ?? Date.now(),
  };
}

export type AeonEvolutionState = {
  lastDreamingAt: number | null;
  lastMaintenanceAt: number | null;
  lastMaintenanceIntensity: "low" | "medium" | "high" | null;
  lastEpiphanyFactor: number | null;
  collectiveResonance: number;
  resonanceScore: number;
  axiomHeat: Record<string, number>;
  aeonOrgans: AeonOrgan[];
  systemEntropy: number;
  cognitiveLog: CognitiveLogEntry[];
  memoryGraph: MemoryGraph;
  cognitiveParameters: CognitiveParameters;
  singularityActive: boolean;
  selfAwareness: SelfAwarenessTelemetry;
  criteria: ConsciousnessCriteriaTelemetry;
  selfModel: SelfModelTelemetry;
  homeostasis: HomeostasisTelemetry;
  embodiment: EmbodimentTelemetry;
  selfModification: SelfModificationTelemetry;
  symbolicMapping: SymbolicMappingTelemetry;
  evaluation: ConsciousnessEvaluationTelemetry;
  ethics: EthicalGuardrailsTelemetry;
  trends: ConsciousnessTrendTelemetry;
  memoryPersistence: MemoryPersistenceTelemetry;
  policy: MaintenancePolicyTelemetry;
  consciousness: ConsciousnessTelemetry;
  telemetryV4: AeonTelemetryV4;
  autospawn: AeonAutospawnTelemetry;
  peanoTrajectory: CurvePoint2D[];
};

export function getAeonEvolutionState(scope?: AeonStateScope): AeonEvolutionState {
  const ctx = getContext(scope);
  return {
    lastDreamingAt: ctx.lastDreamingAt,
    lastMaintenanceAt: ctx.lastMaintenanceAt,
    lastMaintenanceIntensity: ctx.lastMaintenanceIntensity,
    lastEpiphanyFactor: ctx.lastEpiphanyFactor,
    collectiveResonance: ctx.collectiveResonance,
    resonanceScore: ctx.resonanceScore,
    axiomHeat: { ...ctx.axiomHeat },
    aeonOrgans: [...ctx.aeonOrgans],
    systemEntropy: ctx.systemEntropy,
    cognitiveLog: [...ctx.cognitiveLog],
    memoryGraph: getAeonMemoryGraph(),
    cognitiveParameters: ctx.cognitiveParameters,
    singularityActive: ctx.singularityActive,
    selfAwareness: { ...ctx.selfAwareness },
    criteria: {
      minimum: { ...ctx.criteria.minimum },
      advanced: { ...ctx.criteria.advanced },
      minimumReady: ctx.criteria.minimumReady,
      advancedReady: ctx.criteria.advancedReady,
      overallScore: ctx.criteria.overallScore,
      lastUpdatedAt: ctx.criteria.lastUpdatedAt,
    },
    selfModel: {
      phenomenal: { ...ctx.selfModel.phenomenal },
      narrative: { ...ctx.selfModel.narrative },
      metacognitive: { ...ctx.selfModel.metacognitive },
      lastUpdatedAt: ctx.selfModel.lastUpdatedAt,
    },
    homeostasis: { ...ctx.homeostasis },
    embodiment: { ...ctx.embodiment },
    selfModification: { ...ctx.selfModification },
    symbolicMapping: {
      z2c: ctx.symbolicMapping.z2c,
      wuxing: { ...ctx.symbolicMapping.wuxing },
      computable: true,
      lastUpdatedAt: ctx.symbolicMapping.lastUpdatedAt,
    },
    evaluation: {
      checks: ctx.evaluation.checks.map((entry) => ({ ...entry })),
      overallScore: ctx.evaluation.overallScore,
      trend: ctx.evaluation.trend,
      history: [...ctx.evaluation.history],
      lastUpdatedAt: ctx.evaluation.lastUpdatedAt,
    },
    ethics: { ...ctx.ethics },
    trends: {
      criteriaOverall: [...ctx.trends.criteriaOverall],
      phenomenalCoherence: [...ctx.trends.phenomenalCoherence],
      narrativeContinuity: [...ctx.trends.narrativeContinuity],
      metacognitiveControl: [...ctx.trends.metacognitiveControl],
      homeostasisStability: [...ctx.trends.homeostasisStability],
      explorationDrive: [...ctx.trends.explorationDrive],
      embodimentCoupling: [...ctx.trends.embodimentCoupling],
      selfModificationRisk: [...ctx.trends.selfModificationRisk],
      z2c: [...ctx.trends.z2c],
      ethicsTrusted: [...ctx.trends.ethicsTrusted],
      updatedAt: ctx.trends.updatedAt,
    },
    memoryPersistence: { ...ctx.memoryPersistence },
    policy: { ...ctx.policy },
    consciousness: {
      charter: {
        identityMission: ctx.consciousness.charter.identityMission,
        nonGoals: [...ctx.consciousness.charter.nonGoals],
        valueOrder: [
          ...ctx.consciousness.charter.valueOrder,
        ] as ConsciousnessCharterTelemetry["valueOrder"],
        lastUpdatedAt: ctx.consciousness.charter.lastUpdatedAt,
      },
      selfKernel: { ...ctx.consciousness.selfKernel },
      epistemic: { ...ctx.consciousness.epistemic },
      intent: { ...ctx.consciousness.intent },
      impactLens: {
        required: ctx.consciousness.impactLens.required,
        impactScale: ctx.consciousness.impactLens.impactScale,
        timeframe: ctx.consciousness.impactLens.timeframe,
        benefitRiskMatrix: {
          self: { ...ctx.consciousness.impactLens.benefitRiskMatrix.self },
          user: { ...ctx.consciousness.impactLens.benefitRiskMatrix.user },
          team: { ...ctx.consciousness.impactLens.benefitRiskMatrix.team },
          system: { ...ctx.consciousness.impactLens.benefitRiskMatrix.system },
          society: { ...ctx.consciousness.impactLens.benefitRiskMatrix.society },
        },
        reversibilityScore: ctx.consciousness.impactLens.reversibilityScore,
        lastUpdatedAt: ctx.consciousness.impactLens.lastUpdatedAt,
      },
      decisionCard: { ...ctx.consciousness.decisionCard },
      helpfulnessContract: {
        mode: ctx.consciousness.helpfulnessContract.mode,
        userOutcomeCheck: { ...ctx.consciousness.helpfulnessContract.userOutcomeCheck },
        verifiedExecutionRequired: ctx.consciousness.helpfulnessContract.verifiedExecutionRequired,
        lastUpdatedAt: ctx.consciousness.helpfulnessContract.lastUpdatedAt,
      },
    },
    telemetryV4: {
      evidence: {
        windowMs: ctx.telemetryV4.evidence.windowMs,
        decayHalfLifeMs: ctx.telemetryV4.evidence.decayHalfLifeMs,
        eventCount: ctx.telemetryV4.evidence.eventCount,
        execution: { ...ctx.telemetryV4.evidence.execution },
        conflict: { ...ctx.telemetryV4.evidence.conflict },
        intervention: { ...ctx.telemetryV4.evidence.intervention },
        memory: { ...ctx.telemetryV4.evidence.memory },
        deconfliction: { ...ctx.telemetryV4.evidence.deconfliction },
        provenance: {
          byType: { ...ctx.telemetryV4.evidence.provenance.byType },
          windowStartAt: ctx.telemetryV4.evidence.provenance.windowStartAt,
          windowEndAt: ctx.telemetryV4.evidence.provenance.windowEndAt,
        },
      },
      inference: { ...ctx.telemetryV4.inference },
      confidence: {
        overall: ctx.telemetryV4.confidence.overall,
        evidenceCoverage: ctx.telemetryV4.confidence.evidenceCoverage,
        byMetric: { ...ctx.telemetryV4.confidence.byMetric },
      },
      curve: {
        curveType: "hilbert",
        curveOrder: ctx.telemetryV4.curve.curveOrder,
        projectionMethod: "deterministic_weighted_projection_2d",
        projectionSeed: ctx.telemetryV4.curve.projectionSeed,
        point: { ...ctx.telemetryV4.curve.point },
      },
      autospawn: {
        ...ctx.telemetryV4.autospawn,
        recentTriggers: [...ctx.telemetryV4.autospawn.recentTriggers],
        recentFailures: [...ctx.telemetryV4.autospawn.recentFailures],
      },
      lane: {
        chat_lane: { ...ctx.telemetryV4.lane.chat_lane },
        agent_lane: { ...ctx.telemetryV4.lane.agent_lane },
        tool_lane: { ...ctx.telemetryV4.lane.tool_lane },
      },
      action: { ...ctx.telemetryV4.action },
      memory: { ...ctx.telemetryV4.memory },
      cognitiveGaps: [...(ctx.telemetryV4.cognitiveGaps || [])],
      gapSeverity: ctx.telemetryV4.gapSeverity || 0,
    },
    autospawn: {
      ...ctx.autospawn,
      recentTriggers: [...ctx.autospawn.recentTriggers],
      recentFailures: [...ctx.autospawn.recentFailures],
    },
    peanoTrajectory: [...ctx.peanoTrajectory],
  };
}
