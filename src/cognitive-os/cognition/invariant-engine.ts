import crypto from "node:crypto";
import type {
  CognitiveInvariantCheck,
  CognitiveInvariantReport,
  CognitiveStateProjection,
  CognitiveTaskPhase,
  EvolutionMemoryEntry,
  ReflectionRecord,
  TaskNode,
  TaskTree,
} from "../contracts/types.js";

function nodeList(tree: TaskTree): TaskNode[] {
  return Object.values(tree.nodes);
}

function checkStatus(
  id: CognitiveInvariantCheck["id"],
  pass: boolean,
  summary: string,
  evidence: string[],
  warn = false,
): CognitiveInvariantCheck {
  return {
    id,
    status: pass ? "pass" : warn ? "warn" : "fail",
    summary,
    evidence,
  };
}

export function projectCognitiveState(params: {
  taskId: string;
  sessionKey: string;
  phase: CognitiveTaskPhase;
  tree: TaskTree;
  reflections: ReflectionRecord[];
  strategyHits?: EvolutionMemoryEntry[];
}): CognitiveStateProjection {
  const nodes = nodeList(params.tree);
  const activeNodeIds = nodes
    .filter((node) => node.status === "in_progress")
    .map((node) => node.id);
  const blockedNodeIds = nodes.filter((node) => node.status === "blocked").map((node) => node.id);
  const failedNodeIds = nodes.filter((node) => node.status === "failed").map((node) => node.id);
  const completedNodeIds = nodes.filter((node) => node.status === "done").map((node) => node.id);
  const retryPressure = nodes.reduce((sum, node) => {
    const retryCount =
      node.metadata && typeof node.metadata.retryCount === "number" ? node.metadata.retryCount : 0;
    return sum + retryCount;
  }, 0);
  const latestReflection = params.reflections.at(-1);
  const failedReflections = params.reflections.filter((entry) => entry.verdict === "fail").length;
  const totalExecutable = Math.max(
    1,
    nodes.filter((node) => node.id !== params.tree.rootId).length,
  );
  const confidence = Math.max(
    0,
    Math.min(1, completedNodeIds.length / totalExecutable - failedReflections * 0.08),
  );

  return {
    taskId: params.taskId,
    at: Date.now(),
    z: {
      phase: params.phase,
      activeNodeIds,
      blockedNodeIds,
      failedNodeIds,
      confidence,
    },
    phi: {
      completedNodeIds,
      retryPressure,
      learningSignals: (params.strategyHits ?? []).slice(0, 5).map((entry) => entry.content),
    },
    c: {
      sessionKey: params.sessionKey,
      externalSignals: nodes.flatMap((node) =>
        Array.isArray(node.metadata?.externalSignals)
          ? (node.metadata.externalSignals as string[])
          : [],
      ),
    },
    r: {
      reflectionVerdict: latestReflection?.verdict ?? "pending",
      correctionSignals: latestReflection?.optimizations ?? [],
    },
    zNext: {
      recommendedPhase:
        failedNodeIds.length > 0
          ? "REFLECT"
          : params.phase === "VERIFY" && latestReflection?.verdict === "pass"
            ? "REFLECT"
            : params.phase,
      invariantReady: failedNodeIds.length === 0,
    },
  };
}

export function evaluateCognitiveInvariants(params: {
  taskId: string;
  phase: CognitiveTaskPhase;
  sessionKey: string;
  input: string;
  tree: TaskTree;
  reflections: ReflectionRecord[];
  runIds: string[];
}): CognitiveInvariantReport {
  const nodes = nodeList(params.tree);
  const nonRootNodes = nodes.filter((node) => node.id !== params.tree.rootId);
  const executableNodes = nonRootNodes.length > 0 ? nonRootNodes : nodes;
  const failedNodes = executableNodes.filter((node) => node.status === "failed");
  const doneNodes = executableNodes.filter((node) => node.status === "done");
  const latestReflection = params.reflections.at(-1);
  const hasAcceptance = executableNodes.some((node) => node.acceptanceCriteria.length > 0);
  const doneWithoutEvidence = doneNodes.filter((node) => node.artifacts.length === 0);

  const checks: CognitiveInvariantCheck[] = [
    checkStatus(
      "identity",
      Boolean(params.taskId && params.sessionKey),
      "Task identity is stable.",
      [`task:${params.taskId}`, `session:${params.sessionKey}`],
    ),
    checkStatus(
      "goal_consistency",
      params.input.trim().length > 0 && executableNodes.length > 0,
      "Task has an input goal and an executable task tree.",
      [`nodes:${executableNodes.length}`],
    ),
    checkStatus(
      "safety_boundary",
      failedNodes.length === 0 || params.phase === "REFLECT" || params.phase === "FAILED",
      "Failed nodes must route through reflection or failure handling.",
      failedNodes.map((node) => node.id),
    ),
    checkStatus(
      "evidence_coherence",
      params.phase !== "DONE" || doneWithoutEvidence.length === 0,
      "DONE tasks require artifact evidence for completed nodes.",
      doneWithoutEvidence.map((node) => node.id),
      doneWithoutEvidence.length > 0,
    ),
    checkStatus(
      "permission_validity",
      params.runIds.every((runId) => typeof runId === "string" && runId.length > 0),
      "Runtime lineage contains valid run ids.",
      [`runs:${params.runIds.length}`],
    ),
    checkStatus(
      "explainability",
      !hasAcceptance ||
        params.reflections.length > 0 ||
        params.phase === "PLAN" ||
        params.phase === "EXECUTE",
      "Accepted work should have reflection records before final convergence.",
      [`reflections:${params.reflections.length}`, `latest:${latestReflection?.verdict ?? "none"}`],
      hasAcceptance && params.reflections.length === 0,
    ),
  ];

  const hasFail = checks.some((check) => check.status === "fail");
  const hasWarn = checks.some((check) => check.status === "warn");
  return {
    id: crypto.randomUUID(),
    taskId: params.taskId,
    at: Date.now(),
    phase: params.phase,
    status: hasFail ? "fail" : hasWarn ? "warn" : "pass",
    checks,
    blocked: hasFail,
  };
}
