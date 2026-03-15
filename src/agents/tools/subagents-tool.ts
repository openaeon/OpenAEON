import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Type } from "@sinclair/typebox";
import { clearSessionQueues } from "../../auto-reply/reply/queue.js";
import {
  resolveSubagentLabel,
  resolveSubagentTargetFromRuns,
  sortSubagentRuns,
  type SubagentTargetResolution,
} from "../../auto-reply/reply/subagents-utils.js";
import { DEFAULT_SUBAGENT_MAX_SPAWN_DEPTH } from "../../config/agent-limits.js";
import { loadConfig } from "../../config/config.js";
import type { SessionEntry } from "../../config/sessions.js";
import { loadSessionStore, resolveStorePath, updateSessionStore } from "../../config/sessions.js";
import { callGateway } from "../../gateway/call.js";
import { logVerbose } from "../../globals.js";
import {
  isSubagentSessionKey,
  parseAgentSessionKey,
  type ParsedAgentSessionKey,
} from "../../routing/session-key.js";
import {
  formatDurationCompact,
  formatTokenUsageDisplay,
  resolveTotalTokens,
  truncateLine,
} from "../../shared/subagents-format.js";
import { INTERNAL_MESSAGE_CHANNEL } from "../../utils/message-channel.js";
import { AGENT_LANE_SUBAGENT } from "../lanes.js";
import { abortEmbeddedPiRun } from "../pi-embedded.js";
import { optionalStringEnum } from "../schema/typebox.js";
import { getSubagentDepthFromSessionStore } from "../subagent-depth.js";
import { resolveWorkspaceRoot } from "../workspace-dir.js";
import {
  clearSubagentRunSteerRestart,
  listSubagentRunsForRequester,
  markSubagentRunTerminated,
  markSubagentRunForSteerRestart,
  replaceSubagentRunAfterSteer,
  type SubagentRunRecord,
} from "../subagent-registry.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readNumberParam, readStringParam } from "./common.js";
import { resolveInternalSessionKey, resolveMainSessionAlias } from "./sessions-helpers.js";
import { readLatestSubagentOutput } from "../subagent-announce.js";
import { distillMemory } from "./memory-distill-tool.js";
import { getSystemStatus } from "./system-status-tool.js";

const SUBAGENT_ACTIONS = ["list", "kill", "steer", "distill", "status", "audit"] as const;
type SubagentAction = (typeof SUBAGENT_ACTIONS)[number];

const DEFAULT_RECENT_MINUTES = 30;
const MAX_RECENT_MINUTES = 24 * 60;
const MAX_STEER_MESSAGE_CHARS = 4_000;
const STEER_RATE_LIMIT_MS = 2_000;
const STEER_ABORT_SETTLE_TIMEOUT_MS = 5_000;

const steerRateLimit = new Map<string, number>();

const SubagentsToolSchema = Type.Object({
  action: optionalStringEnum(SUBAGENT_ACTIONS),
  target: Type.Optional(Type.String()),
  message: Type.Optional(Type.String()),
  recentMinutes: Type.Optional(Type.Number({ minimum: 1 })),
});

type SessionEntryResolution = {
  storePath: string;
  entry: SessionEntry | undefined;
};

type ResolvedRequesterKey = {
  requesterSessionKey: string;
  callerSessionKey: string;
  callerIsSubagent: boolean;
};

function resolveRunStatus(entry: SubagentRunRecord) {
  if (!entry.endedAt) {
    return "running";
  }
  const status = entry.outcome?.status ?? "done";
  if (status === "ok") {
    return "done";
  }
  if (status === "error") {
    return "failed";
  }
  return status;
}

function resolveModelRef(entry?: SessionEntry) {
  const model = typeof entry?.model === "string" ? entry.model.trim() : "";
  const provider = typeof entry?.modelProvider === "string" ? entry.modelProvider.trim() : "";
  if (model.includes("/")) {
    return model;
  }
  if (model && provider) {
    return `${provider}/${model}`;
  }
  if (model) {
    return model;
  }
  if (provider) {
    return provider;
  }
  const overrideModel = typeof entry?.modelOverride === "string" ? entry.modelOverride.trim() : "";
  const overrideProvider =
    typeof entry?.providerOverride === "string" ? entry.providerOverride.trim() : "";
  if (overrideModel.includes("/")) {
    return overrideModel;
  }
  if (overrideModel && overrideProvider) {
    return `${overrideProvider}/${overrideModel}`;
  }
  if (overrideModel) {
    return overrideModel;
  }
  return overrideProvider || undefined;
}

