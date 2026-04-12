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
  checkpoint?: number;
  totalEntries?: number;
  lastDistillAt?: number;
  lastWriteSource?: "memory" | "logic-gates" | "maintenance";
  error?: string;
};

export type MemoryDistillState = {
  checkpoint: number;
  totalEntries: number;
  lastDistillAt: number | null;
  lastWriteSource: "memory" | "logic-gates" | "maintenance";
};

const DEFAULT_MEMORY_DISTILL_STATE: MemoryDistillState = {
  checkpoint: 0,
  totalEntries: 0,
  lastDistillAt: null,
  lastWriteSource: "memory",
};

function getDistillStatePath(workspaceRoot: string): string {
  return path.join(workspaceRoot, ".aeon", "memory-distill-state.json");
}

export async function readMemoryDistillState(
  options: { workspaceDir?: string } = {},
): Promise<MemoryDistillState> {
  try {
    const cfg = loadConfig();
    const workspaceRoot =
      options.workspaceDir || resolveWorkspaceRoot(cfg.agents?.defaults?.workspace);
    const statePath = getDistillStatePath(workspaceRoot);
    const raw = await fs.readFile(statePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<MemoryDistillState>;
    const checkpoint = Math.max(0, Number(parsed.checkpoint) || 0);
    const totalEntries = Math.max(0, Number(parsed.totalEntries) || 0);
    const lastDistillAt = Number(parsed.lastDistillAt);
    const source =
      parsed.lastWriteSource === "logic-gates" || parsed.lastWriteSource === "maintenance"
        ? parsed.lastWriteSource
        : "memory";
    return {
      checkpoint,
      totalEntries,
      lastDistillAt: Number.isFinite(lastDistillAt) ? lastDistillAt : null,
      lastWriteSource: source,
    };
  } catch {
    return { ...DEFAULT_MEMORY_DISTILL_STATE };
  }
}

async function writeMemoryDistillState(
  workspaceRoot: string,
  state: MemoryDistillState,
): Promise<void> {
  const statePath = getDistillStatePath(workspaceRoot);
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, JSON.stringify(state, null, 2) + "\n", "utf-8");
}

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
    const initialState = await readMemoryDistillState({ workspaceDir: workspaceRoot });
    const startOffset =
      initialState.checkpoint > stats.size ? 0 : Math.max(0, initialState.checkpoint);
    const incrementalContent = memoryContent.slice(startOffset);

    // Extraction Logic: Look for lines marked with [AXIOM], [VERIFIED], or [TRUTH]
    // Handles various bracket styles and spacing.
    const lines = incrementalContent.split("\n");
    const axioms = lines.filter((line) => /\[(AXIOM|VERIFIED|TRUTH)\]/i.test(line));
    const retractions = lines
      .filter((line) => /\[RETRACT\]/i.test(line))
      .map((line) => line.replace(/\[RETRACT\]/i, "").trim())
      .filter(Boolean);

    if (axioms.length === 0 && retractions.length === 0) {
      if (startOffset !== stats.size) {
        await writeMemoryDistillState(workspaceRoot, {
          checkpoint: stats.size,
          totalEntries: initialState.totalEntries,
          lastDistillAt: initialState.lastDistillAt,
          lastWriteSource: initialState.lastWriteSource,
        });
      }
      return {
        status: "no-change",
        memorySizeBefore: stats.size,
        checkpoint: stats.size,
        totalEntries: initialState.totalEntries,
        lastDistillAt: initialState.lastDistillAt ?? undefined,
        lastWriteSource: initialState.lastWriteSource,
      };
    }

    // Load existing gates and filter out retractions
    const existingGatesRaw = await fs.readFile(logicGatesPath, "utf-8").catch(() => "");
    let gateLines = existingGatesRaw.split("\n").filter((line) => line.trim().length > 0);

    // Dynamic Archive (High Entropy / Low Gravity Aging)
    const ARCHIVE_ENTROPY_THRESHOLD = 85;
    const MIN_GRAVITY_TO_STAY = 2;
    const archivedLines: string[] = [];

    gateLines = gateLines.filter((line) => {
      const match = line.match(/<!-- (\{.*\}) -->/);
      if (match) {
        try {
          const meta = JSON.parse(match[1]);
          if (
            meta.entropy > ARCHIVE_ENTROPY_THRESHOLD &&
            (meta.weight || 1) < MIN_GRAVITY_TO_STAY
          ) {
            archivedLines.push(line);
            return false;
          }
        } catch (e) {}
      }
      return true;
    });

    if (archivedLines.length > 0) {
      const archivePath = path.join(workspaceRoot, "LOGIC_GATES.bak.md");
      const archiveHeader =
        archivedLines.length > 0 ? `\n## ARCHIVED ${new Date().toISOString()}\n` : "";
      await fs.appendFile(archivePath, archiveHeader + archivedLines.join("\n") + "\n");
      log.info(`Archived ${archivedLines.length} high-entropy axioms to LOGIC_GATES.bak.md`);
    }

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
      .filter((a) => {
        // Semantic Overlap Check (Basic Keyword/Content overlap)
        const cleanA = a
          .replace(/\[(AXIOM|VERIFIED|TRUTH)\]/i, "")
          .trim()
          .toLowerCase();
        const isDuplicate = gateLines.some((existing) => {
          const cleanExisting = existing
            .split(" <!--")[0]
            .replace(/\[(AXIOM|VERIFIED|TRUTH)\]/i, "")
            .trim()
            .toLowerCase();
          return cleanExisting.includes(cleanA) || cleanA.includes(cleanExisting);
        });
        return !isDuplicate && !existingGatesRaw.includes(a);
      })
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

    // Archive snapshot so long-running sessions still have historical recovery points.
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    await fs.writeFile(path.join(workspaceRoot, `MEMORY.bak.${timestamp}.md`), memoryContent);

    // Keep MEMORY.md durable: append a distillation checkpoint instead of wiping content.
    // This preserves overnight work and keeps conversational recall discoverable.
    const checkpoint = [
      "",
      `## DISTILLATION_CHECKPOINT ${new Date().toISOString()}`,
      `- extracted_axioms: ${newGatesWithMetadata.length}`,
      `- retractions_applied: ${retractions.length}`,
      `- memory_size_before: ${stats.size}`,
      `- logic_gates_total: ${sortedAxioms.length}`,
      "",
    ].join("\n");
    await fs.appendFile(memoryPath, checkpoint, "utf-8");
    const memoryAfterStats = await fs.stat(memoryPath).catch(() => null);
    const nextState: MemoryDistillState = {
      checkpoint: memoryAfterStats?.size ?? stats.size,
      totalEntries: sortedAxioms.length,
      lastDistillAt: now,
      lastWriteSource: "maintenance",
    };
    await writeMemoryDistillState(workspaceRoot, nextState);

    return {
      status: "success",
      axiomsExtracted: newGatesWithMetadata.length,
      memorySizeBefore: stats.size,
      memorySizeAfter: memoryAfterStats?.size ?? stats.size,
      checkpoint: nextState.checkpoint,
      totalEntries: nextState.totalEntries,
      lastDistillAt: nextState.lastDistillAt ?? undefined,
      lastWriteSource: nextState.lastWriteSource,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log.error("Distillation failed", { error: errorMessage });
    return { status: "error", error: errorMessage };
  }
}
