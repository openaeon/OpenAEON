import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { Type } from "@sinclair/typebox";
import { loadConfig } from "../../config/config.js";
import { resolveWorkspaceRoot } from "../workspace-dir.js";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { jsonResult } from "./common.js";
import { calculatePeanoIndex } from "../../utils/peano.js";
import { createEmbeddingProvider } from "../../memory/embeddings.js";
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from "../defaults.js";
import { runAgentStep } from "./agent-step.js";

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

type ParsedAxiom = {
  text: string;
  meta: Record<string, any>;
  line: string;
  module: string;
};

type SemanticConflict = {
  pair: [string, string];
  confidence: number;
  conflictType: "negation" | "policy-divergence" | "semantic-divergence" | "duplication";
  evidence: string[];
  affectedModules: string[];
  impactScope: number;
  fallback: boolean;
  model?: string;
  latencyMs?: number;
  action: "merge" | "keep_both" | "prefer_latest" | "manual_review";
};

function normalizeText(input: string): string {
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

function extractModule(meta: Record<string, any>): string {
  const candidates = [meta.module, meta.scope, meta.component, meta.path, meta.agentId];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "unknown";
}

async function arbitrateConflict(params: {
  left: ParsedAxiom;
  right: ParsedAxiom;
  heuristic: Omit<SemanticConflict, "fallback">;
}): Promise<SemanticConflict> {
  const startedAt = Date.now();
  const sessionKey = `agent:main:deconfliction:${crypto.randomUUID()}`;
  const prompt = JSON.stringify(
    {
      task: "Assess whether two axioms are in semantic conflict.",
      left: params.left.text,
      right: params.right.text,
      expectedSchema: {
        conflict: true,
        confidence: 0.0,
        conflictType: "semantic-divergence",
        evidence: ["..."],
        action: "manual_review",
      },
    },
    null,
    2,
  );
  try {
    const response = await runAgentStep({
      sessionKey,
      message: prompt,
      extraSystemPrompt:
        "Return strict JSON only. No markdown. confidence in [0,1]. action one of merge|keep_both|prefer_latest|manual_review.",
      timeoutMs: 12_000,
      sourceTool: "logic_refinement",
    });
    const parsed = response ? (JSON.parse(response) as Record<string, unknown>) : null;
    if (!parsed || parsed.conflict !== true) {
      throw new Error("llm returned non-conflict");
    }
    const confidenceRaw = Number(parsed.confidence);
    const confidence = Number.isFinite(confidenceRaw)
      ? Math.max(0, Math.min(1, confidenceRaw))
      : params.heuristic.confidence * 0.85;
    const actionRaw = parsed.action;
    const action: SemanticConflict["action"] =
      actionRaw === "merge" ||
      actionRaw === "keep_both" ||
      actionRaw === "prefer_latest" ||
      actionRaw === "manual_review"
        ? actionRaw
        : "manual_review";
    const typeRaw = parsed.conflictType;
    const conflictType: SemanticConflict["conflictType"] =
      typeRaw === "negation" ||
      typeRaw === "policy-divergence" ||
      typeRaw === "semantic-divergence" ||
      typeRaw === "duplication"
        ? typeRaw
        : params.heuristic.conflictType;
    const evidence = Array.isArray(parsed.evidence)
      ? parsed.evidence.filter((v): v is string => typeof v === "string").slice(0, 4)
      : params.heuristic.evidence;
    return {
      ...params.heuristic,
      confidence,
      conflictType,
      evidence: evidence.length > 0 ? evidence : params.heuristic.evidence,
      action,
      fallback: false,
      model: `${DEFAULT_PROVIDER}/${DEFAULT_MODEL}`,
      latencyMs: Date.now() - startedAt,
    };
  } catch {
    return {
      ...params.heuristic,
      confidence: Math.max(0.05, params.heuristic.confidence * 0.85),
      fallback: true,
      model: undefined,
      latencyMs: Date.now() - startedAt,
    };
  }
}

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
        let axioms: ParsedAxiom[] = [];

        for (const line of lines) {
          const metaMatch = line.match(/<!-- (.*?) -->/);
          if (metaMatch) {
            try {
              axioms.push({
                text: line.replace(metaMatch[0], "").trim(),
                meta: JSON.parse(metaMatch[1]) as Record<string, any>,
                line,
                module: "unknown",
              });
            } catch {
              // Ignore malformed meta
            }
          }
        }
        axioms = axioms.map((entry) => ({ ...entry, module: extractModule(entry.meta) }));

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

          const contradictions: string[] = [];
          const redundancies: string[] = [];
          const candidateConflicts: Array<{
            left: ParsedAxiom;
            right: ParsedAxiom;
            heuristic: Omit<SemanticConflict, "fallback">;
          }> = [];

          for (let i = 0; i < axioms.length; i++) {
            const left = axioms[i];
            const textI = normalizeText(left.text);
            for (let j = i + 1; j < axioms.length; j++) {
              const right = axioms[j];
              const textJ = normalizeText(right.text);
              const affectedModules = Array.from(new Set([left.module, right.module]));
              const impactScope = affectedModules.length;
              const evidence: string[] = [];
              let conflictType: SemanticConflict["conflictType"] | null = null;
              let confidence = 0;
              let action: SemanticConflict["action"] = "manual_review";

              if (textI === textJ) {
                redundancies.push(`Duplicate: "${left.text}"`);
                conflictType = "duplication";
                confidence = 0.91;
                action = "merge";
                evidence.push("Exact normalized string match.");
              } else if (
                (textI.includes("not ") && textI.replace("not ", "") === textJ) ||
                (textJ.includes("not ") && textJ.replace("not ", "") === textI)
              ) {
                contradictions.push(`Contradiction: "${left.text}" vs "${right.text}"`);
                conflictType = "negation";
                confidence = 0.93;
                action = "manual_review";
                evidence.push('Negation marker ("not") yields opposing propositions.');
              } else {
                const hasAlwaysNever =
                  (textI.includes("always") && textJ.includes("never")) ||
                  (textJ.includes("always") && textI.includes("never"));
                const nearTopo =
                  Math.abs((left.meta.peano?.index ?? 0.5) - (right.meta.peano?.index ?? 0.5)) <
                  0.01;
                if (hasAlwaysNever || nearTopo) {
                  conflictType = hasAlwaysNever ? "policy-divergence" : "semantic-divergence";
                  confidence = hasAlwaysNever ? 0.8 : 0.62;
                  action = hasAlwaysNever ? "manual_review" : "prefer_latest";
                  if (hasAlwaysNever) {
                    evidence.push('Policy polarity mismatch ("always" vs "never").');
                  }
                  if (nearTopo) {
                    evidence.push("Topological proximity indicates overlapping concern space.");
                  }
                }
              }

              if (conflictType) {
                candidateConflicts.push({
                  left,
                  right,
                  heuristic: {
                    pair: [left.meta.id ?? left.text, right.meta.id ?? right.text],
                    confidence,
                    conflictType,
                    evidence,
                    affectedModules,
                    impactScope,
                    action,
                  },
                });
              }
            }
          }

          const semanticConflicts: SemanticConflict[] = [];
          let llmAttempts = 0;
          let llmFallbacks = 0;
          const arbitrationCandidates = candidateConflicts.slice(0, 8);
          for (const candidate of arbitrationCandidates) {
            llmAttempts += 1;
            const resolved = await arbitrateConflict(candidate);
            if (resolved.fallback) {
              llmFallbacks += 1;
            }
            semanticConflicts.push(resolved);
          }

          // Topological Health Heuristic
          const totalAxioms = axioms.length;
          const healthScore =
            totalAxioms === 0
              ? 1.0
              : Math.max(
                  0,
                  1 - contradictions.length * 0.18 - redundancies.length * 0.08 - semanticConflicts.length * 0.05,
                );
          const healthLabel =
            healthScore > 0.9
              ? "High-Civi (Convergence)"
              : healthScore > 0.6
                ? "Stable"
                : "Divergent (Chaos)";
          const conflictGraph = {
            nodeCount: totalAxioms,
            edgeCount: semanticConflicts.length,
            highConfidenceConflicts: semanticConflicts.filter((entry) => entry.confidence >= 0.78)
              .length,
          };

          return jsonResult({
            status: "ok",
            findings: {
              totalAxioms,
              staleCount: staleAxioms.length,
              topologicalHealth: healthLabel,
              healthScore,
              contradictions,
              redundancies,
              conflicts: semanticConflicts,
              conflictGraph,
              deconfliction: {
                pipelineType: "deconfliction",
                llmAttempts,
                llmFallbacks,
                fallback: llmFallbacks > 0,
                confidence: llmAttempts > 0 ? (llmAttempts - llmFallbacks) / llmAttempts : 0,
              },
            },
            text:
              (reports.concat(contradictions, redundancies).join("\n") ||
                "Audit complete: Logic gates are in optimal alignment.") +
              ` \nStatus: ${healthLabel}. Found ${contradictions.length} contradictions, ${redundancies.length} redundancies, ${semanticConflicts.length} semantic conflicts.` +
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
