import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { appendFileMock, mkdirMock } = vi.hoisted(() => ({
  appendFileMock: vi.fn(),
  mkdirMock: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  default: {
    appendFile: appendFileMock,
    mkdir: mkdirMock,
  },
}));

vi.mock("../config/paths.js", () => ({
  resolveStateDir: () => "/tmp/openaeon-state",
}));

import { logEvolutionEvent } from "./aeon-evolution-log.js";

describe("logEvolutionEvent", () => {
  beforeEach(() => {
    appendFileMock.mockReset();
    mkdirMock.mockReset();
    mkdirMock.mockResolvedValue(undefined);
  });

  it("falls back to state-dir log when repo log path is not writable", async () => {
    appendFileMock.mockRejectedValueOnce(new Error("EPERM"));
    appendFileMock.mockResolvedValueOnce(undefined);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await logEvolutionEvent("SYSTEM_MAINTENANCE", "test event", ["first detail"]);

    expect(appendFileMock).toHaveBeenCalledTimes(2);
    const fallbackPath = path.join("/tmp/openaeon-state", "logs", "aeon", "EVOLUTION.md");
    expect(appendFileMock.mock.calls[1]?.[0]).toBe(fallbackPath);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });
});