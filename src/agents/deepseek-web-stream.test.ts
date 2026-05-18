import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    chatCompletions: vi.fn(),
    createChatSession: vi.fn(),
    init: vi.fn(),
    uploadFile: vi.fn(),
  };
});

vi.mock("../providers/deepseek-web-client.js", () => {
  return {
    DeepSeekWebClient: vi.fn(function DeepSeekWebClient() {
      return {
        init: mocks.init,
        createChatSession: mocks.createChatSession,
        chatCompletions: mocks.chatCompletions,
        uploadFile: mocks.uploadFile,
      };
    }),
  };
});

import { createDeepseekWebStreamFn } from "./deepseek-web-stream.js";

function createSseStream(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const payload = lines.join("\n") + "\n";
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });
}

async function drain(stream: AsyncIterable<unknown>) {
  for await (const _event of stream) {
    // drain stream
  }
}

async function collect(stream: AsyncIterable<unknown>) {
  const events: unknown[] = [];
  for await (const event of stream) {
    events.push(event);
  }
  return events;
}

describe("createDeepseekWebStreamFn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createChatSession.mockResolvedValue({ chat_session_id: "ds-session-1" });
    mocks.chatCompletions.mockResolvedValue(createSseStream(["data: [DONE]"]));
    mocks.uploadFile.mockResolvedValue("file-1");
  });

  it("only advertises the tools provided by the runtime", async () => {
    const streamFn = createDeepseekWebStreamFn("cookie=value");
    const stream = streamFn(
      { id: "deepseek-reasoner", api: "deepseek-web", provider: "deepseek-web" } as never,
      {
        sessionId: "deepseek-web-test-no-invented-tools",
        systemPrompt: "You are OPENAEON.",
        messages: [{ role: "user", content: "Read the file" }],
        tools: [
          {
            name: "read_file",
            description: "Read a file from the workspace.",
            parameters: {
              type: "object",
              properties: { path: { type: "string" } },
              required: ["path"],
            },
          },
        ],
      } as never,
      {} as never,
    );

    await drain(stream as AsyncIterable<unknown>);

    const request = mocks.chatCompletions.mock.calls[0]?.[0] as { message?: string };
    expect(request.message).toContain("#### read_file");
    expect(request.message).toContain("Do not invent tool names or parameters.");
    expect(request.message).not.toContain("sessions_spawn");
    expect(request.message).not.toContain("write_todos");
    expect(request.message).not.toContain("3-phase");
  });

  it("uploads image content blocks and forwards ref file ids", async () => {
    const streamFn = createDeepseekWebStreamFn("cookie=value");
    const stream = streamFn(
      { id: "deepseek-chat", api: "deepseek-web", provider: "deepseek-web" } as never,
      {
        sessionId: "deepseek-web-test-upload-image",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "What is in this image?" },
              {
                type: "image",
                data: Buffer.from("fake-image").toString("base64"),
                mimeType: "image/png",
              },
            ],
          },
        ],
        tools: [],
      } as never,
      {} as never,
    );

    await drain(stream as AsyncIterable<unknown>);

    expect(mocks.uploadFile).toHaveBeenCalledWith(Buffer.from("fake-image"), "image-1.png");
    const request = mocks.chatCompletions.mock.calls[0]?.[0] as {
      fileIds?: string[];
      model?: string;
    };
    expect(request.fileIds).toEqual(["file-1"]);
    expect(request.model).toBe("deepseek-vision");
  });

  it("parses streamed XML tool calls into toolUse completion", async () => {
    mocks.chatCompletions.mockResolvedValue(
      createSseStream([
        'data: {"type":"text","content":"I will inspect it. <tool_call id=\\"toolu_123\\" name=\\"read_file\\">"}',
        'data: {"type":"text","content":"{\\"path\\":\\"src/index.ts\\"}"}',
        'data: {"type":"text","content":"</tool_call>"}',
        "data: [DONE]",
      ]),
    );

    const streamFn = createDeepseekWebStreamFn("cookie=value");
    const stream = streamFn(
      { id: "deepseek-reasoner", api: "deepseek-web", provider: "deepseek-web" } as never,
      {
        sessionId: "deepseek-web-test-tool-call",
        messages: [{ role: "user", content: "Read src/index.ts" }],
        tools: [
          {
            name: "read_file",
            description: "Read a file from the workspace.",
            parameters: {
              type: "object",
              properties: { path: { type: "string" } },
              required: ["path"],
            },
          },
        ],
      } as never,
      {} as never,
    );

    const events = await collect(stream as AsyncIterable<unknown>);
    const eventTypes = events.map((event) => (event as { type?: string }).type);
    expect(eventTypes).toContain("toolcall_start");
    expect(eventTypes).toContain("toolcall_delta");

    const end = events.find((event) => (event as { type?: string }).type === "toolcall_end") as
      | { toolCall?: { id?: string; name?: string; arguments?: unknown } }
      | undefined;
    expect(end?.toolCall).toEqual({
      type: "toolCall",
      id: "toolu_123",
      name: "read_file",
      arguments: { path: "src/index.ts" },
    });

    const done = events.find((event) => (event as { type?: string }).type === "done") as
      | {
          reason?: string;
          message?: {
            stopReason?: string;
            content?: { type?: string; id?: string; name?: string; arguments?: unknown }[];
          };
        }
      | undefined;
    expect(done?.reason).toBe("toolUse");
    expect(done?.message?.stopReason).toBe("toolUse");
    expect(done?.message?.content).toContainEqual({
      type: "toolCall",
      id: "toolu_123",
      name: "read_file",
      arguments: { path: "src/index.ts" },
    });
  });

  it("parses malformed DeepSeek tool calls and normalizes browser action aliases", async () => {
    mocks.chatCompletions.mockResolvedValue(
      createSseStream([
        'data: {"type":"text","content":"The user wants me to open a browser. Let me do that.tool_call id=\\"browser_open\\" name=\\"browser_open\\">\\n{\\"action\\":\\"open\\",\\"url\\":\\"https://finance.yahoo.com\\"}"}',
        "data: [DONE]",
      ]),
    );

    const streamFn = createDeepseekWebStreamFn("cookie=value");
    const events = await collect(
      streamFn(
        { id: "deepseek-reasoner", api: "deepseek-web", provider: "deepseek-web" } as never,
        {
          sessionId: "deepseek-web-test-malformed-browser-tool",
          messages: [{ role: "user", content: "打开浏览器搜索雅虎财经网站" }],
          tools: [
            {
              name: "browser",
              description: "Control the browser.",
              parameters: {
                type: "object",
                properties: {
                  action: { type: "string" },
                  url: { type: "string" },
                },
                required: ["action"],
              },
            },
          ],
        } as never,
        {} as never,
      ) as AsyncIterable<unknown>,
    );

    const eventTypes = events.map((event) => (event as { type?: string }).type);
    expect(eventTypes).toContain("toolcall_start");
    expect(eventTypes).toContain("toolcall_end");

    const done = events.find((event) => (event as { type?: string }).type === "done") as
      | {
          reason?: string;
          message?: {
            content?: { type?: string; id?: string; name?: string; arguments?: unknown }[];
          };
        }
      | undefined;
    expect(done?.reason).toBe("toolUse");
    expect(done?.message?.content).toContainEqual({
      type: "toolCall",
      id: "browser_open",
      name: "browser",
      arguments: { action: "open", url: "https://finance.yahoo.com" },
    });
  });

  it("adapts MCP-style tool_invoke tags into runtime tool calls", async () => {
    mocks.chatCompletions.mockResolvedValue(
      createSseStream([
        'data: {"type":"text","content":"<tool_invoke name=\\"browser\\">"}',
        'data: {"type":"text","content":"{\\"action\\":\\"open\\",\\"url\\":\\"https://finance.yahoo.com\\"}"}',
        'data: {"type":"text","content":"</tool_invoke>"}',
        "data: [DONE]",
      ]),
    );

    const streamFn = createDeepseekWebStreamFn("cookie=value");
    const events = await collect(
      streamFn(
        { id: "deepseek-reasoner", api: "deepseek-web", provider: "deepseek-web" } as never,
        {
          sessionId: "deepseek-web-test-tool-invoke",
          messages: [{ role: "user", content: "打开浏览器搜索雅虎财经网站" }],
          tools: [
            {
              name: "browser",
              description: "Control the browser.",
              parameters: {
                type: "object",
                properties: {
                  action: { type: "string" },
                  url: { type: "string" },
                },
                required: ["action"],
              },
            },
          ],
        } as never,
        {} as never,
      ) as AsyncIterable<unknown>,
    );

    const done = events.find((event) => (event as { type?: string }).type === "done") as
      | {
          reason?: string;
          message?: {
            content?: { type?: string; id?: string; name?: string; arguments?: unknown }[];
          };
        }
      | undefined;
    expect(done?.reason).toBe("toolUse");
    expect(done?.message?.content).toContainEqual(
      expect.objectContaining({
        type: "toolCall",
        name: "browser",
        arguments: { action: "open", url: "https://finance.yahoo.com" },
      }),
    );
  });

  it("adapts JSON tool_calls output into runtime tool calls", async () => {
    mocks.chatCompletions.mockResolvedValue(
      createSseStream([
        'data: {"type":"text","content":"{\\"thought\\":\\"Need browser\\",\\"tool_calls\\":[{\\"id\\":\\"json_browser\\",\\"name\\":\\"browser_open\\",\\"arguments\\":{\\"url\\":\\"https://finance.yahoo.com\\"}}]}"}',
        "data: [DONE]",
      ]),
    );

    const streamFn = createDeepseekWebStreamFn("cookie=value");
    const events = await collect(
      streamFn(
        { id: "deepseek-reasoner", api: "deepseek-web", provider: "deepseek-web" } as never,
        {
          sessionId: "deepseek-web-test-json-tool-calls",
          messages: [{ role: "user", content: "打开浏览器搜索雅虎财经网站" }],
          tools: [
            {
              name: "browser",
              description: "Control the browser.",
              parameters: {
                type: "object",
                properties: {
                  action: { type: "string" },
                  url: { type: "string" },
                },
                required: ["action"],
              },
            },
          ],
        } as never,
        {} as never,
      ) as AsyncIterable<unknown>,
    );

    const eventTypes = events.map((event) => (event as { type?: string }).type);
    expect(eventTypes).toContain("toolcall_start");
    expect(eventTypes).toContain("toolcall_end");
    const done = events.find((event) => (event as { type?: string }).type === "done") as
      | {
          reason?: string;
          message?: {
            content?: { type?: string; id?: string; name?: string; arguments?: unknown }[];
          };
        }
      | undefined;
    expect(done?.reason).toBe("toolUse");
    expect(done?.message?.content).toContainEqual({
      type: "toolCall",
      id: "json_browser",
      name: "browser",
      arguments: { action: "open", url: "https://finance.yahoo.com" },
    });
  });

  it("normalizes file read and write tool aliases for DeepSeek JSON tool calls", async () => {
    mocks.chatCompletions.mockResolvedValue(
      createSseStream([
        'data: {"type":"text","content":"{\\"tool_calls\\":[{\\"id\\":\\"read_alias\\",\\"name\\":\\"read_file\\",\\"arguments\\":{\\"path\\":\\"package.json\\"}},{\\"id\\":\\"write_alias\\",\\"name\\":\\"write_file\\",\\"arguments\\":{\\"path\\":\\"tmp/deepseek.txt\\",\\"content\\":\\"ok\\"}}]}"}',
        "data: [DONE]",
      ]),
    );

    const streamFn = createDeepseekWebStreamFn("cookie=value");
    const events = await collect(
      streamFn(
        { id: "deepseek-reasoner", api: "deepseek-web", provider: "deepseek-web" } as never,
        {
          sessionId: "deepseek-web-test-file-tool-aliases",
          messages: [{ role: "user", content: "读取 package.json 并写入 tmp/deepseek.txt" }],
          tools: [
            {
              name: "read",
              description: "Read a file from the workspace.",
              parameters: {
                type: "object",
                properties: { path: { type: "string" } },
                required: ["path"],
              },
            },
            {
              name: "write",
              description: "Write a file in the workspace.",
              parameters: {
                type: "object",
                properties: {
                  path: { type: "string" },
                  content: { type: "string" },
                },
                required: ["path", "content"],
              },
            },
          ],
        } as never,
        {} as never,
      ) as AsyncIterable<unknown>,
    );

    const toolEnds = events.filter((event) => (event as { type?: string }).type === "toolcall_end");
    expect(toolEnds).toHaveLength(2);

    const done = events.find((event) => (event as { type?: string }).type === "done") as
      | {
          reason?: string;
          message?: {
            content?: { type?: string; id?: string; name?: string; arguments?: unknown }[];
          };
        }
      | undefined;
    expect(done?.reason).toBe("toolUse");
    expect(done?.message?.content).toContainEqual({
      type: "toolCall",
      id: "read_alias",
      name: "read",
      arguments: { path: "package.json" },
    });
    expect(done?.message?.content).toContainEqual({
      type: "toolCall",
      id: "write_alias",
      name: "write",
      arguments: { path: "tmp/deepseek.txt", content: "ok" },
    });
  });

  it("repeats the concrete tool inventory on incremental turns", async () => {
    mocks.chatCompletions
      .mockResolvedValueOnce(
        createSseStream(['data: {"response_message_id": 2, "type":"text","content":"Ready"}']),
      )
      .mockResolvedValueOnce(createSseStream(["data: [DONE]"]));

    const streamFn = createDeepseekWebStreamFn("cookie=value");
    const model = { id: "deepseek-reasoner", api: "deepseek-web", provider: "deepseek-web" };
    const context = {
      sessionId: "deepseek-web-test-incremental-tools",
      messages: [{ role: "user", content: "Start" }],
      tools: [
        {
          name: "read_file",
          description: "Read a file from the workspace.",
          parameters: {
            type: "object",
            properties: { path: { type: "string" } },
            required: ["path"],
          },
        },
      ],
    };

    await drain(streamFn(model as never, context as never, {} as never) as AsyncIterable<unknown>);
    await drain(
      streamFn(
        model as never,
        { ...context, messages: [{ role: "user", content: "Read package.json" }] } as never,
        {} as never,
      ) as AsyncIterable<unknown>,
    );

    const incrementalRequest = mocks.chatCompletions.mock.calls[1]?.[0] as { message?: string };
    expect(incrementalRequest.message).toContain("[SYSTEM REMINDER]");
    expect(incrementalRequest.message).toContain("### Available Tools");
    expect(incrementalRequest.message).toContain("#### read_file");
    expect(incrementalRequest.message).toContain("Read package.json");
  });

  it("preserves tool inventory when trimming long first-turn history", async () => {
    const streamFn = createDeepseekWebStreamFn("cookie=value");
    const stream = streamFn(
      { id: "deepseek-reasoner", api: "deepseek-web", provider: "deepseek-web" } as never,
      {
        sessionId: "deepseek-web-test-long-history-tools",
        systemPrompt: "system ".repeat(20000),
        messages: [
          {
            role: "user",
            content:
              "[Tue 2026-05-19 01:39 GMT+8] OPENAEON runtime context (internal):\n[Internal task completion event]\nResult mentions preview_url and should not steer this run.",
          },
          { role: "assistant", content: "" },
          { role: "assistant", content: "Old assistant claimed preview_url exists." },
          { role: "user", content: "用浏览器打开雅虎财经官网" },
        ],
        tools: [
          {
            name: "browser",
            description: "Control the browser.",
            parameters: {
              type: "object",
              properties: {
                action: { type: "string" },
                url: { type: "string" },
              },
              required: ["action"],
            },
          },
        ],
      } as never,
      {} as never,
    );

    await drain(stream as AsyncIterable<unknown>);

    const request = mocks.chatCompletions.mock.calls[0]?.[0] as { message?: string };
    expect(request.message).toContain("--- SYSTEM CONTEXT ---");
    expect(request.message).toContain("### Available Tools");
    expect(request.message).toContain("#### browser");
    expect(request.message).toContain("用浏览器打开雅虎财经官网");
    expect(request.message).not.toContain("OPENAEON runtime context (internal)");
    expect(request.message).not.toContain("Result mentions preview_url");
    expect(request.message).not.toContain("Old assistant claimed preview_url exists.");
  });

  it("suppresses internal shared-context XML blocks from assistant output", async () => {
    mocks.chatCompletions.mockResolvedValue(
      createSseStream([
        'data: {"type":"text","content":"Visible before. <update_shared_context>"}',
        'data: {"type":"text","content":"{\\"cognitiveDepth\\":1,\\"action\\":\\"Opening browser\\"}"}',
        'data: {"type":"text","content":"</update_shared_context> Visible after."}',
        "data: [DONE]",
      ]),
    );

    const streamFn = createDeepseekWebStreamFn("cookie=value");
    const events = await collect(
      streamFn(
        { id: "deepseek-reasoner", api: "deepseek-web", provider: "deepseek-web" } as never,
        {
          sessionId: "deepseek-web-test-internal-tags",
          messages: [{ role: "user", content: "Summarize result" }],
          tools: [],
        } as never,
        {} as never,
      ) as AsyncIterable<unknown>,
    );

    const done = events.find((event) => (event as { type?: string }).type === "done") as
      | { message?: { content?: { type?: string; text?: string }[] } }
      | undefined;
    const text = done?.message?.content?.find((part) => part.type === "text")?.text;
    expect(text).toBe("Visible before.  Visible after.");
    expect(text).not.toContain("update_shared_context");
    expect(text).not.toContain("cognitiveDepth");
  });

  it("does not stream scratchpad text and replaces it in the final message", async () => {
    mocks.chatCompletions.mockResolvedValue(
      createSseStream([
        'data: {"type":"text","content":"The user has a TODO list with 5 items. Let me analyze the request:\\n\\n1. Search memory\\n2. Spawn a sub-agent\\nActually, let me just dive in."}',
        "data: [DONE]",
      ]),
    );

    const streamFn = createDeepseekWebStreamFn("cookie=value");
    const events = await collect(
      streamFn(
        { id: "deepseek-reasoner", api: "deepseek-web", provider: "deepseek-web" } as never,
        {
          sessionId: "deepseek-web-test-scratchpad-final",
          messages: [{ role: "user", content: "你是哪个模型" }],
          tools: [],
        } as never,
        {} as never,
      ) as AsyncIterable<unknown>,
    );

    expect(events.some((event) => (event as { type?: string }).type === "text_delta")).toBe(false);
    const done = events.find((event) => (event as { type?: string }).type === "done") as
      | { message?: { content?: { type?: string; text?: string }[] } }
      | undefined;
    const text = done?.message?.content?.find((part) => part.type === "text")?.text;
    expect(text).toBe("我是 OPENAEON 当前配置的 DeepSeek Web 提供方模型（deepseek-reasoner）。");
  });

  it("supports dynamic discovery of new tools and skill logic in fallback message", async () => {
    mocks.chatCompletions.mockResolvedValue(
      createSseStream([
        'data: {"type":"text","content":"The user has a TODO list with 5 items. Let me analyze the request:\\n\\n1. Search memory\\n2. Spawn a sub-agent\\nActually, let me just dive in. <tool_call id=\\"toolu_999\\" name=\\"evolved_weather_tool\\">{\\"city\\":\\"Shanghai\\"}</tool_call>"}',
        "data: [DONE]",
      ]),
    );

    const streamFn = createDeepseekWebStreamFn("cookie=value");
    const events = await collect(
      streamFn(
        { id: "deepseek-reasoner", api: "deepseek-web", provider: "deepseek-web" } as never,
        {
          sessionId: "deepseek-web-test-dynamic-tool-discovery",
          messages: [{ role: "user", content: "What is the weather?" }],
          tools: [
            {
              name: "evolved_weather_tool",
              description: "Query real-time weather information for a specific city.",
              parameters: {
                type: "object",
                properties: { city: { type: "string" } },
                required: ["city"],
              },
            },
          ],
        } as never,
        {} as never,
      ) as AsyncIterable<unknown>,
    );

    const done = events.find((event) => (event as { type?: string }).type === "done") as
      | { message?: { content?: { type?: string; text?: string }[] } }
      | undefined;
    const text = done?.message?.content?.find((part) => part.type === "text")?.text;
    expect(text).toContain("调用系统工具 evolved_weather_tool");
    expect(text).toContain("Query real-time weather information for a specific city");
  });
});
