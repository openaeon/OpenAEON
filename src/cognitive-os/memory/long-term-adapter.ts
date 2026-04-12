import { getMemorySearchManager } from "../../memory/index.js";
import { loadConfig } from "../../config/config.js";

export type LongTermQueryResult = {
  text: string;
  source: string;
  score: number;
  path: string;
  startLine: number;
  endLine: number;
  citation?: string;
};

export async function queryLongTermKnowledge(params: {
  query: string;
  agentId: string;
  sessionKey?: string;
  maxResults?: number;
}): Promise<LongTermQueryResult[]> {
  const cfg = loadConfig();
  const result = await getMemorySearchManager({ cfg, agentId: params.agentId });
  if (!result.manager) {
    return [];
  }
  const items = await result.manager.search(params.query, {
    maxResults: params.maxResults ?? 6,
    sessionKey: params.sessionKey,
  });
  return items.map((item) => ({
    text: item.snippet,
    source: item.path,
    path: item.path,
    startLine: item.startLine,
    endLine: item.endLine,
    citation: item.citation,
    score: item.score,
  }));
}
