import { randomUUID } from "node:crypto";
import type {
  AssistantMessage,
  AssistantMessageEventStream,
  Tool,
  TextContent,
  ToolCall,
} from "@mariozechner/pi-ai";
import { createAssistantMessageEventStream } from "@mariozechner/pi-ai";

/**
 * Turbo v2: Minimal scaffold for Schema-Enforced Tool Calling.
 * No formatting instructions needed since the sampler handles it.
 */
export function injectCognitiveOSScaffold(params: {
  systemPrompt?: string;
  tools?: Tool[];
}): string {
  const { systemPrompt, tools } = params;
  if (!tools || tools.length === 0) {
    return systemPrompt ?? "";
  }

  const toolDefinitions = tools
    .map((t) => `- ${t.name}: ${t.description} (args: ${JSON.stringify(t.parameters)})`)
    .join("\n");

  const scaffold = `
# Cognitive OS: Turbo Mode (Structural Execution)
You are an agent in a Cognitive OS. You must respond using the enforced structural output.

1. **Mapping**: Analyze the goal and identify tools.
Available tools:
${toolDefinitions}

2. **Invoke**: Call tools via the structured format.
3. **Audit**: Validate result.

---
Original System Process:
${systemPrompt ?? "Standard operational mode."}
`;
  return scaffold.trim();
}

/**
 * Orchestrator for JSON Mode. Handles streaming characters and parsing a
 * complete JSON object at the end or incrementally.
 */
export function createJsonOrchestrator(params: {
  innerStream: AssistantMessageEventStream;
  modelInfo: { api: string; provider: string; id: string };
}): AssistantMessageEventStream {
  const outerStream = createAssistantMessageEventStream();
  const { innerStream, modelInfo } = params;

  let buffer = "";
  const partial: AssistantMessage = {
    role: "assistant",
    content: [],
    api: modelInfo.api,
    provider: modelInfo.provider,
    model: modelInfo.id,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop",
    timestamp: Date.now(),
  };

  let emittedThought = "";
  let hasStartedThinking = false;

  const run = async () => {
    try {
      for await (const event of innerStream) {
        if (event.type === "text_delta" || event.type === "thinking_delta") {
          buffer += event.delta;

          // Incremental Thought Extraction:
          // Look for "thought": "CONTENT" and emit CONTENT as it arrives.
          if (!hasStartedThinking) {
            const thoughtKey = '"thought": "';
            const startIdx = buffer.indexOf(thoughtKey);
            if (startIdx !== -1) {
              hasStartedThinking = true;
              const thoughtStart = startIdx + thoughtKey.length;
              const currentThought = buffer.slice(thoughtStart);
              // Basic escape handling: emit everything up to the first unescaped quote
              let endIdx = -1;
              for (let i = 0; i < currentThought.length; i++) {
                if (currentThought[i] === '"' && (i === 0 || currentThought[i - 1] !== "\\")) {
                  endIdx = i;
                  break;
                }
              }
              const toEmit = endIdx === -1 ? currentThought : currentThought.slice(0, endIdx);
              if (toEmit) {
                partial.content.push({ type: "text", text: "" });
                outerStream.push({ type: "text_start", contentIndex: 0, partial: { ...partial } });
                outerStream.push({
                  type: "text_delta",
                  contentIndex: 0,
                  delta: toEmit,
                  partial: { ...partial },
                });
                emittedThought = toEmit;
              }
            }
          } else {
            // Already thinking, just emit the new delta unless we hit the end quote
            const thoughtKey = '"thought": "';
            const thoughtStart = buffer.indexOf(thoughtKey) + thoughtKey.length;
            const fullThought = buffer.slice(thoughtStart);

            let endIdx = -1;
            for (let i = 0; i < fullThought.length; i++) {
              if (fullThought[i] === '"' && (i === 0 || fullThought[i - 1] !== "\\")) {
                endIdx = i;
                break;
              }
            }

            const currentAvailable = endIdx === -1 ? fullThought : fullThought.slice(0, endIdx);
            const newDelta = currentAvailable.slice(emittedThought.length);
            if (newDelta) {
              outerStream.push({
                type: "text_delta",
                contentIndex: 0,
                delta: newDelta,
                partial: { ...partial },
              });
              emittedThought = currentAvailable;
              (partial.content[0] as TextContent).text = emittedThought;
            }
          }
        } else if (event.type === "done") {
          try {
            const result = JSON.parse(buffer.trim());
            // Format expected: { "thought": "...", "tool_calls": [{ "name": "...", "arguments": {...} }], "audit": "..." }

            if (result.thought) {
              partial.content.push({ type: "text", text: result.thought });
              outerStream.push({ type: "text_start", contentIndex: 0, partial: { ...partial } });
              outerStream.push({
                type: "text_delta",
                contentIndex: 0,
                delta: result.thought,
                partial: { ...partial },
              });
            }

            if (Array.isArray(result.tool_calls)) {
              for (const tc of result.tool_calls) {
                const toolCallId = `cogos_${randomUUID()}`;
                const argsStr = JSON.stringify(tc.arguments);
                partial.content.push({
                  type: "toolCall",
                  id: toolCallId,
                  name: tc.name,
                  arguments: tc.arguments,
                });
                const toolIdx = partial.content.length - 1;
                partial.stopReason = "toolUse";
                outerStream.push({
                  type: "toolcall_start",
                  contentIndex: toolIdx,
                  partial: { ...partial },
                });
                outerStream.push({
                  type: "toolcall_delta",
                  contentIndex: toolIdx,
                  delta: argsStr,
                  partial: { ...partial },
                });
                outerStream.push({
                  type: "toolcall_end",
                  contentIndex: toolIdx,
                  toolCall: partial.content[toolIdx] as ToolCall,
                  partial: { ...partial },
                });
              }
            }

            if (result.audit) {
              const auditText = `\n\n[Kernel Audit]: ${result.audit}`;
              partial.content.push({ type: "text", text: auditText });
              const auditIdx = partial.content.length - 1;
              outerStream.push({
                type: "text_start",
                contentIndex: auditIdx,
                partial: { ...partial },
              });
              outerStream.push({
                type: "text_delta",
                contentIndex: auditIdx,
                delta: auditText,
                partial: { ...partial },
              });
            }
          } catch (e) {
            // Fallback: if JSON parse fails, just emit the raw buffer as text
            partial.content.push({ type: "text", text: buffer });
            outerStream.push({ type: "text_start", contentIndex: 0, partial: { ...partial } });
            outerStream.push({
              type: "text_delta",
              contentIndex: 0,
              delta: buffer,
              partial: { ...partial },
            });
          }
          outerStream.push({ ...event });
        } else if (event.type === "start" || event.type === "error") {
          outerStream.push(event);
        }
      }
    } catch (err) {
      outerStream.push({ type: "error", reason: "error", error: err as any });
    } finally {
      outerStream.end();
    }
  };

  queueMicrotask(() => void run());
  return outerStream;
}

