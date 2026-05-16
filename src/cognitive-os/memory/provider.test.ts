import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CognitiveMemoryService } from "./service.js";

describe("CognitiveMemoryService provider lifecycle", () => {
  const workspaces: string[] = [];

  afterEach(async () => {
    await Promise.all(
      workspaces.map((workspace) => fs.rm(workspace, { recursive: true, force: true })),
    );
    workspaces.length = 0;
  });

  it("syncs turns and delegation observations through the default provider", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "openaeon-memory-provider-"));
    workspaces.push(workspace);
    const service = new CognitiveMemoryService(workspace);

    await service.initialize({ taskId: "task-1", sessionKey: "main" });
    await service.syncTurn({
      taskId: "task-1",
      runId: "run-1",
      sessionKey: "main",
      userContent: "Please implement",
      assistantContent: "Implemented with tests.",
    });
    await service.onDelegation({
      taskId: "task-1",
      runId: "run-2",
      childSessionKey: "agent:main:subagent:1",
      task: "Review implementation",
      result: "Review passed.",
    });

    const entries = await service.queryEvolution({ taskId: "task-1", limit: 10 });
    expect(entries.map((entry) => entry.runId)).toEqual(expect.arrayContaining(["run-1", "run-2"]));
    expect(entries.some((entry) => entry.tags.includes("delegation"))).toBe(true);
  });
});
