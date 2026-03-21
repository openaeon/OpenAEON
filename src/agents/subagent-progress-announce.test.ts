import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks ---

const agentSpy = vi.fn<(req: unknown) => Promise<{ runId: string; status: string }>>(
  async () => ({ runId: "run-requester", status: "ok" }),
);
const progressAnnounceSpy = vi.fn().mockResolvedValue(true);

vi.mock("../gateway/call.js", () => ({
  callGateway: vi.fn(async (req: unknown) => {
    const payload = req as { method?: string };
    if (payload.method === "agent") return await agentSpy(req);
    return {};
  }),
}));

const subagentRegistryMock = {
  resolveRequesterForChildSession: vi.fn(),
  loadSubagentRun: vi.fn(),
};

vi.mock("./subagent-registry.js", () => subagentRegistryMock);

vi.mock("./subagent-announce.js", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    runSubagentProgressAnnounceFlow: progressAnnounceSpy,
  };
});

// Mock dependencies of handleMessageUpdate
vi.mock("./pi-embedded-utils.js", () => ({
  extractAssistantText: vi.fn(() => ""),
  extractAssistantThinking: vi.fn(() => ""),
  extractThinkingFromTaggedStream: vi.fn(() => ""),
  extractThinkingFromTaggedText: vi.fn(() => ""),
  formatReasoningMessage: vi.fn(() => ({})),
  promoteThinkingTagsToBlocks: vi.fn(),
}));

vi.mock("../infra/agent-events.js", () => ({
  emitAgentEvent: vi.fn(),
}));

vi.mock("./pi-embedded-subscribe.raw-stream.js", () => ({
  appendRawStream: vi.fn(),
}));

vi.mock("../auto-reply/reply/reply-directives.js", () => ({
  parseReplyDirectives: vi.fn((t) => ({ text: t })),
}));

vi.mock("../markdown/code-spans.js", () => ({
  createInlineCodeState: vi.fn(() => ({})),
}));

function createMockCtx(overrides: any = {}) {
  const state: any = {
    deltaBuffer: "",
    lastAnnouncedProgress: undefined,
    partialBlockState: { thinking: false, final: false, inlineCode: {} },
    shouldEmitPartialReplies: true,
    lastStreamedAssistantCleaned: undefined,
    emittedAssistantUpdate: false,
    blockReplyBreak: "message_end",
    streamReasoning: false,
    reasoningStreamOpen: false,
  };
  if (overrides.state) {
    Object.assign(state, overrides.state);
  }
  return {
    params: {
      runId: "run-1",
      session: { id: "session-1" },
      onAgentEvent: vi.fn(),
    },
    state,
    emitReasoningStream: vi.fn(),
    noteLastAssistant: vi.fn(),
    stripBlockTags: vi.fn((t, s) => t),
    consumePartialReplyDirectives: vi.fn((t) => ({ text: t })),
    recordAssistantUsage: vi.fn(),
    flushBlockReplyBuffer: vi.fn(),
    ...overrides,
  };
}

describe("Subagent Progress Monitoring", () => {
  describe("runSubagentProgressAnnounceFlow (Delivery Logic)", () => {
    let runSubagentProgressAnnounceFlow: any;

    beforeEach(async () => {
      const mod = await vi.importActual<any>("./subagent-announce.js");
      runSubagentProgressAnnounceFlow = mod.runSubagentProgressAnnounceFlow;
      agentSpy.mockClear();
      subagentRegistryMock.resolveRequesterForChildSession.mockReset();
      subagentRegistryMock.loadSubagentRun.mockReset();
    });

    it("successfully delivers progress update to requester", async () => {
      subagentRegistryMock.resolveRequesterForChildSession.mockReturnValue({
        requesterSessionKey: "agent:main:main",
      });
      subagentRegistryMock.loadSubagentRun.mockReturnValue({ label: "worker task" });

      const success = await runSubagentProgressAnnounceFlow({
        childSessionKey: "agent:main:subagent:test",
        runId: "worker-run",
        progress: "Processing step 4...",
      });

      expect(success).toBe(true);
      expect(agentSpy).toHaveBeenCalledTimes(1);
      const [call] = agentSpy.mock.calls[0] ?? [];
      expect(call).toBeDefined();
      const payload = call as {
        params: {
          sessionKey: string;
          message: string;
          internalEvents: Array<{ type: string; progress?: string }>;
        };
      };
      expect(payload.params.sessionKey).toBe("agent:main:main");
      expect(payload.params.message).toContain("Processing step 4...");
      expect(payload.params.internalEvents[0].type).toBe("task_progress");
      expect(payload.params.internalEvents[0].progress).toBe("Processing step 4...");
    });
  });

  describe("handleMessageUpdate (Progress Detection Integration)", () => {
    let handleMessageUpdate: any;

    beforeEach(async () => {
      const mod = await import("./pi-embedded-subscribe.handlers.messages.js");
      handleMessageUpdate = mod.handleMessageUpdate;
      progressAnnounceSpy.mockClear();
    });

    it("triggers announcement when <execution_progress> tag is completed", async () => {
      const ctx = createMockCtx();
      const delta =
        "Thinking... <execution_progress>Found 5 files</execution_progress> continuing.";
      ctx.state.deltaBuffer = delta;

      await handleMessageUpdate(ctx, {
        type: "message_update",
        message: { role: "assistant" },
        assistantMessageEvent: { type: "text_delta", delta },
      });

      expect(progressAnnounceSpy).toHaveBeenCalledWith({
        childSessionKey: "session-1",
        runId: "run-1",
        progress: "Found 5 files",
      });
      expect(ctx.state.lastAnnouncedProgress).toBe("Found 5 files");
    });

    it("triggers announcement on partial tags (trailing)", async () => {
      const ctx = createMockCtx();
      const delta = "Some text <execution_progress>Starting work";
      ctx.state.deltaBuffer = delta;

      await handleMessageUpdate(ctx, {
        type: "message_update",
        message: { role: "assistant" },
        assistantMessageEvent: { type: "text_delta", delta },
      });

      expect(progressAnnounceSpy).toHaveBeenCalledWith({
        childSessionKey: "session-1",
        runId: "run-1",
        progress: "Starting work",
      });
      expect(ctx.state.lastAnnouncedProgress).toBe("Starting work");
    });

    it("does not re-announce duplicate progress", async () => {
      const ctx = createMockCtx();
      ctx.state.lastAnnouncedProgress = "Sent previously";
      const delta = "<execution_progress>Sent previously</execution_progress>";
      ctx.state.deltaBuffer = delta;

      await handleMessageUpdate(ctx, {
        type: "message_update",
        message: { role: "assistant" },
        assistantMessageEvent: { type: "text_delta", delta },
      });

      expect(progressAnnounceSpy).not.toHaveBeenCalled();
    });
  });
});
