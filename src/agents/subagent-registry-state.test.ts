import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SubagentRunRecord } from "./subagent-registry.types.js";

const { saveSubagentRegistryToDiskMock, loadSubagentRegistryFromDiskMock } = vi.hoisted(() => ({
  saveSubagentRegistryToDiskMock: vi.fn(),
  loadSubagentRegistryFromDiskMock: vi.fn(() => new Map<string, SubagentRunRecord>()),
}));

vi.mock("./subagent-registry.store.js", () => ({
  saveSubagentRegistryToDisk: saveSubagentRegistryToDiskMock,
  loadSubagentRegistryFromDisk: loadSubagentRegistryFromDiskMock,
}));

function makeRuns(runId: string) {
  const now = Date.now();
  const record: SubagentRunRecord = {
    runId,
    childSessionKey: `agent:main:subagent:${runId}`,
    requesterSessionKey: "agent:main:main",
    requesterDisplayKey: "main",
    task: `task-${runId}`,
    cleanup: "keep",
    createdAt: now,
  };
  return new Map<string, SubagentRunRecord>([[runId, record]]);
}

describe("subagent registry state persistence retries", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    saveSubagentRegistryToDiskMock.mockReset();
    loadSubagentRegistryFromDiskMock.mockReset().mockReturnValue(new Map());
  });

  afterEach(async () => {
    const mod = await import("./subagent-registry-state.js");
    mod.resetSubagentRegistryPersistenceStateForTests();
    vi.useRealTimers();
  });

  it("retries failed persistence on a timer", async () => {
    const mod = await import("./subagent-registry-state.js");
    saveSubagentRegistryToDiskMock
      .mockImplementationOnce(() => {
        throw new Error("disk unavailable");
      })
      .mockImplementation(() => {});

    mod.persistSubagentRunsToDisk(makeRuns("run-1"));
    expect(saveSubagentRegistryToDiskMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(250);
    expect(saveSubagentRegistryToDiskMock).toHaveBeenCalledTimes(2);
  });

  it("keeps only the latest snapshot while a retry is pending", async () => {
    const mod = await import("./subagent-registry-state.js");
    saveSubagentRegistryToDiskMock
      .mockImplementationOnce(() => {
        throw new Error("first write failed");
      })
      .mockImplementation(() => {});

    mod.persistSubagentRunsToDisk(makeRuns("run-a"));
    mod.persistSubagentRunsToDisk(makeRuns("run-b"));

    await vi.advanceTimersByTimeAsync(250);
    expect(saveSubagentRegistryToDiskMock).toHaveBeenCalledTimes(2);
    const persisted = saveSubagentRegistryToDiskMock.mock.calls[1]?.[0] as
      | Map<string, SubagentRunRecord>
      | undefined;
    expect(persisted?.has("run-a")).toBe(false);
    expect(persisted?.has("run-b")).toBe(true);
  });

  it("flush helper forces pending persistence attempts in tests", async () => {
    const mod = await import("./subagent-registry-state.js");
    saveSubagentRegistryToDiskMock
      .mockImplementationOnce(() => {
        throw new Error("transient");
      })
      .mockImplementation(() => {});

    mod.persistSubagentRunsToDisk(makeRuns("run-flush"));
    await mod.flushSubagentRegistryPersistenceForTests();

    expect(saveSubagentRegistryToDiskMock).toHaveBeenCalledTimes(2);
  });
});
