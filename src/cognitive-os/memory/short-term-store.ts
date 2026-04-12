export type ShortTermState = {
  runId: string;
  sessionKey: string;
  taskId: string;
  scratchpad: string[];
  recentToolOutputs: string[];
  branchDecisionTrail: string[];
  updatedAt: number;
};

const SHORT_TERM_CACHE = new Map<string, ShortTermState>();

export function upsertShortTermState(state: ShortTermState): void {
  SHORT_TERM_CACHE.set(state.runId, state);
}

export function appendScratchpad(runId: string, note: string): void {
  const current = SHORT_TERM_CACHE.get(runId);
  if (!current) return;
  const next = {
    ...current,
    scratchpad: [...current.scratchpad, note],
    updatedAt: Date.now(),
  };
  SHORT_TERM_CACHE.set(runId, next);
}

export function getShortTermState(runId: string): ShortTermState | null {
  return SHORT_TERM_CACHE.get(runId) ?? null;
}
