import { beforeEach, describe, expect, it, vi } from "vitest";
import { runCronIsolatedAgentTurn } from "./run.js";
import type { OPENAEONConfig } from "../../config/config.js";
import type { CronJob } from "../types.js";
import { runEmbeddedPiAgent } from "../../agents/pi-embedded.js";

vi.mock("../../agents/pi-embedded.js", () => ({
  runEmbeddedPiAgent: vi.fn(),
}));

describe("runCronIsolatedAgentTurn preamble", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("injects proactive AI employee preamble and memory instructions", async () => {
    const cfg = {} as OPENAEONConfig;
    const deps = {} as any;
    const job: CronJob = {
      id: "test-job-id",
      name: "test job",
      enabled: true,
      schedule: { kind: "at", at: new Date().toISOString() },
      sessionTarget: "isolated",
      wakeMode: "now",
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      payload: {
        kind: "agentTurn",
        message: "run my test task",
      },
      state: {},
    };

    const runEmbeddedPiAgentMock = vi.mocked(runEmbeddedPiAgent).mockResolvedValue({
      status: "ok",
      payloads: [{ text: "done" }],
    } as any);

    await runCronIsolatedAgentTurn({
      cfg,
      deps,
      job,
      message: "run my test task",
      sessionKey: "cron:test-job-id",
    });

    expect(runEmbeddedPiAgentMock).toHaveBeenCalledTimes(1);
    const callArgs = runEmbeddedPiAgentMock.mock.calls[0][0];

    // Check that the commandBody/prompt was injected correctly
    expect(callArgs.prompt).toContain("[Scheduled Task Context]");
    expect(callArgs.prompt).toContain(
      "You are an AI employee executing a scheduled background task.",
    );
    expect(callArgs.prompt).toContain("- Memory-First: If you need state/context");
    expect(callArgs.prompt).toContain("run my test task");
  });
});
