import type { DreamRecord, ReflectionRecord } from "../contracts/types.js";

export type StrategyPatch = {
  scoreDelta: number;
  actions: string[];
};

export function optimizeStrategy(params: {
  reflections: ReflectionRecord[];
  dream?: DreamRecord;
}): StrategyPatch {
  const failures = params.reflections.filter((entry) => entry.verdict === "fail").length;
  const passes = params.reflections.filter((entry) => entry.verdict === "pass").length;
  const base = passes * 0.12 - failures * 0.18;
  const dreamBoost = params.dream ? 0.08 : 0;
  return {
    scoreDelta: Math.max(-1, Math.min(1, base + dreamBoost)),
    actions: [
      failures > 0 ? "Increase retry guardrails for failing nodes" : "Keep current retry budget",
      passes > failures
        ? "Prioritize previously successful decomposition templates"
        : "Rebalance owner-role assignment",
    ],
  };
}
