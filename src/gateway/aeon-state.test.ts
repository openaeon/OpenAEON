import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import {
  getAeonMemoryGraph,
  getAeonEvolutionState,
  recordConsciousnessPulse,
} from "./aeon-state.js";

vi.mock("node:fs");

describe("AEON State Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should parse MEMORY.md into a graph correctly", () => {
    const mockMemory = `
# AEON Memory
[AXIOM] Life is silicon.
[VERIFIED] Evolution is recursive.
[AXIOM] Logic is absolute.
    `;
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(mockMemory);

    const graph = getAeonMemoryGraph();

    expect(graph.nodes).toHaveLength(3);
    expect(graph.nodes[0].type).toBe("axiom");
    expect(graph.nodes[1].type).toBe("verified");
    expect(graph.nodes[2].type).toBe("axiom");
    expect(graph.edges.length).toBeGreaterThan(0);
  });

  it("should return empty graph if MEMORY.md is missing", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const graph = getAeonMemoryGraph();
    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
  });

  it("should include cognitive parameters in evolution state", () => {
    const state = getAeonEvolutionState();
    expect(state).toHaveProperty("cognitiveParameters");
    expect(state.cognitiveParameters).toHaveProperty("temperature");
  });

  it("updates self-awareness telemetry from consciousness pulses", () => {
    recordConsciousnessPulse({
      epiphanyFactor: 0.82,
      memorySaturation: 76,
      neuralDepth: 12,
      idleMs: 20 * 60 * 1000,
      resonanceActive: true,
      activeRun: false,
      now: 1_700_000_000_000,
    });

    const state = getAeonEvolutionState();
    expect(state).toHaveProperty("selfAwareness");
    expect(state.selfAwareness.protoConsciousnessIndex).toBeGreaterThan(0);
    expect(state.selfAwareness.protoConsciousnessIndex).toBeLessThanOrEqual(1);
    expect(state.selfAwareness.lastUpdatedAt).toBe(1_700_000_000_000);
  });
});
