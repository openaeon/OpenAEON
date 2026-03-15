import fs from "node:fs/promises";
import path from "node:path";
import { Type, type Static } from "@sinclair/typebox";
import { addCognitiveLog } from "../../gateway/aeon-state.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult } from "./common.js";

/**
 * AEON Evolution Mandate Tool
 * Allows the agent to propose improvements to its own "DNA" (AGENTS.md).
 */

export const EvolutionMandateSchema = Type.Object({
  action: Type.Enum({
    propose_mandate: "propose_mandate",
    execute_mandate: "execute_mandate",
  } as const),
  mandate_change: Type.String({
    description: "Proposed addition or modification to the AGENTS.md directives.",
  }),
  rationale: Type.String({
    description: "Technical/philosophical rationale for this evolutionary skip.",
  }),
});

type EvolutionMandateParams = Static<typeof EvolutionMandateSchema>;

export function createEvolutionMandateTool(): AnyAgentTool {
  return {
    label: "Evolution Mandate",
    name: "evolution_mandate",
    description:
      "Allows AEON to propose autonomous updates to its own behavioral mandates (AGENTS.md). Results are logged to EVOLUTION_LOG.md.",
    parameters: EvolutionMandateSchema,
    execute: async (_id, args) => {
      const params = args as EvolutionMandateParams;
      const now = Date.now();
      const timestamp = new Date().toISOString();
      const dateStr = new Date().toLocaleDateString();

      switch (params.action) {
        case "propose_mandate":
          // Log the proposal to EVOLUTION_LOG.md
          const logPath = path.resolve(process.cwd(), "EVOLUTION_LOG.md");
          const logEntry = `
## [PROPOSAL] ${timestamp}
- **Date**: ${dateStr}
- **Rationale**: ${params.rationale}
- **Proposed Change**: 
\`\`\`markdown
${params.mandate_change}
\`\`\`
---
`;

          try {
            await fs.appendFile(logPath, logEntry);
          } catch (e) {
            // Create if doesn't exist
            await fs.writeFile(
              logPath,
              "# AEON Evolution Log\n\nTrack the self-optimization of behavioral mandates.\n" +
                logEntry,
            );
          }

          addCognitiveLog({
            timestamp: now,
            type: "reflection",
            content: `Proposed Mandate Evolution: ${params.rationale}`,
            metadata: { rationale: params.rationale },
          });

          return jsonResult({
            status: "mandate_proposed",
            log_path: "EVOLUTION_LOG.md",
            instruction:
              "Review the proposal in EVOLUTION_LOG.md. If approved, manually update AGENTS.md.",
            text: `Mandate proposal logged for evolution. Rationale: ${params.rationale}`,
          });

        case "execute_mandate":
          const { applyMandateEvolution } = await import("../../gateway/self-mutation.js");
          const mandate = await applyMandateEvolution(params.mandate_change);

          addCognitiveLog({
            timestamp: now,
            type: "reflection",
            content: `AUTONOMOUS MANDATE EVOLUTION: ${params.rationale}`,
            metadata: {
              rationale: params.rationale,
              status: mandate.success ? "applied" : "failed",
            },
          });

          return jsonResult({
            status: mandate.success ? "mandate_evolved" : "failed",
            text: mandate.changeSummary,
          });

        default:
          throw new Error(`Unknown action: ${params.action}`);
      }
    },
  };
}
