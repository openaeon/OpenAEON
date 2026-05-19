import { render } from "lit";
import { describe, expect, it, vi } from "vitest";
import type { SessionsListResult } from "../types.ts";
import { renderChat, type ChatProps } from "./chat.ts";

function createSessions(): SessionsListResult {
  return {
    ts: 0,
    path: "",
    count: 0,
    defaults: { model: null, contextTokens: null },
    sessions: [],
  };
}

function createProps(overrides: Partial<ChatProps> = {}): ChatProps {
  return {
    sessionKey: "main",
    onSessionKeyChange: () => undefined,
    thinkingLevel: null,
    showThinking: false,
    loading: false,
    sending: false,
    canAbort: false,
    compactionStatus: null,
    fallbackStatus: null,
    messages: [],
    toolMessages: [],
    stream: null,
    streamStartedAt: null,
    assistantAvatarUrl: null,
    draft: "",
    queue: [],
    connected: true,
    canSend: true,
    disabledReason: null,
    error: null,
    sessions: createSessions(),
    focusMode: false,
    assistantName: "OPENAEON",
    assistantAvatar: null,
    onRefresh: () => undefined,
    onToggleFocusMode: () => undefined,
    onDraftChange: () => undefined,
    onSend: () => undefined,
    onQueueRemove: () => undefined,
    onNewSession: () => undefined,
    chaosScore: 0,
    epiphanyFactor: 0,
    riskScore: 0,
    memorySaturation: 0,
    ...overrides,
  };
}

function getChatShadow(container: HTMLElement) {
  const layout = container.querySelector("chat-layout") as
    | ({ shadowRoot: ShadowRoot | null; renderRoot?: ShadowRoot } & Element)
    | null;
  return layout?.renderRoot ?? layout?.shadowRoot ?? null;
}

