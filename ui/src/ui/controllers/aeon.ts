import type { GatewayBrowserClient } from "../gateway.ts";
import type {
  AeonStatusResult,
  AeonThinkingStreamEntry,
  AeonThinkingStreamResult,
  AgentsMemoryGetResult,
} from "../types.ts";

export type AeonState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  sessionKey: string;
  aeonLogicLoading: boolean;
  aeonLogicError: string | null;
  aeonLogicContent: string | null;
  aeonSystemStatus: AeonStatusResult | null;
  aeonThinkingCursor: string | null;
  aeonThinkingEvents: AeonThinkingStreamEntry[];
  aeonEternalMode: boolean;
  aeonEternalModeSource: "url" | "session" | "local" | "default";
  aeonEternalHydratedSessionKey: string | null;
  aeonActiveTab: "logic" | "memory";
  aeonViewMode: "narrative" | "evidence";
  aeonManualVisible: boolean;
};

function mergeThinkingEntries(
  baseline: AeonThinkingStreamEntry[],
  incoming: AeonThinkingStreamEntry[],
): AeonThinkingStreamEntry[] {
  if (incoming.length === 0) {
    return baseline;
  }
  const byId = new Map<string, AeonThinkingStreamEntry>();
  for (const entry of baseline) {
    byId.set(entry.id, entry);
  }
  for (const entry of incoming) {
    byId.set(entry.id, entry);
  }
  return [...byId.values()].sort((a, b) => a.timestamp - b.timestamp).slice(-500);
}

function isThinkingType(value: string): value is AeonThinkingStreamEntry["type"] {
  return (
    value === "reflection" ||
    value === "synthesis" ||
    value === "deliberation" ||
    value === "anomaly" ||
    value === "dreaming" ||
    value === "patch"
  );
}

function toCognitiveLog(
  entries: AeonThinkingStreamEntry[],
): NonNullable<AeonStatusResult["evolution"]>["cognitiveLog"] {
  return entries.map((entry) => ({
    timestamp: entry.timestamp,
    type: isThinkingType(entry.type) ? entry.type : "deliberation",
    content: entry.content,
    metadata: {
      ...entry.metadata,
      eventId: entry.id,
      scopeKey: entry.scopeKey,
    },
  }));
}

export async function loadAeonLogic(state: AeonState) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.aeonLogicLoading) {
    return;
  }
  state.aeonLogicLoading = true;
  state.aeonLogicError = null;
  try {
    const [contentRes, statusRes, thinkingRes] = await Promise.all([
      state.client.request<AgentsMemoryGetResult | null>("agents.memory.get", {
        agentId: "main",
        name: "LOGIC_GATES.md",
      }),
      state.client.request<AeonStatusResult | null>("aeon.status", {
        agentId: "main",
        sessionKey: state.sessionKey,
      }),
      state.client.request<AeonThinkingStreamResult | null>("aeon.thinking.stream", {
        agentId: "main",
        sessionKey: state.sessionKey,
        cursor: state.aeonThinkingCursor ?? undefined,
        limit: 120,
      }),
    ]);

    const incoming = Array.isArray(thinkingRes?.entries) ? thinkingRes.entries : [];
    state.aeonThinkingCursor = thinkingRes?.cursor ?? state.aeonThinkingCursor;
    state.aeonThinkingEvents = mergeThinkingEntries(state.aeonThinkingEvents, incoming);

    state.aeonLogicContent = contentRes?.file?.content ?? null;
    state.aeonSystemStatus = statusRes;
    if (state.aeonSystemStatus?.evolution) {
      const baseEvolution = state.aeonSystemStatus.evolution;
      state.aeonSystemStatus = {
        ...state.aeonSystemStatus,
        evolution: {
          ...baseEvolution,
          cognitiveLog:
            state.aeonThinkingEvents.length > 0
              ? toCognitiveLog(state.aeonThinkingEvents)
              : baseEvolution.cognitiveLog,
        },
      };
    }
    if (
      state.aeonEternalModeSource !== "url" &&
      state.aeonEternalHydratedSessionKey !== state.sessionKey &&
      statusRes?.mode?.eternal
    ) {
      state.aeonEternalMode = statusRes.mode.eternal.enabled;
      state.aeonEternalModeSource = "session";
      state.aeonEternalHydratedSessionKey = state.sessionKey;
    }
  } catch (err) {
    state.aeonLogicError = String(err);
  } finally {
    state.aeonLogicLoading = false;
  }
}

export function handleAeonTabChange(state: AeonState, tab: "logic" | "memory") {
  state.aeonActiveTab = tab;
}

export function handleAeonViewModeChange(state: AeonState, mode: "narrative" | "evidence") {
  state.aeonViewMode = mode;
}
