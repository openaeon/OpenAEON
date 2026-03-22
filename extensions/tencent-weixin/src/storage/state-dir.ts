import os from "node:os";
import path from "node:path";

/** Resolve the OpenAEON state directory (mirrors core logic in src/infra). */
export function resolveStateDir(): string {
  return (
    process.env.OPENAEON_STATE_DIR?.trim() ||
    process.env.CLAWDBOT_STATE_DIR?.trim() ||
    path.join(os.homedir(), ".openaeon")
  );
}
