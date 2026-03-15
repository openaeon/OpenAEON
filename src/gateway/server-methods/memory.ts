import fs from "node:fs/promises";
import path from "node:path";
import { resolveAgentWorkspaceDir } from "../../agents/agent-scope.js";
import { movePathToTrash } from "../../browser/trash.js";
import { loadConfig } from "../../config/config.js";
import { isNotFoundPathError } from "../../infra/path-guards.js";
import { DEFAULT_AGENT_ID, normalizeAgentId } from "../../routing/session-key.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateAgentsMemoryDeleteParams,
  validateAgentsMemoryGetParams,
  validateAgentsMemoryListParams,
  validateAgentsMemorySetParams,
  validateAgentsMemoryStatusParams,
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import { buildFileEntry, listMemoryFiles } from "../../memory/internal.js";
import { getMemorySearchManager } from "../../memory/index.js";

function resolveAgentId(agentIdRaw: string, cfg: ReturnType<typeof loadConfig>) {
  if (agentIdRaw === "default") {
    return normalizeAgentId(DEFAULT_AGENT_ID) || DEFAULT_AGENT_ID;
  }
  return normalizeAgentId(agentIdRaw);
}

function resolveAgentContext(rawAgentId: unknown) {
  const cfg = loadConfig();
  const idStr = typeof rawAgentId === "string" ? rawAgentId : "";
  const agentId = resolveAgentId(idStr, cfg);
  if (!agentId) {
    return null;
  }
  const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
  return { cfg, agentId, workspaceDir };
}

function resolveMemoryIoPath(
  workspaceDir: string,
  reqPath: string,
): { target: string; rel: string } | null {
  const target = path.resolve(workspaceDir, reqPath);
  if (!target.endsWith(".md")) {
    return null;
  }
  // Ensure it's inside the workspace
  const rel = path.relative(workspaceDir, target).replace(/\\/g, "/");
  if (rel.startsWith("../") || path.isAbsolute(rel)) {
    return null;
  }
  if (
    rel === "MEMORY.md" ||
    rel === "memory.md" ||
    rel === "LOGIC_GATES.md" ||
    rel === "logic_gates.md" ||
    rel.startsWith("memory/")
  ) {
    return { target, rel };
  }
  return null;
}

export const memoryHandlers: GatewayRequestHandlers = {
  "agents.memory.list": async ({ params, respond }) => {
    if (!validateAgentsMemoryListParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid params: ${formatValidationErrors(validateAgentsMemoryListParams.errors)}`,
        ),
      );
      return;
    }

    const context = resolveAgentContext(params.agentId);
    if (!context) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown agent id"));
      return;
    }

    const { agentId, workspaceDir } = context;
    const absPaths = await listMemoryFiles(workspaceDir);

    const files = [];
    for (const p of absPaths) {
      const entry = await buildFileEntry(p, workspaceDir);
      if (entry) {
        files.push({
          name: path.relative(workspaceDir, entry.absPath).replace(/\\/g, "/"),
          path: path.relative(workspaceDir, entry.absPath).replace(/\\/g, "/"),
          missing: false,
          size: entry.size,
          updatedAtMs: entry.mtimeMs,
        });
      }
    }

    respond(true, {
      agentId,
      workspaceDir,
      files,
    });
  },

  "agents.memory.get": async ({ params, respond }) => {
    if (!validateAgentsMemoryGetParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          formatValidationErrors(validateAgentsMemoryGetParams.errors),
        ),
      );
      return;
    }

    const context = resolveAgentContext(params.agentId);
    if (!context) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown agent id"));
      return;
    }

    const { agentId, workspaceDir } = context;
    const resolved = resolveMemoryIoPath(workspaceDir, params.name);
    if (!resolved) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid memory file path"));
      return;
    }

    const entry = await buildFileEntry(resolved.target, workspaceDir);
    if (!entry) {
      // Missing
      respond(true, {
        agentId,
        workspaceDir,
        file: {
          name: resolved.rel,
          path: resolved.rel,
          missing: true,
        },
      });
      return;
    }

    let content = "";
    try {
      content = await fs.readFile(resolved.target, "utf-8");
    } catch (err) {
      if (!isNotFoundPathError(err)) {
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "failed to read file"));
        return;
      }
    }

    respond(true, {
      agentId,
      workspaceDir,
      file: {
        name: resolved.rel,
        path: resolved.rel,
        missing: false,
        size: entry.size,
        updatedAtMs: entry.mtimeMs,
        content,
      },
    });
  },

  "agents.memory.set": async ({ params, respond }) => {
    if (!validateAgentsMemorySetParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          formatValidationErrors(validateAgentsMemorySetParams.errors),
        ),
      );
      return;
    }

    const context = resolveAgentContext(params.agentId);
    if (!context) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown agent id"));
      return;
    }

    const { agentId, workspaceDir } = context;
    const resolved = resolveMemoryIoPath(workspaceDir, params.name);
    if (!resolved) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid memory file path"));
      return;
    }

    if (resolved.rel.startsWith("memory/")) {
      await fs.mkdir(path.join(workspaceDir, "memory"), { recursive: true });
    }

    await fs.writeFile(resolved.target, params.content, "utf-8");

    const entry = await buildFileEntry(resolved.target, workspaceDir);
    if (!entry) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "failed to stat written file"));
      return;
    }

    respond(true, {
      ok: true,
      agentId,
      workspaceDir,
      file: {
        name: resolved.rel,
        path: resolved.rel,
        missing: false,
        size: entry.size,
        updatedAtMs: entry.mtimeMs,
        content: params.content,
      },
    });
  },

  "agents.memory.delete": async ({ params, respond }) => {
    if (!validateAgentsMemoryDeleteParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          formatValidationErrors(validateAgentsMemoryDeleteParams.errors),
        ),
      );
      return;
    }

    const context = resolveAgentContext(params.agentId);
    if (!context) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown agent id"));
      return;
    }

    const { agentId, workspaceDir } = context;
    const resolved = resolveMemoryIoPath(workspaceDir, params.name);
    if (!resolved) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid memory file path"));
      return;
    }

    try {
      await movePathToTrash(resolved.target);
    } catch (err) {
      if (!isNotFoundPathError(err)) {
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "failed to delete file"));
        return;
      }
    }

    respond(true, {
      ok: true,
      agentId,
      name: resolved.rel,
    });
  },

  "agents.memory.status": async ({ params, respond }) => {
    if (!validateAgentsMemoryStatusParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          formatValidationErrors(validateAgentsMemoryStatusParams.errors),
        ),
      );
      return;
    }

    const context = resolveAgentContext(params.agentId);
    if (!context) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown agent id"));
      return;
    }

    const { cfg, agentId } = context;

    // Get memory status
    const { manager } = await getMemorySearchManager({ cfg, agentId });
    let totalChunks = 0;
    let totalVectors = 0;

    if (manager) {
      try {
        const status = await manager.status();
        totalChunks = status.chunks ?? 0;
        totalVectors = status.chunks ?? 0;
      } catch (err) {
        console.error(`Failed to get memory stats for agent ${agentId}:`, err);
      }
    }

    respond(true, {
      agentId,
      status: {
        totalChunks,
        totalVectors,
      },
    });
  },
};
