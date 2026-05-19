import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildDelegationPolicyPrompt,
  resolveCognitiveDelegationPolicy,
} from "./delegation-policy.js";
import { CognitiveAgentLoop } from "./agent-loop.js";
import {
  defaultModelForProvider,
  resolveCognitiveProviderRuntime,
} from "./provider-runtime-resolver.js";
import {
  getRoleDefaultToolsets,
  listCognitiveToolsets,
  resolveCognitiveToolAccess,
} from "./tool-registry.js";
import { dispatchAgentTask } from "./dispatcher.js";
import {
  getCognitiveSqliteStore,
  resetCognitiveSqliteStoreForTests,
} from "../store/sqlite-store.js";

vi.mock("./dispatcher.js", () => ({
  dispatchAgentTask: vi.fn(),
}));

describe("Cognitive runtime contracts", () => {
  const workspaces: string[] = [];

  afterEach(async () => {
    resetCognitiveSqliteStoreForTests();
    await Promise.all(
      workspaces.map((workspace) => fs.rm(workspace, { recursive: true, force: true })),
    );
    workspaces.length = 0;
    vi.clearAllMocks();
  });

  it("normalizes delegation policy limits and blocked tools", () => {
    const policy = resolveCognitiveDelegationPolicy({
      maxConcurrentChildren: 99,
      maxDepth: 0,
      blockedTools: ["custom_danger"],
    });

    expect(policy.maxConcurrentChildren).toBe(8);
    expect(policy.maxDepth).toBe(1);
    expect(policy.blockedTools).toEqual(
      expect.arrayContaining(["sessions_spawn", "custom_danger"]),
    );
    expect(policy.allowedTools).toEqual(expect.arrayContaining(["read_file", "search_files"]));
    expect(policy.deniedTools).toEqual(expect.arrayContaining(["sessions_spawn"]));
    expect(buildDelegationPolicyPrompt(policy)).toContain("Max concurrent child agents");
    expect(buildDelegationPolicyPrompt(policy)).toContain("Allowed tools");
  });

  it("resolves role-scoped toolsets into hard tool access", () => {
    expect(getRoleDefaultToolsets("OpsAgent")).toContain("database");
    expect(listCognitiveToolsets().some((toolset) => toolset.name === "terminal")).toBe(true);

    const salesAccess = resolveCognitiveToolAccess({
      role: "SalesAgent",
      requestedToolsets: ["terminal", "database", "web"],
      blockedTools: ["browser_open"],
    });

    expect(salesAccess.allowedTools).not.toContain("terminal");
    expect(salesAccess.allowedTools).not.toContain("database_query");
    expect(salesAccess.allowedTools).not.toContain("browser_open");
    expect(salesAccess.deniedTools).toEqual(
      expect.arrayContaining(["terminal", "database_query", "browser_open"]),
    );
  });

  it("resolves provider runtime metadata from provider names", () => {
    expect(defaultModelForProvider("gpt")).toBe("gpt-5.4");
    expect(resolveCognitiveProviderRuntime({ provider: "claude" })).toEqual(
      expect.objectContaining({
        provider: "claude",
        model: "claude-opus-4.1",
        apiMode: "anthropic_messages",
      }),
    );
  });

  it("records cognitive agent loop runs for replayable runtime search", async () => {
    const workspace = path.join(os.tmpdir(), `openaeon-loop-${Date.now()}`);
    workspaces.push(workspace);
    vi.mocked(dispatchAgentTask).mockResolvedValue({
      winner: {
        provider: "gpt",
        model: "gpt-5.4",
        output: "completed retrieval bridge with evidence",
        score: 0.92,
        reason: "test",
        latencyMs: 12,
        evidence: ["artifact:bridge"],
      },
      candidates: [
        {
          provider: "gpt",
          model: "gpt-5.4",
          output: "completed retrieval bridge with evidence",
          score: 0.92,
          reason: "test",
          latencyMs: 12,
          evidence: ["artifact:bridge"],
        },
      ],
      degraded: false,
    });

    const result = await new CognitiveAgentLoop(workspace).run({
      taskId: "task-loop",
      nodeId: "node-loop",
      role: "DevAgent",
      prompt: "Build retrieval bridge",
      providers: ["gpt"],
      timeoutMs: 1_000,
      source: "cognitive_dispatch",
      sessionKey: "main",
    });

    expect(result.loopRunId).toContain("task-loop:node-loop:loop");
    expect(result.memorySynced).toBe(true);
    expect(result.turns).toHaveLength(1);
    const store = getCognitiveSqliteStore(workspace);
    expect(store?.search("retrieval-bridge", 10).some((row) => row.kind === "agent_loop")).toBe(
      true,
    );
  });
});
