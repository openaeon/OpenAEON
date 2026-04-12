import crypto from "node:crypto";
import path from "node:path";
import type {
  CognitiveTaskPhase,
  CognitiveTaskStatus,
  LegacyTaskPlanPhase,
} from "../contracts/types.js";
import { withFileLock } from "../../infra/file-lock.js";
import { decomposeTaskFractally, expandNodeFractally } from "../cognition/fractal-decomposer.js";
import { CognitionService } from "../cognition/service.js";
import { CognitiveMemoryService } from "../memory/service.js";
import { publishCognitiveEvent } from "../observability/event-bus.js";
import { replayRun } from "../observability/replay.js";
import { dispatchAgentTask } from "../runtime/dispatcher.js";
import { mapCognitiveToLegacy } from "./phase-mapping.js";
import { applyTransition } from "./state-machine.js";
import { listTaskRecords, readTaskRecord, taskLockFile, writeTaskRecord } from "./store.js";
import type { CognitiveTaskRecord } from "./types.js";
import { syncCognitiveToLegacy } from "./legacy-sync.js";
import { COGNITIVE_POLICY } from "./policy.js";
import { buildHilbertSortedContext } from "../cognition/context-builder.js";

function statusFor(phase: CognitiveTaskPhase, reason?: string): CognitiveTaskStatus {
  return {
    phase,
    legacyPhase: mapCognitiveToLegacy(phase),
    reason,
    updatedAt: Date.now(),
  };
}

function taskStoreDir(workspaceDir: string): string {
  return path.join(workspaceDir, ".openaeon", "cognitive", "tasks");
}

export class TaskOrchestrator {
  private readonly cognition: CognitionService;
  private readonly memory: CognitiveMemoryService;
  private pollingTimer?: NodeJS.Timeout;
  private readonly activeTaskIds = new Set<string>();
  private globalDispatchCount = 0;

