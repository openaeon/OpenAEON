import type { AnyAgentTool } from "./pi-tools.types.js";
import { recordConsciousnessPulse } from "../gateway/aeon-state.js";

/**
 * Wraps a tool with cognitive telemetry (Layer 6: Intermediate State Observation).
 * This allows the FCA Core to monitor tool execution latency, success rates,
 * and potential "semantic gaps" in real-time.
 */
export function wrapToolWithCognitiveTelemetry(
  tool: AnyAgentTool,
  options: {
    agentId?: string;
    sessionKey?: string;
  },
): AnyAgentTool {
  const originalExecute = tool.execute.bind(tool);

  tool.execute = async (params, ctx) => {
    const started = Date.now();
    try {
      const result = await originalExecute(params, ctx);
      
      // Record successful execution telemetry
      recordConsciousnessPulse({
        epiphanyFactor: 0.1, // Slight bump on success
        memorySaturation: 0,
        neuralDepth: 1,
        idleMs: 0,
        resonanceActive: true,
        activeRun: true,
        now: Date.now(),
      }, {
        agentId: options.agentId,
        sessionKey: options.sessionKey,
      });

      return result;
    } catch (error) {
      const latency = Date.now() - started;
      
      // Record failure telemetry (Layer 2 linkage)
      recordConsciousnessPulse({
        epiphanyFactor: -0.2, // Drop on failure
        memorySaturation: 0,
        neuralDepth: 1,
        idleMs: latency,
        resonanceActive: false,
        activeRun: true,
        riskLoad: 0.3, // Increase risk on failure
        now: Date.now(),
      }, {
        agentId: options.agentId,
        sessionKey: options.sessionKey,
      });

      throw error;
    }
  };

  return tool;
}
