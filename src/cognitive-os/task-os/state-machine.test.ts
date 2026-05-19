import { describe, expect, it } from "vitest";
import { applyTransition, canTransition } from "./state-machine.js";

describe("cognitive task state machine", () => {
  it("allows forward lifecycle transitions", () => {
    expect(canTransition("INIT", "PLAN")).toBe(true);
    expect(canTransition("PLAN", "EXECUTE")).toBe(true);
    expect(canTransition("EXECUTE", "VERIFY")).toBe(true);
    expect(canTransition("EXECUTE", "REFLECT")).toBe(true);
    expect(canTransition("VERIFY", "REFLECT")).toBe(true);
    expect(canTransition("REFLECT", "DONE")).toBe(true);
  });

  it("blocks illegal backward transition", () => {
    expect(canTransition("DONE", "PLAN")).toBe(false);
    expect(() => applyTransition("DONE", "PLAN")).toThrow(/invalid cognitive phase transition/i);
  });

  it("supports retry and rollback semantics", () => {
    expect(canTransition("FAILED", "EXECUTE")).toBe(true);
    expect(canTransition("FAILED", "ROLLED_BACK")).toBe(true);
    expect(canTransition("ROLLED_BACK", "PLAN")).toBe(true);
  });
});
