/**
 * session-profile-map.ts
 *
 * Persistent mapping from agent session keys (e.g. "feishu-task-001")
 * to browser profile names (e.g. "sess-feishu-task-001").
 *
 * Solves the repetitive login problem for sites like Feishu and Douyin:
 * once an agent logs in with a session-specific profile, subsequent runs
 * reuse the same profile and retain cookies/localStorage/session state.
 *
 * Storage: ~/.openaeon/session-profiles.json (lightweight JSON file)
 * Thread-safety: single-process in-memory cache with async file write.
 *
 * Design mirrors agent-browser's --session / --profile persistence concept.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAP_FILE = path.join(os.homedir(), ".openaeon", "session-profiles.json");

/**
 * Prefix for auto-created session profiles.
 * Profile names must match /^[a-z0-9-]+$/ per isValidProfileName().
 */
const SESSION_PROFILE_PREFIX = "sess-";

/** Maximum profile name length (openaeon enforces no specific limit, but keep sane). */
const MAX_PROFILE_NAME_LENGTH = 48;

// ─── In-memory cache ──────────────────────────────────────────────────────────

let _cache: Record<string, string> | null = null;

function loadMap(): Record<string, string> {
  if (_cache !== null) {
    return _cache;
  }
  try {
    if (fs.existsSync(MAP_FILE)) {
      const raw = fs.readFileSync(MAP_FILE, "utf8");
      _cache = JSON.parse(raw) as Record<string, string>;
    } else {
      _cache = {};
    }
  } catch {
    _cache = {};
  }
  return _cache;
}

// ─── Serial write queue ───────────────────────────────────────────────────────
// All file writes are chained onto this promise so they never run concurrently.
// Two simultaneous setSessionProfile() calls would otherwise interleave writes
// and potentially corrupt the JSON file.
let _writeQueue: Promise<void> = Promise.resolve();

function enqueueWrite(map: Record<string, string>): void {
  _writeQueue = _writeQueue.then(async () => {
    try {
      const dir = path.dirname(MAP_FILE);
      await fs.promises.mkdir(dir, { recursive: true });
      // Write to a temp file then rename for atomic update on most platforms.
      const tmp = `${MAP_FILE}.tmp`;
      await fs.promises.writeFile(tmp, JSON.stringify(map, null, 2), "utf8");
      await fs.promises.rename(tmp, MAP_FILE);
    } catch {
      // Best-effort: don't crash the request if file write fails.
    }
  });
}

// ─── Session key normalisation ────────────────────────────────────────────────

/**
 * Convert an arbitrary session key into a valid openaeon profile name.
 * Profile names: lowercase letters, numbers, hyphens only; max length.
 *
 * Examples:
 *   "feishu-task-001"  → "sess-feishu-task-001"
 *   "Douyin_Search_v2" → "sess-douyin-search-v2"
 *   "my session key"   → "sess-my-session-key"
 */
export function sessionKeyToProfileName(sessionKey: string): string {
  const normalized = sessionKey
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // non-alphanum → hyphens
    .replace(/^-+|-+$/g, ""); // trim leading/trailing hyphens

  const raw = `${SESSION_PROFILE_PREFIX}${normalized}`;
  // Truncate to stay within sane limits
  return raw.slice(0, MAX_PROFILE_NAME_LENGTH).replace(/-+$/, "");
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Look up the browser profile name associated with a session key.
 * Returns null if no mapping exists yet.
 */
export function getSessionProfile(sessionKey: string): string | null {
  const map = loadMap();
  return map[sessionKey] ?? null;
}

/**
 * Record a session key → profile name mapping and persist it to disk.
 * Idempotent: updating an existing key is safe.
 */
export async function setSessionProfile(sessionKey: string, profileName: string): Promise<void> {
  const map = loadMap();
  if (map[sessionKey] === profileName) {
    return; // No change, skip file write.
  }
  map[sessionKey] = profileName;
  _cache = map;
  enqueueWrite(map);
}

/**
 * Remove a session → profile mapping (e.g. when the profile is deleted).
 */
export async function removeSessionProfile(sessionKey: string): Promise<void> {
  const map = loadMap();
  if (!(sessionKey in map)) {
    return;
  }
  delete map[sessionKey];
  _cache = map;
  enqueueWrite(map);
}

/**
 * List all session → profile mappings.
 */
export function listSessionProfiles(): Record<string, string> {
  return { ...loadMap() };
}

// ─── Profile name helpers ─────────────────────────────────────────────────────

/** True if a profile name looks like an auto-created session profile. */
export function isSessionProfile(profileName: string): boolean {
  return profileName.startsWith(SESSION_PROFILE_PREFIX);
}
