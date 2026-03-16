import { Type } from "@sinclair/typebox";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readStringParam } from "./common.js";
import { parseAgentSessionKey } from "../../routing/session-key.js";
import { resolveWorkspaceRoot } from "../workspace-dir.js";
import type { GatewayMessageChannel } from "../../utils/message-channel.js";

const SkillsDefineToolSchema = Type.Object({
  name: Type.String({
    description: "The name of the skill. Must be alphanumeric and under 32 characters.",
    maxLength: 32,
    pattern: "^[a-zA-Z0-9_-]+$",
  }),
  description: Type.String({
    description: "A short description of what the skill does and when to use it.",
  }),
  instructions: Type.String({
    description: "The markdown instructions that define the skill's behavior and constraints.",
  }),
});

export function createSkillsDefineTool(opts?: {
  agentSessionKey?: string;
  agentChannel?: GatewayMessageChannel;
  agentAccountId?: string;
}): AnyAgentTool {
  return {
    label: "Skills",
    name: "skills_define",
    description:
      "Dynamically define a new skill with specific instructions. This skill will be available in the current workspace and can be used by this agent or delegated to subagents.",
    parameters: SkillsDefineToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;

      const name = readStringParam(params, "name", { required: true });
      const description = readStringParam(params, "description", { required: true });
      const instructions = readStringParam(params, "instructions", { required: true });

      // Determine the workspace directory based on the current session
      const workspaceDir = opts?.agentSessionKey
        ? resolveWorkspaceRoot(opts.agentSessionKey)
        : process.cwd();

      // Ensure the .agents/skills directory exists in the workspace
      const skillsDir = path.join(workspaceDir, ".agents", "skills");
      await fs.mkdir(skillsDir, { recursive: true });

      // Clean the skill name to create a safe directory name
      const safeName = name.toLowerCase().replace(/[^a-z0-9_-]/g, "");
      const skillDir = path.join(skillsDir, safeName);
      await fs.mkdir(skillDir, { recursive: true });

      // Format the SKILL.md content
      const skillContent = `---
name: ${name}
description: ${description}
---

${instructions}
`;

      const skillFilePath = path.join(skillDir, "SKILL.md");
      await fs.writeFile(skillFilePath, skillContent, "utf-8");

      return jsonResult({
        status: "success",
        message: `Successfully defined skill '${name}' in ${skillFilePath}`,
        skillPath: skillFilePath,
        note: "This skill is now available in the local workspace context and can be passed to subagents using the 'skills' parameter in sessions_spawn.",
      });
    },
  };
}
