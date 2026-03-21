import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayRequestContext } from "./types.js";

const mocks = vi.hoisted(() => ({
  loadConfig: vi.fn(),
  resolveStateDir: vi.fn(),
}));

vi.mock("../../config/config.js", () => ({
  loadConfig: mocks.loadConfig,
  resolveStateDir: mocks.resolveStateDir,
}));

import { taskPlanHandlers } from "./task-plan.js";

function makeContext(workspaceDir: string): GatewayRequestContext {
  return {
    workspaceDir,
    chatAbortControllers: new Map(),
    broadcast: vi.fn(),
  } as unknown as GatewayRequestContext;
}

describe("task_plan.approve", () => {
  let workspaceDir = "";

  beforeEach(async () => {
    workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "openaeon-task-plan-"));
    mocks.loadConfig.mockReturnValue({
      agents: {
        defaults: {
          workspace: workspaceDir,
        },
      },
    });
    mocks.resolveStateDir.mockReturnValue(path.join(workspaceDir, ".openaeon"));
  });

  afterEach(async () => {
    vi.clearAllMocks();
    if (workspaceDir) {
      await fs.rm(workspaceDir, { recursive: true, force: true });
    }
  });

  it("moves planning phase to execution and persists it", async () => {
    const sessionKey = "main";
    const plannerPath = path.join(workspaceDir, ".openaeon", "planner", `${sessionKey}.json`);
    await fs.mkdir(path.dirname(plannerPath), { recursive: true });
    await fs.writeFile(
      plannerPath,
      JSON.stringify(
        {
          description: "test plan",
          phase: "planning",
          todos: [{ id: "t1", title: "todo-1", status: "todo" }],
        },
        null,
        2,
      ),
      "utf-8",
    );

    const context = makeContext(workspaceDir);
    const respond = vi.fn();
    await taskPlanHandlers["task_plan.approve"]({
      params: { sessionKey },
      respond,
      context,
      req: { type: "req", id: "task-plan-approve-test", method: "task_plan.approve" },
    } as never);

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        ok: true,
        plan: expect.objectContaining({ phase: "execution" }),
        executionGraph: expect.objectContaining({
          orderedTodoIds: ["t1"],
          readyTodoIds: ["t1"],
          blockedTodoIds: [],
        }),
        approvedAt: expect.any(Number),
        phaseTransition: {
          from: "planning",
          to: "execution",
          changed: true,
        },
      }),
      undefined,
    );

    const persisted = JSON.parse(await fs.readFile(plannerPath, "utf-8")) as {
      phase?: string;
      updatedAt?: number;
    };
    expect(persisted.phase).toBe("execution");
    expect(typeof persisted.updatedAt).toBe("number");
    expect((context.broadcast as unknown as ReturnType<typeof vi.fn>).mock.calls).toEqual([
      [
        "task_plan.execution.trigger",
        expect.objectContaining({
          sessionKey,
          prompt: expect.any(String),
          executionGraph: expect.objectContaining({
            readyTodoIds: ["t1"],
          }),
        }),
      ],
    ]);
  });

  it("sanitizes placeholder todos on read and persists cleanup", async () => {
    const sessionKey = "main";
    const plannerPath = path.join(workspaceDir, ".openaeon", "planner", `${sessionKey}.json`);
    await fs.mkdir(path.dirname(plannerPath), { recursive: true });
    await fs.writeFile(
      plannerPath,
      JSON.stringify(
        {
          description: "test plan",
          phase: "planning",
          todos: [
            { id: "p1", title: "Agent 1: 待定任务1", status: "todo" },
            { id: "r1", title: "Collect earnings data", status: "todo" },
          ],
        },
        null,
        2,
      ),
      "utf-8",
    );

    const respond = vi.fn();
    await taskPlanHandlers["task_plan.read"]({
      params: { sessionKey },
      respond,
      context: makeContext(workspaceDir),
      req: { type: "req", id: "task-plan-read-test", method: "task_plan.read" },
    } as never);

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        ok: true,
        plan: expect.objectContaining({
          todos: [{ id: "r1", title: "Collect earnings data", status: "todo" }],
        }),
        executionGraph: expect.objectContaining({
          orderedTodoIds: ["r1"],
          readyTodoIds: ["r1"],
          blockedTodoIds: [],
        }),
      }),
      undefined,
    );

    const persisted = JSON.parse(await fs.readFile(plannerPath, "utf-8")) as {
      todos: Array<{ id: string; title: string; status: string }>;
    };
    expect(persisted.todos).toEqual([{ id: "r1", title: "Collect earnings data", status: "todo" }]);
  });

  it("does not regress from complete when approving", async () => {
    const sessionKey = "main";
    const plannerPath = path.join(workspaceDir, ".openaeon", "planner", `${sessionKey}.json`);
    await fs.mkdir(path.dirname(plannerPath), { recursive: true });
    await fs.writeFile(
      plannerPath,
      JSON.stringify(
        {
          description: "done plan",
          phase: "complete",
          todos: [{ id: "r1", title: "Done step", status: "done" }],
        },
        null,
        2,
      ),
      "utf-8",
    );
    const context = makeContext(workspaceDir);
    const respond = vi.fn();
    await taskPlanHandlers["task_plan.approve"]({
      params: { sessionKey },
      respond,
      context,
      req: { type: "req", id: "task-plan-approve-complete", method: "task_plan.approve" },
    } as never);
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        ok: true,
        plan: expect.objectContaining({ phase: "complete" }),
        phaseTransition: {
          from: "complete",
          to: "complete",
          changed: false,
        },
      }),
      undefined,
    );
    expect((context.broadcast as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });

  it("marks todos blocked by unmet dependsOn in executionGraph", async () => {
    const sessionKey = "main";
    const plannerPath = path.join(workspaceDir, ".openaeon", "planner", `${sessionKey}.json`);
    await fs.mkdir(path.dirname(plannerPath), { recursive: true });
    await fs.writeFile(
      plannerPath,
      JSON.stringify(
        {
          description: "dependency graph",
          phase: "execution",
          todos: [
            { id: "a1", title: "Step A", status: "done" },
            { id: "b1", title: "Step B", status: "todo", dependsOn: ["a1"] },
            { id: "c1", title: "Step C", status: "todo", dependsOn: ["z9"] },
          ],
        },
        null,
        2,
      ),
      "utf-8",
    );
    const respond = vi.fn();
    await taskPlanHandlers["task_plan.read"]({
      params: { sessionKey },
      respond,
      context: makeContext(workspaceDir),
      req: { type: "req", id: "task-plan-read-graph", method: "task_plan.read" },
    } as never);
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        ok: true,
        executionGraph: expect.objectContaining({
          readyTodoIds: ["b1"],
          blockedTodoIds: ["c1"],
          blockedBy: {
            c1: ["z9"],
          },
        }),
      }),
      undefined,
    );
  });
});
