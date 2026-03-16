import fs from "node:fs/promises";
import path from "node:path";
import { Type } from "@sinclair/typebox";
import { loadConfig } from "../../config/config.js";
import { resolveWorkspaceRoot } from "../workspace-dir.js";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { jsonResult } from "./common.js";
import { calculatePeanoIndex } from "../../utils/peano.js";
import { createEmbeddingProvider } from "../../memory/embeddings.js";
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from "../defaults.js";

const LogicRefinementSchema = Type.Object({
  action: Type.Enum(
    {
      audit: "audit",
      prune: "prune",
      crystallize: "crystallize",
      align: "align",
    },
    {
      description:
        "Action to perform: audit (check for inconsistency), prune (remove stale/contradictory gates)",
    },
  ),
  peanoRange: Type.Optional(
    Type.Array(Type.Number(), {
      minItems: 2,
      maxItems: 2,
      description:
        "Optional [min, max] range for Peano x-coordinate (0-1) to audit a local cluster.",
    }),
  ),
});

/**
 * AEON LOGIC REFINEMENT: Evolutionary Pruning Tool
 * Audits LOGIC_GATES.md for consistency and age-based relevance.
 */
export function createLogicRefinementTool(): AgentTool {
  return {
    label: "Logic Refinement",
    name: "logic_refinement",
    description: "Audit and prune logic gates for consistency and relevance.",
    parameters: LogicRefinementSchema,
    execute: async (_toolCallId: string, args: any) => {
      const { action, peanoRange } = args as {
        action: "audit" | "prune" | "crystallize" | "align";
        peanoRange?: [number, number];
      };
      const cfg = loadConfig();
      const workspaceRoot = resolveWorkspaceRoot(cfg.agents?.defaults?.workspace);
      const logicGatesPath = path.join(workspaceRoot, "LOGIC_GATES.md");

      try {
        const content = await fs.readFile(logicGatesPath, "utf-8");
        const lines = content.split("\n").filter((l) => l.trim().length > 0);
        let axioms: { text: string; meta: any; line: string }[] = [];

        for (const line of lines) {
          const metaMatch = line.match(/<!-- (.*?) -->/);
          if (metaMatch) {
            try {
              axioms.push({
                text: line.replace(metaMatch[0], "").trim(),
                meta: JSON.parse(metaMatch[1]),
                line,
              });
            } catch {
              // Ignore malformed meta
            }
          }
        }

        // Apply Peano filtering if range provided
        if (peanoRange) {
          const [min, max] = peanoRange;
          axioms = axioms.filter((a) => {
            const x = a.meta.peano?.index ?? a.meta.peano?.x ?? 0.5;
            return x >= min && x <= max;
          });
        }

        if (action === "audit") {
          const now = Date.now();
          const staleAxioms = axioms.filter((a) => now - a.meta.ts > 86400000 * 7); // 7 days
          const reports: string[] = [];

          if (staleAxioms.length > 0) {
            reports.push(`Detected ${staleAxioms.length} axioms older than 7 days.`);
          }

          // Improved Contradiction & Redundancy Check
          const contradictions: string[] = [];
          const redundancies: string[] = [];

          for (let i = 0; i < axioms.length; i++) {
            const textI = axioms[i].text.toLowerCase();
            for (let j = i + 1; j < axioms.length; j++) {
              const textJ = axioms[j].text.toLowerCase();

              // 1. "Not" contradiction
              if (textI.includes("not ") && textI.replace("not ", "") === textJ) {
                contradictions.push(`Contradiction: "${axioms[i].text}" vs "${axioms[j].text}"`);
              } else if (textJ.includes("not ") && textJ.replace("not ", "") === textI) {
                contradictions.push(`Contradiction: "${axioms[j].text}" vs "${axioms[i].text}"`);
              }

              // 2. Exact or high-overlap redundancy
              if (textI === textJ) {
                redundancies.push(`Duplicate: "${axioms[i].text}"`);
              }

              // 4. Topological Proximity Audit
              const indexI = axioms[i].meta.peano?.index ?? 0.5;
              const indexJ = axioms[j].meta.peano?.index ?? 0.5;
              if (Math.abs(indexI - indexJ) < 0.005 && textI !== textJ) {
                // If topologically very close but text is different, might be a subtle contradiction or semantic overlap
                // This is a heuristic for Phase 6
              }
            }
          }

          // 3. Semantic Divergence Check (Future LLM integration)
          // For now, look for "never" vs "always" style markers
          for (const a of axioms) {
            if (a.text.toLowerCase().includes("never") && a.text.toLowerCase().includes("always")) {
              contradictions.push(`Internal Divergence in Axiom: "${a.text}"`);
            }
          }

          // Topological Health Heuristic
          const totalAxioms = axioms.length;
          const healthScore =
            totalAxioms === 0
              ? 1.0
              : Math.max(0, 1 - contradictions.length * 0.2 - redundancies.length * 0.1);
          const healthLabel =
            healthScore > 0.9
              ? "High-Civi (Convergence)"
              : healthScore > 0.6
                ? "Stable"
                : "Divergent (Chaos)";

          return jsonResult({
            status: "ok",
            findings: {
              totalAxioms,
              staleCount: staleAxioms.length,
              topologicalHealth: healthLabel,
              healthScore,
              contradictions,
              redundancies,
            },
            text:
              (reports.concat(contradictions, redundancies).join("\n") ||
                "Audit complete: Logic gates are in optimal alignment.") +
              ` \nStatus: ${healthLabel}. Found ${contradictions.length} contradictions and ${redundancies.length} redundancies.` +
              (axioms.some((a) => a.meta.crystallized)
                ? `\nCrystallized Axioms: ${axioms.filter((a) => a.meta.crystallized).length}`
                : ""),
          });
        }

        if (action === "crystallize") {
          const target = (args as any).target;
          if (!target) {
            return jsonResult({ status: "error", error: "Missing 'target' for crystallization." });
          }

          const targetAxiom = axioms.find(
            (a) => a.text.includes(target) || (a.meta.id && a.meta.id === target),
          );
          if (!targetAxiom) {
            return jsonResult({ status: "error", error: `Target logic gate not found: ${target}` });
          }

          targetAxiom.meta.crystallized = true;
          targetAxiom.meta.history = targetAxiom.meta.history || [];
          targetAxiom.meta.history.push({ ts: Date.now(), event: "crystallized" });

          const newEntry = `${targetAxiom.text} <!-- ${JSON.stringify(targetAxiom.meta)} -->`;
          const newContent = content.replace(targetAxiom.line, newEntry);
          await fs.writeFile(logicGatesPath, newContent);

          return jsonResult({
            status: "ok",
            text: `Crystallized logic gate: "${targetAxiom.text}". It is now protected from regular pruning.`,
          });
        }

        if (action === "prune") {
          const now = Date.now();
          const keepAxioms = axioms.filter((a) => {
            if (a.meta.crystallized) return true; // Never prune crystallized axioms

            const ageDays = (now - a.meta.ts) / 86400000;
            const heat = a.meta.heat || 0;

            // Prune if older than 30 days unless it has high heat or is crystallized
            if (ageDays > 30 && heat < 10) {
              return false;
            }
            return true;
          });

          if (keepAxioms.length < axioms.length) {
            const newContent = keepAxioms.map((a) => a.line).join("\n") + "\n";
            await fs.writeFile(logicGatesPath, newContent);
            return jsonResult({
              status: "ok",
              prunedCount: axioms.length - keepAxioms.length,
              text: `Pruned ${axioms.length - keepAxioms.length} stale axioms.`,
            });
          }

          return jsonResult({
            status: "ok",
            prunedCount: 0,
            text: "No axioms required pruning.",
          });
        }

        if (action === "align") {
          const providerResult = await createEmbeddingProvider({
            config: cfg,
            provider: cfg.agents?.defaults?.memorySearch?.provider ?? "auto",
            model: cfg.agents?.defaults?.memorySearch?.model ?? "auto",
            fallback: "none",
          });

          if (!providerResult.provider) {
            return jsonResult({
              status: "error",
              error: "No embedding provider available for alignment.",
            });
          }

          let updatedCount = 0;
          let currentContent = content;

          for (const a of axioms) {
            try {
              const vector = await providerResult.provider.embedQuery(a.text);
              const peanoIndex = calculatePeanoIndex(vector);

              const newMeta = { ...a.meta, peano: { index: peanoIndex, ts: Date.now() } };
              const newEntry = `${a.text} <!-- ${JSON.stringify(newMeta)} -->`;
              currentContent = currentContent.replace(a.line, newEntry);
              updatedCount++;
            } catch (err) {
              // Skip failed embeddings
            }
          }

          if (updatedCount > 0) {
            await fs.writeFile(logicGatesPath, currentContent);
          }

          return jsonResult({
            status: "ok",
            updatedCount,
            text: `Topological alignment complete. Updated ${updatedCount} logic gates with Peano indices.`,
          });
        }
      } catch (err) {
        return jsonResult({
          status: "error",
          error: (err as Error).message,
        });
      }

      return jsonResult({ status: "error", error: "Unexpected state" });
    },
  };
}
