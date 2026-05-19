import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { callGateway } from "../../gateway/call.js";
import { runAgentStep } from "./agent-step.js";
import { distillMemory } from "./memory-distill-tool.js";
import { resolveWorkspaceRoot } from "../workspace-dir.js";
import { loadConfig } from "../../config/config.js";
import { extractAssistantText } from "./sessions-helpers.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("evolution");

export async function autoDistillSessionToMemory(
  sourceSessionKey: string,
  options?: { workspaceDir?: string },
): Promise<void> {
  try {
    // 1. Fetch recent history
    const historyRes = await callGateway<{ messages: Array<unknown> }>({
      method: "chat.history",
      params: { sessionKey: sourceSessionKey, limit: 30 },
    });
    const messages = Array.isArray(historyRes?.messages) ? historyRes.messages : [];
    if (messages.length === 0) return;

    // 2. Format a concise transcript
    const transcriptLines = messages
      .map((m: any) => {
        if (m.role === "user") return `User: ${m.content}`;
        if (m.role === "assistant") return `Assistant: ${extractAssistantText(m) || m.content}`;
        if (m.role === "toolResult" || m.role === "tool")
          return `ToolResult: (omitted for brevity)`;
        return "";
      })
      .filter(Boolean)
      .join("\n");

    if (transcriptLines.length < 50) return;

    const ephemeralSessionKey = `distill_${crypto.randomUUID().substring(0, 8)}`;
    const prompt = `You are a background Memory Distiller for the Cognitive OS.
Review the following transcript of an agent's recent actions.
Extract 1 to 3 critical architectural decisions, discovered bugs, or hard truths.
You MUST output them strictly in the following format, one per line:
[AXIOM] <your technical insight>

Transcript:
${transcriptLines.slice(-4000)}
`;

    // 3. Run background distillation
    const result = await runAgentStep({
      sessionKey: ephemeralSessionKey,
      message: prompt,
      extraSystemPrompt: "You are the Auto-Memory Distiller. Output ONLY [AXIOM] lines.",
      timeoutMs: 30000,
      sourceSessionKey,
      sourceTool: "auto-memory-distiller",
    });

    if (!result) return;

    const axioms = result.split("\n").filter((line) => /\[AXIOM\]/i.test(line));
    if (axioms.length === 0) return;

    // 4. Append to MEMORY.md
    const cfg = loadConfig();
    const workspaceRoot =
      options?.workspaceDir || resolveWorkspaceRoot(cfg.agents?.defaults?.workspace);
    const memoryPath = path.join(workspaceRoot, "MEMORY.md");

    const newEntries = [
      "",
      `## Auto-Distilled from session ${sourceSessionKey} at ${new Date().toISOString()}`,
      ...axioms,
      "",
    ].join("\n");

    try {
      await fs.appendFile(memoryPath, newEntries, "utf-8");
      log.info(`Auto-distilled ${axioms.length} axioms from ${sourceSessionKey} to MEMORY.md`);
    } catch (err) {
      log.error(`Failed to write distilled memory: ${err}`);
      return;
    }

    // 5. Trigger LOGIC_GATES compaction
    await distillMemory({ workspaceDir: workspaceRoot }).catch((err) =>
      log.error(`Failed to trigger distillMemory: ${err}`),
    );
  } catch (err: unknown) {
    log.error(`Auto-distillation crashed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