async function getChatShadowAsync(container: HTMLElement) {
  for (let i = 0; i < 50; i++) {
    const shadow = getChatShadow(container);
    if (shadow) {
      return shadow;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return null;
}

describe("chat view", () => {
  it("defaults to the empty page state", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    render(renderChat(createProps()), container);

    const section = (await getChatShadowAsync(container))?.querySelector(".chat");
    expect(section?.getAttribute("data-page-state")).toBe("empty");
  });

  it("uses the chatting page state when history exists", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    render(
      renderChat(
        createProps({
          messages: [{ role: "assistant", content: "hello", timestamp: 1 }],
        }),
      ),
      container,
    );

    const section = (await getChatShadowAsync(container))?.querySelector(".chat");
    expect(section?.getAttribute("data-page-state")).toBe("chatting");
  });

  it("uses the executing page state while sending", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    render(
      renderChat(
        createProps({
          sending: true,
          stream: "streaming...",
          streamStartedAt: Date.now(),
        }),
      ),
      container,
    );

    const section = (await getChatShadowAsync(container))?.querySelector(".chat");
    expect(section?.getAttribute("data-page-state")).toBe("executing");
  });

  it("uses the recovery page state when watchdog is degraded", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    render(
      renderChat(
        createProps({
          executionWatchdog: {
            active: true,
            degraded: true,
            reason: "No progress detected",
            retryCount: 2,
          },
        }),
      ),
      container,
    );

    const section = (await getChatShadowAsync(container))?.querySelector(".chat");
    expect(section?.getAttribute("data-page-state")).toBe("recovery");
  });

  it("shows the Cognitive Runtime dock by default", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    render(
      renderChat(
        createProps({
          cognitivePlan: {
            phase: "execution",
            todos: [{ id: "todo-1", title: "Task 1", status: "todo" }],
            executionGraph: {
              blockedBy: {},
              readyTodoIds: [],
              blockedTodoIds: [],
              staleTodoIds: [],
              longRunningTodoIds: [],
            },
          } as unknown as NonNullable<ChatProps["cognitivePlan"]>,
          sidebarDefault: "collapsed",
        }),
      ),
      container,
    );

    const shadow = await getChatShadowAsync(container);
    const sidebar = shadow?.querySelector(".chat-sidebar");
    expect(sidebar).not.toBeNull();
    expect(shadow?.textContent).toContain("Cognitive Runtime");
    expect(shadow?.textContent).toContain("Parallel Agent Orchestration");
  });

  it("uses professional visual mode by default", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    render(renderChat(createProps()), container);

    const section = (await getChatShadowAsync(container))?.querySelector(".chat");
    expect(section?.getAttribute("data-visual-mode")).toBe("professional");
  });

  it("supports legacy visual mode override", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    render(
      renderChat(
        createProps({
          visualMode: "legacy",
        }),
      ),
      container,
    );

    const section = (await getChatShadowAsync(container))?.querySelector(".chat");
    expect(section?.getAttribute("data-visual-mode")).toBe("legacy");
  });

  it("supports compact visual density override", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    render(
      renderChat(
        createProps({
          visualDensity: "compact",
        }),
      ),
      container,
    );

    const section = (await getChatShadowAsync(container))?.querySelector(".chat");
    expect(section?.getAttribute("data-visual-density")).toBe("compact");
  });

  it("keeps the agent orchestration dock visible for legacy last-state preference", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    render(
      renderChat(
        createProps({
          cognitivePlan: {
            phase: "execution",
            todos: [{ id: "todo-1", title: "Task 1", status: "todo" }],
            executionGraph: {
              blockedBy: {},
              readyTodoIds: [],
              blockedTodoIds: [],
              staleTodoIds: [],
              longRunningTodoIds: [],
            },
          } as unknown as NonNullable<ChatProps["cognitivePlan"]>,
          sidebarDefault: "last-state",
        }),
      ),
      container,
    );

    const shadow = await getChatShadowAsync(container);
    const sidebar = shadow?.querySelector(".chat-sidebar");
    expect(sidebar).not.toBeNull();
    expect(shadow?.textContent).toContain("Parallel Agent Orchestration");
    expect(shadow?.textContent).toContain("Agent");
    expect(shadow?.textContent).toContain("Task 1");
  });

  it("shows Cognitive memory traces in the runtime dock", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    render(
      renderChat(
        createProps({
          cognitivePlan: {
            phase: "execution",
            todos: [{ id: "todo-1", title: "Task 1", status: "todo" }],
            memoryTrace: {
              longTermSources: [
                { source: "Memory Match", path: "src/trace.ts:30-32", score: 0.91 },
              ],
              evolutionStrategyHits: [],
            },
            executionGraph: {
              blockedBy: {},
              readyTodoIds: [],
              blockedTodoIds: [],
              staleTodoIds: [],
              longRunningTodoIds: [],
            },
          } as unknown as NonNullable<ChatProps["cognitivePlan"]>,
          sidebarDefault: "last-state",
        }),
      ),
      container,
    );

    const shadow = await getChatShadowAsync(container);
    const memoryTab = Array.from(shadow?.querySelectorAll(".sidebar-tab") ?? []).find((tab) =>
      tab.textContent?.trim().includes("Memory"),
    ) as HTMLElement | undefined;
    memoryTab?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const text = shadow?.textContent ?? "";
    expect(text).toContain("Memory Trace");
    expect(text).toContain("Memory Match");
    expect(text).toContain("src/trace.ts:30-32");
  });

  it("renders compacting indicator as a badge", () => {
    const container = document.createElement("div");
    render(
      renderChat(
        createProps({
          compactionStatus: {
            active: true,
            startedAt: Date.now(),
            completedAt: null,
          },
        }),
      ),
      container,
    );

    const indicator = container.querySelector(".compaction-indicator--active");
    expect(indicator).not.toBeNull();
    expect(indicator?.textContent).toContain("Compacting context...");
  });

  it("renders completion indicator shortly after compaction", () => {
    const container = document.createElement("div");
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_000);
    render(
      renderChat(
        createProps({
          compactionStatus: {
            active: false,
            startedAt: 900,
            completedAt: 900,
          },
        }),
      ),
      container,
    );

    const indicator = container.querySelector(".compaction-indicator--complete");
    expect(indicator).not.toBeNull();
    expect(indicator?.textContent).toContain("Context compacted");
    nowSpy.mockRestore();
  });

  it("hides stale compaction completion indicator", () => {
    const container = document.createElement("div");
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(10_000);
    render(
      renderChat(
        createProps({
          compactionStatus: {
            active: false,
            startedAt: 0,
            completedAt: 0,
          },
        }),
      ),
      container,
    );

    expect(container.querySelector(".compaction-indicator")).toBeNull();
    nowSpy.mockRestore();
  });

  it("renders fallback indicator shortly after fallback event", () => {
    const container = document.createElement("div");
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_000);
    render(
      renderChat(
        createProps({
          fallbackStatus: {
            selected: "fireworks/minimax-m2p5",
            active: "deepinfra/moonshotai/Kimi-K2.5",
            attempts: ["fireworks/minimax-m2p5: rate limit"],
            occurredAt: 900,
          },
        }),
      ),
      container,
    );

    const indicator = container.querySelector(".compaction-indicator--fallback");
    expect(indicator).not.toBeNull();
    expect(indicator?.textContent).toContain("Fallback active: deepinfra/moonshotai/Kimi-K2.5");
    nowSpy.mockRestore();
  });

  it("hides stale fallback indicator", () => {
    const container = document.createElement("div");
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(20_000);
    render(
      renderChat(
        createProps({
          fallbackStatus: {
            selected: "fireworks/minimax-m2p5",
            active: "deepinfra/moonshotai/Kimi-K2.5",
            attempts: [],
            occurredAt: 0,
          },
        }),
      ),
      container,
    );

    expect(container.querySelector(".compaction-indicator--fallback")).toBeNull();
    nowSpy.mockRestore();
  });

  it("renders fallback-cleared indicator shortly after transition", () => {
    const container = document.createElement("div");
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_000);
    render(
      renderChat(
        createProps({
          fallbackStatus: {
            phase: "cleared",
            selected: "fireworks/minimax-m2p5",
            active: "fireworks/minimax-m2p5",
            previous: "deepinfra/moonshotai/Kimi-K2.5",
            attempts: [],
            occurredAt: 900,
          },
        }),
      ),
      container,
    );

    const indicator = container.querySelector(".compaction-indicator--fallback-cleared");
    expect(indicator).not.toBeNull();
    expect(indicator?.textContent).toContain("Fallback cleared: fireworks/minimax-m2p5");
    nowSpy.mockRestore();
  });

  it("renders parallel controls and handles dispatch actions in subagent sidebar", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const onAutopilotMaxConcurrentChange = vi.fn();
    const onAutopilotDispatchNow = vi.fn();
    render(
      renderChat(
        createProps({
          cognitivePlan: {
            phase: "execution",
            todos: [{ id: "todo-1", title: "Task 1", status: "in_progress" }],
            executionGraph: {
              blockedBy: {},
              readyTodoIds: ["todo-2", "todo-3"],
              blockedTodoIds: [],
              staleTodoIds: [],
              longRunningTodoIds: [],
              autoDispatch: {
                enabled: true,
                queueDepth: 2,
                runningCount: 1,
                maxConcurrent: 4,
              },
            },
          } as unknown as NonNullable<ChatProps["cognitivePlan"]>,
          sidebarDefault: "last-state",
          autopilotEnabled: true,
          onAutopilotMaxConcurrentChange,
          onAutopilotDispatchNow,
        }),
      ),
      container,
    );

    const shadow = await getChatShadowAsync(container);
    const tasksTab = Array.from(shadow?.querySelectorAll(".sidebar-tab") ?? []).find((tab) =>
      tab.textContent?.trim().includes("Tasks"),
    ) as HTMLElement | undefined;
    tasksTab?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(shadow?.textContent).toContain("Dispatch Now");

    const preset = Array.from(shadow?.querySelectorAll("button") ?? []).find((btn) =>
      btn.textContent?.trim().includes("3x"),
    );
    expect(preset).not.toBeUndefined();
    preset?.click();
    expect(onAutopilotMaxConcurrentChange).toHaveBeenCalledWith(3);

    const dispatch = Array.from(shadow?.querySelectorAll("button") ?? []).find((btn) =>
      btn.textContent?.trim().includes("Dispatch Now"),
    );
    expect(dispatch).not.toBeUndefined();
    dispatch?.click();
    expect(onAutopilotDispatchNow).toHaveBeenCalledTimes(1);
  });

  it("shows a stop button when aborting is available", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const onAbort = vi.fn();
    render(
      renderChat(
        createProps({
          canAbort: true,
          onAbort,
        }),
      ),
      container,
    );

    const shadow = await getChatShadowAsync(container);
    const input = shadow?.querySelector("chat-input-area");
    expect(input).toBeDefined();
    input?.dispatchEvent(new CustomEvent("abort", { bubbles: true, composed: true }));
    expect(onAbort).toHaveBeenCalledTimes(1);
  });

  it("sends the draft with the selected composer mode", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const onSend = vi.fn();
    render(
      renderChat(
        createProps({
          draft: "ship the runtime dock",
          onSend,
        }),
      ),
      container,
    );

    const shadow = await getChatShadowAsync(container);
    const input = shadow?.querySelector("chat-input-area") as
      | ({
          renderRoot?: ShadowRoot;
          shadowRoot: ShadowRoot | null;
          updateComplete?: Promise<boolean>;
        } & Element)
      | null;
    await input?.updateComplete;
    const inputRoot = input?.renderRoot ?? input?.shadowRoot;
    const taskButton = Array.from(inputRoot?.querySelectorAll("button") ?? []).find((button) =>
      button.textContent?.includes("Task"),
    );
    taskButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    await input?.updateComplete;
    const submitButton = Array.from(inputRoot?.querySelectorAll("button") ?? []).find((button) =>
      button.textContent?.includes("Submit Task"),
    );
    submitButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));

    expect(onSend).toHaveBeenCalledWith("ship the runtime dock", { mode: "task" });
  });

  it("exposes agent delegation as a first-class composer mode", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const onSend = vi.fn();
    render(
      renderChat(
        createProps({
          draft: "audit the failing runtime path",
          onSend,
        }),
      ),
      container,
    );

    const shadow = await getChatShadowAsync(container);
    const input = shadow?.querySelector("chat-input-area") as
      | ({
          renderRoot?: ShadowRoot;
          shadowRoot: ShadowRoot | null;
          updateComplete?: Promise<boolean>;
        } & Element)
      | null;
    await input?.updateComplete;
    const inputRoot = input?.renderRoot ?? input?.shadowRoot;
    const agentButton = Array.from(inputRoot?.querySelectorAll("button") ?? []).find((button) =>
      button.textContent?.includes("Agent"),
    );
    agentButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    await input?.updateComplete;
    const delegateButton = Array.from(inputRoot?.querySelectorAll("button") ?? []).find((button) =>
      button.textContent?.includes("Delegate Agent"),
    );
    delegateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));

    expect(onSend).toHaveBeenCalledWith("audit the failing runtime path", { mode: "agent" });
  });

  it("shows a new session button when aborting is unavailable", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const onNewSession = vi.fn();
    render(
      renderChat(
        createProps({
          canAbort: false,
          onNewSession,
        }),
      ),
      container,
    );

    const shadow = await getChatShadowAsync(container);
    const input = shadow?.querySelector("chat-input-area");
    expect(input).toBeDefined();
    input?.dispatchEvent(new CustomEvent("new-session", { bubbles: true, composed: true }));
    expect(onNewSession).toHaveBeenCalledTimes(1);
  });
});
