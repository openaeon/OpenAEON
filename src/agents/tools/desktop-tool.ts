import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import { runCommandWithTimeout, type SpawnResult } from "../../process/exec.js";
import { resolveOPENAEONPackageRootSync } from "../../infra/openaeon-root.js";
import { DesktopToolSchema } from "./desktop-tool.schema.js";
import {
  type AnyAgentTool,
  ToolInputError,
  jsonResult,
  readNumberParam,
  readStringParam,
} from "./common.js";

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_CHARS = 80_000;

const READ_ONLY_ACTIONS = new Set(["status", "permissions", "see", "inspect_ui", "image", "list"]);
const DEFAULT_OPENAEON_BRIDGE_SOCKET = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "OpenAEON",
  "bridge.sock",
);

type DesktopToolDeps = {
  runCommand?: typeof runCommandWithTimeout;
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
};

function readBool(params: Record<string, unknown>, key: string, fallback = false): boolean {
  const raw = params[key];
  return typeof raw === "boolean" ? raw : fallback;
}

function readInt(params: Record<string, unknown>, key: string): number | undefined {
  return readNumberParam(params, key, { integer: true });
}

function pushStringFlag(argv: string[], flag: string, value?: string) {
  if (value) {
    argv.push(flag, value);
  }
}

function pushNumberFlag(argv: string[], flag: string, value?: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    argv.push(flag, String(Math.trunc(value)));
  }
}

function pushBooleanFlag(argv: string[], enabled: boolean, flag: string) {
  if (enabled) {
    argv.push(flag);
  }
}

function pushTargetFlags(argv: string[], params: Record<string, unknown>) {
  pushStringFlag(argv, "--app", readStringParam(params, "app"));
  pushNumberFlag(argv, "--pid", readInt(params, "pid"));
  pushStringFlag(argv, "--window-title", readStringParam(params, "windowTitle"));
  pushNumberFlag(argv, "--window-id", readInt(params, "windowId"));
  pushNumberFlag(argv, "--window-index", readInt(params, "windowIndex"));
}

function pushSnapshotFlag(argv: string[], params: Record<string, unknown>) {
  pushStringFlag(argv, "--snapshot", readStringParam(params, "snapshot"));
}

function pushTraversalFlags(argv: string[], params: Record<string, unknown>) {
  pushNumberFlag(argv, "--max-depth", readInt(params, "maxDepth"));
  pushNumberFlag(argv, "--max-elements", readInt(params, "maxElements"));
  pushNumberFlag(argv, "--max-children", readInt(params, "maxChildren"));
}

function parseCliOutput(result: SpawnResult) {
  const stdout = result.stdout.trim();
  const stderr = result.stderr.trim();
  let parsed: unknown;
  if (stdout) {
    try {
      parsed = JSON.parse(stdout);
    } catch {
      parsed = undefined;
    }
  }
  return {
    ok: result.code === 0,
    code: result.code,
    signal: result.signal,
    termination: result.termination,
    stdout: truncate(stdout),
    stderr: truncate(stderr),
    json: parsed,
  };
}

function truncate(text: string): string {
  if (text.length <= MAX_OUTPUT_CHARS) {
    return text;
  }
  return `${text.slice(0, MAX_OUTPUT_CHARS)}\n... [truncated ${text.length - MAX_OUTPUT_CHARS} chars]`;
}

function buildBaseArgv(params: Record<string, unknown>, env: NodeJS.ProcessEnv): string[] {
  const bridgeSocket =
    readStringParam(params, "bridgeSocket") ||
    env.OPENAEON_PEEKABOO_BRIDGE_SOCKET ||
    env.PEEKABOO_BRIDGE_SOCKET ||
    DEFAULT_OPENAEON_BRIDGE_SOCKET;
  const argv: string[] = [];
  pushBooleanFlag(argv, readBool(params, "noRemote"), "--no-remote");
  pushStringFlag(argv, "--bridge-socket", bridgeSocket);
  return argv;
}

