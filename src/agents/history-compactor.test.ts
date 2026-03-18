import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { describe, expect, it } from "vitest";
import { compressHistory } from "./history-compactor.js";

describe("compressHistory", () => {
  it("emits compressed assistant summaries as content blocks", () => {
    const messages: AgentMessage[] = [
      { role: "user", content: "start" } as AgentMessage,
      {
        role: "assistant",
        content: [{ type: "text", text: "working..." }],
      } as AgentMessage,
      {
        role: "toolResult",
        toolCallId: "call-1",
        toolName: "tool-a",
        content: [{ type: "text", text: "ok" }],
        timestamp: Date.now(),
      } as unknown as AgentMessage,
      {
        role: "toolResult",
        toolCallId: "call-2",
        toolName: "tool-b",
        content: [{ type: "text", text: "ok" }],
        timestamp: Date.now(),
      } as unknown as AgentMessage,
      {
        role: "toolResult",
        toolCallId: "call-3",
        toolName: "tool-c",
        content: [{ type: "text", text: "ok" }],
        timestamp: Date.now(),
      } as unknown as AgentMessage,
      {
        role: "assistant",
        content: [{ type: "text", text: "done" }],
      } as AgentMessage,
      { role: "user", content: "follow-up" } as AgentMessage,
      {
        role: "assistant",
        content: [{ type: "text", text: "answer" }],
      } as AgentMessage,
      {
        role: "toolResult",
        toolCallId: "call-4",
        toolName: "tool-d",
        content: [{ type: "text", text: "ok" }],
        timestamp: Date.now(),
      } as unknown as AgentMessage,
      {
        role: "assistant",
        content: [{ type: "text", text: "tail" }],
      } as AgentMessage,
    ];

    const result = compressHistory(messages);
    const compressedAssistant = result.find(
      (entry) =>
        entry.role === "assistant" &&
        Array.isArray(entry.content) &&
        entry.content.some(
          (block) =>
            block &&
            typeof block === "object" &&
            (block as { type?: unknown }).type === "text" &&
            typeof (block as { text?: unknown }).text === "string" &&
            ((block as { text?: string }).text ?? "").includes("[COMPRESSED HISTORY:"),
        ),
    ) as Extract<AgentMessage, { role: "assistant" }> | undefined;

    expect(compressedAssistant).toBeDefined();
    expect(Array.isArray(compressedAssistant?.content)).toBe(true);
    const first = compressedAssistant?.content[0] as { type?: unknown; text?: unknown } | undefined;
    expect(first?.type).toBe("text");
    expect(typeof first?.text).toBe("string");
  });
});