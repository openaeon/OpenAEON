#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

const repoRoot = process.cwd();
const schemaPath = path.join(repoRoot, "docs", "aeon", "evidence-schema.yaml");

function fail(message) {
  console.error(`[evidence-schema] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(schemaPath)) {
  fail(`missing schema file: ${path.relative(repoRoot, schemaPath)}`);
}

let schema;
try {
  schema = YAML.parse(fs.readFileSync(schemaPath, "utf8"));
} catch (error) {
  fail(`invalid YAML: ${String(error)}`);
}

const requiredEventFields = ["ts", "type", "module", "source"];
for (const field of requiredEventFields) {
  if (!schema.eventRequiredFields?.includes(field)) {
    fail(`eventRequiredFields must include ${field}`);
  }
}

if (!Array.isArray(schema.typeEnum) || schema.typeEnum.length < 6) {
  fail("typeEnum must be a non-empty array with expected evidence event types");
}
if (!Array.isArray(schema.moduleEnum) || schema.moduleEnum.length < 3) {
  fail("moduleEnum must be a non-empty array");
}
if (!Array.isArray(schema.sourceEnum) || schema.sourceEnum.length < 3) {
  fail("sourceEnum must be a non-empty array");
}

if (!schema.moduleEnum.includes("unknown") || !schema.sourceEnum.includes("unknown")) {
  fail("moduleEnum/sourceEnum must include unknown fallback");
}

if (!schema.typeEnum.includes("deconfliction_fallback")) {
  fail("typeEnum must include deconfliction_fallback");
}

console.log("[evidence-schema] ok (required evidence fields and enums present)");
