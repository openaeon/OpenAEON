import { t as __exportAll } from "./rolldown-runtime.js";
import { l as escapeRegExp } from "./utils.js";
import { i as listThinkingLevels } from "./thinking.js";
import { b as getActivePluginRegistry } from "./subsystem.js";
import {
  Gi as DEFAULT_MODEL,
  Ki as DEFAULT_PROVIDER,
  h as resolveConfiguredModelRef,
} from "./model-selection.js";
import { n as listChannelDocks } from "./dock.js";
import { t as isCommandFlagEnabled } from "./commands.js";

//#region src/auto-reply/commands-args.ts
function normalizeArgValue(value) {
  if (value == null) return;
  let text;
  if (typeof value === "string") text = value.trim();
  else if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint")
    text = String(value).trim();
  else if (typeof value === "symbol") text = value.toString().trim();
  else if (typeof value === "function") text = value.toString().trim();
  else text = JSON.stringify(value);
  return text ? text : void 0;
}
function formatActionArgs(values, params) {
  const action = normalizeArgValue(values.action)?.toLowerCase();
  const path = normalizeArgValue(values.path);
  const value = normalizeArgValue(values.value);
  if (!action) return;
  const knownAction = params.formatKnownAction(action, path);
  if (knownAction) return knownAction;
  return formatSetUnsetArgAction(action, {
    path,
    value,
  });
}
const formatConfigArgs = (values) =>
  formatActionArgs(values, {
    formatKnownAction: (action, path) => {
      if (action === "show" || action === "get") return path ? `${action} ${path}` : action;
    },
  });
const formatDebugArgs = (values) =>
  formatActionArgs(values, {
    formatKnownAction: (action) => {
      if (action === "show" || action === "reset") return action;
    },
  });
function formatSetUnsetArgAction(action, params) {
  if (action === "unset") return params.path ? `${action} ${params.path}` : action;
  if (action === "set") {
    if (!params.path) return action;
    if (!params.value) return `${action} ${params.path}`;
    return `${action} ${params.path}=${params.value}`;
  }
  return action;
}
const formatQueueArgs = (values) => {
  const mode = normalizeArgValue(values.mode);
  const debounce = normalizeArgValue(values.debounce);
  const cap = normalizeArgValue(values.cap);
  const drop = normalizeArgValue(values.drop);
  const parts = [];
  if (mode) parts.push(mode);
  if (debounce) parts.push(`debounce:${debounce}`);
  if (cap) parts.push(`cap:${cap}`);
  if (drop) parts.push(`drop:${drop}`);
  return parts.length > 0 ? parts.join(" ") : void 0;
};
const formatExecArgs = (values) => {
  const host = normalizeArgValue(values.host);
  const security = normalizeArgValue(values.security);
  const ask = normalizeArgValue(values.ask);
  const node = normalizeArgValue(values.node);
  const parts = [];
  if (host) parts.push(`host=${host}`);
  if (security) parts.push(`security=${security}`);
  if (ask) parts.push(`ask=${ask}`);
  if (node) parts.push(`node=${node}`);
  return parts.length > 0 ? parts.join(" ") : void 0;
};
const COMMAND_ARG_FORMATTERS = {
  config: formatConfigArgs,
  debug: formatDebugArgs,
  queue: formatQueueArgs,
  exec: formatExecArgs,
};

