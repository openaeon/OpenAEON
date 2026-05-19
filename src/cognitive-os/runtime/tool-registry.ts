import type { AgentRole } from "../contracts/types.js";

export type CognitiveToolDefinition = {
  name: string;
  toolset: string;
  description: string;
  roles: AgentRole[];
  dangerous?: boolean;
};

export type CognitiveToolsetDefinition = {
  name: string;
  description: string;
  tools: string[];
};

const TOOL_DEFINITIONS: CognitiveToolDefinition[] = [
  {
    name: "read_file",
    toolset: "file",
    description: "Read workspace files and source context.",
    roles: ["DevAgent", "QAAgent", "OpsAgent", "SalesAgent"],
  },
  {
    name: "search_files",
    toolset: "file",
    description: "Search workspace files and symbols.",
    roles: ["DevAgent", "QAAgent", "OpsAgent", "SalesAgent"],
  },
  {
    name: "write_file",
    toolset: "file",
    description: "Write or patch workspace files.",
    roles: ["DevAgent", "OpsAgent"],
  },
  {
    name: "terminal",
    toolset: "terminal",
    description: "Run shell commands in the workspace.",
    roles: ["DevAgent", "QAAgent", "OpsAgent"],
    dangerous: true,
  },
  {
    name: "run_tests",
    toolset: "terminal",
    description: "Run focused verification commands.",
    roles: ["DevAgent", "QAAgent", "OpsAgent"],
  },
  {
    name: "browser_open",
    toolset: "web",
    description: "Open and inspect browser targets.",
    roles: ["DevAgent", "QAAgent", "OpsAgent", "SalesAgent"],
  },
  {
    name: "api_call",
    toolset: "api",
    description: "Call external or local APIs through approved clients.",
    roles: ["DevAgent", "QAAgent", "OpsAgent", "SalesAgent"],
  },
  {
    name: "database_query",
    toolset: "database",
    description: "Query approved databases.",
    roles: ["DevAgent", "QAAgent", "OpsAgent"],
    dangerous: true,
  },
  {
    name: "sessions_spawn",
    toolset: "delegation",
    description: "Spawn a child agent session.",
    roles: ["DevAgent", "QAAgent", "OpsAgent", "SalesAgent"],
    dangerous: true,
  },
  {
    name: "memory",
    toolset: "memory",
    description: "Read or write Cognitive memory through a provider.",
    roles: ["DevAgent", "QAAgent", "OpsAgent", "SalesAgent"],
  },
];

const TOOLSETS: CognitiveToolsetDefinition[] = Object.values(
  TOOL_DEFINITIONS.reduce<Record<string, CognitiveToolsetDefinition>>((acc, tool) => {
    acc[tool.toolset] ??= {
      name: tool.toolset,
      description: `${tool.toolset} tools`,
      tools: [],
    };
    acc[tool.toolset].tools.push(tool.name);
    return acc;
  }, {}),
);

const ROLE_DEFAULT_TOOLSETS: Record<AgentRole, string[]> = {
  DevAgent: ["file", "terminal", "web", "api", "delegation", "memory"],
  QAAgent: ["file", "terminal", "web", "api", "delegation", "memory"],
  OpsAgent: ["file", "terminal", "web", "api", "database", "delegation", "memory"],
  SalesAgent: ["file", "web", "api", "delegation", "memory"],
};

export function listCognitiveTools(): CognitiveToolDefinition[] {
  return [...TOOL_DEFINITIONS];
}

export function listCognitiveToolsets(): CognitiveToolsetDefinition[] {
  return TOOLSETS.map((toolset) => ({ ...toolset, tools: [...toolset.tools] }));
}

export function getRoleDefaultToolsets(role: AgentRole): string[] {
  return [...ROLE_DEFAULT_TOOLSETS[role]];
}

export function resolveCognitiveToolAccess(params: {
  role: AgentRole;
  requestedToolsets?: string[];
  parentToolsets?: string[];
  inheritParentToolsets?: boolean;
  blockedTools?: string[];
}): {
  toolsets: string[];
  allowedTools: string[];
  blockedTools: string[];
  deniedTools: string[];
} {
  const knownToolsets = new Set(TOOLSETS.map((toolset) => toolset.name));
  const baseToolsets =
    params.requestedToolsets && params.requestedToolsets.length > 0
      ? params.requestedToolsets
      : getRoleDefaultToolsets(params.role);
  const inherited =
    params.inheritParentToolsets === false ? baseToolsets : (params.parentToolsets ?? baseToolsets);
  const toolsets = Array.from(new Set(inherited.filter((toolset) => knownToolsets.has(toolset))));
  const blocked = new Set(params.blockedTools ?? []);
  const allowedTools = TOOL_DEFINITIONS.filter(
    (tool) =>
      toolsets.includes(tool.toolset) &&
      tool.roles.includes(params.role) &&
      !blocked.has(tool.name),
  ).map((tool) => tool.name);
  const deniedTools = TOOL_DEFINITIONS.filter(
    (tool) =>
      (toolsets.includes(tool.toolset) || blocked.has(tool.name)) &&
      (!tool.roles.includes(params.role) || blocked.has(tool.name)),
  ).map((tool) => tool.name);

  return {
    toolsets,
    allowedTools: Array.from(new Set(allowedTools)).sort(),
    blockedTools: Array.from(blocked).sort(),
    deniedTools: Array.from(new Set(deniedTools)).sort(),
  };
}
