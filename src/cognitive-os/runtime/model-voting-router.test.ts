import { describe, expect, it } from "vitest";
import { dispatchWithParallelVoting } from "./model-voting-router.js";

describe("parallel model voting router", () => {
  it("returns winner and all candidates", async () => {
    const result = await dispatchWithParallelVoting({
      taskId: "task-1",
      nodeId: "node-1",
      prompt: "Implement and test feature",
      role: "DevAgent",
      providers: ["gpt", "claude", "gemini"],
      timeoutMs: 10_000,
    });

    expect(result.winner).toBeDefined();
    expect(result.candidates).toHaveLength(3);
    expect(result.candidates.every((c) => typeof c.score === "number")).toBe(true);
  });
});
