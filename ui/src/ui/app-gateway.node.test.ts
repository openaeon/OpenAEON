import { beforeEach, describe, expect, it, vi } from "vitest";
import { GATEWAY_EVENT_UPDATE_AVAILABLE } from "../../../src/gateway/events.js";
import { connectGateway } from "./app-gateway.ts";

type GatewayClientMock = {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  emitClose: (info: {
    code: number;
    reason?: string;
    error?: { code: string; message: string; details?: unknown };
  }) => void;
  emitGap: (expected: number, received: number) => void;
  emitEvent: (evt: { event: string; payload?: unknown; seq?: number }) => void;
};

const gatewayClientInstances: GatewayClientMock[] = [];

vi.mock("./gateway.ts", () => {
  function resolveGatewayErrorDetailCode(
    error: { details?: unknown } | null | undefined,
  ): string | null {
    const details = error?.details;
    if (!details || typeof details !== "object") {
      return null;
    }
    const code = (details as { code?: unknown }).code;
    return typeof code === "string" ? code : null;
  }

  class GatewayBrowserClient {
    readonly start = vi.fn();
    readonly stop = vi.fn();

    constructor(
      private opts: {
        onClose?: (info: {
          code: number;
          reason: string;
          error?: { code: string; message: string; details?: unknown };
        }) => void;
        onGap?: (info: { expected: number; received: number }) => void;
        onEvent?: (evt: { event: string; payload?: unknown; seq?: number }) => void;
      },
    ) {
      gatewayClientInstances.push({
        start: this.start,
        stop: this.stop,
        emitClose: (info) => {
          this.opts.onClose?.({
            code: info.code,
            reason: info.reason ?? "",
            error: info.error,
          });
        },
        emitGap: (expected, received) => {
          this.opts.onGap?.({ expected, received });
        },
        emitEvent: (evt) => {
          this.opts.onEvent?.(evt);
        },
      });
    }
  }

  return { GatewayBrowserClient, resolveGatewayErrorDetailCode };
});

function createHost() {
  const handleSendChat = vi.fn(async () => {});
  return {
    settings: {
      gatewayUrl: "ws://127.0.0.1:18789",
      token: "",
      sessionKey: "main",
      lastActiveSessionKey: "main",
      theme: "system",
      chatFocusMode: false,
      chatShowThinking: true,
      splitRatio: 0.6,
      navCollapsed: false,
      navGroupsCollapsed: {},
    },
    password: "",
    clientInstanceId: "instance-test",
    client: null,
    connected: false,
    hello: null,
    lastError: null,
    lastErrorCode: null,
    eventLogBuffer: [],
    eventLog: [],
    tab: "overview",
    presenceEntries: [],
    presenceError: null,
    presenceStatus: null,
    agentsLoading: false,
    agentsList: null,
    agentsError: null,
    debugHealth: null,
    assistantName: "OPENAEON",
    assistantAvatar: null,
    assistantAgentId: null,
    sessionKey: "main",
    chatRunId: null,
    chatSending: false,
    chatStream: null,
    chatMessage: "",
    executionWatchdog: {
      active: false,
      degraded: false,
      reason: null,
      retryCount: 0,
      stagnantPolls: 0,
      startedAt: null,
      lastProgressAt: null,
      lastDigest: null,
      lastRetryAt: null,
    },
    executionAutoQueued: false,
    sandboxTaskPlan: null,
    sandboxChatEvents: {},
    handleSendChat,
    refreshSessionsAfterChat: new Set<string>(),
    execApprovalQueue: [],
    execApprovalError: null,
    updateAvailable: null,
  } as unknown as Parameters<typeof connectGateway>[0];
}