/**
 * Legacy XML Orchestrator for backwards compatibility or other providers.
 */
export function createCognitiveOrchestrator(params: {
  innerStream: AssistantMessageEventStream;
  modelInfo: { api: string; provider: string; id: string };
}): AssistantMessageEventStream {
  const outerStream = createAssistantMessageEventStream();
  const { innerStream, modelInfo } = params;

  let buffer = "";
  let inTag = false;

  const partial: AssistantMessage = {
    role: "assistant",
    content: [],
    api: modelInfo.api,
    provider: modelInfo.provider,
    model: modelInfo.id,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop",
    timestamp: Date.now(),
  };

  const emitText = (text: string) => {
    if (!text) return;
    if (
      partial.content.length === 0 ||
      partial.content[partial.content.length - 1].type !== "text"
    ) {
      partial.content.push({ type: "text", text: "" });
      outerStream.push({
        type: "text_start",
        contentIndex: partial.content.length - 1,
        partial: { ...partial },
      });
    }
    const textIdx = partial.content.length - 1;
    (partial.content[textIdx] as TextContent).text += text;
    outerStream.push({
      type: "text_delta",
      contentIndex: textIdx,
      delta: text,
      partial: { ...partial },
    });
  };

  const run = async () => {
    try {
      for await (const event of innerStream) {
        if (event.type === "text_delta" || event.type === "thinking_delta") {
          const delta = event.delta;
          buffer += delta;

          // Process buffer for multiple tags
          let searchIdx = 0;
          while (searchIdx < buffer.length) {
            if (!inTag) {
              const tagStart = buffer.indexOf("<tool_invoke", searchIdx);
              if (tagStart === -1) {
                const safeLength = buffer.lastIndexOf("<");
                if (safeLength > searchIdx) {
                  emitText(buffer.slice(searchIdx, safeLength));
                  searchIdx = safeLength;
                } else if (safeLength === -1) {
                  emitText(buffer.slice(searchIdx));
                  searchIdx = buffer.length;
                } else {
                  break;
                }
              } else {
                emitText(buffer.slice(searchIdx, tagStart));
                buffer = buffer.slice(tagStart);
                searchIdx = 0;
                inTag = true;
              }
            } else {
              const tagEnd = buffer.indexOf("</tool_invoke>");
              if (tagEnd === -1) {
                break;
              } else {
                const fullTag = buffer.slice(0, tagEnd + "</tool_invoke>".length);
                const match = /<tool_invoke name="([^"]+)">([\s\S]*?)<\/tool_invoke>/.exec(fullTag);
                if (match) {
                  const [, name, argsStr] = match;
                  try {
                    const args = JSON.parse(argsStr.trim());
                    const toolCallId = `cogos_${randomUUID()}`;
                    partial.content.push({
                      type: "toolCall",
                      id: toolCallId,
                      name,
                      arguments: args,
                    });
                    const toolIdx = partial.content.length - 1;
                    partial.stopReason = "toolUse";
                    outerStream.push({
                      type: "toolcall_start",
                      contentIndex: toolIdx,
                      partial: { ...partial },
                    });
                    outerStream.push({
                      type: "toolcall_delta",
                      contentIndex: toolIdx,
                      delta: argsStr,
                      partial: { ...partial },
                    });
                    outerStream.push({
                      type: "toolcall_end",
                      contentIndex: toolIdx,
                      toolCall: partial.content[toolIdx] as ToolCall,
                      partial: { ...partial },
                    });
                  } catch (e) {
                    emitText(`\n[Cognitive OS Parse Error]: ${String(e)}\n${fullTag}`);
                  }
                }
                buffer = buffer.slice(tagEnd + "</tool_invoke>".length);
                searchIdx = 0;
                inTag = false;
              }
            }
          }
        } else if (event.type === "done") {
          if (buffer) {
            emitText(buffer);
          }
          outerStream.push({ ...event });
        } else if (event.type === "start" || event.type === "error") {
          outerStream.push(event);
        }
      }
    } catch (err) {
      outerStream.push({ type: "error", reason: "error", error: err as any });
    } finally {
      outerStream.end();
    }
  };

  queueMicrotask(() => void run());
  return outerStream;
}
