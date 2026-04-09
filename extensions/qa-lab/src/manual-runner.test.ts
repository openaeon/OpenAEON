import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { QaScenario } from "./scenario-catalog.js";
import { runManualScenarioChecks, runScenarioBatch, runScenarioChecks } from "./manual-runner.js";

describe("qa-lab manual runner", () => {
  const cleanup: string[] = [];

  afterEach(async () => {
    while (cleanup.length > 0) {
      const dir = cleanup.pop();
      if (!dir) {
        continue;
      }
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("reports missing and existing docs/code refs", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "openaeon-qa-manual-"));
    cleanup.push(root);
    await fs.mkdir(path.join(root, "docs", "help"), { recursive: true });
    await fs.mkdir(path.join(root, "src", "agents"), { recursive: true });
    await fs.writeFile(path.join(root, "docs", "help", "testing.md"), "# test\n", "utf8");
    await fs.writeFile(
      path.join(root, "src", "agents", "subagent-spawn.ts"),
      "export {};\n",
      "utf8",
    );

    const scenario: QaScenario = {
      id: "s1",
      title: "Scenario 1",
      sourcePath: path.join(root, "qa", "scenarios", "s1.md"),
      successCriteria: [],
      docsRefs: ["docs/help/testing.md", "docs/missing.md"],
      codeRefs: ["src/agents/subagent-spawn.ts", "src/missing.ts"],
      executionKind: "manual",
      executionChecklist: ["one", "two"],
      executionCommands: [],
    };
    const report = runManualScenarioChecks({ scenario, repoRoot: root });

    expect(report.docsChecks).toHaveLength(2);
    expect(report.codeChecks).toHaveLength(2);
    expect(report.docsChecks.find((d) => d.reference === "docs/help/testing.md")?.exists).toBe(
      true,
    );
    expect(report.docsChecks.find((d) => d.reference === "docs/missing.md")?.exists).toBe(false);
    expect(
      report.codeChecks.find((d) => d.reference === "src/agents/subagent-spawn.ts")?.exists,
    ).toBe(true);
    expect(report.codeChecks.find((d) => d.reference === "src/missing.ts")?.exists).toBe(false);
    expect(report.allReferencesExist).toBe(false);
    expect(report.allCommandsSucceeded).toBe(true);
    expect(report.passed).toBe(false);
    expect(report.durationMs).toBeGreaterThanOrEqual(0);
    expect(report.checklist).toEqual([
      { item: "one", status: "pending" },
      { item: "two", status: "pending" },
    ]);
  });

  it("runs scripted command checks and reports pass/fail", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "openaeon-qa-scripted-"));
    cleanup.push(root);
    await fs.mkdir(path.join(root, "docs"), { recursive: true });
    await fs.writeFile(path.join(root, "docs", "ok.md"), "ok\n", "utf8");

    const scenario: QaScenario = {
      id: "scripted",
      title: "Scripted Scenario",
      sourcePath: path.join(root, "qa", "scenarios", "scripted.md"),
      successCriteria: [],
      docsRefs: ["docs/ok.md"],
      codeRefs: [],
      executionKind: "scripted",
      executionSummary: "Run two shell commands",
      executionChecklist: [],
      executionCommands: ["node -e \"console.log('ok')\"", 'node -e "process.exit(3)"'],
      executionCwd: ".",
    };
    const report = await runScenarioChecks({ scenario, repoRoot: root });

    expect(report.commandChecks).toHaveLength(2);
    expect(report.commandChecks[0]?.ok).toBe(true);
    expect(report.commandChecks[0]?.stdout).toContain("ok");
    expect(report.commandChecks[1]?.ok).toBe(false);
    expect(report.commandChecks[1]?.exitCode).toBe(3);
    expect(report.allReferencesExist).toBe(true);
    expect(report.allCommandsSucceeded).toBe(false);
    expect(report.passed).toBe(false);
    expect(report.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("runs batch and computes aggregate summary", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "openaeon-qa-batch-"));
    cleanup.push(root);
    await fs.mkdir(path.join(root, "docs"), { recursive: true });
    await fs.writeFile(path.join(root, "docs", "ok.md"), "ok\n", "utf8");

    const scenarios: QaScenario[] = [
      {
        id: "pass",
        title: "Pass",
        sourcePath: path.join(root, "qa", "scenarios", "pass.md"),
        successCriteria: [],
        docsRefs: ["docs/ok.md"],
        codeRefs: [],
        executionKind: "scripted",
        executionChecklist: [],
        executionCommands: ['node -e "process.exit(0)"'],
      },
      {
        id: "fail",
        title: "Fail",
        sourcePath: path.join(root, "qa", "scenarios", "fail.md"),
        successCriteria: [],
        docsRefs: ["docs/missing.md"],
        codeRefs: [],
        executionKind: "scripted",
        executionChecklist: [],
        executionCommands: ['node -e "process.exit(1)"'],
      },
    ];
    const batch = await runScenarioBatch({ scenarios, repoRoot: root, parallelism: 4 });
    expect(batch.total).toBe(2);
    expect(batch.executed).toBe(2);
    expect(batch.skipped).toBe(0);
    expect(batch.passed).toBe(1);
    expect(batch.failed).toBe(1);
    expect(batch.aborted).toBe(false);
    expect(batch.durationMs).toBeGreaterThanOrEqual(0);
    expect(batch.reports).toHaveLength(2);
    expect(batch.reports[0]?.scenarioId).toBe("pass");
    expect(batch.reports[1]?.scenarioId).toBe("fail");
  });

  it("supports fail-fast in batch mode", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "openaeon-qa-batch-ff-"));
    cleanup.push(root);
    await fs.mkdir(path.join(root, "docs"), { recursive: true });
    await fs.writeFile(path.join(root, "docs", "ok.md"), "ok\n", "utf8");

    const scenarios: QaScenario[] = [
      {
        id: "first-fail",
        title: "First Fail",
        sourcePath: path.join(root, "qa", "scenarios", "first-fail.md"),
        successCriteria: [],
        docsRefs: ["docs/ok.md"],
        codeRefs: [],
        executionKind: "scripted",
        executionChecklist: [],
        executionCommands: ['node -e "process.exit(1)"'],
      },
      {
        id: "would-skip",
        title: "Would Skip",
        sourcePath: path.join(root, "qa", "scenarios", "would-skip.md"),
        successCriteria: [],
        docsRefs: ["docs/ok.md"],
        codeRefs: [],
        executionKind: "scripted",
        executionChecklist: [],
        executionCommands: ['node -e "process.exit(0)"'],
      },
    ];
    const batch = await runScenarioBatch({
      scenarios,
      repoRoot: root,
      parallelism: 1,
      failFast: true,
    });
    expect(batch.total).toBe(2);
    expect(batch.executed).toBe(1);
    expect(batch.skipped).toBe(1);
    expect(batch.passed).toBe(0);
    expect(batch.failed).toBe(1);
    expect(batch.aborted).toBe(true);
    expect(batch.reports).toHaveLength(1);
    expect(batch.reports[0]?.scenarioId).toBe("first-fail");
  });
});
