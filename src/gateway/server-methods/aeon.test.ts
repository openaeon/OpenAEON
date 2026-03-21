import { describe, expect, it, vi } from "vitest";
import type { GatewayRequestContext } from "./types.js";

const mocks = vi.hoisted(() => ({
  stat: vi.fn(),
  readFile: vi.fn(),
  getSystemStatus: vi.fn(),
  loadConfig: vi.fn(),
  loadPlanDigest: vi.fn(),
  lookupDeliveryRecords: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  default: {
    stat: mocks.stat,
    readFile: mocks.readFile,
  },
}));

vi.mock("../../agents/tools/system-status-tool.js", () => ({
  getSystemStatus: mocks.getSystemStatus,
}));

vi.mock("../../config/config.js", () => ({
  loadConfig: mocks.loadConfig,
}));

vi.mock("../../agents/planner-context.js", () => ({
  loadPlanDigest: mocks.loadPlanDigest,
}));

vi.mock("../aeon-delivery-log.js", () => ({
  lookupDeliveryRecords: mocks.lookupDeliveryRecords,
}));

vi.mock("../../agents/pi-embedded-runner/runs.js", () => ({
  getActiveEmbeddedRunHandle: () => null,
}));

vi.mock("../../agents/agent-scope.js", () => ({
  resolveSessionAgentId: () => "main",
}));

vi.mock("../../agents/tools/memory-distill-tool.js", () => ({
  distillMemory: vi.fn().mockResolvedValue({ status: "no-change" }),
  readMemoryDistillState: vi.fn().mockResolvedValue(null),
}));

import { aeonHandlers } from "./aeon.js";

function makeContext(): GatewayRequestContext {
  return {
    workspaceDir: "/tmp/openaeon-workspace",
    chatAbortControllers: new Map(),
  } as unknown as GatewayRequestContext;
}

describe("aeon.status", () => {
  it("returns schemaVersion=3 with consciousness block and v2-compatible mirrors", async () => {
    mocks.stat.mockRejectedValue(new Error("ENOENT"));
    mocks.readFile.mockResolvedValue("");
    mocks.getSystemStatus.mockResolvedValue({
      uptime: 100,
      cpuLoad: [0.2],
      totalMemory: 16_000,
      freeMemory: 8_000,
      memoryUsagePercent: 50,
      platform: "darwin",
      arch: "arm64",
    });
    mocks.loadConfig.mockReturnValue({});
    mocks.loadPlanDigest.mockResolvedValue(undefined);
    mocks.lookupDeliveryRecords.mockResolvedValue([]);

    const respond = vi.fn();
    await aeonHandlers["aeon.status"]({
      params: { agentId: "main", sessionKey: "agent:main:main" },
      respond,
      context: makeContext(),
      req: { type: "req", id: "aeon-status-test", method: "aeon.status" },
    } as never);

    expect(respond).toHaveBeenCalledWith(true, expect.any(Object), undefined);
    const payload = respond.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload.schemaVersion).toBe(3);
    expect(payload.telemetry).toBeDefined();
    expect((payload.telemetry as Record<string, unknown>).v4).toBeDefined();
    expect(payload.legacy).toBeDefined();
    expect(payload.consciousness).toBeDefined();

    const telemetry = payload.telemetry as {
      v4: Record<string, unknown>;
      cognitiveState: Record<string, unknown>;
      evolution: Record<string, unknown>;
    };
    const legacy = payload.legacy as { evolution: Record<string, unknown> };
    expect(telemetry.evolution).toEqual(payload.evolution);
    expect(legacy.evolution).toEqual(payload.evolution);
    expect(typeof telemetry.cognitiveState.maintenanceDecision).toBe("string");
    expect(typeof telemetry.cognitiveState.guardrailDecision).toBe("string");
    expect(typeof telemetry.cognitiveState.homeostasisMode).toBe("string");
    expect(typeof telemetry.cognitiveState.evaluationTrend).toBe("string");
    expect(typeof telemetry.cognitiveState.epistemicLabel).toBe("string");
    expect(typeof telemetry.cognitiveState.impactScale).toBe("string");
    expect(typeof telemetry.cognitiveState.decisionConfidenceBand).toBe("string");
    expect(telemetry.v4.evidence).toBeDefined();
    expect(telemetry.v4.inference).toBeDefined();
    expect(telemetry.v4.confidence).toBeDefined();
    expect(telemetry.v4.curve).toBeDefined();
    expect(telemetry.v4.autospawn).toBeDefined();
  });
});

describe("aeon.* introspection methods", () => {
  it("returns structured decision explanation card", async () => {
    mocks.loadConfig.mockReturnValue({});
    const respond = vi.fn();

    await aeonHandlers["aeon.decision.explain"]({
      params: { agentId: "main", sessionKey: "agent:main:main" },
      respond,
      context: makeContext(),
      req: { type: "req", id: "aeon-decision-test", method: "aeon.decision.explain" },
    } as never);

    expect(respond).toHaveBeenCalledWith(true, expect.any(Object), undefined);
    const payload = respond.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload.schemaVersion).toBe(1);
    expect(payload.decisionCard).toBeDefined();
    expect(payload.impactLens).toBeDefined();
    expect(payload.policy).toBeDefined();
  });

  it("returns mission/session/turn intent trace and ethics adjudication", async () => {
    mocks.loadConfig.mockReturnValue({});
    const intentRespond = vi.fn();
    const ethicsRespond = vi.fn();

    await aeonHandlers["aeon.intent.trace"]({
      params: { agentId: "main", sessionKey: "agent:main:main" },
      respond: intentRespond,
      context: makeContext(),
      req: { type: "req", id: "aeon-intent-test", method: "aeon.intent.trace" },
    } as never);
    await aeonHandlers["aeon.ethics.evaluate"]({
      params: { agentId: "main", sessionKey: "agent:main:main" },
      respond: ethicsRespond,
      context: makeContext(),
      req: { type: "req", id: "aeon-ethics-test", method: "aeon.ethics.evaluate" },
    } as never);

    const intentPayload = intentRespond.mock.calls[0]?.[1] as Record<string, unknown>;
    const ethicsPayload = ethicsRespond.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(intentPayload.intent).toBeDefined();
    expect(intentPayload.goalDrift).toBeDefined();
    expect(ethicsPayload.charter).toBeDefined();
    expect(ethicsPayload.adjudication).toBeDefined();
  });

  it("forwards pipelineType filter to aeon.execution.lookup", async () => {
    mocks.lookupDeliveryRecords.mockResolvedValueOnce([]);
    const respond = vi.fn();
    await aeonHandlers["aeon.execution.lookup"]({
      params: { sessionKey: "agent:main:main", pipelineType: "deconfliction", limit: 10 },
      respond,
      context: makeContext(),
      req: { type: "req", id: "aeon-lookup-test", method: "aeon.execution.lookup" },
    } as never);

    expect(mocks.lookupDeliveryRecords).toHaveBeenCalledWith({
      runId: undefined,
      sessionKey: "agent:main:main",
      pipelineType: "deconfliction",
      limit: 10,
    });
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ schemaVersion: 1, records: [] }),
      undefined,
    );
  });
});
