import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCommandWithTimeout } from "../process/exec.js";
import { resolveOPENAEONPackageRootSync } from "./openaeon-root.js";

export type WeChatContact = {
  name: string;
  elementId?: string;
  unreadCount?: number;
  lastMessage?: string;
  time?: string;
};

export type WeChatChatMessage = {
  sender: string;
  content: string;
  time?: string;
  isSelf: boolean;
};

/**
 * Advanced WeChat UI Automation engine.
 * Directly maps the macOS Accessibility tree (AXUIElement / AppKit) of WeChat
 * to support robust unread scanning, contact selection, chronological chat log parsing,
 * toolbar button clicks, and clipboard-based file/image sharing.
 */
export class PeekabooWeChatHelper {
  private static cachedAppName: string | null = null;

  /**
   * Dynamically resolves the active localized name of the WeChat client ("微信" or "WeChat").
   */
  public static async getWeChatAppName(): Promise<string> {
    if (this.cachedAppName) return this.cachedAppName;
    try {
      const apps = await this.runPeekaboo(["app", "list", "--json"]);
      const list = apps && Array.isArray(apps.elements) ? apps.elements : [];
      const wechat = list.find(
        (app: any) =>
          app.bundleId === "com.tencent.xinWeChat" || app.name === "微信" || app.name === "WeChat",
      );
      if (wechat && wechat.name) {
        this.cachedAppName = wechat.name;
        return wechat.name;
      }
    } catch {
      // Ignore errors and default
    }
    return "微信";
  }

  /**
   * Resolves the embedded Peekaboo binary path in the project code layer.
   */
  private static getBinaryPath(): string {
    const localBin = path.join(
      resolveOPENAEONPackageRootSync({ cwd: process.cwd() }) || process.cwd(),
      "bin",
      "peekaboo",
    );
    return fs.existsSync(localBin) ? localBin : "peekaboo";
  }

