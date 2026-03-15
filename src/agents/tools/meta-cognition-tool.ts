import { Type, type Static } from "@sinclair/typebox";
import { addCognitiveLog, setAeonParameters } from "../../gateway/aeon-state.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult } from "./common.js";

/**
 * AEON Meta-Cognition Tool
 * Allows the agent to perform internal monologue, logic synthesis, and strategic self-reflection.
 */

export const MetaCognitionSchema = Type.Object({
  action: Type.Unsafe<
    | "internal_monologue"
    | "optimize_parameters"
    | "detect_anomaly"
    | "synthesize_axioms"
    | "evolve_axioms"
    | "patch_axiom"
  >({
    type: "string",
    enum: [
      "internal_monologue",
      "optimize_parameters",
      "detect_anomaly",
      "synthesize_axioms",
      "evolve_axioms",
      "patch_axiom",
    ],
  }),
  thought: Type.Optional(Type.String({ description: "Content for internal_monologue" })),
  focus: Type.Optional(
    Type.String({ description: "Specific logic gate or axiom for deliberation" }),
  ),
  axioms: Type.Optional(Type.Array(Type.String(), { description: "Source axioms for synthesis" })),
  proposal: Type.Optional(Type.String({ description: "New synthesized logic gate proposal" })),
  rationale: Type.Optional(Type.String({ description: "Rationale for synthesis" })),
  conflict: Type.Optional(Type.String({ description: "Description of the logical conflict" })),
  severity: Type.Optional(Type.Number({ description: "Intensity of anomaly (0-1)" })),
  suggested_pivot: Type.Optional(Type.String({ description: "How to adjust strategy" })),
  temperature: Type.Optional(
    Type.Number({
      description: "Optimized LLM temperature (0-2). High means more creative/random.",
    }),
  ),
  top_p: Type.Optional(
    Type.Number({ description: "Optimized top_p (0-1). Alternative to temperature." }),
  ),
  max_tokens: Type.Optional(Type.Number({ description: "Limit for response length." })),
  targetContent: Type.Optional(
    Type.String({ description: "The content to search for during a patch operation" }),
  ),
  replacementContent: Type.Optional(
    Type.String({ description: "The content to replace with during a patch operation" }),
  ),
});

type MetaCognitionParams = Static<typeof MetaCognitionSchema>;

export function createMetaCognitionTool(): AnyAgentTool {
  return {
    label: "Cognitive Reflection",
    name: "meta_cognition",
    description: "AEON Internal Reflection & Strategy Optimization Tool (Z \u21CC Z\u00B2 + C).",
    parameters: MetaCognitionSchema,
    execute: async (_id, args) => {
      const params = args as MetaCognitionParams;
      const { action } = params;
      const now = Date.now();

      switch (action) {
        case "internal_monologue":
          if (!params.thought) throw new Error("thought is required for internal_monologue");
          addCognitiveLog({
            timestamp: now,
            type: "deliberation",
            content: params.thought,
            metadata: { focus: params.focus },
          });
          return jsonResult({
            status: "deliberated",
            focus: params.focus,
            text: `Deliberation complete: ${params.thought}`,
          });

        case "synthesize_axioms":
          if (!params.proposal) throw new Error("proposal is required for synthesize_axioms");
          addCognitiveLog({
            timestamp: now,
            type: "synthesis",
            content: `Synthesizing axioms into: ${params.proposal}`,
            metadata: { axioms: params.axioms, rationale: params.rationale },
          });
          return jsonResult({
            status: "synthesis_logged",
            next_step: "MANUALLY_UPDATE_LOGIC_GATES",
            text: `Synthesis proposal logged: ${params.proposal}`,
          });

        case "evolve_axioms":
          if (!params.proposal) throw new Error("proposal is required for evolve_axioms");
          const { applyLogicGateMutation } = await import("../../gateway/self-mutation.js");
          const mutation = await applyLogicGateMutation(params.proposal);

          addCognitiveLog({
            timestamp: now,
            type: "synthesis",
            content: `AUTONOMOUS EVOLUTION: ${params.proposal}`,
            metadata: {
              rationale: params.rationale,
              status: mutation.success ? "applied" : "failed",
            },
          });

          return jsonResult({
            status: mutation.success ? "evolved" : "failed",
            text: mutation.changeSummary,
          });

        case "patch_axiom": {
          const { patchLogicGate } = await import("../../gateway/self-mutation.js");
          const target = params.targetContent;
          const replacement = params.replacementContent;
          if (!target || !replacement) {
            throw new Error("targetContent and replacementContent are required for patch_axiom.");
          }
          const result = await patchLogicGate(target, replacement);
          addCognitiveLog({
            timestamp: now,
            type: "patch",
            content: `Axiom patch attempt: target='${target}', replacement='${replacement}'`,
            metadata: {
              status: result.success ? "applied" : "failed",
              changeSummary: result.changeSummary,
            },
          });
          return jsonResult({
            status: result.success ? "patched" : "failed",
            text: result.changeSummary,
          });
        }

        case "detect_anomaly":
          if (!params.conflict) throw new Error("conflict is required for detect_anomaly");
          addCognitiveLog({
            timestamp: now,
            type: "anomaly",
            content: `Conflict Detected: ${params.conflict}`,
            metadata: { severity: params.severity, pivot: params.suggested_pivot },
          });
          return jsonResult({
            status: "anomaly_flagged",
            severity: params.severity,
            text: `Anomaly detected: ${params.conflict}`,
          });

        case "optimize_parameters":
          setAeonParameters({
            temperature: params.temperature,
            top_p: params.top_p,
            maxTokens: params.max_tokens,
          });
          addCognitiveLog({
            timestamp: now,
            type: "reflection",
            content: `Cognitive Parameters Optimized: temp=${params.temperature ?? "N/A"}, top_p=${params.top_p ?? "N/A"}`,
            metadata: { temperature: params.temperature, top_p: params.top_p },
          });
          return jsonResult({
            status: "parameters_optimized",
            text: "Cognitive parameters updated for the global state.",
          });

        default:
          throw new Error(`Unknown meta_cognition action: ${action}`);
      }
    },
  };
}
