import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayRequestContext } from "./types.js";
import { cognitiveHandlers } from "./cognitive.js";

function makeContext(workspaceDir: string): GatewayRequestContext {
  return {
    workspaceDir,
    chatAbortControllers: new Map(),
    broadcast: vi.fn(),
  } as unknown as GatewayRequestContext;
}

describe("cognitive.source.read", () => {
  let workspaceDir = "";

  beforeEach(async () => {
    workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "openaeon-cognitive-source-"));
  });

  afterEach(async () => {
    if (workspaceDir) {
      await fs.rm(workspaceDir, { recursive: true, force: true });
    }
  });

  it("returns a contextual excerpt for workspace files", async () => {
    const filePath = path.join(workspaceDir, "src", "story.ts");
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(
      filePath,
      ["alpha", "beta", "gamma", "delta", "epsilon", "zeta"].join("\n"),
      "utf-8",
    );

    const respond = vi.fn();
    await cognitiveHandlers["cognitive.source.read"]({
      params: {
        path: "src/story.ts",
        startLine: 3,
        endLine: 4,
        contextLines: 1,
      },
      respond,
      context: makeContext(workspaceDir),
      req: { type: "req", id: "cognitive-source-read-test", method: "cognitive.source.read" },
    } as never);

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        ok: true,
        source: expect.objectContaining({
          path: "src/story.ts",
          startLine: 3,
          endLine: 4,
          contextStartLine: 2,
          contextEndLine: 5,
          lineCount: 6,
          excerpt: expect.stringContaining(">    3 | gamma"),
        }),
      }),
      undefined,
    );
  });

  it("rejects paths outside the workspace", async () => {
    const respond = vi.fn();
    await cognitiveHandlers["cognitive.source.read"]({
      params: {
        path: "../outside.ts",
        startLine: 1,
        endLine: 1,
      },
      respond,
      context: makeContext(workspaceDir),
      req: { type: "req", id: "cognitive-source-read-outside", method: "cognitive.source.read" },
    } as never);

    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        code: "COGNITIVE_SOURCE_READ_ERROR",
      }),
    );
  });
});
