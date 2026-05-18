import fs from "node:fs/promises";
import path from "node:path";
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
import {
  DeepSeekWebClient,
  type DeepSeekWebClientOptions,
} from "../providers/deepseek-web-client.js";

// Keep track of session IDs per session key to avoid creating too many web chat sessions
const sessionMap = new Map<string, string>();
const parentMessageMap = new Map<string, string | number>();

type MessageContentPart = {
  type: string;
  text?: string;
  name?: string;
  arguments?: string;
  data?: string;
  mimeType?: string;
  index?: number;
  id?: string;
};

type DeepSeekUploadCandidate = {
  key: string;
  data: Buffer;
  fileName: string;
};

const MEDIA_ATTACHED_PATTERN = /\[media attached(?:\s+\d+\/\d+)?:\s*([^\]]+)\]/gi;

function extensionFromMimeType(mimeType: string | undefined): string {
  const normalized = (mimeType || "").toLowerCase();
  if (normalized.includes("png")) {
    return "png";
  }
  if (normalized.includes("gif")) {
    return "gif";
  }
  if (normalized.includes("webp")) {
    return "webp";
  }
  if (normalized.includes("heic")) {
    return "heic";
  }
  if (normalized.includes("heif")) {
    return "heif";
  }
  return "jpg";
}

function isImageFileName(fileName: string): boolean {
  return /\.(?:avif|gif|heic|heif|jpe?g|png|webp)$/i.test(fileName);
}

function extractMediaAttachedPaths(text: string): string[] {
  const paths: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = MEDIA_ATTACHED_PATTERN.exec(text)) !== null) {
    const content = match[1]?.trim();
    if (!content || /^\d+\s+files?$/i.test(content)) {
      continue;
    }
    const beforeUrl = content.split(/\s+\|\s+/)[0]?.trim() || content;
    const pathPart = beforeUrl.replace(/\s+\([^)]+\)\s*$/, "").trim();
    if (pathPart) {
      paths.push(pathPart);
    }
  }
  return paths;
}

function collectDeepSeekUploadCandidates(messages: Array<{ role?: unknown; content?: unknown }>) {
  const candidates: DeepSeekUploadCandidate[] = [];
  const seen = new Set<string>();
  const addCandidate = (candidate: DeepSeekUploadCandidate) => {
    if (seen.has(candidate.key)) {
      return;
    }
    seen.add(candidate.key);
    candidates.push(candidate);
  };

  for (const message of messages) {
    if (message.role !== "user") {
      continue;
    }
    if (typeof message.content === "string") {
      for (const filePath of extractMediaAttachedPaths(message.content)) {
        addCandidate({
          key: `path:${filePath}`,
          data: Buffer.alloc(0),
          fileName: path.basename(filePath) || "attachment",
        });
      }
      continue;
    }
    if (!Array.isArray(message.content)) {
      continue;
    }
    for (const part of message.content as MessageContentPart[]) {
      if (part.type === "text" && part.text) {
        for (const filePath of extractMediaAttachedPaths(part.text)) {
          addCandidate({
            key: `path:${filePath}`,
            data: Buffer.alloc(0),
            fileName: path.basename(filePath) || "attachment",
          });
        }
      } else if (part.type === "image" && typeof part.data === "string" && part.data) {
        const mimeType = part.mimeType;
        addCandidate({
          key: `image:${part.data.slice(0, 64)}:${mimeType || ""}`,
          data: Buffer.from(part.data, "base64"),
          fileName: `image-${candidates.length + 1}.${extensionFromMimeType(mimeType)}`,
        });
      }
    }
  }

  return candidates;
}

async function resolveDeepSeekUploadData(candidate: DeepSeekUploadCandidate): Promise<{
  data: Buffer;
  fileName: string;
}> {
  if (!candidate.key.startsWith("path:")) {
    return { data: candidate.data, fileName: candidate.fileName };
  }
  const filePath = candidate.key.slice("path:".length);
  return {
    data: await fs.readFile(filePath),
    fileName: path.basename(filePath) || candidate.fileName,
  };
}

function buildDeepSeekToolPrompt(tools: NonNullable<Parameters<StreamFn>[1]["tools"]>): string {
  if (tools.length === 0) {
    return "";
  }

  let toolPrompt = "\n## Tool Use Instructions\n";
  toolPrompt +=
    "You are equipped with specialized tools. " +
    "Only call a tool when it is listed in the Available Tools section below. " +
    "**CRITICAL: You MUST use the XML tag format below to call tools. " +
    "Writing about tools in natural language WILL NOT execute them.**\n\n" +
    "### Required Format\n" +
    "```\n" +
    '<tool_call id="abcd1234" name="tool_name">{"param": "value"}</tool_call>\n' +
    "```\n\n" +
    "### Rules\n" +
    "1. Each call needs a unique 8-character `id`.\n" +
    "2. The content between tags MUST be valid JSON with the tool's parameters.\n" +
    "3. You can make multiple tool calls in one response only when each requested action is independent.\n" +
    "4. Do not invent tool names or parameters.\n" +
    "5. After receiving a tool response, use that result before deciding whether another listed tool is needed.\n\n" +
    "### Available Tools\n";

  for (const tool of tools) {
    toolPrompt += `#### ${tool.name}\n${tool.description}\n`;
    toolPrompt += `Parameters: ${JSON.stringify(tool.parameters)}\n\n`;
  }

  return toolPrompt;
}

