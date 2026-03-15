import type { StreamFn } from "@mariozechner/pi-agent-core";
import {
  createAssistantMessageEventStream,
  type AssistantMessage,
  type AssistantMessageEvent,
  type TextContent,
  type ThinkingContent,
  type ToolCall,
  type ToolResultMessage,
} from "@mariozechner/pi-ai";
import type { AgentStreamParams } from "../commands/agent/types.js";
import { QwenWebClient, type QwenWebClientOptions } from "../providers/qwen-web-client.js";

const sessionMap = new Map<string, string>();
const parentMessageMap = new Map<string, string>();
const lastSearchStateMap = new Map<string, boolean>();

export function createQwenWebStreamFn(
  credentialJson: string,
  streamParams?: AgentStreamParams,
): StreamFn {
  let options: QwenWebClientOptions;
  try {
    options = JSON.parse(credentialJson);
  } catch {
    options = { cookie: credentialJson, xsrfToken: "", ut: "" };
  }
  const client = new QwenWebClient(options);

  return (model, context, options) => {
    const stream = createAssistantMessageEventStream();

    const run = async () => {
      try {
        const sessionKey = (context as unknown as { sessionId?: string }).sessionId || "default";

        // Mode mapping logic (moved up to detect changes)
        const isThinkingModel = model.id.toLowerCase().includes("thinking");
        let deepSearch = streamParams?.webSearchEnabled ?? true;

        // Force new session if search mode changed to prevent sticky tools/behavior
        if (
          lastSearchStateMap.has(sessionKey) &&
          lastSearchStateMap.get(sessionKey) !== deepSearch
        ) {
          sessionMap.delete(sessionKey);
          parentMessageMap.delete(sessionKey);
        }
        lastSearchStateMap.set(sessionKey, deepSearch);

        let qwenSessionId = sessionMap.get(sessionKey);
        let parentId = parentMessageMap.get(sessionKey);

        if (!qwenSessionId) {
          const session = await client.createChatSession();
          qwenSessionId = session.session_id;
          sessionMap.set(sessionKey, qwenSessionId);
          parentId = undefined;
        }

        const messages = context.messages || [];
        const systemPrompt = (context as unknown as { systemPrompt?: string }).systemPrompt || "";
        let prompt = "";

        const tools = context.tools || [];
        let toolPrompt = "";

        if (tools.length > 0) {
          toolPrompt = "\n## Tool Use Instructions\n";
          toolPrompt +=
            "You are equipped with specialized tools. " +
            "**CRITICAL: You MUST use the XML tag format below to call tools. " +
            "Writing about tools in natural language WILL NOT execute them.**\n\n" +
            "### Required Format\n" +
            "```\n" +
            '<tool_call id="abcd1234" name="tool_name">{"param": "value"}</tool_call>\n' +
            "```\n\n" +
            "### Rules\n" +
            "1. Think before calling (use <think> tags for reasoning).\n" +
            "2. Each call needs a unique 8-char `id`.\n" +
            "3. The content between tags MUST be valid JSON with the tool's parameters.\n" +
            "4. You can make MULTIPLE tool calls in ONE response for parallel execution.\n" +
            "5. **NEVER describe a tool call in text. ALWAYS use the XML format above.**\n\n" +
            "### Example: Parallel Subagent Delegation\n" +
            "To spawn 3 parallel subagents:\n" +
            "```\n" +
            '<tool_call id="sub00001" name="sessions_spawn">{"task": "Research NVIDIA GPU products and pricing", "label": "nvidia_research"}</tool_call>\n' +
            '<tool_call id="sub00002" name="sessions_spawn">{"task": "Research AMD GPU products and pricing", "label": "amd_research"}</tool_call>\n' +
            '<tool_call id="sub00003" name="sessions_spawn">{"task": "Research Apple GPU products and pricing", "label": "apple_research"}</tool_call>\n' +
            "```\n\n" +
            "### ⚠️ Anti-Pattern (DO NOT DO THIS)\n" +
            '❌ Wrong: "I will now execute sessions_spawn three times..."\n' +
            "✅ Correct: Output the actual <tool_call> XML tags as shown above.\n\n" +
            "### Browser Tool\n" +
            "- Profile 'openaeon' (Recommended): Independent browser window.\n" +
            "- Profile 'chrome': Uses existing Chrome tabs (requires extension).\n" +
            "- Once started with a profile, STAY with it.\n" +
            "- Do NOT install Playwright/Selenium/Puppeteer via exec.\n\n" +
            "### Multi-Agent Orchestration Protocol (三阶段 FSM)\n" +
            "When the user gives a COMPLEX multi-step task, follow this 3-phase workflow:\n\n" +
            "#### Phase 1: PLANNING (规划阶段)\n" +
            '1. Call `write_todos(create_plan, description="...")` — this creates plan with phase=planning\n' +
            '2. Call `write_todos(add_todo, title="...")` for each major step (at least 3-5 steps)\n' +
            "3. Present the implementation plan to the user as a structured Markdown overview:\n" +
            "   - Problem analysis / 问题分析\n" +
            "   - Proposed approach / 实施方案\n" +
            "   - Risk assessment / 风险评估\n" +
            '4. Tell user: "计划已创建，请在侧边栏确认后开始执行"\n' +
            "5. When user sends 批准/approve/开始/确认/执行, IMMEDIATELY proceed to Phase 2\n\n" +
            "#### Phase 2: EXECUTION (执行阶段) — FULLY AUTOMATIC\n" +
            "Once approved, execute ALL steps without stopping:\n" +
            '1. Call `write_todos(set_phase, phase="execution")` to transition\n' +
            "2. For each todo:\n" +
            '   - `write_todos(update_todo, taskId, status="in_progress")`\n' +
            '   - Do the work directly OR `sessions_spawn(task="...", label="...")` to delegate\n' +
            "   - When using `sessions_spawn`, the tool automatically waits for the subagent to finish and returns its output inline. You must read it and then proceed.\n" +
            '3. Complete ALL todos automatically: `write_todos(update_todo, taskId, status="done", result="...")` (pass subagent or step output in result)\n' +
            "4. Do NOT stop or ask for approval between steps.\n\n" +
            "#### Phase 3: VERIFICATION (验证阶段)\n" +
            "After ALL todos are done:\n" +
            '1. Call `write_todos(set_phase, phase="verification")`\n' +
            "2. Synthesize all subagent results into a consolidated report\n" +
            "3. Call `write_todos(complete_plan)` to finalize (auto-sets phase=complete)\n\n" +
            "Example PLANNING phase:\n" +
            "```\n" +
            '<tool_call id="plan0001" name="write_todos">{"action": "create_plan", "description": "GPU comparison research"}</tool_call>\n' +
            '<tool_call id="todo0001" name="write_todos">{"action": "add_todo", "title": "Research NVIDIA GPUs"}</tool_call>\n' +
            '<tool_call id="todo0002" name="write_todos">{"action": "add_todo", "title": "Research AMD GPUs"}</tool_call>\n' +
            "```\n" +
            "Then present plan to user and tell them to click approve in the sidebar.\n\n" +
            "Example EXECUTION phase (after user approval):\n" +
            "```\n" +
            '<tool_call id="phase001" name="write_todos">{"action": "set_phase", "phase": "execution"}</tool_call>\n' +
            '<tool_call id="upd00001" name="write_todos">{"action": "update_todo", "taskId": "<id>", "status": "in_progress"}</tool_call>\n' +
            '<tool_call id="spn00001" name="sessions_spawn">{"task": "Research NVIDIA GPU lineup...", "label": "nvidia_research"}</tool_call>\n' +
            "```\n\n" +
            "### Available Tools\n";

          // If native search is enabled, we hide the local web_search tool to force native logic
          const filteredTools = streamParams?.webSearchEnabled
            ? tools.filter((t) => t.name !== "web_search")
            : tools;

          for (const tool of filteredTools) {
            toolPrompt += `#### ${tool.name}\n${tool.description}\n`;
            toolPrompt += `Parameters: ${JSON.stringify(tool.parameters)}\n\n`;
          }
        }

        if (!parentId) {
          // First turn or new session: Aggregate all history including System Prompt
          const historyParts: string[] = [];
          let systemPromptContent = systemPrompt;

          if (toolPrompt) {
            systemPromptContent += toolPrompt;
          }

          if (systemPromptContent && !messages.some((m) => (m.role as string) === "system")) {
            historyParts.push(`System: ${systemPromptContent}`);
          }

          for (const m of messages) {
            const role = m.role === "user" || m.role === "toolResult" ? "User" : "Assistant";
            let content = "";

            if (m.role === "toolResult") {
              const tr = m as unknown as ToolResultMessage;
              let resultText = "";
              if (Array.isArray(tr.content)) {
                for (const part of tr.content) {
                  if (part.type === "text") {
                    resultText += part.text;
                  }
                }
              }
              content = `\n<tool_response id="${tr.toolCallId}" name="${tr.toolName}">\n${resultText}\n</tool_response>\n`;
            } else if (Array.isArray(m.content)) {
              for (const part of m.content) {
                if (part.type === "text") {
                  content += part.text;
                } else if (part.type === "thinking") {
                  content += `<think>\n${part.thinking}\n</think>\n`;
                } else if (part.type === "toolCall") {
                  const tc = part;
                  content += `<tool_call id="${tc.id}" name="${tc.name}">${JSON.stringify(tc.arguments)}</tool_call>`;
                }
              }
            } else {
              content = String(m.content);
            }
            historyParts.push(`${role}: ${content}`);
          }
          prompt = historyParts.join("\n\n");
        } else {
          // Continuing turn: Check if the last record is a ToolResult or User message
          const lastMsg = messages[messages.length - 1];
          if (lastMsg?.role === "toolResult") {
            const tr = lastMsg as unknown as ToolResultMessage;
            let resultText = "";
            if (Array.isArray(tr.content)) {
              for (const part of tr.content) {
                if (part.type === "text") {
                  resultText += part.text;
                }
              }
            }
            prompt = `\n<tool_response id="${tr.toolCallId}" name="${tr.toolName}">\n${resultText}\n</tool_response>\n\nPlease proceed based on this tool result.`;
          } else {
            const lastUserMessage = [...messages].toReversed().find((m) => m.role === "user");
            if (lastUserMessage) {
              if (typeof lastUserMessage.content === "string") {
                prompt = lastUserMessage.content;
              } else if (Array.isArray(lastUserMessage.content)) {
                prompt = lastUserMessage.content
                  .filter((part) => part.type === "text")
                  .map((part) => part.text)
                  .join("");
              }
            }
          }
        }

        if (toolPrompt && parentId) {
          prompt +=
            '\n\n[SYSTEM HINT]: CRITICAL REMINDER — To use a tool, you MUST output the exact XML format: <tool_call id="unique_id" name="tool_name">{"param": "value"}</tool_call>. Writing about tools in plain text WILL NOT execute them. For parallel tasks (e.g., spawning multiple subagents), output multiple <tool_call> tags in the same response.';
        }

        // Append Mode Hint to all prompts (even continuing ones) to ensure consistency
        const modeHint = deepSearch
          ? "\n\n[SYSTEM HINT]: Native Web Search is ENABLED. Use your internal search capabilities if more info is needed. Do NOT use external tools for searching."
          : "\n\n[SYSTEM HINT]: Native Web Search is DISABLED. Use provided tools if necessary.";
        prompt += modeHint;

        // Mode mapping logic
        let aiToolScene: string | undefined;
        let bizData: string | undefined;

        if (model.id === "Qwen-Deep-Research") {
          aiToolScene = "deep_research";
          const taskId = Array.from({ length: 32 }, () =>
            Math.floor(Math.random() * 16).toString(16),
          ).join("");
          bizData = JSON.stringify({ drs_task_id: taskId, drs_sub_scene: "general" });
          // deepSearch is already handled above
        } else if (model.id === "Qwen-Code-Agent") {
          aiToolScene = "code_agent";
          deepSearch = false;
        } else if (model.id === "Qwen-Image-Gen") {
          aiToolScene = "zaodian_generate_image";
          bizData = JSON.stringify({
            req: {
              rootModel: "qwen",
              prompt: prompt,
              originPrompt: prompt,
              params: { size: "3:4" },
            },
            bizScene: "genImage",
          });
        }

        const responseStream = await client.chatCompletions({
          sessionId: qwenSessionId,
          parentMessageId: parentId,
          message: prompt,
          model: model.id,
          signal: options?.signal,
          deepSearch: deepSearch,
          aiToolScene: aiToolScene,
          bizData: bizData,
        });

        if (!responseStream) {
          throw new Error("Qwen Web API returned empty response body");
        }

        const reader = responseStream.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const indexMap = new Map<string, number>();
        let nextIndex = 0;
        const contentParts: (TextContent | ThinkingContent | ToolCall)[] = [];
        let finalSources: Array<{ content?: { list?: Array<{ url?: string; title?: string }> } }> =
          [];
        const accumulatedToolCalls: {
          id: string;
          name: string;
          arguments: string;
          index: number;
        }[] = [];

        // Track consumed lengths for cumulative fields
        let consumedReasoningLength = 0;
        let consumedMainContentLength = 0;
        let consumedDeepThinkLength = 0;

        const createPartial = (): AssistantMessage => {
          const msg: AssistantMessage = {
            role: "assistant",
            content: [...contentParts],
            api: model.api,
            provider: model.provider,
            model: model.id,
            usage: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              totalTokens: 0,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
            },
            stopReason: accumulatedToolCalls.length > 0 ? "toolUse" : "stop",
            timestamp: Date.now(),
          };
          (msg as AssistantMessage & { thinking_enabled?: boolean }).thinking_enabled =
            contentParts.some((p) => p.type === "thinking");
          return msg;
        };

        let currentMode: "text" | "thinking" | "tool_call" = "text";
        let currentToolName = "";
        let currentToolIndex = 0;
        let tagBuffer = "";

        const emitDelta = (
          type: "text" | "thinking" | "toolcall",
          delta: string,
          forceId?: string,
        ) => {
          if (delta === "" && type !== "toolcall") {
            return;
          }
          const key = type === "toolcall" ? `tool_${currentToolIndex}` : type;

          if (!indexMap.has(key)) {
            const index = nextIndex++;
            indexMap.set(key, index);
            if (type === "text") {
              contentParts[index] = { type: "text", text: "" };
              stream.push({ type: "text_start", contentIndex: index, partial: createPartial() });
            } else if (type === "thinking") {
              contentParts[index] = { type: "thinking", thinking: "" };
              stream.push({
                type: "thinking_start",
                contentIndex: index,
                partial: createPartial(),
              });
            } else if (type === "toolcall") {
              const toolId = forceId || `call_${Date.now()}_${index}`;
              contentParts[index] = {
                type: "toolCall",
                id: toolId,
                name: currentToolName,
                arguments: {},
              };
              accumulatedToolCalls[currentToolIndex] = {
                id: toolId,
                name: currentToolName,
                arguments: "",
                index: currentToolIndex,
              };
              stream.push({
                type: "toolcall_start",
                contentIndex: index,
                partial: createPartial(),
              });
            }
          }

          const index = indexMap.get(key)!;
          if (type === "text") {
            (contentParts[index] as TextContent).text += delta;
            stream.push({
              type: "text_delta",
              contentIndex: index,
              delta,
              partial: createPartial(),
            });
          } else if (type === "thinking") {
            (contentParts[index] as ThinkingContent).thinking += delta;
            stream.push({
              type: "thinking_delta",
              contentIndex: index,
              delta,
              partial: createPartial(),
            });
          } else if (type === "toolcall") {
            accumulatedToolCalls[currentToolIndex].arguments += delta;
            stream.push({
              type: "toolcall_delta",
              contentIndex: index,
              delta,
              partial: createPartial(),
            });
          }
        };

        const pushDelta = (delta: string, forceType?: "text" | "thinking") => {
          if (!delta) {
            return;
          }
          if (forceType === "thinking") {
            emitDelta("thinking", delta);
            return;
          }
          tagBuffer += delta;

          const checkTags = () => {
            const thinkStart = tagBuffer.match(
              /(?:<think\b[^<>]*>|\[\(\s*(?:deep_)?think\s*\)\])/i,
            );
            const thinkEnd = tagBuffer.match(
              /(?:<\/think\b[^<>]*>|\[\(\s*\/\s*(?:deep_)?think\s*\)\])/i,
            );
            const toolCallStart = tagBuffer.match(
              /<tool_call\s*(?:id=['"]?([^'"]+)['"]?\s*)?name=['"]?([^'"]+)['"]?\s*>/i,
            );
            const toolCallEnd = tagBuffer.match(/<\/tool_call\s*>/i);

            const indices = [
              {
                type: "think_start",
                idx: thinkStart?.index ?? -1,
                len: thinkStart?.[0].length ?? 0,
              },
              { type: "think_end", idx: thinkEnd?.index ?? -1, len: thinkEnd?.[0].length ?? 0 },
              {
                type: "tool_start",
                idx: toolCallStart?.index ?? -1,
                len: toolCallStart?.[0].length ?? 0,
                id: toolCallStart?.[1],
                name: toolCallStart?.[2],
              },
              {
                type: "tool_end",
                idx: toolCallEnd?.index ?? -1,
                len: toolCallEnd?.[0].length ?? 0,
              },
            ]
              .filter((t) => t.idx !== -1)
              .toSorted((a, b) => a.idx - b.idx);

            if (indices.length > 0) {
              const first = indices[0];
              const before = tagBuffer.slice(0, first.idx);
              if (before) {
                if (currentMode === "thinking") {
                  emitDelta("thinking", before);
                } else if (currentMode === "tool_call") {
                  emitDelta("toolcall", before);
                } else {
                  emitDelta("text", before);
                }
              }

              if (first.type === "think_start") {
                currentMode = "thinking";
              } else if (first.type === "think_end") {
                currentMode = "text";
              } else if (first.type === "tool_start") {
                currentMode = "tool_call";
                currentToolName = first.name!;
                emitDelta("toolcall", "", first.id);
              } else if (first.type === "tool_end") {
                const index = indexMap.get(`tool_${currentToolIndex}`);
                if (index !== undefined) {
                  const part = contentParts[index] as ToolCall;
                  const argStr = accumulatedToolCalls[currentToolIndex].arguments || "{}";

                  let cleanedArg = argStr.trim();
                  if (cleanedArg.startsWith("```json")) {
                    cleanedArg = cleanedArg.substring(7);
                  } else if (cleanedArg.startsWith("```")) {
                    cleanedArg = cleanedArg.substring(3);
                  }
                  if (cleanedArg.endsWith("```")) {
                    cleanedArg = cleanedArg.substring(0, cleanedArg.length - 3);
                  }
                  cleanedArg = cleanedArg.trim();

                  try {
                    part.arguments = JSON.parse(cleanedArg);
                  } catch (e) {
                    part.arguments = { raw: argStr };
                    console.error(
                      `[Qwen Stream] Failed to parse JSON for tool call ${currentToolName}:`,
                      argStr,
                      "\nError:",
                      e,
                    );
                  }
                  stream.push({
                    type: "toolcall_end",
                    contentIndex: index,
                    toolCall: part,
                    partial: createPartial(),
                  });
                }
                currentMode = "text";
                currentToolIndex++;
              }
              tagBuffer = tagBuffer.slice(first.idx + first.len);
              checkTags();
            } else {
              const lastAngle = tagBuffer.lastIndexOf("<");
              if (lastAngle === -1) {
                const mode =
                  currentMode === "thinking"
                    ? "thinking"
                    : currentMode === "tool_call"
                      ? "toolcall"
                      : "text";
                emitDelta(mode, tagBuffer);
                tagBuffer = "";
              } else if (lastAngle > 0) {
                const safe = tagBuffer.slice(0, lastAngle);
                const mode =
                  currentMode === "thinking"
                    ? "thinking"
                    : currentMode === "tool_call"
                      ? "toolcall"
                      : "text";
                emitDelta(mode, safe);
                tagBuffer = tagBuffer.slice(lastAngle);
              }
            }
          };
          checkTags();
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          const decoded = decoder.decode(value, { stream: true });
          buffer += decoded;
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data:")) {
              continue;
            }
            let dataStr = line.slice(5).trim();
            if (dataStr === "[DONE]") {
              break;
            }
            dataStr = dataStr.replace(/}\s*{/g, "}\n{");
            const payloads = dataStr.split("\n");

            for (const payload of payloads) {
              const cleanPayload = payload.trim();
              if (!cleanPayload) {
                continue;
              }

              try {
                const json = JSON.parse(cleanPayload);
                const messages = json.data?.messages;
                if (!Array.isArray(messages)) {
                  continue;
                }

                for (const message of messages) {
                  if (message.msg_id && message.msg_id !== parentMessageMap.get(sessionKey)) {
                    parentMessageMap.set(sessionKey, message.msg_id);
                  }

                  const mt = message.mime_type;
                  const md = message.meta_data || {};

                  // Aggressively find sources
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const findSourcesRecursive = (obj: any, depth = 0) => {
                    if (!obj || typeof obj !== "object" || depth > 5) {
                      return;
                    }
                    if (Array.isArray(obj.sources) && obj.sources.length > 0) {
                      finalSources = obj.sources;
                    }
                    if (obj.multi_load && Array.isArray(obj.multi_load)) {
                      for (const ml of obj.multi_load) {
                        findSourcesRecursive(ml, depth + 1);
                        findSourcesRecursive(ml.meta_data, depth + 1);
                      }
                    }
                  };
                  findSourcesRecursive(message);

                  // 1. Handle Reasonings (plan_cot/post)
                  if (mt === "plan_cot/post" && message.content) {
                    const reasoning = message.content;
                    if (reasoning.length > consumedReasoningLength) {
                      pushDelta(reasoning.slice(consumedReasoningLength), "thinking");
                      consumedReasoningLength = reasoning.length;
                    }
                  }

                  // 2. Handle Planning and Tasks from multi_load
                  if (Array.isArray(md.multi_load)) {
                    for (const ml of md.multi_load) {
                      // Reasoning from deep_think
                      if (ml.type === "deep_think") {
                        const thinkContent = ml.content?.think_content || "";
                        if (thinkContent && thinkContent.length > consumedDeepThinkLength) {
                          pushDelta(thinkContent.slice(consumedDeepThinkLength), "thinking");
                          consumedDeepThinkLength = thinkContent.length;
                        }
                      }
                      // Research steps from mos_task_plan
                      if (ml.type === "mos_task_plan" && ml.content?.tasks) {
                        const tasks = ml.content.tasks as { title: string; status?: string }[];
                        let planMd = "\n> **Research Plan:**\n";
                        for (const task of tasks) {
                          const icon = task.status === "complete" ? "✅" : "⏳";
                          planMd += `> ${icon} ${task.title}\n`;
                        }

                        const thinkingBlock = contentParts.find(
                          (p) => p.type === "thinking",
                        ) as ThinkingContent;
                        const existingThinking = thinkingBlock?.thinking || "";

                        // If it's a plan update, we want to replace the old plan part instead of appending
                        if (existingThinking.includes("**Research Plan:**")) {
                          const newThinking = existingThinking.replace(
                            /\n> \*\*Research Plan:\*\*[\s\S]*$/,
                            planMd + "\n",
                          );
                          if (newThinking !== existingThinking) {
                            const index = contentParts.indexOf(thinkingBlock);
                            thinkingBlock.thinking = newThinking;
                            stream.push({
                              type: "thinking_delta",
                              contentIndex: index,
                              delta: "",
                              partial: createPartial(),
                            });
                          }
                        } else {
                          pushDelta(planMd + "\n", "thinking");
                        }
                      }
                    }
                  }

                  // 3. Handle Main Text
                  if (message.content && (mt === "text/plain" || mt === "multi_load/iframe")) {
                    const text = message.content;
                    if (text.length > consumedMainContentLength) {
                      pushDelta(text.slice(consumedMainContentLength));
                      consumedMainContentLength = text.length;
                    }
                  }

                  // 4. Handle Search Status in extra_info (if present)
                  const extra = json.data?.extra_info;
                  if (extra && extra.step === "search" && extra.step_status === "processing") {
                    const currentThinking =
                      (contentParts.find((p) => p.type === "thinking") as ThinkingContent)
                        ?.thinking || "";
                    if (!currentThinking.includes("🔍 Searching")) {
                      pushDelta("\n> 🔍 **Searching for information...**\n", "thinking");
                    }
                  }
                }
              } catch {
                /* ignore partial */
              }
            }
          }
        }

        if (tagBuffer) {
          const mode =
            (currentMode as string) === "thinking"
              ? "thinking"
              : (currentMode as string) === "tool_call"
                ? "toolcall"
                : "text";
          emitDelta(mode, tagBuffer);
        }

        if (finalSources.length > 0) {
          let sourcesMd = "\n\n> 🔍 **References:**\n";
          let count = 1;
          const seenUrls = new Set<string>();
          for (const sourceGrp of finalSources) {
            if (sourceGrp?.content?.list) {
              for (const item of sourceGrp.content.list) {
                if (item.url && item.title && !seenUrls.has(item.url)) {
                  seenUrls.add(item.url);
                  sourcesMd += `> ${count}. [${item.title}](${item.url})\n`;
                  count++;
                }
              }
            }
          }
          if (count > 1) {
            pushDelta(sourcesMd);
          }
        }

        stream.push({
          type: "done",
          reason: accumulatedToolCalls.length > 0 ? "toolUse" : "stop",
          message: createPartial(),
        });
      } catch (err) {
        stream.push({
          type: "error",
          reason: "error",
          error: {
            role: "assistant",
            content: [],
            stopReason: "error",
            errorMessage: err instanceof Error ? err.message : String(err),
            api: model.api,
            provider: model.provider,
            model: model.id,
            usage: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              totalTokens: 0,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
            },
            timestamp: Date.now(),
          },
        } as AssistantMessageEvent);
      } finally {
        stream.end();
      }
    };
    queueMicrotask(() => void run());
    return stream;
  };
}
