import { distillMemory } from "./src/agents/tools/memory-distill-tool.js";
import { getSystemStatus } from "./src/agents/tools/system-status-tool.js";
import fs from "node:fs/promises";
import path from "node:path";

async function testBackend() {
  console.log("--- Testing System Status ---");
  const status = await getSystemStatus();
  console.log("Status:", JSON.stringify(status, null, 2));

  console.log("\n--- Testing Memory Distillation ---");
  const memoryPath = "./MEMORY.md";
  const logicGatesPath = "./LOGIC_GATES.md";

  // Setup test data
  const testMemory =
    "# MEMORY\n\n[AXIOM] The universe is vast.\n[VERIFIED] Logic is key.\nRoutine data that should be ignored.\n";
  await fs.writeFile(memoryPath, testMemory);
  await fs.writeFile(logicGatesPath, "# LOGIC GATES\n");

  const result = await distillMemory();
  console.log("Distillation Result:", JSON.stringify(result, null, 2));

  const gatedContent = await fs.readFile(logicGatesPath, "utf-8");
  console.log("\nLOGIC_GATES.md content:\n", gatedContent);

  const memoryContent = await fs.readFile(memoryPath, "utf-8");
  console.log("\nMEMORY.md after distillation:\n", memoryContent);
}

testBackend().catch(console.error);
