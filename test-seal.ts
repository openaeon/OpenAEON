import fs from "node:fs/promises";
import path from "node:path";
import { distillMemory } from "./src/agents/tools/memory-distill-tool.js";
import { loadConfig } from "./src/config/config.js";

async function testSealFunction() {
  console.log("🚀 Starting AEON Seal (Memory Distillation) Test...");

  const cfg = loadConfig();
  // Resolve workspace root using the Same logic as the tool
  const workspaceRoot = cfg.agents?.defaults?.workspace
    ? path.resolve(
        cfg.agents.defaults.workspace.startsWith("~")
          ? cfg.agents.defaults.workspace.replace("~", process.env.HOME || "")
          : cfg.agents.defaults.workspace,
      )
    : process.cwd();

  console.log(`📍 Using Workspace Root: ${workspaceRoot}`);
  const memoryPath = path.join(workspaceRoot, "MEMORY.md");
  const logicGatesPath = path.join(workspaceRoot, "LOGIC_GATES.md");

  // 1. Prepare Test Data
  console.log("📝 Preparing test axioms in MEMORY.md...");
  const testAxioms = [
    "# MEMORY (Evolutionary Ledger)",
    "",
    "[AXIOM] The recursive cognitive formula is Z ⇌ Z² + C.",
    "[VERIFIED] Premium aesthetics increase user trust indices by 40%.",
    "[AXIOM] Logic Gates are the crystallized form of transient memories.",
    "Unverified data that should NOT be distilled.",
    "",
  ].join("\n");

  await fs.writeFile(memoryPath, testAxioms);

  // Clear logic gates for a clean test
  await fs.writeFile(logicGatesPath, "# LOGIC GATES\n\n");

  // 2. Run Distillation
  console.log("🔮 Invoking Distillation Seal...");
  const result = await distillMemory();
  console.log("📊 Result:", JSON.stringify(result, null, 2));

  // 3. Verify Results
  const gatesContent = await fs.readFile(logicGatesPath, "utf-8");
  const memoryContent = await fs.readFile(memoryPath, "utf-8");

  console.log("\n--- Verification ---");
  if (result.status === "success") {
    console.log("✅ Success Status Confirmed.");
    console.log(`✅ Axioms Extracted: ${result.axiomsExtracted}`);

    if (
      gatesContent.includes("recursive cognitive formula") &&
      gatesContent.includes("Premium aesthetics")
    ) {
      console.log("✅ Axioms successfully migrated to LOGIC_GATES.md");
    } else {
      console.log("❌ Axioms missing from LOGIC_GATES.md");
    }

    if (memoryContent.includes("Reset at") && !memoryContent.includes("[AXIOM]")) {
      console.log("✅ MEMORY.md successfully reset/cleared.");
    } else {
      console.log("❌ MEMORY.md not properly cleared.");
    }
  } else {
    console.log("❌ Distillation failed or returned no-change.");
  }

  console.log("\n🎬 Test Complete.");
}

testSealFunction().catch(console.error);
