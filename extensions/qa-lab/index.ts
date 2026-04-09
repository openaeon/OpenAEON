import type { OpenAEONPluginApi } from "openaeon/plugin-sdk";
import { emptyPluginConfigSchema } from "openaeon/plugin-sdk";
import { registerQaLabCli } from "./src/cli.js";

const qaLabPlugin = {
  id: "qa-lab",
  name: "QA Lab",
  description: "Scenario catalog for reliability and multi-agent QA checks.",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenAEONPluginApi) {
    api.registerCli(
      ({ program }) => {
        registerQaLabCli({ program });
      },
      { commands: ["qa"] },
    );
  },
};

export default qaLabPlugin;