function buildDeepSeekToolReminder(toolPrompt: string): string {
  if (!toolPrompt) {
    return "";
  }
  return [
    "",
    '[SYSTEM REMINDER]: To call one of the listed tools, output exactly <tool_call id="..." name="...">JSON_ARGS</tool_call>. Do not call tools that are not listed.',
    "If the user's request requires a capability that is not listed below, say you cannot perform that action with the currently available tools instead of inventing a function name.",
    toolPrompt,
    "",
  ].join("\n");
}

function buildDeepSeekSystemContext(params: {
  systemPrompt: string;
  toolPrompt: string;
  sessionKey: string;
}) {
  const isSubagentSession = params.sessionKey.includes(":subagent:");
  const sysPromptCap = isSubagentSession ? 48000 : 96000;
  let trimmedSystemPrompt = params.systemPrompt;
  if (params.systemPrompt.length > sysPromptCap) {
    console.log(
      `[DeepseekWebStream] Trimming systemPrompt from ${params.systemPrompt.length} → ${sysPromptCap} chars (subagent=${isSubagentSession})`,
    );
    trimmedSystemPrompt =
      params.systemPrompt.slice(0, sysPromptCap) + "\n...(system prompt trimmed)";
  }
  return `${trimmedSystemPrompt}${params.toolPrompt}`;
}

function isInternalRuntimeContextText(content: string): boolean {
  return (
    content.includes("OPENAEON runtime context (internal):") ||
    content.includes("[Internal task completion event]") ||
    content.includes("[Internal task progress event]")
  );
}

function extractMessageTextContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return (content as MessageContentPart[])
    .filter((part) => part.type === "text")
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("");
}

function looksLikeInternalScratchpad(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) {
    return false;
  }
  const firstLine = normalized.split(/\r?\n/, 1)[0] || "";
  const markers = [
    /^The user (has|wants|asked|sent)\b/i,
    /^Let me\b/i,
    /^I need to\b/i,
    /^I should\b/i,
    /^Actually, let me\b/i,
    /^Wait, I should\b/i,
  ];
  return (
    markers.some((pattern) => pattern.test(firstLine)) ||
    (/\bLet me\b/i.test(normalized) && /\bsub[- ]agent\b/i.test(normalized)) ||
    /<preview_url\b/i.test(normalized)
  );
}

function sanitizedScratchpadFallback(
  latestUserText: string,
  modelId: string,
  toolCalls?: ToolCall[],
  availableTools?: Array<{ name: string; description?: string }>,
): string {
  if (/你.*(哪个|什么).*模型|what\s+model/i.test(latestUserText)) {
    return `我是 OPENAEON 当前配置的 DeepSeek Web 提供方模型（${modelId}）。`;
  }

  if (toolCalls && toolCalls.length > 0) {
    const names = toolCalls.map((tc) => tc.name.toLowerCase());

    // Check high-priority hardcoded standard helpers first for maximum UI polishedness
    if (names.some((n) => n.includes("wechat") || n.includes("peekaboo"))) {
      return "我需要使用微信自动化工具来处理您的请求。";
    }
    if (names.some((n) => n === "browser")) {
      return "我需要使用浏览器工具来处理您的请求。";
    }
    if (names.some((n) => n === "exec")) {
      return "我需要运行相应的系统命令来处理您的请求。";
    }
    if (names.some((n) => ["read", "write", "edit", "list_dir", "grep_search"].includes(n))) {
      return "我需要读取或修改工作区文件来处理您的请求。";
    }
    if (names.some((n) => n.includes("spawn") || n.includes("subagent"))) {
      return "我需要启动子智能体来协助处理您的请求。";
    }

    // Dynamic discovery of any other tools / skills / evolved logic
    const fallbackParts: string[] = [];
    for (const tc of toolCalls) {
      const matchedTool = availableTools?.find(
        (t) => t.name.toLowerCase() === tc.name.toLowerCase(),
      );
      if (matchedTool && matchedTool.description) {
        const cleanDesc = matchedTool.description.split(/[.!?。！？\n]/, 1)[0] || "";
        fallbackParts.push(`调用系统工具 ${tc.name}（${cleanDesc}）`);
      } else {
        fallbackParts.push(`调用系统工具 ${tc.name}`);
      }
    }
    if (fallbackParts.length > 0) {
      return `我需要执行以下操作来处理您的请求：${fallbackParts.join("，")}。`;
    }

    const toolNamesStr = toolCalls.map((tc) => tc.name).join("、");
    return `我需要调用系统工具（${toolNamesStr}）来处理您的请求。`;
  }

  const userText = latestUserText.toLowerCase();
  if (userText.includes("wechat") || userText.includes("微信")) {
    return "我会继续为您处理微信相关的请求。";
  }
  if (/浏览器|browser|打开|\bopen\b/i.test(latestUserText)) {
    return "我需要调用可用的浏览器工具来完成这个请求。";
  }
  return "我会按你的最新请求继续处理。";
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanToolArgumentJson(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  // Try to find the first '{' and last '}' or first '[' and last ']'
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return cleaned.slice(firstBrace, lastBrace + 1);
  }

  const firstBracket = cleaned.indexOf("[");
  const lastBracket = cleaned.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    return cleaned.slice(firstBracket, lastBracket + 1);
  }

  return cleaned;
}

