import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { discoverProgressiveContextHints } from "./progressive-context.js";

describe("discoverProgressiveContextHints", () => {
  const workspaces: string[] = [];

  afterEach(async () => {
    await Promise.all(
      workspaces.map((workspace) => fs.rm(workspace, { recursive: true, force: true })),
    );
    workspaces.length = 0;
  });

  it("discovers AGENTS.md from referenced file ancestors", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "openaeon-context-"));
    workspaces.push(workspace);
    await fs.mkdir(path.join(workspace, "packages", "app", "src"), { recursive: true });
    await fs.writeFile(
      path.join(workspace, "packages", "app", "AGENTS.md"),
      "Use app conventions.",
      "utf-8",
    );

    const hints = await discoverProgressiveContextHints({
      workspaceDir: workspace,
      referencedPaths: ["packages/app/src/main.ts"],
    });

    expect(hints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "packages/app/AGENTS.md",
          content: "Use app conventions.",
        }),
      ]),
    );
  });
});
