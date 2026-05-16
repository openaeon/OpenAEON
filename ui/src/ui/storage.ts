const KEY = "openaeon.control.settings.v2";

import { isSupportedLocale } from "../i18n/index.ts";
import { inferBasePathFromPathname, normalizeBasePath } from "./navigation.ts";
import type { ThemeMode } from "./theme.ts";
import type { Tab } from "./navigation.ts";

export type UiSettings = {
  gatewayUrl: string;
  token: string;
  sessionKey: string;
  lastActiveSessionKey: string;
  theme: ThemeMode;
  chatFocusMode: boolean;
  chatShowThinking: boolean;
  splitRatio: number; // Sidebar split ratio (0.4 to 0.7, default 0.6)
  navCollapsed: boolean; // Collapsible sidebar state
  navGroupsCollapsed: Record<string, boolean>; // Which nav groups are collapsed
  locale?: string;
  chatWebSearchEnabled?: boolean;
  chatAutopilotEnabled?: boolean;
  chatAutopilotMaxConcurrent?: number;
  chatVisualDensity?: "comfortable" | "compact";
  chatSidebarDefault?: "collapsed" | "last-state";
  chatVisualMode?: "professional" | "legacy";
  aeonEternalMode?: boolean;
  lastTab?: Tab;
};

export function loadSettings(): UiSettings {
  const defaultUrl = (() => {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const configured =
      typeof window !== "undefined" &&
      typeof window.__OPENAEON_CONTROL_UI_BASE_PATH__ === "string" &&
      window.__OPENAEON_CONTROL_UI_BASE_PATH__.trim();
    const basePath = configured
      ? normalizeBasePath(configured)
      : inferBasePathFromPathname(location.pathname);
    return `${proto}://${location.host}${basePath}`;
  })();

  const defaults: UiSettings = {
    gatewayUrl: defaultUrl,
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
    chatAutopilotMaxConcurrent: 2,
    chatVisualDensity: "comfortable",
    chatSidebarDefault: "collapsed",
    chatVisualMode: "professional",
    aeonEternalMode: false,
    lastTab: "chat",
  };

  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      return defaults;
    }
    const parsed = JSON.parse(raw) as Partial<UiSettings>;
    return {
      gatewayUrl:
        typeof parsed.gatewayUrl === "string" && parsed.gatewayUrl.trim()
          ? parsed.gatewayUrl.trim()
          : defaults.gatewayUrl,
      token: typeof parsed.token === "string" ? parsed.token : defaults.token,
      sessionKey:
        typeof parsed.sessionKey === "string" && parsed.sessionKey.trim()
          ? parsed.sessionKey.trim()
          : defaults.sessionKey,
      lastActiveSessionKey:
        typeof parsed.lastActiveSessionKey === "string" && parsed.lastActiveSessionKey.trim()
          ? parsed.lastActiveSessionKey.trim()
          : (typeof parsed.sessionKey === "string" && parsed.sessionKey.trim()) ||
            defaults.lastActiveSessionKey,
      theme:
        parsed.theme === "light" || parsed.theme === "dark" || parsed.theme === "system"
          ? parsed.theme
          : defaults.theme,
      chatFocusMode:
        typeof parsed.chatFocusMode === "boolean" ? parsed.chatFocusMode : defaults.chatFocusMode,
      chatShowThinking:
        typeof parsed.chatShowThinking === "boolean"
          ? parsed.chatShowThinking
          : defaults.chatShowThinking,
      splitRatio:
        typeof parsed.splitRatio === "number" &&
        parsed.splitRatio >= 0.4 &&
        parsed.splitRatio <= 0.7
          ? parsed.splitRatio
          : defaults.splitRatio,
      navCollapsed:
        typeof parsed.navCollapsed === "boolean" ? parsed.navCollapsed : defaults.navCollapsed,
      navGroupsCollapsed:
        typeof parsed.navGroupsCollapsed === "object" && parsed.navGroupsCollapsed !== null
          ? parsed.navGroupsCollapsed
          : defaults.navGroupsCollapsed,
      chatWebSearchEnabled:
        typeof parsed.chatWebSearchEnabled === "boolean"
          ? parsed.chatWebSearchEnabled
          : defaults.chatWebSearchEnabled,
      chatAutopilotEnabled:
        typeof parsed.chatAutopilotEnabled === "boolean"
          ? parsed.chatAutopilotEnabled
          : defaults.chatAutopilotEnabled,
      chatAutopilotMaxConcurrent:
        typeof parsed.chatAutopilotMaxConcurrent === "number" &&
        Number.isFinite(parsed.chatAutopilotMaxConcurrent)
          ? Math.max(1, Math.min(8, Math.floor(parsed.chatAutopilotMaxConcurrent)))
          : defaults.chatAutopilotMaxConcurrent,
      chatVisualDensity:
        parsed.chatVisualDensity === "comfortable" || parsed.chatVisualDensity === "compact"
          ? parsed.chatVisualDensity
          : defaults.chatVisualDensity,
      chatSidebarDefault:
        parsed.chatSidebarDefault === "collapsed" || parsed.chatSidebarDefault === "last-state"
          ? parsed.chatSidebarDefault
          : defaults.chatSidebarDefault,
      chatVisualMode:
        parsed.chatVisualMode === "professional" || parsed.chatVisualMode === "legacy"
          ? parsed.chatVisualMode
          : defaults.chatVisualMode,
      aeonEternalMode:
        typeof parsed.aeonEternalMode === "boolean"
          ? parsed.aeonEternalMode
          : defaults.aeonEternalMode,
      locale: isSupportedLocale(parsed.locale) ? parsed.locale : undefined,
      lastTab:
        parsed.lastTab === "agents" ||
        parsed.lastTab === "overview" ||
        parsed.lastTab === "channels" ||
        parsed.lastTab === "instances" ||
        parsed.lastTab === "sessions" ||
        parsed.lastTab === "usage" ||
        parsed.lastTab === "cron" ||
        parsed.lastTab === "skills" ||
        parsed.lastTab === "nodes" ||
        parsed.lastTab === "chat" ||
        parsed.lastTab === "config" ||
        parsed.lastTab === "debug" ||
        parsed.lastTab === "sandbox" ||
        parsed.lastTab === "logs" ||
        parsed.lastTab === "aeon"
          ? parsed.lastTab
          : defaults.lastTab,
    };
  } catch {
    return defaults;
  }
}

export function saveSettings(next: UiSettings) {
  localStorage.setItem(KEY, JSON.stringify(next));
}
