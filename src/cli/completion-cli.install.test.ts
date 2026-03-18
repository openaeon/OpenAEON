import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installCompletion, resolveCompletionCachePath } from "./completion-cli.js";

describe("installCompletion", () => {
  let tempRoot = "";
  let previousHome: string | undefined;
  let previousStateDir: string | undefined;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openaeon-completion-"));
    previousHome = process.env.HOME;
    previousStateDir = process.env.OPENAEON_STATE_DIR;
    process.env.HOME = tempRoot;
    process.env.OPENAEON_STATE_DIR = path.join(tempRoot, ".openaeon-state");
  });

  afterEach(async () => {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }
    if (previousStateDir === undefined) {
      delete process.env.OPENAEON_STATE_DIR;
    } else {
      process.env.OPENAEON_STATE_DIR = previousStateDir;
    }
    if (tempRoot) {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("removes legacy openclaw completion lines while installing openaeon completion", async () => {
    const cachePath = resolveCompletionCachePath("zsh", "openaeon");
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    await fs.writeFile(cachePath, "# zsh completion cache\n", "utf-8");

    const profilePath = path.join(tempRoot, ".zshrc");
    await fs.writeFile(
      profilePath,
      [
        "export OPENAEON_TEST_KEEP=1",
        'source "$HOME/.openclaw/completions/openclaw.zsh"',
        "source /tmp/legacy/openclaw.zsh",
        "# OPENCLAW Completion",
        "source /tmp/legacy/openclaw-completion.zsh",
      ].join("\n"),
      "utf-8",
    );

    await installCompletion("zsh", true, "openaeon");

    const next = await fs.readFile(profilePath, "utf-8");
    expect(next).not.toContain(".openclaw/completions/openclaw.zsh");
    expect(next).not.toContain("openclaw completion");
    expect(next).toContain("# OPENAEON Completion");
    expect(next).toContain(`source "${cachePath}"`);
    expect(next).toContain("export OPENAEON_TEST_KEEP=1");
  });
});