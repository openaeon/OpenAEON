import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveStateDir: vi.fn(),
}));

vi.mock("../config/paths.js", () => ({
  resolveStateDir: mocks.resolveStateDir,
}));

describe("aeon-delivery-log metadata", () => {
  let stateDir = "";

  beforeEach(async () => {
    stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "openaeon-delivery-log-"));
    mocks.resolveStateDir.mockReturnValue(stateDir);
  });

  afterEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    if (stateDir) {
      await fs.rm(stateDir, { recursive: true, force: true });
    }
  });

  it("persists and returns execution metadata fields", async () => {
    const { recordDeliveryTransition, lookupDeliveryRecords } = await import("./aeon-delivery-log.js");
    await recordDeliveryTransition({
      runId: "run-1",
      sessionKey: "agent:main:main",
      pipelineType: "chat",
      laneType: "chat_lane",
      state: "persist_failed",
      reasonCode: "SAFETY_PAUSE",
      summary: "paused due to safety guardrail",
      fallback: true,
      fallbackReason: "WEB_SEARCH_UNAVAILABLE_BROWSER_FALLBACK",
      resumeReason: "auto_safe_resume",
      guardrail: {
        decision: "SOFT_WARN",
        severity: "medium",
        requiresHuman: false,
        triggerRule: "SAFETY_PAUSE",
      },
      pauseRecord: {
        severity: "medium",
        reason: "Risk profile requires safer execution plan.",
        triggerRule: "SAFETY_PAUSE",
        suggestedAction: "Continue with conservative patch path.",
        resumePoint: "chat.send",
        createdAt: Date.now(),
      },
    });
    const records = await lookupDeliveryRecords({
      runId: "run-1",
      sessionKey: "agent:main:main",
      pipelineType: "chat",
      limit: 10,
    });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      runId: "run-1",
      laneType: "chat_lane",
      fallback: true,
      fallbackReason: "WEB_SEARCH_UNAVAILABLE_BROWSER_FALLBACK",
      resumeReason: "auto_safe_resume",
      guardrail: {
        decision: "SOFT_WARN",
        severity: "medium",
        requiresHuman: false,
        triggerRule: "SAFETY_PAUSE",
      },
      pauseRecord: {
        severity: "medium",
        reason: "Risk profile requires safer execution plan.",
        triggerRule: "SAFETY_PAUSE",
        suggestedAction: "Continue with conservative patch path.",
        resumePoint: "chat.send",
      },
    });
  });
});
