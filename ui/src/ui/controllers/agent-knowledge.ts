import type { GatewayBrowserClient } from "../gateway.ts";
import type {
  AgentFileEntry,
  AgentsMemoryGetResult,
  AgentsMemoryListResult,
  AgentsMemorySetResult,
  AgentsMemoryStatusResult,
} from "../types.ts";

export type AgentKnowledgeState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  agentKnowledgeLoading: boolean;
  agentKnowledgeError: string | null;
  agentKnowledgeList: AgentsMemoryListResult | null;
  agentKnowledgeStatus: AgentsMemoryStatusResult | null;
  agentKnowledgeFileContents: Record<string, string>;
  agentKnowledgeFileDrafts: Record<string, string>;
  agentKnowledgeFileActive: string | null;
  agentKnowledgeSaving: boolean;
};

function mergeFileEntry(
  list: AgentsMemoryListResult | null,
  entry: AgentFileEntry,
): AgentsMemoryListResult | null {
  if (!list) {
    return list;
  }
  const hasEntry = list.files.some((file) => file.name === entry.name);
  const nextFiles = hasEntry
    ? list.files.map((file) => (file.name === entry.name ? entry : file))
    : [...list.files, entry];
  return { ...list, files: nextFiles };
}

function removeFileEntry(
  list: AgentsMemoryListResult | null,
  name: string,
): AgentsMemoryListResult | null {
  if (!list) {
    return list;
  }
  return { ...list, files: list.files.filter((f) => f.name !== name) };
}

export async function loadAgentKnowledge(state: AgentKnowledgeState, agentId: string) {
  if (!state.client || !state.connected || state.agentKnowledgeLoading) {
    return;
  }
  state.agentKnowledgeLoading = true;
  state.agentKnowledgeError = null;
  try {
    const res = await state.client.request<AgentsMemoryListResult | null>("agents.memory.list", {
      agentId,
    });
    if (res) {
      state.agentKnowledgeList = res;
      if (
        state.agentKnowledgeFileActive &&
        !res.files.some((file) => file.name === state.agentKnowledgeFileActive)
      ) {
        state.agentKnowledgeFileActive = null;
      }
    }
  } catch (err) {
    state.agentKnowledgeError = String(err);
  } finally {
    state.agentKnowledgeLoading = false;
  }
}

export async function loadAgentKnowledgeStatus(state: AgentKnowledgeState, agentId: string) {
  if (!state.client || !state.connected || state.agentKnowledgeLoading) {
    return;
  }
  // We can fetch status alongside list or separately without blocking the list
  try {
    const res = await state.client.request<AgentsMemoryStatusResult | null>(
      "agents.memory.status",
      {
        agentId,
      },
    );
    if (res) {
      state.agentKnowledgeStatus = res;
    }
  } catch (err) {
    // Ignore error for status specifically so it doesn't break the UI
    console.error("Failed to load memory status", err);
  }
}

export async function loadAgentKnowledgeFileContent(
  state: AgentKnowledgeState,
  agentId: string,
  name: string,
  opts?: { force?: boolean; preserveDraft?: boolean },
) {
  if (!state.client || !state.connected || state.agentKnowledgeLoading) {
    return;
  }
  if (!opts?.force && Object.hasOwn(state.agentKnowledgeFileContents, name)) {
    return;
  }
  state.agentKnowledgeLoading = true;
  state.agentKnowledgeError = null;
  try {
    const res = await state.client.request<AgentsMemoryGetResult | null>("agents.memory.get", {
      agentId,
      name,
    });
    if (res?.file) {
      const content = res.file.content ?? "";
      const previousBase = state.agentKnowledgeFileContents[name] ?? "";
      const currentDraft = state.agentKnowledgeFileDrafts[name];
      const preserveDraft = opts?.preserveDraft ?? true;
      state.agentKnowledgeList = mergeFileEntry(state.agentKnowledgeList, res.file);
      state.agentKnowledgeFileContents = { ...state.agentKnowledgeFileContents, [name]: content };
      if (
        !preserveDraft ||
        !Object.hasOwn(state.agentKnowledgeFileDrafts, name) ||
        currentDraft === previousBase
      ) {
        state.agentKnowledgeFileDrafts = { ...state.agentKnowledgeFileDrafts, [name]: content };
      }
    }
  } catch (err) {
    state.agentKnowledgeError = String(err);
  } finally {
    state.agentKnowledgeLoading = false;
  }
}

export async function saveAgentKnowledgeFile(
  state: AgentKnowledgeState,
  agentId: string,
  name: string,
  content: string,
) {
  if (!state.client || !state.connected || state.agentKnowledgeSaving) {
    return;
  }
  state.agentKnowledgeSaving = true;
  state.agentKnowledgeError = null;
  try {
    const res = await state.client.request<AgentsMemorySetResult | null>("agents.memory.set", {
      agentId,
      name,
      content,
    });
    if (res?.file) {
      state.agentKnowledgeList = mergeFileEntry(state.agentKnowledgeList, res.file);
      state.agentKnowledgeFileContents = { ...state.agentKnowledgeFileContents, [name]: content };
      state.agentKnowledgeFileDrafts = { ...state.agentKnowledgeFileDrafts, [name]: content };
    }
  } catch (err) {
    state.agentKnowledgeError = String(err);
  } finally {
    state.agentKnowledgeSaving = false;
  }
}

export async function deleteAgentKnowledgeFile(
  state: AgentKnowledgeState,
  agentId: string,
  name: string,
) {
  if (!state.client || !state.connected || state.agentKnowledgeSaving) {
    return;
  }
  state.agentKnowledgeSaving = true;
  state.agentKnowledgeError = null;
  try {
    await state.client.request("agents.memory.delete", {
      agentId,
      name,
    });
    state.agentKnowledgeList = removeFileEntry(state.agentKnowledgeList, name);
    if (state.agentKnowledgeFileActive === name) {
      state.agentKnowledgeFileActive = null;
    }
  } catch (err) {
    state.agentKnowledgeError = String(err);
  } finally {
    state.agentKnowledgeSaving = false;
  }
}
