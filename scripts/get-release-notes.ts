import fs from "node:fs";
import path from "node:path";

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

  // Look for the version header (## 2026.4.10)
  const escapedVersion = version.replace(/\./g, "\\.");
  const headerRegex = new RegExp(`^##\\s+${escapedVersion}`, "m");
  const match = changelog.match(headerRegex);

  if (!match) {
    console.warn(`Version ${version} not found in CHANGELOG.md`);
    // Output nothing or fallback
    return;
  }

  const startIndex = match.index! + match[0].length;
  // Look for the next version header (## ) or end of file
  const nextHeaderRegex = /^##\s+/m;
  const remaining = changelog.slice(startIndex);
  const nextMatch = remaining.match(nextHeaderRegex);

  let notes = nextMatch ? remaining.slice(0, nextMatch.index) : remaining;
  notes = notes.trim();

  if (notes) {
    process.stdout.write(notes);
  }
}

run();
