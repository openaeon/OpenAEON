import type { AgentRole } from "../contracts/types.js";

export type AgentSpec = {
  role: AgentRole;
  label: string;
  systemPrompt: string;
  verifierWeight: number;
  riskWeight: number;
};
