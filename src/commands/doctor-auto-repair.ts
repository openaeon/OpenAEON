import { extractSignalsFromLogFile } from "../infra/log-signal-extractor.js";
import { auditConfig } from "../infra/config-auditor.js";
import { inspectGitMaintenance } from "../infra/git-maintenance.js";
import { findGitRoot } from "../infra/git-root.js";
import { triggerOPENAEONRestart } from "../infra/restart.js";
import { resolveStateDir } from "../config/paths.js";
import path from "node:path";
import { note } from "../terminal/note.js";
import {
  readConfigFileSnapshot,
  setConfigAtPath,
  unsetConfigAtPath,
  writeConfigFile,
} from "../config/config.js";
import { findGatewayPidsOnPortSync } from "../infra/restart.js";
import { defaultRuntime } from "../runtime.js";
import { info } from "../globals.js";

const LOG_FILENAME = "openaeon-gateway.log";

/**
 * Doctor check: reads recent gateway logs, extracts signals, and either
 * applies repairs directly (--fix mode) or reports actionable hints to the user.
 *
 * Runs as part of `openaeon doctor` (and `openaeon doctor --fix`).
 * Inspired by EvoMap/evolver signal extraction patterns.
 */
export async function noteAutoRepairAdvisor(params?: { shouldRepair?: boolean }) {
  const shouldRepair = params?.shouldRepair === true;
  const stateDir = resolveStateDir(process.env);
  const logPath = path.join(stateDir, LOG_FILENAME);

  // 1. Audit configuration
  const audit = await auditConfig();

  // 2. Extract signals from log file
  const signals = await extractSignalsFromLogFile(logPath);

  if (!audit.valid || audit.issues.length > 0 || signals.length > 0) {
    const lines: string[] = [];
    const actionsTaken: string[] = [];

    // Report/Apply config issues
    let configChanged = false;
    for (const issue of audit.issues) {
      if (shouldRepair && issue.fixData) {
        try {
          const snapshot = await readConfigFileSnapshot();
          const next = structuredClone(snapshot.resolved) as Record<string, unknown>;
          if (issue.fixData.action === "set") {
            setConfigAtPath(next, issue.fixData.path.split("."), issue.fixData.value);
          } else {
            unsetConfigAtPath(next, issue.fixData.path.split("."));
          }
          await writeConfigFile(next);
          actionsTaken.push(`[Fixed] Config: ${issue.message}`);
          configChanged = true;
        } catch (err) {
          lines.push(`- [Config Issue] ${issue.message} (Auto-fix failed: ${String(err)})`);
        }
      } else {
        lines.push(`- [Config Issue] ${issue.message}`);
        if (issue.suggestedFix) {
          lines.push(`  Fix: run "${issue.suggestedFix}"`);
        }
      }
    }

    // If config changed and gateway is alive, trigger hot-reload (SIGUSR1)
    if (configChanged) {
      const pids = findGatewayPidsOnPortSync(18789); // Default port
      if (pids.length > 0) {
        for (const pid of pids) {
          try {
            process.kill(pid, "SIGUSR1");
          } catch {
            // ignore kill errors
          }
        }
        actionsTaken.push("[Info] Sent SIGUSR1 to gateway for Hot-Reload.");
      }
    }

    // Report log signals
    for (const signal of signals) {
      switch (signal.kind) {
        case "gateway_down": {
          if (shouldRepair) {
            const result = triggerOPENAEONRestart();
            if (result.ok) {
              actionsTaken.push(`[Fixed] Gateway restart triggered via ${result.method}.`);
            } else {
              lines.push(`- [Issue] Gateway appears down. Restart failed: ${result.detail}`);
              lines.push("  Run: openaeon gateway run");
            }
          } else {
            lines.push("- [Issue] Gateway appears down based on recent logs.");
            lines.push('  Fix: run "openaeon doctor --fix" to restart it.');
          }
          break;
        }

        case "git_lock_detected": {
          if (shouldRepair) {
            const gitRoot = findGitRoot(process.cwd());
            if (gitRoot) {
              const repaired = inspectGitMaintenance({ cwd: gitRoot, repair: true });
              const count = repaired?.issues.filter((i) => i.repaired).length ?? 0;
              if (count > 0) {
                actionsTaken.push(`[Fixed] Cleared ${count} git environment issue(s).`);
              }
            }
          } else {
            lines.push("- [Issue] Git index.lock detected — git operations are blocked.");
            lines.push('  Fix: run "openaeon doctor --fix" to clear stale locks.');
          }
          break;
        }

        case "channel_auth_invalid": {
          lines.push("- [Issue] Channel authentication failure detected in recent logs.");
          lines.push('  Fix: run "openaeon channels connect <channel>" to re-authenticate.');
          break;
        }

        case "recurring_error": {
          lines.push(
            `- [Issue] Recurring error detected (${signal.frequency}x): ${signal.evidence.slice(0, 80)}`,
          );
          lines.push('  Fix: run "openaeon doctor --fix" or check the gateway log for details.');
          break;
        }
      }
    }

    const noteLines: string[] = [
      ...(lines.length > 0
        ? [
            "Recent gateway activity or configuration issues suggest the following problems:",
            "",
            ...lines,
          ]
        : []),
      ...(lines.length > 0 && actionsTaken.length > 0 ? [""] : []),
      ...(actionsTaken.length > 0
        ? ["Repair actions applied:", ...actionsTaken.map((a) => `  [x] ${a}`)]
        : []),
      ...(actionsTaken.length === 0 && lines.length > 0 && !shouldRepair
        ? ["", 'Use "openaeon doctor --fix" to automatically apply repairs.']
        : []),
    ];

    if (noteLines.length > 0) {
      note(noteLines.join("\n"), "Auto-Repair Advisor");
    }
  }
}
