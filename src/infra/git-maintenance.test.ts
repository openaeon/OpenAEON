import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { inspectGitMaintenance, STALE_LOCK_MAX_AGE_MS } from "./git-maintenance.js";

// Helper: create a minimal fake git repo in a temp directory
function makeFakeRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "openaeon-git-maintenance-test-"));
  const gitDir = path.join(dir, ".git");
  fs.mkdirSync(gitDir, { recursive: true });
  // Minimal HEAD so findGitRoot resolves this directory
  fs.writeFileSync(path.join(gitDir, "HEAD"), "ref: refs/heads/main\n");
  return dir;
}

// Helper: create a stale index.lock
function makeIndexLock(gitDir: string, ageSec: number) {
  const lockPath = path.join(gitDir, "index.lock");
  fs.writeFileSync(lockPath, "");
  const now = new Date();
  const past = new Date(now.getTime() - ageSec * 1000);
  fs.utimesSync(lockPath, past, past);
  return lockPath;
}

describe("inspectGitMaintenance", () => {
  let repoDir: string;
  let gitDir: string;

  beforeEach(() => {
    repoDir = makeFakeRepo();
    gitDir = path.join(repoDir, ".git");
  });

  afterEach(() => {
    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  it("returns null when not in a git repo", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "no-git-"));
    try {
      const result = inspectGitMaintenance({ cwd: tmp });
      expect(result).toBeNull();
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("returns empty issues when repo is clean", () => {
    const result = inspectGitMaintenance({ cwd: repoDir });
    expect(result).not.toBeNull();
    expect(result!.issues).toHaveLength(0);
  });

  it("detects a fresh (non-stale) index.lock without flagging it", () => {
    makeIndexLock(gitDir, 5); // 5 seconds old — not stale
    const result = inspectGitMaintenance({
      cwd: repoDir,
      staleLockMaxAgeMs: STALE_LOCK_MAX_AGE_MS,
    });
    // A 5s-old lock is NOT stale (< 10 min) — should not be reported
    expect(result!.issues).toHaveLength(0);
  });

  it("detects a stale index.lock", () => {
    makeIndexLock(gitDir, 15 * 60); // 15 minutes old
    const result = inspectGitMaintenance({ cwd: repoDir });
    expect(result!.issues).toHaveLength(1);
    expect(result!.issues[0]!.kind).toBe("stale_index_lock");
    expect(result!.issues[0]!.repaired).toBe(false);
  });

  it("removes stale index.lock when repair=true", () => {
    const lockPath = makeIndexLock(gitDir, 15 * 60);
    expect(fs.existsSync(lockPath)).toBe(true);
    const result = inspectGitMaintenance({ cwd: repoDir, repair: true });
    expect(result!.issues[0]!.kind).toBe("stale_index_lock");
    expect(result!.issues[0]!.repaired).toBe(true);
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  it("detects a pending rebase (rebase-merge directory)", () => {
    fs.mkdirSync(path.join(gitDir, "rebase-merge"));
    const calls: string[] = [];
    const result = inspectGitMaintenance({
      cwd: repoDir,
      repair: false,
      _exec: (cmd, args) => calls.push(`${cmd} ${args.join(" ")}`),
    });
    expect(result!.issues).toHaveLength(1);
    expect(result!.issues[0]!.kind).toBe("pending_rebase");
    expect(result!.issues[0]!.repaired).toBe(false);
    // No exec calls when not repairing
    expect(calls).toHaveLength(0);
  });

  it("aborts a pending rebase when repair=true", () => {
    fs.mkdirSync(path.join(gitDir, "rebase-merge"));
    const calls: string[] = [];
    const result = inspectGitMaintenance({
      cwd: repoDir,
      repair: true,
      _exec: (cmd, args) => calls.push(`${cmd} ${args.join(" ")}`),
    });
    expect(result!.issues[0]!.kind).toBe("pending_rebase");
    expect(result!.issues[0]!.repaired).toBe(true);
    expect(calls).toContain("git rebase --abort");
  });

  it("detects a pending merge (MERGE_HEAD)", () => {
    fs.writeFileSync(path.join(gitDir, "MERGE_HEAD"), "abc1234\n");
    const result = inspectGitMaintenance({ cwd: repoDir, repair: false, _exec: () => {} });
    expect(result!.issues).toHaveLength(1);
    expect(result!.issues[0]!.kind).toBe("pending_merge");
  });

  it("aborts a pending merge when repair=true", () => {
    fs.writeFileSync(path.join(gitDir, "MERGE_HEAD"), "abc1234\n");
    const calls: string[] = [];
    const result = inspectGitMaintenance({
      cwd: repoDir,
      repair: true,
      _exec: (cmd, args) => calls.push(`${cmd} ${args.join(" ")}`),
    });
    expect(result!.issues[0]!.repaired).toBe(true);
    expect(calls).toContain("git merge --abort");
  });

  it("detects multiple issues at once", () => {
    makeIndexLock(gitDir, 15 * 60);
    fs.mkdirSync(path.join(gitDir, "rebase-merge"));
    fs.writeFileSync(path.join(gitDir, "MERGE_HEAD"), "abc1234\n");
    const result = inspectGitMaintenance({ cwd: repoDir, repair: false, _exec: () => {} });
    expect(result!.issues).toHaveLength(3);
    expect(result!.issues.map((i) => i.kind)).toContain("stale_index_lock");
    expect(result!.issues.map((i) => i.kind)).toContain("pending_rebase");
    expect(result!.issues.map((i) => i.kind)).toContain("pending_merge");
  });
});
