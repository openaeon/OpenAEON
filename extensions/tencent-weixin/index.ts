import type { OpenAEONPluginApi } from "openaeon/plugin-sdk";
import { buildChannelConfigSchema } from "openaeon/plugin-sdk";

import { weixinPlugin } from "./src/channel.js";
import { WeixinConfigSchema } from "./src/config/config-schema.js";
import { registerWeixinCli } from "./src/log-upload.js";
import { setWeixinRuntime } from "./src/runtime.js";

const plugin = {
  id: "tencent-weixin",
  name: "Weixin",
  description: "Weixin channel (getUpdates long-poll + sendMessage)",
  configSchema: buildChannelConfigSchema(WeixinConfigSchema),
  register(api: OpenAEONPluginApi) {
    if (!api?.runtime) {
      throw new Error("[weixin] api.runtime is not available in register()");
    }
    setWeixinRuntime(api.runtime);

    api.registerChannel({ plugin: weixinPlugin });
    api.registerCli(({ program, config }) => registerWeixinCli({ program, config }), {
      commands: ["tencent-weixin"],
    });
  },
};

export default plugin;
