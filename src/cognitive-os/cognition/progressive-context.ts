import fs from "node:fs/promises";
import path from "node:path";

const CONTEXT_FILE_NAMES = ["AGENTS.md", "CLAUDE.md", ".hermes.md", "HERMES.md"] as const;

export type ProgressiveContextHint = {
  path: string;
  content: string;
};

function isInside(root: string, candidate: string): boolean {
  const rel = path.relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

async function readFirstContextFile(
  dir: string,
  root: string,
): Promise<ProgressiveContextHint | null> {
  for (const name of CONTEXT_FILE_NAMES) {
    const filePath = path.join(dir, name);
    if (!isInside(root, filePath)) {
      continue;
    }
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const trimmed = raw.trim();
      if (!trimmed) {
        continue;
      }
      return {
        path: path.relative(root, filePath).replace(/\\/g, "/"),
        content:
          trimmed.length > 8_000 ? `${trimmed.slice(0, 8_000)}\n...(context truncated)` : trimmed,
      };
    } catch {
      // Try the next context filename.
    }
  }
  return null;
}

export async function discoverProgressiveContextHints(input: {
  workspaceDir: string;
  referencedPaths?: string[];
  maxHints?: number;
}): Promise<ProgressiveContextHint[]> {
  const root = path.resolve(input.workspaceDir);
  const referenced = input.referencedPaths?.length ? input.referencedPaths : ["."];
  const dirs = new Set<string>();
  for (const ref of referenced) {
    const absolute = path.resolve(root, ref);
    if (!isInside(root, absolute)) {
      continue;
    }
    let dir = absolute;
    try {
      const stat = await fs.stat(absolute);
      if (!stat.isDirectory()) {
        dir = path.dirname(absolute);
      }
    } catch {
      dir = path.extname(absolute) ? path.dirname(absolute) : absolute;
    }
    for (let i = 0; i < 5 && isInside(root, dir); i += 1) {
      dirs.add(dir);
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }

  const hints: ProgressiveContextHint[] = [];
  const seen = new Set<string>();
  for (const dir of dirs) {
    const hint = await readFirstContextFile(dir, root);
    if (!hint || seen.has(hint.path)) {
      continue;
    }
    hints.push(hint);
    seen.add(hint.path);
    if (hints.length >= Math.max(1, Math.min(20, input.maxHints ?? 6))) {
      break;
    }
  }
  return hints;
}
