import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { createLogicRefinementTool } from "./logic-refinement.js";
import { loadConfig } from "../../config/config.js";
import { resolveWorkspaceRoot } from "../workspace-dir.js";

vi.mock("../../config/config.js");
vi.mock("../workspace-dir.js");
vi.mock("node:fs/promises");

describe("Logic Refinement Tool", () => {
  const mockWorkspace = "/mock/workspace";
  const logicGatesPath = path.join(mockWorkspace, "LOGIC_GATES.md");

  beforeEach(() => {
    vi.mocked(loadConfig).mockReturnValue({ agents: { defaults: { workspace: "mock" } } } as any);
    vi.mocked(resolveWorkspaceRoot).mockReturnValue(mockWorkspace);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should filter axioms by Peano range", async () => {
    const mockContent = [
      'Axiom 1 <!-- {"ts": 1000, "id": "a1", "peano": {"x": 0.1, "y": 0.5, "z": 0.5}} -->',
      'Axiom 2 <!-- {"ts": 2000, "id": "a2", "peano": {"x": 0.5, "y": 0.5, "z": 0.5}} -->',
      'Axiom 3 <!-- {"ts": 3000, "id": "a3", "peano": {"x": 0.9, "y": 0.5, "z": 0.5}} -->',
    ].join("\n");

    vi.mocked(fs.readFile).mockResolvedValue(mockContent);

    const tool = createLogicRefinementTool();
    const result = (await tool.execute("test-call", {
      action: "audit",
      peanoRange: [0.0, 0.4],
    })) as any;

    expect(result.data.findings.totalAxioms).toBe(1);
    expect(result.data.findings.redundancies).toHaveLength(0);
    expect(result.text).toContain("Audit complete");
  });

  it("should perform full audit when no range is provided", async () => {
    const mockContent = [
      'Axiom 1 <!-- {"ts": 1000, "id": "a1", "peano": {"x": 0.1, "y": 0.5, "z": 0.5}} -->',
      'Axiom 2 <!-- {"ts": 2000, "id": "a2", "peano": {"x": 0.5, "y": 0.5, "z": 0.5}} -->',
    ].join("\n");

    vi.mocked(fs.readFile).mockResolvedValue(mockContent);

    const tool = createLogicRefinementTool();
    const result = (await tool.execute("test-call", { action: "audit" })) as any;

    expect(result.data.findings.totalAxioms).toBe(2);
  });

  it("should crystallize a logic gate", async () => {
    const mockContent = 'Axiom 1 <!-- {"ts": 1000, "id": "a1"} -->\n';
    vi.mocked(fs.readFile).mockResolvedValue(mockContent);

    const tool = createLogicRefinementTool();
    const result = (await tool.execute("test-call", {
      action: "crystallize",
      target: "Axiom 1",
    })) as any;

    expect(result.status).toBe("ok");
    expect(result.text).toContain("Crystallized logic gate");
    expect(vi.mocked(fs.writeFile)).toHaveBeenCalledWith(
      logicGatesPath,
      expect.stringContaining('"crystallized":true'),
    );
  });

  it("should not prune crystallized axioms even if stale", async () => {
    const now = Date.now();
    const mockContent =
      [
        `Axiom 1 <!-- {"ts": ${now - 40 * 86400000}, "id": "a1", "crystallized": true} -->`,
        `Axiom 2 <!-- {"ts": ${now - 40 * 86400000}, "id": "a2"} -->`,
      ].join("\n") + "\n";

    vi.mocked(fs.readFile).mockResolvedValue(mockContent);

    const tool = createLogicRefinementTool();
    const result = (await tool.execute("test-call", { action: "prune" })) as any;

    expect(result.data.prunedCount).toBe(1); // Only Axiom 2 should be pruned
    expect(vi.mocked(fs.writeFile)).toHaveBeenCalledWith(
      logicGatesPath,
      expect.stringContaining("Axiom 1"),
    );
    expect(vi.mocked(fs.writeFile)).not.toEqual(expect.stringContaining("Axiom 2"));
  });

  it("should not prune axioms with high heat even if stale", async () => {
    const now = Date.now();
    const mockContent =
      [
        `Axiom 1 <!-- {"ts": ${now - 40 * 86400000}, "id": "a1", "heat": 15} -->`,
        `Axiom 2 <!-- {"ts": ${now - 40 * 86400000}, "id": "a2", "heat": 5} -->`,
      ].join("\n") + "\n";

    vi.mocked(fs.readFile).mockResolvedValue(mockContent);

    const tool = createLogicRefinementTool();
    const result = (await tool.execute("test-call", { action: "prune" })) as any;

    expect(result.data.prunedCount).toBe(1); // Only Axiom 2 should be pruned
  });
});