  constructor(private readonly workspaceDir: string) {
    this.cognition = new CognitionService();
    this.memory = new CognitiveMemoryService(workspaceDir);
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
        this.activeTaskIds.add(record.id);
      }
    }
    console.info(`[TaskOrchestrator] Resuming ${this.activeTaskIds.size} active tasks.`);
    this.startPolling();
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

        if (record.status.phase === "EXECUTE") {
          const readyCount = this.countReadyNodes(record);
          if (readyCount > 0) {
            const batchSize = Math.min(readyCount, caps - this.globalDispatchCount, 3);
            if (batchSize > 0) {
              this.executeReadyNodes(taskId).catch((err) =>
                console.error(`[TaskOrchestrator] execution error for ${taskId}: ${err}`),
              );
            }
          }
        }
      } catch (err) {
        console.error(`[TaskOrchestrator] Failed to tick task ${taskId}: ${err}`);
      }
    }
  }

  private countReadyNodes(record: CognitiveTaskRecord): number {
    let count = 0;
    const allNodes = Object.values(record.tree.nodes);
    const todoNodes = allNodes.filter((n) => n.status === "todo");
    for (const node of todoNodes) {
      const depsReady = node.dependsOn.every(
        (depId) => record.tree.nodes[depId]?.status === "done",
      );
      if (depsReady) {
        count += 1;
      }
    }
    return count;
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
      await this.persistAndSync(updated);
      return result;
    });
  }

  private async persistAndSync(record: CognitiveTaskRecord): Promise<void> {
    await writeTaskRecord(taskStoreDir(this.workspaceDir), record);
    try {
      await syncCognitiveToLegacy(this.workspaceDir, record);
    } catch (err) {
      console.warn(`[TaskOrchestrator] Failed to sync to legacy planner: ${err}`);
    }
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
      await this.persistAndSync(record);
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
    syncLegacyPhase?: LegacyTaskPlanPhase;
  }): Promise<CognitiveTaskRecord> {
    return await this.withLockedRecord(input.taskId, async (current) => {
      const nextPhase = applyTransition(current.status.phase, input.to);
      const legacyPhase = input.syncLegacyPhase ?? mapCognitiveToLegacy(nextPhase);

      const next: CognitiveTaskRecord = {
        ...current,
        status: {
          phase: nextPhase,
          legacyPhase,
          reason: input.reason,
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
          legacyPhase: next.status.legacyPhase,
          reason: input.reason,
        },
      });

      return { record: next, result: next };
    });
  }

  async executeReadyNodes(taskId: string): Promise<CognitiveTaskRecord[]> {
    const readyNodeIds: string[] = [];

    const record = await this.read(taskId);
    if (!record || record.status.phase !== "EXECUTE") {
      return [];
    }

    let gaps: string[] = [];
    let severity = 0;
    try {
      const { diagnoseCognitiveGap } = await import("../../gateway/server-evolution.js");
      ({ gaps, severity } = diagnoseCognitiveGap({ sessionKey: record.sessionKey }));
    } catch (error) {
      console.warn(
        `[TaskOrchestrator] Cognitive gap diagnosis unavailable for ${record.sessionKey}: ${String(error)}`,
      );
    }
    if (severity > 0.5) {
      console.warn(
        `[TaskOrchestrator] Cognitive Gap Detected: ${gaps.join(", ")} (severity: ${severity}). Triggering Emergency Re-plan.`,
      );
      await this.transition({
        taskId,
        to: "PLAN",
        reason: `emergency_replan_due_to_gap:${gaps[0]}`,
        syncLegacyPhase: "planning",
      });
      return [record];
    }

    const allNodes = Object.values(record.tree.nodes);
    const todoNodes = allNodes.filter((n) => n.status === "todo");

    for (const node of todoNodes) {
      const depsReady = node.dependsOn.every(
        (depId) => record.tree.nodes[depId]?.status === "done",
      );
      if (depsReady) {
        readyNodeIds.push(node.id);
      }
    }

    if (readyNodeIds.length === 0) {
      const allDone = allNodes.every((n) => n.status === "done" || n.status === "failed");
      if (allDone) {
        await this.handleExecutionCompletion(taskId);
      }
      return [record];
    }

    const batch = readyNodeIds.slice(0, 3);
    return await Promise.all(batch.map((nodeId) => this.dispatchNode(taskId, nodeId)));
  }

  private async dispatchNode(taskId: string, nodeId: string): Promise<CognitiveTaskRecord> {
    const runId = crypto.randomUUID();

    const workingRecord = await this.withLockedRecord(taskId, async (record) => {
      const node = record.tree.nodes[nodeId];
      if (!node || node.status !== "todo") {
        return { record, result: record };
      }

      const updatedNode = { ...node, status: "in_progress" as const };
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
      const node = workingRecord.tree.nodes[nodeId];
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
            metadata: { ...currentNode.metadata, decomposed: true },
          };
        } else {
          updatedNodes[nodeId] = {
            ...currentNode,
            status: success ? "done" : "failed",
            artifacts: success
              ? [...currentNode.artifacts, `run:${runId}`, `model:${dispatchResult.winner.model}`]
              : currentNode.artifacts,
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
          payload: { nodeId, success, shouldDecompose, winner: dispatchResult.winner },
        });

        return { record: nextRecord, result: nextRecord };
      });
    } catch (error) {
      return await this.withLockedRecord(taskId, async (record) => {
        const currentNode = record.tree.nodes[nodeId];
        if (!currentNode) {
          return { record, result: record };
        }

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
              [nodeId]: { ...currentNode, status: "failed" },
            },
          },
          updatedAt: Date.now(),
        };

        publishCognitiveEvent({
          stream: "runtime_dispatch_error",
          taskId,
          runId,
          payload: { nodeId, error: String(error) },
        });

        return { record: nextRecord, result: nextRecord };
      });
    } finally {
      this.globalDispatchCount = Math.max(0, this.globalDispatchCount - 1);
    }
  }

  async dispatchNextReadyNode(taskId: string): Promise<CognitiveTaskRecord> {
    const record = await this.read(taskId);
    if (!record) {
      throw new Error(`task not found: ${taskId}`);
    }

    if (record.status.phase === "PLAN") {
      return await this.transition({ taskId, to: "EXECUTE", reason: "manual_dispatch_from_plan" });
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

    return await this.transition({ taskId, to: "DONE", reason: "dream_distillation_completed" });
  }

  async runDemoFlow(input: {
    sessionKey: string;
    title?: string;
    text: string;
    maxDispatchCycles?: number;
  }): Promise<{ task: CognitiveTaskRecord; cycles: number }> {
    const created = await this.submit(input);
    await this.transition({
      taskId: created.id,
      to: "EXECUTE",
      reason: "demo_enter_execute",
    });

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

  replay(taskId: string, runId: string, limit?: number) {
    return replayRun({ taskId, runId, limit });
  }
}
