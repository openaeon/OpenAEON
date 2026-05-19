import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayRequestContext } from "./types.js";
import { cognitiveHandlers } from "./cognitive.js";

vi.mock("../../cognitive-os/runtime/subagent-runtime-adapter.js", () => ({
  dispatchCognitiveNodeToSubagent: vi.fn().mockResolvedValue({ accepted: false }),
}));

function makeContext(workspaceDir: string): GatewayRequestContext {
  return {
    workspaceDir,
    chatAbortControllers: new Map(),
    broadcast: vi.fn(),
  } as unknown as GatewayRequestContext;
}

describe("cognitive.source.read", () => {
  let workspaceDir = "";

  beforeEach(async () => {
    workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "openaeon-cognitive-source-"));
  });

  afterEach(async () => {
    if (workspaceDir) {
      await fs.rm(workspaceDir, { recursive: true, force: true });
    }
  });

  it("returns a contextual excerpt for workspace files", async () => {
    const filePath = path.join(workspaceDir, "src", "story.ts");
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(
      filePath,
      ["alpha", "beta", "gamma", "delta", "epsilon", "zeta"].join("\n"),
      "utf-8",
    );

    const respond = vi.fn();
    await cognitiveHandlers["cognitive.source.read"]({
      params: {
        path: "src/story.ts",
        startLine: 3,
        endLine: 4,
        contextLines: 1,
      },
      respond,
      context: makeContext(workspaceDir),
      req: { type: "req", id: "cognitive-source-read-test", method: "cognitive.source.read" },
    } as never);

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        ok: true,
        source: expect.objectContaining({
          path: "src/story.ts",
          startLine: 3,
          endLine: 4,
          contextStartLine: 2,
          contextEndLine: 5,
          lineCount: 6,
          excerpt: expect.stringContaining(">    3 | gamma"),
        }),
      }),
      undefined,
    );
  });

  it("rejects paths outside the workspace", async () => {
    const respond = vi.fn();
    await cognitiveHandlers["cognitive.source.read"]({
      params: {
        path: "../outside.ts",
        startLine: 1,
        endLine: 1,
      },
      respond,
      context: makeContext(workspaceDir),
      req: { type: "req", id: "cognitive-source-read-outside", method: "cognitive.source.read" },
    } as never);

    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        code: "COGNITIVE_SOURCE_READ_ERROR",
      }),
    );
  });
});

