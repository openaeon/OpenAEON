import { Type } from "@sinclair/typebox";
import type { GatewayMessageChannel } from "../../utils/message-channel.js";
import { ACP_SPAWN_MODES, spawnAcpDirect } from "../acp-spawn.js";
import { optionalStringEnum } from "../schema/typebox.js";
import { SUBAGENT_SPAWN_MODES, spawnSubagentDirect } from "../subagent-spawn.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readStringParam } from "./common.js";

const SESSIONS_SPAWN_RUNTIMES = ["subagent", "acp"] as const;
const SESSIONS_SPAWN_SANDBOX_MODES = ["inherit", "require"] as const;

const SessionsSpawnToolSchema = Type.Object({
  task: Type.String(),
  label: Type.Optional(Type.String()),
  runtime: optionalStringEnum(SESSIONS_SPAWN_RUNTIMES),
  agentId: Type.Optional(Type.String()),
  model: Type.Optional(Type.String()),
  thinking: Type.Optional(Type.String()),
  cwd: Type.Optional(Type.String()),
  runTimeoutSeconds: Type.Optional(Type.Number({ minimum: 0 })),
  // Back-compat: older callers used timeoutSeconds for this tool.
  timeoutSeconds: Type.Optional(Type.Number({ minimum: 0 })),
  thread: Type.Optional(Type.Boolean()),
  mode: optionalStringEnum(SUBAGENT_SPAWN_MODES),
  cleanup: optionalStringEnum(["delete", "keep"] as const),
  sandbox: optionalStringEnum(SESSIONS_SPAWN_SANDBOX_MODES),
  tools: Type.Optional(
    Type.Array(Type.String(), {
      description: "Optional explicit list of tools to use, replacing the default policy.",
    }),
  ),
  skills: Type.Optional(
    Type.Array(Type.String(), {
      description: "Optional explicit list of skills to load, replacing the default policy.",
    }),
  ),
  /**
   * Whether to wait for the subagent to complete before returning.
   *
   * false (default): returns immediately with status="accepted"; the subagent
   *   runs in the background and its result is delivered asynchronously.
   *   Use this when spawning multiple subagents in parallel — call sessions_spawn
   *   multiple times and they will all run concurrently.
   *
   * true: blocks until the subagent finishes and returns completionText inline.
   *   Only use this when you need the result before proceeding (single sequential task).
   */
  wait: Type.Optional(Type.Boolean()),
  sharedContext: Type.Optional(
    Type.Record(Type.String(), Type.Unknown(), {
      description:
        "Optional JSON context to share state with the subagent, functioning as its initial memory.",
    }),
  ),
  role: optionalStringEnum(["manager", "worker"] as const),
  dialecticMode: Type.Optional(
    Type.Boolean({
      description:
        "Enable Dialectic Evolution: Spawns both Thesis & Antithesis agents and synthesizes a final result.",
    }),
  ),
});