function buildPeekabooArgv(params: Record<string, unknown>, env: NodeJS.ProcessEnv): string[] {
  const action = readStringParam(params, "action", { required: true });
  const argv = buildBaseArgv(params, env);

  switch (action) {
    case "status":
      argv.push("bridge", "status", "--json");
      return argv;
    case "permissions":
      argv.push("permissions", "status", "--json");
      return argv;
    case "inspect_ui":
    case "see":
      argv.push("see", "--json");
      pushTargetFlags(argv, params);
      pushStringFlag(argv, "--mode", readStringParam(params, "mode"));
      pushNumberFlag(argv, "--screen-index", readInt(params, "screenIndex"));
      pushStringFlag(argv, "--path", readStringParam(params, "outputPath"));
      pushBooleanFlag(argv, readBool(params, "annotate"), "--annotate");
      pushBooleanFlag(argv, readBool(params, "menubar"), "--menubar");
      pushStringFlag(argv, "--analyze", readStringParam(params, "analyze"));
      pushTraversalFlags(argv, params);
      return argv;
    case "image":
      argv.push("image", "--json");
      pushTargetFlags(argv, params);
      pushStringFlag(argv, "--mode", readStringParam(params, "mode"));
      pushNumberFlag(argv, "--screen-index", readInt(params, "screenIndex"));
      pushStringFlag(argv, "--path", readStringParam(params, "outputPath"));
      pushBooleanFlag(argv, readBool(params, "retina"), "--retina");
      pushStringFlag(argv, "--analyze", readStringParam(params, "analyze"));
      return argv;
    case "list":
      argv.push("list", readStringParam(params, "kind", { required: true }), "--json");
      pushTargetFlags(argv, params);
      return argv;
    case "click": {
      argv.push("click");
      const query = readStringParam(params, "query");
      if (query) argv.push(query);
      pushStringFlag(argv, "--on", readStringParam(params, "on"));
      pushStringFlag(argv, "--coords", readStringParam(params, "coords"));
      pushSnapshotFlag(argv, params);
      pushTargetFlags(argv, params);
      pushNumberFlag(argv, "--wait-for", readInt(params, "waitForMs"));
      const clickType = readStringParam(params, "clickType");
      pushBooleanFlag(argv, clickType === "double", "--double");
      pushBooleanFlag(argv, clickType === "right", "--right");
      pushBooleanFlag(argv, readBool(params, "globalCoords"), "--global-coords");
      argv.push("--json");
      return argv;
    }
    case "type":
      argv.push("type", readStringParam(params, "text", { required: true }));
      pushStringFlag(argv, "--on", readStringParam(params, "on"));
      pushSnapshotFlag(argv, params);
      pushTargetFlags(argv, params);
      pushBooleanFlag(argv, readBool(params, "clear"), "--clear");
      pushNumberFlag(argv, "--delay", readInt(params, "delayMs"));
      argv.push("--json");
      return argv;
    case "set_value":
      argv.push("set-value");
      pushStringFlag(argv, "--on", readStringParam(params, "on", { required: true }));
      pushStringFlag(argv, "--value", readStringParam(params, "value", { required: true }));
      pushSnapshotFlag(argv, params);
      argv.push("--json");
      return argv;
    case "perform_action":
      argv.push("perform-action");
      pushStringFlag(argv, "--on", readStringParam(params, "on", { required: true }));
      pushStringFlag(argv, "--action", readStringParam(params, "axAction", { required: true }));
      pushSnapshotFlag(argv, params);
      argv.push("--json");
      return argv;
    case "press":
      argv.push("press", readStringParam(params, "key", { required: true }));
      pushNumberFlag(argv, "--count", readInt(params, "count"));
      pushNumberFlag(argv, "--delay", readInt(params, "delayMs"));
      argv.push("--json");
      return argv;
    case "hotkey":
      argv.push("hotkey", readStringParam(params, "keys", { required: true }));
      pushTargetFlags(argv, params);
      argv.push("--json");
      return argv;
    case "scroll":
      argv.push("scroll");
      pushStringFlag(argv, "--on", readStringParam(params, "on"));
      pushStringFlag(argv, "--direction", readStringParam(params, "direction"));
      pushNumberFlag(argv, "--amount", readInt(params, "amount"));
      pushSnapshotFlag(argv, params);
      pushTargetFlags(argv, params);
      pushBooleanFlag(argv, readBool(params, "smooth"), "--smooth");
      argv.push("--json");
      return argv;
    case "move":
      argv.push("move", readStringParam(params, "to", { required: true }));
      pushNumberFlag(argv, "--duration", readInt(params, "durationMs"));
      pushNumberFlag(argv, "--steps", readInt(params, "steps"));
      pushStringFlag(argv, "--profile", readStringParam(params, "profile"));
      argv.push("--json");
      return argv;
    case "window":
      return buildWindowArgv(argv, params);
    case "app":
      return buildAppArgv(argv, params);
    case "menu":
      return buildMenuArgv(argv, params);
    case "menubar":
      return buildMenubarArgv(argv, params);
    case "dock":
      return buildDockArgv(argv, params);
    case "dialog":
      return buildDialogArgv(argv, params);
    case "sleep":
      argv.push("sleep", "--duration", String(readInt(params, "durationMs") ?? 250));
      argv.push("--json");
      return argv;
    case "clean":
      argv.push("clean");
      if (readStringParam(params, "cleanScope") === "all_snapshots") {
        argv.push("--all-snapshots");
      } else {
        pushStringFlag(argv, "--snapshot", readStringParam(params, "snapshot"));
      }
      argv.push("--json");
      return argv;
    default:
      throw new ToolInputError(`Unsupported desktop action: ${action}`);
  }
}

function buildWindowArgv(argv: string[], params: Record<string, unknown>): string[] {
  const subaction = readStringParam(params, "subaction", { required: true });
  argv.push("window", subaction === "set_bounds" ? "set-bounds" : subaction);
  pushTargetFlags(argv, params);
  pushNumberFlag(argv, "--x", readNumberParam(params, "x"));
  pushNumberFlag(argv, "--y", readNumberParam(params, "y"));
  pushNumberFlag(argv, "--width", readNumberParam(params, "width"));
  pushNumberFlag(argv, "--height", readNumberParam(params, "height"));
  argv.push("--json");
  return argv;
}

