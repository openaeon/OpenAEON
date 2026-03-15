import { execSync } from "child_process";

console.log("🚀 Testing OpenAEON Dynamic SubAgent API (DeepAgentsJS Style) 🚀");

const body = {
  message:
    "Provide a quick summary of the current directory contents. You only have access to the 'exec' tool.",
  agentId: "researcher", // Pretend this is a researcher agent
  tools: ["exec"], // DYNAMIC OVERRIDE: We only give it 'exec' regardless of default policy
  skills: [], // DYNAMIC OVERRIDE: No skills loaded
};

console.log("\n📦 Request Payload:");
console.log(JSON.stringify(body, null, 2));

try {
  // Using curl to hit the local OpenAEON gateway
  const curlCmd = `curl -s -X POST http://localhost:11011/api/agent \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(body)}'`;

  console.log("\n⏳ Sending request to local OpenAEON Gateway...");
  const response = execSync(curlCmd, { encoding: "utf-8" });
  console.log("\n✅ Response from OpenAEON:");

  // We can parse just the final text
  const lines = response.split("\\n");
  const finalChunks = lines
    .filter((l) => l.includes('"type":"text"'))
    .map((l) => {
      try {
        return JSON.parse(l).data.text;
      } catch {
        return "";
      }
    });

  console.log(finalChunks.join("").substring(0, 500) + "...\\n");
  console.log("(If text is empty, check the full stream output for tool calls)");
} catch (error) {
  console.error("❌ Failed to call OpenAEON API:", error.message);
}
