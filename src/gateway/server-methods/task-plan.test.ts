import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayRequestContext } from "./types.js";

const mocks = vi.hoisted(() => ({
  loadConfig: vi.fn(),
  resolveStateDir: vi.fn(),
  spawnSubagentDirect: vi.fn(),
}));

vi.mock("../../config/config.js", () => ({
  loadConfig: mocks.loadConfig,
  resolveStateDir: mocks.resolveStateDir,
  STATE_DIR: "/tmp/openaeon-state",
}));

vi.mock("../../agents/subagent-spawn.js", () => ({
  spawnSubagentDirect: mocks.spawnSubagentDirect,
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
    mocks.spawnSubagentDirect.mockResolvedValue({
      status: "accepted",
      childSessionKey: "agent:main:subagent:test-child",
      runId: "test-run",
    });
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
          inProgressTodoIds: ["t1"],
          readyTodoIds: [],
          blockedTodoIds: [],
        }),
        autopilot: expect.objectContaining({
          enabled: true,
          sessionKey,
        }),
        spawned: expect.arrayContaining([
          expect.objectContaining({
            sessionKey,
            todoId: "t1",
            ok: true,
          }),
        ]),
        approvedAt: expect.any(Number),
        phaseTransition: {
          from: "planning",
          to: "execution",
          changed: true,
        },
        taskRuntime: expect.objectContaining({
          currentBranchId: "main",
          checkpointsCount: expect.any(Number),
        }),
      }),
      undefined,
    );

    const persisted = JSON.parse(await fs.readFile(plannerPath, "utf-8")) as {
      phase?: string;
      updatedAt?: number;
      checkpoints?: Array<{ reason: string; stageId: string; branchId: string }>;
    };
    expect(persisted.phase).toBe("execution");
    expect(typeof persisted.updatedAt).toBe("number");
    expect(persisted.checkpoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reason: "approve",
          stageId: "execution",
          branchId: "main",
        }),
      ]),
    );
    expect((context.broadcast as unknown as ReturnType<typeof vi.fn>).mock.calls).toEqual(
      expect.arrayContaining([
        [
          "task_plan.execution.trigger",
          expect.objectContaining({
            sessionKey,
            prompt: expect.any(String),
          }),
        ],
        [
          "task_plan.autopilot.status",
          expect.objectContaining({
            sessionKey,
            enabled: true,
          }),
        ],
        [
          "task_plan.autopilot.spawned",
          expect.objectContaining({
            sessionKey,
            todoId: "t1",
            ok: true,
          }),
        ],
      ]),
    );
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
        taskRuntime: expect.objectContaining({
          currentBranchId: "main",
        }),
      }),
      undefined,
    );

    const persisted = JSON.parse(await fs.readFile(plannerPath, "utf-8")) as {
      todos: Array<{ id: string; title: string; status: string }>;
    };
    expect(persisted.todos).toEqual([{ id: "r1", title: "Collect earnings data", status: "todo" }]);
  });

  it("does not create graph todo edges for placeholder todos", async () => {
    const sessionKey = "main";
    const plannerPath = path.join(workspaceDir, ".openaeon", "planner", `${sessionKey}.json`);
    await fs.mkdir(path.dirname(plannerPath), { recursive: true });
    await fs.writeFile(
      plannerPath,
      JSON.stringify(
        {
          description: "graph placeholder filter",
          phase: "planning",
          todos: [
            { id: "p1", title: "Agent 1: 待定任务1", status: "todo" },
            { id: "r1", title: "Implement real execution step", status: "todo", dependsOn: ["p1"] },
          ],
        },
        null,
        2,
      ),
      "utf-8",
    );

    const transitionRespond = vi.fn();
    await taskPlanHandlers["task_plan.transition.apply"]({
      params: { sessionKey, action: "forward" },
      respond: transitionRespond,
      context: makeContext(workspaceDir),
      req: {
        type: "req",
        id: "task-plan-transition-graph-placeholder",
        method: "task_plan.transition.apply",
      },
    } as never);
    expect(transitionRespond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ ok: true }),
      undefined,
    );

    const graphRespond = vi.fn();
    await taskPlanHandlers["task_plan.graph.query"]({
      params: { sessionKey, relation: "STAGE_HAS_TODO" },
      respond: graphRespond,
      context: makeContext(workspaceDir),
      req: {
        type: "req",
        id: "task-plan-graph-query-stage-has-todo",
        method: "task_plan.graph.query",
      },
    } as never);
    const graphPayload = graphRespond.mock.calls.at(-1)?.[1] as
      | { ok?: boolean; edges?: Array<{ from: string; to: string; relation: string }> }
      | undefined;
    expect(graphPayload?.ok).toBe(true);
    const todoTargets = (graphPayload?.edges ?? []).map((edge) => edge.to);
    expect(todoTargets).toContain("todo:r1");
    expect(todoTargets).not.toContain("todo:p1");
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

  it("surfaces stale and long-running in-progress todos for long task coordination", async () => {
    const sessionKey = "main";
    const plannerPath = path.join(workspaceDir, ".openaeon", "planner", `${sessionKey}.json`);
    await fs.mkdir(path.dirname(plannerPath), { recursive: true });
    const now = 2_000_000;
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(now);
    await fs.writeFile(
      plannerPath,
      JSON.stringify(
        {
          description: "long-running coordination",
          phase: "execution",
          todos: [
            {
              id: "r1",
              title: "Active long run",
              status: "in_progress",
              startedAt: now - 21 * 60_000,
              heartbeatAt: now - 9 * 60_000,
              attemptCount: 2,
            },
            {
              id: "t1",
              title: "Fresh todo",
              status: "todo",
            },
          ],
        },
        null,
        2,
      ),
      "utf-8",
    );

    const respond = vi.fn();
    const context = makeContext(workspaceDir);
    await taskPlanHandlers["task_plan.read"]({
      params: { sessionKey },
      respond,
      context,
      req: { type: "req", id: "task-plan-read-long-run", method: "task_plan.read" },
    } as never);

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        ok: true,
        executionGraph: expect.objectContaining({
          inProgressTodoIds: ["r1"],
          readyTodoIds: ["t1"],
          longRunningTodoIds: ["r1"],
          staleTodoIds: ["r1"],
          advisories: expect.arrayContaining(["stalled:r1", "long_running:r1"]),
        }),
      }),
      undefined,
    );
    expect((context.broadcast as unknown as ReturnType<typeof vi.fn>).mock.calls).toEqual(
      expect.arrayContaining([
        [
          "task_plan.execution.recover",
          expect.objectContaining({
            sessionKey,
            staleTodoIds: ["r1"],
            readyTodoIds: ["t1"],
          }),
        ],
      ]),
    );

    const respond2 = vi.fn();
    await taskPlanHandlers["task_plan.read"]({
      params: { sessionKey },
      respond: respond2,
      context,
      req: { type: "req", id: "task-plan-read-long-run-2", method: "task_plan.read" },
    } as never);
    // Cooldown should prevent duplicate recovery broadcasts on immediate reads
    const recoverCalls = (
      context.broadcast as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.filter(([event]) => event === "task_plan.execution.recover");
    expect(recoverCalls).toHaveLength(1);
    nowSpy.mockRestore();
  });

  it("applies forward transition and records checkpoint with stage change event", async () => {
    const sessionKey = "main";
    const plannerPath = path.join(workspaceDir, ".openaeon", "planner", `${sessionKey}.json`);
    await fs.mkdir(path.dirname(plannerPath), { recursive: true });
    await fs.writeFile(
      plannerPath,
      JSON.stringify(
        {
          description: "transition plan",
          phase: "planning",
          todos: [{ id: "t1", title: "todo-1", status: "todo" }],
        },
        null,
        2,
      ),
      "utf-8",
    );
    const respond = vi.fn();
    const context = makeContext(workspaceDir);
    await taskPlanHandlers["task_plan.transition.apply"]({
      params: { sessionKey, action: "forward" },
      respond,
      context,
      req: {
        type: "req",
        id: "task-plan-transition-forward",
        method: "task_plan.transition.apply",
      },
    } as never);
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        ok: true,
        plan: expect.objectContaining({
          phase: "execution",
        }),
        transition: expect.objectContaining({
          action: "forward",
          changed: true,
          phaseTransition: {
            from: "planning",
            to: "execution",
            changed: true,
          },
        }),
      }),
      undefined,
    );
    expect((context.broadcast as unknown as ReturnType<typeof vi.fn>).mock.calls).toEqual(
      expect.arrayContaining([
        [
          "task_plan.stage.changed",
          expect.objectContaining({
            sessionKey,
            action: "forward",
          }),
        ],
      ]),
    );
  });

  it("creates branch via transition.apply and preserves parent lineage", async () => {
    const sessionKey = "main";
    const plannerPath = path.join(workspaceDir, ".openaeon", "planner", `${sessionKey}.json`);
    await fs.mkdir(path.dirname(plannerPath), { recursive: true });
    await fs.writeFile(
      plannerPath,
      JSON.stringify(
        {
          description: "branch plan",
          phase: "execution",
          currentBranchId: "main",
          branches: [{ id: "main", status: "active", createdAt: 1 }],
          todos: [{ id: "t1", title: "todo-1", status: "todo" }],
        },
        null,
        2,
      ),
      "utf-8",
    );
    const respond = vi.fn();
    await taskPlanHandlers["task_plan.transition.apply"]({
      params: { sessionKey, action: "branch", branchId: "exp-a" },
      respond,
      context: makeContext(workspaceDir),
      req: { type: "req", id: "task-plan-transition-branch", method: "task_plan.transition.apply" },
    } as never);
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        ok: true,
        plan: expect.objectContaining({
          currentBranchId: "exp-a",
          branches: expect.arrayContaining([
            expect.objectContaining({ id: "main" }),
            expect.objectContaining({
              id: "exp-a",
              parentBranchId: "main",
            }),
          ]),
        }),
      }),
      undefined,
    );
  });

  it("restores from checkpoint and persists restore checkpoint", async () => {
    const sessionKey = "main";
    const plannerPath = path.join(workspaceDir, ".openaeon", "planner", `${sessionKey}.json`);
    await fs.mkdir(path.dirname(plannerPath), { recursive: true });
    await fs.writeFile(
      plannerPath,
      JSON.stringify(
        {
          description: "restore plan",
          phase: "execution",
          currentBranchId: "main",
          branches: [{ id: "main", status: "active", createdAt: 1 }],
          checkpoints: [
            {
              checkpointId: "ckpt_old",
              taskId: sessionKey,
              stageId: "planning",
              branchId: "main",
              reason: "approve",
              createdAt: 1,
              snapshot: {
                description: "old",
                phase: "planning",
                todos: [{ id: "t0", title: "old todo", status: "todo" }],
              },
            },
          ],
          todos: [{ id: "t1", title: "current todo", status: "in_progress" }],
        },
        null,
        2,
      ),
      "utf-8",
    );
    const context = makeContext(workspaceDir);
    const respond = vi.fn();
    await taskPlanHandlers["task_plan.checkpoint.restore"]({
      params: { sessionKey, checkpointId: "ckpt_old" },
      respond,
      context,
      req: {
        type: "req",
        id: "task-plan-checkpoint-restore",
        method: "task_plan.checkpoint.restore",
      },
    } as never);
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        ok: true,
        restoredFrom: "ckpt_old",
        plan: expect.objectContaining({
          phase: "planning",
          description: "old",
          todos: [{ id: "t0", title: "old todo", status: "todo" }],
          checkpoints: expect.arrayContaining([
            expect.objectContaining({
              checkpointId: "ckpt_old",
            }),
            expect.objectContaining({
              reason: "restore",
              sourceCheckpointId: "ckpt_old",
            }),
          ]),
        }),
      }),
      undefined,
    );
    expect((context.broadcast as unknown as ReturnType<typeof vi.fn>).mock.calls).toEqual(
      expect.arrayContaining([
        [
          "task_plan.checkpoint.restored",
          expect.objectContaining({
            sessionKey,
            checkpointId: "ckpt_old",
          }),
        ],
      ]),
    );
  });

  it("records verifier report and emits verifier result event", async () => {
    const sessionKey = "main";
    const plannerPath = path.join(workspaceDir, ".openaeon", "planner", `${sessionKey}.json`);
    await fs.mkdir(path.dirname(plannerPath), { recursive: true });
    await fs.writeFile(
      plannerPath,
      JSON.stringify(
        {
          description: "verify plan",
          phase: "execution",
          currentBranchId: "main",
          branches: [{ id: "main", status: "active", createdAt: 1 }],
          todos: [{ id: "t1", title: "task", status: "done", result: "ok" }],
        },
        null,
        2,
      ),
      "utf-8",
    );
    const context = makeContext(workspaceDir);
    const respond = vi.fn();
    await taskPlanHandlers["task_plan.verifier.report"]({
      params: {
        sessionKey,
        status: "passed",
        summary: "checks passed",
        evidence: ["unit tests", "lint"],
      },
      respond,
      context,
      req: {
        type: "req",
        id: "task-plan-verifier-report",
        method: "task_plan.verifier.report",
      },
    } as never);
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        ok: true,
        verifier: expect.objectContaining({
          status: "passed",
          summary: "checks passed",
          evidence: ["unit tests", "lint"],
        }),
        plan: expect.objectContaining({
          verifierHistory: expect.arrayContaining([
            expect.objectContaining({
              status: "passed",
            }),
          ]),
        }),
      }),
      undefined,
    );
    expect((context.broadcast as unknown as ReturnType<typeof vi.fn>).mock.calls).toEqual(
      expect.arrayContaining([
        [
          "task_plan.verifier.result",
          expect.objectContaining({
            sessionKey,
            verifier: expect.objectContaining({
              status: "passed",
            }),
          }),
        ],
      ]),
    );
  });

  it("distills dream and allows graph query over generated edges", async () => {
    const sessionKey = "main";
    const plannerPath = path.join(workspaceDir, ".openaeon", "planner", `${sessionKey}.json`);
    await fs.mkdir(path.dirname(plannerPath), { recursive: true });
    await fs.writeFile(
      plannerPath,
      JSON.stringify(
        {
          description: "dream plan",
          phase: "execution",
          currentBranchId: "main",
          branches: [{ id: "main", status: "active", createdAt: 1 }],
          checkpoints: [
            {
              checkpointId: "ckpt_1",
              taskId: sessionKey,
              stageId: "execution",
              branchId: "main",
              reason: "approve",
              createdAt: 1,
              snapshot: {
                description: "d",
                phase: "execution",
                todos: [{ id: "t1", title: "task", status: "done" }],
              },
            },
          ],
          todos: [{ id: "t1", title: "task", status: "done" }],
        },
        null,
        2,
      ),
      "utf-8",
    );
    const context = makeContext(workspaceDir);
    const dreamRespond = vi.fn();
    await taskPlanHandlers["task_plan.dream.distill"]({
      params: {
        sessionKey,
        summary: "execution distilled",
        keyDecisions: ["use low cost path"],
        risks: ["edge cases pending"],
        anchors: ["stage:execution", "risk:edge"],
      },
      respond: dreamRespond,
      context,
      req: {
        type: "req",
        id: "task-plan-dream-distill",
        method: "task_plan.dream.distill",
      },
    } as never);
    expect(dreamRespond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        ok: true,
        dream: expect.objectContaining({
          summary: "execution distilled",
          keyDecisions: ["use low cost path"],
        }),
        plan: expect.objectContaining({
          dreams: expect.arrayContaining([
            expect.objectContaining({
              summary: "execution distilled",
            }),
          ]),
        }),
      }),
      undefined,
    );
    const graphRespond = vi.fn();
    await taskPlanHandlers["task_plan.graph.query"]({
      params: {
        sessionKey,
        nodeId: "dream:",
      },
      respond: graphRespond,
      context: makeContext(workspaceDir),
      req: {
        type: "req",
        id: "task-plan-graph-query",
        method: "task_plan.graph.query",
      },
    } as never);
    expect(graphRespond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        ok: true,
        edges: expect.arrayContaining([
          expect.objectContaining({
            relation: "STAGE_GENERATES_DREAM",
          }),
        ]),
      }),
      undefined,
    );
    const graphRelationRespond = vi.fn();
    await taskPlanHandlers["task_plan.graph.query"]({
      params: {
        sessionKey,
        relation: "STAGE_GENERATES_DREAM",
      },
      respond: graphRelationRespond,
      context: makeContext(workspaceDir),
      req: {
        type: "req",
        id: "task-plan-graph-query-relation",
        method: "task_plan.graph.query",
      },
    } as never);
    const relationPayload = graphRelationRespond.mock.calls.at(-1)?.[1] as
      | {
          ok?: boolean;
          edges?: Array<{
            edgeId: string;
            from: string;
            to: string;
            relation: string;
            at: number;
          }>;
        }
      | undefined;
    expect(relationPayload?.ok).toBe(true);
    expect((relationPayload?.edges ?? []).length).toBeGreaterThan(0);
    expect(
      (relationPayload?.edges ?? []).every((edge) => edge.relation === "STAGE_GENERATES_DREAM"),
    ).toBe(true);
  });
});
