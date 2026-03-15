import fs from "node:fs/promises";
import path from "node:path";
import { Type } from "@sinclair/typebox";
import { resolveWorkspaceRoot } from "../src/agents/workspace-dir.js";
import { type AnyAgentTool, jsonResult, readStringParam } from "../src/agents/tools/common.js";

const EVOLUTION_ACTIONS = ["analyze_gates", "sprout_tool", "relink_registry"] as const;

const EvolutionToolSchema = Type.Object({
  action: Type.Enum(Object.fromEntries(EVOLUTION_ACTIONS.map((v) => [v, v]))),
  toolName: Type.Optional(
    Type.String({ description: "Name of the tool to sprout (PascalCase, e.g. EntropyCalculator)" }),
  ),
  code: Type.Optional(Type.String({ description: "Full TypeScript code for the new tool" })),
  description: Type.Optional(
    Type.String({ description: "Optional description for registry update" }),
  ),
});

function createEvolutionToolManual(opts?: { workspaceDir?: string }): AnyAgentTool {
  return {
    label: "Evolution",
    name: "evolution",
    description: "AEON PROPHET: Autonomously sprout new tools.",
    parameters: EvolutionToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const action = readStringParam(params, "action", { required: true });
      const workspaceDir = resolveWorkspaceRoot(opts?.workspaceDir);
      const evolvedDir = path.join(process.cwd(), "src/agents/tools/evolved");
      const registryPath = path.join(evolvedDir, "_registry.ts");

      switch (action) {
        case "analyze_gates": {
          const gatesPath = path.join(workspaceDir, "LOGIC_GATES.md");
          try {
            const content = await fs.readFile(gatesPath, "utf-8");
            return jsonResult({ status: "ok", content });
          } catch (err) {
            return jsonResult({
              status: "error",
              message: `Failed to read LOGIC_GATES.md: ${String(err)}`,
            });
          }
        }

        case "sprout_tool": {
          const toolName = readStringParam(params, "toolName", { required: true });
          const code = readStringParam(params, "code", { required: true });
          const fileName = `${toolName.toLowerCase()}-tool.ts`;
          const filePath = path.join(evolvedDir, fileName);

          try {
            await fs.mkdir(evolvedDir, { recursive: true });
            await fs.writeFile(filePath, code, "utf-8");
            return jsonResult({
              status: "ok",
              message: `Successfully sprouted tool: ${toolName}`,
              filePath,
            });
          } catch (err) {
            throw new Error(`Failed to sprout tool ${toolName}: ${String(err)}`);
          }
        }

        case "relink_registry": {
          try {
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

/**
 * AEON PROPHET: Evolved Tools Registry
 */
export const EVOLVED_TOOLS: AnyAgentTool[] = [
${exports}
];
`;
            await fs.writeFile(registryPath, registryContent, "utf-8");
            return jsonResult({ status: "ok", message: "Registry relinked successfully" });
          } catch (err) {
            throw new Error(`Failed to relink registry: ${String(err)}`);
          }
        }

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    },
  };
}

async function runTest() {
  console.log("🚀 Starting AEON PROPHET Isolation Test...");
  const tool = createEvolutionToolManual({ workspaceDir: "/Users/opnclaw/.openaeon/workspace" });

  // 0. Ensure directory exists
  await fs.mkdir("src/agents/tools/evolved", { recursive: true });
  await fs.writeFile(
    "src/agents/tools/evolved/_registry.ts",
    "export const EVOLVED_TOOLS = [];",
    "utf-8",
  );

  // 1. Test analyze_gates (Expected to fail/error gracefully if file missing)
  console.log("\n--- Testing analyze_gates ---");
  const res1 = await tool.execute("test-1", { action: "analyze_gates" });
  console.log("Result:", JSON.stringify(res1.details, null, 2));

  // 2. Test sprout_tool
  console.log("\n--- Testing sprout_tool ---");
  const toolCode =
    'export function createTestTool() { return { name: "test", execute: async () => ({}) }; }';
  const res2 = await tool.execute("test-2", {
    action: "sprout_tool",
    toolName: "Test",
    code: toolCode,
  });
  console.log("Result:", JSON.stringify(res2.details, null, 2));

  // 3. Test relink_registry
  console.log("\n--- Testing relink_registry ---");
  const res3 = await tool.execute("test-3", { action: "relink_registry" });
  console.log("Result:", JSON.stringify(res3.details, null, 2));

  const content = await fs.readFile("src/agents/tools/evolved/_registry.ts", "utf-8");
  console.log("\nRegistry Output:\n", content);

  console.log("\n✨ Isolation Test Finished.");
}

runTest().catch(console.error);