//#endregion
//#region src/auto-reply/commands-registry.data.ts
function defineChatCommand(command) {
  const aliases = (command.textAliases ?? (command.textAlias ? [command.textAlias] : []))
    .map((alias) => alias.trim())
    .filter(Boolean);
  const scope =
    command.scope ?? (command.nativeName ? (aliases.length ? "both" : "native") : "text");
  const acceptsArgs = command.acceptsArgs ?? Boolean(command.args?.length);
  const argsParsing = command.argsParsing ?? (command.args?.length ? "positional" : "none");
  return {
    key: command.key,
    nativeName: command.nativeName,
    description: command.description,
    acceptsArgs,
    args: command.args,
    argsParsing,
    formatArgs: command.formatArgs,
    argsMenu: command.argsMenu,
    textAliases: aliases,
    scope,
    category: command.category,
  };
}
function defineDockCommand(dock) {
  return defineChatCommand({
    key: `dock:${dock.id}`,
    nativeName: `dock_${dock.id}`,
    description: `切换到 ${dock.id} 进行回复`,
    textAliases: [`/dock-${dock.id}`, `/dock_${dock.id}`],
    category: "docks",
  });
}
function registerAlias(commands, key, ...aliases) {
  const command = commands.find((entry) => entry.key === key);
  if (!command) throw new Error(`registerAlias: unknown command key: ${key}`);
  const existing = new Set(command.textAliases.map((alias) => alias.trim().toLowerCase()));
  for (const alias of aliases) {
    const trimmed = alias.trim();
    if (!trimmed) continue;
    const lowered = trimmed.toLowerCase();
    if (existing.has(lowered)) continue;
    existing.add(lowered);
    command.textAliases.push(trimmed);
  }
}
function assertCommandRegistry(commands) {
  const keys = /* @__PURE__ */ new Set();
  const nativeNames = /* @__PURE__ */ new Set();
  const textAliases = /* @__PURE__ */ new Set();
  for (const command of commands) {
    if (keys.has(command.key)) throw new Error(`Duplicate command key: ${command.key}`);
    keys.add(command.key);
    const nativeName = command.nativeName?.trim();
    if (command.scope === "text") {
      if (nativeName) throw new Error(`Text-only command has native name: ${command.key}`);
      if (command.textAliases.length === 0)
        throw new Error(`Text-only command missing text alias: ${command.key}`);
    } else if (!nativeName) throw new Error(`Native command missing native name: ${command.key}`);
    else {
      const nativeKey = nativeName.toLowerCase();
      if (nativeNames.has(nativeKey)) throw new Error(`Duplicate native command: ${nativeName}`);
      nativeNames.add(nativeKey);
    }
    if (command.scope === "native" && command.textAliases.length > 0)
      throw new Error(`Native-only command has text aliases: ${command.key}`);
    for (const alias of command.textAliases) {
      if (!alias.startsWith("/")) throw new Error(`Command alias missing leading '/': ${alias}`);
      const aliasKey = alias.toLowerCase();
      if (textAliases.has(aliasKey)) throw new Error(`Duplicate command alias: ${alias}`);
      textAliases.add(aliasKey);
    }
  }
}
let cachedCommands = null;
let cachedRegistry = null;
let cachedNativeCommandSurfaces = null;
let cachedNativeRegistry = null;
function buildChatCommands() {
  const commands = [
    defineChatCommand({
      key: "help",
      nativeName: "help",
      description: "显示可用命令",
      textAlias: "/help",
      category: "status",
    }),
    defineChatCommand({
      key: "commands",
      nativeName: "commands",
      description: "列出所有斜杠命令",
      textAlias: "/commands",
      category: "status",
    }),
    defineChatCommand({
      key: "skill",
      nativeName: "skill",
      description: "运行指定名称的技能",
      textAlias: "/skill",
      category: "tools",
      args: [
        {
          name: "name",
          description: "技能名称",
          type: "string",
          required: true,
        },
        {
          name: "input",
          description: "技能输入",
          type: "string",
          captureRemaining: true,
        },
      ],
    }),
    defineChatCommand({
      key: "status",
      nativeName: "status",
      description: "显示当前状态",
      textAlias: "/status",
      category: "status",
    }),
    defineChatCommand({
      key: "allowlist",
      description: "列出/添加/删除白名单条目",
      textAlias: "/allowlist",
      acceptsArgs: true,
      scope: "text",
      category: "management",
    }),
    defineChatCommand({
      key: "approve",
      nativeName: "approve",
      description: "批准或拒绝执行请求",
      textAlias: "/approve",
      acceptsArgs: true,
      category: "management",
    }),
    defineChatCommand({
      key: "context",
      nativeName: "context",
      description: "解释上下文的构建和使用方式",
      textAlias: "/context",
      acceptsArgs: true,
      category: "status",
    }),
    defineChatCommand({
      key: "export-session",
      nativeName: "export-session",
      description: "导出当前会话为包含完整系统提示的HTML文件",
      textAliases: ["/export-session", "/export"],
      acceptsArgs: true,
      category: "status",
      args: [
        {
          name: "path",
          description: "输出路径（默认：工作区）",
          type: "string",
          required: false,
        },
      ],
    }),
    defineChatCommand({
      key: "tts",
      nativeName: "tts",
      description: "控制文本转语音（TTS）",
      textAlias: "/tts",
      category: "media",
      args: [
        {
          name: "action",
          description: "TTS 操作",
          type: "string",
          choices: [
            {
              value: "on",
              label: "On",
            },
            {
              value: "off",
              label: "Off",
            },
            {
              value: "status",
              label: "Status",
            },
            {
              value: "provider",
              label: "Provider",
            },
            {
              value: "limit",
              label: "Limit",
            },
            {
              value: "summary",
              label: "Summary",
            },
            {
              value: "audio",
              label: "Audio",
            },
            {
              value: "help",
              label: "Help",
            },
          ],
        },
        {
          name: "value",
          description: "供应商、限制或文本",
          type: "string",
          captureRemaining: true,
        },
      ],
      argsMenu: {
        arg: "action",
        title:
          "TTS 操作：\n• on – 开启 TTS 语音响应\n• off – 关闭 TTS\n• status – 显示当前设置\n• provider – 设置语音供应商 (edge, elevenlabs, openai)\n• limit – 设置 TTS 最大字符数\n• summary – 切换长文本 AI 摘要\n• audio – 从自定义文本生成 TTS\n• help – 显示使用指南",
      },
    }),
    defineChatCommand({
      key: "whoami",
      nativeName: "whoami",
      description: "显示您的发送者ID",
      textAlias: "/whoami",
      category: "status",
    }),
    defineChatCommand({
      key: "session",
      nativeName: "session",
      description: "管理会话级设置",
      textAlias: "/session",
      category: "session",
      args: [
        {
          name: "action",
          description: "idle | max-age",
          type: "string",
          choices: ["idle", "max-age"],
        },
        {
          name: "value",
          description: "持续时间（24h, 90m）或 off",
          type: "string",
          captureRemaining: true,
        },
      ],
      argsMenu: "auto",
    }),
    defineChatCommand({
      key: "subagents",
      nativeName: "subagents",
      description: "列出、终止、记录、生成或引导此会话的子代理",
      textAlias: "/subagents",
      category: "management",
      args: [
        {
          name: "action",
          description: "list | kill | log | info | send | steer | spawn",
          type: "string",
          choices: ["list", "kill", "log", "info", "send", "steer", "spawn"],
        },
        {
          name: "target",
          description: "运行ID、索引或会话密钥",
          type: "string",
        },
        {
          name: "value",
          description: "额外输入（限制/消息）",
          type: "string",
          captureRemaining: true,
        },
      ],
      argsMenu: "auto",
    }),
    defineChatCommand({
      key: "acp",
      nativeName: "acp",
      description: "管理ACP会话和运行时选项",
      textAlias: "/acp",
      category: "management",
      args: [
        {
          name: "action",
          description: "要执行的操作",
          type: "string",
          choices: [
            "spawn",
            "cancel",
            "steer",
            "close",
            "sessions",
            "status",
            "set-mode",
            "set",
            "cwd",
            "permissions",
            "timeout",
            "model",
            "reset-options",
            "doctor",
            "install",
            "help",
          ],
        },
        {
          name: "value",
          description: "操作参数",
          type: "string",
          captureRemaining: true,
        },
      ],
      argsMenu: "auto",
    }),
    defineChatCommand({
      key: "focus",
      nativeName: "focus",
      description: "将此Discord线程绑定到会话目标",
      textAlias: "/focus",
      category: "management",
      args: [
        {
          name: "target",
          description: "子代理标签/索引或会话密钥/ID/标签",
          type: "string",
          captureRemaining: true,
        },
      ],
    }),
    defineChatCommand({
      key: "unfocus",
      nativeName: "unfocus",
      description: "移除当前Discord线程绑定",
      textAlias: "/unfocus",
      category: "management",
    }),
    defineChatCommand({
      key: "agents",
      nativeName: "agents",
      description: "列出此会话的线程绑定代理",
      textAlias: "/agents",
      category: "management",
    }),
    defineChatCommand({
      key: "kill",
      nativeName: "kill",
      description: "终止正在运行的子代理",
      textAlias: "/kill",
      category: "management",
      args: [
        {
          name: "target",
          description: "标签、运行ID、索引或 all",
          type: "string",
        },
      ],
      argsMenu: "auto",
    }),
    defineChatCommand({
      key: "steer",
      nativeName: "steer",
      description: "向正在运行的子代理发送指导",
      textAlias: "/steer",
      category: "management",
      args: [
        {
          name: "target",
          description: "标签、运行ID或索引",
          type: "string",
        },
        {
          name: "message",
          description: "指导消息",
          type: "string",
          captureRemaining: true,
        },
      ],
    }),
    defineChatCommand({
      key: "config",
      nativeName: "config",
      description: "显示或设置配置值",
      textAlias: "/config",
      category: "management",
      args: [
        {
          name: "action",
          description: "show | get | set | unset",
          type: "string",
          choices: ["show", "get", "set", "unset"],
        },
        {
          name: "path",
          description: "配置路径",
          type: "string",
        },
        {
          name: "value",
          description: "设置的值",
          type: "string",
          captureRemaining: true,
        },
      ],
      argsParsing: "none",
      formatArgs: COMMAND_ARG_FORMATTERS.config,
    }),
    defineChatCommand({
      key: "debug",
      nativeName: "debug",
      description: "设置运行时调试覆盖",
      textAlias: "/debug",
      category: "management",
      args: [
        {
          name: "action",
          description: "show | reset | set | unset",
          type: "string",
          choices: ["show", "reset", "set", "unset"],
        },
        {
          name: "path",
          description: "调试路径",
          type: "string",
        },
        {
          name: "value",
          description: "设置的值",
          type: "string",
          captureRemaining: true,
        },
      ],
      argsParsing: "none",
      formatArgs: COMMAND_ARG_FORMATTERS.debug,
    }),
    defineChatCommand({
      key: "usage",
      nativeName: "usage",
      description: "使用量页脚或成本摘要",
      textAlias: "/usage",
      category: "options",
      args: [
        {
          name: "mode",
          description: "off, tokens, full, 或 cost",
          type: "string",
          choices: ["off", "tokens", "full", "cost"],
        },
      ],
      argsMenu: "auto",
    }),
    defineChatCommand({
      key: "stop",
      nativeName: "stop",
      description: "停止当前运行",
      textAlias: "/stop",
      category: "session",
    }),
    defineChatCommand({
      key: "restart",
      nativeName: "restart",
      description: "重启 OPENAEON",
      textAlias: "/restart",
      category: "tools",
    }),
    defineChatCommand({
      key: "activation",
      nativeName: "activation",
      description: "设置群组激活模式",
      textAlias: "/activation",
      category: "management",
      args: [
        {
          name: "mode",
          description: "mention 或 always",
          type: "string",
          choices: ["mention", "always"],
        },
      ],
      argsMenu: "auto",
    }),
    defineChatCommand({
      key: "send",
      nativeName: "send",
      description: "设置发送策略",
      textAlias: "/send",
      category: "management",
      args: [
        {
          name: "mode",
          description: "on, off, 或 inherit",
          type: "string",
          choices: ["on", "off", "inherit"],
        },
      ],
      argsMenu: "auto",
    }),
    defineChatCommand({
      key: "reset",
      nativeName: "reset",
      description: "重置当前会话",
      textAlias: "/reset",
      acceptsArgs: true,
      category: "session",
    }),
    defineChatCommand({
      key: "new",
      nativeName: "new",
      description: "开始新会话",
      textAlias: "/new",
      acceptsArgs: true,
      category: "session",
    }),
    defineChatCommand({
      key: "compact",
      nativeName: "compact",
      description: "压缩会话上下文",
      textAlias: "/compact",
      category: "session",
      args: [
        {
          name: "instructions",
          description: "额外压缩指令",
          type: "string",
          captureRemaining: true,
        },
      ],
    }),
    defineChatCommand({
      key: "think",
      nativeName: "think",
      description: "设置思考深度",
      textAlias: "/think",
      category: "options",
      args: [
        {
          name: "level",
          description: "off, minimal, low, medium, high, xhigh",
          type: "string",
          choices: ({ provider, model }) => listThinkingLevels(provider, model),
        },
      ],
      argsMenu: "auto",
    }),
    defineChatCommand({
      key: "verbose",
      nativeName: "verbose",
      description: "切换详细模式",
      textAlias: "/verbose",
      category: "options",
      args: [
        {
          name: "mode",
          description: "on 或 off",
          type: "string",
          choices: ["on", "off"],
        },
      ],
      argsMenu: "auto",
    }),
    defineChatCommand({
      key: "reasoning",
      nativeName: "reasoning",
      description: "切换推理可见性",
      textAlias: "/reasoning",
      category: "options",
      args: [
        {
          name: "mode",
          description: "on, off, 或 stream",
          type: "string",
          choices: ["on", "off", "stream"],
        },
      ],
      argsMenu: "auto",
    }),
    defineChatCommand({
      key: "elevated",
      nativeName: "elevated",
      description: "切换提升模式",
      textAlias: "/elevated",
      category: "options",
      args: [
        {
          name: "mode",
          description: "on, off, ask, 或 full",
          type: "string",
          choices: ["on", "off", "ask", "full"],
        },
      ],
      argsMenu: "auto",
    }),
    defineChatCommand({
      key: "exec",
      nativeName: "exec",
      description: "设置此会话的默认执行选项",
      textAlias: "/exec",
      category: "options",
      args: [
        {
          name: "host",
          description: "sandbox, gateway, 或 node",
          type: "string",
          choices: ["sandbox", "gateway", "node"],
        },
        {
          name: "security",
          description: "deny, allowlist, 或 full",
          type: "string",
          choices: ["deny", "allowlist", "full"],
        },
        {
          name: "ask",
          description: "off, on-miss, 或 always",
          type: "string",
          choices: ["off", "on-miss", "always"],
        },
        {
          name: "node",
          description: "节点ID或名称",
          type: "string",
        },
      ],
      argsParsing: "none",
      formatArgs: COMMAND_ARG_FORMATTERS.exec,
    }),
    defineChatCommand({
      key: "model",
      nativeName: "model",
      description: "显示或设置模型",
      textAlias: "/model",
      category: "options",
      args: [
        {
          name: "model",
          description: "模型ID（provider/model 或 id）",
          type: "string",
        },
      ],
    }),
    defineChatCommand({
      key: "models",
      nativeName: "models",
      description: "列出模型供应商或供应商模型",
      textAlias: "/models",
      argsParsing: "none",
      acceptsArgs: true,
      category: "options",
    }),
    defineChatCommand({
      key: "seal",
      nativeName: "seal",
      description: "将记忆公理封装到逻辑门",
      textAliases: ["/seal", "/distill"],
      category: "session",
    }),
    defineChatCommand({
      key: "queue",
      nativeName: "queue",
      description: "调整队列设置",
      textAlias: "/queue",
      category: "options",
      args: [
        {
          name: "mode",
          description: "队列模式",
          type: "string",
          choices: ["steer", "interrupt", "followup", "collect", "steer-backlog"],
        },
        {
          name: "debounce",
          description: "防抖时长（如 500ms, 2s）",
          type: "string",
        },
        {
          name: "cap",
          description: "队列上限",
          type: "number",
        },
        {
          name: "drop",
          description: "丢弃策略",
          type: "string",
          choices: ["old", "new", "summarize"],
        },
      ],
      argsParsing: "none",
      formatArgs: COMMAND_ARG_FORMATTERS.queue,
    }),
    defineChatCommand({
      key: "bash",
      description: "运行主机Shell命令（仅主机）",
      textAlias: "/bash",
      scope: "text",
      category: "tools",
      args: [
        {
          name: "command",
          description: "Shell command",
          type: "string",
          captureRemaining: true,
        },
      ],
    }),
    ...listChannelDocks()
      .filter((dock) => dock.capabilities.nativeCommands)
      .map((dock) => defineDockCommand(dock)),
  ];
  registerAlias(commands, "whoami", "/id");
  registerAlias(commands, "think", "/thinking", "/t");
  registerAlias(commands, "verbose", "/v");
  registerAlias(commands, "reasoning", "/reason");
  registerAlias(commands, "elevated", "/elev");
  registerAlias(commands, "steer", "/tell");
  assertCommandRegistry(commands);
  return commands;
}
function getChatCommands() {
  const registry = getActivePluginRegistry();
  if (cachedCommands && registry === cachedRegistry) return cachedCommands;
  const commands = buildChatCommands();
  cachedCommands = commands;
  cachedRegistry = registry;
  cachedNativeCommandSurfaces = null;
  return commands;
}
function getNativeCommandSurfaces() {
  const registry = getActivePluginRegistry();
  if (cachedNativeCommandSurfaces && registry === cachedNativeRegistry)
    return cachedNativeCommandSurfaces;
  cachedNativeCommandSurfaces = new Set(
    listChannelDocks()
      .filter((dock) => dock.capabilities.nativeCommands)
      .map((dock) => dock.id),
  );
  cachedNativeRegistry = registry;
  return cachedNativeCommandSurfaces;
}

