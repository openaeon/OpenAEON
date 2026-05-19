import type { AgentRole } from "../contracts/types.js";
import { resolveCognitiveToolAccess } from "./tool-registry.js";

export type CognitiveDelegationPolicy = {
  maxConcurrentChildren: number;
  maxDepth: number;
  blockedTools: string[];
  defaultToolsets: string[];
  inheritParentToolsets: boolean;
  workspaceMode: "inherit" | "isolated";
  allowedTools: string[];
  deniedTools: string[];
};

export const DEFAULT_COGNITIVE_DELEGATION_POLICY: CognitiveDelegationPolicy = {
  maxConcurrentChildren: 3,
  maxDepth: 2,
  blockedTools: ["sessions_spawn", "clarify", "memory", "send_message", "execute_code"],
  defaultToolsets: ["terminal", "file", "web"],
  inheritParentToolsets: true,
  workspaceMode: "inherit",
  allowedTools: [],
  deniedTools: [],
};

export function resolveCognitiveDelegationPolicy(
  override?: Partial<CognitiveDelegationPolicy> & { role?: AgentRole; parentToolsets?: string[] },
): CognitiveDelegationPolicy {
  const base = {
    ...DEFAULT_COGNITIVE_DELEGATION_POLICY,
    ...override,
    maxConcurrentChildren: Math.max(
      1,
      Math.min(
        8,
        Math.floor(
          override?.maxConcurrentChildren ??
            DEFAULT_COGNITIVE_DELEGATION_POLICY.maxConcurrentChildren,
        ),
      ),
    ),
    maxDepth: Math.max(
      1,
      Math.min(5, Math.floor(override?.maxDepth ?? DEFAULT_COGNITIVE_DELEGATION_POLICY.maxDepth)),
    ),
    blockedTools: Array.from(
      new Set([
        ...DEFAULT_COGNITIVE_DELEGATION_POLICY.blockedTools,
        ...(override?.blockedTools ?? []),
      ]),
    ),
    defaultToolsets:
      override?.defaultToolsets ?? DEFAULT_COGNITIVE_DELEGATION_POLICY.defaultToolsets,
  };
  const access = resolveCognitiveToolAccess({
    role: override?.role ?? "DevAgent",
    requestedToolsets: base.defaultToolsets,
    parentToolsets: override?.parentToolsets,
    inheritParentToolsets: base.inheritParentToolsets,
    blockedTools: base.blockedTools,
  });
  return {
    ...base,
    defaultToolsets: access.toolsets,
    allowedTools: access.allowedTools,
    deniedTools: access.deniedTools,
  };
}

export function buildDelegationPolicyPrompt(policy: CognitiveDelegationPolicy): string {
  return [
    "Cognitive delegation policy:",
    `- Max concurrent child agents: ${policy.maxConcurrentChildren}`,
    `- Max delegation depth: ${policy.maxDepth}`,
    `- Workspace mode: ${policy.workspaceMode}`,
    `- Inherit parent toolsets: ${policy.inheritParentToolsets ? "yes" : "no"}`,
    `- Default toolsets: ${policy.defaultToolsets.join(", ")}`,
    `- Allowed tools: ${policy.allowedTools.join(", ") || "none"}`,
    `- Blocked tools for descendants: ${policy.blockedTools.join(", ")}`,
    `- Denied tools: ${policy.deniedTools.join(", ") || "none"}`,
  ].join("\n");
}
