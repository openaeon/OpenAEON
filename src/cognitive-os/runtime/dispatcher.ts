import type { AgentDispatchRequest, AgentDispatchResult } from "../contracts/types.js";
import { executeWithRecovery } from "./tool-executor.js";
import { dispatchWithParallelVoting } from "./model-voting-router.js";

export async function dispatchAgentTask(req: AgentDispatchRequest): Promise<AgentDispatchResult> {
  return await executeWithRecovery(async () => await dispatchWithParallelVoting(req), {
    maxRetries: 1,
    baseDelayMs: 400,
  });
}
