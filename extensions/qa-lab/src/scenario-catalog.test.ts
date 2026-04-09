import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadQaScenarioCatalog } from "./scenario-catalog.js";

describe("qa-lab scenario catalog", () => {
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

  it("loads qa-scenario yaml blocks from qa/scenarios", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "openaeon-qa-lab-"));
    cleanup.push(root);
    const scenariosDir = path.join(root, "qa", "scenarios");
    await fs.mkdir(scenariosDir, { recursive: true });
    await fs.writeFile(
      path.join(scenariosDir, "sample.md"),
      [
        "# Sample",
        "",
        "```yaml qa-scenario",
        "id: sample-id",
        "title: Sample Title",
        "surface: subagents",
        "objective: Validate scenario parser.",
        "successCriteria:",
        "  - one",
        "  - two",
        "```",
      ].join("\n"),
      "utf8",
    );

    const scenarios = await loadQaScenarioCatalog({ repoRoot: root });
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0]).toMatchObject({
      id: "sample-id",
      title: "Sample Title",
      surface: "subagents",
      objective: "Validate scenario parser.",
      successCriteria: ["one", "two"],
      docsRefs: [],
      codeRefs: [],
      executionKind: undefined,
      executionSummary: undefined,
      executionChecklist: [],
      executionCommands: [],
      executionCwd: undefined,
    });
  });

  it("captures docs/code refs and execution metadata", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "openaeon-qa-lab-rich-"));
    cleanup.push(root);
    const scenariosDir = path.join(root, "qa", "scenarios");
    await fs.mkdir(scenariosDir, { recursive: true });
    await fs.writeFile(
      path.join(scenariosDir, "rich.md"),
      [
        "```yaml qa-scenario",
        "id: rich-id",
        "title: Rich",
        "docsRefs:",
        "  - docs/help/testing.md",
        "codeRefs:",
        "  - src/agents/subagent-spawn.ts",
        "execution:",
        "  kind: flow",
        "  summary: Run preflight and validate result",
        "  checklist:",
        "    - step one",
        "    - step two",
        "  commands:",
        '    - node -e "process.exit(0)"',
        "  cwd: qa",
        "```",
      ].join("\n"),
      "utf8",
    );
    const scenarios = await loadQaScenarioCatalog({ repoRoot: root });
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0]).toMatchObject({
      id: "rich-id",
      docsRefs: ["docs/help/testing.md"],
      codeRefs: ["src/agents/subagent-spawn.ts"],
      executionKind: "flow",
      executionSummary: "Run preflight and validate result",
      executionChecklist: ["step one", "step two"],
      executionCommands: ['node -e "process.exit(0)"'],
      executionCwd: "qa",
    });
  });

  it("returns empty list when qa/scenarios is missing", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "openaeon-qa-lab-empty-"));
    cleanup.push(root);
    const scenarios = await loadQaScenarioCatalog({ repoRoot: root });
    expect(scenarios).toEqual([]);
  });
});
