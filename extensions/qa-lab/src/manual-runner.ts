import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { QaScenario } from "./scenario-catalog.js";

export type QaReferenceCheck = {
  reference: string;
  exists: boolean;
  absolutePath: string;
};

export type QaCommandCheck = {
  command: string;
  cwd: string;
  exitCode: number | null;
  ok: boolean;
  stdout: string;
  stderr: string;
};

export type QaManualRunReport = {
  scenarioId: string;
  scenarioTitle: string;
  executionKind?: string;
  executionSummary?: string;
  sourcePath: string;
  docsChecks: QaReferenceCheck[];
  codeChecks: QaReferenceCheck[];
  checklist: {
    item: string;
    status: "pending";
  }[];
  commandChecks: QaCommandCheck[];
  allReferencesExist: boolean;
  allCommandsSucceeded: boolean;
  passed: boolean;
  durationMs: number;
};

export type QaBatchRunReport = {
  total: number;
  executed: number;
  skipped: number;
  passed: number;
  failed: number;
  aborted: boolean;
  durationMs: number;
  reports: QaManualRunReport[];
};

function toAbsoluteRefPath(repoRoot: string, ref: string): string {
  const clean = ref.trim().replace(/^\/+/, "");
  return path.resolve(repoRoot, clean);
}

function buildChecks(repoRoot: string, refs: string[]): QaReferenceCheck[] {
  return refs.map((reference) => {
    const absolutePath = toAbsoluteRefPath(repoRoot, reference);
    return {
      reference,
      absolutePath,
      exists: fs.existsSync(absolutePath),
    };
  });
}

function truncateOutput(raw: string, maxChars = 12_000): string {
  if (raw.length <= maxChars) {
    return raw;
  }
  return `${raw.slice(0, maxChars)}\n[truncated]`;
}

async function runShellCommand(params: { command: string; cwd: string }): Promise<QaCommandCheck> {
  const child = spawn(params.command, {
    shell: true,
    cwd: params.cwd,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout?.on("data", (chunk: Buffer | string) => {
    stdout += chunk.toString();
  });
  child.stderr?.on("data", (chunk: Buffer | string) => {
    stderr += chunk.toString();
  });
  const exitCode = await new Promise<number | null>((resolve) => {
    child.on("exit", (code) => resolve(code));
    child.on("error", () => resolve(-1));
  });
  return {
    command: params.command,
    cwd: params.cwd,
    exitCode,
    ok: typeof exitCode === "number" && exitCode === 0,
    stdout: truncateOutput(stdout),
    stderr: truncateOutput(stderr),
  };
}

export function runManualScenarioChecks(params: {
  scenario: QaScenario;
  repoRoot?: string;
}): QaManualRunReport {
  const startMs = Date.now();
  const repoRoot = path.resolve(params.repoRoot ?? process.cwd());
  const docsChecks = buildChecks(repoRoot, params.scenario.docsRefs);
  const codeChecks = buildChecks(repoRoot, params.scenario.codeRefs);
  const allReferencesExist = [...docsChecks, ...codeChecks].every((entry) => entry.exists);
  return {
    scenarioId: params.scenario.id,
    scenarioTitle: params.scenario.title,
    executionKind: params.scenario.executionKind,
    executionSummary: params.scenario.executionSummary,
    sourcePath: params.scenario.sourcePath,
    docsChecks,
    codeChecks,
    checklist: params.scenario.executionChecklist.map((item) => ({ item, status: "pending" })),
    commandChecks: [],
    allReferencesExist,
    allCommandsSucceeded: true,
    passed: allReferencesExist,
    durationMs: Date.now() - startMs,
  };
}

export async function runScenarioChecks(params: {
  scenario: QaScenario;
  repoRoot?: string;
}): Promise<QaManualRunReport> {
  const startMs = Date.now();
  const repoRoot = path.resolve(params.repoRoot ?? process.cwd());
  const initial = runManualScenarioChecks({ scenario: params.scenario, repoRoot });
  if (params.scenario.executionCommands.length === 0) {
    return { ...initial, durationMs: Date.now() - startMs };
  }

  const commandBaseCwd = params.scenario.executionCwd
    ? path.resolve(repoRoot, params.scenario.executionCwd)
    : repoRoot;
  const commandChecks: QaCommandCheck[] = [];
  for (const command of params.scenario.executionCommands) {
    commandChecks.push(await runShellCommand({ command, cwd: commandBaseCwd }));
  }
  const allCommandsSucceeded = commandChecks.every((entry) => entry.ok);
  return {
    ...initial,
    commandChecks,
    allCommandsSucceeded,
    passed: initial.allReferencesExist && allCommandsSucceeded,
    durationMs: Date.now() - startMs,
  };
}

function normalizeParallelism(value?: number): number {
  if (!Number.isFinite(value)) {
    return 2;
  }
  const normalized = Math.floor(value as number);
  if (normalized < 1) {
    return 1;
  }
  if (normalized > 16) {
    return 16;
  }
  return normalized;
}

export async function runScenarioBatch(params: {
  scenarios: QaScenario[];
  repoRoot?: string;
  parallelism?: number;
  failFast?: boolean;
}): Promise<QaBatchRunReport> {
  const startMs = Date.now();
  const repoRoot = path.resolve(params.repoRoot ?? process.cwd());
  const parallelism = normalizeParallelism(params.parallelism);
  const failFast = params.failFast === true;
  const reports: Array<{ index: number; report: QaManualRunReport }> = [];
  let cursor = 0;
  let aborted = false;

  const worker = async () => {
    while (true) {
      if (failFast && aborted) {
        return;
      }
      const next = cursor;
      cursor += 1;
      if (next >= params.scenarios.length) {
        return;
      }
      const scenario = params.scenarios[next];
      const report = await runScenarioChecks({ scenario, repoRoot });
      reports.push({ index: next, report });
      if (failFast && !report.passed) {
        aborted = true;
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(parallelism, params.scenarios.length) }, worker));
  reports.sort((a, b) => a.index - b.index);
  const orderedReports = reports.map((entry) => entry.report);
  const total = params.scenarios.length;
  const executed = orderedReports.length;
  const skipped = Math.max(0, total - executed);
  const passed = orderedReports.filter((report) => report.passed).length;
  return {
    total,
    executed,
    skipped,
    passed,
    failed: executed - passed,
    aborted: failFast && aborted,
    durationMs: Date.now() - startMs,
    reports: orderedReports,
  };
}
