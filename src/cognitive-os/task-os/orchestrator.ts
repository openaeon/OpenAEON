import crypto from "node:crypto";
import path from "node:path";
import type {
  CognitiveRuntimeSummary,
  CognitiveTaskPhase,
  CognitiveTaskStatus,
} from "../contracts/types.js";
import { withFileLock } from "../../infra/file-lock.js";
import { decomposeTaskFractally, expandNodeFractally } from "../cognition/fractal-decomposer.js";
import { CognitionService } from "../cognition/service.js";
import {
  evaluateCognitiveInvariants,
  projectCognitiveState,
} from "../cognition/invariant-engine.js";
import { projectCognitiveArchitecture } from "../cognition/system-projection.js";
import { CognitiveMemoryService } from "../memory/service.js";
import {
  configureCognitiveEventStore,
  publishCognitiveEvent,
  queryCognitiveEvents,
} from "../observability/event-bus.js";
import { replayRun } from "../observability/replay.js";
import { dispatchAgentTask } from "../runtime/dispatcher.js";
import { dispatchCognitiveNodeToSubagent } from "../runtime/subagent-runtime-adapter.js";
import { applyTransition } from "./state-machine.js";
import { listTaskRecords, readTaskRecord, taskLockFile, writeTaskRecord } from "./store.js";
import type { CognitiveTaskRecord } from "./types.js";
import { COGNITIVE_POLICY } from "./policy.js";
import { buildHilbertSortedContext } from "../cognition/context-builder.js";
import {
  claimTaskNodes,
  completeTaskClaim,
  heartbeatTaskClaim,
  queueStats,
  reconcileTaskQueue,
} from "./queue.js";

function statusFor(phase: CognitiveTaskPhase, reason?: string): CognitiveTaskStatus {
  return {
    phase,
    reason,
    updatedAt: Date.now(),
  };
}

function taskStoreDir(workspaceDir: string): string {
  return path.join(workspaceDir, ".openaeon", "cognitive", "tasks");
}

function queueStoreDir(workspaceDir: string): string {
  return path.join(workspaceDir, ".openaeon", "cognitive", "queue");
}

const NODE_RETRY_BACKOFF_BASE_MS = 5_000;
const SUBAGENT_DELEGATION_LEASE_MS = 15 * 60 * 1000;

function metadataNumber(
  value: Record<string, unknown> | undefined,
  key: string,
): number | undefined {
  const raw = value?.[key];
  return typeof raw === "number" ? raw : undefined;
}

export class TaskOrchestrator {
  private readonly cognition: CognitionService;
  private readonly memory: CognitiveMemoryService;
  private pollingTimer?: NodeJS.Timeout;
  private readonly activeTaskIds = new Set<string>();
  private readonly dispatchOwner = `cognitive-orchestrator-${crypto.randomUUID()}`;
  private globalDispatchCount = 0;

  constructor(private readonly workspaceDir: string) {
    this.cognition = new CognitionService();
    this.memory = new CognitiveMemoryService(workspaceDir);
    configureCognitiveEventStore(workspaceDir);
  }

  async bootstrap() {
    console.info(`[TaskOrchestrator] Bootstrapping for ${this.workspaceDir}...`);
    const records = await this.list(100);
    for (const record of records) {
      if (
        record.status.phase !== "DONE" &&
        record.status.phase !== "FAILED" &&
        record.status.phase !== "ROLLED_BACK"
      ) {
        // Reset nodes that were in_progress during the previous session
        const updated = await this.recoverOrphanedNodes(record);
        this.activeTaskIds.add(updated.id);
      }
    }
    console.info(`[TaskOrchestrator] Resuming ${this.activeTaskIds.size} active tasks.`);
    this.startPolling();
  }

  private async recoverOrphanedNodes(record: CognitiveTaskRecord): Promise<CognitiveTaskRecord> {
    let changed = false;
    const nodes = { ...record.tree.nodes };
    for (const id of Object.keys(nodes)) {
      const node = nodes[id];
      if (node.status === "in_progress") {
        const leaseExpiresAt = metadataNumber(node.metadata, "leaseExpiresAt");
        if (
          node.metadata?.dispatchMode === "subagent" &&
          leaseExpiresAt &&
          Date.now() < leaseExpiresAt
        ) {
          continue;
        }
        console.warn(
          `[TaskOrchestrator] Task ${record.id}: Resetting orphaned node ${id} (${nodes[id].title}) from in_progress to todo.`,
        );
        nodes[id] = { ...nodes[id], status: "todo" as const };
        changed = true;
      }
    }
    if (!changed) return record;

    const updated: CognitiveTaskRecord = {
      ...record,
      tree: { ...record.tree, nodes },
      updatedAt: Date.now(),
      version: record.version + 1,
    };
    return await this.persistRecord(updated);
  }

