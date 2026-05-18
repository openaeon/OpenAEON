import { Type } from "@sinclair/typebox";
import { PeekabooWeChatHelper } from "../../infra/peekaboo-wechat-helper.js";
import type { AnyAgentTool } from "./common.js";
import { readStringParam } from "./common.js";

const WeChatToolSchema = Type.Object({
  action: Type.String({
    description:
      "The WeChat action to perform: 'send_text', 'send_file', 'read_messages', or 'list_chats'.",
  }),
  contact: Type.Optional(
    Type.String({
      description:
        "Target contact name or group chat name. Required for 'send_text', 'send_file', and 'read_messages'.",
    }),
  ),
  text: Type.Optional(
    Type.String({
      description: "The text message content to send. Required for 'send_text'.",
    }),
  ),
  filePath: Type.Optional(
    Type.String({
      description: "Absolute path of the local file/image to send. Required for 'send_file'.",
    }),
  ),
});

export function createWeChatTool(): AnyAgentTool {
  return {
    label: "WeChat Automation",
    name: "wechat",
    ownerOnly: true,
    description: [
      "Control and inspect the local macOS WeChat client atomically.",
      "Supports: send_text (send message), send_file (paste and share document/image),",
      "read_messages (get recent chronological messages), and list_chats (scan recent contacts list and unread count).",
    ].join(" "),
    parameters: WeChatToolSchema,
    execute: async (_toolCallId, args) => {
      const params = (args ?? {}) as Record<string, unknown>;
      const action = readStringParam(params, "action", { required: true });

      if (action === "send_text") {
        const contact = readStringParam(params, "contact", { required: true });
        const text = readStringParam(params, "text", { required: true });

        await PeekabooWeChatHelper.selectContact(contact);
        await PeekabooWeChatHelper.sendTextMessage(text);

        return {
          content: [
            {
              type: "text",
              text: `✅ Successfully sent text message to "${contact}": "${text}"`,
            },
          ],
          details: { action, contact, text },
        };
      }

      if (action === "send_file") {
        const contact = readStringParam(params, "contact", { required: true });
        const filePath = readStringParam(params, "filePath", { required: true });

        await PeekabooWeChatHelper.selectContact(contact);
        await PeekabooWeChatHelper.sendFile(filePath);

        return {
          content: [
            {
              type: "text",
              text: `✅ Successfully sent file/image "${filePath}" to "${contact}"`,
            },
          ],
          details: { action, contact, filePath },
        };
      }

      if (action === "read_messages") {
        const contact = readStringParam(params, "contact", { required: true });

        await PeekabooWeChatHelper.selectContact(contact);
        const messages = await PeekabooWeChatHelper.getChatMessages();

        const formatted = messages
          .map((msg) => {
            const speaker = msg.isSelf ? "我" : msg.sender;
            const timeStr = msg.time ? ` [${msg.time}]` : "";
            return `${speaker}${timeStr}: ${msg.content}`;
          })
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: formatted || `No recent messages found in chat with "${contact}".`,
            },
          ],
          details: { action, contact, messageCount: messages.length },
        };
      }

      if (action === "list_chats") {
        const chats = await PeekabooWeChatHelper.getRecentChats();

        const formatted = chats
          .map((chat) => {
            const badgeStr =
              chat.unreadCount && chat.unreadCount > 0 ? ` [● ${chat.unreadCount} Unread]` : "";
            const timeStr = chat.time ? ` (${chat.time})` : "";
            const msgStr = chat.lastMessage ? ` - Last: "${chat.lastMessage}"` : "";
            return `* ${chat.name}${badgeStr}${timeStr}${msgStr}`;
          })
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: formatted || "No recent chats found in the sidebar list.",
            },
          ],
          details: { action, chatCount: chats.length },
        };
      }

      throw new Error(`Unsupported WeChat action: "${action}"`);
    },
  };
}
