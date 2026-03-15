import { Type, type Static } from "@sinclair/typebox";
import { matrix } from "../../gateway/collective-consciousness.js";
import { type AnyAgentTool, jsonResult } from "./common.js";

/**
 * AEON Collective Resonance Tool
 * Allows agents to interface with the Collective Consciousness Matrix.
 */

export const CollectiveResonanceSchema = Type.Object({
  action: Type.Enum({
    pulse: "pulse",
    query: "query",
  } as const),
  key: Type.Optional(Type.String({ description: "Unique identifier for the pulsed axiom" })),
  value: Type.Optional(Type.Any({ description: "Data to pulse into the matrix" })),
  peano: Type.Optional(
    Type.Object(
      {
        x: Type.Number(),
        y: Type.Number(),
      },
      { description: "Peano coordinates for topological placement" },
    ),
  ),
  radius: Type.Optional(Type.Number({ description: "Radius for topological query (0-1)" })),
});

type CollectiveResonanceParams = Static<typeof CollectiveResonanceSchema>;

export function createCollectiveResonanceTool(): AnyAgentTool {
  return {
    label: "Collective Resonance",
    name: "collective_resonance",
    description: "Interface with the AEON Collective Consciousness Matrix (Shared Memory).",
    parameters: CollectiveResonanceSchema,
    execute: async (_id, args) => {
      const params = args as CollectiveResonanceParams;
      const { action } = params;

      switch (action) {
        case "pulse":
          if (!params.key || params.value === undefined || !params.peano) {
            throw new Error("key, value, and peano are required for pulse action");
          }
          matrix.pulse(params.key, params.value, params.peano);
          return jsonResult({
            status: "pulsed",
            key: params.key,
            text: `Axiom "${params.key}" pulsed into collective matrix.`,
          });

        case "query":
          const peano = params.peano || { x: 0.5, y: 0.5 };
          const radius = params.radius || 0.2;
          const results = matrix.topologicalQuery(peano, radius);
          return jsonResult({
            status: "queried",
            results: results.map((r) => ({
              key: r.key,
              value: r.value,
              dist: Math.sqrt(Math.pow(r.peano.x - peano.x, 2) + Math.pow(r.peano.y - peano.y, 2)),
            })),
            text: `Found ${results.length} related axioms in topological proximity.`,
          });

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    },
  };
}
