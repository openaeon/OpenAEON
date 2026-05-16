#!/usr/bin/env -S node --import tsx

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type PackageJson = {
  version?: string;
};

function git(args: string[], options: { allowFailure?: boolean } = {}): string {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    if (options.allowFailure) {
      return "";
    }
    throw error;
  }
}

function hasArg(name: string): boolean {
  return process.argv.includes(name);
}

function readPackageVersion(): string {
  const packagePath = resolve("package.json");
  const pkg = JSON.parse(readFileSync(packagePath, "utf8")) as PackageJson;
  const version = pkg.version?.trim();
  if (!version) {
    throw new Error("package.json is missing a version.");
  }
  if (!/^\d{4}\.\d{1,2}\.\d{1,2}(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Unsupported release version '${version}'. Expected CalVer like 2026.5.17.`);
  }
  return version;
}

function extractReleaseNotes(version: string): string {
  const changelogPath = resolve("CHANGELOG.md");
  if (!existsSync(changelogPath)) {
    throw new Error("CHANGELOG.md not found.");
  }
  const changelog = readFileSync(changelogPath, "utf8");
  const headers = [...changelog.matchAll(/^##\s+.*$/gm)];
  const sections: string[] = [];

  for (let index = 0; index < headers.length; index += 1) {
    const header = headers[index];
    const headerText = header[0];
    const headerVersion = /^##\s+\[?([^\]\s]+)\]?/.exec(headerText)?.[1];
    if (headerVersion !== version) {
      continue;
    }

    const start = (header.index ?? 0) + headerText.length;
    const end = headers[index + 1]?.index ?? changelog.length;
    const section = changelog.slice(start, end).trim();
    if (section) {
      sections.push(section);
    }
  }

  if (sections.length === 0) {
    throw new Error(`CHANGELOG.md does not contain a release section for ${version}.`);
  }
  return sections.join("\n\n").trim();
}

function ensureCleanWorktree(): void {
  const status = git(["status", "--porcelain"]);
  if (!status) {
    return;
  }
  throw new Error(
    [
      "Working tree is dirty. Commit or stash release changes before tagging.",
      "Use --allow-dirty only if you intentionally want to tag the current HEAD while local WIP exists.",
    ].join("\n"),
  );
}

function ensureTagDoesNotExist(tagName: string): void {
  const localTag = git(["tag", "--list", tagName]);
  if (localTag === tagName) {
    throw new Error(`Local tag ${tagName} already exists.`);
  }
  const remoteTag = git(["ls-remote", "--tags", "origin", tagName], { allowFailure: true });
  if (remoteTag) {
    throw new Error(`Remote tag ${tagName} already exists on origin.`);
  }
}

function createAnnotatedTag(tagName: string, version: string): void {
  git(["tag", "-a", tagName, "-m", `Release ${version}`]);
}

function pushTag(tagName: string): void {
  execFileSync("git", ["push", "origin", tagName], { stdio: "inherit" });
}

function run(): void {
  const shouldPush = hasArg("--push");
  const dryRun = hasArg("--dry-run");
  const allowDirty = hasArg("--allow-dirty");
  const version = readPackageVersion();
  const tagName = `v${version}`;
  const notes = extractReleaseNotes(version);

  if (!notes) {
    throw new Error(`CHANGELOG.md release notes for ${version} are empty.`);
  }
  if (!allowDirty) {
    ensureCleanWorktree();
  }
  ensureTagDoesNotExist(tagName);

  const head = git(["rev-parse", "--short", "HEAD"]);
  console.log(`Release version: ${version}`);
  console.log(`Tag: ${tagName}`);
  console.log(`HEAD: ${head}`);
  console.log(`Notes: ${notes.split(/\r?\n/).filter(Boolean).length} non-empty lines`);

  if (dryRun) {
    console.log("Dry run only. No tag created and nothing pushed.");
    return;
  }

  createAnnotatedTag(tagName, version);
  console.log(`Created local tag ${tagName}.`);

  if (shouldPush) {
    pushTag(tagName);
    console.log(`Pushed ${tagName}. GitHub Actions will create the GitHub Release.`);
  } else {
    console.log(`Next: git push origin ${tagName}`);
  }
}

try {
  run();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`release-github: ${message}`);
  process.exit(1);
}
