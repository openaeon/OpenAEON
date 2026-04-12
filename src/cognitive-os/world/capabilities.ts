import type { WorldCapability } from "../contracts/types.js";

export function defaultWorldCapabilities(): WorldCapability[] {
  return [
    { id: "browser.playwright", type: "browser", label: "Browser Automation", enabled: true },
    { id: "api.gateway", type: "api", label: "Gateway RPC/API", enabled: true },
    { id: "fs.local", type: "filesystem", label: "Local File System", enabled: true },
    { id: "db.sqlite", type: "database", label: "SQLite Data Access", enabled: true },
  ];
}
