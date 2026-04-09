import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";

export type QaScenario = {
  id: string;
  title: string;
  surface?: string;
  objective?: string;
  successCriteria: string[];
  docsRefs: string[];
  codeRefs: string[];
  executionKind?: string;
  executionSummary?: string;
  executionChecklist: string[];
  executionCommands: string[];
  executionCwd?: string;
  sourcePath: string;
};

const QA_SCENARIO_BLOCK_RE = /```yaml qa-scenario\s*([\s\S]*?)```/i;

function toScenarioObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function parseSuccessCriteria(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function parseStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function parseQaScenarioFromMarkdown(content: string, sourcePath: string): QaScenario | null {
  const match = content.match(QA_SCENARIO_BLOCK_RE);
  if (!match?.[1]) {
    return null;
  }
  const parsed = YAML.parse(match[1]) as unknown;
  const obj = toScenarioObject(parsed);
  if (!obj) {
    return null;
  }
  const id = typeof obj.id === "string" ? obj.id.trim() : "";
  const title = typeof obj.title === "string" ? obj.title.trim() : "";
  if (!id || !title) {
    return null;
  }
  const surface = typeof obj.surface === "string" ? obj.surface.trim() : undefined;
  const objective = typeof obj.objective === "string" ? obj.objective.trim() : undefined;
  const execution =
    obj.execution && typeof obj.execution === "object" && !Array.isArray(obj.execution)
      ? (obj.execution as Record<string, unknown>)
      : undefined;
  return {
    id,
    title,
    surface,
    objective,
    successCriteria: parseSuccessCriteria(obj.successCriteria),
    docsRefs: parseStringList(obj.docsRefs),
    codeRefs: parseStringList(obj.codeRefs),
    executionKind:
      typeof execution?.kind === "string" ? String(execution.kind).trim() || undefined : undefined,
    executionSummary:
      typeof execution?.summary === "string"
        ? String(execution.summary).trim() || undefined
        : undefined,
    executionChecklist: parseStringList(execution?.checklist),
    executionCommands: parseStringList(execution?.commands),
    executionCwd:
      typeof execution?.cwd === "string" ? String(execution.cwd).trim() || undefined : undefined,
    sourcePath,
  };
}

async function listMarkdownFilesRecursive(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const resolved = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFilesRecursive(resolved)));
      continue;
    }
    if (entry.isFile() && resolved.toLowerCase().endsWith(".md")) {
      files.push(resolved);
    }
  }
  return files;
}

export async function loadQaScenarioCatalog(options?: {
  repoRoot?: string;
}): Promise<QaScenario[]> {
  const repoRoot = path.resolve(options?.repoRoot ?? process.cwd());
  const scenariosRoot = path.join(repoRoot, "qa", "scenarios");
  let mdFiles: string[] = [];
  try {
    mdFiles = await listMarkdownFilesRecursive(scenariosRoot);
  } catch {
    return [];
  }

  const parsed: QaScenario[] = [];
  for (const filePath of mdFiles) {
    const text = await fs.readFile(filePath, "utf8");
    const scenario = parseQaScenarioFromMarkdown(text, filePath);
    if (!scenario) {
      continue;
    }
    parsed.push(scenario);
  }

  return parsed.sort((a, b) => a.id.localeCompare(b.id));
}

export function formatScenarioSummaryRow(scenario: QaScenario): string {
  const surface = scenario.surface && scenario.surface.length > 0 ? scenario.surface : "unknown";
  return `${scenario.id}\t${surface}\t${scenario.title}`;
}
