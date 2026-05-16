import fs from "node:fs";
import path from "node:path";

function normalizeHeaderVersion(header: string): string | null {
  const match = /^##\s+\[?([^\]\s]+)\]?/.exec(header);
  return match?.[1] ?? null;
}

function extractReleaseNotes(changelog: string, version: string): string {
  const headers = [...changelog.matchAll(/^##\s+.*$/gm)];
  const sections: string[] = [];

  for (let index = 0; index < headers.length; index += 1) {
    const header = headers[index];
    const headerText = header[0];
    const headerVersion = normalizeHeaderVersion(headerText);
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

  return sections.join("\n\n").trim();
}

function run() {
  const changelogPath = path.resolve(process.cwd(), "CHANGELOG.md");
  const packageJsonPath = path.resolve(process.cwd(), "package.json");

  if (!fs.existsSync(changelogPath)) {
    console.error("CHANGELOG.md not found");
    process.exit(1);
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const version = packageJson.version;
  const changelog = fs.readFileSync(changelogPath, "utf8");

  const notes = extractReleaseNotes(changelog, version);
  if (!notes) {
    console.warn(`Version ${version} not found in CHANGELOG.md`);
    return;
  }

  process.stdout.write(notes);
}

run();
