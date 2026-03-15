import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  const spawnSubagentDirectMock = vi.fn();
  return {
    spawnSubagentDirectMock,
  };
});

vi.mock("../subagent-spawn.js", () => ({
  SUBAGENT_SPAWN_MODES: ["run", "session"],
  spawnSubagentDirect: (...args: unknown[]) => hoisted.spawnSubagentDirectMock(...args),
}));

const { createSessionsEvaluateTool } = await import("./sessions-evaluate-tool.js");

describe("sessions_evaluate tool", () => {
  beforeEach(() => {
    hoisted.spawnSubagentDirectMock.mockReset();
  });

  it("should spawn a reflector agent successfully and return its evaluation", async () => {
    hoisted.spawnSubagentDirectMock.mockResolvedValueOnce({
      status: "accepted",
      childSessionKey: "agent:reflector:subagent:1",
      runId: "run-eval",
      completionText: "<reject>\nMissing test cases in the provided code.",
    });

    const tool = createSessionsEvaluateTool({
      agentSessionKey: "agent:main:main",
    });

    const result = await tool.execute("call-1", {
      originalTask: "Write a unit test for login.",
      workerResult: "function login() {}",
      agentId: "evaluator",
    });

    // Check we got the response back inline
    expect(result.details).toMatchObject({
      status: "evaluated",
      evaluation: "<reject>\nMissing test cases in the provided code.",
    });

    // Check payload passed to spawnSubagentDirect
    expect(hoisted.spawnSubagentDirectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        task: expect.stringContaining("You are a strict Actor-Critic Evaluator"),
        agentId: "evaluator",
        expectsCompletionMessage: true,
      }),
      expect.objectContaining({
        agentSessionKey: "agent:main:main",
      }),
    );
  });

  it("should handle error when evaluation spawn fails", async () => {
    hoisted.spawnSubagentDirectMock.mockResolvedValueOnce({
      status: "error",
      error: "Spawn failed due to capacity limit",
    });

    const tool = createSessionsEvaluateTool({
      agentSessionKey: "agent:main:main",
    });

    const result = await tool.execute("call-2", {
      originalTask: "Do something",
      workerResult: "Did something",
    });

    expect(result.details).toMatchObject({
      status: "eval_spawn_error",
      error: "Spawn failed due to capacity limit",
    });
  });
});
