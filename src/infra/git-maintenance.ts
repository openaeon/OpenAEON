import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { findGitRoot } from "./git-root.js";

/**
 * Maximum age for a `.git/index.lock` before we consider it stale.
 * git itself only creates this during active operations; 10 minutes
 * is a very conservative upper bound beyond which it is virtually
 * certain no operation is still running.
 */
export const STALE_LOCK_MAX_AGE_MS = 10 * 60 * 1000;

export type GitMaintenanceIssueKind =
  | "stale_index_lock"
  | "pending_rebase"
  | "pending_merge"
  | "pending_cherry_pick"
  | "pending_revert";

export interface GitMaintenanceIssue {
  kind: GitMaintenanceIssueKind;
  /** Human-readable description of the issue */
  description: string;
  /** Whether this was automatically resolved */
  repaired: boolean;
}

export interface GitMaintenanceResult {
  /** Absolute path to the git repo root inspected */
  repoRoot: string;
  issues: GitMaintenanceIssue[];
}

type ExecSyncFn = (cmd: string, args: string[], cwd: string) => void;

/**
 * Detect and optionally repair common Git environment issues that can block
 * OpenAEON's gateway, extension installs, or skill operations.
 *
 * Inspired by the self-repair pattern from EvoMap/evolver:
 * - Stale `.git/index.lock` removal
 * - Pending rebase / merge / cherry-pick / revert abort
 *
 * @param opts.cwd      Starting directory for git root discovery. Defaults to `process.cwd()`.
 * @param opts.repair   When `true`, automatically repair detected issues.
 * @param opts.staleLockMaxAgeMs  Minimum lock file age before considering it stale.
 * @param opts._exec    Internal override for testing (avoids real git calls).
 */
export function inspectGitMaintenance(opts: {
  cwd?: string;
  repair?: boolean;
  staleLockMaxAgeMs?: number;
  _exec?: ExecSyncFn;
}): GitMaintenanceResult | null {
  const cwd = opts.cwd ?? process.cwd();
  const repair = opts.repair ?? false;
  const staleMs = opts.staleLockMaxAgeMs ?? STALE_LOCK_MAX_AGE_MS;
  const exec: ExecSyncFn =
    opts._exec ??
    ((cmd, args, repoRoot) => {
      execFileSync(cmd, args, { cwd: repoRoot, stdio: "ignore", timeout: 10_000 });
    });

  const repoRoot = findGitRoot(cwd);
  if (!repoRoot) {
    return null;
  }

  const gitDir = resolveGitDir(repoRoot);
  if (!gitDir) {
    return null;
  }

  const issues: GitMaintenanceIssue[] = [];

  // --- 1. Stale index.lock ---
  const indexLock = path.join(gitDir, "index.lock");
  if (fs.existsSync(indexLock)) {
    let ageMs: number | null = null;
    try {
      const stat = fs.statSync(indexLock);
      ageMs = Date.now() - stat.mtimeMs;
    } catch {
      // ignore stat failure; treat as unknown age
    }

    const isStale = ageMs === null || ageMs > staleMs;
    let repaired = false;
    if (isStale && repair) {
      try {
        fs.rmSync(indexLock);
        repaired = true;
      } catch {
        // non-fatal — we may not have permission
      }
    }
    const ageLabel = ageMs !== null ? ` (${Math.round(ageMs / 1000)}s old)` : "";
    issues.push({
      kind: "stale_index_lock",
      description: `Stale .git/index.lock${ageLabel} — any git command is blocked until it is removed.`,
      repaired,
    });
  }

  // --- 2. Pending rebase ---
  if (
    fs.existsSync(path.join(gitDir, "rebase-merge")) ||
    fs.existsSync(path.join(gitDir, "rebase-apply"))
  ) {
    let repaired = false;
    if (repair) {
      try {
        exec("git", ["rebase", "--abort"], repoRoot);
        repaired = true;
      } catch {
        // May already be gone — ignore
      }
    }
    issues.push({
      kind: "pending_rebase",
      description:
        "A rebase is in progress. Git operations will fail until it is completed or aborted.",
      repaired,
    });
  }

  // --- 3. Pending merge ---
  const mergeMsgPath = path.join(gitDir, "MERGE_HEAD");
  if (fs.existsSync(mergeMsgPath)) {
    let repaired = false;
    if (repair) {
      try {
        exec("git", ["merge", "--abort"], repoRoot);
        repaired = true;
      } catch {
        // ignore
      }
    }
    issues.push({
      kind: "pending_merge",
      description:
        "A merge is in progress. Git operations will fail until it is completed or aborted.",
      repaired,
    });
  }

  // --- 4. Pending cherry-pick ---
  if (fs.existsSync(path.join(gitDir, "CHERRY_PICK_HEAD"))) {
    let repaired = false;
    if (repair) {
      try {
        exec("git", ["cherry-pick", "--abort"], repoRoot);
        repaired = true;
      } catch {
        // ignore
      }
    }
    issues.push({
      kind: "pending_cherry_pick",
      description:
        "A cherry-pick is in progress. Git operations will fail until it is completed or aborted.",
      repaired,
    });
  }

  // --- 5. Pending revert ---
  if (fs.existsSync(path.join(gitDir, "REVERT_HEAD"))) {
    let repaired = false;
    if (repair) {
      try {
        exec("git", ["revert", "--abort"], repoRoot);
        repaired = true;
      } catch {
        // ignore
      }
    }
    issues.push({
      kind: "pending_revert",
      description:
        "A revert is in progress. Git operations will fail until it is completed or aborted.",
      repaired,
    });
  }

  return { repoRoot, issues };
}

/**
 * Resolves the actual `.git` directory path (handles `.git` files for worktrees/submodules).
 */
function resolveGitDir(repoRoot: string): string | null {
  const gitPath = path.join(repoRoot, ".git");
  try {
    const stat = fs.statSync(gitPath);
    if (stat.isDirectory()) {
      return gitPath;
    }
    if (stat.isFile()) {
      const raw = fs.readFileSync(gitPath, "utf-8");
      const match = raw.match(/gitdir:\s*(.+)/i);
      if (!match?.[1]) return null;
      return path.resolve(repoRoot, match[1].trim());
    }
  } catch {
    // not a git repo or unreadable
  }
  return null;
}
