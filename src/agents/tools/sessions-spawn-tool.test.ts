import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  const spawnSubagentDirectMock = vi.fn();
  const spawnAcpDirectMock = vi.fn();
  const updateTaskPlannerTodoMock = vi.fn();
  return {
    spawnSubagentDirectMock,
    spawnAcpDirectMock,
    updateTaskPlannerTodoMock,
  };
});

vi.mock("../subagent-spawn.js", () => ({
  SUBAGENT_SPAWN_MODES: ["run", "session"],
  spawnSubagentDirect: (...args: unknown[]) => hoisted.spawnSubagentDirectMock(...args),
}));

vi.mock("../acp-spawn.js", () => ({
  ACP_SPAWN_MODES: ["run", "session"],
  spawnAcpDirect: (...args: unknown[]) => hoisted.spawnAcpDirectMock(...args),
}));

vi.mock("./task-planner-tool.js", () => ({
  updateTaskPlannerTodo: (...args: unknown[]) => hoisted.updateTaskPlannerTodoMock(...args),
}));

const { createSessionsSpawnTool } = await import("./sessions-spawn-tool.js");

describe("sessions_spawn tool", () => {
  beforeEach(() => {
    hoisted.spawnSubagentDirectMock.mockReset().mockResolvedValue({
      status: "accepted",
      childSessionKey: "agent:main:subagent:1",
      runId: "run-subagent",
    });
    hoisted.spawnAcpDirectMock.mockReset().mockResolvedValue({
      status: "accepted",
      childSessionKey: "agent:codex:acp:1",
      runId: "run-acp",
    });
    hoisted.updateTaskPlannerTodoMock.mockReset().mockResolvedValue({
      ok: true,
      updated: { id: "todo123", status: "in_progress" },
    });
  });

  it("uses subagent runtime by default", async () => {
    const tool = createSessionsSpawnTool({
      agentSessionKey: "agent:main:main",
      agentChannel: "discord",
      agentAccountId: "default",
      agentTo: "channel:123",
      agentThreadId: "456",
    });

    const result = await tool.execute("call-1", {
      task: "build feature",
      agentId: "main",
      model: "anthropic/claude-sonnet-4-6",
      thinking: "medium",
      runTimeoutSeconds: 5,
      thread: true,
      mode: "session",
      cleanup: "keep",
      sandbox: "require",
      planId: "agent_main_main",
      todoId: "todo123",
      acceptance: ["tests pass", "evidence attached"],
    });

    expect(result.details).toMatchObject({
      status: "accepted",
      childSessionKey: "agent:main:subagent:1",
      runId: "run-subagent",
    });
    expect(hoisted.spawnSubagentDirectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        task: "build feature",
        agentId: "main",
        model: "anthropic/claude-sonnet-4-6",
        thinking: "medium",
        runTimeoutSeconds: 5,
        thread: true,
        mode: "session",
        cleanup: "keep",
        sandbox: "require",
        planId: "agent_main_main",
        todoId: "todo123",
        acceptance: ["tests pass", "evidence attached"],
        sharedContext: expect.objectContaining({
          taskClosure: {
            planId: "agent_main_main",
            todoId: "todo123",
            acceptance: ["tests pass", "evidence attached"],
          },
        }),
      }),
      expect.objectContaining({
        agentSessionKey: "agent:main:main",
      }),
    );
    expect(hoisted.spawnAcpDirectMock).not.toHaveBeenCalled();
    expect(hoisted.updateTaskPlannerTodoMock).not.toHaveBeenCalled();
  });

  it('defaults sandbox to "inherit" for subagent runtime', async () => {
    const tool = createSessionsSpawnTool({
      agentSessionKey: "agent:main:main",
      agentChannel: "discord",
    });

    await tool.execute("call-sandbox-default", {
      task: "summarize logs",
      agentId: "main",
    });

    expect(hoisted.spawnSubagentDirectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sandbox: "inherit",
      }),
      expect.any(Object),
    );
  });

  it("routes to ACP runtime when runtime=acp", async () => {
    const tool = createSessionsSpawnTool({
      agentSessionKey: "agent:main:main",
      agentChannel: "discord",
      agentAccountId: "default",
      agentTo: "channel:123",
      agentThreadId: "456",
    });

    const result = await tool.execute("call-2", {
      runtime: "acp",
      task: "investigate the failing CI run",
      agentId: "codex",
      cwd: "/workspace",
      thread: true,
      mode: "session",
    });

    expect(result.details).toMatchObject({
      status: "accepted",
      childSessionKey: "agent:codex:acp:1",
      runId: "run-acp",
    });
    expect(hoisted.spawnAcpDirectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        task: "investigate the failing CI run",
        agentId: "codex",
        cwd: "/workspace",
        thread: true,
        mode: "session",
      }),
      expect.objectContaining({
        agentSessionKey: "agent:main:main",
      }),
    );
    expect(hoisted.spawnSubagentDirectMock).not.toHaveBeenCalled();
  });

  it("updates planner todo to in_progress when plan context is provided", async () => {
    const tool = createSessionsSpawnTool({
      agentSessionKey: "agent:main:main",
      agentChannel: "discord",
      workspaceDir: "/tmp/workspace",
    });

    await tool.execute("call-plan-link", {
      task: "build feature",
      planId: "agent_main_main",
      todoId: "todo-1",
      acceptance: ["ship output"],
    });

    expect(hoisted.updateTaskPlannerTodoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceDir: "/tmp/workspace",
        targetSessionKey: "agent_main_main",
        taskId: "todo-1",
        status: "in_progress",
      }),
    );
  });
});
