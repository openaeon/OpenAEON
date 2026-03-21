#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

const repoRoot = process.cwd();
const claimMapPath = path.join(repoRoot, "docs", "aeon", "claim-map.yaml");

const REQUIRED_CLAIMS = [
  "claim.evidence-driven-telemetry",
  "claim.strict-curve-index",
  "claim.autospawn-synthesis-chain",
  "claim.llm-semantic-deconfliction",
  "claim.singularity-staged-pipeline",
  "claim.reflect-architecture-diagnostics",
];

function fail(message) {
  console.error(`[claim-guard] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(claimMapPath)) {
  fail(`missing mapping file: ${path.relative(repoRoot, claimMapPath)}`);
}

let raw;
try {
  raw = YAML.parse(fs.readFileSync(claimMapPath, "utf8"));
} catch (error) {
  fail(`invalid YAML in ${path.relative(repoRoot, claimMapPath)}: ${String(error)}`);
}

if (!Array.isArray(raw.claims)) {
  fail("claim map must include an array at claims");
}

const claimsById = new Map();
for (const claim of raw.claims) {
  if (!claim || typeof claim !== "object") {
    fail("each claim entry must be an object");
  }
  const id = claim.id;
  if (typeof id !== "string" || id.trim().length === 0) {
    fail("claim entry missing non-empty id");
  }
  if (claimsById.has(id)) {
    fail(`duplicate claim id: ${id}`);
  }
  claimsById.set(id, claim);
}

for (const claimId of REQUIRED_CLAIMS) {
  const claim = claimsById.get(claimId);
  if (!claim) {
    fail(`required claim missing: ${claimId}`);
  }
  if (typeof claim.statement !== "string" || claim.statement.trim().length < 12) {
    fail(`claim ${claimId} must include a non-trivial statement`);
  }
  if (!Array.isArray(claim.metrics) || claim.metrics.length === 0) {
    fail(`claim ${claimId} must include metrics[]`);
  }
  if (!Array.isArray(claim.logs) || claim.logs.length === 0) {
    fail(`claim ${claimId} must include logs[]`);
  }
  if (!Array.isArray(claim.tests) || claim.tests.length === 0) {
    fail(`claim ${claimId} must include tests[]`);
  }

  for (const testPath of claim.tests) {
    if (typeof testPath !== "string" || testPath.trim().length === 0) {
      fail(`claim ${claimId} has invalid test path value`);
    }
    const abs = path.join(repoRoot, testPath);
    if (!fs.existsSync(abs)) {
      fail(`claim ${claimId} references missing test file: ${testPath}`);
    }
  }
}

console.log(
  `[claim-guard] ok (${REQUIRED_CLAIMS.length} required claims mapped in docs/aeon/claim-map.yaml)`,
);
