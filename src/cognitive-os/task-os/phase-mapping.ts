import type { CognitiveTaskPhase, LegacyTaskPlanPhase } from "../contracts/types.js";

const COGNITIVE_TO_LEGACY: Record<CognitiveTaskPhase, LegacyTaskPlanPhase> = {
  INIT: "planning",
  PLAN: "planning",
  EXECUTE: "execution",
  VERIFY: "verification",
  REFLECT: "verification",
  DONE: "complete",
  FAILED: "execution",
  ROLLED_BACK: "planning",
};

const LEGACY_TO_COGNITIVE: Record<LegacyTaskPlanPhase, CognitiveTaskPhase> = {
  planning: "PLAN",
  execution: "EXECUTE",
  verification: "VERIFY",
  complete: "DONE",
};

export function mapCognitiveToLegacy(phase: CognitiveTaskPhase): LegacyTaskPlanPhase {
  return COGNITIVE_TO_LEGACY[phase];
}

export function mapLegacyToCognitive(phase: LegacyTaskPlanPhase): CognitiveTaskPhase {
  return LEGACY_TO_COGNITIVE[phase];
}