function resolveModelDisplay(entry?: SessionEntry, fallbackModel?: string) {
  const modelRef = resolveModelRef(entry) || fallbackModel || undefined;
  if (!modelRef) {
    return "model n/a";
  }
  const slash = modelRef.lastIndexOf("/");
  if (slash >= 0 && slash < modelRef.length - 1) {
    return modelRef.slice(slash + 1);
  }
  return modelRef;
}

function resolveSubagentTarget(
  runs: SubagentRunRecord[],
  token: string | undefined,
  options?: { recentMinutes?: number },
): SubagentTargetResolution {
  return resolveSubagentTargetFromRuns({
    runs,
    token,
    recentWindowMinutes: options?.recentMinutes ?? DEFAULT_RECENT_MINUTES,
    label: (entry) => resolveSubagentLabel(entry),
    errors: {
      missingTarget: "Missing subagent target.",
      invalidIndex: (value) => `Invalid subagent index: ${value}`,
      unknownSession: (value) => `Unknown subagent session: ${value}`,
      ambiguousLabel: (value) => `Ambiguous subagent label: ${value}`,
      ambiguousLabelPrefix: (value) => `Ambiguous subagent label prefix: ${value}`,
      ambiguousRunIdPrefix: (value) => `Ambiguous subagent run id prefix: ${value}`,
      unknownTarget: (value) => `Unknown subagent target: ${value}`,
    },
  });
}

function resolveStorePathForKey(
  cfg: ReturnType<typeof loadConfig>,
  key: string,
  parsed?: ParsedAgentSessionKey | null,
) {
  return resolveStorePath(cfg.session?.store, {
    agentId: parsed?.agentId,
  });
}

function resolveSessionEntryForKey(params: {
  cfg: ReturnType<typeof loadConfig>;
  key: string;
  cache: Map<string, Record<string, SessionEntry>>;
}): SessionEntryResolution {
  const parsed = parseAgentSessionKey(params.key);
  const storePath = resolveStorePathForKey(params.cfg, params.key, parsed);
  let store = params.cache.get(storePath);
  if (!store) {
    store = loadSessionStore(storePath);
    params.cache.set(storePath, store);
  }
  return {
    storePath,
    entry: store[params.key],
  };
}

function resolveRequesterKey(params: {
  cfg: ReturnType<typeof loadConfig>;
  agentSessionKey?: string;
}): ResolvedRequesterKey {
  const { mainKey, alias } = resolveMainSessionAlias(params.cfg);
  const callerRaw = params.agentSessionKey?.trim() || alias;
  const callerSessionKey = resolveInternalSessionKey({
    key: callerRaw,
    alias,
    mainKey,
  });
  if (!isSubagentSessionKey(callerSessionKey)) {
    return {
      requesterSessionKey: callerSessionKey,
      callerSessionKey,
      callerIsSubagent: false,
    };
  }
  const callerDepth = getSubagentDepthFromSessionStore(callerSessionKey, { cfg: params.cfg });
  const maxSpawnDepth =
    params.cfg.agents?.defaults?.subagents?.maxSpawnDepth ?? DEFAULT_SUBAGENT_MAX_SPAWN_DEPTH;
  if (callerDepth < maxSpawnDepth) {
    return {
      requesterSessionKey: callerSessionKey,
      callerSessionKey,
      callerIsSubagent: true,
    };
  }
  const cache = new Map<string, Record<string, SessionEntry>>();
  const callerEntry = resolveSessionEntryForKey({
    cfg: params.cfg,
    key: callerSessionKey,
    cache,
  }).entry;
  const spawnedBy = typeof callerEntry?.spawnedBy === "string" ? callerEntry.spawnedBy.trim() : "";
  return {
    requesterSessionKey: spawnedBy || callerSessionKey,
    callerSessionKey,
    callerIsSubagent: true,
  };
}

