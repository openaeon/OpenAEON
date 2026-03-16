import { resolveBundledPluginSources } from "../plugins/bundled-sources.js";
import { loadPluginManifest } from "../plugins/manifest.js";
import { loadWorkspaceSkillEntries } from "../agents/skills.js";
import { resolveBundledPluginsDir } from "../plugins/bundled-dir.js";
import path from "node:path";
import fs from "node:fs/promises";

export type DiscoveryCandidate = {
  id: string;
  name: string;
  kind: "plugin" | "skill";
  source: "bundled" | "npm" | "workspace";
  description?: string;
  installSpec?: string;
  installed: boolean;
};

/**
 * Searches for available skills and plugins that the agent can "acquire".
 * Prioritizes local extensions in the monorepo.
 */
export async function discoverAvailableCapabilities(params: {
  workspaceDir?: string;
  query?: string;
}): Promise<DiscoveryCandidate[]> {
  const candidates: DiscoveryCandidate[] = [];
  const query = params.query?.toLowerCase() ?? "";
  const seenIds = new Set<string>();

  // 1. Check Bundled Plugins (authorized extensions)
  const bundled = resolveBundledPluginSources({ workspaceDir: params.workspaceDir });
  for (const [id, source] of bundled.entries()) {
    const manifest = loadPluginManifest(source.localPath);
    candidates.push({
      id,
      name: manifest.ok ? manifest.manifest.name || id : id,
      kind: "plugin",
      source: "bundled",
      description: manifest.ok ? manifest.manifest.description : undefined,
      installSpec: source.npmSpec || `file:${source.localPath}`,
      installed: true,
    });
    seenIds.add(id);
  }

  // 2. Scan extensions/ directory for ALL potential local plugins (including unbundled ones)
  const bundledDir = resolveBundledPluginsDir();
  if (bundledDir) {
    try {
      const entries = await fs.readdir(bundledDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "shared") {
          continue;
        }
        if (seenIds.has(entry.name)) {
          continue;
        }

        const pluginPath = path.join(bundledDir, entry.name);
        const manifest = loadPluginManifest(pluginPath);
        candidates.push({
          id: entry.name,
          name: manifest.ok ? manifest.manifest.name || entry.name : entry.name,
          kind: "plugin",
          source: "bundled",
          description: manifest.ok ? manifest.manifest.description : undefined,
          installSpec: `file:${pluginPath}`,
          installed: true,
        });
        seenIds.add(entry.name);
      }
    } catch {
      // ignore
    }
  }

  // 3. Check Workspace Skills (.agents/skills)
  const workspaceDir = params.workspaceDir ?? process.cwd();
  const skillEntries = loadWorkspaceSkillEntries(workspaceDir);
  for (const entry of skillEntries) {
    const id = entry.skill.name;
    if (seenIds.has(id)) continue;
    candidates.push({
      id,
      name: id,
      kind: "skill",
      source: "workspace",
      description: entry.skill.description,
      installed: true,
    });
    seenIds.add(id);
  }

  // Filter by query
  if (query) {
    return candidates.filter(
      (c) =>
        c.id.toLowerCase().includes(query) ||
        c.name.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query),
    );
  }

  return candidates;
}
