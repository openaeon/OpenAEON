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
const cognitiveLog: CognitiveLogEntry[] = [];
let singularityActive: boolean = false;
const MAX_LOG_SIZE = 50;

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
  };
}
