import { distillMemory } from "./src/agents/tools/memory-distill-tool.js";

async function run() {
  console.log("Triggering Memory Distillation...");
  const result = await distillMemory();
  console.log("Result:", JSON.stringify(result, null, 2));
}

run().catch(console.error);
