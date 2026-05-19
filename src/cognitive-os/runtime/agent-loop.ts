import type { AgentDispatchRequest, AgentDispatchResult } from "../contracts/types.js";
import { CognitiveMemoryService } from "../memory/service.js";
import { publishCognitiveEvent } from "../observability/event-bus.js";
import { getCognitiveSqliteStore } from "../store/sqlite-store.js";
import { dispatchAgentTask } from "./dispatcher.js";

export type CognitiveAgentLoopInput = AgentDispatchRequest & {
  sessionKey?: string;
  source: "gateway_chat" | "subagent" | "cron" | "cognitive_dispatch";
};

export type CognitiveAgentLoopTurn = {
  index: number;
  provider: string;
  model: string;
  score: number;
  latencyMs: number;
  accepted: boolean;
  reasoning?: string;
  toolEventCount: number;
  evidence: string[];
  error?: string;
  recoverySignal?: string;
};

export type CognitiveAgentLoopResult = {
  loopRunId: string;
  source: CognitiveAgentLoopInput["source"];
  dispatch: AgentDispatchResult;
  memorySynced: boolean;
  turns: CognitiveAgentLoopTurn[];
  startedAt: number;
  finishedAt: number;
  finishedNaturally: boolean;
  toolErrors: Array<{ turn: number; provider: string; error: string }>;
};

function buildLoopRunId(input: CognitiveAgentLoopInput, startedAt: number): string {
  return `${input.taskId}:${input.nodeId}:loop:${startedAt}`;
}

function summarizeReasoning(output: string): string | undefined {
  const text = output.trim();
  if (!text) {
    return undefined;
  }
  return text.length > 240 ? `${text.slice(0, 237)}...` : text;
}

export class CognitiveAgentLoop {
  constructor(private readonly workspaceDir: string) {}

  async run(input: CognitiveAgentLoopInput): Promise<CognitiveAgentLoopResult> {
    const startedAt = Date.now();
    const loopRunId = buildLoopRunId(input, startedAt);
    const memory = new CognitiveMemoryService(this.workspaceDir);
    await memory.initialize({
      taskId: input.taskId,
      sessionKey: input.sessionKey,
      agentId: input.role,
    });

    const dispatch = await dispatchAgentTask(input);
    const turns: CognitiveAgentLoopTurn[] = dispatch.candidates.map((candidate, index) => ({
      index: index + 1,
      provider: candidate.provider,
      model: candidate.model,
      score: candidate.score,
      latencyMs: candidate.latencyMs,
      accepted: candidate.provider === dispatch.winner.provider,
      reasoning: summarizeReasoning(candidate.output),
      toolEventCount: candidate.toolEvents?.length ?? 0,
      evidence: candidate.evidence ?? [],
      error: candidate.error,
      recoverySignal: candidate.recoverySignal,
    }));
    if (turns.length === 0) {
      turns.push({
        index: 1,
        provider: dispatch.winner.provider,
        model: dispatch.winner.model,
        score: dispatch.winner.score,
        latencyMs: dispatch.winner.latencyMs,
        accepted: true,
        reasoning: summarizeReasoning(dispatch.winner.output),
        toolEventCount: dispatch.winner.toolEvents?.length ?? 0,
        evidence: dispatch.winner.evidence ?? [],
        error: dispatch.winner.error,
        recoverySignal: dispatch.winner.recoverySignal,
      });
    }
    const toolErrors = turns
      .filter((turn) => turn.error)
      .map((turn) => ({
        turn: turn.index,
        provider: turn.provider,
        error: turn.error ?? "unknown_error",
      }));

    let memorySynced = false;
    if (dispatch.winner.output.trim()) {
      await memory.syncTurn({
        taskId: input.taskId,
        runId: loopRunId,
        sessionKey: input.sessionKey,
        userContent: input.prompt,
        assistantContent: dispatch.winner.output,
      });
      memorySynced = true;
    }
    const finishedAt = Date.now();
    const result: CognitiveAgentLoopResult = {
      loopRunId,
      source: input.source,
      dispatch,
      memorySynced,
      turns,
      startedAt,
      finishedAt,
      finishedNaturally: !dispatch.winner.failed,
      toolErrors,
    };

    publishCognitiveEvent({
      stream: "agent_loop",
      taskId: input.taskId,
      runId: loopRunId,
      payload: {
        nodeId: input.nodeId,
        role: input.role,
        source: input.source,
        provider: dispatch.winner.provider,
        model: dispatch.winner.model,
        score: dispatch.winner.score,
        degraded: dispatch.degraded,
        memorySynced,
        turnCount: turns.length,
        toolErrorCount: toolErrors.length,
      },
    });
    getCognitiveSqliteStore(this.workspaceDir)?.indexAgentLoopRun({
      taskId: input.taskId,
      nodeId: input.nodeId,
      runId: loopRunId,
      source: input.source,
      role: input.role,
      startedAt,
      finishedAt,
      finishedNaturally: result.finishedNaturally,
      memorySynced,
      turns,
      toolErrors,
      winner: dispatch.winner,
      degraded: dispatch.degraded,
    });

    return result;
  }
}
