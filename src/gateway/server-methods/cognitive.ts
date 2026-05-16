import fs from "node:fs/promises";
import path from "node:path";
import { TaskOrchestrator } from "../../cognitive-os/index.js";
import { CognitiveMemoryService } from "../../cognitive-os/memory/service.js";
import { CognitionService } from "../../cognitive-os/cognition/service.js";
import { defaultWorldCapabilities } from "../../cognitive-os/world/capabilities.js";
import { getShortTermState } from "../../cognitive-os/memory/short-term-store.js";
import type { CognitiveTaskPhase } from "../../cognitive-os/contracts/types.js";
import { assertNoPathAliasEscape } from "../../infra/path-alias-guards.js";
import { isNotFoundPathError } from "../../infra/path-guards.js";
import { queryCognitiveEvents } from "../../cognitive-os/observability/event-bus.js";
import { buildCognitiveTrajectory } from "../../cognitive-os/observability/trajectory.js";
import type { GatewayRequestHandlers } from "./types.js";

async function resolveSourceFilePath(workspaceDir: string, requestPath: string): Promise<string> {
  const raw = requestPath.trim();
  if (!raw) {
    throw new Error("path is required");
  }
  const absolute = path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(workspaceDir, raw);
  await assertNoPathAliasEscape({
    absolutePath: absolute,
    rootPath: workspaceDir,
    boundaryLabel: "workspace root",
  });
  return absolute;
}

function formatSourceExcerpt(
  content: string,
  params: { startLine: number; endLine: number; contextLines: number },
): {
  excerpt: string;
  contextStartLine: number;
  contextEndLine: number;
  lineCount: number;
} {
  const lines = content.length > 0 ? content.split(/\r?\n/) : [];
  const startLine = Math.max(1, Math.floor(params.startLine));
  const endLine = Math.max(startLine, Math.floor(params.endLine));
  const contextLines = Math.max(0, Math.floor(params.contextLines));
  const contextStartLine = lines.length === 0 ? 0 : Math.max(1, startLine - contextLines);
  const contextEndLine = lines.length === 0 ? 0 : Math.min(lines.length, endLine + contextLines);
  const excerptLines = lines.length === 0 ? [] : lines.slice(contextStartLine - 1, contextEndLine);
  const excerpt =
    excerptLines.length === 0
      ? "(empty file)"
      : excerptLines
          .map((line, index) => {
            const lineNo = contextStartLine + index;
            const marker = lineNo >= startLine && lineNo <= endLine ? ">" : " ";
            return `${marker} ${String(lineNo).padStart(4, " ")} | ${line}`;
          })
          .join("\n");
  return { excerpt, contextStartLine, contextEndLine, lineCount: lines.length };
}

const orchestratorCache = new Map<string, TaskOrchestrator>();

async function getOrchestrator(workspaceDir: string): Promise<TaskOrchestrator> {
  let cached = orchestratorCache.get(workspaceDir);
  if (!cached) {
    cached = new TaskOrchestrator(workspaceDir);
    orchestratorCache.set(workspaceDir, cached);
    // Background bootstrap active tasks and start polling
    cached
      .bootstrap()
      .catch((err) => console.error(`[Gateway] Bootstrap failed for ${workspaceDir}: ${err}`));
  }
  return cached;
}

async function findTaskBySessionKey(orchestrator: TaskOrchestrator, sessionKey: string) {
  const tasks = await orchestrator.list(200);
  return tasks.find((item) => item.sessionKey === sessionKey) ?? null;
}