  /**
   * Helper to execute the local Peekaboo binary.
   */
  public static async runPeekaboo(argv: string[], timeoutMs = 30000): Promise<any> {
    const bin = this.getBinaryPath();
    const socketPath = path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "OpenAEON",
      "bridge.sock",
    );
    const extraArgs: string[] = [];
    if (fs.existsSync(socketPath)) {
      extraArgs.push("--bridge-socket", socketPath);
    }
    const result = await runCommandWithTimeout([bin, ...extraArgs, ...argv], { timeoutMs });
    if (result.code !== 0) {
      throw new Error(`Peekaboo WeChat action failed: ${result.stderr || result.stdout}`);
    }
    const stdout = result.stdout.trim();
    if (!stdout) return {};
    try {
      const parsed = JSON.parse(stdout);
      // Unpack raw snapshot tree if it's a "see" response with a snapshot file path in ui_map,
      // providing all raw AppKit AXUIElement node details (types, frames/coordinates, nesting)
      if (parsed && parsed.success && parsed.data && typeof parsed.data.ui_map === "string") {
        const snapshotPath = parsed.data.ui_map;
        if (fs.existsSync(snapshotPath)) {
          try {
            const rawTree = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
            return rawTree;
          } catch {
            // Fallback to parsed if file reading failed (e.g. permission limits in sandbox)
          }
        }
      }
      return parsed;
    } catch {
      return { raw: stdout };
    }
  }

  /**
   * Checks if the WeChat process is currently running on macOS.
   */
  public static async isWeChatRunning(): Promise<boolean> {
    try {
      const apps = await this.runPeekaboo(["app", "list", "--json"]);
      const list = apps && Array.isArray(apps.elements) ? apps.elements : [];
      return list.some(
        (app: any) =>
          app.name === "WeChat" ||
          app.name === "微信" ||
          app.bundleId === "com.tencent.xinWeChat" ||
          (app.path && app.path.includes("WeChat.app")),
      );
    } catch {
      // Fallback
    }
    return false;
  }

  /**
   * Launches and focuses the macOS WeChat desktop client.
   * If not running, launches it and waits for it to load.
   */
  public static async focusWeChat(): Promise<void> {
    const running = await this.isWeChatRunning();
    if (!running) {
      try {
        // Launch via bundle-id (completely localized-name immune)
        await this.runPeekaboo(["app", "launch", "--bundle-id", "com.tencent.xinWeChat", "--json"]);
        // Give WeChat a few seconds to load
        await new Promise((resolve) => setTimeout(resolve, 3000));
      } catch {
        try {
          // Fallback: positional app launch
          await this.runPeekaboo(["app", "launch", "微信", "--json"]);
          await new Promise((resolve) => setTimeout(resolve, 3000));
        } catch {
          // Ignore launch errors if we are going to try to focus anyway
        }
      }
    }

    // Focus using both "微信" and "WeChat" to handle any system language
    try {
      await this.runPeekaboo(["window", "focus", "--app", "微信", "--json"]);
    } catch {
      try {
        await this.runPeekaboo(["window", "focus", "--app", "WeChat", "--json"]);
      } catch {
        // Fallback: try switching to the app directly using app switch!
        try {
          await this.runPeekaboo(["app", "switch", "--to", "微信", "--json"]);
        } catch {
          try {
            await this.runPeekaboo(["app", "switch", "--to", "WeChat", "--json"]);
          } catch {
            // Fallback: ignore focus errors if we are already focused
          }
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  /**
   * Normalizes elements to support both raw accessibility tree objects (from snapshot.json)
   * and simplified AI-friendly elements (from binary CLI output).
   */
  private static normalizeElement(el: any): any {
    if (!el) return el;

    let type = el.type || el.role_description || el.role || "";
    if (type === "文本" || (type === "other" && el.role_description === "文本")) {
      type = "AXStaticText";
    } else if (
      type === "文本输入区" ||
      type === "textField" ||
      type === "AXTextArea" ||
      type === "AXTextView"
    ) {
      type = "AXTextArea";
    } else if (type === "按钮" || type === "button" || type === "AXButton") {
      type = "AXButton";
    }

    const value =
      el.value !== undefined ? el.value : el.label !== undefined ? el.label : el.title || "";

    return {
      ...el,
      type,
      value: typeof value === "string" ? value.trim() : "",
    };
  }

  /**
   * Helper to find elements recursively in the UI tree.
   * Handles both flat elements list and nested tree elements hierarchies.
   */
  private static findElements(root: any, predicate: (el: any) => boolean): any[] {
    const results: any[] = [];
    if (!root) return results;

    // Check if flat elements or data
    const flatList = root.ui_elements || root.data?.ui_elements || root.elements;
    if (Array.isArray(flatList)) {
      for (const rawEl of flatList) {
        const el = this.normalizeElement(rawEl);
        if (predicate(el)) results.push(el);
        if (Array.isArray(rawEl.children)) {
          results.push(...this.findElements(rawEl, predicate));
        }
      }
      return results;
    }

    const normRoot = this.normalizeElement(root);
    if (predicate(normRoot)) {
      results.push(normRoot);
    }

    if (Array.isArray(root.children)) {
      for (const child of root.children) {
        results.push(...this.findElements(child, predicate));
      }
    }

    return results;
  }

  /**
   * Polls the macOS Dock badge for WeChat unread notifications.
   */
  public static async readDockBadge(): Promise<number> {
    const res = await this.runPeekaboo(["dock", "list", "--json"]);
    if (Array.isArray(res)) {
      const wechat = res.find(
        (item: any) => item.name === "WeChat" || item.bundleId === "com.tencent.xinWeChat",
      );
      if (wechat && typeof wechat.badge === "string") {
        return parseInt(wechat.badge, 10) || 0;
      }
    }
    return 0;
  }

  /**
   * Scans the WeChat Sidebar/Chat List for unread indicators, red dots, or unread badges.
   */
  public static async scanSidebarUnread(): Promise<WeChatContact[]> {
    await this.focusWeChat();
    const appName = await this.getWeChatAppName();
    const ui = await this.runPeekaboo(["see", "--app", appName, "--json"]);
    const unreadContacts: WeChatContact[] = [];

    // Find all static texts that display "条" or unread message formats in Chinese/English
    const unreadBadges = this.findElements(
      ui,
      (el) => el.type === "AXStaticText" && (el.value || "").match(/^\d+条$|^\[\d+条\]$|^unread$/i),
    );

    for (const badge of unreadBadges) {
      // Find the adjacent contact row or cell
      // WeChat normally exposes rows where the contact name, unread count, and last message are children of the same parent row.
      const badgeId = badge.id;
      // We can locate the parent container or look at surrounding elements.
      // Usually, in a list item, we have elements inside a group.
      let contactName = "未知联系人";
      let count = 1;

      if (badge.value) {
        count = parseInt(badge.value.replace(/\D/g, ""), 10) || 1;
      }

      // Fallback search: look for elements with similar bounding boxes (sidebar is normally on the left, x < 350)
      if (badge.frame) {
        const { x, y } = badge.frame;
        // Search for contact name elements located in the same horizontal row (y difference < 25)
        const rowTexts = this.findElements(
          ui,
          (el) =>
            el.type === "AXStaticText" &&
            el.frame &&
            Math.abs(el.frame.y - y) < 20 &&
            el.frame.x < x &&
            el.value !== badge.value,
        );
        if (rowTexts.length > 0) {
          // Typically the first item in the row is the contact name
          contactName = rowTexts[0].value;
        }
      }

      unreadContacts.push({
        name: contactName,
        elementId: badgeId,
        unreadCount: count,
      });
    }

    return unreadContacts;
  }

  /**
   * Scans the WeChat Sidebar and returns all recent chats in the active list,
   * including contact names, last message preview, last message time, and unread counts.
   * Employs vertical coordinate clustering and column sorting for language-independent parsing.
   */
  public static async getRecentChats(): Promise<WeChatContact[]> {
    await this.focusWeChat();
    const appName = await this.getWeChatAppName();
    const ui = await this.runPeekaboo(["see", "--app", appName, "--json"]);
    const contacts: WeChatContact[] = [];
    if (!ui) return contacts;

    // 1. Gather all AXStaticText elements located in the sidebar (x < 320)
    // We ignore top header elements like "搜索" or "WeChat" (y < 80)
    const sidebarTexts = this.findElements(
      ui,
      (el) =>
        el.type === "AXStaticText" && el.value && el.frame && el.frame.x < 320 && el.frame.y > 80,
    );

    // 2. Group these texts by vertical overlap/Y-coordinate.
    // If multiple texts are in the same sidebar row, their Y differences are usually very small (e.g. dy < 40).
    const sortedTexts = [...sidebarTexts].sort((a, b) => a.frame.y - b.frame.y);
    const rows: any[][] = [];
    let currentRow: any[] = [];

    for (const text of sortedTexts) {
      if (currentRow.length === 0) {
        currentRow.push(text);
      } else {
        const lastInRow = currentRow[currentRow.length - 1];
        if (Math.abs(text.frame.y - lastInRow.frame.y) < 38) {
          currentRow.push(text);
        } else {
          rows.push(currentRow);
          currentRow = [text];
        }
      }
    }
    if (currentRow.length > 0) {
      rows.push(currentRow);
    }

    // 3. Parse each row group into a WeChatContact object
    for (const row of rows) {
      let name = "";
      let time = "";
      let lastMessage = "";
      let unreadCount = 0;
      let elementId = "";

      // Filter out unread badges first (e.g., "2条", "[2条]" or bare digits)
      const badgeElem = row.find((el) => (el.value || "").match(/^\d+条$|^\[\d+条\]$|^\d+$/));
      if (badgeElem) {
        unreadCount = parseInt(badgeElem.value.replace(/\D/g, ""), 10) || 1;
        elementId = badgeElem.id;
      }

      // Remaining elements
      const mainElems = row.filter((el) => el !== badgeElem);
      if (mainElems.length > 0) {
        const sortedByY = [...mainElems].sort((a, b) => a.frame.y - b.frame.y);
        const topElements = sortedByY.filter(
          (el) => Math.abs(el.frame.y - sortedByY[0].frame.y) < 12,
        );
        const nameElem = topElements.reduce(
          (prev, curr) => (prev.frame.x < curr.frame.x ? prev : curr),
          topElements[0],
        );
        name = nameElem?.value || "";
        if (!elementId) elementId = nameElem?.id;

        if (topElements.length > 1) {
          const timeElem = topElements.find((el) => el !== nameElem);
          time = timeElem?.value || "";
        }

        const bottomElements = sortedByY.filter((el) => !topElements.includes(el));
        if (bottomElements.length > 0) {
          lastMessage = bottomElements.map((el) => el.value).join(" ");
        }
      }

      if (name && name !== "搜索" && name.length < 35) {
        contacts.push({
          name,
          elementId,
          unreadCount,
          lastMessage,
          time,
        });
      }
    }

    return contacts;
  }

  /**
   * Selects a WeChat contact or group chat.
   * Smart check: checks if we are already in the target chat before typing to search.
   */
  public static async selectContact(name: string): Promise<void> {
    await this.focusWeChat();
    const appName = await this.getWeChatAppName();
    const ui = await this.runPeekaboo(["see", "--app", appName, "--json"]);

    // 1. Check if the active window title matches the target contact name, or the active chat header is already correct
    const headerTexts = this.findElements(
      ui,
      (el) =>
        el.type === "AXStaticText" &&
        el.frame &&
        el.frame.y < 100 && // Header bar is at the top
        el.value &&
        (el.value.startsWith(name) || el.value.includes(name)),
    );

    if (headerTexts.length > 0) {
      // Already in the target chat, skip searching!
      return;
    }

    // 2. Try to find the contact directly in the visible sidebar recent chats list
    try {
      const sidebarContacts = await this.getRecentChats();
      const existing = sidebarContacts.find(
        (c) => c.name.startsWith(name) || name.startsWith(c.name) || c.name.includes(name),
      );
      if (existing && existing.elementId) {
        // Click on the sidebar item directly!
        await this.runPeekaboo(["click", "--on", existing.elementId, "--app", appName, "--json"]);
        await new Promise((resolve) => setTimeout(resolve, 500));
        return;
      }
    } catch {
      // Fallback if recent chats scanning failed
    }

    // 3. Trigger search field focus via shortcut (Cmd + F)
    await this.runPeekaboo(["hotkey", "cmd,f", "--app", appName, "--json"]);
    await new Promise((resolve) => setTimeout(resolve, 200));

    // 4. Type contact name
    await this.runPeekaboo(["type", name, "--app", appName, "--json"]);
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Give it enough time to filter

    // 5. Look for matching search result in UI elements to click it directly
    try {
      const searchUi = await this.runPeekaboo(["see", "--app", appName, "--json"]);

      // Parse section headers in the search results list to do coordinate-based region matching
      const headers = this.findElements(searchUi, (el) => {
        if (el.type !== "AXStaticText" || !el.value) return false;
        const val = el.value.trim();
        return [
          "搜索网络结果",
          "Web Search Results",
          "群聊",
          "Group Chats",
          "联系人",
          "Contacts",
          "最常使用",
          "Most Frequently Used",
          "聊天记录",
          "Chat History",
          "最近在搜",
          "Recent Searches",
        ].includes(val);
      });
      const sortedHeaders = [...headers].sort((a, b) => a.frame.y - b.frame.y);

      const candidates = this.findElements(searchUi, (el) => {
        if (el.type !== "AXStaticText" || !el.value || !el.frame) return false;
        const val = el.value.trim();

        // Filter out elements too high up (likely the search input or header buttons)
        if (el.frame.y < 110) return false;

        // Must match the target contact or group name
        if (
          !(
            val.startsWith(name) ||
            val.includes(name) ||
            name.startsWith(val) ||
            name.includes(val)
          )
        ) {
          return false;
        }

        // Exclude system search labels/headers themselves
        if (
          [
            "搜索",
            "搜索网络结果",
            "Web Search Results",
            "群聊",
            "Group Chats",
            "联系人",
            "Contacts",
            "最常使用",
            "Most Frequently Used",
            "聊天记录",
            "Chat History",
            "最近在搜",
            "Recent Searches",
          ].includes(val)
        ) {
          return false;
        }

        return true;
      });

      const candidatesWithSection = candidates.map((cand) => {
        const y = cand.frame.y;
        // Find the header immediately above this candidate
        let activeHeader = "未知";
        for (let i = sortedHeaders.length - 1; i >= 0; i--) {
          if (sortedHeaders[i].frame.y < y) {
            activeHeader = sortedHeaders[i].value;
            break;
          }
        }
        return { element: cand, section: activeHeader };
      });

      const isLocalSection = (sec: string) => {
        const val = sec.trim();
        return [
          "群聊",
          "Group Chats",
          "联系人",
          "Contacts",
          "最常使用",
          "Most Frequently Used",
        ].includes(val);
      };
      const isWebSearchSection = (sec: string) => {
        const val = sec.trim();
        return ["搜索网络结果", "Web Search Results"].includes(val);
      };

      const localCandidates = candidatesWithSection.filter((c) => isLocalSection(c.section));
      const fallbackCandidates = candidatesWithSection.filter(
        (c) => !isWebSearchSection(c.section) && !isLocalSection(c.section),
      );

      const bestCandidate = localCandidates[0] || fallbackCandidates[0];
      if (bestCandidate && bestCandidate.element.id) {
        console.log(
          `[selectContact] Clicking best candidate "${bestCandidate.element.value}" in section "${bestCandidate.section}"`,
        );
        await this.runPeekaboo([
          "click",
          "--on",
          bestCandidate.element.id,
          "--app",
          appName,
          "--json",
        ]);
        await new Promise((resolve) => setTimeout(resolve, 600));
      } else {
        // Fallback to keyboard selection fallback (Press Down ONCE to select first item, then Return)
        console.log(
          `[selectContact] No distinct candidate element ID found, falling back to keyboard search navigation`,
        );
        await this.runPeekaboo(["press", "down", "--count", "1", "--json"]);
        await new Promise((resolve) => setTimeout(resolve, 300));
        await this.runPeekaboo(["press", "return", "--json"]);
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    } catch (err) {
      console.error("[selectContact] Error during UI element search:", err);
      // Fallback to keyboard simulation if UI inspection failed
      console.log(
        `[selectContact] Exception encountered during see/click, falling back to keyboard search navigation`,
      );
      await this.runPeekaboo(["press", "down", "--count", "1", "--json"]);
      await new Promise((resolve) => setTimeout(resolve, 300));
      await this.runPeekaboo(["press", "return", "--json"]);
      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    // 6. Post-selection verification loop
    let verified = false;
    let currentHeader = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      const verifyUi = await this.runPeekaboo(["see", "--app", appName, "--json"]);
      const activeHeaders = this.findElements(
        verifyUi,
        (el) =>
          el.type === "AXStaticText" &&
          el.frame &&
          el.frame.y < 100 &&
          el.value &&
          el.value.trim().length > 0,
      );
      if (activeHeaders.length > 0) {
        currentHeader = activeHeaders[0].value.trim();
        if (
          currentHeader.startsWith(name) ||
          currentHeader.includes(name) ||
          name.startsWith(currentHeader) ||
          name.includes(currentHeader)
        ) {
          verified = true;
          console.log(
            `[selectContact] Verification SUCCESS! Active chat header matches target "${name}" (Current header: "${currentHeader}")`,
          );
          break;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }

    if (!verified) {
      const errorMsg = `Failed to select and verify target chat "${name}". Active chat header is "${currentHeader || "unknown"}", which does not match target.`;
      console.error(`[selectContact] ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  /**
   * Parses the active chat scrollable container and returns chronological text messages.
   * Associates message bubbles with the correct sender names and timestamps.
   */
  public static async getChatMessages(): Promise<WeChatChatMessage[]> {
    await this.focusWeChat();
    const appName = await this.getWeChatAppName();
    const ui = await this.runPeekaboo(["see", "--app", appName, "--json"]);
    const messages: WeChatChatMessage[] = [];

    if (!ui) return messages;

    // WeChat message bubbles are represented in scrollable lists/cells.
    // Usually, in the messages scroll pane, elements have specific positions.
    // Let's gather all texts in the conversation pane (typically x > 350 on standard sizes).
    const texts = this.findElements(
      ui,
      (el) => el.type === "AXStaticText" && el.value && el.frame && el.frame.x > 300, // Chat pane lies on the right
    );

    // Group elements by vertical position (Y coordinate) or chronological layout.
    // In macOS Accessibility, elements are returned in a specific order (often reading order).
    // Let's filter out headers and timestamps, parsing sender names and message contents.
    // We sort texts by their Y coordinate to reconstruct chronological layout if needed.
    const sortedTexts = [...texts].sort((a, b) => a.frame.y - b.frame.y);

    let currentSender = "";
    let currentTime = "";

    for (let i = 0; i < sortedTexts.length; i++) {
      const el = sortedTexts[i];
      const val = el.value.trim();

      // Check if it's a timestamp (e.g. "昨天 21:57", "22:08", "12:27")
      if (val.match(/^\d{2}:\d{2}$|^昨天 \d{2}:\d{2}$|^星期. \d{2}:\d{2}$/)) {
        currentTime = val;
        continue;
      }

      // In WeChat, message cells consist of: Avatar (AXButton) -> Sender Name (AXStaticText) -> Message Body (AXStaticText/AXButton)
      // Usually, the sender name is a short string, and is followed immediately by the message bubble at a slightly larger Y.
      // If we find an element corresponding to a sender name:
      // Senders are usually on the left of the message bubble (x around 350-400 for others, x around 700+ for self).
      const isSelf = el.frame.x > 600; // Self messages are positioned on the far right of the screen

      // If this element looks like a message bubble:
      // It is often larger, and self messages don't print the name "Self" next to them in the AX tree,
      // they just have the bubble content. Others print the sender name above the bubble.
      if (isSelf) {
        messages.push({
          sender: "我",
          content: val,
          time: currentTime,
          isSelf: true,
        });
      } else {
        // If it's another person's message:
        // We look ahead to check if the next item is part of the same cell.
        // Or if this element is the sender name and the next one is the content.
        // A simple heuristic: if a text is short (< 15 chars) and is immediately followed by another text
        // within a small Y distance (dy < 40) at a slightly offset X, the first is the sender and the second is the content.
        const nextEl = sortedTexts[i + 1];
        if (nextEl && Math.abs(nextEl.frame.y - el.frame.y) < 35 && el.value.length < 20) {
          currentSender = el.value;
          messages.push({
            sender: currentSender,
            content: nextEl.value,
            time: currentTime,
            isSelf: false,
          });
          i++; // Skip the next element as it was consumed as the content
        } else {
          // Standalone text, could be a system message or a fallback bubble representation
          messages.push({
            sender: currentSender || "系统/其他",
            content: val,
            time: currentTime,
            isSelf: false,
          });
        }
      }
    }

    return messages;
  }

  /**
   * Clicks a specific toolbar button inside WeChat (表情, 发送文件, 截图).
   */
  public static async clickToolbarButton(
    buttonName: "emoji" | "file" | "screenshot" | "voice",
  ): Promise<void> {
    await this.focusWeChat();
    const appName = await this.getWeChatAppName();
    const ui = await this.runPeekaboo(["see", "--app", appName, "--json"]);

    let buttonTitle = "";
    if (buttonName === "emoji") buttonTitle = "表情";
    else if (buttonName === "file") buttonTitle = "发送文件";
    else if (buttonName === "screenshot") buttonTitle = "截图";
    else if (buttonName === "voice") buttonTitle = "语音";

    const buttons = this.findElements(
      ui,
      (el) =>
        el.type === "AXButton" &&
        ((el.title || "").includes(buttonTitle) ||
          (el.description || "").includes(buttonTitle) ||
          (el.identifier || "").toLowerCase().includes(buttonName)),
    );

    if (buttons.length > 0) {
      await this.runPeekaboo(["click", "--on", buttons[0].id, "--app", appName, "--json"]);
    } else {
      // Fallback relative coordinates for the bottom input toolbar:
      // Emoji is usually in the left part of toolbar, File is next to it, etc.
      let relativeCoords = "0.38,0.73"; // Fallback emoji
      if (buttonName === "file") relativeCoords = "0.41,0.73";
      else if (buttonName === "screenshot") relativeCoords = "0.44,0.73";
      else if (buttonName === "voice") relativeCoords = "0.47,0.73";

      await this.runPeekaboo(["click", "--coords", relativeCoords, "--app", appName, "--json"]);
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  /**
   * Sends a text message to the currently active conversation.
   */
  public static async sendTextMessage(message: string): Promise<void> {
    await this.focusWeChat();
    const appName = await this.getWeChatAppName();

    // 1. Locate message input field
    const ui = await this.runPeekaboo(["see", "--app", appName, "--json"]);
    const inputArea = this.findElements(
      ui,
      (el) =>
        el.type === "AXTextArea" ||
        el.type === "XCUIElementTypeTextView" ||
        (el.identifier && el.identifier.toLowerCase().includes("input")),
    );

    if (inputArea.length > 0) {
      await this.runPeekaboo(["click", "--on", inputArea[0].id, "--app", appName, "--json"]);
    } else {
      // Fallback: Click on the bottom input region coordinates
      await this.runPeekaboo(["click", "--coords", "0.5,0.85", "--app", appName, "--json"]);
    }
    await new Promise((resolve) => setTimeout(resolve, 200));

    // 2. Type message text natively
    await this.runPeekaboo(["type", message, "--app", appName, "--json"]);
    await new Promise((resolve) => setTimeout(resolve, 200));

    // 3. Press return to send
    await this.runPeekaboo(["press", "return", "--json"]);
  }

  /**
   * Sends a local file or image securely via the clipboard paste strategy.
   * Incredibly robust and bypasses system dialog constraints.
   */
  public static async sendFile(filePath: string): Promise<void> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    await this.focusWeChat();
    const appName = await this.getWeChatAppName();

    // 1. Write the file path to clipboard
    await this.runPeekaboo(["clipboard", "write", "--file", filePath, "--json"]);
    await new Promise((resolve) => setTimeout(resolve, 200));

    // 2. Focus input area by coordinates
    await this.runPeekaboo(["click", "--coords", "0.5,0.85", "--app", appName, "--json"]);
    await new Promise((resolve) => setTimeout(resolve, 200));

    // 3. Paste (Cmd + V) and Return to send
    await this.runPeekaboo(["hotkey", "cmd,v", "--json"]);
    await new Promise((resolve) => setTimeout(resolve, 600));
    await this.runPeekaboo(["press", "return", "--json"]);
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}
