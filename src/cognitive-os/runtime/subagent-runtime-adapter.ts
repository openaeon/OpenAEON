import type { AgentRole } from "../contracts/types.js";
import { spawnSubagentDirect } from "../../agents/subagent-spawn.js";
import {
  buildDelegationPolicyPrompt,
  resolveCognitiveDelegationPolicy,
  type CognitiveDelegationPolicy,
} from "./delegation-policy.js";

export type CognitiveSubagentDispatchInput = {
  taskId: string;
  nodeId: string;
  runId: string;
  sessionKey: string;
  role: AgentRole;
  title: string;
  prompt: string;
  acceptanceCriteria: string[];
  timeoutMs: number;
  delegationPolicy?: Partial<CognitiveDelegationPolicy>;
};

export type CognitiveSubagentDispatchResult = {
  accepted: boolean;
  runId?: string;
  childSessionKey?: string;
  model?: string;
  error?: string;
};

const ROLE_GUIDANCE: Record<AgentRole, string> = {
  DevAgent: "Own implementation, code changes, and integration details.",
  QAAgent: "Own verification, regression risk, and acceptance evidence.",
  OpsAgent: "Own runtime, deployment, observability, and recovery concerns.",
  SalesAgent: "Own customer-facing positioning, workflow fit, and extension hooks.",
};

export async function dispatchCognitiveNodeToSubagent(
  input: CognitiveSubagentDispatchInput,
): Promise<CognitiveSubagentDispatchResult> {
  const policy = resolveCognitiveDelegationPolicy({
    ...input.delegationPolicy,
    role: input.role,
  });
  const task = [
    `You are ${input.role}. ${ROLE_GUIDANCE[input.role]}`,
    "You are also a local orchestrator for this cognitive node, not only a leaf worker.",
    "",
    `Cognitive task: ${input.taskId}`,
    `Node: ${input.nodeId}`,
    `Run: ${input.runId}`,
    "",
    input.prompt,
    "",
    "Acceptance criteria:",
    ...input.acceptanceCriteria.map((criterion) => `- ${criterion}`),
    "",
    "Autonomous delegation and iteration:",
    "- If the node is complex, parallelizable, blocked on independent investigation, or needs verification, you may spawn your own sub-agents with `sessions_spawn` when your depth policy allows it.",
    "- Delegate disjoint work only; keep ownership of synthesis and final acceptance for this cognitive node.",
    "- Iterate autonomously: reflect on blockers, update your plan, spawn/steer helpers if useful, then integrate their results before finishing.",
    "- Descendant sub-agents auto-announce back to you. Wait for relevant descendant results before your final response, without polling loops.",
    "- When spawning descendants, pass `sharedContext.parentCognitiveTask` rather than `sharedContext.cognitiveTask`; the original `cognitiveTask` link is reserved for your final writeback to the parent runtime.",
    "",
    buildDelegationPolicyPrompt(policy),
    "",
    "Return concise evidence, changed files or artifacts, blockers, and whether the criteria passed.",
  ].join("\n");

  try {
    const result = await spawnSubagentDirect(
      {
        task,
        label: `${input.role}:${input.nodeId}`,
        mode: "run",
        cleanup: "keep",
        sandbox: "inherit",
        expectsCompletionMessage: true,
        runTimeoutSeconds: Math.max(60, Math.ceil(input.timeoutMs / 1000)),
        acceptance: input.acceptanceCriteria,
        sharedContext: {
          cognitiveTask: {
            taskId: input.taskId,
            nodeId: input.nodeId,
            runId: input.runId,
            role: input.role,
            autonomyMode: "recursive_delegation",
            source: "cognitive.runtime.dispatch",
          },
          cognitiveDelegation: {
            canDelegate: true,
            policy,
            descendantsUseContextKey: "parentCognitiveTask",
            finalWritebackOwner: input.runId,
          },
        },
      },
      {
        agentSessionKey: input.sessionKey,
      },
    );

    if (result.status !== "accepted") {
      return {
        accepted: false,
        childSessionKey: result.childSessionKey,
        runId: result.runId,
        error: result.error ?? `subagent dispatch ${result.status}`,
      };
    }

    return {
      accepted: true,
      childSessionKey: result.childSessionKey,
      runId: result.runId,
      model: result.modelApplied ? "subagent-runtime" : undefined,
    };
  } catch (error) {
    return {
      accepted: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
