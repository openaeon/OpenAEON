import { describe, expect, it, vi } from "vitest";
import { spawnSubagentDirect } from "../../agents/subagent-spawn.js";
import { dispatchCognitiveNodeToSubagent } from "./subagent-runtime-adapter.js";

vi.mock("../../agents/subagent-spawn.js", () => ({
  spawnSubagentDirect: vi.fn(),
}));

describe("dispatchCognitiveNodeToSubagent", () => {
  it("authorizes recursive delegation without giving descendants the writeback link", async () => {
    vi.mocked(spawnSubagentDirect).mockResolvedValue({
      status: "accepted",
      runId: "run-child",
      childSessionKey: "agent:main:subagent:child",
    });

    const result = await dispatchCognitiveNodeToSubagent({
      taskId: "task-1",
      nodeId: "node-1",
      runId: "run-parent",
      sessionKey: "agent:main:main",
      role: "DevAgent",
      title: "Implement feature",
      prompt: "Implement feature\nAcceptance: tests pass",
      acceptanceCriteria: ["tests pass"],
      timeoutMs: 60_000,
    });

    expect(result.accepted).toBe(true);
    const [params, ctx] = vi.mocked(spawnSubagentDirect).mock.calls[0];
    expect(params.task).toContain("You are also a local orchestrator");
    expect(params.task).toContain("you may spawn your own sub-agents with `sessions_spawn`");
    expect(params.task).toContain("pass `sharedContext.parentCognitiveTask`");
    expect(params.sharedContext?.cognitiveTask).toEqual(
      expect.objectContaining({
        taskId: "task-1",
        nodeId: "node-1",
        runId: "run-parent",
        autonomyMode: "recursive_delegation",
      }),
    );
    expect(params.sharedContext?.cognitiveDelegation).toEqual(
      expect.objectContaining({
        canDelegate: true,
        descendantsUseContextKey: "parentCognitiveTask",
        finalWritebackOwner: "run-parent",
      }),
    );
    expect(ctx).toEqual({ agentSessionKey: "agent:main:main" });
  });

  it("falls back to inline dispatch when subagent spawn is denied by depth policy", async () => {
    vi.mocked(spawnSubagentDirect).mockResolvedValue({
      status: "forbidden",
      error: "sessions_spawn is not allowed at this depth",
    });

    const result = await dispatchCognitiveNodeToSubagent({
      taskId: "task-1",
      nodeId: "node-1",
      runId: "run-parent",
      sessionKey: "agent:main:subagent:leaf",
      role: "QAAgent",
      title: "Verify feature",
      prompt: "Verify feature",
      acceptanceCriteria: ["tests pass"],
      timeoutMs: 60_000,
    });

    expect(result).toEqual(
      expect.objectContaining({
        accepted: false,
        error: "sessions_spawn is not allowed at this depth",
      }),
    );
  });
});