describe("connectGateway", () => {
  beforeEach(() => {
    gatewayClientInstances.length = 0;
  });

  it("ignores stale client onGap callbacks after reconnect", () => {
    const host = createHost();

    connectGateway(host);
    const firstClient = gatewayClientInstances[0];
    expect(firstClient).toBeDefined();

    connectGateway(host);
    const secondClient = gatewayClientInstances[1];
    expect(secondClient).toBeDefined();

    firstClient.emitGap(10, 13);
    expect(host.lastError).toBeNull();

    secondClient.emitGap(20, 24);
    expect(host.lastError).toBe(
      "event gap detected (expected seq 20, got 24); refresh recommended",
    );
  });

  it("ignores stale client onEvent callbacks after reconnect", () => {
    const host = createHost();

    connectGateway(host);
    const firstClient = gatewayClientInstances[0];
    expect(firstClient).toBeDefined();

    connectGateway(host);
    const secondClient = gatewayClientInstances[1];
    expect(secondClient).toBeDefined();

    firstClient.emitEvent({ event: "presence", payload: { presence: [{ host: "stale" }] } });
    expect(host.eventLogBuffer).toHaveLength(0);

    secondClient.emitEvent({ event: "presence", payload: { presence: [{ host: "active" }] } });
    expect(host.eventLogBuffer).toHaveLength(1);
    expect(host.eventLogBuffer[0]?.event).toBe("presence");
  });

  it("applies update.available only from active client", () => {
    const host = createHost();

    connectGateway(host);
    const firstClient = gatewayClientInstances[0];
    expect(firstClient).toBeDefined();

    connectGateway(host);
    const secondClient = gatewayClientInstances[1];
    expect(secondClient).toBeDefined();

    firstClient.emitEvent({
      event: GATEWAY_EVENT_UPDATE_AVAILABLE,
      payload: {
        updateAvailable: { currentVersion: "1.0.0", latestVersion: "9.9.9", channel: "latest" },
      },
    });
    expect(host.updateAvailable).toBeNull();

    secondClient.emitEvent({
      event: GATEWAY_EVENT_UPDATE_AVAILABLE,
      payload: {
        updateAvailable: { currentVersion: "1.0.0", latestVersion: "2.0.0", channel: "latest" },
      },
    });
    expect(host.updateAvailable).toEqual({
      currentVersion: "1.0.0",
      latestVersion: "2.0.0",
      channel: "latest",
    });
  });

  it("ignores stale client onClose callbacks after reconnect", () => {
    const host = createHost();

    connectGateway(host);
    const firstClient = gatewayClientInstances[0];
    expect(firstClient).toBeDefined();

    connectGateway(host);
    const secondClient = gatewayClientInstances[1];
    expect(secondClient).toBeDefined();

    firstClient.emitClose({ code: 1005 });
    expect(host.lastError).toBeNull();
    expect(host.lastErrorCode).toBeNull();

    secondClient.emitClose({ code: 1005 });
    expect(host.lastError).toBe("disconnected (1005): no reason");
    expect(host.lastErrorCode).toBeNull();
  });

  it("prefers structured connect errors over close reason", () => {
    const host = createHost();

    connectGateway(host);
    const client = gatewayClientInstances[0];
    expect(client).toBeDefined();

    client.emitClose({
      code: 4008,
      reason: "connect failed",
      error: {
        code: "INVALID_REQUEST",
        message:
          "unauthorized: gateway token mismatch (open the dashboard URL and paste the token in Control UI settings)",
        details: { code: "AUTH_TOKEN_MISMATCH" },
      },
    });

    expect(host.lastError).toContain("gateway token mismatch");
    expect(host.lastErrorCode).toBe("AUTH_TOKEN_MISMATCH");
  });

  it("handles task_plan.execution.recover for active session", () => {
    const host = createHost();
    host.sessionKey = "main";
    host.sandboxTaskPlan = {
      description: "plan",
      phase: "execution",
      todos: [{ id: "t1", title: "todo 1", status: "in_progress" }],
      executionGraph: {
        orderedTodoIds: ["t1"],
        readyTodoIds: [],
        blockedTodoIds: [],
        blockedBy: {},
      },
    };

    connectGateway(host);
    const client = gatewayClientInstances[0];
    expect(client).toBeDefined();

    client.emitEvent({
      event: "task_plan.execution.recover",
      payload: {
        sessionKey: "main",
        staleTodoIds: ["t1"],
        longRunningTodoIds: ["t1"],
        readyTodoIds: [],
        blockedTodoIds: [],
        advisories: ["stalled:t1"],
        prompt: "recover-now",
      },
    });

    expect(host.executionWatchdog.degraded).toBe(true);
    expect(host.executionWatchdog.reason).toBe("stalled:t1");
    expect(host.chatMessage).toBe("recover-now");
    expect(host.executionAutoQueued).toBe(false);
    expect(host.sandboxTaskPlan?.executionGraph?.staleTodoIds).toEqual(["t1"]);
    expect(host.handleSendChat as unknown as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1);
  });

  it("updates task runtime summary on task_plan.stage.changed", () => {
    const host = createHost();
    host.sessionKey = "main";
    host.sandboxTaskPlan = {
      description: "plan",
      phase: "execution",
      todos: [{ id: "t1", title: "todo 1", status: "in_progress" }],
      taskRuntime: {
        currentBranchId: "main",
        branchesCount: 1,
        checkpointsCount: 2,
        latestCheckpointId: "ckpt_old",
        latestCheckpointAt: 1,
        currentBranchHistoryCount: 2,
      },
      executionGraph: {
        orderedTodoIds: ["t1"],
        readyTodoIds: [],
        blockedTodoIds: [],
        blockedBy: {},
      },
    };

    connectGateway(host);
    const client = gatewayClientInstances[0];
    expect(client).toBeDefined();

    client.emitEvent({
      event: "task_plan.stage.changed",
      payload: {
        sessionKey: "main",
        action: "branch",
        changed: true,
        phaseTransition: { from: "planning", to: "execution", changed: true },
        currentBranchId: "exp-a",
        checkpointId: "ckpt_new",
        at: 123,
      },
    });

    expect(host.sandboxTaskPlan?.phase).toBe("execution");
    expect(host.sandboxTaskPlan?.taskRuntime).toEqual(
      expect.objectContaining({
        currentBranchId: "exp-a",
        checkpointsCount: 3,
        latestCheckpointId: "ckpt_new",
        latestCheckpointAt: 123,
      }),
    );
  });

  it("updates task runtime summary on task_plan.checkpoint.restored", () => {
    const host = createHost();
    host.sessionKey = "main";
    host.sandboxTaskPlan = {
      description: "plan",
      phase: "execution",
      todos: [{ id: "t1", title: "todo 1", status: "in_progress" }],
      taskRuntime: {
        currentBranchId: "main",
        branchesCount: 1,
        checkpointsCount: 2,
        latestCheckpointId: "ckpt_old",
        latestCheckpointAt: 1,
        currentBranchHistoryCount: 2,
      },
      executionGraph: {
        orderedTodoIds: ["t1"],
        readyTodoIds: [],
        blockedTodoIds: [],
        blockedBy: {},
      },
    };

    connectGateway(host);
    const client = gatewayClientInstances[0];
    expect(client).toBeDefined();

    client.emitEvent({
      event: "task_plan.checkpoint.restored",
      payload: {
        sessionKey: "main",
        checkpointId: "ckpt_restore",
        branchId: "exp-a",
        at: 456,
      },
    });

    expect(host.sandboxTaskPlan?.taskRuntime).toEqual(
      expect.objectContaining({
        currentBranchId: "exp-a",
        checkpointsCount: 3,
        latestCheckpointId: "ckpt_restore",
        latestCheckpointAt: 456,
      }),
    );
  });

  it("appends verifier and dream events into local task plan", () => {
    const host = createHost();
    host.sessionKey = "main";
    host.sandboxTaskPlan = {
      description: "plan",
      phase: "execution",
      todos: [{ id: "t1", title: "todo 1", status: "in_progress" }],
      taskRuntime: {
        currentBranchId: "main",
        branchesCount: 1,
        checkpointsCount: 2,
        latestCheckpointId: "ckpt_old",
        latestCheckpointAt: 1,
        currentBranchHistoryCount: 2,
      },
      executionGraph: {
        orderedTodoIds: ["t1"],
        readyTodoIds: [],
        blockedTodoIds: [],
        blockedBy: {},
      },
      verifierHistory: [],
      dreams: [],
    };
    connectGateway(host);
    const client = gatewayClientInstances[0];
    expect(client).toBeDefined();
    client.emitEvent({
      event: "task_plan.verifier.result",
      payload: {
        sessionKey: "main",
        verifier: {
          verifierId: "verify_1",
          taskId: "main",
          stageId: "execution",
          branchId: "main",
          status: "passed",
          summary: "checks passed",
          evidence: [],
          createdAt: 111,
        },
      },
    });
    client.emitEvent({
      event: "task_plan.dream.created",
      payload: {
        sessionKey: "main",
        dream: {
          dreamId: "dream_1",
          taskId: "main",
          stageId: "execution",
          branchId: "main",
          summary: "execution distilled",
          keyDecisions: [],
          risks: [],
          nextAction: "continue",
          anchors: [],
          sourceCheckpointIds: [],
          createdAt: 222,
        },
      },
    });
    expect(host.sandboxTaskPlan?.verifierHistory?.[0]).toEqual(
      expect.objectContaining({
        verifierId: "verify_1",
        status: "passed",
      }),
    );
    expect(host.sandboxTaskPlan?.dreams?.[0]).toEqual(
      expect.objectContaining({
        dreamId: "dream_1",
      }),
    );
  });
});
