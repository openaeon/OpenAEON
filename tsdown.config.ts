import { defineConfig } from "tsdown";

const env = {
  NODE_ENV: "production",
};

export default defineConfig({
  entry: {
    index: "src/index.ts",
    entry: "src/entry.ts",
    "daemon-cli": "src/cli/daemon-cli.ts",
    "warning-filter": "src/infra/warning-filter.ts",
    extensionAPI: "src/extensionAPI.ts",
    "hooks/bundled/boot-md/handler": "src/hooks/bundled/boot-md/handler.ts",
    "hooks/bundled/bootstrap-extra-files/handler":
      "src/hooks/bundled/bootstrap-extra-files/handler.ts",
    "hooks/bundled/session-memory/handler": "src/hooks/bundled/session-memory/handler.ts",
    "hooks/bundled/command-logger/handler": "src/hooks/bundled/command-logger/handler.ts",
    "hooks/llm-slug-generator": "src/hooks/llm-slug-generator.ts",
    "plugin-sdk/index": "src/plugin-sdk/index.ts",
    "plugin-sdk/account-id": "src/plugin-sdk/account-id.ts",
  },
  env,
  fixedExtension: false,
  platform: "node",
  minify: false,
  hash: false,
  clean: true,
});