describe("cognitive task lifecycle", () => {
  let workspaceDir = "";

  beforeEach(async () => {
    workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "openaeon-cognitive-lifecycle-"));
  });

  afterEach(async () => {
    if (workspaceDir) {
      await fs.rm(workspaceDir, { recursive: true, force: true });
    }
  });

  it("supports submit -> list/read -> transition/dispatch -> reflect/dream -> replay -> memory write/query", async () => {
    const context = makeContext(workspaceDir);
    const respond = vi.fn();
    const sessionKey = "main";

    await cognitiveHandlers["cognitive.task.submit"]({
      params: {
        sessionKey,
        title: "Lifecycle Task",
        text: "Build and verify cognitive pipeline",
      },
      respond,
      context,
      req: { type: "req", id: "cognitive-task-submit-test", method: "cognitive.task.submit" },
    } as never);

    const submitPayload = respond.mock.calls.at(-1)?.[1] as
      | { ok?: boolean; task?: { id: string; status: { phase: string } } }
      | undefined;
    expect(submitPayload?.ok).toBe(true);
    expect(submitPayload?.task?.id).toBeTruthy();
    expect(submitPayload?.task?.status.phase).toBe("EXECUTE");

    const taskId = submitPayload?.task?.id ?? "";
    expect(taskId).not.toBe("");

    await cognitiveHandlers["cognitive.task.list"]({
      params: { limit: 20 },
      respond,
      context,
      req: { type: "req", id: "cognitive-task-list-test", method: "cognitive.task.list" },
    } as never);
    const listPayload = respond.mock.calls.at(-1)?.[1] as
      | { ok?: boolean; tasks?: Array<{ id: string; title: string }> }
      | undefined;
    expect(listPayload?.ok).toBe(true);
    expect(listPayload?.tasks?.some((task) => task.id === taskId)).toBe(true);

    await cognitiveHandlers["cognitive.task.read"]({
      params: { taskId },
      respond,
      context,
      req: { type: "req", id: "cognitive-task-read-test", method: "cognitive.task.read" },
    } as never);
    const readPayload = respond.mock.calls.at(-1)?.[1] as
      | {
          ok?: boolean;
          task?: { id: string };
          cognitivePlan?: {
            architecture?: {
              formula?: string;
              capabilityLadder?: unknown[];
              operatingLoop?: unknown[];
              spaces?: unknown[];
            } | null;
            taskTree?: { rootId: string; nodes: Record<string, { id: string }> };
          };
          runtime?: {
            summary?: {
              queue?: { pending: number; claimed: number };
              retries?: { total: number };
              delegations?: { active: number; overdue: number };
            };
            replayCursor?: string | null;
            events?: unknown[];
          };
        }
      | undefined;
    expect(readPayload?.ok).toBe(true);
    expect(readPayload?.task?.id).toBe(taskId);
    expect(readPayload?.cognitivePlan).toBeTruthy();
    expect(readPayload?.cognitivePlan?.architecture?.formula).toBe("Z -> Z^2 + C + R -> Z+1");
    expect(readPayload?.cognitivePlan?.architecture?.capabilityLadder).toHaveLength(9);
    expect(readPayload?.cognitivePlan?.architecture?.operatingLoop).toHaveLength(8);
    expect(readPayload?.cognitivePlan?.architecture?.spaces).toHaveLength(5);
    expect(readPayload?.runtime?.summary?.queue).toBeDefined();
    expect(typeof readPayload?.runtime?.summary?.retries?.total).toBe("number");
    expect(readPayload?.runtime?.summary?.delegations).toBeDefined();
    expect(
      readPayload?.runtime?.replayCursor === null ||
        typeof readPayload?.runtime?.replayCursor === "string",
    ).toBe(true);
    expect(Array.isArray(readPayload?.runtime?.events)).toBe(true);

    await cognitiveHandlers["cognitive.runtime.status"]({
      params: { taskId },
      respond,
      context,
      req: { type: "req", id: "cognitive-runtime-status-test", method: "cognitive.runtime.status" },
    } as never);
    const statusPayload = respond.mock.calls.at(-1)?.[1] as
      | {
          ok?: boolean;
          health?: {
            phase?: string;
            queue?: { pending: number; claimed: number };
            retries?: { total: number; pendingBackoff: number; exhausted: number };
            delegations?: { active: number; overdue: number };
            providers?: Array<{ provider: string; success: number; failed: number }>;
          };
        }
      | undefined;
    expect(statusPayload?.ok).toBe(true);
    expect(statusPayload?.health?.phase).toBeTruthy();
    expect(statusPayload?.health?.queue).toBeDefined();
    expect(statusPayload?.health?.retries).toBeDefined();
    expect(statusPayload?.health?.delegations).toBeDefined();
    expect(Array.isArray(statusPayload?.health?.providers)).toBe(true);

    await cognitiveHandlers["cognitive.task.transition"]({
      params: { taskId, to: "PLAN", reason: "test:manual_replan" },
      respond,
      context,
      req: {
        type: "req",
        id: "cognitive-task-transition-test",
        method: "cognitive.task.transition",
      },
    } as never);
    const transitionPayload = respond.mock.calls.at(-1)?.[1] as
      | { ok?: boolean; task?: { id?: string; status?: { phase?: string } } }
      | undefined;
    expect(transitionPayload?.ok).toBe(true);
    expect(transitionPayload?.task?.id).toBe(taskId);
    expect(transitionPayload?.task?.status?.phase).toBe("PLAN");

    await cognitiveHandlers["cognitive.runtime.dispatch"]({
      params: { taskId },
      respond,
      context,
      req: {
        type: "req",
        id: "cognitive-runtime-dispatch-test",
        method: "cognitive.runtime.dispatch",
      },
    } as never);
    const dispatchPayload = respond.mock.calls.at(-1)?.[1] as
      | { ok?: boolean; task?: { id?: string; runIds?: string[] } }
      | undefined;
    expect(dispatchPayload?.ok).toBe(true);
    expect(dispatchPayload?.task?.id).toBe(taskId);

    const forceNodeId = Object.keys(readPayload?.cognitivePlan?.taskTree?.nodes ?? {}).find(
      (nodeId) => nodeId !== readPayload?.cognitivePlan?.taskTree?.rootId,
    );
    if (forceNodeId) {
      await cognitiveHandlers["cognitive.runtime.force_start"]({
        params: { taskId, nodeId: forceNodeId },
        respond,
        context,
        req: {
          type: "req",
          id: "cognitive-runtime-force-start-test",
          method: "cognitive.runtime.force_start",
        },
      } as never);
      const forcePayload = respond.mock.calls.at(-1)?.[1] as
        | { ok?: boolean; task?: { id?: string } }
        | undefined;
      expect(forcePayload?.ok).toBe(true);
      expect(forcePayload?.task?.id).toBe(taskId);
      expect(context.broadcast).toHaveBeenCalledWith(
        "cognitive.runtime.dispatched",
        expect.objectContaining({ taskId, nodeId: forceNodeId, mode: "force" }),
      );
    }

    await cognitiveHandlers["cognitive.cognition.reflect"]({
      params: {
        taskId,
        output: "Lifecycle reflection payload",
        success: true,
      },
      respond,
      context,
      req: {
        type: "req",
        id: "cognitive-reflect-test",
        method: "cognitive.cognition.reflect",
      },
    } as never);
    const reflectPayload = respond.mock.calls.at(-1)?.[1] as
      | { ok?: boolean; reflection?: { taskId?: string } }
      | undefined;
    expect(reflectPayload?.ok).toBe(true);
    expect(reflectPayload?.reflection?.taskId).toBe(taskId);

    await cognitiveHandlers["cognitive.task.read"]({
      params: { taskId },
      respond,
      context,
      req: {
        type: "req",
        id: "cognitive-task-read-for-replay-test",
        method: "cognitive.task.read",
      },
    } as never);
    const replayCandidate = respond.mock.calls.at(-1)?.[1] as
      | { ok?: boolean; task?: { runIds?: string[] } | null }
      | undefined;
    const replayRunId = replayCandidate?.task?.runIds?.[0];
    if (replayRunId) {
      await cognitiveHandlers["cognitive.task.replay"]({
        params: { taskId, runId: replayRunId, limit: 50 },
        respond,
        context,
        req: {
          type: "req",
          id: "cognitive-task-replay-test",
          method: "cognitive.task.replay",
        },
      } as never);
      const replayPayload = respond.mock.calls.at(-1)?.[1] as
        | { ok?: boolean; events?: unknown[] }
        | undefined;
      expect(replayPayload?.ok).toBe(true);
      expect(Array.isArray(replayPayload?.events)).toBe(true);
    }

    await cognitiveHandlers["cognitive.task.trajectory"]({
      params: { taskId, limit: 100 },
      respond,
      context,
      req: {
        type: "req",
        id: "cognitive-task-trajectory-test",
        method: "cognitive.task.trajectory",
      },
    } as never);
    const trajectoryPayload = respond.mock.calls.at(-1)?.[1] as
      | {
          ok?: boolean;
          trajectory?: {
            format?: string;
            taskId?: string;
            conversations?: unknown[];
            metadata?: { eventCount?: number };
          } | null;
        }
      | undefined;
    expect(trajectoryPayload?.ok).toBe(true);
    expect(trajectoryPayload?.trajectory?.format).toBe("openaeon-cognitive-trajectory");
    expect(trajectoryPayload?.trajectory?.taskId).toBe(taskId);
    expect(Array.isArray(trajectoryPayload?.trajectory?.conversations)).toBe(true);

    await cognitiveHandlers["cognitive.store.search"]({
      params: { query: "Lifecycle", limit: 10 },
      respond,
      context,
      req: {
        type: "req",
        id: "cognitive-store-search-test",
        method: "cognitive.store.search",
      },
    } as never);
    const storeSearchPayload = respond.mock.calls.at(-1)?.[1] as
      | { ok?: boolean; rows?: Array<{ taskId?: string | null }> }
      | undefined;
    expect(storeSearchPayload?.ok).toBe(true);
    expect(storeSearchPayload?.rows?.some((row) => row.taskId === taskId)).toBe(true);

    await cognitiveHandlers["cognitive.task.transition"]({
      params: { taskId, to: "VERIFY", reason: "test:enter_verify_for_dream" },
      respond,
      context,
      req: {
        type: "req",
        id: "cognitive-task-transition-verify-test",
        method: "cognitive.task.transition",
      },
    } as never);
    const verifyTransitionPayload = respond.mock.calls.at(-1)?.[1] as
      | { ok?: boolean; task?: { id?: string; status?: { phase?: string } } }
      | undefined;
    expect(verifyTransitionPayload?.ok).toBe(true);
    expect(verifyTransitionPayload?.task?.id).toBe(taskId);

    await cognitiveHandlers["cognitive.cognition.dream.run"]({
      params: { taskId },
      respond,
      context,
      req: {
        type: "req",
        id: "cognitive-dream-run-test",
        method: "cognitive.cognition.dream.run",
      },
    } as never);
    const dreamPayload = respond.mock.calls.at(-1)?.[1] as
      | { ok?: boolean; task?: { id?: string; status?: { phase?: string } } }
      | undefined;
    expect(dreamPayload?.ok).toBe(true);
    expect(dreamPayload?.task?.id).toBe(taskId);

    await cognitiveHandlers["cognitive.memory.write"]({
      params: {
        taskId,
        content: "Store reflection for lifecycle validation",
        category: "optimization_strategy",
        tags: ["lifecycle", "test"],
      },
      respond,
      context,
      req: { type: "req", id: "cognitive-memory-write-test", method: "cognitive.memory.write" },
    } as never);
    const writePayload = respond.mock.calls.at(-1)?.[1] as
      | { ok?: boolean; entry?: { taskId?: string; content?: string } }
      | undefined;
    expect(writePayload?.ok).toBe(true);
    expect(writePayload?.entry?.taskId).toBe(taskId);

    await cognitiveHandlers["cognitive.memory.query"]({
      params: { taskId, limit: 10 },
      respond,
      context,
      req: { type: "req", id: "cognitive-memory-query-test", method: "cognitive.memory.query" },
    } as never);
    const queryPayload = respond.mock.calls.at(-1)?.[1] as
      | { ok?: boolean; evolution?: Array<{ taskId: string }>; longTerm?: unknown[] }
      | undefined;
    expect(queryPayload?.ok).toBe(true);
    expect(Array.isArray(queryPayload?.evolution)).toBe(true);
    expect(Array.isArray(queryPayload?.longTerm)).toBe(true);
    expect(queryPayload?.evolution?.some((entry) => entry.taskId === taskId)).toBe(true);
  });
});
