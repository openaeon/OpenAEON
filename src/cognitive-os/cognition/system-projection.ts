import type {
  CognitiveArchitectureProjection,
  CognitiveInvariantReport,
  CognitiveStateProjection,
  CognitiveTaskPhase,
  TaskTree,
} from "../contracts/types.js";

function phaseAtLeast(phase: CognitiveTaskPhase, target: CognitiveTaskPhase): boolean {
  const order: CognitiveTaskPhase[] = ["INIT", "PLAN", "EXECUTE", "VERIFY", "REFLECT", "DONE"];
  const currentIndex = order.indexOf(phase);
  const targetIndex = order.indexOf(target);
  return currentIndex >= 0 && targetIndex >= 0 && currentIndex >= targetIndex;
}

function loopStatus(
  phase: CognitiveTaskPhase,
  activePhase: CognitiveTaskPhase,
  donePhase: CognitiveTaskPhase,
): "pending" | "active" | "done" | "blocked" {
  if (phase === "FAILED" || phase === "ROLLED_BACK") return "blocked";
  if (phase === activePhase) return "active";
  return phaseAtLeast(phase, donePhase) ? "done" : "pending";
}

export function projectCognitiveArchitecture(params: {
  phase: CognitiveTaskPhase;
  tree: TaskTree;
  stateProjection?: CognitiveStateProjection;
  invariantReport?: CognitiveInvariantReport;
  runCount: number;
  reflectionCount: number;
  memoryStrategyHits: number;
  providerCount: number;
}): CognitiveArchitectureProjection {
  const nodes = Object.values(params.tree.nodes);
  const executableNodes = nodes.filter((node) => node.id !== params.tree.rootId);
  const doneCount = executableNodes.filter((node) => node.status === "done").length;
  const failedCount = executableNodes.filter((node) => node.status === "failed").length;
  const activeCount = executableNodes.filter((node) => node.status === "in_progress").length;
  const total = Math.max(1, executableNodes.length);
  const progress = doneCount / total;
  const invariantBlocked = params.invariantReport?.blocked === true;
  const invariantPassed = params.invariantReport?.status === "pass";

  const levelScore = (level: number): number => {
    if (level === 1) return 1;
    if (level === 2) return params.phase !== "INIT" ? 1 : 0.3;
    if (level === 3) return executableNodes.length > 0 ? 1 : 0.2;
    if (level === 4) return phaseAtLeast(params.phase, "PLAN") ? 1 : 0;
    if (level === 5) return params.providerCount > 0 || activeCount > 0 || doneCount > 0 ? 1 : 0;
    if (level === 6) return params.providerCount > 1 ? 1 : 0.4;
    if (level === 7) return params.reflectionCount > 0 ? 1 : 0;
    if (level === 8) return params.memoryStrategyHits > 0 ? 1 : progress;
    return params.phase === "DONE" && invariantPassed ? 1 : 0;
  };

  return {
    version: "3.0",
    formula: "Z -> Z^2 + C + R -> Z+1",
    layers: [
      {
        id: "perception",
        index: 1,
        label: "Input & Perception",
        status: params.phase === "INIT" ? "active" : "verified",
        signals: [`input_nodes:${total}`],
      },
      {
        id: "understanding",
        index: 2,
        label: "Understanding & Modeling",
        status: phaseAtLeast(params.phase, "PLAN") ? "verified" : "idle",
        signals: [`root:${params.tree.rootId}`],
      },
      {
        id: "reasoning",
        index: 3,
        label: "Reasoning & Decision",
        status: phaseAtLeast(params.phase, "PLAN") ? "active" : "idle",
        signals: [`dependencies:${executableNodes.flatMap((node) => node.dependsOn).length}`],
      },
      {
        id: "planning",
        index: 4,
        label: "Planning & Execution",
        status:
          params.phase === "EXECUTE"
            ? "active"
            : phaseAtLeast(params.phase, "VERIFY")
              ? "verified"
              : "idle",
        signals: [`active:${activeCount}`, `done:${doneCount}`],
      },
      {
        id: "verification",
        index: 5,
        label: "Verification & Reflection",
        status:
          params.phase === "VERIFY" || params.phase === "REFLECT"
            ? "active"
            : params.phase === "DONE"
              ? "verified"
              : "idle",
        signals: [`reflections:${params.reflectionCount}`],
      },
      {
        id: "memory",
        index: 6,
        label: "Memory & Learning",
        status: params.memoryStrategyHits > 0 ? "active" : "idle",
        signals: [`strategy_hits:${params.memoryStrategyHits}`],
      },
      {
        id: "governance",
        index: 7,
        label: "Safety & Governance",
        status: invariantBlocked ? "blocked" : invariantPassed ? "verified" : "active",
        signals: [`invariants:${params.invariantReport?.status ?? "pending"}`],
      },
      {
        id: "collaboration",
        index: 8,
        label: "Multi-Agent Collaboration",
        status: params.providerCount > 1 ? "active" : "idle",
        signals: [`providers:${params.providerCount}`],
      },
    ],
    capabilityLadder: [
      "Perception",
      "Understanding",
      "Reasoning",
      "Planning",
      "Autonomy",
      "Collaboration",
      "Reflection",
      "Creation",
      "Transcendence",
    ].map((label, index) => {
      const level = (index + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
      const score = levelScore(level);
      return { level, label, active: score >= 0.75, score };
    }),
    spaces: [
      {
        id: "G",
        label: "Global Memory Space",
        permeability: "medium",
        stability: "high",
        active: params.memoryStrategyHits > 0,
        signals: [`evolution:${params.memoryStrategyHits}`],
      },
      {
        id: "W",
        label: "Working Space",
        permeability: "high",
        stability: "medium",
        active: params.phase !== "DONE",
        signals: [`confidence:${params.stateProjection?.z.confidence.toFixed(2) ?? "0.00"}`],
      },
      {
        id: "T",
        label: "Tool Execution Space",
        permeability: "high",
        stability: failedCount > 0 ? "low" : "medium",
        active: activeCount > 0 || params.runCount > 0,
        signals: [`runs:${params.runCount}`],
      },
      {
        id: "B",
        label: "Boundary & Audit Space",
        permeability: "low",
        stability: invariantBlocked ? "low" : "high",
        active: true,
        signals: [`blocked:${String(invariantBlocked)}`],
      },
      {
        id: "E",
        label: "External Environment Space",
        permeability: "medium",
        stability: "medium",
        active: params.providerCount > 0,
        signals: [`providers:${params.providerCount}`],
      },
    ],
    operatingLoop: [
      {
        index: 1,
        id: "input_reception",
        label: "Input Reception",
        status: loopStatus(params.phase, "INIT", "PLAN"),
      },
      {
        index: 2,
        id: "intent_understanding",
        label: "Intent Understanding",
        status: loopStatus(params.phase, "PLAN", "PLAN"),
      },
      {
        index: 3,
        id: "state_update",
        label: "State Update",
        status: params.stateProjection ? "done" : "pending",
      },
      {
        index: 4,
        id: "planning_decision",
        label: "Planning & Decision",
        status: loopStatus(params.phase, "PLAN", "EXECUTE"),
      },
      {
        index: 5,
        id: "execution_invocation",
        label: "Execution & Invocation",
        status: loopStatus(params.phase, "EXECUTE", "VERIFY"),
      },
      {
        index: 6,
        id: "verification_reflection",
        label: "Verification & Reflection",
        status: loopStatus(params.phase, "VERIFY", "REFLECT"),
      },
      {
        index: 7,
        id: "memory_update",
        label: "Memory Update",
        status:
          params.memoryStrategyHits > 0
            ? "done"
            : params.phase === "REFLECT"
              ? "active"
              : "pending",
      },
      {
        index: 8,
        id: "induction_check",
        label: "Induction Check",
        status: invariantBlocked ? "blocked" : invariantPassed ? "done" : "active",
      },
    ],
    subsystems: [
      {
        id: "state_modeler",
        label: "Consciousness State Modeler",
        status: params.stateProjection ? "active" : "idle",
        metrics: { confidence: params.stateProjection?.z.confidence.toFixed(2) ?? "0.00" },
      },
      {
        id: "intent_reasoning",
        label: "Intention & Reasoning Engine",
        status: total > 0 ? "active" : "idle",
        metrics: { nodes: total },
      },
      {
        id: "planning_decision",
        label: "Planning & Decision Engine",
        status: params.phase === "PLAN" ? "active" : "verified",
        metrics: { priority_max: Math.max(...executableNodes.map((node) => node.priority), 0) },
      },
      {
        id: "tool_execution",
        label: "Tool & Execution Engine",
        status: activeCount > 0 ? "active" : doneCount > 0 ? "verified" : "idle",
        metrics: { runs: params.runCount },
      },
      {
        id: "verification_reflection",
        label: "Verification & Reflection Engine",
        status: params.reflectionCount > 0 ? "active" : "idle",
        metrics: { reflections: params.reflectionCount },
      },
      {
        id: "memory_learning",
        label: "Memory & Learning Engine",
        status: params.memoryStrategyHits > 0 ? "active" : "idle",
        metrics: { strategy_hits: params.memoryStrategyHits },
      },
      {
        id: "safety_governance",
        label: "Safety & Alignment Engine",
        status: invariantBlocked ? "blocked" : "verified",
        metrics: { invariant_status: params.invariantReport?.status ?? "pending" },
      },
    ],
    roadmap: [
      { phase: 1, label: "Basic Capability Build", active: phaseAtLeast(params.phase, "PLAN") },
      { phase: 2, label: "Autonomous Agent Body", active: phaseAtLeast(params.phase, "EXECUTE") },
      { phase: 3, label: "Reflection & Evolution", active: phaseAtLeast(params.phase, "REFLECT") },
      {
        phase: 4,
        label: "General Intelligence",
        active: params.phase === "DONE" && invariantPassed,
      },
    ],
  };
}
