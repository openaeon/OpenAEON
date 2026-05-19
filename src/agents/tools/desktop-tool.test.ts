import { describe, expect, it, vi } from "vitest";
import { createDesktopTool, __testing } from "./desktop-tool.js";

describe("desktop tool", () => {
  it("builds see argv against the OpenAEON bridge socket", () => {
    expect(
      __testing.buildPeekabooArgv(
        {
          action: "see",
          app: "Safari",
          windowTitle: "Login",
          annotate: true,
          outputPath: "/tmp/see.png",
          maxElements: 1500,
        },
        {},
      ),
    ).toEqual([
      "--bridge-socket",
      __testing.DEFAULT_OPENAEON_BRIDGE_SOCKET,
      "see",
      "--json",
      "--app",
      "Safari",
      "--window-title",
      "Login",
      "--path",
      "/tmp/see.png",
      "--annotate",
      "--max-elements",
      "1500",
    ]);
  });

  it("maps inspect_ui to a JSON see observation for the CLI adapter", () => {
    expect(
      __testing.buildPeekabooArgv(
        {
          action: "inspect_ui",
          bridgeSocket: "/tmp/open.sock",
          app: "Calculator",
        },
        {},
      ),
    ).toEqual(["--bridge-socket", "/tmp/open.sock", "see", "--json", "--app", "Calculator"]);
  });

  it("builds target-relative click argv without shell escaping", () => {
    expect(
      __testing.buildPeekabooArgv(
        {
          action: "click",
          app: "Safari",
          coords: "20,40",
          clickType: "double",
          waitForMs: 8000,
        },
        { OPENAEON_PEEKABOO_BRIDGE_SOCKET: "/tmp/bridge.sock" },
      ),
    ).toEqual([
      "--bridge-socket",
      "/tmp/bridge.sock",
      "click",
      "--coords",
      "20,40",
      "--app",
      "Safari",
      "--wait-for",
      "8000",
      "--double",
      "--json",
    ]);
  });

  it("runs the configured Peekaboo binary and returns parsed JSON", async () => {
    const runCommand = vi.fn(async () => ({
      stdout: '{"data":{"ok":true}}',
      stderr: "",
      code: 0,
      signal: null,
      killed: false,
      termination: "exit" as const,
    }));
    const tool = createDesktopTool({
      runCommand,
      platform: "darwin",
      env: {
        OPENAEON_PEEKABOO_BIN: "/opt/bin/peekaboo",
        OPENAEON_PEEKABOO_BRIDGE_SOCKET: "/tmp/bridge.sock",
      },
    });

    const result = await tool.execute("call-1", { action: "permissions" });

    expect(runCommand).toHaveBeenCalledWith(
      [
        "/opt/bin/peekaboo",
        "--bridge-socket",
        "/tmp/bridge.sock",
        "permissions",
        "status",
        "--json",
      ],
      { timeoutMs: 30000 },
    );
    expect(result.details).toMatchObject({
      ok: true,
      json: { data: { ok: true } },
      action: "permissions",
    });
  });

  it("rejects non-macOS hosts", async () => {
    const tool = createDesktopTool({ platform: "linux" });
    await expect(tool.execute("call-1", { action: "status" })).rejects.toThrow(
      /only available on macOS/,
    );
  });
});
