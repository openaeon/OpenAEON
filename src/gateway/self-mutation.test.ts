import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs/promises";
import { patchLogicGate } from "./self-mutation.js";

vi.mock("node:fs/promises");
vi.mock("../agents/workspace-dir.js", () => ({
  resolveWorkspaceRoot: () => "/tmp/workspace",
}));
vi.mock("../config/config.js", () => ({
  loadConfig: () => ({ agents: { defaults: { workspace: "test" } } }),
}));

describe("self-mutation.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should patch an existing logic gate", async () => {
    const mockContent =
      '- [x] Initial logic gate <!-- {"ts":123} -->\n- [x] Target to patch <!-- {"ts":456} -->\n';
    vi.mocked(fs.readFile).mockResolvedValue(mockContent);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    const result = await patchLogicGate("- [x] Target to patch", "- [x] Patched logic gate");

    expect(result.success).toBe(true);
    expect(vi.mocked(fs.writeFile)).toHaveBeenCalledWith(
      expect.stringContaining("LOGIC_GATES.md"),
      expect.stringContaining("- [x] Patched logic gate"),
    );
    expect(vi.mocked(fs.writeFile)).toHaveBeenCalledWith(
      expect.stringContaining("LOGIC_GATES.md"),
      expect.stringContaining('"patched":true'),
    );
  });

  it("should return failure if target pattern is not found", async () => {
    vi.mocked(fs.readFile).mockResolvedValue("- [x] Some other gate\n");

    const result = await patchLogicGate("Non-existent", "Replacement");

    expect(result.success).toBe(false);
    expect(result.changeSummary).toContain("not found");
  });
});
