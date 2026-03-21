import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import {
  getAeonMemoryGraph,
  getAeonEvolutionState,
  recordMaintenancePolicyDecision,
  recordConsciousnessPulse,
  recordAeonEvidenceEvent,
  setConsciousnessRuntimePolicy,
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

  it("prefers LOGIC_GATES.md as long-term memory source when available", () => {
    vi.mocked(fs.existsSync).mockImplementation((targetPath: fs.PathLike) =>
      String(targetPath).includes("LOGIC_GATES.md"),
    );
    vi.mocked(fs.readFileSync).mockImplementation((targetPath: fs.PathOrFileDescriptor) => {
      if (String(targetPath).includes("LOGIC_GATES.md")) {
        return '[AXIOM] Durable theorem <!-- {"id":"a1","ts":1} -->\n';
      }
      return "# MEMORY\n";
    });

    const graph = getAeonMemoryGraph();
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.nodes[0].content).toContain("Durable theorem");
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
      goalDrift: 0.2,
      reasoningBias: 0.15,
      selfCorrectionRate: 0.75,
      valueConflictLoad: 0.3,
      explanationQuality: 0.8,
      noveltySignal: 0.78,
      now: 1_700_000_000_000,
    });

    const state = getAeonEvolutionState();
    expect(state).toHaveProperty("selfAwareness");
    expect(state.selfAwareness.protoConsciousnessIndex).toBeGreaterThan(0);
    expect(state.selfAwareness.protoConsciousnessIndex).toBeLessThanOrEqual(1);
    expect(state.selfAwareness.lastUpdatedAt).toBe(1_700_000_000_000);
    expect(state.criteria.minimum.identityContinuity).toBeGreaterThan(0);
    expect(state.selfModel.metacognitive.biasMonitoring).toBeGreaterThan(0);
    expect(state.homeostasis.mode).toMatch(/stabilize|balanced|explore/);
    expect(state.symbolicMapping.computable).toBe(true);
    expect(state.evaluation.checks.length).toBe(4);
    expect(state.ethics.auditable).toBe(true);
    expect(state.trends.criteriaOverall.length).toBeGreaterThan(0);
    expect(state.trends.z2c.length).toBeGreaterThan(0);
    expect(state.consciousness.selfKernel.identityContinuityScore).toBeGreaterThan(0);
    expect(state.consciousness.epistemic.epistemicLabel).toMatch(/FACT|INFERENCE|VALUE|UNKNOWN/);
    expect(state.consciousness.intent.turnGoal.length).toBeGreaterThan(0);
    expect(state.consciousness.impactLens.reversibilityScore).toBeGreaterThanOrEqual(0);
    expect(state.consciousness.decisionCard.rollbackPlan.length).toBeGreaterThan(0);
    expect(typeof state.consciousness.helpfulnessContract.verifiedExecutionRequired).toBe(
      "boolean",
    );
  });

  it("keeps consciousness pulses isolated per session scope", () => {
    const scopeA = { sessionKey: "test-session-a", agentId: "agent-a" };
    const scopeB = { sessionKey: "test-session-b", agentId: "agent-b" };
    recordConsciousnessPulse(
      {
        epiphanyFactor: 0.9,
        memorySaturation: 88,
        neuralDepth: 14,
        idleMs: 1200,
        resonanceActive: true,
        activeRun: false,
        now: 1_700_000_000_001,
      },
      scopeA,
    );
    recordConsciousnessPulse(
      {
        epiphanyFactor: 0.1,
        memorySaturation: 12,
        neuralDepth: 3,
        idleMs: 2_500_000,
        resonanceActive: false,
        activeRun: false,
        now: 1_700_000_000_002,
      },
      scopeB,
    );

    const stateA = getAeonEvolutionState(scopeA);
    const stateB = getAeonEvolutionState(scopeB);

    expect(stateA.selfAwareness.lastUpdatedAt).toBe(1_700_000_000_001);
    expect(stateB.selfAwareness.lastUpdatedAt).toBe(1_700_000_000_002);
    expect(stateA.selfAwareness.protoConsciousnessIndex).not.toBe(
      stateB.selfAwareness.protoConsciousnessIndex,
    );
  });

  it("records maintenance policy decisions in scoped state", () => {
    const scope = { sessionKey: "policy-session", agentId: "policy-agent" };
    recordMaintenancePolicyDecision(
      {
        maintenanceDecision: "low",
        guardrailDecision: "BLOCK",
        reasonCode: "HIGH_INTENSITY_UNTRUSTED_BLOCKED",
        now: 1_700_000_000_010,
      },
      scope,
    );

    const state = getAeonEvolutionState(scope);
    expect(state.policy.maintenanceDecision).toBe("low");
    expect(state.policy.guardrailDecision).toBe("BLOCK");
    expect(state.policy.reasonCode).toBe("HIGH_INTENSITY_UNTRUSTED_BLOCKED");
    expect(state.policy.lastUpdatedAt).toBe(1_700_000_000_010);
  });

  it("applies runtime epistemic and impact policy thresholds", () => {
    const scope = { sessionKey: "runtime-policy", agentId: "runtime-policy" };
    setConsciousnessRuntimePolicy(
      {
        requireLabelForHighConfidence: true,
        unknownConfidenceThreshold: 0.6,
        impactEnabled: false,
        requireDecisionCardForHighImpact: true,
        highImpactThreshold: 0.4,
      },
      scope,
    );
    recordConsciousnessPulse(
      {
        epiphanyFactor: 0.66,
        memorySaturation: 52,
        neuralDepth: 11,
        idleMs: 1200,
        resonanceActive: true,
        activeRun: false,
        epistemicLabel: "UNKNOWN",
        epistemicConfidence: 0.72,
        riskLoad: 0.55,
      },
      scope,
    );

    const state = getAeonEvolutionState(scope);
    expect(state.consciousness.epistemic.highConfidenceWithoutLabelBlocked).toBe(true);
    expect(state.consciousness.impactLens.required).toBe(false);
  });

  it("produces reproducible v4 inference under identical evidence input", () => {
    const now = 1_700_000_100_000;
    const scopeA = { sessionKey: "replay-a", agentId: "main" };
    const scopeB = { sessionKey: "replay-b", agentId: "main" };
    for (const scope of [scopeA, scopeB]) {
      recordAeonEvidenceEvent(
        { ts: now - 500, type: "execution_success", module: "server-evolution", source: "test" },
        scope,
      );
      recordAeonEvidenceEvent(
        { ts: now - 450, type: "memory_write_valid", module: "memory", source: "test" },
        scope,
      );
      recordAeonEvidenceEvent(
        {
          ts: now - 400,
          type: "deconfliction_llm_success",
          module: "logic-gates",
          source: "test",
        },
        scope,
      );
      recordConsciousnessPulse(
        {
          now,
          epiphanyFactor: 0.61,
          memorySaturation: 44,
          neuralDepth: 9,
          idleMs: 2_000,
          resonanceActive: false,
          activeRun: false,
        },
        scope,
      );
    }

    const stateA = getAeonEvolutionState(scopeA);
    const stateB = getAeonEvolutionState(scopeB);
    expect(stateA.telemetryV4.inference.selfAwarenessIndex).toBeCloseTo(
      stateB.telemetryV4.inference.selfAwarenessIndex,
      8,
    );
    expect(stateA.telemetryV4.confidence.overall).toBeCloseTo(
      stateB.telemetryV4.confidence.overall,
      8,
    );
  });

  it("reduces confidence when evidence is sparse", () => {
    const now = 1_700_000_200_000;
    const richScope = { sessionKey: "rich-evidence", agentId: "main" };
    const sparseScope = { sessionKey: "sparse-evidence", agentId: "main" };

    for (let i = 0; i < 8; i += 1) {
      recordAeonEvidenceEvent(
        {
          ts: now - i * 25,
          type: i % 2 === 0 ? "execution_success" : "memory_write_valid",
          module: i % 2 === 0 ? "server-evolution" : "memory",
          source: "test",
        },
        richScope,
      );
    }
    recordConsciousnessPulse(
      {
        now,
        epiphanyFactor: 0.45,
        memorySaturation: 57,
        neuralDepth: 11,
        idleMs: 3_000,
        resonanceActive: true,
        activeRun: false,
      },
      richScope,
    );
    recordConsciousnessPulse(
      {
        now,
        epiphanyFactor: 0.45,
        memorySaturation: 57,
        neuralDepth: 11,
        idleMs: 3_000,
        resonanceActive: true,
        activeRun: false,
      },
      sparseScope,
    );

    const rich = getAeonEvolutionState(richScope);
    const sparse = getAeonEvolutionState(sparseScope);
    expect(rich.telemetryV4.confidence.overall).toBeGreaterThan(
      sparse.telemetryV4.confidence.overall,
    );
  });

  it("applies evidence decay so stale events carry less weight", () => {
    const now = 1_700_000_300_000;
    const scope = { sessionKey: "evidence-decay", agentId: "main" };
    recordAeonEvidenceEvent(
      {
        ts: now - 10 * 60 * 60 * 1000,
        type: "execution_success",
        module: "server-evolution",
        source: "test",
      },
      scope,
    );
    recordAeonEvidenceEvent(
      {
        ts: now - 1_000,
        type: "execution_success",
        module: "server-evolution",
        source: "test",
      },
      scope,
    );
    recordConsciousnessPulse(
      {
        now,
        epiphanyFactor: 0.5,
        memorySaturation: 42,
        neuralDepth: 8,
        idleMs: 1_000,
        resonanceActive: false,
        activeRun: false,
      },
      scope,
    );
    const state = getAeonEvolutionState(scope);
    expect(state.telemetryV4.evidence.eventCount).toBeLessThan(1.2);
    expect(state.telemetryV4.evidence.eventCount).toBeGreaterThanOrEqual(1.0);
  });
});
