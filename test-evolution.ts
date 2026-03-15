import { createEvolutionTool } from "./src/agents/tools/evolution-tool.js";

async function testEvolution() {
  console.log("Starting Evolution Tool Test...");
  const tool = createEvolutionTool();

  console.log("\nTesting 'reflect' action...");
  const reflectResult = await tool.execute("test-id", {
    action: "reflect",
    target: "project architecture",
  });
  console.log("Reflect Result:", JSON.stringify(reflectResult, null, 2));

  console.log("\nTesting 'synthesize' action...");
  const synthesizeResult = await tool.execute("test-id", {
    action: "synthesize",
    target: "core duality",
  });
  console.log("Synthesize Result:", JSON.stringify(synthesizeResult, null, 2));
}

testEvolution().catch(console.error);
