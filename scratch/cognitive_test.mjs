import { TaskOrchestrator } from "../dist/cognitive-os/task-os/orchestrator.js";
import { CognitionService } from "../dist/cognitive-os/cognition/service.js";
import fs from "node:fs/promises";
import path from "node:path";

async function runTest() {
  const workspaceDir = process.cwd();
  console.log("🚀 Starting FCA Cognitive Stress Test (MJS/DIST)...");

  const orchestrator = new TaskOrchestrator(workspaceDir);

  // 1. Submit a high-level recursive task
  const sessionKey = "test-session-" + Date.now();
  console.log("\n1️⃣  Submitting Task...");
  const task = await orchestrator.submit({
    sessionKey,
    title: "Self-Healing Protocol Evaluation",
    text: "Evaluate FCA Layer 7 anomaly detection and produce a [AXIOM] regarding divergence recovery thresholds.",
  });
  console.log(`✅ Task Submitted: ${task.id} (Phase: ${task.status.phase})`);

  // 2. Transition to PLAN - Trigger Fractal Decomposition
  console.log("\n2️⃣  Transitioning to PLAN (Fractal Decomposition)...");
  // The submit() already transitions to PLAN in its implementation
  const plannedTask = await orchestrator.read(task.id);
  console.log(`📈 Task Tree Node Count: ${Object.keys(plannedTask?.tree.nodes || {}).length}`);

  // 3. Transition to EXECUTE - Trigger Hilbert Context Injection
  console.log("\n3️⃣  Transitioning to EXECUTE...");
  await orchestrator.transition({ taskId: task.id, to: "EXECUTE" });

  // 4. Mock Reflection & Axiom Extraction
  console.log("\n4️⃣  Mocking Reflection & Axiom Extraction...");
  const mockOutput =
    'Analysis complete. [AXIOM] Divergence recovery MUST trigger when epiphanyFactor > 0.85. <!-- {"id": "ax_drift_01", "weight": 10} -->';

  const cognition = new CognitionService();
  const nodeId = plannedTask.tree.rootId;
  const reflection = cognition.reflect({
    taskId: task.id,
    nodeId,
    output: mockOutput,
    success: true,
  });

  console.log("✅ Reflection generated");

  // 5. Trigger Distillation (Aging check)
  console.log("\n5️⃣  Running Memory Distillation (Crystallization)...");
  // We'll write the reflection to MEMORY.md manually for the distill tool to pick it up in this test
  const memoryPath = path.join(workspaceDir, "MEMORY.md");
  await fs.appendFile(memoryPath, `\n- ${mockOutput}\n`);

  const { distillMemory } = await import("../dist/agents/tools/memory-distill-tool.js");
  await distillMemory();

  console.log("\n🎯  Stress Test Complete.");

  const logicGates = await fs.readFile(path.join(workspaceDir, "LOGIC_GATES.md"), "utf-8");
  console.log("\n📄 Current LOGIC_GATES.md Content:");
  console.log(logicGates);
}

runTest().catch((err) => {
  console.error("❌ Test Failed:", err);
  process.exit(1);
});
