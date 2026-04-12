import { CognitiveOSError } from "../contracts/errors.js";
import type { CognitiveTaskPhase } from "../contracts/types.js";

const ALLOWED_TRANSITIONS: Record<CognitiveTaskPhase, CognitiveTaskPhase[]> = {
  INIT: ["PLAN", "FAILED"],
  PLAN: ["EXECUTE", "FAILED", "ROLLED_BACK"],
  EXECUTE: ["VERIFY", "PLAN", "FAILED", "ROLLED_BACK"],
  VERIFY: ["REFLECT", "PLAN", "EXECUTE", "FAILED", "ROLLED_BACK"],
  REFLECT: ["DONE", "PLAN", "EXECUTE", "FAILED"],
  DONE: [],
  FAILED: ["EXECUTE", "ROLLED_BACK"],
  ROLLED_BACK: ["PLAN", "EXECUTE"],
};

export function canTransition(from: CognitiveTaskPhase, to: CognitiveTaskPhase): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: CognitiveTaskPhase, to: CognitiveTaskPhase): void {
  if (!canTransition(from, to)) {
    throw new CognitiveOSError(
      `invalid cognitive phase transition: ${from} -> ${to}`,
      "COGNITIVE_TASK_INVALID_TRANSITION",
      { from, to },
    );
  }
}

export function applyTransition(
  current: CognitiveTaskPhase,
  next: CognitiveTaskPhase,
): CognitiveTaskPhase {
  assertTransition(current, next);
  return next;
}
