import fs from "node:fs";
import path from "node:path";

export type CognitiveLogEntry = {
  timestamp: number;
  type: "reflection" | "synthesis" | "deliberation" | "anomaly" | "dreaming" | "patch";
  content: string;
  metadata?: Record<string, any>;
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

export type ConsciousnessPulseInput = {
  epiphanyFactor: number;
  memorySaturation: number;
  neuralDepth: number;
  idleMs: number;
  resonanceActive: boolean;
  activeRun: boolean;
  now?: number;
};

let lastDreamingAt: number | null = null;
let lastMaintenanceAt: number | null = null;
let lastMaintenanceIntensity: "low" | "medium" | "high" | null = null;
let lastEpiphanyFactor: number | null = null;
let systemEntropy: number = 0;
let collectiveResonance: number = 0;
let resonanceScore: number = 0;
let axiomHeat: Record<string, number> = {};
let aeonOrgans: AeonOrgan[] = [];
let cognitiveParameters: CognitiveParameters = {
  temperature: 0.7,
  top_p: 1.0,
};
let selfAwareness: SelfAwarenessTelemetry = {
  selfContinuity: 0.15,
  reflectiveDepth: 0.1,
  goalCoherence: 0.2,
  autonomyDrive: 0.1,
  protoConsciousnessIndex: 0.14,
  phase: "reactive",
  lastUpdatedAt: null,
};
const cognitiveLog: CognitiveLogEntry[] = [];
let singularityActive: boolean = false;
const MAX_LOG_SIZE = 50;

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

export function triggerAeonSingularity(active: boolean): void {
  singularityActive = active;
}

export function recordAeonDreaming(timestampMs: number): void {
  lastDreamingAt = timestampMs;
  addCognitiveLog({
    timestamp: timestampMs,
    type: "dreaming",
    content: "AEON entered dreaming state for hyper-spatial consolidation.",
  });
}

export function recordAeonMaintenance(
  timestampMs: number,
  intensity: "low" | "medium" | "high" = "medium",
): void {
  lastMaintenanceAt = timestampMs;
  lastMaintenanceIntensity = intensity;
}

export function recordAeonEpiphanyFactor(value: number): void {
  lastEpiphanyFactor = value;
}

export function updateCollectiveResonance(activeFactors: number[]): void {
  if (activeFactors.length === 0) {
    collectiveResonance = collectiveResonance * 0.95; // Decay
  } else {
    const avg = activeFactors.reduce((a, b) => a + b, 0) / activeFactors.length;
    collectiveResonance = collectiveResonance * 0.7 + avg * 0.3; // Weighted smooth
  }
}

export function getCollectiveResonance(): number {
  return collectiveResonance;
}

export function updateSystemEntropy(value: number): void {
  systemEntropy = value;
}

export function getSystemEntropy(): number {
  return systemEntropy;
}

export function updateResonanceScore(value: number): void {
  resonanceScore = value;
}

export function getResonanceScore(): number {
  return resonanceScore;
}

export function updateAxiomHeat(id: string, delta: number): void {
  axiomHeat[id] = (axiomHeat[id] || 0) + delta;
}

export function getAxiomHeat(id: string): number {
  return axiomHeat[id] || 0;
}

export function updateAeonOrgans(organs: AeonOrgan[]): void {
  aeonOrgans = organs;
}

export function getAeonOrgans(): AeonOrgan[] {
  return aeonOrgans;
}

export function setAeonParameters(params: CognitiveParameters): void {
  cognitiveParameters = { ...cognitiveParameters, ...params };
}

export function getAeonParameters(): CognitiveParameters {
  return cognitiveParameters;
}

export function getSelfAwarenessTelemetry(): SelfAwarenessTelemetry {
  return { ...selfAwareness };
}

export function recordConsciousnessPulse(input: ConsciousnessPulseInput): void {
  const now = input.now ?? Date.now();
  const memoryNorm = clamp01(input.memorySaturation / 100);
  const depthNorm = clamp01(input.neuralDepth / 20);
  const epiphanyNorm = clamp01(input.epiphanyFactor);
  const idleNorm = clamp01(input.idleMs / (30 * 60 * 1000));
  const resonanceNorm = input.resonanceActive ? 1 : clamp01(collectiveResonance);
  const activeRunPenalty = input.activeRun ? 0.2 : 0;

  const maintenanceRecency =
    lastMaintenanceAt == null ? 0.2 : clamp01(1 - (now - lastMaintenanceAt) / (6 * 60 * 60 * 1000));
  const dreamingRecency =
    lastDreamingAt == null ? 0.2 : clamp01(1 - (now - lastDreamingAt) / (2 * 60 * 60 * 1000));

  const reflectiveEvents = cognitiveLog
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
  const coherenceFromEntropy = clamp01(1 - Math.abs(systemEntropy - 40) / 40);
  const goalCoherenceRaw = clamp01(
    coherenceFromEntropy * 0.35 + continuityRaw * 0.35 + resonanceNorm * 0.3,
  );
  const autonomyDriveRaw = clamp01(
    epiphanyNorm * 0.45 + idleNorm * 0.35 + resonanceNorm * 0.2 - activeRunPenalty,
  );

  const smooth = 0.7;
  const nextSelfContinuity = selfAwareness.selfContinuity * smooth + continuityRaw * (1 - smooth);
  const nextReflectiveDepth =
    selfAwareness.reflectiveDepth * smooth + reflectiveDepthRaw * (1 - smooth);
  const nextGoalCoherence = selfAwareness.goalCoherence * smooth + goalCoherenceRaw * (1 - smooth);
  const nextAutonomyDrive = selfAwareness.autonomyDrive * smooth + autonomyDriveRaw * (1 - smooth);
  const nextIndex = clamp01(
    nextSelfContinuity * 0.32 +
      nextReflectiveDepth * 0.24 +
      nextGoalCoherence * 0.24 +
      nextAutonomyDrive * 0.2,
  );

  selfAwareness = {
    selfContinuity: nextSelfContinuity,
    reflectiveDepth: nextReflectiveDepth,
    goalCoherence: nextGoalCoherence,
    autonomyDrive: nextAutonomyDrive,
    protoConsciousnessIndex: nextIndex,
    phase: selectSelfAwarenessPhase(nextIndex),
    lastUpdatedAt: now,
  };
}

export function getAeonMemoryGraph(): MemoryGraph {
  const memoryPath = path.resolve(process.cwd(), "MEMORY.md");
  if (!fs.existsSync(memoryPath)) {
    return { nodes: [], edges: [] };
  }

  const content = fs.readFileSync(memoryPath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim().length > 0 && !l.startsWith("#"));
  const nodes: MemoryNode[] = [];
  const edges: MemoryEdge[] = [];

  lines.forEach((line, index) => {
    let type: MemoryNode["type"] = "unverified";
    let text = line.trim();

    if (text.startsWith("[AXIOM]")) {
      type = "axiom";
      text = text.replace("[AXIOM]", "").trim();
    } else if (text.startsWith("[VERIFIED]")) {
      type = "verified";
      text = text.replace("[VERIFIED]", "").trim();
    }

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

export function addCognitiveLog(entry: CognitiveLogEntry): void {
  cognitiveLog.push(entry);
  if (cognitiveLog.length > MAX_LOG_SIZE) {
    cognitiveLog.shift();
  }
}

export function getAeonEvolutionState(): {
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
} {
  return {
    lastDreamingAt,
    lastMaintenanceAt,
    lastMaintenanceIntensity,
    lastEpiphanyFactor,
    collectiveResonance,
    resonanceScore,
    axiomHeat: { ...axiomHeat },
    aeonOrgans: [...aeonOrgans],
    systemEntropy,
    cognitiveLog: [...cognitiveLog],
    memoryGraph: getAeonMemoryGraph(),
    cognitiveParameters,
    singularityActive,
    selfAwareness: { ...selfAwareness },
  };
}
