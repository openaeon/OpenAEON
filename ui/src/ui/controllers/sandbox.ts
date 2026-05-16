import type { GatewayBrowserClient } from "../gateway.ts";
import type { CognitiveTaskRecord } from "../types.ts";
import type { CognitivePlanSnapshot } from "../views/sandbox/types.ts";

export type SandboxState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  sessionKey: string;
  sandboxCognitivePlan: CognitivePlanSnapshot | null;
  sandboxCognitivePlanLoading: boolean;
  sandboxCognitivePlanError: string | null;
  /** When true, suppress automatic cognitive-plan re-fetches (set after /new reset). */
  sandboxCognitivePlanSuppressed?: boolean;
};

type CognitiveTaskListResponse = {
  ok: boolean;
  tasks: CognitiveTaskRecord[];
};

type CognitiveTaskReadResponse = {
  ok: boolean;
  task: CognitiveTaskRecord | null;
  cognitivePlan?: CognitivePlanSnapshot | null;
  runtime?: {
    summary?: import("../types.ts").CognitiveRuntimeSummary | null;
  };
};

/**
 * Loads the native cognitive-plan snapshot from the Cognitive runtime.
 */
export async function loadSandboxCognitivePlan(state: SandboxState): Promise<void> {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.sandboxCognitivePlanLoading) {
    return;
  }
  // After /new reset, suppress automatic re-fetches until a fresh session produces new data
  if (state.sandboxCognitivePlanSuppressed) {
    return;
  }
  state.sandboxCognitivePlanLoading = true;
  state.sandboxCognitivePlanError = null;
  try {
    const listRes = await state.client.request<CognitiveTaskListResponse>("cognitive.task.list", {
      limit: 50,
    });
    const tasks = Array.isArray(listRes?.tasks) ? listRes.tasks : [];
    const selected = tasks
      .filter((task) => task.sessionKey === state.sessionKey)
      .toSorted((a, b) => b.updatedAt - a.updatedAt)[0];
    if (!selected?.id) {
      state.sandboxCognitivePlan = null;
      return;
    }
    const readRes = await state.client.request<CognitiveTaskReadResponse>("cognitive.task.read", {
      taskId: selected.id,
    });
    state.sandboxCognitivePlan = readRes?.cognitivePlan ?? null;
  } catch (err) {
    state.sandboxCognitivePlanError = String(err);
    state.sandboxCognitivePlan = null;
  } finally {
    state.sandboxCognitivePlanLoading = false;
  }
}