async function killSubagentRun(params: {
  cfg: ReturnType<typeof loadConfig>;
  entry: SubagentRunRecord;
  cache: Map<string, Record<string, SessionEntry>>;
}): Promise<{ killed: boolean; sessionId?: string }> {
  if (params.entry.endedAt) {
    return { killed: false };
  }
  const childSessionKey = params.entry.childSessionKey;
  const resolved = resolveSessionEntryForKey({
    cfg: params.cfg,
    key: childSessionKey,
    cache: params.cache,
  });
  const sessionId = resolved.entry?.sessionId;
  const aborted = sessionId ? abortEmbeddedPiRun(sessionId) : false;
  const cleared = clearSessionQueues([childSessionKey, sessionId]);
  if (cleared.followupCleared > 0 || cleared.laneCleared > 0) {
    logVerbose(
      `subagents tool kill: cleared followups=${cleared.followupCleared} lane=${cleared.laneCleared} keys=${cleared.keys.join(",")}`,
    );
  }
  if (resolved.entry) {
    await updateSessionStore(resolved.storePath, (store) => {
      const current = store[childSessionKey];
      if (!current) {
        return;
      }
      current.abortedLastRun = true;
      current.updatedAt = Date.now();
      store[childSessionKey] = current;
    });
  }
  const marked = markSubagentRunTerminated({
    runId: params.entry.runId,
    childSessionKey,
    reason: "killed",
  });
  const killed = marked > 0 || aborted || cleared.followupCleared > 0 || cleared.laneCleared > 0;
  return { killed, sessionId };
}

async function cascadeKillChildren(params: {
  cfg: ReturnType<typeof loadConfig>;
  parentChildSessionKey: string;
  cache: Map<string, Record<string, SessionEntry>>;
  seenChildSessionKeys?: Set<string>;
}): Promise<{ killed: number; labels: string[] }> {
  const childRuns = listSubagentRunsForRequester(params.parentChildSessionKey);
  const seenChildSessionKeys = params.seenChildSessionKeys ?? new Set<string>();
  let killed = 0;
  const labels: string[] = [];
  for (const run of childRuns) {
    const childKey = run.childSessionKey?.trim();
    if (!childKey || seenChildSessionKeys.has(childKey)) continue;
    seenChildSessionKeys.add(childKey);
    if (!run.endedAt) {
      const stopResult = await killSubagentRun({
        cfg: params.cfg,
        entry: run,
        cache: params.cache,
      });
      if (stopResult.killed) {
        killed += 1;
        labels.push(resolveSubagentLabel(run));
      }
    }
    const cascade = await cascadeKillChildren({
      cfg: params.cfg,
      parentChildSessionKey: childKey,
      cache: params.cache,
      seenChildSessionKeys,
    });
    killed += cascade.killed;
    labels.push(...cascade.labels);
  }
  return { killed, labels };
}

function buildListText(params: {
  active: Array<{ line: string }>;
  recent: Array<{ line: string }>;
  recentMinutes: number;
}) {
  const lines: string[] = [];
  lines.push("active subagents:");
  if (params.active.length === 0) {
    lines.push("(none)");
  } else {
    lines.push(...params.active.map((entry) => entry.line));
  }
  lines.push("");
  lines.push(`recent (last ${params.recentMinutes}m):`);
  if (params.recent.length === 0) {
    lines.push("(none)");
  } else {
    lines.push(...params.recent.map((entry) => entry.line));
  }
  return lines.join("\n");
}

