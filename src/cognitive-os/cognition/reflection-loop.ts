import crypto from "node:crypto";
import type { ReflectionRecord } from "../contracts/types.js";

export function buildReflectionRecord(params: {
  taskId: string;
  nodeId?: string;
  output: string;
  success: boolean;
}): ReflectionRecord {
  const findings = params.success
    ? ["Execution completed with acceptable signal"]
    : ["Execution failed or degraded; retry/rollback needed"];
  const optimizations = params.success
    ? ["Promote this path as preferred strategy"]
    : ["Tighten acceptance criteria and add guardrails"];
  return {
    id: crypto.randomUUID(),
    taskId: params.taskId,
    nodeId: params.nodeId,
    at: Date.now(),
    verdict: params.success ? "pass" : "fail",
    findings,
    optimizations,
  };
}
