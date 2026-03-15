import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../");
const LOG_FILE_PATH = path.join(REPO_ROOT, "docs/aeon/EVOLUTION.md");

/**
 * Logs a significant evolutionary event to docs/aeon/EVOLUTION.md
 */
export async function logEvolutionEvent(
  type: "AUTONOMOUS" | "HUMAN_LED" | "SYSTEM_MAINTENANCE" | "SINGULARITY",
  title: string,
  details: string[],
): Promise<void> {
  const timestamp = new Date().toISOString().replace("T", " ").split(".")[0];
  const entry = `
## ${timestamp} [${type}_EVOLUTION]
**Status**: ${title}
**Details**:
${details.map((d) => `- ${d}`).join("\n")}
`;

  try {
    await fs.appendFile(LOG_FILE_PATH, entry, "utf-8");
  } catch (err) {
    console.error(`Failed to write to evolution log: ${String(err)}`);
  }
}
