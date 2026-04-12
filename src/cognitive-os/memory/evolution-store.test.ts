import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { appendEvolutionEntry, queryEvolutionEntries } from "./evolution-store.js";

describe("evolution memory store", () => {
  it("writes and queries entries", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "cognitive-memory-"));
    await appendEvolutionEntry(tmp, {
      id: "e1",
      taskId: "task-1",
      category: "success_path",
      content: "A successful execution path",
      tags: ["pass", "strategy"],
      createdAt: Date.now(),
    });

    const rows = await queryEvolutionEntries(tmp, { taskId: "task-1", limit: 10 });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.content).toContain("successful");
  });
});