export function createSessionsSpawnTool(opts?: {
  agentSessionKey?: string;
  agentChannel?: GatewayMessageChannel;
  agentAccountId?: string;
  agentTo?: string;
  agentThreadId?: string | number;
  agentGroupId?: string | null;
  agentGroupChannel?: string | null;
  agentGroupSpace?: string | null;
  sandboxed?: boolean;
  /** Explicit agent ID override for cron/hook sessions where session key parsing may not work. */
  requesterAgentIdOverride?: string;
  /** Multi-agent Cognitive Loop Fusion: current recursive iteration depth */
  iterationDepth?: number;
  /** Authorized Freedom Mode: bypass or scale standard limits */
  freedom?: boolean;
}): AnyAgentTool {
  return {
    label: "Sessions",
    name: "sessions_spawn",
    description:
      'Spawn an isolated session (runtime="subagent" or runtime="acp"). mode="run" is one-shot and mode="session" is persistent/thread-bound.',
    parameters: SessionsSpawnToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;

      // Defensive guard: if args are empty or task is missing, return a clear error.
      if (!params || typeof params !== "object" || !("task" in params)) {
        throw new Error(
          `Missing required parameter 'task'. You must provide a task description for the subagent.\n` +
            `Example: { "task": "Research NVIDIA's latest GPU products and summarize findings", "label": "nvidia-research" }\n` +
            `Parameters: task (required), label, runtime (subagent|acp), model, agentId, runTimeoutSeconds`,
        );
      }

      const task = readStringParam(params, "task", { required: true });

      const label = typeof params.label === "string" ? params.label.trim() : "";
      const runtime = params.runtime === "acp" ? "acp" : "subagent";
      const requestedAgentId = readStringParam(params, "agentId");
      const modelOverride = readStringParam(params, "model");
      const thinkingOverrideRaw = readStringParam(params, "thinking");
      const cwd = readStringParam(params, "cwd");
      const mode = params.mode === "run" || params.mode === "session" ? params.mode : undefined;
      const cleanup =
        params.cleanup === "keep" || params.cleanup === "delete" ? params.cleanup : "keep";
      const sandbox = params.sandbox === "require" ? "require" : "inherit";
      // Back-compat: older callers used timeoutSeconds for this tool.
      const timeoutSecondsCandidate =
        typeof params.runTimeoutSeconds === "number"
          ? params.runTimeoutSeconds
          : typeof params.timeoutSeconds === "number"
            ? params.timeoutSeconds
            : undefined;
      const runTimeoutSeconds =
        typeof timeoutSecondsCandidate === "number" && Number.isFinite(timeoutSecondsCandidate)
          ? Math.max(0, Math.floor(timeoutSecondsCandidate))
          : undefined;
      const thread = params.thread === true;
      // wait=false (default): fire & forget — the subagent runs in the background
      // and delivers its result asynchronously. Use this to launch parallel subagents.
      // wait=true: block until the subagent finishes and return completionText inline.
      const wait = params.wait === true;
      const tools =
        Array.isArray(params.tools) && params.tools.every((t) => typeof t === "string")
          ? params.tools
          : undefined;
      const skills =
        Array.isArray(params.skills) && params.skills.every((t) => typeof t === "string")
          ? params.skills
          : undefined;

      const subagentSpawnParams = {
        sharedContext:
          params.sharedContext && typeof params.sharedContext === "object"
            ? (params.sharedContext as Record<string, unknown>)
            : undefined,
        role: (params.role === "manager" || params.role === "worker" ? params.role : undefined) as
          | "manager"
          | "worker"
          | undefined,
        dialecticMode: !!params.dialecticMode,
      };

      const result =
        runtime === "acp"
          ? await spawnAcpDirect(
              {
                task,
                label: label || undefined,
                agentId: requestedAgentId,
                cwd,
                mode: mode && ACP_SPAWN_MODES.includes(mode) ? mode : undefined,
                thread,
              },
              {
                agentSessionKey: opts?.agentSessionKey,
                agentChannel: opts?.agentChannel,
                agentAccountId: opts?.agentAccountId,
                agentTo: opts?.agentTo,
                agentThreadId: opts?.agentThreadId,
              },
            )
          : await spawnSubagentDirect(
              {
                task,
                label: label || undefined,
                agentId: requestedAgentId,
                model: modelOverride,
                thinking: thinkingOverrideRaw,
                runTimeoutSeconds,
                thread,
                mode,
                cleanup,
                sandbox,
                expectsCompletionMessage: wait,
                skills,
                ...subagentSpawnParams,
              },
              {
                agentSessionKey: opts?.agentSessionKey,
                agentChannel: opts?.agentChannel,
                agentAccountId: opts?.agentAccountId,
                agentTo: opts?.agentTo,
                agentThreadId: opts?.agentThreadId,
                agentGroupId: opts?.agentGroupId,
                agentGroupChannel: opts?.agentGroupChannel,
                agentGroupSpace: opts?.agentGroupSpace,
                requesterAgentIdOverride: opts?.requesterAgentIdOverride,
                iterationDepth: opts?.iterationDepth,
                freedom: opts?.freedom,
              },
            );

      if (result.status === "accepted" && "completionText" in result && result.completionText) {
        return jsonResult({
          status: result.status,
          childSessionKey: result.childSessionKey,
          runId: result.runId,
          mode: result.mode,
          note: result.note,
          modelApplied: "modelApplied" in result ? result.modelApplied : undefined,
          completionText: result.completionText,
        });
      }

      return jsonResult(result);
    },
  };
}
