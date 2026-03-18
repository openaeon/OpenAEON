import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("history/compactor");

/**
 * Tactical History Compression
 *
 * Identifies sequences of successful tool calls and replaces them with a single
 * summary block to save tokens while keeping the context window relevant.
 */
export function compressHistory(messages: AgentMessage[]): AgentMessage[] {
  if (messages.length < 10) {
    return messages;
  }

  const compressed: AgentMessage[] = [];
  let i = 0;

  while (i < messages.length) {
    const msg = messages[i];

    // Look for tool result messages that indicate success
    if (msg.role === "toolResult" && i + 3 < messages.length) {
      let sequenceEnd = i;
      let sequenceSummary = "";

      // Try to find a sequence of at least 3 successful tool results
      while (
        sequenceEnd < messages.length &&
        messages[sequenceEnd].role === "toolResult" &&
        !isErrorMessage(messages[sequenceEnd])
      ) {
        const toolName = (messages[sequenceEnd] as any).name || "unknown tool";
        sequenceSummary += `- ${toolName}: Success\n`;
        sequenceEnd++;
      }

      const sequenceLength = sequenceEnd - i;
      if (sequenceLength >= 3) {
        log.debug(`Compressing sequence of ${sequenceLength} successful tool calls.`);
        compressed.push({
          role: "assistant",
          content: [
            {
              type: "text",
              text: `[COMPRESSED HISTORY: ${sequenceLength} successful tool calls]\n${sequenceSummary.trim()}`,
            },
          ],
        } as AgentMessage);
        i = sequenceEnd;
        continue;
      }
    }

    compressed.push(msg);
    i++;
  }

  return compressed;
}

function isErrorMessage(msg: AgentMessage): boolean {
  const content = (msg as any).content || (msg as any).text;
  if (typeof content === "string") {
    return content.toLowerCase().includes("error") || content.toLowerCase().includes("failed");
  }
  if (Array.isArray(content)) {
    return content.some(
      (block: any) =>
        block.type === "text" &&
        (block.text.toLowerCase().includes("error") || block.text.toLowerCase().includes("failed")),
    );
  }
  return false;
}