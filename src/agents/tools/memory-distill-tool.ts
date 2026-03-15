import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { resolveWorkspaceRoot } from "../workspace-dir.js";
import { loadConfig } from "../../config/config.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { calculatePeanoTraversedPoint } from "../../gateway/server-methods/aeon.js";
import { getSystemStatus } from "./system-status-tool.js";

const log = createSubsystemLogger("evolution");

export type DistillationResult = {
  status: "success" | "no-change" | "error";
  axiomsExtracted?: number;
  memorySizeBefore?: number;
  memorySizeAfter?: number;
  error?: string;
};

/**
 * AEON PROPHET: Memory Distillation Tool
 * Periodically compresses MEMORY.md into LOGIC_GATES.md by extracting verified truths (axioms).
 */
export async function distillMemory(
  options: { agentId?: string; workspaceDir?: string } = {},
): Promise<DistillationResult> {
  const cfg = loadConfig();
  const workspaceRoot =
    options.workspaceDir || resolveWorkspaceRoot(cfg.agents?.defaults?.workspace);
  const memoryPath = path.join(workspaceRoot, "MEMORY.md");
  const logicGatesPath = path.join(workspaceRoot, "LOGIC_GATES.md");

  try {
    const memoryContent = await fs.readFile(memoryPath, "utf-8");
    const stats = await fs.stat(memoryPath);

    // Extraction Logic: Look for lines marked with [AXIOM], [VERIFIED], or [TRUTH]
    // Handles various bracket styles and spacing.
    const lines = memoryContent.split("\n");
    const axioms = lines.filter((line) => /\[(AXIOM|VERIFIED|TRUTH)\]/i.test(line));
    const retractions = lines
      .filter((line) => /\[RETRACT\]/i.test(line))
      .map((line) => line.replace(/\[RETRACT\]/i, "").trim())
      .filter(Boolean);

    if (axioms.length === 0 && retractions.length === 0) {
      return { status: "no-change", memorySizeBefore: stats.size };
    }

    // Load existing gates and filter out retractions
    const existingGatesRaw = await fs.readFile(logicGatesPath, "utf-8").catch(() => "");
    let gateLines = existingGatesRaw.split("\n").filter((line) => line.trim().length > 0);

    // Apply retractions: remove lines that match retracted content
    if (retractions.length > 0) {
      gateLines = gateLines.filter((gate) => {
        return !retractions.some((r) => gate.includes(r));
      });
    }

    // Add new axioms with aging metadata and Peano-spatial coordinates
    const now = Date.now();
    const system = await getSystemStatus().catch(() => null);
    const cognitiveEntropy = system
      ? Math.min(100, 10 + Math.floor(((stats.size / 51200) * 100) / 4) + 5)
      : 15;
    const peanoCoord = calculatePeanoTraversedPoint(cognitiveEntropy);

    const newGatesWithMetadata = axioms
      .filter((a) => !existingGatesRaw.includes(a))
      .map((a) => {
        const axiomId = crypto.randomBytes(4).toString("hex");
        // Detect references to other axioms (e.g., [REF: a1b2c3d4])
        const refMatch = a.match(/\[REF: ([a-f0-9]{8})\]/i);
        const ref = refMatch ? refMatch[1] : null;

        const metadata = {
          ts: now,
          v: 3,
          id: axiomId,
          peano: peanoCoord,
          weight: 1, // Base mass
          ...(ref ? { ref } : {}),
        };

        return `${a} <!-- ${JSON.stringify(metadata)} -->`;
      });

    // Gravitational Logic: Update weights of referenced axioms
    const allAxiomsData = [...gateLines, ...newGatesWithMetadata].map((line) => {
      const match = line.match(/<!-- (\{.*\}) -->/);
      let meta = {
        id: "unknown",
        weight: 1,
        peano: { x: 0.5 },
        ts: now,
        ref: null as string | null,
      };
      if (match) {
        try {
          meta = JSON.parse(match[1]);
        } catch (e) {}
      }
      return { line, meta };
    });

    // Pass 1: Accumulate gravity (weight) from references
    allAxiomsData.forEach((axiom) => {
      if (axiom.meta.ref) {
        const target = allAxiomsData.find((a) => a.meta.id === axiom.meta.ref);
        if (target) {
          target.meta.weight = (target.meta.weight || 1) + 1;
        }
      }
    });

    // Pass 2: Calculate Entropy
    allAxiomsData.forEach((axiom) => {
      const ageHours = (now - (axiom.meta.ts || now)) / (1000 * 60 * 60);
      const weight = axiom.meta.weight || 1;
      const patchedFactor = (axiom.meta as any).patched ? 1.5 : 1.0;

      // Entropy formula: (Age / Weight) * PatchedFactor
      // Logarithmic scaling to keep it between 0-100
      let entropy = Math.min(100, Math.floor((ageHours / weight) * 5 * patchedFactor));
      // Newly added axioms start with low entropy (10)
      if (ageHours < 1) entropy = 10;

      (axiom.meta as any).entropy = entropy;
    });

    // Pass 3: Sort by Weight (Gravity) then Peano
    const sortedAxioms = allAxiomsData
      .sort((a, b) => {
        // High weight (Gravity) pulls to the top
        const weightDiff = (b.meta.weight || 1) - (a.meta.weight || 1);
        if (weightDiff !== 0) return weightDiff;
        // Then Peano proximity
        return (a.meta.peano?.x ?? 0.5) - (b.meta.peano?.x ?? 0.5);
      })
      .map((a) => {
        const cleanLine = a.line.replace(/ <!-- \{.*\} -->$/, "");
        return `${cleanLine} <!-- ${JSON.stringify(a.meta)} -->`;
      });

    const finalGates = sortedAxioms.join("\n");
    await fs.writeFile(logicGatesPath, finalGates + "\n");

    // Archive old memory (rename to MEMORY.bak.[timestamp])
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    await fs.writeFile(path.join(workspaceRoot, `MEMORY.bak.${timestamp}.md`), memoryContent);

    // Reset MEMORY.md with a fresh header
    const freshHeader = `# MEMORY (Evolutionary Ledger)\n\n*Reset at ${new Date().toLocaleString()} after distillation.*\n\n`;
    await fs.writeFile(memoryPath, freshHeader);

    return {
      status: "success",
      axiomsExtracted: newGatesWithMetadata.length,
      memorySizeBefore: stats.size,
      memorySizeAfter: freshHeader.length,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log.error("Distillation failed", { error: errorMessage });
    return { status: "error", error: errorMessage };
  }
}
