import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DeepSeekWebClient,
  resolveDeepSeekWebModelType,
  resolveDeepSeekWebSearchEnabled,
  resolveDeepSeekWebThinkingEnabled,
} from "./deepseek-web-client.js";

describe("DeepSeek web model routing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("maps built-in model ids to official web completion flags", () => {
    expect(resolveDeepSeekWebModelType("deepseek-chat")).toBe("default");
    expect(resolveDeepSeekWebModelType("deepseek-reasoner")).toBe("default");
    expect(resolveDeepSeekWebModelType("deepseek-chat-expert")).toBe("expert");
    expect(resolveDeepSeekWebModelType("deepseek-vision")).toBe("vision");

    expect(resolveDeepSeekWebThinkingEnabled("deepseek-chat-search")).toBe(false);
    expect(resolveDeepSeekWebThinkingEnabled("deepseek-reasoner-search")).toBe(true);
    expect(resolveDeepSeekWebThinkingEnabled("deepseek-deep-thinking")).toBe(true);

    expect(resolveDeepSeekWebSearchEnabled("deepseek-chat")).toBe(false);
    expect(resolveDeepSeekWebSearchEnabled("deepseek-chat-search")).toBe(true);
    expect(resolveDeepSeekWebSearchEnabled("deepseek-chat-search", false)).toBe(false);
  });

  it("sends model_type plus model-derived thinking and search flags", async () => {
    const client = new DeepSeekWebClient({ cookie: "token=redacted" });
    vi.spyOn(client, "createPowChallenge").mockResolvedValue({
      algorithm: "sha256",
      challenge: "challenge",
      difficulty: 0,
      salt: "salt",
      signature: "signature",
    });
    vi.spyOn(client, "solvePow").mockResolvedValue(1);

    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(new ReadableStream(), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await client.chatCompletions({
      sessionId: "session-1",
      parentMessageId: null,
      message: "hello",
      model: "deepseek-chat-search",
    });

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers["x-client-version"]).toBe("2.0.0");
    expect(headers["x-app-version"]).toBe("2.0.0");
    expect(headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      chat_session_id: "session-1",
      parent_message_id: null,
      model_type: "default",
      prompt: "hello",
      ref_file_ids: [],
      thinking_enabled: false,
      search_enabled: true,
      preempt: false,
    });
  });

  it("discovers switchable model modes from client settings", async () => {
    const client = new DeepSeekWebClient({ cookie: "token=redacted" });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toContain("/api/v0/client/settings");
      expect(String(input)).toContain("scope=model");
      const headers = init?.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBeUndefined();
      expect(headers["x-client-version"]).toBe("2.0.0");
      expect(headers["x-app-version"]).toBe("2.0.0");
      return new Response(
        JSON.stringify({
          code: 0,
          data: {
            biz_code: 0,
            biz_data: {
              version: 1,
              settings: {
                model_configs: {
                  value: [
                    {
                      model_type: "default",
                      name: "快速模式",
                      enabled: true,
                      switchable: true,
                      input_character_limit: 32000,
                    },
                    {
                      model_type: "expert",
                      name: "专家模式",
                      enabled: true,
                      switchable: true,
                      search_feature: {},
                      file_feature: { token_limit: 64000, token_limit_with_thinking: 48000 },
                    },
                    {
                      model_type: "internal",
                      name: "Internal",
                      enabled: false,
                      switchable: true,
                    },
                  ],
                },
              },
            },
          },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const models = await client.discoverModels();

    expect(models.map((model) => model.id)).toEqual([
      "deepseek-chat",
      "deepseek-reasoner",
      "deepseek-chat-expert",
      "deepseek-reasoner-expert",
      "deepseek-chat-search",
      "deepseek-reasoner-search",
      "deepseek-chat-expert-search",
      "deepseek-reasoner-expert-search",
    ]);
    expect(models.find((model) => model.id === "deepseek-chat")?.name).toBe("快速模式");
    expect(models.find((model) => model.id === "deepseek-reasoner-expert")?.contextWindow).toBe(
      48000,
    );
  });

  it("extracts chat session ids from nested chat_session create responses", async () => {
    const client = new DeepSeekWebClient({ cookie: "token=redacted" });
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(
        JSON.stringify({
          code: 0,
          msg: "",
          data: {
            biz_code: 0,
            biz_msg: "",
            biz_data: {
              chat_session: {
                id: "fd5315b1-4c01-401a-8fa6-17e5e35d68f2",
                seq_id: 201214012,
                agent: "chat",
                model_type: "default",
                title: null,
              },
              ttl_seconds: 259200,
            },
          },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(client.createChatSession()).resolves.toMatchObject({
      chat_session_id: "fd5315b1-4c01-401a-8fa6-17e5e35d68f2",
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toEqual({ character_id: null });
  });

  it("omits JSON content-type for multipart file uploads", async () => {
    const client = new DeepSeekWebClient({ cookie: "token=redacted" });
    vi.spyOn(client, "createPowChallenge").mockResolvedValue({
      algorithm: "sha256",
      challenge: "challenge",
      difficulty: 0,
      salt: "salt",
      signature: "signature",
    });
    vi.spyOn(client, "solvePow").mockResolvedValue(1);

    const fetchMock = vi
      .fn(
        async (_input: RequestInfo | URL, _init?: RequestInit) =>
          new Response(
            JSON.stringify({
              data: { biz_data: { id: "file-1", files: [{ status: "SUCCESS" }] } },
            }),
            { status: 200 },
          ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { biz_data: { id: "file-1" } } }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { biz_data: { files: [{ status: "SUCCESS" }] } } }), {
          status: 200,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(client.uploadFile(Buffer.from("hello"), "hello.txt")).resolves.toBe("file-1");

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBeUndefined();
    expect(headers["x-file-size"]).toBe("5");
  });
});