//#endregion
//#region src/auto-reply/commands-registry.ts
var commands_registry_exports = /* @__PURE__ */ __exportAll({
  buildCommandText: () => buildCommandText,
  buildCommandTextFromArgs: () => buildCommandTextFromArgs,
  findCommandByNativeName: () => findCommandByNativeName,
  getCommandDetection: () => getCommandDetection,
  isCommandEnabled: () => isCommandEnabled,
  isCommandMessage: () => isCommandMessage,
  isNativeCommandSurface: () => isNativeCommandSurface,
  listChatCommands: () => listChatCommands,
  listChatCommandsForConfig: () => listChatCommandsForConfig,
  listNativeCommandSpecs: () => listNativeCommandSpecs,
  listNativeCommandSpecsForConfig: () => listNativeCommandSpecsForConfig,
  maybeResolveTextAlias: () => maybeResolveTextAlias,
  normalizeCommandBody: () => normalizeCommandBody,
  parseCommandArgs: () => parseCommandArgs,
  resolveCommandArgChoices: () => resolveCommandArgChoices,
  resolveCommandArgMenu: () => resolveCommandArgMenu,
  resolveTextCommand: () => resolveTextCommand,
  serializeCommandArgs: () => serializeCommandArgs,
  shouldHandleTextCommands: () => shouldHandleTextCommands,
});
let cachedTextAliasMap = null;
let cachedTextAliasCommands = null;
let cachedDetection;
let cachedDetectionCommands = null;
function getTextAliasMap() {
  const commands = getChatCommands();
  if (cachedTextAliasMap && cachedTextAliasCommands === commands) return cachedTextAliasMap;
  const map = /* @__PURE__ */ new Map();
  for (const command of commands) {
    const canonical = command.textAliases[0]?.trim() || `/${command.key}`;
    const acceptsArgs = Boolean(command.acceptsArgs);
    for (const alias of command.textAliases) {
      const normalized = alias.trim().toLowerCase();
      if (!normalized) continue;
      if (!map.has(normalized))
        map.set(normalized, {
          key: command.key,
          canonical,
          acceptsArgs,
        });
    }
  }
  cachedTextAliasMap = map;
  cachedTextAliasCommands = commands;
  return map;
}
function buildSkillCommandDefinitions(skillCommands) {
  if (!skillCommands || skillCommands.length === 0) return [];
  return skillCommands.map((spec) => ({
    key: `skill:${spec.skillName}`,
    nativeName: spec.name,
    description: spec.description,
    textAliases: [`/${spec.name}`],
    acceptsArgs: true,
    argsParsing: "none",
    scope: "both",
  }));
}
function listChatCommands(params) {
  const commands = getChatCommands();
  if (!params?.skillCommands?.length) return [...commands];
  return [...commands, ...buildSkillCommandDefinitions(params.skillCommands)];
}
function isCommandEnabled(cfg, commandKey) {
  if (commandKey === "config") return isCommandFlagEnabled(cfg, "config");
  if (commandKey === "debug") return isCommandFlagEnabled(cfg, "debug");
  if (commandKey === "bash") return isCommandFlagEnabled(cfg, "bash");
  return true;
}
function listChatCommandsForConfig(cfg, params) {
  const base = getChatCommands().filter((command) => isCommandEnabled(cfg, command.key));
  if (!params?.skillCommands?.length) return base;
  return [...base, ...buildSkillCommandDefinitions(params.skillCommands)];
}
const NATIVE_NAME_OVERRIDES = {
  discord: { tts: "voice" },
  slack: { status: "agentstatus" },
};
function resolveNativeName(command, provider) {
  if (!command.nativeName) return;
  if (provider) {
    const override = NATIVE_NAME_OVERRIDES[provider]?.[command.key];
    if (override) return override;
  }
  return command.nativeName;
}
function toNativeCommandSpec(command, provider) {
  return {
    name: resolveNativeName(command, provider) ?? command.key,
    description: command.description,
    acceptsArgs: Boolean(command.acceptsArgs),
    args: command.args,
  };
}
function listNativeSpecsFromCommands(commands, provider) {
  return commands
    .filter((command) => command.scope !== "text" && command.nativeName)
    .map((command) => toNativeCommandSpec(command, provider));
}
function listNativeCommandSpecs(params) {
  return listNativeSpecsFromCommands(
    listChatCommands({ skillCommands: params?.skillCommands }),
    params?.provider,
  );
}
function listNativeCommandSpecsForConfig(cfg, params) {
  return listNativeSpecsFromCommands(listChatCommandsForConfig(cfg, params), params?.provider);
}
function findCommandByNativeName(name, provider) {
  const normalized = name.trim().toLowerCase();
  return getChatCommands().find(
    (command) =>
      command.scope !== "text" &&
      resolveNativeName(command, provider)?.toLowerCase() === normalized,
  );
}
function buildCommandText(commandName, args) {
  const trimmedArgs = args?.trim();
  return trimmedArgs ? `/${commandName} ${trimmedArgs}` : `/${commandName}`;
}
function parsePositionalArgs(definitions, raw) {
  const values = {};
  const trimmed = raw.trim();
  if (!trimmed) return values;
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  let index = 0;
  for (const definition of definitions) {
    if (index >= tokens.length) break;
    if (definition.captureRemaining) {
      values[definition.name] = tokens.slice(index).join(" ");
      index = tokens.length;
      break;
    }
    values[definition.name] = tokens[index];
    index += 1;
  }
  return values;
}
function formatPositionalArgs(definitions, values) {
  const parts = [];
  for (const definition of definitions) {
    const value = values[definition.name];
    if (value == null) continue;
    let rendered;
    if (typeof value === "string") rendered = value.trim();
    else rendered = String(value);
    if (!rendered) continue;
    parts.push(rendered);
    if (definition.captureRemaining) break;
  }
  return parts.length > 0 ? parts.join(" ") : void 0;
}
function parseCommandArgs(command, raw) {
  const trimmed = raw?.trim();
  if (!trimmed) return;
  if (!command.args || command.argsParsing === "none") return { raw: trimmed };
  return {
    raw: trimmed,
    values: parsePositionalArgs(command.args, trimmed),
  };
}
function serializeCommandArgs(command, args) {
  if (!args) return;
  const raw = args.raw?.trim();
  if (raw) return raw;
  if (!args.values || !command.args) return;
  if (command.formatArgs) return command.formatArgs(args.values);
  return formatPositionalArgs(command.args, args.values);
}
function buildCommandTextFromArgs(command, args) {
  return buildCommandText(command.nativeName ?? command.key, serializeCommandArgs(command, args));
}
function resolveDefaultCommandContext(cfg) {
  const resolved = resolveConfiguredModelRef({
    cfg: cfg ?? {},
    defaultProvider: DEFAULT_PROVIDER,
    defaultModel: DEFAULT_MODEL,
  });
  return {
    provider: resolved.provider ?? DEFAULT_PROVIDER,
    model: resolved.model ?? DEFAULT_MODEL,
  };
}
function resolveCommandArgChoices(params) {
  const { command, arg, cfg } = params;
  if (!arg.choices) return [];
  const provided = arg.choices;
  return (
    Array.isArray(provided)
      ? provided
      : (() => {
          const defaults = resolveDefaultCommandContext(cfg);
          return provided({
            cfg,
            provider: params.provider ?? defaults.provider,
            model: params.model ?? defaults.model,
            command,
            arg,
          });
        })()
  ).map((choice) =>
    typeof choice === "string"
      ? {
          value: choice,
          label: choice,
        }
      : choice,
  );
}
function resolveCommandArgMenu(params) {
  const { command, args, cfg } = params;
  if (!command.args || !command.argsMenu) return null;
  if (command.argsParsing === "none") return null;
  const argSpec = command.argsMenu;
  const argName =
    argSpec === "auto"
      ? command.args.find(
          (arg) =>
            resolveCommandArgChoices({
              command,
              arg,
              cfg,
            }).length > 0,
        )?.name
      : argSpec.arg;
  if (!argName) return null;
  if (args?.values && args.values[argName] != null) return null;
  if (args?.raw && !args.values) return null;
  const arg = command.args.find((entry) => entry.name === argName);
  if (!arg) return null;
  const choices = resolveCommandArgChoices({
    command,
    arg,
    cfg,
  });
  if (choices.length === 0) return null;
  return {
    arg,
    choices,
    title: argSpec !== "auto" ? argSpec.title : void 0,
  };
}
function normalizeCommandBody(raw, options) {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return trimmed;
  const newline = trimmed.indexOf("\n");
  const singleLine = newline === -1 ? trimmed : trimmed.slice(0, newline).trim();
  const colonMatch = singleLine.match(/^\/([^\s:]+)\s*:(.*)$/);
  const normalized = colonMatch
    ? (() => {
        const [, command, rest] = colonMatch;
        const normalizedRest = rest.trimStart();
        return normalizedRest ? `/${command} ${normalizedRest}` : `/${command}`;
      })()
    : singleLine;
  const normalizedBotUsername = options?.botUsername?.trim().toLowerCase();
  const mentionMatch = normalizedBotUsername
    ? normalized.match(/^\/([^\s@]+)@([^\s]+)(.*)$/)
    : null;
  const commandBody =
    mentionMatch && mentionMatch[2].toLowerCase() === normalizedBotUsername
      ? `/${mentionMatch[1]}${mentionMatch[3] ?? ""}`
      : normalized;
  const lowered = commandBody.toLowerCase();
  const textAliasMap = getTextAliasMap();
  const exact = textAliasMap.get(lowered);
  if (exact) return exact.canonical;
  const tokenMatch = commandBody.match(/^\/([^\s]+)(?:\s+([\s\S]+))?$/);
  if (!tokenMatch) return commandBody;
  const [, token, rest] = tokenMatch;
  const tokenKey = `/${token.toLowerCase()}`;
  const tokenSpec = textAliasMap.get(tokenKey);
  if (!tokenSpec) return commandBody;
  if (rest && !tokenSpec.acceptsArgs) return commandBody;
  const normalizedRest = rest?.trimStart();
  return normalizedRest ? `${tokenSpec.canonical} ${normalizedRest}` : tokenSpec.canonical;
}
function isCommandMessage(raw) {
  return normalizeCommandBody(raw).startsWith("/");
}
function getCommandDetection(_cfg) {
  const commands = getChatCommands();
  if (cachedDetection && cachedDetectionCommands === commands) return cachedDetection;
  const exact = /* @__PURE__ */ new Set();
  const patterns = [];
  for (const cmd of commands)
    for (const alias of cmd.textAliases) {
      const normalized = alias.trim().toLowerCase();
      if (!normalized) continue;
      exact.add(normalized);
      const escaped = escapeRegExp(normalized);
      if (!escaped) continue;
      if (cmd.acceptsArgs) patterns.push(`${escaped}(?:\\s+.+|\\s*:\\s*.*)?`);
      else patterns.push(`${escaped}(?:\\s*:\\s*)?`);
    }
  cachedDetection = {
    exact,
    regex: patterns.length ? new RegExp(`^(?:${patterns.join("|")})$`, "i") : /$^/,
  };
  cachedDetectionCommands = commands;
  return cachedDetection;
}
function maybeResolveTextAlias(raw, cfg) {
  const trimmed = normalizeCommandBody(raw).trim();
  if (!trimmed.startsWith("/")) return null;
  const detection = getCommandDetection(cfg);
  const normalized = trimmed.toLowerCase();
  if (detection.exact.has(normalized)) return normalized;
  if (!detection.regex.test(normalized)) return null;
  const tokenMatch = normalized.match(/^\/([^\s:]+)(?:\s|$)/);
  if (!tokenMatch) return null;
  const tokenKey = `/${tokenMatch[1]}`;
  return getTextAliasMap().has(tokenKey) ? tokenKey : null;
}
function resolveTextCommand(raw, cfg) {
  const trimmed = normalizeCommandBody(raw).trim();
  const alias = maybeResolveTextAlias(trimmed, cfg);
  if (!alias) return null;
  const spec = getTextAliasMap().get(alias);
  if (!spec) return null;
  const command = getChatCommands().find((entry) => entry.key === spec.key);
  if (!command) return null;
  if (!spec.acceptsArgs) return { command };
  return {
    command,
    args: trimmed.slice(alias.length).trim() || void 0,
  };
}
function isNativeCommandSurface(surface) {
  if (!surface) return false;
  return getNativeCommandSurfaces().has(surface.toLowerCase());
}
function shouldHandleTextCommands(params) {
  if (params.commandSource === "native") return true;
  if (params.cfg.commands?.text !== false) return true;
  return !isNativeCommandSurface(params.surface);
}

//#endregion
export {
  listChatCommands as a,
  listNativeCommandSpecsForConfig as c,
  parseCommandArgs as d,
  resolveCommandArgChoices as f,
  shouldHandleTextCommands as h,
  isCommandEnabled as i,
  maybeResolveTextAlias as l,
  serializeCommandArgs as m,
  commands_registry_exports as n,
  listChatCommandsForConfig as o,
  resolveCommandArgMenu as p,
  findCommandByNativeName as r,
  listNativeCommandSpecs as s,
  buildCommandTextFromArgs as t,
  normalizeCommandBody as u,
};
