export type AgentInternalEventType = "task_completion" | "task_progress" | "cognitive_signal";

export type AgentTaskCompletionInternalEvent = {
  type: "task_completion";
  source: "subagent" | "cron";
  childSessionKey: string;
  childSessionId?: string;
  announceType: string;
  taskLabel: string;
  status: "ok" | "timeout" | "error" | "unknown";
  statusLabel: string;
  summary?: string;
  result: string;
  statsLine?: string;
  replyInstruction: string;
};

export type AgentCognitiveSignalInternalEvent = {
  type: "cognitive_signal";
  source: "subagent";
  childSessionKey: string;
  signal: "convergence" | "divergence";
  reason?: string;
  depth: number;
};

export type AgentTaskProgressInternalEvent = {
  type: "task_progress";
  source: "subagent";
  childSessionKey: string;
  taskLabel?: string;
  progress: string;
};

export type AgentInternalEvent =
  | AgentTaskCompletionInternalEvent
  | AgentTaskProgressInternalEvent
  | AgentCognitiveSignalInternalEvent;

function formatCognitiveSignalEvent(event: AgentCognitiveSignalInternalEvent): string {
  const emoji = event.signal === "convergence" ? "🎯" : "🌀";
  return [
    `[Cognitive signal: ${event.signal} ${emoji}]`,
    `source: ${event.childSessionKey}`,
    `depth: ${event.depth}`,
    event.reason ? `reason: ${event.reason}` : undefined,
  ]
    .filter((line): line is string => line !== undefined)
    .join("\n");
}

function formatTaskCompletionEvent(event: AgentTaskCompletionInternalEvent): string {
  const maxResultChars = 1000;
  const resultText = event.result || "(no output)";
  const isTruncated = resultText.length > maxResultChars;
  const displayResult = isTruncated
    ? resultText.slice(0, maxResultChars) + "\n... [truncated for brevity]"
    : resultText;

  const lines = [
    "[Internal task completion event]",
    `source: ${event.source}`,
    `session_key: ${event.childSessionKey}`,
    `type: ${event.announceType}`,
    `task: ${event.taskLabel}`,
    `status: ${event.statusLabel}`,
  ];

  if (event.summary) {
    lines.push(`summary: ${event.summary}`);
  }

  lines.push("", "Result (abstracted):", displayResult);

  if (event.statsLine?.trim()) {
    lines.push("", event.statsLine.trim());
  }
  lines.push("", "Action:", event.replyInstruction);
  return lines.join("\n");
}

function formatTaskProgressEvent(event: AgentTaskProgressInternalEvent): string {
  const lines = [
    "[Internal task progress event]",
    `session_key: ${event.childSessionKey}`,
    event.taskLabel ? `task: ${event.taskLabel}` : undefined,
    `progress: ${event.progress}`,
  ].filter((line): line is string => line !== undefined);

  return lines.join("\n");
}

export function formatAgentInternalEventsForPrompt(events?: AgentInternalEvent[]): string {
  if (!events || events.length === 0) {
    return "";
  }
  const blocks = events
    .map((event) => {
      if (event.type === "task_completion") {
        return formatTaskCompletionEvent(event);
      }
      if (event.type === "task_progress") {
        return formatTaskProgressEvent(event);
      }
      if (event.type === "cognitive_signal") {
        return formatCognitiveSignalEvent(event);
      }
      return "";
    })
    .filter((value) => value.trim().length > 0);
  if (blocks.length === 0) {
    return "";
  }
  return [
    "OPENAEON runtime context (internal):",
    "This context is runtime-generated, not user-authored. Keep internal details private.",
    "",
    blocks.join("\n\n---\n\n"),
  ].join("\n");
}