function normalizeDeepSeekToolCall(params: {
  name: string;
  args: unknown;
  availableToolNames: Set<string>;
}): { name: string; args: Record<string, unknown> } {
  const args = isObjectRecord(params.args) ? params.args : { raw: params.args };
  if (params.availableToolNames.has(params.name)) {
    return { name: params.name, args };
  }
  const aliasMap: Record<string, string> = {
    bash: "exec",
    execute_command: "exec",
    read_file: "read",
    replace_in_file: "edit",
    str_replace: "edit",
    write_file: "write",
  };
  const aliasedName = aliasMap[params.name.trim().toLowerCase()];
  if (aliasedName && params.availableToolNames.has(aliasedName)) {
    return { name: aliasedName, args };
  }
  if (params.name.startsWith("browser_") && params.availableToolNames.has("browser")) {
    const action = params.name.slice("browser_".length);
    const browserArgs = { ...args };
    if (!("action" in browserArgs) && action) {
      browserArgs.action = action;
    }
    return { name: "browser", args: browserArgs };
  }
  return { name: params.name, args };
}

function extractDeepSeekJsonToolCalls(text: string): Array<{
  id?: string;
  name: string;
  arguments: unknown;
}> {
  const cleaned = cleanToolArgumentJson(text);
  if (!cleaned || !/^\s*[{[]/.test(cleaned)) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }

  const rawCalls = isObjectRecord(parsed)
    ? parsed.tool_calls || parsed.toolCalls || parsed.tools
    : undefined;
  if (!Array.isArray(rawCalls)) {
    return [];
  }

  const calls: Array<{ id?: string; name: string; arguments: unknown }> = [];
  for (const rawCall of rawCalls) {
    if (!isObjectRecord(rawCall)) {
      continue;
    }
    const functionCall = isObjectRecord(rawCall.function) ? rawCall.function : undefined;
    const rawName = rawCall.name || functionCall?.name;
    if (typeof rawName !== "string" || !rawName.trim()) {
      continue;
    }
    let rawArguments =
      rawCall.arguments ?? rawCall.args ?? rawCall.input ?? functionCall?.arguments;
    if (typeof rawArguments === "string") {
      try {
        rawArguments = JSON.parse(cleanToolArgumentJson(rawArguments));
      } catch {
        rawArguments = { raw: rawArguments };
      }
    }
    const rawId = rawCall.id;
    calls.push({
      id: typeof rawId === "string" && rawId.trim() ? rawId : undefined,
      name: rawName,
      arguments: rawArguments,
    });
  }
  return calls;
}

function asParentMessageId(value: unknown): string | number | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}

function extractParentMessageId(data: unknown): string | number | undefined {
  if (!data || typeof data !== "object") {
    return undefined;
  }
  const d = data as Record<string, unknown>;
  const candidates: unknown[] = [
    d.response_message_id,
    d.message_id,
    d.msg_id,
    (d.v as Record<string, unknown> | undefined)?.response_message_id,
    (d.v as Record<string, unknown> | undefined)?.message_id,
    (d.v as Record<string, unknown> | undefined)?.msg_id,
    ((d.v as Record<string, unknown> | undefined)?.response as Record<string, unknown> | undefined)
      ?.message_id,
    ((d.v as Record<string, unknown> | undefined)?.response as Record<string, unknown> | undefined)
      ?.msg_id,
    ((d.v as Record<string, unknown> | undefined)?.response as Record<string, unknown> | undefined)
      ?.response_message_id,
    (d.response as Record<string, unknown> | undefined)?.message_id,
    (d.response as Record<string, unknown> | undefined)?.msg_id,
    (d.data as Record<string, unknown> | undefined)?.message_id,
    (d.data as Record<string, unknown> | undefined)?.msg_id,
    (d.data as Record<string, unknown> | undefined)?.response_message_id,
    (
      (d.data as Record<string, unknown> | undefined)?.response as
        | Record<string, unknown>
        | undefined
    )?.message_id,
    (
      (d.data as Record<string, unknown> | undefined)?.response as
        | Record<string, unknown>
        | undefined
    )?.msg_id,
  ];

  for (const candidate of candidates) {
    const parsed = asParentMessageId(candidate);
    if (parsed !== undefined) {
      return parsed;
    }
  }
  return undefined;
}

