import crypto from "node:crypto";
import type { DreamRecord, ReflectionRecord } from "../contracts/types.js";

export function distillDreamRecord(params: {
  taskId: string;
  reflections: ReflectionRecord[];
  sourceRunIds: string[];
}): DreamRecord {
  const strongSignals = params.reflections
    .filter((item) => item.verdict !== "fail")
    .flatMap((item) => item.optimizations)
    .slice(0, 5);
  const warningSignals = params.reflections
    .filter((item) => item.verdict === "fail")
    .flatMap((item) => item.findings)
    .slice(0, 5);

  return {
    id: crypto.randomUUID(),
    taskId: params.taskId,
    at: Date.now(),
    summary:
      strongSignals.length > 0
        ? `Promote ${strongSignals.length} successful strategies`
        : "No strong strategy yet, keep iterating",
    strategyUpdates: [...strongSignals, ...warningSignals],
    sourceRunIds: params.sourceRunIds,
  };
}