  private executableNodes(record: CognitiveTaskRecord) {
    const nodes = Object.values(record.tree.nodes);
    const nonRootNodes = nodes.filter((node) => node.id !== record.tree.rootId);
    return nonRootNodes.length > 0 ? nonRootNodes : nodes;
  }

  private executionTerminalState(record: CognitiveTaskRecord): {
    allTerminal: boolean;
    hasFailed: boolean;
  } {
    const executableNodes = this.executableNodes(record);
    const allTerminal =
      executableNodes.length > 0 &&
      executableNodes.every((node) => node.status === "done" || node.status === "failed");
    const hasFailed = executableNodes.some((node) => node.status === "failed");
    return { allTerminal, hasFailed };
  }

  private async enterExecute(taskId: string, reason: string): Promise<CognitiveTaskRecord> {
    let current = await this.read(taskId);
    if (!current) {
      throw new Error(`task not found: ${taskId}`);
    }
    if (current.status.phase === "EXECUTE") {
      return current;
    }
    if (current.status.phase === "INIT") {
      current = await this.transition({ taskId, to: "PLAN", reason: `${reason}:plan` });
    }
    if (current.status.phase === "PLAN") {
      return await this.transition({ taskId, to: "EXECUTE", reason });
    }
    if (
      current.status.phase === "VERIFY" ||
      current.status.phase === "REFLECT" ||
      current.status.phase === "FAILED" ||
      current.status.phase === "ROLLED_BACK"
    ) {
      return await this.transition({ taskId, to: "EXECUTE", reason });
    }
    return current;
  }

  startPolling() {
    if (this.pollingTimer) return;
    this.pollingTimer = setInterval(() => {
      this.tick().catch((err) => console.error(`[TaskOrchestrator] Tick error: ${err}`));
    }, COGNITIVE_POLICY.POLLING_INTERVAL_MS);
    console.info(
      `[TaskOrchestrator] Background polling started (interval: ${COGNITIVE_POLICY.POLLING_INTERVAL_MS}ms).`,
    );
  }

  stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = undefined;
    }
  }

  private async tick() {
    const caps = COGNITIVE_POLICY.MAX_GLOBAL_CONCURRENT_DISPATCH;
    if (this.globalDispatchCount >= caps) {
      return;
    }

    const taskIds = Array.from(this.activeTaskIds);
    for (const taskId of taskIds) {
      try {
        const record = await this.read(taskId);
        if (!record || ["DONE", "FAILED", "ROLLED_BACK"].includes(record.status.phase)) {
          this.activeTaskIds.delete(taskId);
          continue;
        }

        // ── Phase: EXECUTE ──
        // Active execution: reconcile stale nodes and dispatch ready ones.
        if (record.status.phase === "EXECUTE") {
          await this.reconcileStaleNodes(record);
          const slots = caps - this.globalDispatchCount;
          if (slots > 0) {
            this.executeReadyNodes(taskId).catch((err) =>
              console.error(`[TaskOrchestrator] execution error for ${taskId}: ${err}`),
            );
          }
          continue;
        }

        // ── Phase: REFLECT ──
        // Dream loop: distill learnings and auto-complete.
        if (record.status.phase === "REFLECT") {
          this.runDream(taskId).catch((err) =>
            console.error(`[TaskOrchestrator] dream loop error for ${taskId}: ${err}`),
          );
          continue;
        }

        // ── Phase: INIT / PLAN / VERIFY ──
        // Aggressive Autopilot: auto-advance to EXECUTE without waiting for user confirmation.
        // This is the critical fix: tasks previously stalled here waiting for a manual trigger.
        if (COGNITIVE_POLICY.AGGRESSIVE_AUTOPILOT.ENABLED) {
          const phase = record.status.phase;
          const age = Date.now() - record.updatedAt;

          // First, try the state modeler's recommendation
          const projection = record.stateProjection;
          if (
            projection?.zNext?.recommendedPhase === "EXECUTE" &&
            projection?.zNext?.invariantReady
          ) {
            this.enterExecute(taskId, "autopilot_state_modeler_recommendation").catch((err) =>
              console.error(`[TaskOrchestrator] Auto-transition error: ${err}`),
            );
            continue;
          }

          // Fallback: if task has been in INIT/PLAN for longer than the deadlock threshold,
          // force it into EXECUTE regardless. This prevents indefinite stalling.
          if (
            (phase === "INIT" || phase === "PLAN" || phase === "VERIFY") &&
            age > COGNITIVE_POLICY.AGGRESSIVE_AUTOPILOT.MAX_BLOCK_DURATION_MS
          ) {
            const targetPhase = phase === "VERIFY" ? "REFLECT" : "EXECUTE";
            console.log(
              `[TaskOrchestrator] Autopilot: forcing ${taskId} from ${phase} → ${targetPhase} (stalled ${Math.round(age / 1000)}s)`,
            );
            const reason = `autopilot_force_advance_from_${phase.toLowerCase()}`;
            const transition =
              targetPhase === "EXECUTE"
                ? this.enterExecute(taskId, reason)
                : this.transition({ taskId, to: targetPhase, reason });
            transition.catch((err) =>
              console.error(`[TaskOrchestrator] Forced transition error: ${err}`),
            );
            continue;
          }
        }
      } catch (err) {
        console.error(`[TaskOrchestrator] Failed to tick task ${taskId}: ${err}`);
      }
    }
  }

  private async reconcileStaleNodes(record: CognitiveTaskRecord): Promise<void> {
    const now = Date.now();
    let changed = false;
    const nodes = { ...record.tree.nodes };
    for (const id of Object.keys(nodes)) {
      const node = nodes[id];
      if (node.status === "in_progress") {
        const leaseExpiresAt = metadataNumber(node.metadata, "leaseExpiresAt");
        if (leaseExpiresAt && now < leaseExpiresAt) {
          continue;
        }
        const lastUpdate = metadataNumber(node.metadata, "updatedAt") ?? record.updatedAt;
        if (now - lastUpdate > COGNITIVE_POLICY.STALE_NODE_THRESHOLD_MS) {
          console.warn(
            `[TaskOrchestrator] Task ${record.id}: Node ${id} (${node.title}) is stale. Resetting to todo.`,
          );
          nodes[id] = { ...node, status: "todo" as const };
          changed = true;
        }
      }
    }
    if (changed) {
      const updated: CognitiveTaskRecord = {
        ...record,
        tree: { ...record.tree, nodes },
        updatedAt: Date.now(),
        version: record.version + 1,
      };
      await this.persistRecord(updated);
    }
  }

  private async withLockedRecord<T>(
    taskId: string,
    fn: (record: CognitiveTaskRecord) => Promise<{ record: CognitiveTaskRecord; result: T }>,
  ): Promise<T> {
    const lockPath = taskLockFile(taskStoreDir(this.workspaceDir), taskId);
    return await withFileLock(lockPath, COGNITIVE_POLICY.LOCK_OPTIONS, async () => {
      const current = await this.read(taskId);
      if (!current) {
        throw new Error(`task not found: ${taskId}`);
      }
      const { record: updated, result } = await fn(current);
      const persisted = await this.persistRecord(updated);
      return result === updated ? (persisted as T) : result;
    });
  }

  private async enrichCognitiveRecord(record: CognitiveTaskRecord): Promise<CognitiveTaskRecord> {
    const strategyHits = await this.memory.queryEvolution({
      taskId: record.id,
      tags: ["strategy"],
      limit: 5,
    });
    const stateProjection = projectCognitiveState({
      taskId: record.id,
      sessionKey: record.sessionKey,
      phase: record.status.phase,
      tree: record.tree,
      reflections: record.reflections,
      strategyHits,
    });
    const invariantReport = evaluateCognitiveInvariants({
      taskId: record.id,
      sessionKey: record.sessionKey,
      phase: record.status.phase,
      input: record.input,
      tree: record.tree,
      reflections: record.reflections,
      runIds: record.runIds,
    });
    return {
      ...record,
      stateProjection,
      invariantReport,
      memoryTrace: {
        shortTermExpiresAt: Date.now() + 30 * 60 * 1000,
        longTermSources: [],
        evolutionStrategyHits: strategyHits,
      },
    };
  }

  private async persistRecord(record: CognitiveTaskRecord): Promise<CognitiveTaskRecord> {
    const enriched = await this.enrichCognitiveRecord(record);
    await writeTaskRecord(taskStoreDir(this.workspaceDir), enriched);
    return enriched;
  }

  async submit(input: {
    sessionKey: string;
    title?: string;
    text: string;
  }): Promise<CognitiveTaskRecord> {
    const taskId = crypto.randomUUID();
    const tree = decomposeTaskFractally(input.text);
    const now = Date.now();
    const record: CognitiveTaskRecord = {
      id: taskId,
      sessionKey: input.sessionKey,
      title: input.title?.trim() || "Cognitive Task",
      input: input.text,
      status: statusFor("INIT", "task_submitted"),
      tree,
      reflections: [],
      runIds: [],
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    const lockPath = taskLockFile(taskStoreDir(this.workspaceDir), taskId);
    await withFileLock(lockPath, COGNITIVE_POLICY.LOCK_OPTIONS, async () => {
      await this.persistRecord(record);
    });

    publishCognitiveEvent({
      stream: "task_submitted",
      taskId,
      runId: "bootstrap",
      payload: {
        title: record.title,
        sessionKey: record.sessionKey,
        rootId: record.tree.rootId,
      },
    });

    this.activeTaskIds.add(taskId);

    // If aggressive autopilot is on, skip the manual PLAN review and go straight to EXECUTE
    if (COGNITIVE_POLICY.AGGRESSIVE_AUTOPILOT.ENABLED) {
      return await this.enterExecute(taskId, "autopilot_immediate_execute_after_submit");
    }

    return await this.transition({ taskId, to: "PLAN", reason: "auto_plan_after_submit" });
  }

  async read(taskId: string): Promise<CognitiveTaskRecord | null> {
    return await readTaskRecord(taskStoreDir(this.workspaceDir), taskId);
  }

  async list(limit = 20): Promise<CognitiveTaskRecord[]> {
    return await listTaskRecords(taskStoreDir(this.workspaceDir), limit);
  }

  async transition(input: {
    taskId: string;
    to: CognitiveTaskPhase;
    reason?: string;
  }): Promise<CognitiveTaskRecord> {
    return await this.withLockedRecord(input.taskId, async (current) => {
      let nextPhase = applyTransition(current.status.phase, input.to);
      const requestedDoneReport =
        nextPhase === "DONE"
          ? evaluateCognitiveInvariants({
              taskId: current.id,
              sessionKey: current.sessionKey,
              phase: nextPhase,
              input: current.input,
              tree: current.tree,
              reflections: current.reflections,
              runIds: current.runIds,
            })
          : null;
      if (requestedDoneReport?.blocked) {
        nextPhase = applyTransition(current.status.phase, "FAILED");
      }

      const next: CognitiveTaskRecord = {
        ...current,
        status: {
          phase: nextPhase,
          reason: requestedDoneReport?.blocked ? "invariant_failure_blocked_done" : input.reason,
          updatedAt: Date.now(),
        },
        version: current.version + 1,
        updatedAt: Date.now(),
      };

      publishCognitiveEvent({
        stream: "task_transition",
        taskId: next.id,
        runId: next.runIds[next.runIds.length - 1] ?? "phase",
        payload: {
          from: current.status.phase,
          to: next.status.phase,
          requestedTo: input.to,
          invariantBlocked: requestedDoneReport?.blocked ?? false,
          reason: input.reason,
        },
      });

      return { record: next, result: next };
    });
  }

  async executeReadyNodes(taskId: string): Promise<CognitiveTaskRecord[]> {
    const record = await this.read(taskId);
    if (!record || record.status.phase !== "EXECUTE") {
      return [];
    }

    const invariantReport = evaluateCognitiveInvariants({
      taskId: record.id,
      sessionKey: record.sessionKey,
      phase: record.status.phase,
      input: record.input,
      tree: record.tree,
      reflections: record.reflections,
      runIds: record.runIds,
    });
    if (invariantReport.blocked) {
      console.warn(
        `[TaskOrchestrator] Invariant failure detected for ${record.id}. Routing through reflection.`,
      );
      await this.transition({
        taskId,
        to: "REFLECT",
        reason: "invariant_failure_requires_reflection",
      });
      return [record];
    }

    await reconcileTaskQueue(queueStoreDir(this.workspaceDir), {
      taskId,
      nodes: this.executableNodes(record),
    });
    const slots = Math.max(
      0,
      COGNITIVE_POLICY.MAX_GLOBAL_CONCURRENT_DISPATCH - this.globalDispatchCount,
    );
    if (slots <= 0) {
      return [record];
    }

    const claims = await claimTaskNodes(queueStoreDir(this.workspaceDir), {
      taskId,
      owner: this.dispatchOwner,
      maxCount: Math.max(1, slots),
    });

    if (claims.length === 0) {
      const stats = await queueStats(queueStoreDir(this.workspaceDir), taskId);
      const terminal = this.executionTerminalState(record);
      if (stats.pending === 0 && stats.claimed === 0 && terminal.allTerminal) {
        await this.handleExecutionCompletion(taskId);
      }
      return [record];
    }

    return await Promise.all(
      claims.map((claim) => this.dispatchNode(taskId, claim.nodeId, claim.key, claim.attempts)),
    );
  }

  private async dispatchNode(
    taskId: string,
    nodeId: string,
    claimKey: string,
    claimAttempts: number,
  ): Promise<CognitiveTaskRecord> {
    const runId = crypto.randomUUID();
    let heartbeatTimer: NodeJS.Timeout | undefined;

    const workingRecord = await this.withLockedRecord(taskId, async (record) => {
      const node = record.tree.nodes[nodeId];
      if (!node || node.status !== "todo") {
        return { record, result: record };
      }

      const updatedNode = {
        ...node,
        status: "in_progress" as const,
        metadata: {
          ...node.metadata,
          claimKey,
          claimAttempts,
          updatedAt: Date.now(),
        },
      };
      const updated: CognitiveTaskRecord = {
        ...record,
        tree: {
          ...record.tree,
          nodes: { ...record.tree.nodes, [nodeId]: updatedNode },
        },
        runIds: [...record.runIds, runId],
        updatedAt: Date.now(),
      };
      this.globalDispatchCount += 1;
      return { record: updated, result: updated };
    });

    const pending = workingRecord.tree.nodes[nodeId];
    if (!pending || pending.status !== "in_progress") {
      return workingRecord;
    }

    try {
      heartbeatTimer = setInterval(() => {
        void heartbeatTaskClaim(queueStoreDir(this.workspaceDir), {
          key: claimKey,
          owner: this.dispatchOwner,
        });
      }, COGNITIVE_POLICY.NODE_HEARTBEAT_INTERVAL_MS);

      const node = workingRecord.tree.nodes[nodeId];
      const subagentResult = await dispatchCognitiveNodeToSubagent({
        taskId,
        nodeId,
        runId,
        sessionKey: workingRecord.sessionKey,
        role: node.ownerRole ?? "DevAgent",
        title: node.title,
        prompt: `${node.title}\nAcceptance: ${node.acceptanceCriteria.join("; ")}`,
        acceptanceCriteria: node.acceptanceCriteria,
        timeoutMs: Math.max(COGNITIVE_POLICY.DEFAULT_AGENT_TIMEOUT, 600_000),
      });

      if (subagentResult.accepted) {
        return await this.withLockedRecord(taskId, async (record) => {
          const currentNode = record.tree.nodes[nodeId];
          if (!currentNode) {
            return { record, result: record };
          }
          const nextRecord: CognitiveTaskRecord = {
            ...record,
            tree: {
              ...record.tree,
              nodes: {
                ...record.tree.nodes,
                [nodeId]: {
                  ...currentNode,
                  status: "in_progress",
                  metadata: {
                    ...currentNode.metadata,
                    dispatchMode: "subagent",
                    delegatedAt: Date.now(),
                    leaseExpiresAt: Date.now() + SUBAGENT_DELEGATION_LEASE_MS,
                    subagentRunId: subagentResult.runId,
                    childSessionKey: subagentResult.childSessionKey,
                    ownerRole: node.ownerRole ?? "DevAgent",
                  },
                },
              },
            },
            updatedAt: Date.now(),
          };

          publishCognitiveEvent({
            stream: "runtime_delegate",
            taskId,
            runId,
            payload: {
              nodeId,
              role: node.ownerRole ?? "DevAgent",
              subagentRunId: subagentResult.runId,
              childSessionKey: subagentResult.childSessionKey,
            },
          });

          return { record: nextRecord, result: nextRecord };
        });
      }

      const dispatchResult = await dispatchAgentTask({
        taskId,
        nodeId,
        role: node.ownerRole ?? "DevAgent",
        prompt: `${node.title}\nAcceptance: ${node.acceptanceCriteria.join("; ")}`,
        providers: COGNITIVE_POLICY.DEFAULT_PROVIDERS,
        timeoutMs: COGNITIVE_POLICY.DEFAULT_AGENT_TIMEOUT,
        context: await buildHilbertSortedContext(this.workspaceDir),
      });

      const output = dispatchResult.winner.output;
      const success = dispatchResult.winner.score >= COGNITIVE_POLICY.MIN_SUCCESS_SCORE;
      const shouldDecompose =
        output.includes("[ACTION: DECOMPOSE]") && node.depth < COGNITIVE_POLICY.MAX_FRACTAL_DEPTH;

      return await this.withLockedRecord(taskId, async (record) => {
        const currentNode = record.tree.nodes[nodeId];
        const updatedNodes = { ...record.tree.nodes };
        const previousRetryCount =
          currentNode.metadata && typeof currentNode.metadata.retryCount === "number"
            ? currentNode.metadata.retryCount
            : 0;
        const attemptCount = Math.max(previousRetryCount + 1, claimAttempts);
        const canRetry = !success && attemptCount < COGNITIVE_POLICY.MAX_RETRIES;
        const retryDelayMs = Math.min(
          90_000,
          NODE_RETRY_BACKOFF_BASE_MS * 2 ** Math.max(0, attemptCount - 1),
        );

        if (shouldDecompose) {
          const subTasks = expandNodeFractally(currentNode, output);
          const subTaskIds = subTasks.map((t) => t.id);
          for (const st of subTasks) {
            updatedNodes[st.id] = st;
          }
          updatedNodes[nodeId] = {
            ...currentNode,
            status: "todo",
            children: [...currentNode.children, ...subTaskIds],
            metadata: {
              ...currentNode.metadata,
              decomposed: true,
              retryCount: attemptCount,
              nextRetryAt: undefined,
              lastError: undefined,
              updatedAt: Date.now(),
            },
          };
        } else {
          updatedNodes[nodeId] = {
            ...currentNode,
            status: success ? "done" : canRetry ? "todo" : "failed",
            artifacts: success
              ? [...currentNode.artifacts, `run:${runId}`, `model:${dispatchResult.winner.model}`]
              : currentNode.artifacts,
            metadata: {
              ...currentNode.metadata,
              retryCount: attemptCount,
              nextRetryAt: canRetry ? Date.now() + retryDelayMs : undefined,
              lastError: success ? undefined : output || "empty_output",
              updatedAt: Date.now(),
            },
          };
        }

        if (success && output.includes("[AXIOM]")) {
          const axiomLines = output.split("\n").filter((line) => line.includes("[AXIOM]"));
          for (const line of axiomLines) {
            await this.memory.writeEvolution({
              taskId,
              category: "optimization_strategy",
              content: line.trim(),
              tags: ["axiom", "agent_generated", nodeId],
            });
          }
        }

        const reflected = this.cognition.reflect({ taskId, nodeId, output, success });

        const nextRecord: CognitiveTaskRecord = {
          ...record,
          reflections: [...record.reflections, reflected],
          tree: { ...record.tree, nodes: updatedNodes },
          updatedAt: Date.now(),
        };

        publishCognitiveEvent({
          stream: "runtime_dispatch",
          taskId,
          runId,
          payload: {
            nodeId,
            success,
            shouldDecompose,
            attemptCount,
            canRetry,
            winner: dispatchResult.winner,
          },
        });

        return { record: nextRecord, result: nextRecord };
      });
    } catch (error) {
      return await this.withLockedRecord(taskId, async (record) => {
        const currentNode = record.tree.nodes[nodeId];
        if (!currentNode) {
          return { record, result: record };
        }
        const previousRetryCount =
          currentNode.metadata && typeof currentNode.metadata.retryCount === "number"
            ? currentNode.metadata.retryCount
            : 0;
        const attemptCount = Math.max(previousRetryCount + 1, claimAttempts);
        const canRetry = attemptCount < COGNITIVE_POLICY.MAX_RETRIES;
        const retryDelayMs = Math.min(
          90_000,
          NODE_RETRY_BACKOFF_BASE_MS * 2 ** Math.max(0, attemptCount - 1),
        );

        const reflected = this.cognition.reflect({
          taskId,
          nodeId,
          output: String(error),
          success: false,
        });

        const nextRecord: CognitiveTaskRecord = {
          ...record,
          reflections: [...record.reflections, reflected],
          tree: {
            ...record.tree,
            nodes: {
              ...record.tree.nodes,
              [nodeId]: {
                ...currentNode,
                status: canRetry ? "todo" : "failed",
                metadata: {
                  ...currentNode.metadata,
                  retryCount: attemptCount,
                  nextRetryAt: canRetry ? Date.now() + retryDelayMs : undefined,
                  lastError: String(error),
                  updatedAt: Date.now(),
                },
              },
            },
          },
          updatedAt: Date.now(),
        };

        publishCognitiveEvent({
          stream: "runtime_dispatch_error",
          taskId,
          runId,
          payload: { nodeId, error: String(error), attemptCount, canRetry },
        });

        return { record: nextRecord, result: nextRecord };
      });
    } finally {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }
      await completeTaskClaim(queueStoreDir(this.workspaceDir), {
        key: claimKey,
        owner: this.dispatchOwner,
      });
      this.globalDispatchCount = Math.max(0, this.globalDispatchCount - 1);
    }
  }

  async dispatchNextReadyNode(taskId: string): Promise<CognitiveTaskRecord> {
    const record = await this.read(taskId);
    if (!record) {
      throw new Error(`task not found: ${taskId}`);
    }

    if (record.status.phase === "INIT" || record.status.phase === "PLAN") {
      return await this.enterExecute(taskId, "manual_dispatch_enter_execute");
    }
    if (record.status.phase === "VERIFY") {
      return await this.transition({
        taskId,
        to: "REFLECT",
        reason: "manual_dispatch_from_verify",
      });
    }
    if (record.status.phase === "REFLECT") {
      return await this.runDream(taskId);
    }
    if (record.status.phase !== "EXECUTE") {
      return record;
    }

    await this.executeReadyNodes(taskId);
    const latest = await this.read(taskId);
    if (!latest) {
      throw new Error(`task not found after dispatch: ${taskId}`);
    }
    return latest;
  }
  async forceStartNode(taskId: string, nodeId: string): Promise<CognitiveTaskRecord> {
    const record = await this.read(taskId);
    if (!record) {
      throw new Error(`task not found: ${taskId}`);
    }

    await this.enterExecute(taskId, "force_start_node_requires_execute");

    await this.withLockedRecord(taskId, async (current) => {
      const node = current.tree.nodes[nodeId];
      if (!node) {
        throw new Error(`node not found: ${nodeId}`);
      }
      if (node.status === "done") {
        return { record: current, result: current };
      }
      const next: CognitiveTaskRecord = {
        ...current,
        tree: {
          ...current.tree,
          nodes: {
            ...current.tree.nodes,
            [nodeId]: {
              ...node,
              status: "todo",
              metadata: {
                ...node.metadata,
                forceStartedAt: Date.now(),
                nextRetryAt: undefined,
                leaseExpiresAt: undefined,
                updatedAt: Date.now(),
              },
            },
          },
        },
        updatedAt: Date.now(),
      };
      return { record: next, result: next };
    });

    await this.dispatchNode(taskId, nodeId, `force:${taskId}:${nodeId}:${crypto.randomUUID()}`, 1);

    const latest = await this.read(taskId);
    if (!latest) {
      throw new Error(`task not found after force start: ${taskId}`);
    }
    return latest;
  }

  async runDream(taskId: string): Promise<CognitiveTaskRecord> {
    const initial = await this.read(taskId);
    if (!initial) {
      throw new Error(`task not found: ${taskId}`);
    }
    if (initial.status.phase === "VERIFY") {
      await this.transition({ taskId, to: "REFLECT", reason: "auto_reflect_before_dream" });
    }

    const ready = await this.read(taskId);
    if (!ready || ready.status.phase !== "REFLECT") {
      throw new Error(`task ${taskId} must be in REFLECT before dream loop`);
    }

    const terminal = this.executionTerminalState(ready);
    if (terminal.hasFailed) {
      const failedNodes = this.executableNodes(ready).filter((node) => node.status === "failed");
      const exhausted = failedNodes.every(
        (node) =>
          (metadataNumber(node.metadata, "retryCount") ?? 0) >= COGNITIVE_POLICY.MAX_RETRIES,
      );
      if (!exhausted) {
        await this.withLockedRecord(taskId, async (record) => {
          const nodes = { ...record.tree.nodes };
          for (const node of this.executableNodes(record)) {
            if (node.status !== "failed") continue;
            nodes[node.id] = {
              ...node,
              status: "todo",
              metadata: {
                ...node.metadata,
                reflectedForRetryAt: Date.now(),
                nextRetryAt: undefined,
                updatedAt: Date.now(),
              },
            };
          }
          return {
            record: {
              ...record,
              tree: { ...record.tree, nodes },
              updatedAt: Date.now(),
              version: record.version + 1,
            },
            result: record,
          };
        });
        return await this.enterExecute(taskId, "dream_recovered_failed_nodes");
      }
    }

    await this.withLockedRecord(taskId, async (record) => {
      const dreamed = this.cognition.dream({
        taskId,
        reflections: record.reflections,
        sourceRunIds: record.runIds,
      });

      await this.memory.writeEvolution({
        taskId,
        category: "optimization_strategy",
        content: dreamed.dream.summary,
        tags: ["dream", "strategy"],
      });

      publishCognitiveEvent({
        stream: "dream_loop",
        taskId,
        runId: record.runIds[record.runIds.length - 1] ?? "dream",
        payload: {
          dream: dreamed.dream,
          strategy: dreamed.strategy,
        },
      });

      const updated: CognitiveTaskRecord = {
        ...record,
        version: record.version + 1,
        updatedAt: Date.now(),
      };

      return { record: updated, result: updated };
    });

    const afterDream = await this.read(taskId);
    if (!afterDream) {
      throw new Error(`task not found after dream loop: ${taskId}`);
    }
    if (this.executionTerminalState(afterDream).hasFailed) {
      return await this.transition({
        taskId,
        to: "FAILED",
        reason: "dream_distillation_failed_nodes_exhausted",
      });
    }

    return await this.transition({ taskId, to: "DONE", reason: "dream_distillation_completed" });
  }

  async runDemoFlow(input: {
    sessionKey: string;
    title?: string;
    text: string;
    maxDispatchCycles?: number;
  }): Promise<{ task: CognitiveTaskRecord; cycles: number }> {
    const created = await this.submit(input);
    await this.enterExecute(created.id, "demo_enter_execute");

    const maxCycles = Math.max(1, Math.min(100, input.maxDispatchCycles ?? 30));
    let cycles = 0;
    let current = await this.read(created.id);
    if (!current) {
      throw new Error(`task not found after submit: ${created.id}`);
    }

    while (cycles < maxCycles) {
      if (
        current.status.phase === "DONE" ||
        current.status.phase === "FAILED" ||
        current.status.phase === "ROLLED_BACK"
      ) {
        break;
      }
      current = await this.dispatchNextReadyNode(created.id);
      cycles += 1;
    }

    if (current.status.phase !== "DONE") {
      throw new Error(
        `demo flow did not finish within ${maxCycles} cycles (last phase: ${current.status.phase})`,
      );
    }

    return { task: current, cycles };
  }

  private async handleExecutionCompletion(taskId: string): Promise<CognitiveTaskRecord> {
    const afterVerify = await this.transition({
      taskId,
      to: "VERIFY",
      reason: "all_nodes_dispatched",
    });

    return await this.transition({
      taskId: afterVerify.id,
      to: "REFLECT",
      reason: "enter_reflection_after_verify",
    });
  }

  async runtimeSummary(taskId: string): Promise<CognitiveRuntimeSummary | null> {
    const record = await this.read(taskId);
    if (!record) return null;

    const queue = await queueStats(queueStoreDir(this.workspaceDir), taskId);
    let totalRetries = 0;
    let pendingBackoff = 0;
    let exhausted = 0;
    let activeDelegations = 0;
    let overdueDelegations = 0;
    const now = Date.now();

    for (const node of Object.values(record.tree.nodes)) {
      const retryCount =
        node.metadata && typeof node.metadata.retryCount === "number"
          ? node.metadata.retryCount
          : 0;
      if (retryCount > 0) {
        totalRetries += retryCount;
      }
      const nextRetryAt =
        node.metadata && typeof node.metadata.nextRetryAt === "number"
          ? node.metadata.nextRetryAt
          : undefined;
      if (typeof nextRetryAt === "number" && nextRetryAt > now) {
        pendingBackoff += 1;
      }
      if (node.status === "failed" && retryCount >= COGNITIVE_POLICY.MAX_RETRIES) {
        exhausted += 1;
      }
      if (node.status === "in_progress" && node.metadata?.dispatchMode === "subagent") {
        activeDelegations += 1;
        const leaseExpiresAt = metadataNumber(node.metadata, "leaseExpiresAt");
        if (leaseExpiresAt && leaseExpiresAt <= now) {
          overdueDelegations += 1;
        }
      }
    }

    const providerState = new Map<
      string,
      { lastModel?: string; success: number; failed: number }
    >();
    for (const event of queryCognitiveEvents({ taskId, stream: "runtime_dispatch", limit: 100 })) {
      const winner =
        event.payload && typeof event.payload === "object"
          ? (event.payload.winner as { provider?: string; model?: string } | undefined)
          : undefined;
      const provider = winner?.provider;
      if (!provider) continue;
      const slot = providerState.get(provider) ?? { success: 0, failed: 0 };
      if (typeof winner.model === "string") {
        slot.lastModel = winner.model;
      }
      if (event.payload.success === true) slot.success += 1;
      else slot.failed += 1;
      providerState.set(provider, slot);
    }

    const dreamEvents = queryCognitiveEvents({ taskId, stream: "dream_loop", limit: 1 });
    const providers = Array.from(providerState.entries()).map(([provider, state]) => ({
      provider,
      ...state,
    }));
    const architecture = projectCognitiveArchitecture({
      phase: record.status.phase,
      tree: record.tree,
      stateProjection: record.stateProjection,
      invariantReport: record.invariantReport,
      runCount: record.runIds.length,
      reflectionCount: record.reflections.length,
      memoryStrategyHits: record.memoryTrace?.evolutionStrategyHits.length ?? 0,
      providerCount: providers.length,
    });

    return {
      phase: record.status.phase,
      queue,
      retries: {
        total: totalRetries,
        pendingBackoff,
        exhausted,
      },
      delegations: {
        active: activeDelegations,
        overdue: overdueDelegations,
      },
      checkpoint: {
        lastRunId: record.runIds[record.runIds.length - 1],
        runCount: record.runIds.length,
      },
      dream: {
        ready: record.status.phase === "REFLECT",
        lastDreamAt: dreamEvents.at(-1)?.at,
      },
      replayCursor: record.runIds[record.runIds.length - 1] ?? null,
      providers,
      invariants: record.invariantReport,
      stateProjection: record.stateProjection,
      memoryTrace: record.memoryTrace,
      architecture,
    };
  }

  replay(taskId: string, runId: string, limit?: number) {
    return replayRun({ taskId, runId, limit });
  }
}
