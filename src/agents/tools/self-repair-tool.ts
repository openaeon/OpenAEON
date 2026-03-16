import { Type, type Static } from "@sinclair/typebox";
import path from "node:path";
import { findGitRoot } from "../../infra/git-root.js";
import { inspectGitMaintenance } from "../../infra/git-maintenance.js";
import { extractSignalsFromLogFile } from "../../infra/log-signal-extractor.js";
import { resolveStateDir } from "../../config/paths.js";
import { checkGatewayHealth } from "../../commands/doctor-gateway-health.js";
import { defaultRuntime } from "../../runtime.js";
import { loadConfig } from "../../config/config.js";
import { triggerOPENAEONRestart } from "../../infra/restart.js";
import { stringEnum } from "../schema/typebox.js";
import { type AnyAgentTool, jsonResult } from "./common.js";
// New imports for config.audit and config.fix
import { auditConfig } from "../../infra/config-auditor.js";
import { callGatewayTool, readGatewayCallOptions } from "./gateway.js";
import { resolveConfigSnapshotHash } from "../../config/io.js";
import { discoverAvailableCapabilities } from "../../infra/skill-discovery.js";
import { installPluginFromNpmSpec, installPluginFromPath } from "../../plugins/install.js";
import { enablePluginInConfig } from "../../plugins/enable.js";
import { recordPluginInstall } from "../../plugins/installs.js";
import { writeConfigFile } from "../../config/config.js";

const SELF_REPAIR_ACTIONS = [
  "diagnose",
  "repair",
  "config.audit",
  "config.fix",
  "skill.discover",
  "skill.install",
] as const;

const SelfRepairSchema = Type.Object({
  action: stringEnum(SELF_REPAIR_ACTIONS, {
    description:
      "diagnose: inspect gateway logs, git state, and health. " +
      "repair: apply fixes for detected issues. " +
      "config.audit: read and validate the config file, returning structured issues. " +
      "config.fix: apply a targeted config patch and hot-reload the gateway (SIGUSR1). " +
      "skill.discover: search for available plugins or skills to install. " +
      "skill.install: install a specific plugin or skill by ID or npm spec.",
  }),
  kind: Type.Optional(
    Type.String({
      description:
        "Specific signal kind to target during repair (e.g. gateway_down, git_lock_detected). Omit to repair all detected issues.",
    }),
  ),
  // For config.fix: a JSON-merge-patch to apply to the config
  patch: Type.Optional(
    Type.String({
      description:
        "JSON5 merge-patch string to apply when action=config.fix. " +
        'Example: \'{"gateway": {"mode": "local"}}\'. ' +
        "The patch is applied on top of the existing config, then gateway reloads via SIGUSR1.",
    }),
  ),
  // For config.fix: human-readable note to send after reload
  note: Type.Optional(
    Type.String({
      description: "Optional human-readable completion note to send after config.fix reload.",
    }),
  ),
  // For skill.discover/install: query or target spec
  query: Type.Optional(
    Type.String({
      description: "Query string for skill.discover or target ID/npm spec for skill.install.",
    }),
  ),
});

type SelfRepairParams = Static<typeof SelfRepairSchema>;

/**
 * AEON Self-Repair Tool
 *
 * Allows the agent to autonomously:
 * 1. Diagnose gateway logs + git state + health
 * 2. Repair git locks / restart gateway
 * 3. Audit the config file for schema/runtime issues
 * 4. Apply a targeted config patch and trigger gateway hot-reload (SIGUSR1)
 */
