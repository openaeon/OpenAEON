import { Type } from "@sinclair/typebox";
import type { ChannelAgentTool } from "openaeon/plugin-sdk";
import { jsonResult, readStringParam } from "openaeon/plugin-sdk";

export function createWeixinActionsTool(): ChannelAgentTool {
  return {
    label: "Weixin Actions",
    name: "weixin",
    description: "Perform WeChat-specific actions like searching contacts or fetching profiles.",
    parameters: Type.Object({
      action: Type.Unsafe<"listContacts" | "getProfile" | "searchMessages">({
        type: "string",
        enum: ["listContacts", "getProfile", "searchMessages"],
      }),
      query: Type.Optional(Type.String({ description: "Search query for contacts or messages." })),
      userId: Type.Optional(Type.String({ description: "WeChat user ID to fetch profile for." })),
    }),
    execute: async (_toolCallId, args) => {
      const action = readStringParam(args as Record<string, unknown>, "action", { required: true });

      switch (action) {
        case "listContacts":
          // The current iLink Bot API does not provide a direct method to list all contacts.
          // In bot mode, contacts are typically discovered as they message the bot.
          return jsonResult({
            ok: true,
            message: "The current Weixin Bot API does not support proactive contact listing. Contacts are discovered via incoming messages.",
            contacts: [],
          });

        case "getProfile": {
          const userId = readStringParam(args as Record<string, unknown>, "userId");
          if (!userId) {
            throw new Error("userId is required for getProfile action.");
          }
          // The current iLink Bot API does not provide a direct method to fetch user profiles.
          return jsonResult({
            ok: true,
            message: `Profile fetching for ${userId} is not currently supported by the Weixin Bot API.`,
            profile: { id: userId },
          });
        }

        case "searchMessages":
          return jsonResult({
            ok: true,
            message: "Message searching is not currently supported by the Weixin Bot API.",
            results: [],
          });

        default:
          throw new Error(`Unknown Weixin action: ${action}`);
      }
    },
  };
}
