#!/usr/bin/env -S node --import tsx

import { readFileSync, writeFileSync } from "node:fs";

const VERSION_FILES = [
  "package.json",
  "apps/android/app/build.gradle.kts",
  "apps/ios/Sources/Info.plist",
  "apps/ios/Tests/Info.plist",
  "apps/macos/Sources/OpenClaw/Resources/Info.plist",
  "docs/platforms/mac/release.md",
] as const;

function todayVersion(): string {
  const now = new Date();
  return `${now.getFullYear()}.${now.getMonth() + 1}.${now.getDate()}`;
}

function buildNumber(version: string): string {
  const [year, month, day] = version.split(".").map((part) => Number(part));
  if (!year || !month || !day) {
    throw new Error(`Invalid release version '${version}'. Expected YYYY.M.D.`);
  }
  return `${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}90`;
}

function replaceAll(content: string, version: string): string {
  const build = buildNumber(version);
  return content
    .replace(/\b20\d{2}\.\d{1,2}\.\d{1,2}(?:-[0-9A-Za-z.-]+)?\b/g, version)
    .replace(/\b20\d{6}90\b/g, build);
}

function run(): void {
  const version = process.argv[2]?.trim() || todayVersion();
  if (!/^\d{4}\.\d{1,2}\.\d{1,2}(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid release version '${version}'. Expected YYYY.M.D.`);
  }

  for (const file of VERSION_FILES) {
    const before = readFileSync(file, "utf8");
    const after = replaceAll(before, version);
    if (after !== before) {
      writeFileSync(file, after);
      console.log(`updated ${file}`);
    }
  }
  console.log(`release version set to ${version} (${buildNumber(version)})`);
}

try {
  run();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`set-release-version: ${message}`);
  process.exit(1);
}
