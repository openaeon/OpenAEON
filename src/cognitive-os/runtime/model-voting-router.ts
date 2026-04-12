import type {
  AgentDispatchCandidate,
  AgentDispatchRequest,
  AgentDispatchResult,
  ModelProvider,
} from "../contracts/types.js";

function modelForProvider(provider: ModelProvider): string {
  if (provider === "gpt") return "gpt-5.4";
  if (provider === "claude") return "claude-opus-4.1";
  return "gemini-2.5-pro";
}

function scoreCandidate(params: {
  output: string;
  provider: ModelProvider;
  latencyMs: number;
  prompt: string;
}): { score: number; reason: string } {
  const text = params.output.toLowerCase();
  let score = 0.5;
  if (text.includes("done") || text.includes("completed") || text.includes("verified")) {
    score += 0.2;
  }
  if (text.length > 80) {
    score += 0.1;
  }
  if (params.prompt.toLowerCase().includes("test") && text.includes("test")) {
    score += 0.1;
  }
  if (params.provider === "gpt") {
    score += 0.06;
  }
  if (params.provider === "claude") {
    score += 0.05;
  }
  score -= Math.min(0.25, params.latencyMs / 15_000);
  return { score: Math.max(0, Math.min(1, score)), reason: "heuristic_verifier_score" };
}

async function runProviderCandidate(
  provider: ModelProvider,
  req: AgentDispatchRequest,
): Promise<AgentDispatchCandidate> {
  const startedAt = Date.now();

  // FCA Layer 2: Context Injection
  const augmentedPrompt = [
    "### COGNITIVE CONTEXT (Axioms & Recent Memories)",
    ...(req.context || ["No context available."]),
    "",
    "### TASK",
    req.prompt,
  ].join("\n");

  // In a real system, this would call the LLM with augmentedPrompt
  const output = `[${provider}] task=${req.nodeId} role=${req.role} completed with acceptance-oriented result based on ${req.context?.length || 0} context pieces.`;
  const latencyMs = Date.now() - startedAt;
  const scored = scoreCandidate({ output, provider, latencyMs, prompt: augmentedPrompt });
  return {
    provider,
    model: modelForProvider(provider),
    output,
    score: scored.score,
    reason: scored.reason,
    latencyMs,
  };
}

export async function dispatchWithParallelVoting(
  req: AgentDispatchRequest,
): Promise<AgentDispatchResult> {
  const candidates = await Promise.all(
    req.providers.map(async (provider) => {
      try {
        return await runProviderCandidate(provider, req);
      } catch (err) {
        return {
          provider,
          model: modelForProvider(provider),
          output: "",
          score: 0,
          reason: "provider_error",
          latencyMs: req.timeoutMs,
          failed: true,
          error: String(err),
        } as AgentDispatchCandidate;
      }
    }),
  );

  const sorted = [...candidates].toSorted((a, b) => b.score - a.score);
  const winner = sorted[0] ?? {
    provider: "gpt",
    model: modelForProvider("gpt"),
    output: "no candidate available",
    score: 0,
    reason: "empty_candidates",
    latencyMs: 0,
    failed: true,
  };

  const degraded = candidates.some((candidate) => candidate.failed === true);
  return { winner, candidates, degraded };
}
