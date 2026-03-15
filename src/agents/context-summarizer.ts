/**
 * Context Summarizer — equivalent to Deep Agents SummarizationMiddleware
 *
 * Provides sliding-window history truncation to prevent context window overflow
 * during long multi-step agent sessions. Uses a duck-typed AgentMessage interface
 * compatible with @mariozechner/pi-agent-core message shapes.
 */

const MIN_HISTORY_LENGTH_TO_SUMMARIZE = 20;
const MAX_OLD_CHARS_TO_KEEP = 8000;

/** Minimal duck-typed message compatible with pi-agent-core MessageParam shapes */
type AgentMessage = {
  role: string;
  content?: unknown;
};

type ContentPart = {
  text?: string;
  type?: string;
};

/**
 * Estimates the rough character length of a message (as a proxy for token count).
 */
function estimateLength(msg: AgentMessage): number {
  if (typeof msg.content === "string") {
    return msg.content.length;
  }
  if (Array.isArray(msg.content)) {
    return (msg.content as ContentPart[]).reduce((sum: number, part: ContentPart) => {
      if (typeof part.text === "string") {
        return sum + part.text.length;
      }
      return sum + 200; // Estimate for image/tool parts
    }, 0);
  }
  return 200;
}

/**
 * Truncates conversation history to stay within a reasonable context budget.
 *
 * Strategy (mirrors Deep Agents SummarizationMiddleware):
 * - Always keep the last `recentTurnsToKeep` user+assistant message pairs verbatim.
 * - For the older portion, drop oldest messages first until budget satisfied.
 * - Tool result messages are preserved alongside their call.
 */
export function truncateHistory<T extends AgentMessage>(
  messages: T[],
  opts: { recentTurnsToKeep?: number } = {},
): T[] {
  return truncateHistorySync(messages, opts);
}

export function truncateHistorySync<T extends AgentMessage>(
  messages: T[],
  opts: { recentTurnsToKeep?: number } = {},
): T[] {
  const recentTurnsToKeep = opts.recentTurnsToKeep ?? 6;

  if (messages.length < MIN_HISTORY_LENGTH_TO_SUMMARIZE) {
    return messages;
  }

  // Split into "recent" (always kept) vs "older" (may be truncated)
  // Count by user message pairs; keep `recentTurnsToKeep` full pairs
  let pairsFound = 0;
  let recentStartIdx = messages.length;
  for (let i = messages.length - 1; i >= 0; i--) {
    const role = messages[i]?.role;
    if (role === "user") {
      pairsFound += 1;
      if (pairsFound >= recentTurnsToKeep) {
        recentStartIdx = i;
        break;
      }
    }
  }

  const recentMessages = messages.slice(recentStartIdx);
  const olderMessages = messages.slice(0, recentStartIdx);

  // Trim older messages by character budget (keep most recent first)
  let totalLength = 0;
  const trimmedOlder: T[] = [];
  for (let i = olderMessages.length - 1; i >= 0; i--) {
    const msg = olderMessages[i];
    if (!msg) {
      continue;
    }
    const len = estimateLength(msg);
    if (totalLength + len > MAX_OLD_CHARS_TO_KEEP) {
      break;
    }
    trimmedOlder.unshift(msg);
    totalLength += len;
  }

  return [...trimmedOlder, ...recentMessages];
}

export async function summarizeHistoryAsync<T extends AgentMessage>(
  messages: T[],
  opts: {
    recentTurnsToKeep?: number;
    summarizerFn?: (droppedMessages: T[]) => Promise<string | null>;
  } = {},
): Promise<T[]> {
  const recentTurnsToKeep = opts.recentTurnsToKeep ?? 6;

  if (messages.length < MIN_HISTORY_LENGTH_TO_SUMMARIZE) {
    return messages;
  }

  let pairsFound = 0;
  let recentStartIdx = messages.length;
  for (let i = messages.length - 1; i >= 0; i--) {
    const role = messages[i]?.role;
    if (role === "user") {
      pairsFound += 1;
      if (pairsFound >= recentTurnsToKeep) {
        recentStartIdx = i;
        break;
      }
    }
  }

  const recentMessages = messages.slice(recentStartIdx);
  const olderMessages = messages.slice(0, recentStartIdx);

  let totalLength = 0;
  const trimmedOlder: T[] = [];
  let droppedEndIdx = -1;

  for (let i = olderMessages.length - 1; i >= 0; i--) {
    const msg = olderMessages[i];
    if (!msg) {
      continue;
    }

    const len = estimateLength(msg);
    if (totalLength + len > MAX_OLD_CHARS_TO_KEEP) {
      droppedEndIdx = i;
      break;
    }
    trimmedOlder.unshift(msg);
    totalLength += len;
  }

  if (droppedEndIdx >= 0 && opts.summarizerFn) {
    const droppedMessages = olderMessages.slice(0, droppedEndIdx + 1);
    const summary = await opts.summarizerFn(droppedMessages).catch(() => null);

    if (summary) {
      trimmedOlder.unshift({
        role: "system",
        content: `[Previous Context Summary]\n${summary}`,
      } as unknown as T);
    }
  }

  return [...trimmedOlder, ...recentMessages];
}

/**
 * Returns true if history is long enough to warrant truncation.
 */
export function shouldTruncateHistory(messages: AgentMessage[]): boolean {
  return messages.length >= MIN_HISTORY_LENGTH_TO_SUMMARIZE;
}