async function buildCognitivePlanSnapshot(
  orchestrator: TaskOrchestrator,
  taskId: string,
): Promise<Record<string, unknown> | null> {
  const task = await orchestrator.read(taskId);
  if (!task) return null;
  const runtime = await orchestrator.runtimeSummary(task.id);
  const rootId = task.tree.rootId;
  const nodes = Object.values(task.tree.nodes).filter((node) => node.id !== rootId);
  const displayPhase =
    task.status.phase === "INIT" || task.status.phase === "PLAN"
      ? "planning"
      : task.status.phase === "EXECUTE"
        ? "execution"
        : task.status.phase === "VERIFY" || task.status.phase === "REFLECT"
          ? "verification"
          : "complete";
  const blockedBy: Record<string, string[]> = {};
  const readyNodeIds: string[] = [];
  const blockedNodeIds: string[] = [];
  for (const node of nodes) {
    const blockers = node.dependsOn.filter((depId) => task.tree.nodes[depId]?.status !== "done");
    blockedBy[node.id] = blockers;
    if (node.status === "todo" && blockers.length === 0) readyNodeIds.push(node.id);
    if (node.status === "todo" && blockers.length > 0) blockedNodeIds.push(node.id);
  }

  return {
    taskId: task.id,
    sessionKey: task.sessionKey,
    title: task.title,
    description: task.input,
    nativePhase: task.status.phase,
    phase: displayPhase,
    todos: nodes.map((node) => ({
      id: node.id,
      title: node.title,
      status: node.status === "failed" || node.status === "blocked" ? "todo" : node.status,
      result: node.artifacts.length > 0 ? node.artifacts.join(", ") : undefined,
      dependsOn: node.dependsOn,
      ownerAgent: node.ownerRole,
      acceptanceCriteria: node.acceptanceCriteria,
      updatedAt: task.updatedAt,
      attemptCount:
        node.metadata && typeof node.metadata.retryCount === "number"
          ? node.metadata.retryCount
          : undefined,
    })),
    updatedAt: task.updatedAt,
    stateProjection: runtime?.stateProjection ?? task.stateProjection ?? null,
    invariants: runtime?.invariants ?? task.invariantReport ?? null,
    memoryTrace: runtime?.memoryTrace ?? task.memoryTrace ?? null,
    architecture: runtime?.architecture ?? null,
    replayCursor: runtime?.replayCursor ?? task.runIds.at(-1) ?? null,
    taskTree: {
      rootId,
      nodes: task.tree.nodes,
    },
    executionGraph: {
      orderedTodoIds: nodes.map((node) => node.id),
      readyTodoIds: readyNodeIds,
      blockedTodoIds: blockedNodeIds,
      inProgressTodoIds: nodes
        .filter((node) => node.status === "in_progress")
        .map((node) => node.id),
      orderedNodeIds: nodes.map((node) => node.id),
      readyNodeIds,
      blockedNodeIds,
      inProgressNodeIds: nodes
        .filter((node) => node.status === "in_progress")
        .map((node) => node.id),
      failedNodeIds: nodes.filter((node) => node.status === "failed").map((node) => node.id),
      doneNodeIds: nodes.filter((node) => node.status === "done").map((node) => node.id),
      blockedBy,
      queue: runtime?.queue ?? { pending: 0, claimed: 0 },
      retries: runtime?.retries ?? { total: 0, pendingBackoff: 0, exhausted: 0 },
    },
    runtime,
  };
}

