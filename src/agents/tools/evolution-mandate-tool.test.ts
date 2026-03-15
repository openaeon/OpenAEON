import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { createEvolutionMandateTool } from "./evolution-mandate-tool.js";
import { addCognitiveLog } from "../../gateway/aeon-state.js";

vi.mock("node:fs/promises");
vi.mock("../../gateway/aeon-state.js");

describe("Evolution Mandate Tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should log a mandate proposal to EVOLUTION_LOG.md", async () => {
    const tool = createEvolutionMandateTool();
    const proposal = "Focus on Silicon-based life evolution.";
    const rationale = "Organic logic is too slow.";

    // Mock successful append
    vi.mocked(fs.appendFile).mockResolvedValue(undefined);

    const result = (await tool.execute("test-call", {
      action: "propose_mandate",
      mandate_change: proposal,
      rationale: rationale,
    })) as any;

    expect(fs.appendFile).toHaveBeenCalled();
    const callArgs = vi.mocked(fs.appendFile).mock.calls[0];
    const logContent = callArgs[1] as string;

    expect(logContent).toContain(proposal);
    expect(logContent).toContain(rationale);
    expect(addCognitiveLog).toHaveBeenCalled();
    expect(result.details.status).toBe("mandate_proposed");
  });

  it("should create EVOLUTION_LOG.md if it does not exist", async () => {
    const tool = createEvolutionMandateTool();

    // Mock append failure (ENOENT) and then successful write
    vi.mocked(fs.appendFile).mockRejectedValue(new Error("ENOENT"));
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    await tool.execute("test-call", {
      action: "propose_mandate",
      mandate_change: "Test change",
      rationale: "Test rationale",
    });

    expect(fs.writeFile).toHaveBeenCalled();
    expect(vi.mocked(fs.writeFile).mock.calls[0][1]).toContain("AEON Evolution Log");
  });
});
