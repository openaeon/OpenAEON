import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  callGatewayMock: vi.fn(),
  runSubagentAnnounceFlowMock: vi.fn(),
  readLatestSubagentOutputMock: vi.fn(),
  updateTaskPlannerTodoMock: vi.fn(),
}));

vi.mock("../gateway/call.js", () => ({
  callGateway: (...args: unknown[]) => hoisted.callGatewayMock(...args),
}));

vi.mock("./subagent-announce.js", () => ({
  runSubagentAnnounceFlow: (...args: unknown[]) => hoisted.runSubagentAnnounceFlowMock(...args),
  readLatestSubagentOutput: (...args: unknown[]) => hoisted.readLatestSubagentOutputMock(...args),
}));

vi.mock("./tools/task-planner-tool.js", () => ({
  updateTaskPlannerTodo: (...args: unknown[]) => hoisted.updateTaskPlannerTodoMock(...args),
}));

const registry = await import("./subagent-registry.js");

describe("subagent registry todo backfill", () => {
  beforeEach(() => {
    registry.resetSubagentRegistryForTests({ persist: false });
    hoisted.callGatewayMock.mockReset().mockResolvedValue({
      status: "ok",
      startedAt: 1,
      endedAt: 2,
    });
    hoisted.runSubagentAnnounceFlowMock.mockReset().mockResolvedValue(true);
    hoisted.readLatestSubagentOutputMock.mockReset().mockResolvedValue("execution output");
    hoisted.updateTaskPlannerTodoMock.mockReset().mockResolvedValue({
      ok: true,
      updated: { id: "todo-1", status: "done" },
    });
  });

  afterEach(() => {
    registry.resetSubagentRegistryForTests({ persist: false });
    vi.clearAllMocks();
  });

  it("auto-backfills planner todo on successful completion", async () => {
    registry.registerSubagentRun({
      runId: "run-1",
      childSessionKey: "agent:main:subagent:1",
      requesterSessionKey: "agent:main:main",
      requesterDisplayKey: "main",
      task: "execute",
      cleanup: "keep",
      shouldWaitForCompletion: false,
      planId: "agent_main_main",
      todoId: "todo-1",
      acceptance: ["produce evidence"],
    });

    await registry.waitForSubagentCompletion("run-1", 1000);

    expect(hoisted.updateTaskPlannerTodoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        targetSessionKey: "agent_main_main",
        taskId: "todo-1",
        status: "done",
      }),
    );
  });

  it("marks todo blocked when writeback fails", async () => {
    hoisted.updateTaskPlannerTodoMock
      .mockResolvedValueOnce({ ok: false, error: "write failed" })
      .mockResolvedValueOnce({ ok: true, updated: { id: "todo-2", status: "blocked" } });

    registry.registerSubagentRun({
      runId: "run-2",
      childSessionKey: "agent:main:subagent:2",
      requesterSessionKey: "agent:main:main",
      requesterDisplayKey: "main",
      task: "execute",
      cleanup: "keep",
      shouldWaitForCompletion: false,
      planId: "agent_main_main",
      todoId: "todo-2",
      acceptance: ["produce evidence"],
    });

    await registry.waitForSubagentCompletion("run-2", 1000);

    const entry = registry.loadSubagentRun("run-2");
    expect(entry?.autoBackfillStatus).toBe("blocked");
    expect(hoisted.updateTaskPlannerTodoMock).toHaveBeenCalledTimes(2);
    expect(hoisted.updateTaskPlannerTodoMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        targetSessionKey: "agent_main_main",
        taskId: "todo-2",
        status: "blocked",
      }),
    );
  });
});