export function createSelfRepairTool(): AnyAgentTool {
  return {
    label: "Self-Repair",
    name: "self_repair",
    description:
      "Autonomously troubleshoot and fix OpenAEON gateway, config, and infrastructure issues. " +
      "Use config.audit first to discover config problems, then config.fix to patch and hot-reload.",
    parameters: SelfRepairSchema,
    execute: async (_id, args) => {
      const params = args as SelfRepairParams;
      const { action, kind } = params;
      const cfg = loadConfig();
      const stateDir = resolveStateDir(process.env);
      const logPath = path.join(stateDir, "openaeon-gateway.log");

      // ── diagnose ────────────────────────────────────────────────────────────
      if (action === "diagnose") {
        const signals = await extractSignalsFromLogFile(logPath);
        const gitRoot = findGitRoot(process.cwd());
        const gitMaintenance = gitRoot
          ? inspectGitMaintenance({ cwd: gitRoot, repair: false })
          : null;
        const { healthOk } = await checkGatewayHealth({ runtime: defaultRuntime, cfg });

        return jsonResult({
          status: "ok",
          diagnosis: {
            gatewayAlive: healthOk,
            signals,
            gitMaintenance: gitMaintenance?.issues ?? [],
          },
        });
      }

      // ── repair ──────────────────────────────────────────────────────────────
      if (action === "repair") {
        const results: string[] = [];

        // 1. Git Lock Repair
        if (!kind || kind === "git_lock_detected" || kind === "stale_index_lock") {
          const gitRoot = findGitRoot(process.cwd());
          if (gitRoot) {
            const repaired = inspectGitMaintenance({ cwd: gitRoot, repair: true });
            if (repaired?.issues.some((i) => i.repaired)) {
              results.push("Fixed git environment issues (locks removed/rebases aborted).");
            }
          }
        }

        // 2. Gateway Restart
        if (!kind || kind === "gateway_down") {
          const { healthOk } = await checkGatewayHealth({ runtime: defaultRuntime, cfg });
          if (!healthOk) {
            const restart = triggerOPENAEONRestart();
            if (restart.ok) {
              results.push(`Triggered gateway restart via ${restart.method}.`);
            } else {
              results.push(`Gateway restart failed: ${restart.detail}`);
            }
          }
        }

        return jsonResult({
          status: results.length > 0 ? "ok" : "nothing_to_fix",
          actionsTaken: results,
          text:
            results.length > 0
              ? results.join(" ")
              : "No repairs were necessary based on the provided kind.",
        });
      }

      // ── config.audit ─────────────────────────────────────────────────────────
      if (action === "config.audit") {
        const auditResult = await auditConfig();
        return jsonResult({
          status: auditResult.valid ? "ok" : "issues_found",
          ...auditResult,
          text: auditResult.valid
            ? `Config at ${auditResult.configPath} is valid.`
            : `Found ${auditResult.issues.length} issue(s) in ${auditResult.configPath}. ` +
              auditResult.issues
                .map(
                  (i) => `[${i.path}] ${i.message}${i.suggestedFix ? ` → ${i.suggestedFix}` : ""}`,
                )
                .join("; "),
        });
      }

      // ── config.fix ────────────────────────────────────────────────────────────
      if (action === "config.fix") {
        const rawPatch = params.patch;
        if (!rawPatch || !rawPatch.trim()) {
          return jsonResult({
            status: "error",
            error: "config.fix requires a 'patch' parameter (JSON5 merge-patch string).",
          });
        }

        try {
          // 1. Get current config snapshot hash (required for patch safety)
          const snapshot = await callGatewayTool("config.get", readGatewayCallOptions({}), {});
          const hashValue = (snapshot as { hash?: unknown }).hash;
          const rawValue = (snapshot as { raw?: unknown }).raw;
          const baseHash = resolveConfigSnapshotHash({
            hash: typeof hashValue === "string" ? hashValue : undefined,
            raw: typeof rawValue === "string" ? rawValue : undefined,
          });

          if (!baseHash) {
            return jsonResult({
              status: "error",
              error: "Could not retrieve config hash. Gateway may be offline.",
            });
          }

          // 2. Apply the patch — gateway validates, writes, then sends SIGUSR1 (hot-reload)
          const result = await callGatewayTool("config.patch", readGatewayCallOptions({}), {
            raw: rawPatch,
            baseHash,
            note: params.note ?? "Config patched by self-repair agent.",
          });

          return jsonResult({
            status: "ok",
            text: "Config patch applied. Gateway is hot-reloading the new configuration via SIGUSR1.",
            patchResult: result,
          });
        } catch (err) {
          return jsonResult({
            status: "error",
            error: `config.fix failed: ${String(err)}`,
            hint: "If the gateway is offline, use action=repair first, then retry config.fix.",
          });
        }
      }

      // ── skill.discover ────────────────────────────────────────────────────────
      if (action === "skill.discover") {
        const workspaceDir = params.query ? undefined : process.cwd(); // simplified
        const candidates = await discoverAvailableCapabilities({
          workspaceDir,
          query: params.query,
        });
        return jsonResult({
          status: "ok",
          candidates,
          text: `Found ${candidates.length} candidate(s) for the query.`,
        });
      }

      // ── skill.install ─────────────────────────────────────────────────────────
      if (action === "skill.install") {
        if (!params.query) {
          return jsonResult({
            status: "error",
            error: "skill.install requires 'query' as the target spec.",
          });
        }

        const spec = params.query.trim();
        const logger = {
          info: (msg: string) => defaultRuntime.log(msg),
          warn: (msg: string) => defaultRuntime.log(msg),
        };

        try {
          let result;
          if (spec.startsWith("file:")) {
            const localPath = spec.slice(5);
            result = await installPluginFromPath({ path: localPath, logger });
          } else if (spec.startsWith("@") || (!spec.includes("/") && !spec.includes("."))) {
            // NPM spec
            result = await installPluginFromNpmSpec({ spec, logger });
          } else {
            // Local path (fallback)
            result = await installPluginFromPath({ path: spec, logger });
          }

          if (!result.ok) {
            return jsonResult({ status: "error", error: result.error });
          }

          // Enable and record the install
          let next = enablePluginInConfig(cfg, result.pluginId).config;
          next = recordPluginInstall(next, {
            pluginId: result.pluginId,
            source: spec.startsWith("file:") ? "path" : spec.includes("@") ? "npm" : "path",
            installPath: result.targetDir,
            version: result.version,
          });

          await writeConfigFile(next);

          return jsonResult({
            status: "ok",
            message: `Successfully installed and enabled plugin: ${result.pluginId}`,
            text: `Skill acquisition complete: ${result.pluginId} is now enabled. Please use self_repair(action='config.fix') or restart the gateway to finalize.`,
          });
        } catch (err) {
          return jsonResult({ status: "error", error: `Installation failed: ${String(err)}` });
        }
      }

      return jsonResult({ status: "error", error: "Unsupported action." });
    },
  };
}
