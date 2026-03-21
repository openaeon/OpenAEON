#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

const repoRoot = process.cwd();
const registryPath = path.join(repoRoot, "docs", "aeon", "anti-evolution-regressions.yaml");

function fail(message) {
  console.error(`[anti-evolution] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(registryPath)) {
  fail(`missing registry file: ${path.relative(repoRoot, registryPath)}`);
}

let registry;
try {
  registry = YAML.parse(fs.readFileSync(registryPath, "utf8"));
} catch (error) {
  fail(`invalid YAML: ${String(error)}`);
}

if (!Array.isArray(registry.cases) || registry.cases.length === 0) {
  fail("cases[] must be a non-empty array");
}

for (const entry of registry.cases) {
  if (!entry?.id || !entry?.title) {
    fail("every anti-evolution case must include id and title");
  }
  if (!Array.isArray(entry.testFiles) || entry.testFiles.length === 0) {
    fail(`case ${entry.id} must include testFiles[]`);
  }
  for (const testFile of entry.testFiles) {
    const abs = path.join(repoRoot, testFile);
    if (!fs.existsSync(abs)) {
      fail(`case ${entry.id} references missing test file: ${testFile}`);
    }
  }
}

console.log(`[anti-evolution] ok (${registry.cases.length} regression cases registered)`);
