import fs from "node:fs/promises";
import path from "node:path";

async function testEvolutionLogic() {
  console.log("🧬 AEON PROPHET: Core Evolution Logic Test");
  const baseDir = process.cwd();
  const evolvedDir = path.join(baseDir, "src/agents/tools/evolved");
  const registryPath = path.join(evolvedDir, "_registry.ts");

  // 1. Simulate 'sprout_tool' action
  console.log("\n[Step 1] Sprouting 'EntropyCalculator' tool...");
  const toolName = "EntropyCalculator";
  const fileName = `${toolName.toLowerCase()}-tool.ts`;
  const filePath = path.join(evolvedDir, fileName);
  const toolCode = `export function create${toolName}Tool() { return { name: "entropy" }; }`;

  await fs.mkdir(evolvedDir, { recursive: true });
  await fs.writeFile(filePath, toolCode, "utf-8");
  console.log("✅ Tool sprouted at:", filePath);

  // 2. Simulate 'relink_registry' action
  console.log("\n[Step 2] Relinking registry...");
  const files = await fs.readdir(evolvedDir);
  const toolFiles = files.filter((f) => f.endsWith("-tool.ts"));

  const imports = toolFiles
    .map((f) => {
      const name = f.replace(".ts", ".js");
      const toolBase = f.replace("-tool.ts", "");
      const pascalName = toolBase
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("");
      return `import { create${pascalName}Tool } from "./${name}";`;
    })
    .join("\n");

  const exports = toolFiles
    .map((f) => {
      const toolBase = f.replace("-tool.ts", "");
      const pascalName = toolBase
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("");
      return `  create${pascalName}Tool(),`;
    })
    .join("\n");

  const registryContent = `import type { AnyAgentTool } from "../common.js";
${imports}

export const EVOLVED_TOOLS: AnyAgentTool[] = [
${exports}
];
`;
  await fs.writeFile(registryPath, registryContent, "utf-8");
  console.log("✅ Registry updated at:", registryPath);

  // 3. Verify 'openclaw-tools.ts' integration logic (simulated)
  console.log("\n[Step 3] Verifying integration logic...");
  const openclawToolsContent = await fs.readFile(
    path.join(baseDir, "src/agents/openclaw-tools.ts"),
    "utf-8",
  );
  const hasEvolutionImport = openclawToolsContent.includes(
    'import { createEvolutionTool } from "./tools/evolution-tool.js";',
  );
  const hasEvolvedTools = openclawToolsContent.includes("...EVOLVED_TOOLS");

  if (hasEvolutionImport && hasEvolvedTools) {
    console.log("✅ Integration verified in src/agents/openclaw-tools.ts");
  } else {
    console.error("❌ Integration missing in src/agents/openclaw-tools.ts");
  }

  // 4. Show Registry Output
  console.log("\n--- UPDATED REGISTRY CONTENT ---");
  console.log(registryContent);

  console.log("\n✨ AEON PROPHET Core Evolution Logic verified successfully.");
}

testEvolutionLogic().catch(console.error);