function buildAppArgv(argv: string[], params: Record<string, unknown>): string[] {
  const subaction = readStringParam(params, "subaction", { required: true });
  argv.push("app", subaction);
  pushStringFlag(argv, "--app", readStringParam(params, "app") || readStringParam(params, "name"));
  argv.push("--json");
  return argv;
}

function buildMenuArgv(argv: string[], params: Record<string, unknown>): string[] {
  const subaction = readStringParam(params, "subaction", { required: true });
  argv.push(
    "menu",
    subaction === "list_all" ? "list-all" : subaction === "click_extra" ? "click-extra" : subaction,
  );
  pushTargetFlags(argv, params);
  pushStringFlag(argv, "--item", readStringParam(params, "item"));
  pushStringFlag(argv, "--path", readStringParam(params, "menuPath"));
  pushStringFlag(argv, "--title", readStringParam(params, "title"));
  argv.push("--json");
  return argv;
}

function buildMenubarArgv(argv: string[], params: Record<string, unknown>): string[] {
  const subaction = readStringParam(params, "subaction", { required: true });
  argv.push("menubar", subaction);
  pushStringFlag(
    argv,
    "--title",
    readStringParam(params, "title") || readStringParam(params, "name"),
  );
  pushNumberFlag(argv, "--index", readInt(params, "windowIndex"));
  argv.push("--json");
  return argv;
}

function buildDockArgv(argv: string[], params: Record<string, unknown>): string[] {
  const subaction = readStringParam(params, "subaction", { required: true });
  argv.push("dock", subaction === "right_click" ? "right-click" : subaction);
  pushStringFlag(argv, "--app", readStringParam(params, "app") || readStringParam(params, "name"));
  pushStringFlag(argv, "--select", readStringParam(params, "item"));
  argv.push("--json");
  return argv;
}

function buildDialogArgv(argv: string[], params: Record<string, unknown>): string[] {
  const subaction = readStringParam(params, "subaction", { required: true });
  argv.push("dialog", subaction);
  pushTargetFlags(argv, params);
  pushStringFlag(
    argv,
    "--button",
    readStringParam(params, "item") || readStringParam(params, "title"),
  );
  pushStringFlag(argv, "--text", readStringParam(params, "text"));
  pushStringFlag(argv, "--file", readStringParam(params, "filePath"));
  argv.push("--json");
  return argv;
}

export function createDesktopTool(deps: DesktopToolDeps = {}): AnyAgentTool {
  const env = deps.env ?? process.env;
  const runCommand = deps.runCommand ?? runCommandWithTimeout;
  const platform = deps.platform ?? process.platform;

  return {
    label: "Desktop",
    name: "desktop",
    ownerOnly: true,
    description: [
      "Control and inspect the local macOS desktop through Peekaboo.",
      "Use status/permissions first when unsure. Use inspect_ui or see before click/type/set_value/perform_action.",
      "Element IDs and snapshots are short-lived; observe again after mutating UI.",
      "The tool defaults to OpenAEON.app's PeekabooBridge socket; pass bridgeSocket only when intentionally targeting another signed host.",
      "This is owner-only because click/type/hotkey/window/app/dialog actions affect the user's desktop.",
    ].join(" "),
    parameters: DesktopToolSchema,
    execute: async (_toolCallId, args): Promise<AgentToolResult<unknown>> => {
      if (platform !== "darwin") {
        throw new ToolInputError("desktop is only available on macOS.");
      }
      const params = (args ?? {}) as Record<string, unknown>;
      const action = readStringParam(params, "action", { required: true });
      const argv = buildPeekabooArgv(params, env);
      const timeoutMs = readInt(params, "timeoutMs") ?? DEFAULT_TIMEOUT_MS;
      const localBin = path.join(
        resolveOPENAEONPackageRootSync({ cwd: process.cwd() }) || process.cwd(),
        "bin",
        "peekaboo",
      );
      const envBin = env.OPENAEON_PEEKABOO_BIN || env.PEEKABOO_BIN;
      const bin = envBin || (fs.existsSync(localBin) ? localBin : "peekaboo");
      const result = await runCommand([bin, ...argv], { timeoutMs });
      const payload = parseCliOutput(result);
      if (!payload.ok) {
        const hint = READ_ONLY_ACTIONS.has(action)
          ? "Check that Peekaboo is installed and the OpenAEON Peekaboo Bridge is enabled in the macOS app."
          : "Check permissions, observe the UI again, and retry only after confirming the target.";
        throw new Error(`desktop ${action} failed: ${payload.stderr || payload.stdout || hint}`);
      }
      return jsonResult({
        ...payload,
        action,
        argv: ["peekaboo", ...argv],
      });
    },
  };
}

export const __testing = {
  DEFAULT_OPENAEON_BRIDGE_SOCKET,
  buildPeekabooArgv,
};
