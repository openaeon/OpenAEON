import fs from "node:fs";
import path from "node:path";
import JSON5 from "json5";
import { parseConfigJson5, readConfigFileSnapshot } from "../config/config.js";
import { validateConfigObjectWithPlugins } from "../config/validation.js";
import { resolveConfigPath, resolveStateDir } from "../config/paths.js";
import type { ConfigValidationIssue } from "../config/types.js";

export type ConfigIssueKind =
  | "invalid_json"
  | "schema_violation"
  | "missing_gateway_mode"
  | "missing_model"
  | "plugin_not_found"
  | "channel_auth_missing"
  | "legacy_key";

export interface ConfigIssue {
  kind: ConfigIssueKind;
  /** JSON path in config file (e.g. "gateway.mode") */
  path: string;
  message: string;
  /** Optional suggested fix command or action */
  suggestedFix?: string;
  /** Structured fix data for auto-repair */
  fixData?: {
    action: "set" | "unset";
    path: string;
    value?: any;
  };
}

export interface ConfigAuditResult {
  configPath: string;
  valid: boolean;
  issues: ConfigIssue[];
  warnings: ConfigIssue[];
}

/**
 * Reads the OpenAEON config file, parses and validates it using the full
 * validation pipeline (`validateConfigObjectWithPlugins`), and returns
 * structured issues with human-readable fix suggestions.
 *
 * This function is safe to call with no side-effects — it only reads, never writes.
 */
export async function auditConfig(): Promise<ConfigAuditResult> {
  const env = process.env;
  const stateDir = resolveStateDir(env);
  const configPath = resolveConfigPath(env, stateDir);

  // 1. Check if config file exists
  if (!fs.existsSync(configPath)) {
    return {
      configPath,
      valid: false,
      issues: [
        {
          kind: "missing_gateway_mode",
          path: "<root>",
          message: "Config file does not exist.",
          suggestedFix: "openaeon setup",
        },
      ],
      warnings: [],
    };
  }

  // 2. Parse JSON5
  let raw: string;
  try {
    raw = fs.readFileSync(configPath, "utf-8");
  } catch (err) {
    return {
      configPath,
      valid: false,
      issues: [
        {
          kind: "invalid_json",
          path: "<root>",
          message: `Cannot read config file: ${String(err)}`,
        },
      ],
      warnings: [],
    };
  }

  const parseResult = parseConfigJson5(raw);
  if (!parseResult.ok) {
    return {
      configPath,
      valid: false,
      issues: [
        {
          kind: "invalid_json",
          path: "<root>",
          message: `Config parse error: ${parseResult.error}`,
          suggestedFix: "Fix the JSON5 syntax error in the config file.",
        },
      ],
      warnings: [],
    };
  }

  // 3. Full schema + plugin validation
  const validated = validateConfigObjectWithPlugins(parseResult.parsed);

  // 4. Map issues → ConfigIssue with fix hints
  function toConfigIssue(iss: ConfigValidationIssue): ConfigIssue {
    const kind = classifyIssue(iss.path, iss.message);
    return {
      kind,
      path: iss.path || "<root>",
      message: iss.message,
      suggestedFix: generateFixHint(kind, iss.path, iss.message),
      fixData: generateFixData(kind, iss.path, iss.message),
    };
  }

  if (!validated.ok) {
    return {
      configPath,
      valid: false,
      issues: validated.issues.map(toConfigIssue),
      warnings: validated.warnings?.map(toConfigIssue) ?? [],
    };
  }

  // 5. Cross-field checks not covered by schema
  const extraIssues: ConfigIssue[] = [];
  const cfg = validated.config;

  // gateway.mode must be set
  if (!cfg.gateway?.mode) {
    extraIssues.push({
      kind: "missing_gateway_mode",
      path: "gateway.mode",
      message: "gateway.mode is not set. Gateway will refuse to start.",
      suggestedFix: 'openaeon config set gateway.mode "local"',
    });
  }

  // At least one model must be configured
  const hasDefaultModel =
    !!cfg.agents?.defaults?.model ||
    (Array.isArray(cfg.agents?.list) && cfg.agents.list.some((a) => !!a?.model));
  if (!hasDefaultModel) {
    extraIssues.push({
      kind: "missing_model",
      path: "agents.defaults.model",
      message: "No default AI model is configured. Agents will be unable to respond.",
      suggestedFix: 'openaeon config set agents.defaults.model "openai/gpt-4o"',
      fixData: {
        action: "set",
        path: "agents.defaults.model",
        value: "openai/gpt-4o",
      },
    });
  }

  return {
    configPath,
    valid: extraIssues.length === 0,
    issues: extraIssues,
    warnings: validated.warnings?.map(toConfigIssue) ?? [],
  };
}

function classifyIssue(issuePath: string, message: string): ConfigIssueKind {
  if (!issuePath || issuePath === "<root>") return "schema_violation";
  if (issuePath.startsWith("plugins")) return "plugin_not_found";
  if (issuePath.startsWith("gateway.mode")) return "missing_gateway_mode";
  if (issuePath.startsWith("channels")) return "channel_auth_missing";
  if (message.toLowerCase().includes("legacy") || message.toLowerCase().includes("removed"))
    return "legacy_key";
  return "schema_violation";
}

function generateFixHint(
  kind: ConfigIssueKind,
  issuePath: string,
  _message: string,
): string | undefined {
  switch (kind) {
    case "missing_gateway_mode":
      return 'openaeon config set gateway.mode "local"';
    case "missing_model":
      return 'openaeon config set agents.defaults.model "openai/gpt-4o"';
    case "plugin_not_found":
      return `openaeon config unset ${issuePath}  # remove stale plugin reference`;
    case "channel_auth_missing":
      return "openaeon channels connect  # re-authenticate channels";
    case "legacy_key":
      return `openaeon config unset ${issuePath}  # remove legacy key`;
    default:
      return undefined;
  }
}

function generateFixData(
  kind: ConfigIssueKind,
  issuePath: string,
  _message: string,
): ConfigIssue["fixData"] | undefined {
  switch (kind) {
    case "missing_gateway_mode":
      return { action: "set", path: "gateway.mode", value: "local" };
    case "missing_model":
      return { action: "set", path: "agents.defaults.model", value: "openai/gpt-4o" };
    case "plugin_not_found":
      return { action: "unset", path: issuePath };
    case "legacy_key":
      return { action: "unset", path: issuePath };
    default:
      return undefined;
  }
}