export function createDeepseekWebStreamFn(cookieOrJson: string): StreamFn {
  let options: string | DeepSeekWebClientOptions;
  try {
    const parsed = JSON.parse(cookieOrJson);
    if (typeof parsed === "string") {
      options = { cookie: parsed };
    } else {
      options = parsed;
    }
  } catch {
    options = { cookie: cookieOrJson };
  }
  const client = new DeepSeekWebClient(options);

  return (model, context, options) => {
    const stream = createAssistantMessageEventStream();

    const run = async () => {
      try {
        await client.init();

        const sessionKey =
          (context as unknown as { sessionId?: string; sessionKey?: string }).sessionId ||
          (context as unknown as { sessionId?: string; sessionKey?: string }).sessionKey ||
          "default";
        let dsSessionId = sessionMap.get(sessionKey);
        let parentId = parentMessageMap.get(sessionKey);
        let isNewDsSession = false;

        if (!dsSessionId) {
          const session = await client.createChatSession();
          dsSessionId = session.chat_session_id || "";
          sessionMap.set(sessionKey, dsSessionId);
          parentId = undefined; // New session starts fresh
          isNewDsSession = true;
        }

        const messages = context.messages || [];
        const systemPrompt = (context as unknown as { systemPrompt?: string }).systemPrompt || "";
        console.log(
          `[DeepseekWebStream] Context messages count: ${messages.length}, hasSystemPrompt: ${!!systemPrompt}`,
        );
        let prompt = "";
        const latestUserTextForFallback = extractMessageTextContent(
          [...messages].toReversed().find((m) => m.role === "user")?.content,
        );

        const tools = context.tools || [];
        const availableToolNames = new Set(tools.map((tool) => tool.name));
        const toolPrompt = buildDeepSeekToolPrompt(tools);
        const systemPromptContent = buildDeepSeekSystemContext({
          systemPrompt,
          toolPrompt,
          sessionKey,
        });

        // Full-history sync should only happen on a brand-new DeepSeek web session.
        if (!parentId && isNewDsSession) {
          // First turn or new session: Aggregate all history including System Prompt
          const historyParts: string[] = [];

          if (systemPromptContent && !messages.some((m) => (m.role as string) === "system")) {
            console.log(
              `[DeepseekWebStream] Prepending systemPrompt (length=${systemPromptContent.length})`,
            );
            historyParts.push(`--- SYSTEM CONTEXT ---\n${systemPromptContent}`);
          }

          const latestUserIndex = messages.findLastIndex((m) => (m.role as string) === "user");
          const historyStartIndex =
            (messages.length > 12 || systemPrompt.length > 12000) && latestUserIndex >= 0
              ? latestUserIndex
              : 0;
          const renderedMessages: string[] = [];
          for (const [messageIndex, m] of messages.entries()) {
            if (messageIndex < historyStartIndex) {
              continue;
            }
            const role =
              (m.role as string) === "user" || (m.role as string) === "toolResult"
                ? "User"
                : "Assistant";
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

            const trimmedContent = content.trim();
            const isLatestMessage = messageIndex === messages.length - 1;
            if (!trimmedContent) {
              continue;
            }
            if (!isLatestMessage && isInternalRuntimeContextText(trimmedContent)) {
              console.log(
                `[DeepseekWebStream] Skipping historical internal runtime context at message ${messageIndex}`,
              );
              continue;
            }

            console.log(
              `[DeepseekWebStream] Message[${messageIndex}] role=${m.role} length=${content.length} preview=${content.slice(0, 50).replace(/\n/g, " ")}`,
            );
            renderedMessages.push(`${role}: ${content}`);
          }

          historyParts.push(...renderedMessages);
          prompt = historyParts.join("\n\n");

          // Hard cap: preserve the system/tool prelude, then fit the most recent non-empty messages.
          const PROMPT_MAX_CHARS = 28000;
          if (prompt.length > PROMPT_MAX_CHARS) {
            const prelude = historyParts[0] || "";
            const separator = "\n\n";
            const remainingBudget = Math.max(
              4000,
              PROMPT_MAX_CHARS - prelude.length - separator.length,
            );
            const keptMessages: string[] = [];
            let used = 0;
            for (const rendered of renderedMessages.toReversed()) {
              const nextUsed =
                used + rendered.length + (keptMessages.length > 0 ? separator.length : 0);
              if (nextUsed > remainingBudget && keptMessages.length > 0) {
                break;
              }
              if (nextUsed > remainingBudget) {
                keptMessages.push(rendered.slice(-remainingBudget));
                break;
              }
              keptMessages.push(rendered);
              used = nextUsed;
            }
            prompt = [prelude, ...keptMessages.toReversed()].filter(Boolean).join(separator);
            console.warn(
              `[DeepseekWebStream] Prompt exceeded ${PROMPT_MAX_CHARS} chars, trimmed to ${prompt.length} while preserving system/tool context.`,
            );
          }
          console.log(
            `[DeepseekWebStream] Starting run for session: ${sessionKey}. DS session: ${dsSessionId}. Parent: ${parentId ?? "(new)"}. Prompt length: ${prompt.length}`,
          );
        } else {
          if (!parentId && !isNewDsSession) {
            console.warn(
              `[DeepseekWebStream] Missing parentId for existing session ${sessionKey}; falling back to incremental prompt.`,
            );
          }
          const reminder = buildDeepSeekToolReminder(toolPrompt);

          const lastMsg = messages[messages.length - 1];
          if (lastMsg.role === "toolResult") {
            const tr = lastMsg as unknown as ToolResultMessage;
            let resultText = "";
            if (Array.isArray(tr.content)) {
              for (const part of tr.content) {
                if (part.type === "text") {
                  resultText += part.text;
                }
              }
            }
            prompt = `${reminder}<tool_response id="${tr.toolCallId}" name="${tr.toolName}">\n${resultText}\n</tool_response>\n\nPlease proceed based on this tool result.`;
          } else {
            const lastUserMessage = [...messages].toReversed().find((m) => m.role === "user");
            let userContent = "";
            if (lastUserMessage) {
              userContent = extractMessageTextContent(lastUserMessage.content);
            }
            prompt = reminder + userContent;
          }
        }

        console.log(
          `[DeepseekWebStream] Starting run for session: ${sessionKey}. DS session: ${dsSessionId}. Parent: ${parentId}. Prompt length: ${prompt.length}`,
        );
        console.log(`[DeepseekWebStream] Full Prompt Preview: ${prompt.slice(0, 500)}...`);

        if (!prompt) {
          console.error(`[DeepseekWebStream] No prompt to send:`, JSON.stringify(messages));
          throw new Error("No message found to send to DeepSeek web API");
        }

        const searchEnabled = (options as unknown as { searchEnabled?: boolean })?.searchEnabled;
        const preempt = (options as unknown as { preempt?: boolean })?.preempt ?? false;
        const fileIds = [...((options as unknown as { fileIds?: string[] })?.fileIds || [])];
        const latestMessage = messages[messages.length - 1] as
          | { role?: unknown; content?: unknown }
          | undefined;
        const uploadCandidates =
          latestMessage?.role === "user" ? collectDeepSeekUploadCandidates([latestMessage]) : [];
        for (const candidate of uploadCandidates) {
          const upload = await resolveDeepSeekUploadData(candidate);
          if (upload.data.length === 0) {
            continue;
          }
          console.log(
            `[DeepseekWebStream] Uploading attachment for DeepSeek web: ${upload.fileName} (${upload.data.length} bytes)`,
          );
          fileIds.push(await client.uploadFile(upload.data, upload.fileName));
        }
        const hasImageUpload = uploadCandidates.some((candidate) =>
          isImageFileName(candidate.fileName),
        );
        const requestModel =
          hasImageUpload && !model.id.toLowerCase().includes("vision")
            ? model.id.toLowerCase().includes("reasoner")
              ? "deepseek-reasoner-vision"
              : "deepseek-vision"
            : model.id;

        const responseStream = await client.chatCompletions({
          sessionId: dsSessionId,
          parentMessageId: parentId,
          message: prompt,
          model: requestModel,
          searchEnabled,
          preempt,
          fileIds,
          signal: options?.signal,
        });

        if (!responseStream) {
          throw new Error("DeepSeek Web API returned empty response body");
        }

        const reader = responseStream.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = "";
        let accumulatedReasoning = "";
        const accumulatedToolCalls: MessageContentPart[] = [];
        let buffer = "";

        // Sequential indexing for pi-ai AssistantMessage events
        const indexMap = new Map<string, number>();
        let nextIndex = 0;
        const contentParts: (TextContent | ThinkingContent | ToolCall)[] = [];

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
          (msg as unknown as { thinking_enabled: boolean }).thinking_enabled =
            !!accumulatedReasoning;
          return msg;
        };

        // Stateful parser for tags in the text stream
        let currentMode: "text" | "thinking" | "tool_call" | "internal" = "text";
        let currentToolName = "";
        let currentToolIndex = 0;
        let tagBuffer = "";
        const finishCurrentToolCall = () => {
          const key = `tool_${currentToolIndex}`;
          const index = indexMap.get(key);
          if (index === undefined) {
            return;
          }
          const part = contentParts[index] as ToolCall;
          const argStr = accumulatedToolCalls[currentToolIndex].arguments || "{}";
          let parsedArgs: unknown;
          try {
            parsedArgs = JSON.parse(cleanToolArgumentJson(argStr));
          } catch {
            parsedArgs = { raw: argStr };
          }
          const normalized = normalizeDeepSeekToolCall({
            name: part.name || currentToolName,
            args: parsedArgs,
            availableToolNames,
          });
          part.name = normalized.name;
          part.arguments = normalized.args as ToolCall["arguments"];
          if (accumulatedToolCalls[currentToolIndex]) {
            accumulatedToolCalls[currentToolIndex].name = normalized.name;
          }
          stream.push({
            type: "toolcall_end",
            contentIndex: index,
            toolCall: part,
            partial: createPartial(),
          });
        };

        const emitSyntheticToolCall = (params: {
          id?: string;
          name: string;
          arguments: unknown;
        }) => {
          const normalized = normalizeDeepSeekToolCall({
            name: params.name,
            args: params.arguments,
            availableToolNames,
          });
          const index = nextIndex++;
          const toolCallId = params.id || `call_${Date.now()}_${index}`;
          const part: ToolCall = {
            type: "toolCall",
            id: toolCallId,
            name: normalized.name,
            arguments: normalized.args as ToolCall["arguments"],
          };
          contentParts[index] = part;
          accumulatedToolCalls.push({
            type: "tool_call",
            id: toolCallId,
            name: normalized.name,
            arguments: JSON.stringify(normalized.args),
            index: accumulatedToolCalls.length,
          });
          const partial = createPartial();
          stream.push({
            type: "toolcall_start",
            contentIndex: index,
            partial,
          });
          stream.push({
            type: "toolcall_delta",
            contentIndex: index,
            delta: JSON.stringify(normalized.args),
            partial: createPartial(),
          });
          stream.push({
            type: "toolcall_end",
            contentIndex: index,
            toolCall: part,
            partial: createPartial(),
          });
        };

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
                type: "tool_call",
                name: currentToolName,
                arguments: "",
                index: currentToolIndex,
                id: toolId,
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
            accumulatedContent += delta;
          } else if (type === "thinking") {
            (contentParts[index] as ThinkingContent).thinking += delta;
            accumulatedReasoning += delta;
            if (accumulatedReasoning.length % 100 === 0) {
              console.log(
                `[DeepseekWebStream] Reasoning accumulated: ${accumulatedReasoning.length} chars`,
              );
            }
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

          // Junk token filtering
          const JUNK_TOKENS = ["<｜end▁of▁thinking｜>", "<|endoftext|>"];
          if (JUNK_TOKENS.includes(delta)) {
            console.log(`[DeepseekWebStream] Filtering junk token: ${delta}`);
            return;
          }

          if (forceType === "thinking") {
            emitDelta("thinking", delta);
            return;
          }

          tagBuffer += delta;

          const checkTags = () => {
            const thinkStartMatch = tagBuffer.match(/<(?:think(?:ing)?|thought)\b[^<>]*>/i);
            const thinkEndMatch = tagBuffer.match(/<\/(?:think(?:ing)?|thought)\b[^<>]*>/i);
            const finalStartMatch = tagBuffer.match(/<final\b[^<>]*>/i);
            const finalEndMatch = tagBuffer.match(/<\/final\b[^<>]*>/i);
            const toolCallStartMatch = tagBuffer.match(/<tool_call\s+([^>]+)>/i);
            const toolCallEndMatch = tagBuffer.match(/<\/tool_call\b[^<>]*>/i);
            const toolInvokeStartMatch = tagBuffer.match(/<tool_invoke\s+([^>]+)>/i);
            const toolInvokeEndMatch = tagBuffer.match(/<\/tool_invoke\b[^<>]*>/i);
            const internalStartMatch = tagBuffer.match(
              /<(?:update_shared_context|updated_shared_context|task_result)\b[^<>]*>/i,
            );
            const internalEndMatch = tagBuffer.match(
              /<\/(?:update_shared_context|updated_shared_context|task_result)\b[^<>]*>/i,
            );
            const replyMatch = tagBuffer.match(/\[\[reply_to_current\]\]/i);

            // Failsafe for missing opening brackets (common with DeepSeek R1 in long contexts)
            const malformedThinkStartMatch = tagBuffer.match(
              /^(?:think(?:ing)?|thought)\b[^<>]*>|\n(?:think(?:ing)?|thought)\b[^<>]*>/i,
            );
            const malformedToolCallStartMatch = tagBuffer.match(
              /(?:^|[\s.])(?:tool_call)\s+([^>]+)>/i,
            );

            let toolIdFromAttrsStr = "";
            let toolNameFromAttrsStr = "";
            let toolAttrsStr = "";

            if (toolCallStartMatch) {
              toolAttrsStr = toolCallStartMatch[1];
            } else if (toolInvokeStartMatch) {
              toolAttrsStr = toolInvokeStartMatch[1];
            } else if (malformedToolCallStartMatch) {
              toolAttrsStr = malformedToolCallStartMatch[1] || malformedToolCallStartMatch[2] || "";
            }

            if (toolAttrsStr) {
              toolIdFromAttrsStr = toolAttrsStr.match(/id=['"]?([^'"]+)['"]?/i)?.[1] || "";
              toolNameFromAttrsStr = toolAttrsStr.match(/name=['"]?([^'"]+)['"]?/i)?.[1] || "";
            }

            // Priority: find the first occurring tag
            const indices = [
              {
                type: "think_start",
                idx: thinkStartMatch ? thinkStartMatch.index! : -1,
                len: thinkStartMatch ? thinkStartMatch[0].length : 0,
              },
              {
                type: "think_end",
                idx: thinkEndMatch ? thinkEndMatch.index! : -1,
                len: thinkEndMatch ? thinkEndMatch[0].length : 0,
              },
              {
                type: "final_start",
                idx: finalStartMatch ? finalStartMatch.index! : -1,
                len: finalStartMatch ? finalStartMatch[0].length : 0,
              },
              {
                type: "final_end",
                idx: finalEndMatch ? finalEndMatch.index! : -1,
                len: finalEndMatch ? finalEndMatch[0].length : 0,
              },
              {
                type: "tool_call_start",
                idx: toolCallStartMatch
                  ? toolCallStartMatch.index!
                  : toolInvokeStartMatch
                    ? toolInvokeStartMatch.index!
                    : malformedToolCallStartMatch
                      ? malformedToolCallStartMatch.index!
                      : -1,
                len: toolCallStartMatch
                  ? toolCallStartMatch[0].length
                  : toolInvokeStartMatch
                    ? toolInvokeStartMatch[0].length
                    : malformedToolCallStartMatch
                      ? malformedToolCallStartMatch[0].length
                      : 0,
                id: toolIdFromAttrsStr,
                name: toolNameFromAttrsStr,
              },
              {
                type: "tool_call_end",
                idx: toolCallEndMatch
                  ? toolCallEndMatch.index!
                  : toolInvokeEndMatch
                    ? toolInvokeEndMatch.index!
                    : -1,
                len: toolCallEndMatch
                  ? toolCallEndMatch[0].length
                  : toolInvokeEndMatch
                    ? toolInvokeEndMatch[0].length
                    : 0,
              },
              {
                type: "internal_start",
                idx: internalStartMatch ? internalStartMatch.index! : -1,
                len: internalStartMatch ? internalStartMatch[0].length : 0,
              },
              {
                type: "internal_end",
                idx: internalEndMatch ? internalEndMatch.index! : -1,
                len: internalEndMatch ? internalEndMatch[0].length : 0,
              },
              {
                type: "think_start",
                idx: malformedThinkStartMatch ? malformedThinkStartMatch.index! : -1,
                len: malformedThinkStartMatch ? malformedThinkStartMatch[0].length : 0,
              },
              {
                type: "reply_marker",
                idx: replyMatch ? replyMatch.index! : -1,
                len: replyMatch ? replyMatch[0].length : 0,
              },
              {
                type: "think_start", // General fallback for any remaining 'think>' patterns
                idx: -1,
                len: 0,
              },
            ]
              .filter((tag) => tag.idx !== -1)
              .toSorted((a, b) => a.idx - b.idx);

            if (indices.length > 0) {
              const first = indices[0];
              console.log(`[DeepseekWebStream] Tag detected: ${first.type} at ${first.idx}`);
              const before = tagBuffer.slice(0, first.idx);

              if (before) {
                if (currentMode === "thinking") {
                  emitDelta("thinking", before);
                } else if (currentMode === "tool_call") {
                  emitDelta("toolcall", before);
                } else if (currentMode === "text") {
                  emitDelta("text", before);
                }
              }

              if (first.type === "think_start") {
                currentMode = "thinking";
              } else if (first.type === "think_end") {
                currentMode = "text";
              } else if (first.type === "final_start") {
                currentMode = "text";
              } else if (first.type === "final_end") {
                currentMode = "text";
              } else if (first.type === "reply_marker") {
                currentMode = "text";
              } else if (first.type === "tool_call_start") {
                if (currentMode !== "tool_call") {
                  console.log(
                    `[DeepseekWebStream] Force transitioning to tool_call mode for tag at ${first.idx}`,
                  );
                }
                currentMode = "tool_call";
                currentToolName = first.name!;
                const toolId = first.id || `call_${Date.now()}_${currentToolIndex}`;
                emitDelta("toolcall", "", toolId); // Trigger start event with specific ID
              } else if (first.type === "tool_call_end") {
                finishCurrentToolCall();
                currentMode = "text";
                currentToolIndex++;
                currentToolName = "";
              } else if (first.type === "internal_start") {
                currentMode = "internal";
              } else if (first.type === "internal_end") {
                currentMode = "text";
              }

              tagBuffer = tagBuffer.slice(first.idx + first.len);
              checkTags();
            } else {
              // No complete tags. Emit "safe" part of buffer.
              // Safe part is anything before the last '<'
              const lastAngle = tagBuffer.lastIndexOf("<");
              if (lastAngle === -1) {
                if (currentMode === "thinking") {
                  emitDelta("thinking", tagBuffer);
                } else if (currentMode === "tool_call") {
                  emitDelta("toolcall", tagBuffer);
                } else if (currentMode === "text") {
                  emitDelta("text", tagBuffer);
                }
                tagBuffer = "";
              } else if (lastAngle > 0) {
                const safe = tagBuffer.slice(0, lastAngle);
                if (currentMode === "thinking") {
                  emitDelta("thinking", safe);
                } else if (currentMode === "tool_call") {
                  emitDelta("toolcall", safe);
                } else if (currentMode === "text") {
                  emitDelta("text", safe);
                }
                tagBuffer = tagBuffer.slice(lastAngle);
              }
              // If lastAngle is 0, we must keep it in buffer to see if it's a tag
            }
          };

          checkTags();
        };

        const processLine = (line: string) => {
          if (!line) {
            return;
          }

          if (line.startsWith("event: ")) {
            return; // We don't strictly need currentEvent if we trust the data structure
          }

          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (dataStr === "[DONE]") {
              return;
            }
            if (!dataStr) {
              return;
            }

            try {
              const data = JSON.parse(dataStr);
              // Verbose logging for debugging
              // console.log(`[DeepseekWebStream] SSE Data: ${dataStr}`);

              // Capture session/message continuity
              const nextParentId = extractParentMessageId(data);
              if (nextParentId !== undefined && nextParentId !== parentMessageMap.get(sessionKey)) {
                console.log(
                  `[DeepseekWebStream] Observed parentMessageId change: ${parentMessageMap.get(sessionKey)} -> ${nextParentId}`,
                );
                parentMessageMap.set(sessionKey, nextParentId);
              }

              // Verbose logging for non-trivial data
              if (data.v || data.content || data.type === "thinking" || data.type === "text") {
                // console.log(`[DeepseekWebStream] Chunk type=${data.type} p=${data.p} len=${(data.v || data.content || "").length}`);
              }

              // 1. Path update or explicit type for reasoning
              if (
                (data.p?.includes("reasoning") || data.type === "thinking") &&
                typeof data.v === "string"
              ) {
                pushDelta(data.v, "thinking");
                return;
              }
              if (data.type === "thinking" && typeof data.content === "string") {
                pushDelta(data.content, "thinking");
                return;
              }

              // 2. Direct string value, content path, or explicit type (XML tags might be here)
              if (
                typeof data.v === "string" &&
                (!data.p || data.p.includes("content") || data.p.includes("choices"))
              ) {
                pushDelta(data.v);
                return;
              }
              if (data.type === "text" && typeof data.content === "string") {
                pushDelta(data.content);
                return;
              }

              // 2.5 search results (if enabled)
              if (data.type === "search_result" || data.p?.includes("search_results")) {
                const searchData = data.v || data.content;
                const query =
                  typeof searchData === "string"
                    ? searchData
                    : (searchData as { query?: string })?.query;
                if (query) {
                  const searchMsg = `\n> [Researching: ${query}...]\n`;
                  if (currentMode === "thinking") {
                    emitDelta("thinking", searchMsg);
                  } else {
                    emitDelta("text", searchMsg);
                  }
                }
                return;
              }

              // 3. Nested fragments (init)
              const fragments = data.v?.response?.fragments;
              if (Array.isArray(fragments)) {
                for (const frag of fragments) {
                  if (frag.type === "THINKING" || frag.type === "reasoning") {
                    pushDelta(frag.content || "", "thinking");
                  } else if (frag.content) {
                    pushDelta(frag.content);
                  }
                }
                return;
              }

              // 4. Standard OpenAI-like choices (just in case)
              const choice = data.choices?.[0];
              if (choice) {
                if (choice.delta?.reasoning_content) {
                  pushDelta(choice.delta.reasoning_content, "thinking");
                }
                if (choice.delta?.content) {
                  pushDelta(choice.delta.content);
                }
              }
            } catch (err) {
              if (err instanceof SyntaxError) {
                // Typical for partial SSE lines
                return;
              }
              console.error(`[DeepseekWebStream] Error processing SSE line:`, err);
            }
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (buffer.trim()) {
              processLine(buffer.trim());
            }

            // Flush any remaining tag buffer
            // Flush any remaining tag buffer
            if (tagBuffer) {
              const mode = currentMode as unknown as string;
              if (mode === "thinking") {
                emitDelta("thinking", tagBuffer);
              } else if (mode === "tool_call") {
                emitDelta("toolcall", tagBuffer);
              } else if (mode === "text") {
                emitDelta("text", tagBuffer);
              }
              tagBuffer = "";
            }
            if (indexMap.has(`tool_${currentToolIndex}`)) {
              finishCurrentToolCall();
              currentMode = "text";
              currentToolIndex++;
              currentToolName = "";
            }
            if (accumulatedToolCalls.length === 0 && accumulatedContent.trim()) {
              const jsonToolCalls = extractDeepSeekJsonToolCalls(accumulatedContent);
              if (jsonToolCalls.length > 0) {
                for (const part of contentParts) {
                  if (part?.type === "text") {
                    part.text = "";
                  }
                }
                accumulatedContent = "";
                for (const call of jsonToolCalls) {
                  emitSyntheticToolCall(call);
                }
              }
            }
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          const combined = buffer + chunk;
          const parts = combined.split("\n");
          buffer = parts.pop() || ""; // Save partial line

          for (const part of parts) {
            processLine(part.trim());
          }
        }

        console.log(
          `[DeepseekWebStream] Stream completed. Content: ${accumulatedContent.length}, reasoning: ${accumulatedReasoning.length}, toolCalls: ${accumulatedToolCalls.length}`,
        );

        // Filter internal tools from final message as per original logic,
        // but keep them in the stream parts for UI continuity.
        const INTERNAL_TOOLS = new Set(["web_search"]);
        const actualToolCalls = contentParts.filter(
          (part) => part && part.type === "toolCall",
        ) as ToolCall[];
        const finalContent: (TextContent | ThinkingContent | ToolCall)[] = [];
        for (const part of contentParts) {
          if (part.type === "toolCall") {
            if (!INTERNAL_TOOLS.has(part.name)) {
              finalContent.push(part);
            }
            continue;
          }
          // Filter out empty thinking/text if they are totally empty to keep final message clean
          if (part.type === "thinking" && !part.thinking) {
            continue;
          }
          if (part.type === "text" && !part.text) {
            continue;
          }
          if (part.type === "text" && looksLikeInternalScratchpad(part.text)) {
            finalContent.push({
              ...part,
              text: sanitizedScratchpadFallback(
                latestUserTextForFallback,
                model.id,
                actualToolCalls,
                tools,
              ),
            });
            continue;
          }
          finalContent.push(part);
        }

        const assistantMessage: AssistantMessage = {
          role: "assistant",
          content: finalContent,
          stopReason: finalContent.some((p) => p.type === "toolCall") ? "toolUse" : "stop",
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
        };
        (assistantMessage as unknown as { thinking_enabled: boolean }).thinking_enabled =
          !!accumulatedReasoning;

        stream.push({
          type: "done",
          reason: assistantMessage.stopReason as "stop" | "length" | "toolUse",
          message: assistantMessage,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        stream.push({
          type: "error",
          reason: "error",
          error: {
            role: "assistant",
            content: [],
            stopReason: "error",
            errorMessage,
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
