import { TaskOrchestrator } from "../src/cognitive-os/task-os/orchestrator.js";
import { CognitionService } from "../src/cognitive-os/cognition/service.js";
import fs from "node:fs/promises";
import path from "node:path";

async function runTest() {
  const workspaceDir = process.cwd();
  console.log("🚀 Starting FCA Cognitive Stress Test...");
  console.log(`📂 Workspace: ${workspaceDir}`);

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
  await orchestrator.transition({ taskId: task.id, to: "PLAN" });
  const plannedTask = await orchestrator.read(task.id);
  console.log(`📈 Task Tree Height: ${plannedTask?.nodes.length || 0}`);
  plannedTask?.nodes.forEach((n) => {
    console.log(`   - Node: [${n.id}] ${n.title} (Parent: ${n.parentId || "root"})`);
  });

  // 3. Transition to EXECUTE - Trigger Hilbert Context Injection
  console.log("\n3️⃣  Transitioning to EXECUTE (Hilbert Context Injection)...");
  // We'll mock the next ready node to see the context build
  const executedTask = await orchestrator.dispatchNextReadyNode(task.id).catch((e) => {
    console.warn("⚠️  Dispatch triggered (expecting model router logs next)");
    return null;
  });

  // 4. Transition to REFLECT - Trigger Crystallization & Aging
  console.log("\n4️⃣  Transitioning to REFLECT (Axiom Extraction)...");
  // Inject a mock output with an AXIOM signal
  const mockOutput =
    'Analysis complete. [AXIOM] Divergence recovery MUST trigger when epiphanyFactor > 0.85 to prevent structural collapse. <!-- {"id": "ax_drift_01", "weight": 10} -->';

  const cognition = new CognitionService();
  const reflection = cognition.reflect({
    taskId: task.id,
    nodeId: plannedTask?.nodes[0]?.id,
    output: mockOutput,
    success: true,
  });

  // Update task with reflection
  const updatedTask = {
    ...plannedTask,
    reflections: [...(plannedTask?.reflections || []), reflection],
    updatedAt: Date.now(),
  };

  await fs.mkdir(path.join(workspaceDir, ".openaeon", "cognitive", "tasks"), { recursive: true });
  await fs.writeFile(
    path.join(workspaceDir, ".openaeon", "cognitive", "tasks", `${task.id}.json`),
    JSON.stringify(updatedTask, null, 2),
  );

  console.log("✅ Reflection stored with mock [AXIOM]");

  // 5. Trigger Distillation (Aging check)
  console.log("\n5️⃣  Running Memory Distillation (Crystallization)...");
  // This will pick up the AXIOM and update LOGIC_GATES.md
  const { distillMemory } = await import("../src/agents/tools/memory-distill-tool.js");
  await distillMemory();

  console.log("\n🎯  Stress Test Complete.");
  console.log("Check LOGIC_GATES.md and .openaeon/cognitive/tasks/ for results.");
}

runTest().catch(console.error);
