import { page } from "vitest/browser";
import { describe, expect, it } from "vitest";
import { mountApp, registerAppMountHooks } from "../test-helpers/app-mount.ts";

registerAppMountHooks();

type ChatVisualSettings = {
  chatVisualMode?: "professional" | "legacy";
  chatVisualDensity?: "comfortable" | "compact";
  chatSidebarDefault?: "collapsed" | "last-state";
};

function seedUiSettings(overrides: ChatVisualSettings = {}) {
  localStorage.setItem(
    "openaeon.control.settings.v2",
    JSON.stringify({
      gatewayUrl: "ws://localhost:18789",
      token: "",
      sessionKey: "main",
      lastActiveSessionKey: "main",
      theme: "dark",
      chatFocusMode: false,
      chatShowThinking: true,
      splitRatio: 0.6,
      navCollapsed: false,
      navGroupsCollapsed: {},
      chatWebSearchEnabled: true,
      chatAutopilotEnabled: true,
      chatVisualMode: "professional",
      chatVisualDensity: "comfortable",
      chatSidebarDefault: "collapsed",
      aeonEternalMode: false,
      lastTab: "chat",
      ...overrides,
    }),
  );
}

async function settleApp() {
  for (let i = 0; i < 6; i++) {
    await Promise.resolve();
  }
}

describe("chat visual baselines", () => {
  it("captures professional comfortable empty state", async () => {
    seedUiSettings({ chatVisualMode: "professional", chatVisualDensity: "comfortable" });
    const app = mountApp("/chat");
    await app.updateComplete;
    await settleApp();

    const path = await page.screenshot({
      path: "__screenshots__/chat-visual.browser.test.ts/chat-visual-professional-comfortable-empty-1.png",
    });
    expect(path).toContain("chat-visual-professional-comfortable-empty-1.png");
  });

  it("captures legacy comfortable empty state", async () => {
    seedUiSettings({ chatVisualMode: "legacy", chatVisualDensity: "comfortable" });
    const app = mountApp("/chat");
    await app.updateComplete;
    await settleApp();

    const path = await page.screenshot({
      path: "__screenshots__/chat-visual.browser.test.ts/chat-visual-legacy-comfortable-empty-1.png",
    });
    expect(path).toContain("chat-visual-legacy-comfortable-empty-1.png");
  });

  it("captures professional compact executing state", async () => {
    seedUiSettings({ chatVisualMode: "professional", chatVisualDensity: "compact" });
    const app = mountApp("/chat");
    await app.updateComplete;
    app.chatSending = true;
    app.chatStream = "Streaming visual baseline";
    app.chatStreamStartedAt = Date.now();
    app.chatMessages = [
      { role: "user", content: "Generate compact mode sample", timestamp: Date.now() - 1000 },
    ];
    await app.updateComplete;
    await settleApp();

    const path = await page.screenshot({
      path: "__screenshots__/chat-visual.browser.test.ts/chat-visual-professional-compact-executing-1.png",
    });
    expect(path).toContain("chat-visual-professional-compact-executing-1.png");
  });

  it("captures professional compact recovery state", async () => {
    seedUiSettings({ chatVisualMode: "professional", chatVisualDensity: "compact" });
    const app = mountApp("/chat");
    await app.updateComplete;
    app.executionWatchdog = {
      ...app.executionWatchdog,
      active: true,
      degraded: true,
      reason: "No progress detected",
      retryCount: 2,
    };
    app.chatMessages = [{ role: "assistant", content: "Watchdog degraded snapshot", timestamp: 1 }];
    await app.updateComplete;
    await settleApp();

    const path = await page.screenshot({
      path: "__screenshots__/chat-visual.browser.test.ts/chat-visual-professional-compact-recovery-1.png",
    });
    expect(path).toContain("chat-visual-professional-compact-recovery-1.png");
  });
});
