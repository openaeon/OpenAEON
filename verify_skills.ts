import { buildAgentSystemPrompt } from "./src/agents/system-prompt.js";
import { loadWorkspaceSkillEntries } from "./src/agents/skills/workspace.js";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testSystemPrompt() {
  console.log("--- Testing System Prompt Evolution Instructions ---");
  const prompt = buildAgentSystemPrompt({
    workspaceDir: process.cwd(),
    freedomMode: true,
  });

  if (prompt.includes("## Skill Evolution & Autonomous Mastering")) {
    console.log("✅ Freedom Mode prompt contains Skill Evolution instructions.");
  } else {
    console.log("❌ Freedom Mode prompt MISSING Skill Evolution instructions.");
  }
}

async function testDynamicSkillLoading() {
  console.log("\n--- Testing Dynamic Skill Acquisition (Reload) ---");
  const workspaceDir = process.cwd();
  const skillsDir = path.join(workspaceDir, "skills");
  const testSkillName = "evolution-test-skill";
  const testSkillDir = path.join(skillsDir, testSkillName);
  const testSkillMd = path.join(testSkillDir, "SKILL.md");

  // 1. Check initial state
  const initialEntries = loadWorkspaceSkillEntries(workspaceDir);
  const namesBefore = initialEntries.map((e) => e.skill.name);
  console.log(`Initial skills count: ${namesBefore.length}`);

  // 2. Simulate autonomous installation
  console.log(`Simulating installation of "${testSkillName}"...`);
  await fs.mkdir(testSkillDir, { recursive: true });
  await fs.writeFile(
    testSkillMd,
    `---
name: ${testSkillName}
description: A test skill for verifying autonomous evolution.
---
# Test Skill
Executed during verification.`,
  );

  // 3. Verify dynamic reload
  const updatedEntries = loadWorkspaceSkillEntries(workspaceDir);
  const namesAfter = updatedEntries.map((e) => e.skill.name);

  if (namesAfter.includes(testSkillName)) {
    console.log(`✅ Dynamic reload successful: "${testSkillName}" detected.`);
  } else {
    console.log(`❌ Dynamic reload FAILED: "${testSkillName}" not found in list.`);
    console.log("Skills found:", namesAfter.join(", "));
  }

  // Cleanup
  await fs.rm(testSkillDir, { recursive: true, force: true });
  console.log("Cleanup complete.");
}

async function main() {
  try {
    await testSystemPrompt();
    await testDynamicSkillLoading();
    console.log("\n--- Verification Complete ---");
  } catch (err) {
    console.error("Verification error:", err);
  }
}

main();
