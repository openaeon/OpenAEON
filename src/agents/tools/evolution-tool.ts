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
      const { action } = params;

      const cfg = loadConfig();
      const workspaceRoot = resolveWorkspaceRoot(
        opts.workspaceDir ?? cfg.agents?.defaults?.workspace,
      );
      const logicGatesPath = path.join(workspaceRoot, "LOGIC_GATES.md");
      const evolutionPath = path.join(workspaceRoot, "EVOLUTION.md");

      try {
        if (action === "reflect") {
          const srcPath = path.join(workspaceRoot, "src");
          const files: string[] = [];
          async function walk(dir: string) {
            const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
            for (const entry of entries) {
              if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") {
                continue;
              }
              const fullPath = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                await walk(fullPath);
              } else if (entry.isFile() && /\.(ts|js|mjs)$/.test(entry.name)) {
                files.push(fullPath);
              }
            }
          }
          await walk(srcPath);

          const dependencyGraph = new Map<string, Set<string>>();
          const changeHeat: Array<{ file: string; score: number }> = [];
          const defectClusters = new Map<string, number>();
          const runtimeFailurePatterns = {
            throwCount: 0,
            catchWithoutHandling: 0,
            unsafeAny: 0,
          };

          for (const file of files) {
            const relative = path.relative(workspaceRoot, file);
            const content = await fs.readFile(file, "utf-8").catch(() => "");
            const imports = Array.from(
              content.matchAll(/from\s+["']([^"']+)["']/g),
              (m) => m[1],
            ).filter((imp) => imp.startsWith("."));
            dependencyGraph.set(relative, new Set(imports));

            const throwCount = (content.match(/\bthrow\b/g) ?? []).length;
            const catchCount = (content.match(/catch\s*\(/g) ?? []).length;
            const todoCount = (content.match(/TODO|FIXME|HACK/g) ?? []).length;
            const anyCount = (content.match(/\bany\b/g) ?? []).length;
            runtimeFailurePatterns.throwCount += throwCount;
            runtimeFailurePatterns.catchWithoutHandling += Math.max(0, catchCount - throwCount);
            runtimeFailurePatterns.unsafeAny += anyCount;
            const score = throwCount * 2 + todoCount * 1.5 + anyCount;
            changeHeat.push({ file: relative, score });

            const topDir = relative.split(path.sep)[1] ?? "root";
            defectClusters.set(topDir, (defectClusters.get(topDir) ?? 0) + score);
          }

          changeHeat.sort((a, b) => b.score - a.score);
          const hotModules = changeHeat.slice(0, 8);
          const dependencyRisk = Array.from(dependencyGraph.entries())
            .map(([file, deps]) => ({ file, depCount: deps.size }))
            .sort((a, b) => b.depCount - a.depCount)
            .slice(0, 8);
          const clusterList = Array.from(defectClusters.entries())
            .map(([module, score]) => ({ module, score }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 6);

          const candidates = hotModules.slice(0, 5).map((entry, idx) => {
            const module = entry.file.split(path.sep).slice(0, 2).join("/");
            return {
              id: `refactor-${idx + 1}`,
              module,
              file: entry.file,
              expectedBenefit: Math.min(1, 0.3 + entry.score / 20),
              risk: Math.min(1, 0.25 + (dependencyRisk.find((d) => d.file === entry.file)?.depCount ?? 0) / 20),
              impactModules: Array.from(
                new Set(
                  [module].concat(
                    Array.from(dependencyGraph.get(entry.file) ?? []).map((dep) =>
                      path.normalize(path.join(path.dirname(entry.file), dep)),
                    ),
                  ),
                ),
              ).slice(0, 6),
              verificationSteps: [
                `Run targeted tests for ${module}`,
                "Run pnpm test for touched packages",
                "Validate aeon.status telemetry parity before/after",
              ],
            };
          });

          const evolution = await fs
            .readFile(evolutionPath, "utf-8")
            .catch(() => "No EVOLUTION.md found.");
          const gates = await fs.readFile(logicGatesPath, "utf-8").catch(() => "");
          const axioms = gates.split("\n").filter((l) => l.trim().length > 0);
          const insight =
            candidates.length > 0
              ? `Architecture reflection found ${candidates.length} executable refactor candidates.`
              : "Architecture reflection completed with no high-priority candidates.";

          return jsonResult({
            status: "ok",
            reflection: {
              neuralDepth: axioms.length,
              postulates: evolution.split("\n").filter((l) => l.startsWith("##")).length,
              siliconConvergence: candidates.length <= 2 ? "High" : "Divergent",
              fractalDepth: "N-Dimensional",
              dependencyGraphSize: dependencyGraph.size,
              hotModules,
              defectClusters: clusterList,
              runtimeFailurePatterns,
              refactorCandidates: candidates,
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
