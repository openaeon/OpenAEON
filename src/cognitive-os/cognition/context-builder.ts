import fs from "node:fs/promises";
import path from "node:path";
import { calculatePeanoIndex, alignPointsTopologically } from "../../utils/peano.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { discoverProgressiveContextHints } from "./progressive-context.js";

const log = createSubsystemLogger("cognition");

export type ContextPiece = {
  content: string;
  id: string;
  peanoIndex: number;
  weight: number;
};

/**
 * FCA Layer 1 & 2: Hilbert-Space Context Ordering
 * Sorts knowledge and transient memories using a space-filling curve index
 * to ensure semantic/topological proximity in the LLM's attention window.
 */
export async function buildHilbertSortedContext(
  workspaceDir: string,
  limit = 15,
): Promise<string[]> {
  const logicGatesPath = path.join(workspaceDir, "LOGIC_GATES.md");
  const memoryPath = path.join(workspaceDir, "MEMORY.md");

  try {
    const [logicContent, memoryContent] = await Promise.all([
      fs.readFile(logicGatesPath, "utf-8").catch(() => ""),
      fs.readFile(memoryPath, "utf-8").catch(() => ""),
    ]);

    const allLines = [...logicContent.split("\n"), ...memoryContent.split("\n")].filter(
      (l) => l.trim().length > 0 && !l.startsWith("#") && !l.startsWith("##"),
    );

    const pieces: ContextPiece[] = allLines.map((line) => {
      const metaMatch = line.match(/<!-- (\{.*\}) -->/);
      let id = "untagged";
      let peanoIndex = 0.5;
      let weight = 1;

      if (metaMatch) {
        try {
          const meta = JSON.parse(metaMatch[1]);
          id = meta.id || id;
          peanoIndex = meta.peano?.x ?? calculatePeanoIndexFromText(line);
          weight = meta.weight || weight;
        } catch (e) {}
      } else {
        peanoIndex = calculatePeanoIndexFromText(line);
      }

      return {
        content: line.replace(/ <!-- \{.*\} -->$/, "").trim(),
        id,
        peanoIndex,
        weight,
      };
    });

    // Sort by Peano Index (Topological grouping)
    // This clusters related concepts together in the prompt
    const sorted = pieces.sort((a, b) => a.peanoIndex - b.peanoIndex).slice(0, limit);
    const hints = await discoverProgressiveContextHints({ workspaceDir, maxHints: 3 });

    return [
      ...hints.map((hint) => `[Context: ${hint.path}]\n${hint.content}`),
      ...sorted.map((p) => p.content),
    ].slice(0, limit);
  } catch (err) {
    log.error("Failed to build Hilbert context", { error: String(err) });
    return [];
  }
}

function calculatePeanoIndexFromText(text: string): number {
  // Hash-based deterministic fallback for untagged text
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 1000) / 1000;
}
