import { findGitRoot } from "../infra/git-root.js";
import { inspectGitMaintenance } from "../infra/git-maintenance.js";
import { note } from "../terminal/note.js";
import { shortenHomePath } from "../utils.js";

/**
 * Doctor check for common Git environment issues.
 *
 * Detects stale `.git/index.lock` files and in-progress git operations
 * (rebase, merge, cherry-pick, revert) that can block the OpenAEON gateway,
 * extension installs, and autonomous skill operations.
 *
 * Inspired by the EvoMap/evolver Git self-repair pattern.
 */
export async function noteGitMaintenanceHealth(params?: { shouldRepair?: boolean; cwd?: string }) {
  const shouldRepair = params?.shouldRepair === true;
  const cwd = params?.cwd ?? process.cwd();

  const repoRoot = findGitRoot(cwd);
  if (!repoRoot) {
    // Not in a git repo — nothing to check.
    return;
  }

  const result = inspectGitMaintenance({
    cwd,
    repair: shouldRepair,
  });

  if (!result || result.issues.length === 0) {
    return;
  }

  const repoLabel = shortenHomePath(result.repoRoot);
  const lines: string[] = [`- Git repo: ${repoLabel}`];

  for (const issue of result.issues) {
    if (issue.repaired) {
      lines.push(`- [Fixed] ${issue.description}`);
    } else {
      lines.push(`- [Issue] ${issue.description}`);
    }
  }

  const hasUnresolved = result.issues.some((i) => !i.repaired);
  if (hasUnresolved && !shouldRepair) {
    lines.push('- Run "openaeon doctor --fix" to automatically clean up these issues.');
  }

  const label = result.issues.some((i) => i.repaired) ? "Git state (repaired)" : "Git state";
  note(lines.join("\n"), label);
}
