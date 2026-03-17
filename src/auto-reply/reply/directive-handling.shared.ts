import { formatCliCommand } from "../../cli/command-format.js";
import { SYSTEM_MARK, prefixSystemMessage } from "../../infra/system-message.js";
import type { ElevatedLevel, ReasoningLevel } from "./directives.js";

export const formatDirectiveAck = (text: string): string => {
  return prefixSystemMessage(text);
};

export const formatOptionsLine = (options: string) => `Options: ${options}.`;
export const withOptions = (line: string, options: string) =>
  `${line}\n${formatOptionsLine(options)}`;

export const formatElevatedRuntimeHint = () =>
  `${SYSTEM_MARK} 运行时为 direct；沙盒不适用。`;

export const formatElevatedEvent = (level: ElevatedLevel) => {
  if (level === "full") {
    return "提升模式 FULL — exec 在主机上自动批准运行。";
  }
  if (level === "ask" || level === "on") {
    return "提升模式 ASK — exec 在主机上运行；可能仍需批准。";
  }
  return "提升模式 OFF — exec 保持在沙盒中。";
};

export const formatReasoningEvent = (level: ReasoningLevel) => {
  if (level === "stream") {
    return "推理模式 STREAM — 实时输出 ⟨thought⟩。";
  }
  if (level === "on") {
    return "推理模式 ON — 包含 ⟨thought⟩。";
  }
  return "推理模式 OFF — 隐藏 ⟨thought⟩。";
};

export function enqueueModeSwitchEvents(params: {
  enqueueSystemEvent: (text: string, meta: { sessionKey: string; contextKey: string }) => void;
  sessionEntry: { elevatedLevel?: string | null; reasoningLevel?: string | null };
  sessionKey: string;
  elevatedChanged?: boolean;
  reasoningChanged?: boolean;
}): void {
  if (params.elevatedChanged) {
    const nextElevated = (params.sessionEntry.elevatedLevel ?? "off") as ElevatedLevel;
    params.enqueueSystemEvent(formatElevatedEvent(nextElevated), {
      sessionKey: params.sessionKey,
      contextKey: "mode:elevated",
    });
  }
  if (params.reasoningChanged) {
    const nextReasoning = (params.sessionEntry.reasoningLevel ?? "off") as ReasoningLevel;
    params.enqueueSystemEvent(formatReasoningEvent(nextReasoning), {
      sessionKey: params.sessionKey,
      contextKey: "mode:reasoning",
    });
  }
}

export function formatElevatedUnavailableText(params: {
  runtimeSandboxed: boolean;
  failures?: Array<{ gate: string; key: string }>;
  sessionKey?: string;
}): string {
  const lines: string[] = [];
  lines.push(
    `提升模式当前不可用 (runtime=${params.runtimeSandboxed ? "sandboxed" : "direct"}).`,
  );
  const failures = params.failures ?? [];
  if (failures.length > 0) {
    lines.push(`失败的门控: ${failures.map((f) => `${f.gate} (${f.key})`).join(", ")}`);
  } else {
    lines.push(
      "修复键: tools.elevated.enabled, tools.elevated.allowFrom.<provider>, agents.list[].tools.elevated.*",
    );
  }
  if (params.sessionKey) {
    lines.push(
      `参见: ${formatCliCommand(`openaeon sandbox explain --session ${params.sessionKey}`)}`,
    );
  }
  return lines.join("\n");
}