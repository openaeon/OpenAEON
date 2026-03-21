import { describe, expect, it } from "vitest";
import { buildSubagentViewModel, getVisiblePlanTodos } from "../../ui/src/ui/views/chat/components/subagent-view-model.ts";

describe("subagent view model", () => {
  it("filters placeholder todos once via shared plan cleaner", () => {
    const todos = getVisiblePlanTodos({
      description: "test",
      phase: "execution",
      todos: [
        { id: "a", title: "Agent 1: 待定任务1", status: "todo" },
        { id: "b", title: "real task", status: "todo" },
      ],
    });
    expect(todos.map((todo) => todo.id)).toEqual(["b"]);
  });

  it("maps ready/blocked/in_progress/done statuses from execution graph and todo state", () => {
    const vm = buildSubagentViewModel({
      taskPlan: {
        description: "plan",
        phase: "execution",
        todos: [
          { id: "t1", title: "ready", status: "todo" },
          { id: "t2", title: "blocked", status: "todo" },
          { id: "t3", title: "running", status: "in_progress" },
          { id: "t4", title: "done", status: "done" },
        ],
        executionGraph: {
          orderedTodoIds: ["t1", "t2", "t3", "t4"],
          readyTodoIds: ["t1"],
          blockedTodoIds: ["t2"],
          blockedBy: { t2: ["t1"] },
        },
      },
      sandboxChatEvents: {},
      sessions: [],
    });
    const byId = Object.fromEntries(vm.map((entry) => [entry.todoId, entry.status]));
    expect(byId.t1).toBe("ready");
    expect(byId.t2).toBe("blocked");
    expect(byId.t3).toBe("in_progress");
    expect(byId.t4).toBe("done");
  });

  it("uses event stream as in_progress signal when todo has no explicit running state", () => {
    const vm = buildSubagentViewModel({
      taskPlan: {
        description: "plan",
        phase: "execution",
        todos: [{ id: "t1", title: "task", status: "todo", ownerAgent: "agent:worker:1" }],
        executionGraph: {
          orderedTodoIds: ["t1"],
          readyTodoIds: [],
          blockedTodoIds: [],
          blockedBy: {},
        },
      },
      sandboxChatEvents: {
        "agent:worker:1": "working...",
      },
      sessions: [
        {
          key: "agent:worker:1",
          kind: "direct",
          updatedAt: Date.now(),
        },
      ],
    });
    expect(vm).toHaveLength(1);
    expect(vm[0].status).toBe("in_progress");
    expect(vm[0].lastEvent).toContain("working");
  });

  it("prefers owner match in owner_first mode over fuzzy subject overlap", () => {
    const vm = buildSubagentViewModel({
      taskPlan: {
        description: "plan",
        phase: "execution",
        todos: [
          {
            id: "t-owner",
            title: "analyze apple market",
            status: "todo",
            ownerAgent: "agent:worker:owner",
          },
        ],
        executionGraph: {
          orderedTodoIds: ["t-owner"],
          readyTodoIds: ["t-owner"],
          blockedTodoIds: [],
          blockedBy: {},
        },
      },
      sandboxChatEvents: {
        "agent:worker:fuzzy": "fuzzy event",
      },
      sessions: [
        {
          key: "agent:worker:fuzzy",
          kind: "direct",
          label: "fuzzy",
          subject: "analyze apple market quickly",
          model: "fuzzy-model",
          updatedAt: Date.now(),
        },
        {
          key: "agent:worker:owner",
          kind: "direct",
          label: "owner",
          model: "owner-model",
          updatedAt: Date.now(),
        },
      ],
      matchMode: "owner_first",
    });
    expect(vm).toHaveLength(1);
    expect(vm[0].ownerAgent).toBe("agent:worker:owner");
    expect(vm[0].model).toBe("owner-model");
  });

  it("applies used-session penalty to reduce over-binding on one session", () => {
    const vm = buildSubagentViewModel({
      taskPlan: {
        description: "plan",
        phase: "execution",
        todos: [
          { id: "t1", title: "finance revenue trend", status: "todo" },
          { id: "t2", title: "finance margin risk", status: "todo" },
        ],
        executionGraph: {
          orderedTodoIds: ["t1", "t2"],
          readyTodoIds: ["t1", "t2"],
          blockedTodoIds: [],
          blockedBy: {},
        },
      },
      sandboxChatEvents: {},
      sessions: [
        {
          key: "agent:finance:1",
          kind: "direct",
          subject: "finance revenue trend and margin risk",
          updatedAt: Date.now(),
        },
        {
          key: "agent:finance:2",
          kind: "direct",
          subject: "finance margin risk",
          updatedAt: Date.now(),
        },
      ],
      matchMode: "balanced",
    });
    expect(vm).toHaveLength(2);
    // Ensure we can still match both todos and keep deterministic output ordering.
    expect(vm.map((entry) => entry.todoId)).toEqual(["t1", "t2"]);
  });
});
