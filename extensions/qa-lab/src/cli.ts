import fs from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import { formatScenarioSummaryRow, loadQaScenarioCatalog } from "./scenario-catalog.js";
import type { QaScenario } from "./scenario-catalog.js";
import { runScenarioBatch, runScenarioChecks, type QaManualRunReport } from "./manual-runner.js";

function printScenarioListHeader() {
  // eslint-disable-next-line no-console
  console.log("id\tsurface\ttitle");
}

function shortenPathToRepoRoot(filePath: string): string {
  const repoRoot = process.cwd();
  return path.relative(repoRoot, filePath) || filePath;
}

function matchScenarioPattern(scenario: QaScenario, pattern?: string): boolean {
  const query = pattern?.trim();
  if (!query) {
    return true;
  }
  const haystack = [scenario.id, scenario.title, scenario.surface ?? ""].join(" ").toLowerCase();
  return haystack.includes(query.toLowerCase());
}

async function writeReportIfRequested(reportPath: string | undefined, payload: unknown) {
  const target = reportPath?.trim();
  if (!target) {
    return;
  }
  const absolute = path.resolve(process.cwd(), target);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function printScenarioRunReport(report: QaManualRunReport) {
  const lines: string[] = [
    `scenario: ${report.scenarioId}`,
    `title: ${report.scenarioTitle}`,
    `execution: ${report.executionKind ?? "unknown"}`,
    `source: ${shortenPathToRepoRoot(report.sourcePath)}`,
    `references: ${report.allReferencesExist ? "ok" : "missing"}`,
    `commands: ${report.allCommandsSucceeded ? "ok" : "failed"}`,
    `result: ${report.passed ? "pass" : "fail"}`,
    `durationMs: ${report.durationMs}`,
  ];
  if (report.executionSummary) {
    lines.push(`summary: ${report.executionSummary}`);
  }
  if (report.checklist.length > 0) {
    lines.push("checklist:");
    for (const item of report.checklist) {
      lines.push(`- [${item.status}] ${item.item}`);
    }
  }
  if (report.docsChecks.length > 0) {
    lines.push("docsRefs:");
    for (const item of report.docsChecks) {
      lines.push(`- [${item.exists ? "ok" : "miss"}] ${item.reference}`);
    }
  }
  if (report.codeChecks.length > 0) {
    lines.push("codeRefs:");
    for (const item of report.codeChecks) {
      lines.push(`- [${item.exists ? "ok" : "miss"}] ${item.reference}`);
    }
  }
  if (report.commandChecks.length > 0) {
    lines.push("commandsRun:");
    for (const item of report.commandChecks) {
      lines.push(`- [${item.ok ? "ok" : "fail"}] (${item.exitCode ?? "null"}) ${item.command}`);
      if (item.stdout.trim()) {
        lines.push(`  stdout: ${item.stdout.trim()}`);
      }
      if (item.stderr.trim()) {
        lines.push(`  stderr: ${item.stderr.trim()}`);
      }
    }
  }
  // eslint-disable-next-line no-console
  console.log(lines.join("\n"));
}

export function registerQaLabCli(params: { program: Command }) {
  const qa = params.program.command("qa").description("QA scenario catalog and utilities");
  const scenarios = qa.command("scenarios").description("Read QA scenario definitions from qa/");

  scenarios
    .command("list")
    .description("List known QA scenarios")
    .option("--json", "Return JSON output")
    .action(async (opts: { json?: boolean }) => {
      const catalog = await loadQaScenarioCatalog();
      if (opts.json) {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(catalog, null, 2));
        return;
      }
      printScenarioListHeader();
      for (const scenario of catalog) {
        // eslint-disable-next-line no-console
        console.log(formatScenarioSummaryRow(scenario));
      }
      // eslint-disable-next-line no-console
      console.log(`\n${catalog.length} scenario(s)`);
    });

  scenarios
    .command("show")
    .description("Show a single QA scenario")
    .argument("<id>", "Scenario id")
    .option("--json", "Return JSON output")
    .action(async (id: string, opts: { json?: boolean }) => {
      const catalog = await loadQaScenarioCatalog();
      const match = catalog.find((scenario) => scenario.id === id.trim());
      if (!match) {
        throw new Error(`Unknown QA scenario id: ${id}`);
      }
      if (opts.json) {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(match, null, 2));
        return;
      }
      const lines = [
        `id: ${match.id}`,
        `title: ${match.title}`,
        `surface: ${match.surface ?? "unknown"}`,
        `objective: ${match.objective ?? ""}`,
        `source: ${shortenPathToRepoRoot(match.sourcePath)}`,
      ];
      if (match.successCriteria.length > 0) {
        lines.push("successCriteria:");
        for (const criterion of match.successCriteria) {
          lines.push(`- ${criterion}`);
        }
      }
      // eslint-disable-next-line no-console
      console.log(lines.join("\n"));
    });

  scenarios
    .command("run")
    .description("Run QA scenario checks (refs + optional scripted commands)")
    .argument("[id]", "Scenario id")
    .option("--all", "Run all scenarios")
    .option("--jobs <n>", "Parallel workers for --all (default 2)", (value) => Number(value))
    .option("--only <pattern>", "Filter scenarios by id/title/surface (only with --all)")
    .option("--fail-fast", "Stop scheduling new scenarios after first failure (only with --all)")
    .option("--report <path>", "Write JSON report to a file")
    .option("--json", "Return JSON report")
    .option("--strict", "Fail when any docs/code reference or command check fails")
    .action(
      async (
        id: string | undefined,
        opts: {
          json?: boolean;
          strict?: boolean;
          all?: boolean;
          jobs?: number;
          only?: string;
          failFast?: boolean;
          report?: string;
        },
      ) => {
        const catalog = await loadQaScenarioCatalog();
        if (opts.all) {
          const selected = catalog.filter((scenario) => matchScenarioPattern(scenario, opts.only));
          if (selected.length === 0) {
            throw new Error("No scenarios matched --only filter");
          }
          const batch = await runScenarioBatch({
            scenarios: selected,
            parallelism: opts.jobs,
            failFast: opts.failFast,
          });
          await writeReportIfRequested(opts.report, batch);
          if (opts.json) {
            // eslint-disable-next-line no-console
            console.log(JSON.stringify(batch, null, 2));
          } else {
            // eslint-disable-next-line no-console
            console.log(
              [
                `scenarios: ${batch.total}`,
                `executed: ${batch.executed}`,
                `skipped: ${batch.skipped}`,
                `passed: ${batch.passed}`,
                `failed: ${batch.failed}`,
                `aborted: ${batch.aborted ? "yes" : "no"}`,
                `durationMs: ${batch.durationMs}`,
              ].join("\n"),
            );
            for (const report of batch.reports) {
              // eslint-disable-next-line no-console
              console.log("");
              printScenarioRunReport(report);
            }
          }
          if (opts.strict && batch.failed > 0) {
            throw new Error(`QA batch failed: ${batch.failed}/${batch.total} scenario(s) failed`);
          }
          return;
        }

        const scenarioId = id?.trim();
        if (!scenarioId) {
          throw new Error("Scenario id is required unless --all is provided");
        }
        const match = catalog.find((scenario) => scenario.id === scenarioId);
        if (!match) {
          throw new Error(`Unknown QA scenario id: ${scenarioId}`);
        }

        const report = await runScenarioChecks({ scenario: match });
        await writeReportIfRequested(opts.report, report);
        if (opts.json) {
          // eslint-disable-next-line no-console
          console.log(JSON.stringify(report, null, 2));
        } else {
          printScenarioRunReport(report);
        }

        if (opts.strict && !report.passed) {
          throw new Error(`Scenario ${report.scenarioId} check failed`);
        }
      },
    );
}
