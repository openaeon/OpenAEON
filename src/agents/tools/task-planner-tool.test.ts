import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { createTaskPlannerTool } from "./task-planner-tool.js";
import { ToolInputError } from "./common.js";

test("task planner tool manages plan and todos", async () => {
  const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-test-planner-"));
  const tool = createTaskPlannerTool({ workspaceDir: tmpdir, agentSessionKey: "test:session" });

  expect(tool).toBeDefined();

  // Create plan
  const createRes = await tool!.execute("call1", { action: "create_plan", description: "My plan" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((createRes.details as any).plan.description).toBe("My plan");

  // Add todo
  const addRes = await tool!.execute("call2", { action: "add_todo", title: "Build feature X" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const added = (addRes.details as any).added;
  expect(added.title).toBe("Build feature X");
  expect(added.status).toBe("todo");

  // Update todo
  const updateRes = await tool!.execute("call3", {
    action: "update_todo",
    taskId: added.id,
    status: "in_progress",
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((updateRes.details as any).updated.status).toBe("in_progress");

  // Read plan
  const readRes = await tool!.execute("call4", { action: "read_plan" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((readRes.details as any).plan.todos).toHaveLength(1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((readRes.details as any).plan.todos[0].status).toBe("in_progress");
});

test("task planner tool ignores placeholder todos and prunes legacy placeholders", async () => {
  const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-test-planner-"));
  const tool = createTaskPlannerTool({ workspaceDir: tmpdir, agentSessionKey: "test:session" });
  expect(tool).toBeDefined();

  await tool!.execute("call1", { action: "create_plan", description: "Plan with cleanup" });
  const ignored = await tool!.execute("call2", { action: "add_todo", title: "Agent 1: 待定任务1" });
  expect((ignored.details as any).status).toBe("ignored");
  expect((ignored.details as any).reason).toBe("placeholder_todo_title");

  await tool!.execute("call3", { action: "add_todo", title: "Research real objective" });

  const plannerPath = path.join(tmpdir, ".openaeon", "planner", "test_session.json");
  const raw = JSON.parse(await fs.readFile(plannerPath, "utf-8")) as {
    description: string;
    phase: string;
    todos: Array<{ id: string; title: string; status: string; result?: string }>;
  };
  raw.todos.push({
    id: "legacy1",
    title: "代理2: 待定任务2",
    status: "done",
    result: "占位任务，无需执行",
  });
  await fs.writeFile(plannerPath, JSON.stringify(raw, null, 2), "utf-8");

  const read = await tool!.execute("call4", { action: "read_plan" });
  const todos = (read.details as any).plan.todos as Array<{ title: string }>;
  expect(todos).toHaveLength(1);
  expect(todos[0]?.title).toBe("Research real objective");
});

test("task planner set_phase forbids backward transitions", async () => {
  const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-test-planner-"));
  const tool = createTaskPlannerTool({ workspaceDir: tmpdir, agentSessionKey: "test:session" });
  expect(tool).toBeDefined();
  await tool!.execute("call1", { action: "create_plan", description: "Phase transition test" });
  await tool!.execute("call2", { action: "set_phase", phase: "execution" });
  await expect(
    tool!.execute("call3", { action: "set_phase", phase: "planning" }),
  ).rejects.toBeInstanceOf(ToolInputError);
});

test("task planner stores orchestration metadata", async () => {
  const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-test-planner-"));
  const tool = createTaskPlannerTool({ workspaceDir: tmpdir, agentSessionKey: "test:session" });
  expect(tool).toBeDefined();

  await tool!.execute("call1", { action: "create_plan", description: "Metadata test" });
  const addRes = await tool!.execute("call2", {
    action: "add_todo",
    title: "Implement execution watchdog",
    ownerAgent: "agent:main:sub",
    dependsOn: ["prep001"],
    acceptanceCriteria: ["watchdog retries once", "degraded path logged"],
    outputSchema: "json:{retryCount:number,degraded:boolean}",
    riskLevel: "medium",
    mergeKey: "watchdog",
    retryLimit: 2,
  });
  const added = (addRes.details as any).added as Record<string, unknown>;
  expect(added.ownerAgent).toBe("agent:main:sub");
  expect(added.dependsOn).toEqual(["prep001"]);
  expect(added.acceptanceCriteria).toEqual(["watchdog retries once", "degraded path logged"]);
  expect(added.riskLevel).toBe("medium");
  expect(added.retryLimit).toBe(2);
});

test("task planner blocks done status without result when acceptance criteria exists", async () => {
  const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-test-planner-"));
  const tool = createTaskPlannerTool({ workspaceDir: tmpdir, agentSessionKey: "test:session" });
  expect(tool).toBeDefined();

  await tool!.execute("call1", { action: "create_plan", description: "Done gate test" });
  const addRes = await tool!.execute("call2", {
    action: "add_todo",
    title: "Real subagent task",
    acceptanceCriteria: ["must provide concrete outcome"],
  });
  const taskId = (addRes.details as any).added.id as string;

  await expect(
    tool!.execute("call3", { action: "update_todo", taskId, status: "done" }),
  ).rejects.toBeInstanceOf(ToolInputError);

  const doneRes = await tool!.execute("call4", {
    action: "update_todo",
    taskId,
    status: "done",
    result: "Completed with execution log ID exec_123",
  });
  expect((doneRes.details as any).updated.status).toBe("done");
  expect((doneRes.details as any).updated.result).toContain("exec_123");
});
