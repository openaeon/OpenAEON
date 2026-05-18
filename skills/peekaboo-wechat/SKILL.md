---
name: peekaboo-wechat
description: Automate WeChat on macOS strictly using the native 'wechat' agent tool. Never fallback to raw Peekaboo CLI commands or individual keyboard simulations.
homepage: https://peekaboo.boo
metadata:
  {
    "openaeon":
      {
        "emoji": "💬",
        "os": ["darwin"],
        "requires": { "bins": ["peekaboo"] },
        "install":
          [
            {
              "id": "brew",
              "kind": "brew",
              "formula": "steipete/tap/peekaboo",
              "bins": ["peekaboo"],
              "label": "Install Peekaboo (brew)",
            },
          ],
      },
  }
allowed-tools: wechat
---

# WeChat Automation Skill (Strictly via Native 'wechat' Tool)

This skill provides the playbook to automate the macOS WeChat desktop client ("微信" or "WeChat") strictly using the native `wechat` agent tool. Custom keyboard simulation loops and raw CLI fallbacks are disabled to prevent state drift and focus issues.

---

> [!IMPORTANT]
> **Strict Tool Enforcement**: You must **never** fall back to raw Peekaboo CLI commands (`peekaboo type`, `peekaboo hotkey`, etc.) or custom bash scripts. Always use the native `wechat` agent tool actions (`list_chats`, `read_messages`, `send_text`, `send_file`). The native tool encapsulates secure focus, robust relative coordinates mapping, and verification loops.

---

## ⚡ Primary Workflow: Native 'wechat' Agent Tool

Always prioritize using the native `wechat` agent tool. It encapsulates all window focusing, search selection, coordinate clustering, and typing sequences into a single atomic call, preventing timing drift and keyboard focus errors.

### 1. List Recent Chats & Scan Unread Messages

Retrieve the list of recent active conversations along with their localized times, last message previews, and active unread badge counts:

```json
wechat({ "action": "list_chats" })
```

### 2. Read Chat Log Chronologically

Focus the target contact or group conversation, locate the message panel, and parse the last 50 messages in correct order (automatically marks self vs sender):

```json
wechat({ "action": "read_messages", "contact": "OpenClaw 3群" })
```

### 3. Send a Text Message

Search and select the target contact/group chat, focus the input field, type the text securely, and press Return:

```json
wechat({
  "action": "send_text",
  "contact": "OpenClaw 3群",
  "text": "您好，这是由 OpenAEON 智能体发送的原子化测试消息。"
})
```

### 4. Send an Image or File

Search and select the target contact/group chat, load the specified local file path to clipboard, focus the message input field, paste (Cmd+V), and submit:

```json
wechat({
  "action": "send_file",
  "contact": "OpenClaw 3群",
  "filePath": "/Users/opnclaw/Documents/GitHub/OpenAEON/artifacts/wechat_ui_analysis.md"
})
```

---

## 📐 Deep UI Architecture & Bounding Box Logic

To prevent selection drift and ensure robust execution across varied resolutions, aspect ratios, multi-monitor setups, and high-DPI retina displays, the underlying `wechat` tool adheres to relative coordinates mapped dynamically from the WeChat main window.

### 1. Root WeChat Window Geometry

- **Window Identifier (`elem_0` or `AXWindow`)**: Typically represents the master WeChat container spanning `997 x 827` pixels (or similar bounding boxes).
- **Dynamic Origin Bounds**:
  - `windowX`: The absolute horizontal start coordinate of the window (e.g. `1324` on shifted secondary displays).
  - `windowY`: The absolute vertical start coordinate of the window (e.g. `136`).

### 2. Relative Control Map

All sub-panels and control components are indexed dynamically relative to the window origin:

| Control Component            | Property Identifier / Role         | X Coordinate Bound (Relative) | Y Coordinate Bound (Relative)       |
| :--------------------------- | :--------------------------------- | :---------------------------- | :---------------------------------- |
| **Recent Chats Sidebar**     | `AXStaticText` inside sidebar      | `x < windowX + 320`           | `y > windowY + 80`                  |
| **Search Input Box**         | `AXTextField`, title `"搜索"`      | `x ≈ windowX + 100`           | `y ≈ windowY + 23`                  |
| **Active Chat Title Header** | `current_chat_name_label`          | `x > windowX + 277`           | `y < windowY + 100`                 |
| **Chat Message Viewport**    | `AXStaticText` pane elements       | `x > windowX + 300`           | `windowY + 200 < y < windowY + 700` |
| **Self Message Bubble**      | `AXStaticText` on far right        | `x > windowX + 600`           | Chronological sort order            |
| **Chat Input Area**          | `chat_input_field` (`AXTextField`) | `x > windowX + 277`           | `y > windowY + 625`                 |

### 3. Coordinate Normalization Rule

When parsing a raw Peekaboo accessibility tree (`snapshot.json`), `frame` arrays are formatted as nested double arrays `[[x, y], [w, h]]`. The engine normalizes them into standard geometric objects:

```typescript
let frame = el.frame;
if (Array.isArray(frame)) {
  frame = {
    x: frame[0]?.[0] || 0,
    y: frame[0]?.[1] || 0,
    width: frame[1]?.[0] || 0,
    height: frame[1]?.[1] || 0,
  };
}
```

This dynamic, relative structural layout is the core mechanism that keeps all typing, clicking, and scraping operations perfectly aligned inside WeChat.
