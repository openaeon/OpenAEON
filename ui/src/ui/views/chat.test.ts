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

  it("keeps advanced workbench collapsed by default", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    render(
      renderChat(
        createProps({
          taskPlan: {
            phase: "execution",
            todos: [{ id: "todo-1", title: "Task 1", status: "todo" }],
            executionGraph: {
              blockedBy: {},
              readyTodoIds: [],
              blockedTodoIds: [],
              staleTodoIds: [],
              longRunningTodoIds: [],
            },
          } as unknown as NonNullable<ChatProps["taskPlan"]>,
          sidebarDefault: "collapsed",
        }),
      ),
      container,
    );

    const shadow = await getChatShadowAsync(container);
    const sidebar = shadow?.querySelector(".chat-sidebar");
    expect(sidebar).toBeNull();

    const showWorkbenchButton = Array.from(shadow?.querySelectorAll("button") ?? []).find((btn) =>
      btn.textContent?.includes("Show workbench"),
    );
    expect(showWorkbenchButton).not.toBeUndefined();
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

  it("opens advanced workbench by default when sidebarDefault is last-state", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    render(
      renderChat(
        createProps({
          taskPlan: {
            phase: "execution",
            todos: [{ id: "todo-1", title: "Task 1", status: "todo" }],
            executionGraph: {
              blockedBy: {},
              readyTodoIds: [],
              blockedTodoIds: [],
              staleTodoIds: [],
              longRunningTodoIds: [],
            },
          } as unknown as NonNullable<ChatProps["taskPlan"]>,
          sidebarDefault: "last-state",
        }),
      ),
      container,
    );

    const shadow = await getChatShadowAsync(container);
    const sidebar = shadow?.querySelector(".chat-sidebar");
    expect(sidebar).not.toBeNull();
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
