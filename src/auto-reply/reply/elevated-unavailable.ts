import { formatCliCommand } from "../../cli/command-format.js";

export function formatElevatedUnavailableMessage(params: {
  runtimeSandboxed: boolean;
  failures: Array<{ gate: string; key: string }>;
  sessionKey?: string;
}): string {
  const lines: string[] = [];
  lines.push(
    `提升模式当前不可用 (runtime=${params.runtimeSandboxed ? "sandboxed" : "direct"}).`,
  );
  if (params.failures.length > 0) {
    lines.push(`失败的门控: ${params.failures.map((f) => `${f.gate} (${f.key})`).join(", ")}`);
  } else {
    lines.push(
      "失败的门控: enabled (tools.elevated.enabled / agents.list[].tools.elevated.enabled), allowFrom (tools.elevated.allowFrom.<provider>).",
    );
  }
  lines.push("修复键:");
  lines.push("- tools.elevated.enabled");
  lines.push("- tools.elevated.allowFrom.<provider>");
  lines.push("- agents.list[].tools.elevated.enabled");
  lines.push("- agents.list[].tools.elevated.allowFrom.<provider>");
  if (params.sessionKey) {
    lines.push(
      `参见: ${formatCliCommand(`openaeon sandbox explain --session ${params.sessionKey}`)}`,
    );
  }
  return lines.join("\n");
}