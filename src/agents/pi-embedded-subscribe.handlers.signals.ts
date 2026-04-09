import type { AgentCognitiveSignalInternalEvent } from "./internal-events.js";
import type { EmbeddedPiSubscribeContext } from "./pi-embedded-subscribe.handlers.types.js";

/**
 * Handle cognitive signals (Convergence/Divergence) received from sub-agents.
 */
export function handleCognitiveSignal(
  ctx: EmbeddedPiSubscribeContext,
  event: AgentCognitiveSignalInternalEvent,
) {
  const { signal, reason, depth } = event;
  const { state, log } = ctx;

  if (signal === "divergence") {
    // Sub-agent divergence should influence parent stability, but must stay bounded.
    // Keep a mild depth factor and cap total chaos to avoid runaway amplification.
    const normalizedDepth = Number.isFinite(depth) ? Math.max(1, Math.min(4, depth)) : 1;
    const increment = 0.5 + (normalizedDepth - 1) * 0.25; // [0.5, 1.25]
    const prev = state.chaosScore;
    state.chaosScore = Math.min(24, state.chaosScore + increment);

    log.debug(
      `[Cognitive Fusion] Divergence reported by sub-agent (depth ${depth}). Chaos score: ${prev} -> ${state.chaosScore}. Reason: ${reason ?? "unknown"}`,
    );
  } else if (signal === "convergence") {
    // Convergence reported by a sub-agent slowly cools down the chaos score.
    if (state.chaosScore > 0) {
      const prev = state.chaosScore;
      state.chaosScore = Math.max(0, state.chaosScore - 1.25);
      log.debug(
        `[Cognitive Fusion] Convergence reported by sub-agent. Chaos score: ${prev} -> ${state.chaosScore}.`,
      );
    }
  }
}
