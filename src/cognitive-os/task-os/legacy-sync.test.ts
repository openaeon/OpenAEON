import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../agents/tools/task-planner-tool.js", () => ({
  loadTaskPlan: vi.fn(),
  saveTaskPlan: vi.fn(),
}));

vi.mock("../../agents/session-write-lock.js", () => ({
  acquireSessionWriteLock: vi.fn().mockResolvedValue({
    release: vi.fn().mockResolvedValue(undefined),
  }),
}));

import { syncCognitiveToLegacy } from "./legacy-sync.js";
import { loadTaskPlan, saveTaskPlan } from "../../agents/tools/task-planner-tool.js";

describe("Cognitive to Legacy synchronization", () => {
  it("should map a cognitive record to a legacy task plan correctly", async () => {
    const workspaceDir = path.join(process.cwd(), "tmp", "test-workspace-" + Date.now());
    const mockRecord: any = {
      id: "cognitive-123",
      sessionKey: "test-session",
      input: "Build a feature",
      status: {
        phase: "PLAN",
        legacyPhase: "planning",
        updatedAt: Date.now(),
      },
      tree: {
        rootId: "node-1",
        nodes: {
          "node-1": {
            id: "node-1",
            title: "Plan Architecture",
            status: "done",
            dependsOn: [],
            children: [],
            acceptanceCriteria: ["Design doc reviewed"],
            artifacts: ["run:123"],
          },
          "node-2": {
            id: "node-2",
            title: "Implement Core",
            status: "in_progress",
            dependsOn: ["node-1"],
            children: [],
            acceptanceCriteria: ["Unit tests pass"],
            artifacts: [],
          },
        },
      },
    };

    vi.mocked(loadTaskPlan).mockResolvedValue({
      description: "",
      todos: [],
      phase: "planning",
    });

    await syncCognitiveToLegacy(workspaceDir, mockRecord);

    expect(saveTaskPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        targetSessionKey: "test-session",
        plan: expect.objectContaining({
          description: "Build a feature",
          phase: "planning",
          todos: expect.arrayContaining([
            expect.objectContaining({
              id: "node-1",
              title: "Plan Architecture",
              status: "done",
            }),
            expect.objectContaining({
              id: "node-2",
              title: "Implement Core",
              status: "in_progress",
              dependsOn: ["node-1"],
            }),
          ]),
        }),
      }),
    );
  });
});
