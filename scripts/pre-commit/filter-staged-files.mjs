#!/usr/bin/env node
import path from "node:path";

/**
 * Prints selected files as NUL-delimited tokens to stdout.
 *
 * Usage:
 *   node scripts/pre-commit/filter-staged-files.mjs lint -- <files...>
 *   node scripts/pre-commit/filter-staged-files.mjs format -- <files...>
 *
 * Keep this dependency-free: the pre-commit hook runs in many environments.
 */

const mode = process.argv[2];
const rawArgs = process.argv.slice(3);
const files = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;

if (mode !== "lint" && mode !== "format") {
  process.stderr.write("usage: filter-staged-files.mjs <lint|format> -- <files...>\n");
  process.exit(2);
}

const lintExts = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const formatExts = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".mdx"]);

const excludedDirs = [
  "vendor",
  "node_modules",
  "dist",
  ".gemini",
  ".artifacts",
  "docs/zh-CN",
  "vendor/a2ui/renderers/lit/dist",
];

const shouldSelect = (filePath) => {
  const parts = filePath.split(path.sep);
  if (parts.some((part) => excludedDirs.includes(part))) {
    return false;
  }

  const ext = path.extname(filePath).toLowerCase();
  if (mode === "lint") {
    return lintExts.has(ext);
  }
  return formatExts.has(ext);
};

for (const file of files) {
  if (shouldSelect(file)) {
    process.stdout.write(file);
    process.stdout.write("\0");
  }
}
