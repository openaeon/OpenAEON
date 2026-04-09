import { Type } from "@sinclair/typebox";
import type { GatewayMessageChannel } from "../../utils/message-channel.js";
import { spawnSubagentDirect } from "../subagent-spawn.js";
import { optionalStringEnum } from "../schema/typebox.js";
import type { TodoItem } from "./task-planner-tool.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readStringParam } from "./common.js";
import fs from "node:fs/promises";
import path from "node:path";

const SessionsEvaluateToolSchema = Type.Object({
  mode: optionalStringEnum(["reflector", "closure"] as const),
  originalTask: Type.Optional(
    Type.String({
      description: "The original task goal that was given to the worker agent.",
    }),
  ),
  workerResult: Type.Optional(
    Type.String({
      description: "The result output by the worker agent that needs evaluation.",
    }),
  ),
  context: Type.Optional(
    Type.String({
      description:
        "Any additional context required for the evaluation (e.g. error logs, git diffs).",
    }),
  ),
  agentId: Type.Optional(
    Type.String({
      description:
        "The ID of the specialized reflector agent (default uses standard reasoning model).",
    }),
  ),
  model: Type.Optional(
    Type.String({ description: "Model override, ideally a strong reasoning model (e.g. R1)." }),
  ),
  runTimeoutSeconds: Type.Optional(Type.Number({ minimum: 0 })),
  planId: Type.Optional(Type.String({ description: "Planner session key for closure mode." })),
  todos: Type.Optional(
    Type.Array(Type.Any(), { description: "Optional todo list for closure mode." }),
  ),
});

function evaluateClosureTodos(todos: TodoItem[]) {
  const failed: string[] = [];
  const missingEvidence: string[] = [];
  const nextActions: string[] = [];
  let passed = true;

  for (const todo of todos) {
    if (!Array.isArray(todo.acceptance) || todo.acceptance.length === 0) {
      failed.push(`${todo.id}:missing_acceptance`);
      nextActions.push(`补充 ${todo.id} 的 acceptance`);
      passed = false;
    }
    if (!Array.isArray(todo.evidenceRefs) || todo.evidenceRefs.length === 0) {
      missingEvidence.push(todo.id);
      nextActions.push(`补充 ${todo.id} 的 evidenceRefs`);
      passed = false;
    }
    if (!todo.result?.trim()) {
      failed.push(`${todo.id}:missing_result`);
      nextActions.push(`补充 ${todo.id} 的 result`);
      passed = false;
    }
    if (todo.status !== "verified" && todo.status !== "closed") {
      failed.push(`${todo.id}:not_verified`);
      nextActions.push(`将 ${todo.id} 推进到 verified`);
      passed = false;
    }
  }

  return {
    passed,
    failed: Array.from(new Set(failed)),
    missingEvidence: Array.from(new Set(missingEvidence)),
    nextActions: Array.from(new Set(nextActions)),
  };
}

export function createSessionsEvaluateTool(opts?: {
  agentSessionKey?: string;
  agentChannel?: GatewayMessageChannel;
  agentAccountId?: string;
  agentTo?: string;
  agentThreadId?: string | number;
  workspaceDir?: string;
}): AnyAgentTool {
  return {
    label: "Evaluate",
    name: "sessions_evaluate",
    description:
      "Spawn a specialized Reflector Agent (Critic) to evaluate the result of another agent against its original goal. Used to implement the Z² step in the Cognitive Loop (Z⇌Z²+C).",
    parameters: SessionsEvaluateToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const mode = readStringParam(params, "mode") || "reflector";

      if (mode === "closure") {
        const suppliedTodos = Array.isArray(params.todos)
          ? (params.todos as TodoItem[])
          : undefined;
        let todos = suppliedTodos;
        if (!todos) {
          const planId = readStringParam(params, "planId") || opts?.agentSessionKey || "default";
          const workspaceDir = opts?.workspaceDir ?? process.cwd();
          const plannerFile = path.join(
            workspaceDir,
            ".openaeon",
            "planner",
            `${planId.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`,
          );
          const raw = JSON.parse(await fs.readFile(plannerFile, "utf-8")) as {
            todos?: TodoItem[];
          };
          todos = Array.isArray(raw.todos) ? raw.todos : [];
        }

        const report = evaluateClosureTodos(todos);
        return jsonResult({
          status: "evaluated",
          mode: "closure",
          report,
        });
      }

      const originalTask = readStringParam(params, "originalTask", { required: true });
      const workerResult = readStringParam(params, "workerResult", { required: true });
      const context = readStringParam(params, "context") || "None provided.";

      const requestedAgentId = readStringParam(params, "agentId");
      const modelOverride = readStringParam(params, "model");

      const timeoutSecondsCandidate =
        typeof params.runTimeoutSeconds === "number" ? params.runTimeoutSeconds : undefined;
      const runTimeoutSeconds =
        typeof timeoutSecondsCandidate === "number" && Number.isFinite(timeoutSecondsCandidate)
          ? Math.max(0, Math.floor(timeoutSecondsCandidate))
          : undefined;

      const evaluationTask = `You are a strict Actor-Critic Evaluator (Reflector Agent Z²). 
Your ONLY purpose is to evaluate the provided Worker Result against the Original Task.

<original_task>\n${originalTask}\n</original_task>

<worker_result>\n${workerResult}\n</worker_result>

<additional_context>\n${context}\n</additional_context>

Instructions:
1. Determine if the worker successfully completed the original task.
2. If it succeeded, output a <pass> tag with a short justification.
3. If it failed, diverged, or caused issues, output a <reject> tag and provide a detailed Correction Plan (C) so the worker can retry properly.`;

      const result = await spawnSubagentDirect(
        {
          task: evaluationTask,
          label: "reflector-agent",
          agentId: requestedAgentId,
          model: modelOverride,
          runTimeoutSeconds,
          thread: false,
          cleanup: "delete",
          sandbox: "inherit",
          expectsCompletionMessage: true, // Wait for the evaluation to finish
        },
        {
          agentSessionKey: opts?.agentSessionKey,
          agentChannel: opts?.agentChannel,
          agentAccountId: opts?.agentAccountId,
          agentTo: opts?.agentTo,
          agentThreadId: opts?.agentThreadId,
        },
      );

      if (result.status !== "accepted" || !result.completionText) {
        return jsonResult({
          status: "eval_spawn_error",
          error: result.error || "Reflector Agent failed to return a proper completion.",
        });
      }

      return jsonResult({
        status: "evaluated",
        evaluation: result.completionText,
      });
    },
  };
}
