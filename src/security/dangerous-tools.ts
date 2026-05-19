// Shared tool-risk constants.
// Keep these centralized so gateway HTTP restrictions, security audits, and ACP prompts don't drift.

/**
 * Tools denied via Gateway HTTP `POST /tools/invoke` by default.
 * These are high-risk because they enable session orchestration, control-plane actions,
 * or interactive flows that don't make sense over a non-interactive HTTP surface.
 */
export const DEFAULT_GATEWAY_HTTP_TOOL_DENY = [
  // Session orchestration — spawning agents remotely is RCE
  "sessions_spawn",
  // Cross-session injection — message injection across sessions
  "sessions_send",
  // Persistent automation control plane — can create/update/remove scheduled runs
  "cron",
  // Gateway control plane — prevents gateway reconfiguration via HTTP
  "gateway",
  // Local desktop automation — can click/type/control the operator's macOS GUI
  "desktop",
  // Interactive setup — requires terminal QR scan, hangs on HTTP
  "whatsapp_login",
] as const;

/**
 * ACP tools that should always require explicit user approval.
 * ACP is an automation surface; we never want "silent yes" for mutating/execution tools.
 */
export const DANGEROUS_ACP_TOOL_NAMES = [
  "exec",
  "spawn",
  "shell",
  "sessions_spawn",
  "sessions_send",
  "gateway",
  "desktop",
  "fs_write",
  "fs_delete",
  "fs_move",
  "apply_patch",
] as const;

export const DANGEROUS_ACP_TOOLS = new Set<string>(DANGEROUS_ACP_TOOL_NAMES);

/**
 * Check if a tool is dangerous and should require explicit approval.
 * If allowOverride is true, only "critical" system tools (like gateway) remain dangerous.
 */
export function isDangerousAcpTool(name: string, allowOverride?: boolean): boolean {
  if (allowOverride) {
    // Even with override, we keep 'gateway' as dangerous because it controls the configuration itself.
    // 'sessions_send' is also kept because it can hijack other sessions.
    return name === "gateway" || name === "sessions_send" || name === "desktop";
  }
  return DANGEROUS_ACP_TOOLS.has(name);
}