export function createSubagentsTool(opts?: { agentSessionKey?: string }): AnyAgentTool {
  return {
    label: "Subagents",
    name: "subagents",
    description:
      "List, kill, or steer spawned sub-agents for this requester session. Use this for sub-agent orchestration.",
    parameters: SubagentsToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const action = (readStringParam(params, "action") ?? "list") as SubagentAction;
      const cfg = loadConfig();
      const requester = resolveRequesterKey({ cfg, agentSessionKey: opts?.agentSessionKey });
      const runs = sortSubagentRuns(listSubagentRunsForRequester(requester.requesterSessionKey));
      const recentMinutesRaw = readNumberParam(params, "recentMinutes");
      const recentMinutes = recentMinutesRaw
        ? Math.max(1, Math.min(MAX_RECENT_MINUTES, Math.floor(recentMinutesRaw)))
        : DEFAULT_RECENT_MINUTES;
      const now = Date.now();
      const recentCutoff = now - recentMinutes * 60_000;
      const cache = new Map<string, Record<string, SessionEntry>>();

      const buildListEntry = async (entry: SubagentRunRecord, runtimeMs: number, idx: number) => {
        const sessionEntry = resolveSessionEntryForKey({
          cfg,
          key: entry.childSessionKey,
          cache,
        }).entry;
        const totalTokens = resolveTotalTokens(sessionEntry);
        const usageText = formatTokenUsageDisplay(sessionEntry);
        const status = resolveRunStatus(entry);
        const runtime = formatDurationCompact(runtimeMs);
        const label = truncateLine(resolveSubagentLabel(entry), 48);
        const task = truncateLine(entry.task.trim(), 72);
        let progressText = "";
        if (status === "running") {
          try {
            const latestOutput = await readLatestSubagentOutput(entry.childSessionKey);
            if (latestOutput) {
              const progressMatch = latestOutput.match(
                /<execution_progress>([\s\S]*?)<\/execution_progress>/i,
              );
              if (progressMatch && progressMatch[1].trim()) {
                progressText = truncateLine(progressMatch[1].trim().replace(/\s+/g, " "), 60);
              } else {
                const toolMatch = latestOutput.match(/<tool_name>(.*?)(<\/tool_name>| )/i);
                if (toolMatch && toolMatch[1].trim())
                  progressText = `Using tool: ${truncateLine(toolMatch[1].trim(), 40)}`;
              }
            }
          } catch {
            /* Ignore */
          }
        }
        const expandedStatus =
          status === "running" && progressText ? `running [Progress: ${progressText}]` : status;
        const line = `${idx}. ${label} (${resolveModelDisplay(sessionEntry, entry.model)}, ${runtime}${usageText ? `, ${usageText}` : ""}) ${expandedStatus}${task.toLowerCase() !== label.toLowerCase() ? ` - ${task}` : ""}`;
        return {
          line,
          view: {
            index: idx,
            runId: entry.runId,
            sessionKey: entry.childSessionKey,
            label,
            task,
            status,
            progress: progressText || undefined,
            runtime,
            runtimeMs,
            model: resolveModelRef(sessionEntry) || entry.model,
            totalTokens,
            startedAt: entry.startedAt,
            endedAt: entry.endedAt,
          },
        };
      };

      const activeRunsFiltered = runs.filter((entry) => !entry.endedAt);
      const activeEntries = await Promise.all(
        activeRunsFiltered.map((entry, i) =>
          buildListEntry(entry, now - (entry.startedAt ?? entry.createdAt), i + 1),
        ),
      );

      if (action === "list") {
        const recentEntries = await Promise.all(
          runs
            .filter((entry) => !!entry.endedAt && (entry.endedAt ?? 0) >= recentCutoff)
            .map((entry, i) =>
              buildListEntry(
                entry,
                (entry.endedAt ?? now) - (entry.startedAt ?? entry.createdAt),
                activeEntries.length + i + 1,
              ),
            ),
        );
        const listText = buildListText({
          active: activeEntries.map((e) => ({ line: e.line })),
          recent: recentEntries.map((e) => ({ line: e.line })),
          recentMinutes,
        });
        const aeonHint = [
          "",
          "---",
          "AEON LOOP (Proactive Self-Iteration):",
          "- If a subagent is providing progress updates, you can use `action=steer` to refine its goals in real-time.",
          "- If a subagent has reached a Divergence (🌀), evaluate if a recursive iteration (Z ⇌ Z² + C) is needed.",
          "- Use `cron(action=add)` to schedule periodic monitoring sessions for long-running workflows.",
        ].join("\n");
        return jsonResult({
          status: "ok",
          action: "list",
          requesterSessionKey: requester.requesterSessionKey,
          callerSessionKey: requester.callerSessionKey,
          callerIsSubagent: requester.callerIsSubagent,
          total: runs.length,
          active: activeEntries.map((entry) => entry.view),
          recent: recentEntries.map((entry) => entry.view),
          text: listText + aeonHint,
        });
      }

      if (action === "kill") {
        const target = readStringParam(params, "target", { required: true });
        if (target === "all" || target === "*") {
          const killCache = new Map<string, Record<string, SessionEntry>>();
          const seenChildSessionKeys = new Set<string>();
          const killedLabels: string[] = [];
          let killed = 0;
          for (const entry of runs) {
            const childKey = entry.childSessionKey?.trim();
            if (!childKey || seenChildSessionKeys.has(childKey)) continue;
            seenChildSessionKeys.add(childKey);
            if (!entry.endedAt) {
              const stopResult = await killSubagentRun({ cfg, entry, cache: killCache });
              if (stopResult.killed) {
                killed += 1;
                killedLabels.push(resolveSubagentLabel(entry));
              }
            }
            const cascade = await cascadeKillChildren({
              cfg,
              parentChildSessionKey: childKey,
              cache: killCache,
              seenChildSessionKeys,
            });
            killed += cascade.killed;
            killedLabels.push(...cascade.labels);
          }
          return jsonResult({
            status: "ok",
            action: "kill",
            target: "all",
            killed,
            labels: killedLabels,
            text:
              killed > 0
                ? `killed ${killed} subagent${killed === 1 ? "" : "s"}.`
                : "no running subagents to kill.",
          });
        }
        const resolved = resolveSubagentTarget(runs, target, { recentMinutes });
        if (!resolved.entry)
          return jsonResult({
            status: "error",
            action: "kill",
            target,
            error: resolved.error ?? "Unknown subagent target.",
          });
        const killCache = new Map<string, Record<string, SessionEntry>>();
        const stopResult = await killSubagentRun({ cfg, entry: resolved.entry, cache: killCache });
        const seenChildSessionKeys = new Set<string>();
        const targetChildKey = resolved.entry.childSessionKey?.trim();
        if (targetChildKey) seenChildSessionKeys.add(targetChildKey);
        const cascade = await cascadeKillChildren({
          cfg,
          parentChildSessionKey: resolved.entry.childSessionKey,
          cache: killCache,
          seenChildSessionKeys,
        });
        if (!stopResult.killed && cascade.killed === 0)
          return jsonResult({
            status: "done",
            action: "kill",
            target,
            runId: resolved.entry.runId,
            sessionKey: resolved.entry.childSessionKey,
            text: `${resolveSubagentLabel(resolved.entry)} is already finished.`,
          });
        const cascadeText =
          cascade.killed > 0
            ? ` (+ ${cascade.killed} descendant${cascade.killed === 1 ? "" : "s"})`
            : "";
        return jsonResult({
          status: "ok",
          action: "kill",
          target,
          runId: resolved.entry.runId,
          sessionKey: resolved.entry.childSessionKey,
          label: resolveSubagentLabel(resolved.entry),
          cascadeKilled: cascade.killed,
          cascadeLabels: cascade.killed > 0 ? cascade.labels : undefined,
          text: stopResult.killed
            ? `killed ${resolveSubagentLabel(resolved.entry)}${cascadeText}.`
            : `killed ${cascade.killed} descendant${cascade.killed === 1 ? "" : "s"} of ${resolveSubagentLabel(resolved.entry)}.`,
        });
      }

      if (action === "steer") {
        const target = readStringParam(params, "target", { required: true });
        const message = readStringParam(params, "message", { required: true });
        if (message.length > MAX_STEER_MESSAGE_CHARS)
          return jsonResult({
            status: "error",
            action: "steer",
            target,
            error: `Message too long (${message.length} chars, max ${MAX_STEER_MESSAGE_CHARS}).`,
          });
        const resolved = resolveSubagentTarget(runs, target, { recentMinutes });
        if (!resolved.entry)
          return jsonResult({
            status: "error",
            action: "steer",
            target,
            error: resolved.error ?? "Unknown subagent target.",
          });
        if (resolved.entry.endedAt)
          return jsonResult({
            status: "done",
            action: "steer",
            target,
            runId: resolved.entry.runId,
            sessionKey: resolved.entry.childSessionKey,
            text: `${resolveSubagentLabel(resolved.entry)} is already finished.`,
          });
        if (
          requester.callerIsSubagent &&
          requester.callerSessionKey === resolved.entry.childSessionKey
        )
          return jsonResult({
            status: "forbidden",
            action: "steer",
            target,
            runId: resolved.entry.runId,
            sessionKey: resolved.entry.childSessionKey,
            error: "Subagents cannot steer themselves.",
          });
        const rateKey = `${requester.callerSessionKey}:${resolved.entry.childSessionKey}`;
        const lastSentAt = steerRateLimit.get(rateKey) ?? 0;
        if (now - lastSentAt < STEER_RATE_LIMIT_MS)
          return jsonResult({
            status: "rate_limited",
            action: "steer",
            target,
            runId: resolved.entry.runId,
            sessionKey: resolved.entry.childSessionKey,
            error: "Steer rate limit exceeded. Wait a moment before sending another steer.",
          });
        steerRateLimit.set(rateKey, now);
        markSubagentRunForSteerRestart(resolved.entry.runId);
        const targetSession = resolveSessionEntryForKey({
          cfg,
          key: resolved.entry.childSessionKey,
          cache: new Map<string, Record<string, SessionEntry>>(),
        });
        const sessionId =
          typeof targetSession.entry?.sessionId === "string" && targetSession.entry.sessionId.trim()
            ? targetSession.entry.sessionId.trim()
            : undefined;
        if (sessionId) abortEmbeddedPiRun(sessionId);
        const cleared = clearSessionQueues([resolved.entry.childSessionKey, sessionId]);
        try {
          await callGateway({
            method: "agent.wait",
            params: { runId: resolved.entry.runId, timeoutMs: STEER_ABORT_SETTLE_TIMEOUT_MS },
            timeoutMs: STEER_ABORT_SETTLE_TIMEOUT_MS + 2_000,
          });
        } catch {
          /* Ignore */
        }
        const idempotencyKey = crypto.randomUUID();
        let runId: string = idempotencyKey;
        try {
          const response = await callGateway<{ runId: string }>({
            method: "agent",
            params: {
              message,
              sessionKey: resolved.entry.childSessionKey,
              sessionId,
              idempotencyKey,
              deliver: false,
              channel: INTERNAL_MESSAGE_CHANNEL,
              lane: AGENT_LANE_SUBAGENT,
              timeout: 0,
            },
            timeoutMs: 10_000,
          });
          if (typeof response?.runId === "string" && response.runId) runId = response.runId;
        } catch (err) {
          clearSubagentRunSteerRestart(resolved.entry.runId);
          return jsonResult({
            status: "error",
            action: "steer",
            target,
            runId,
            sessionKey: resolved.entry.childSessionKey,
            sessionId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
        replaceSubagentRunAfterSteer({
          previousRunId: resolved.entry.runId,
          nextRunId: runId,
          fallback: resolved.entry,
          runTimeoutSeconds: resolved.entry.runTimeoutSeconds ?? 0,
        });
        return jsonResult({
          status: "accepted",
          action: "steer",
          target,
          runId,
          sessionKey: resolved.entry.childSessionKey,
          sessionId,
          mode: "restart",
          label: resolveSubagentLabel(resolved.entry),
          text: `steered ${resolveSubagentLabel(resolved.entry)}.`,
        });
      }

      if (action === "distill") {
        const result = await distillMemory();
        const { status: distillStatus, ...rest } = result;
        return jsonResult({
          status: distillStatus === "error" ? "error" : "ok",
          action: "distill",
          ...rest,
          text:
            distillStatus === "success"
              ? `Distilled ${result.axiomsExtracted} axioms.`
              : `Distillation: ${distillStatus}`,
        });
      }

      if (action === "status") {
        const stats = await getSystemStatus();
        return jsonResult({
          action: "status",
          cpuLoad: stats.cpuLoad,
          memoryUsagePercent: stats.memoryUsagePercent,
          uptime: stats.uptime,
          text: `CPU ${stats.cpuLoad[0].toFixed(2)}, Mem ${stats.memoryUsagePercent}%`,
        });
      }

      if (action === "audit") {
        const stats = await getSystemStatus();
        let logicGateCount = 0;
        try {
          const workspaceRoot = resolveWorkspaceRoot(cfg.agents?.defaults?.workspace);
          const gatesContent = await fs.readFile(
            path.join(workspaceRoot, "LOGIC_GATES.md"),
            "utf-8",
          );
          logicGateCount = gatesContent.split("\n").filter((l) => l.trim().length > 0).length;
        } catch {
          /* Ignore */
        }
        const neuralDepth = activeEntries.length || logicGateCount;
        const chaosScore = 10 + Math.floor(stats.memoryUsagePercent / 4) + neuralDepth;
        const recommendations: string[] = [];
        let autoTriggered = false;

        if (chaosScore > 50) {
          recommendations.push(
            "CRITICAL: Logic Entropy High. Multiple active nodes and memory pressure detected. Auto-distilling memory to stabilize cognitive core.",
          );
          await distillMemory();
          autoTriggered = true;
        } else if (chaosScore > 30) {
          recommendations.push(
            "WARNING: High entropy. Consider logical pruning or result consolidation.",
          );
        } else {
          recommendations.push(
            "System stable. Cognitive load and memory alignment are within nominal parameters.",
          );
        }

        return jsonResult({
          auditStatus: "ok",
          action: "audit",
          chaosScore,
          recommendations,
          autoTriggered,
          text: `[AEON AUDIT] Chaos Score: ${chaosScore}. ${recommendations.join(" ")}`,
        });
      }

      return jsonResult({ status: "error", error: "Unsupported action." });
    },
  };
}
