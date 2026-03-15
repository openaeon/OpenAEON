import type { GatewayBrowserClient } from "../gateway.ts";
import type { AeonStatusResult, AgentsMemoryGetResult } from "../types.ts";

export type AeonState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  aeonLogicLoading: boolean;
  aeonLogicError: string | null;
  aeonLogicContent: string | null;
  aeonSystemStatus: AeonStatusResult | null;
  aeonActiveTab: "logic" | "memory";
  aeonManualVisible: boolean;
};

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
    const [contentRes, statusRes] = await Promise.all([
      state.client.request<AgentsMemoryGetResult | null>("agents.memory.get", {
        agentId: "main",
        name: "LOGIC_GATES.md",
      }),
      state.client.request<AeonStatusResult | null>("aeon.status", {
        agentId: "main",
      }),
    ]);

    state.aeonLogicContent = contentRes?.file?.content ?? null;
    state.aeonSystemStatus = statusRes;
  } catch (err) {
    state.aeonLogicError = String(err);
  } finally {
    state.aeonLogicLoading = false;
  }
}

export function handleAeonTabChange(state: AeonState, tab: "logic" | "memory") {
  state.aeonActiveTab = tab;
}
