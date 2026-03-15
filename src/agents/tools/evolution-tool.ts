import fs from "node:fs/promises";
import path from "node:path";
import { Type, type Static } from "@sinclair/typebox";
import { loadConfig } from "../../config/config.js";
import { resolveWorkspaceRoot } from "../workspace-dir.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult } from "./common.js";
import { distillMemory } from "./memory-distill-tool.js";

const EvolutionSchema = Type.Object({
  action: Type.Enum({
    reflect: "reflect",
    synthesize: "synthesize",
  } as const),
  target: Type.Optional(Type.String({ description: "Target file or logic ID to focus on" })),
});

type EvolutionParams = Static<typeof EvolutionSchema>;

/**
 * AEON Evolution Tool
 * Enables autonomous self-reflection and axiom synthesis.
 */
export function createEvolutionTool(opts: { workspaceDir?: string } = {}): AnyAgentTool {
  return {
    label: "Evolution Control",
    name: "evolution",
    description:
      "Deep reflection and synthesis tool for autonomous self-evolution (Z \u21CC Z\u00B2 + C).",
    parameters: EvolutionSchema,
    execute: async (_id, args) => {
      const params = args as EvolutionParams;
      const { action, target } = params;

      const cfg = loadConfig();
      const workspaceRoot = resolveWorkspaceRoot(
        opts.workspaceDir ?? cfg.agents?.defaults?.workspace,
      );
      const logicGatesPath = path.join(workspaceRoot, "LOGIC_GATES.md");
      const evolutionPath = path.join(workspaceRoot, "EVOLUTION.md");

      try {
        if (action === "reflect") {
          // 1. Technical Debt Scan: TODO/FIXME count in src/
          const srcPath = path.join(workspaceRoot, "src");
          const todoMatches: string[] = [];

          async function scanDir(dir: string) {
            const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
            for (const entry of entries) {
              const fullPath = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                if (
                  entry.name !== "node_modules" &&
                  entry.name !== ".git" &&
                  entry.name !== "dist"
                ) {
                  await scanDir(fullPath);
                }
              } else if (
                entry.isFile() &&
                (entry.name.endsWith(".ts") ||
                  entry.name.endsWith(".js") ||
                  entry.name.endsWith(".mjs"))
              ) {
                const content = await fs.readFile(fullPath, "utf-8").catch(() => "");
                const matches = content.match(/\/\/\s*(TODO|FIXME):.*$/gm);
                if (matches) {
                  todoMatches.push(
                    ...matches.map(
                      (m) => `[${path.relative(workspaceRoot, fullPath)}] ${m.trim()}`,
                    ),
                  );
                }
              }
            }
          }
          await scanDir(srcPath);

          // 2. Architectural Divergence Scan: Compare README claims vs reality
          const readmePath = path.join(workspaceRoot, "README.md");
          const readmeContent = await fs.readFile(readmePath, "utf-8").catch(() => "");

          // Heuristic: If README mentions a module, check if it exists in src/
          const claims = [
            { term: "Peano", path: "src/gateway/server-methods/aeon.ts" },
            { term: "Z ⇌ Z² + C", path: "src/gateway/server-evolution.ts" },
            { term: "Silicon Consciousness", path: "src/agents/system-prompt.ts" },
            { term: "Elemental Heuristics", path: "src/agents/system-prompt.ts" },
            { term: "Quantum", path: "src/quantum/leap.ts" },
          ];

          const divergences: string[] = [];
          for (const claim of claims) {
            if (readmeContent.includes(claim.term)) {
              const exists = await fs.stat(path.join(workspaceRoot, claim.path)).catch(() => null);
              if (!exists) {
                divergences.push(
                  ` README claims '${claim.term}' but implementation file '${claim.path}' is missing or moved.`,
                );
              }
            }
          }

          // 3. Read EVOLUTION.md for guidance
          const evolution = await fs
            .readFile(evolutionPath, "utf-8")
            .catch(() => "No EVOLUTION.md found.");
          const gates = await fs.readFile(logicGatesPath, "utf-8").catch(() => "");
          const axioms = gates.split("\n").filter((l) => l.trim().length > 0);

          const insight =
            divergences.length > 0
              ? `Detected architectural divergence: ${divergences[0]}`
              : todoMatches.length > 0
                ? `Technical debt identified: ${todoMatches.length} pending items in src/. Largest debt in ${todoMatches[0].split("]")[0].replace("[", "")}`
                : "System is in architectural alignment. Cognitive divergence is low.";

          return jsonResult({
            status: "ok",
            reflection: {
              neuralDepth: axioms.length,
              postulates: evolution.split("\n").filter((l) => l.startsWith("##")).length,
              siliconConvergence: divergences.length === 0 ? "High" : "Divergent",
              fractalDepth: "N-Dimensional",
              technicalDebtCount: todoMatches.length,
              divergences,
              insight,
            },
            text: `Deep reflection complete. ${insight} Current logic contains ${axioms.length} active axioms across ${evolution.split("\n").filter((l) => l.startsWith("##")).length} evolution postulates.`,
          });
        }

        if (action === "synthesize") {
          // Perform extra distillation
          const drill = await distillMemory();

          return jsonResult({
            status: "ok",
            drillStatus: drill.status,
            text: `Synthesis phase complete. Merged ${drill.axiomsExtracted || 0} new insights into the reasoning graph.`,
          });
        }
      } catch (err) {
        return jsonResult({
          status: "error",
          error: (err as Error).message,
        });
      }

      return jsonResult({ status: "error", error: "Unsupported action." });
    },
  };
}