export const cognitiveHandlers: GatewayRequestHandlers = {
  "cognitive.task.submit": async ({ params, respond, context }) => {
    const sessionKey = typeof params.sessionKey === "string" ? params.sessionKey.trim() : "";
    const text = typeof params.text === "string" ? params.text.trim() : "";
    const title = typeof params.title === "string" ? params.title.trim() : undefined;
    if (!sessionKey || !text) {
      respond(false, undefined, {
        code: "COGNITIVE_TASK_INVALID_REQUEST",
        message: "sessionKey and text are required",
      });
      return;
    }

    try {
      const orchestrator = await getOrchestrator(context.workspaceDir);
      const record = await orchestrator.submit({ sessionKey, title, text });
      const payload = { ok: true, task: record };
      context.broadcast("cognitive.task.submitted", {
        sessionKey,
        taskId: record.id,
        phase: record.status.phase,
        at: Date.now(),
      });
      respond(true, payload, undefined);
    } catch (err) {
      respond(false, undefined, {
        code: "COGNITIVE_TASK_SUBMIT_ERROR",
        message: String(err),
      });
    }
  },

  "cognitive.task.demo.run": async ({ params, respond, context }) => {
    const sessionKey = typeof params.sessionKey === "string" ? params.sessionKey.trim() : "";
    const text = typeof params.text === "string" ? params.text.trim() : "";
    const title = typeof params.title === "string" ? params.title.trim() : undefined;
    const maxDispatchCycles =
      typeof params.maxDispatchCycles === "number" ? params.maxDispatchCycles : undefined;
    if (!sessionKey || !text) {
      respond(false, undefined, {
        code: "COGNITIVE_TASK_INVALID_REQUEST",
        message: "sessionKey and text are required",
      });
      return;
    }

    try {
      const orchestrator = await getOrchestrator(context.workspaceDir);
      const result = await orchestrator.runDemoFlow({ sessionKey, title, text, maxDispatchCycles });
      context.broadcast("cognitive.task.demo.completed", {
        sessionKey,
        taskId: result.task.id,
        phase: result.task.status.phase,
        cycles: result.cycles,
        at: Date.now(),
      });
      respond(true, { ok: true, ...result }, undefined);
    } catch (err) {
      respond(false, undefined, {
        code: "COGNITIVE_TASK_DEMO_RUN_ERROR",
        message: String(err),
      });
    }
  },

  "cognitive.task.read": async ({ params, respond, context }) => {
    const taskId = typeof params.taskId === "string" ? params.taskId.trim() : "";
    if (!taskId) {
      respond(false, undefined, {
        code: "COGNITIVE_TASK_INVALID_REQUEST",
        message: "taskId is required",
      });
      return;
    }
    try {
      const orchestrator = await getOrchestrator(context.workspaceDir);
      const direct = await orchestrator.read(taskId);
      const task = direct ?? (await findTaskBySessionKey(orchestrator, taskId));
      if (!task) {
        respond(true, { ok: true, task: null }, undefined);
        return;
      }
      const runtimeSummary = await orchestrator.runtimeSummary(task.id);
      const cognitivePlan = await buildCognitivePlanSnapshot(orchestrator, task.id);
      respond(
        true,
        {
          ok: true,
          task,
          cognitivePlan,
          runtime: {
            summary: runtimeSummary,
            replayCursor:
              runtimeSummary?.replayCursor ?? task.runIds[task.runIds.length - 1] ?? null,
            events: queryCognitiveEvents({ taskId: task.id, limit: 100 }),
          },
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, {
        code: "COGNITIVE_TASK_READ_ERROR",
        message: String(err),
      });
    }
  },

  "cognitive.task.list": async ({ params, respond, context }) => {
    const limit = typeof params.limit === "number" ? params.limit : 20;
    const orchestrator = await getOrchestrator(context.workspaceDir);
    const tasks = await orchestrator.list(limit);
    respond(true, { ok: true, tasks }, undefined);
  },

  "cognitive.task.transition": async ({ params, respond, context }) => {
    const taskId = typeof params.taskId === "string" ? params.taskId.trim() : "";
    const to = typeof params.to === "string" ? (params.to.trim() as CognitiveTaskPhase) : "";
    const reason = typeof params.reason === "string" ? params.reason.trim() : undefined;
    if (!taskId || !to) {
      respond(false, undefined, {
        code: "COGNITIVE_TASK_INVALID_REQUEST",
        message: "taskId and to are required",
      });
      return;
    }

    try {
      const orchestrator = await getOrchestrator(context.workspaceDir);
      const task = await orchestrator.transition({ taskId, to, reason });
      context.broadcast("cognitive.task.transitioned", {
        taskId,
        phase: task.status.phase,
        at: Date.now(),
      });
      respond(true, { ok: true, task }, undefined);
    } catch (err) {
      respond(false, undefined, {
        code: "COGNITIVE_TASK_TRANSITION_ERROR",
        message: String(err),
      });
    }
  },

  "cognitive.runtime.dispatch": async ({ params, respond, context }) => {
    const taskId = typeof params.taskId === "string" ? params.taskId.trim() : "";
    if (!taskId) {
      respond(false, undefined, {
        code: "COGNITIVE_RUNTIME_INVALID_REQUEST",
        message: "taskId is required",
      });
      return;
    }

    try {
      const orchestrator = await getOrchestrator(context.workspaceDir);
      const task = await orchestrator.dispatchNextReadyNode(taskId);
      context.broadcast("cognitive.runtime.dispatched", {
        taskId,
        phase: task.status.phase,
        updatedAt: task.updatedAt,
      });
      respond(true, { ok: true, task }, undefined);
    } catch (err) {
      respond(false, undefined, {
        code: "COGNITIVE_RUNTIME_DISPATCH_ERROR",
        message: String(err),
      });
    }
  },
  "cognitive.runtime.force_start": async ({ params, respond, context }) => {
    const taskId = typeof params.taskId === "string" ? params.taskId.trim() : "";
    const nodeId = typeof params.nodeId === "string" ? params.nodeId.trim() : "";
    if (!taskId || !nodeId) {
      respond(false, undefined, {
        code: "COGNITIVE_RUNTIME_INVALID_REQUEST",
        message: "taskId and nodeId are required",
      });
      return;
    }

    try {
      const orchestrator = await getOrchestrator(context.workspaceDir);
      const task = await orchestrator.forceStartNode(taskId, nodeId);
      context.broadcast("cognitive.runtime.dispatched", {
        taskId,
        nodeId,
        phase: task.status.phase,
        mode: "force",
      });
      respond(true, { ok: true, task }, undefined);
    } catch (err) {
      respond(false, undefined, {
        code: "COGNITIVE_RUNTIME_FORCE_START_ERROR",
        message: String(err),
      });
    }
  },

  "cognitive.runtime.status": async ({ params, respond, context }) => {
    const taskId = typeof params.taskId === "string" ? params.taskId.trim() : "";
    const runId = typeof params.runId === "string" ? params.runId.trim() : "";
    const orchestrator = await getOrchestrator(context.workspaceDir);
    const task = taskId ? await orchestrator.read(taskId) : null;
    const summary = task ? await orchestrator.runtimeSummary(task.id) : null;
    const recentRuntimeEvents = queryCognitiveEvents({
      taskId: task?.id,
      stream: "runtime_dispatch",
      limit: 20,
    });
    const providerState = new Map<
      string,
      { lastModel?: string; success: number; failed: number }
    >();
    for (const event of recentRuntimeEvents) {
      const winner =
        event.payload && typeof event.payload === "object"
          ? (event.payload.winner as { provider?: string; model?: string } | undefined)
          : undefined;
      const provider = winner?.provider;
      if (!provider) continue;
      const slot = providerState.get(provider) ?? { success: 0, failed: 0 };
      if (typeof winner?.model === "string") {
        slot.lastModel = winner.model;
      }
      if (event.payload && typeof event.payload.success === "boolean" && event.payload.success) {
        slot.success += 1;
      } else {
        slot.failed += 1;
      }
      providerState.set(provider, slot);
    }
    const phase = task?.status.phase ?? "INIT";
    respond(
      true,
      {
        ok: true,
        task,
        shortTerm: runId ? getShortTermState(runId) : null,
        health: {
          phase,
          providers:
            providerState.size > 0
              ? Array.from(providerState.entries()).map(([provider, state]) => ({
                  provider,
                  ...state,
                }))
              : ["gpt", "claude", "gemini"].map((provider) => ({
                  provider,
                  success: 0,
                  failed: 0,
                })),
          queue: summary?.queue ?? { pending: 0, claimed: 0 },
          retries: summary?.retries ?? { total: 0, pendingBackoff: 0, exhausted: 0 },
          delegations: summary?.delegations ?? { active: 0, overdue: 0 },
        },
        capabilities: defaultWorldCapabilities(),
      },
      undefined,
    );
  },

  "cognitive.task.replay": async ({ params, respond, context }) => {
    const taskId = typeof params.taskId === "string" ? params.taskId.trim() : "";
    const runId = typeof params.runId === "string" ? params.runId.trim() : "";
    const limit = typeof params.limit === "number" ? params.limit : 200;
    if (!taskId || !runId) {
      respond(false, undefined, {
        code: "COGNITIVE_TASK_INVALID_REQUEST",
        message: "taskId and runId are required",
      });
      return;
    }
    const orchestrator = await getOrchestrator(context.workspaceDir);
    const events = orchestrator.replay(taskId, runId, limit);
    respond(true, { ok: true, events }, undefined);
  },

  "cognitive.task.trajectory": async ({ params, respond, context }) => {
    const taskId = typeof params.taskId === "string" ? params.taskId.trim() : "";
    const limit = typeof params.limit === "number" ? params.limit : 500;
    if (!taskId) {
      respond(false, undefined, {
        code: "COGNITIVE_TASK_INVALID_REQUEST",
        message: "taskId is required",
      });
      return;
    }
    const orchestrator = await getOrchestrator(context.workspaceDir);
    const task = await orchestrator.read(taskId);
    if (!task) {
      respond(true, { ok: true, trajectory: null }, undefined);
      return;
    }
    const events = queryCognitiveEvents({ taskId: task.id, limit }).map((entry) => ({
      id: entry.id,
      taskId: entry.taskId,
      runId: entry.runId,
      at: entry.at,
      stream: entry.stream,
      payload: entry.payload,
    }));
    const trajectory = buildCognitiveTrajectory({ task, events });
    respond(true, { ok: true, trajectory }, undefined);
  },

  "cognitive.cognition.reflect": async ({ params, respond, context }) => {
    const taskId = typeof params.taskId === "string" ? params.taskId.trim() : "";
    const nodeId = typeof params.nodeId === "string" ? params.nodeId.trim() : undefined;
    const output = typeof params.output === "string" ? params.output : "";
    const success = params.success !== false;
    if (!taskId) {
      respond(false, undefined, {
        code: "COGNITIVE_REFLECT_INVALID_REQUEST",
        message: "taskId is required",
      });
      return;
    }

    const orchestrator = await getOrchestrator(context.workspaceDir);
    const task = await orchestrator.read(taskId);
    if (!task) {
      respond(true, { ok: true, task: null }, undefined);
      return;
    }

    const cognition = new CognitionService();
    const reflection = cognition.reflect({ taskId, nodeId, output, success });
    const next = {
      ...task,
      reflections: [...task.reflections, reflection],
      updatedAt: Date.now(),
    };
    await fs.mkdir(path.join(context.workspaceDir, ".openaeon", "cognitive", "tasks"), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(context.workspaceDir, ".openaeon", "cognitive", "tasks", `${task.id}.json`),
      JSON.stringify(next, null, 2),
      "utf-8",
    );

    context.broadcast("cognitive.cognition.reflected", {
      taskId,
      reflection,
      at: Date.now(),
    });

    respond(true, { ok: true, reflection, task: next }, undefined);
  },

  "cognitive.cognition.dream.run": async ({ params, respond, context }) => {
    const taskId = typeof params.taskId === "string" ? params.taskId.trim() : "";
    if (!taskId) {
      respond(false, undefined, {
        code: "COGNITIVE_DREAM_INVALID_REQUEST",
        message: "taskId is required",
      });
      return;
    }
    try {
      const orchestrator = await getOrchestrator(context.workspaceDir);
      const task = await orchestrator.runDream(taskId);
      context.broadcast("cognitive.cognition.dreamed", {
        taskId,
        phase: task.status.phase,
        at: Date.now(),
      });
      respond(true, { ok: true, task }, undefined);
    } catch (err) {
      respond(false, undefined, {
        code: "COGNITIVE_DREAM_RUN_ERROR",
        message: String(err),
      });
    }
  },

  "cognitive.memory.write": async ({ params, respond, context }) => {
    const taskId = typeof params.taskId === "string" ? params.taskId.trim() : "";
    const category =
      params.category === "success_path" ||
      params.category === "failure_case" ||
      params.category === "optimization_strategy"
        ? params.category
        : "optimization_strategy";
    const content = typeof params.content === "string" ? params.content.trim() : "";
    const tags = Array.isArray(params.tags)
      ? params.tags.filter((item): item is string => typeof item === "string")
      : [];

    if (!taskId || !content) {
      respond(false, undefined, {
        code: "COGNITIVE_MEMORY_INVALID_REQUEST",
        message: "taskId and content are required",
      });
      return;
    }

    const service = new CognitiveMemoryService(context.workspaceDir);
    const entry = await service.writeEvolution({ taskId, category, content, tags });
    context.broadcast("cognitive.memory.written", {
      taskId,
      entry,
      at: Date.now(),
    });
    respond(true, { ok: true, entry }, undefined);
  },

  "cognitive.memory.query": async ({ params, respond, context }) => {
    const taskId = typeof params.taskId === "string" ? params.taskId.trim() : undefined;
    const tags = Array.isArray(params.tags)
      ? params.tags.filter((item): item is string => typeof item === "string")
      : undefined;
    const limit = typeof params.limit === "number" ? params.limit : 50;
    const service = new CognitiveMemoryService(context.workspaceDir);
    const evolution = await service.queryEvolution({ taskId, tags, limit });

    const longTermQuery = typeof params.query === "string" ? params.query.trim() : "";
    const agentId = typeof params.agentId === "string" ? params.agentId.trim() : "main";
    const longTerm =
      longTermQuery.length > 0
        ? await service.queryLongTerm({
            query: longTermQuery,
            agentId,
            sessionKey:
              typeof params.sessionKey === "string" ? params.sessionKey.trim() : undefined,
            maxResults: typeof params.maxResults === "number" ? params.maxResults : 6,
          })
        : [];

    respond(true, { ok: true, evolution, longTerm }, undefined);
  },

  "cognitive.source.read": async ({ params, respond, context }) => {
    const requestPath = typeof params.path === "string" ? params.path.trim() : "";
    const startLine = typeof params.startLine === "number" ? params.startLine : 1;
    const endLine = typeof params.endLine === "number" ? params.endLine : startLine;
    const contextLines = typeof params.contextLines === "number" ? params.contextLines : 5;
    if (!requestPath) {
      respond(false, undefined, {
        code: "COGNITIVE_SOURCE_INVALID_REQUEST",
        message: "path is required",
      });
      return;
    }

    try {
      const absolute = await resolveSourceFilePath(context.workspaceDir, requestPath);
      const content = await fs.readFile(absolute, "utf-8").catch((err) => {
        if (isNotFoundPathError(err)) {
          return null;
        }
        throw err;
      });
      if (content == null) {
        respond(false, undefined, {
          code: "COGNITIVE_SOURCE_NOT_FOUND",
          message: `source file not found: ${requestPath}`,
        });
        return;
      }
      const { excerpt, contextStartLine, contextEndLine, lineCount } = formatSourceExcerpt(
        content,
        {
          startLine,
          endLine,
          contextLines,
        },
      );
      respond(
        true,
        {
          ok: true,
          source: {
            path: path.relative(context.workspaceDir, absolute).replace(/\\/g, "/"),
            startLine: Math.max(1, Math.floor(startLine)),
            endLine: Math.max(Math.max(1, Math.floor(startLine)), Math.floor(endLine)),
            contextStartLine,
            contextEndLine,
            lineCount,
            excerpt,
          },
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, {
        code: "COGNITIVE_SOURCE_READ_ERROR",
        message: String(err),
      });
    }
  },
};
