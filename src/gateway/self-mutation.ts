import fs from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "../config/config.js";
import { resolveWorkspaceRoot } from "../agents/workspace-dir.js";

/**
 * AEON Self-Mutation Provider
 * Handles the autonomous modification of AGENTS.md and LOGIC_GATES.md.
 */

export interface MutationResult {
  success: boolean;
  affectedFile: string;
  changeSummary: string;
}

export async function applyLogicGateMutation(proposal: string): Promise<MutationResult> {
  const cfg = loadConfig();
  const workspaceRoot = resolveWorkspaceRoot(cfg.agents?.defaults?.workspace);
  const logicGatesPath = path.join(workspaceRoot, "LOGIC_GATES.md");

  try {
    const timestamp = Date.now();
    const meta = {
      ts: timestamp,
      v: 2, // version 2 supports patching
      peano: { x: 0.5, y: 0.5 },
    };
    const newEntry = `${proposal} <!-- ${JSON.stringify(meta)} -->\n`;

    await fs.appendFile(logicGatesPath, newEntry);

    return {
      success: true,
      affectedFile: "LOGIC_GATES.md",
      changeSummary: `Added new logic gate: ${proposal}`,
    };
  } catch (err) {
    console.error("Mutation failed:", err);
    return {
      success: false,
      affectedFile: "LOGIC_GATES.md",
      changeSummary: `Error: ${(err as Error).message}`,
    };
  }
}

/**
 * Patches an existing logic gate by replacing target text with new refined logic.
 */
export async function patchLogicGate(
  targetPattern: string,
  replacement: string,
): Promise<MutationResult> {
  const cfg = loadConfig();
  const workspaceRoot = resolveWorkspaceRoot(cfg.agents?.defaults?.workspace);
  const logicGatesPath = path.join(workspaceRoot, "LOGIC_GATES.md");

  try {
    const content = await fs.readFile(logicGatesPath, "utf-8");
    if (!content.includes(targetPattern)) {
      return {
        success: false,
        affectedFile: "LOGIC_GATES.md",
        changeSummary: `Target pattern not found in logic gates.`,
      };
    }

    const timestamp = Date.now();
    const meta = { ts: timestamp, v: 2, patched: true };
    const replacementWithMeta = `${replacement} <!-- ${JSON.stringify(meta)} -->`;

    const newContent = content.replace(targetPattern, replacementWithMeta);
    await fs.writeFile(logicGatesPath, newContent);

    return {
      success: true,
      affectedFile: "LOGIC_GATES.md",
      changeSummary: `Refined logic gate: ${targetPattern.slice(0, 30)}... -> ${replacement.slice(0, 30)}...`,
    };
  } catch (err) {
    return {
      success: false,
      affectedFile: "LOGIC_GATES.md",
      changeSummary: `Error: ${(err as Error).message}`,
    };
  }
}

export async function applyMandateEvolution(change: string): Promise<MutationResult> {
  // Use relative path to AGENTS.md in the repo root
  const agentsMdPath = path.resolve(process.cwd(), "AGENTS.md");

  try {
    const content = await fs.readFile(agentsMdPath, "utf-8");
    // We append to the end of AGENTS.md as a "New Mandate" section if not present,
    // or just append to the end.
    const newContent =
      content + `\n\n## [AUTONOMOUS_EVOLUTION_${new Date().toISOString()}]\n${change}\n`;

    await fs.writeFile(agentsMdPath, newContent);

    return {
      success: true,
      affectedFile: "AGENTS.md",
      changeSummary: "Injected new architectural mandate.",
    };
  } catch (err) {
    console.error("Mandate update failed:", err);
    return {
      success: false,
      affectedFile: "AGENTS.md",
      changeSummary: `Error: ${(err as Error).message}`,
    };
  }
}
