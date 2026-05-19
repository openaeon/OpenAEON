import type {
  AgentDispatchCandidate,
  AgentDispatchRequest,
  AgentDispatchResult,
  ModelProvider,
} from "../contracts/types.js";
import crypto from "node:crypto";
import { runAgentStep } from "../../agents/tools/agent-step.js";
import { callGateway } from "../../gateway/call.js";
import {
  defaultModelForProvider,
  resolveCognitiveProviderRuntime,
} from "./provider-runtime-resolver.js";

function scoreCandidate(params: {
  output: string;
  provider: ModelProvider;
  latencyMs: number;
  prompt: string;
  role: AgentDispatchRequest["role"];
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
  if (text.includes("acceptance") || text.includes("criteria")) {
    score += 0.08;
  }
  if (text.includes("tool") || text.includes("artifact") || text.includes("evidence")) {
    score += 0.06;
  }
  if (params.role === "QAAgent" && (text.includes("verify") || text.includes("assert"))) {
    score += 0.05;
  }
  if (params.role === "OpsAgent" && (text.includes("deploy") || text.includes("rollback"))) {
    score += 0.05;
  }
  if (params.role === "SalesAgent" && (text.includes("outreach") || text.includes("pipeline"))) {
    score += 0.05;
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

  let output = "";
  let failed = false;
  let error: string | undefined;

  try {
    const sessionKey = `cognitive-router:${provider}:${req.taskId}:${req.nodeId}:${crypto.randomUUID()}`;
    const runtime = resolveCognitiveProviderRuntime({ provider, fallbackProviders: req.providers });
    await callGateway({
      method: "sessions.patch",
      params: { key: sessionKey, model: runtime.model },
      timeoutMs: 8_000,
    });
    output =
      (await runAgentStep({
        sessionKey,
        message: augmentedPrompt,
        extraSystemPrompt: `You are executing as ${req.role}. Respond with concrete work output and verification notes.`,
        timeoutMs: req.timeoutMs,
        sourceTool: "cognitive.runtime.dispatch",
      })) ?? "";
    if (!output) {
      throw new Error("empty_agent_output");
    }
  } catch (err) {
    failed = true;
    error = String(err);
    output = "";
  }

  const latencyMs = Date.now() - startedAt;
  const scored = scoreCandidate({
    output,
    provider,
    latencyMs,
    prompt: augmentedPrompt,
    role: req.role,
  });
  const score = failed ? 0 : scored.score;
  return {
    provider,
    model: resolveCognitiveProviderRuntime({ provider }).model,
    output,
    score,
    reason: failed ? "provider_execution_failed" : scored.reason,
    latencyMs,
    evidence: output ? [`provider:${provider}`, `role:${req.role}`] : [],
    toolEvents: [],
    acceptanceMatched:
      output.length > 0 &&
      req.prompt
        .toLowerCase()
        .split(/acceptance:\s*/)[1]
        ?.split(";")
        .some(
          (criterion) =>
            criterion.trim().length > 0 &&
            output.toLowerCase().includes(criterion.trim().toLowerCase()),
        ),
    recoverySignal: failed ? "provider_execution_failed" : undefined,
    failed,
    error,
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
          model: defaultModelForProvider(provider),
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
    model: defaultModelForProvider("gpt"),
    output: "no candidate available",
    score: 0,
    reason: "empty_candidates",
    latencyMs: 0,
    failed: true,
  };

  const degraded = candidates.some((candidate) => candidate.failed === true);
  return { winner, candidates, degraded };
}
