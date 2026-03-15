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
});
