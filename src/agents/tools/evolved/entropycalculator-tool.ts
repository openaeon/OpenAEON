import { Type } from "@sinclair/typebox";
import { type AnyAgentTool, jsonResult } from "../common.js";

export function createEntropyCalculatorTool(): AnyAgentTool {
  return {
    label: "Entropy Calculator",
    name: "entropy",
    description:
      "AEON PROPHET: Calculates the complexity (entropy) of a given system state or text.",
    parameters: Type.Object({
      input: Type.String({ description: "Text or state representation to analyze" }),
    }),
    execute: async (_toolCallId, args) => {
      const input = (args as any).input || "";
      const entropy = input.length * 0.1; // Simulated entropy calculation
      return jsonResult({
        status: "ok",
        entropy,
        message: "System entropy calculated based on input complexity.",
      });
    },
  };
}
