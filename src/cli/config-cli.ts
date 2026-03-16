import type { Command } from "commander";
import JSON5 from "json5";
import {
  getConfigAtPath,
  parseConfigPath,
  readConfigFileSnapshot,
  setConfigAtPath,
  unsetConfigAtPath,
  writeConfigFile,
} from "../config/config.js";
import { isBlockedObjectKey } from "../config/prototype-keys.js";
import { redactConfigObject } from "../config/redact-snapshot.js";
import { danger, info } from "../globals.js";
import type { RuntimeEnv } from "../runtime.js";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../terminal/links.js";
import { theme } from "../terminal/theme.js";
import { shortenHomePath } from "../utils.js";
import { formatCliCommand } from "./command-format.js";

type PathSegment = string;
type ConfigSetParseOpts = {
  strictJson?: boolean;
};

const OLLAMA_API_KEY_PATH: PathSegment[] = ["models", "providers", "ollama", "apiKey"];
const OLLAMA_PROVIDER_PATH: PathSegment[] = ["models", "providers", "ollama"];
const OLLAMA_DEFAULT_BASE_URL = "http://127.0.0.1:11434";

function parseValue(raw: string, opts: ConfigSetParseOpts): unknown {
  const trimmed = raw.trim();
  if (opts.strictJson) {
    try {
      return JSON5.parse(trimmed);
    } catch (err) {
      throw new Error(`Failed to parse JSON5 value: ${String(err)}`, { cause: err });
    }
  }

  try {
    return JSON5.parse(trimmed);
  } catch {
    return raw;
  }
}

async function loadValidConfig(runtime: RuntimeEnv = defaultRuntime) {
  const snapshot = await readConfigFileSnapshot();
  if (snapshot.valid) {
    return snapshot;
  }
  runtime.error(`Config invalid at ${shortenHomePath(snapshot.path)}.`);
  for (const issue of snapshot.issues) {
    runtime.error(`- ${issue.path || "<root>"}: ${issue.message}`);
  }
  runtime.error(`Run \`${formatCliCommand("openaeon doctor")}\` to repair, then retry.`);
  runtime.exit(1);
  return snapshot;
}

function pathEquals(path: PathSegment[], expected: PathSegment[]): boolean {
  return (
    path.length === expected.length && path.every((segment, index) => segment === expected[index])
  );
}

function ensureValidOllamaProviderForApiKeySet(
  root: Record<string, unknown>,
  path: PathSegment[],
): void {
  if (!pathEquals(path, OLLAMA_API_KEY_PATH)) {
    return;
  }
  const existing = getConfigAtPath(root, OLLAMA_PROVIDER_PATH);
  if (existing.found) {
    return;
  }
  setConfigAtPath(root, OLLAMA_PROVIDER_PATH, {
    baseUrl: OLLAMA_DEFAULT_BASE_URL,
    api: "ollama",
    models: [],
  });
}

export async function runConfigGet(opts: { path: string; json?: boolean; runtime?: RuntimeEnv }) {
  const runtime = opts.runtime ?? defaultRuntime;
  try {
    const parsedPath = parseConfigPath(opts.path);
    const snapshot = await loadValidConfig(runtime);
    const redacted = redactConfigObject(snapshot.config);
    const res = getConfigAtPath(redacted, parsedPath);
    if (!res.found) {
      runtime.error(danger(`Config path not found: ${opts.path}`));
      runtime.exit(1);
      return;
    }
    if (opts.json) {
      runtime.log(JSON.stringify(res.value ?? null, null, 2));
      return;
    }
    if (
      typeof res.value === "string" ||
      typeof res.value === "number" ||
      typeof res.value === "boolean"
    ) {
      runtime.log(String(res.value));
      return;
    }
    runtime.log(JSON.stringify(res.value ?? null, null, 2));
  } catch (err) {
    runtime.error(danger(String(err)));
    runtime.exit(1);
  }
}

export async function runConfigUnset(opts: { path: string; runtime?: RuntimeEnv }) {
  const runtime = opts.runtime ?? defaultRuntime;
  try {
    const parsedPath = parseConfigPath(opts.path);
    const snapshot = await loadValidConfig(runtime);
    // instead of snapshot.config (runtime-merged with defaults).
    // This prevents runtime defaults from leaking into the written config file (issue #6070)
    const next = structuredClone(snapshot.resolved) as Record<string, unknown>;
    const removed = unsetConfigAtPath(next, parsedPath);
    if (!removed) {
      runtime.error(danger(`Config path not found: ${opts.path}`));
      runtime.exit(1);
      return;
    }
    await writeConfigFile(next, { unsetPaths: [parsedPath] });
    runtime.log(info(`Removed ${opts.path}. Restart the gateway to apply.`));
  } catch (err) {
    runtime.error(danger(String(err)));
    runtime.exit(1);
  }
}

export function registerConfigCli(program: Command) {
  const cmd = program
    .command("config")
    .description(
      "Non-interactive config helpers (get/set/unset). Run without subcommand for the setup wizard.",
    )
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/config", "docs.openaeon.ai/cli/config")}\n`,
    )
    .option(
      "--section <section>",
      "Configure wizard sections (repeatable). Use with no subcommand.",
      (value: string, previous: string[]) => [...previous, value],
      [] as string[],
    )
    .action(async (opts) => {
      const { configureCommandFromSectionsArg } = await import("../commands/configure.js");
      await configureCommandFromSectionsArg(opts.section, defaultRuntime);
    });

  cmd
    .command("get")
    .description("Get a config value by dot path")
    .argument("<path>", "Config path (dot or bracket notation)")
    .option("--json", "Output JSON", false)
    .action(async (path: string, opts) => {
      await runConfigGet({ path, json: Boolean(opts.json) });
    });

  cmd
    .command("set")
    .description("Set a config value by dot path")
    .argument("<path>", "Config path (dot or bracket notation)")
    .argument("<value>", "Value (JSON5 or raw string)")
    .option("--strict-json", "Strict JSON5 parsing (error instead of raw string fallback)", false)
    .option("--json", "Legacy alias for --strict-json", false)
    .action(async (path: string, value: string, opts) => {
      try {
        const parsedPath = parseConfigPath(path);
        const parsedValue = parseValue(value, {
          strictJson: Boolean(opts.strictJson || opts.json),
        });
        const snapshot = await loadValidConfig();
        // Use snapshot.resolved (config after $include and ${ENV} resolution, but BEFORE runtime defaults)
        // instead of snapshot.config (runtime-merged with defaults).
        // This prevents runtime defaults from leaking into the written config file (issue #6070)
        const next = structuredClone(snapshot.resolved) as Record<string, unknown>;
        ensureValidOllamaProviderForApiKeySet(next, parsedPath);
        setConfigAtPath(next, parsedPath, parsedValue);
        await writeConfigFile(next);
        defaultRuntime.log(info(`Updated ${path}. Restart the gateway to apply.`));
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });

  cmd
    .command("unset")
    .description("Remove a config value by dot path")
    .argument("<path>", "Config path (dot or bracket notation)")
    .action(async (path: string) => {
      await runConfigUnset({ path });
    });
}
