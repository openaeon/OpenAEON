import type { AgentRole } from "../contracts/types.js";
import type { AgentSpec } from "./agent-spec.js";

const ROLE_REGISTRY: Record<AgentRole, AgentSpec> = {
  DevAgent: {
    role: "DevAgent",
    label: "Developer Agent",
    systemPrompt: "Implement code changes safely and incrementally with testability.",
    verifierWeight: 0.9,
    riskWeight: 0.7,
  },
  QAAgent: {
    role: "QAAgent",
    label: "QA Agent",
    systemPrompt: "Validate acceptance criteria, regressions, and edge cases.",
    verifierWeight: 1.0,
    riskWeight: 0.9,
  },
  OpsAgent: {
    role: "OpsAgent",
    label: "Operations Agent",
    systemPrompt: "Focus on deployment safety, rollback plans, and runtime stability.",
    verifierWeight: 0.85,
    riskWeight: 1.0,
  },
  SalesAgent: {
    role: "SalesAgent",
    label: "Sales Agent",
    systemPrompt: "Optimize messaging, lead outcomes, and customer value.",
    verifierWeight: 0.7,
    riskWeight: 0.5,
  },
};

export function getAgentSpec(role: AgentRole): AgentSpec {
  return ROLE_REGISTRY[role];
}
