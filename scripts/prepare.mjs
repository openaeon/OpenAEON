import { execSync } from "node:child_process";

try {
  // Check if git is available
  execSync("git --version", { stdio: "ignore" });

  // Check if inside a work tree
  const isInsideWorkTree =
    execSync("git rev-parse --is-inside-work-tree", { encoding: "utf8" }).trim() === "true";

  if (isInsideWorkTree) {
    console.log("Setting up git hooks path...");
    execSync("git config core.hooksPath git-hooks");
  }
} catch {
  // Git not found or not in a repo, skip quietly
  console.log("Git not found or not in a repository, skipping hooks configuration.");
}

process.exit(0);
