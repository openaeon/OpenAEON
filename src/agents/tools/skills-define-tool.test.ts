import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createSkillsDefineTool } from "./skills-define-tool.js";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

describe("skills_define tool", () => {
  let tempDir: string;
  let tool: ReturnType<typeof createSkillsDefineTool>;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `openaeon-test-${crypto.randomUUID()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Mock process.cwd() since we don't have a sessionKey in options
    vi.spyOn(process, "cwd").mockReturnValue(tempDir);

    tool = createSkillsDefineTool();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("should create a new skill directory and SKILL.md file", async () => {
    const result = (await tool.execute!("test-call-id", {
      name: "test-skill-1",
      description: "A test skill.",
      instructions: "Do some test things.",
    })) as any;

    expect(result.details.status).toBe("success");
    expect(result.details.skillPath).toContain("test-skill-1");

    // Verify the file was created with the correct content
    const skillPath = path.join(tempDir, ".agents", "skills", "test-skill-1", "SKILL.md");
    const fileContent = await fs.readFile(skillPath, "utf-8");

    expect(fileContent).toContain("name: test-skill-1");
    expect(fileContent).toContain("description: A test skill.");
    expect(fileContent).toContain("Do some test things.");
  });

  it("should sanitize the skill name for the directory", async () => {
    const result = (await tool.execute!("test-call-id", {
      name: "Complex Name!@#",
      description: "Testing sanitization.",
      instructions: "Should be safe.",
    })) as any;

    expect(result.details.status).toBe("success");

    // The safe name should be "complexname"
    expect(result.details.skillPath).toContain("complexname");

    const skillPath = path.join(tempDir, ".agents", "skills", "complexname", "SKILL.md");
    const fileExists = await fs
      .access(skillPath)
      .then(() => true)
      .catch(() => false);
    expect(fileExists).toBe(true);
  });
});
