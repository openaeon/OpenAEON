import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMetaCognitionTool } from "./meta-cognition-tool.js";
import { addCognitiveLog, setAeonParameters } from "../../gateway/aeon-state.js";

vi.mock("../../gateway/aeon-state.js");

describe("Meta-Cognition Tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should handle internal_monologue", async () => {
    const tool = createMetaCognitionTool();
    await tool.execute("test-call", {
      action: "internal_monologue",
      thought: "Testing thought",
    });

    expect(addCognitiveLog).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "deliberation",
        content: "Testing thought",
      }),
    );
  });

  it("should handle optimize_parameters", async () => {
    const tool = createMetaCognitionTool();
    const params = {
      action: "optimize_parameters",
      temperature: 0.8,
      top_p: 0.9,
      max_tokens: 1000,
    };

    const result = (await tool.execute("test-call", params)) as any;

    expect(setAeonParameters).toHaveBeenCalledWith({
      temperature: 0.8,
      top_p: 0.9,
      maxTokens: 1000,
    });
    expect(addCognitiveLog).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "reflection",
      }),
    );
    expect(result.details.status).toBe("parameters_optimized");
  });

  it("should handle detect_anomaly", async () => {
    const tool = createMetaCognitionTool();
    await tool.execute("test-call", {
      action: "detect_anomaly",
      conflict: "Logical contradiction",
      severity: 0.8,
    });

    expect(addCognitiveLog).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "anomaly",
        content: "Conflict Detected: Logical contradiction",
      }),
    );
  });
});
