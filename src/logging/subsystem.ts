import { Chalk } from "chalk";
import type { Logger as TsLogger } from "tslog";
import { CHAT_CHANNEL_ORDER } from "../channels/registry.js";
import { isVerbose } from "../globals.js";
import { defaultRuntime, type RuntimeEnv } from "../runtime.js";
import { clearActiveProgressLine } from "../terminal/progress-line.js";
import { getConsoleSettings, shouldLogSubsystemToConsole } from "./console.js";
import { type LogLevel, levelToMinLevel } from "./levels.js";
import { getChildLogger, isFileLogLevelEnabled } from "./logger.js";
import { loggingState } from "./state.js";

type LogObj = { date?: Date } & Record<string, unknown>;

export interface SubsystemLogger {
  subsystem: string;
  isEnabled(level: LogLevel, target?: "any" | "console" | "file"): boolean;
  trace(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  fatal(message: string, meta?: Record<string, unknown>): void;
  raw(message: string): void;
  child(name: string): SubsystemLogger;
}

// --- Top-Level Flat Functions (No Nested Scopes) ---

function getFL(subsystem: string, state: { fl: TsLogger<LogObj> | null }): TsLogger<LogObj> {
  if (!state.fl) state.fl = getChildLogger({ subsystem });
  return state.fl;
}

function em(
  level: LogLevel,
  subsystem: string,
  state: { fl: TsLogger<LogObj> | null },
  m: string,
  x?: Record<string, unknown>,
) {
  const s = getConsoleSettings();
  let co: string | undefined;
  let fm = x;
  if (x && Object.keys(x).length > 0) {
    const { consoleMessage, ...rest } = x as any;
    if (typeof consoleMessage === "string") co = consoleMessage;
    fm = Object.keys(rest).length > 0 ? rest : undefined;
  }
  const fl = getFL(subsystem, state);
  if (level !== "silent") {
    const method = (fl as any)[level];
    if (typeof method === "function") {
      if (fm && Object.keys(fm).length > 0) method.call(fl, fm, m);
      else method.call(fl, m);
    }
  }
  if (!shouldLogToConsole(level, { level: s.level })) return;
  if (!shouldLogSubsystemToConsole(subsystem)) return;
  const dm = co ?? m;
  if (!isVerbose() && subsystem === "agent/embedded" && /(sessionId|runId)=probe-/.test(dm)) return;
  clearActiveProgressLine();
  const line = formatConsoleLine({
    level,
    subsystem,
    message: s.style === "json" ? m : dm,
    style: s.style,
    meta: fm,
  });
  const sink = loggingState.rawConsole ?? console;
  const method =
    loggingState.forceConsoleToStderr || level === "error" || level === "fatal"
      ? (sink.error ?? console.error)
      : level === "warn"
        ? (sink.warn ?? console.warn)
        : (sink.log ?? console.log);
  method(line);
}

function raw(subsystem: string, state: { fl: TsLogger<LogObj> | null }, m: string) {
  const fl = getFL(subsystem, state);
  const method = (fl as any).info;
  if (typeof method === "function") method.call(fl, { raw: true }, m);
  if (shouldLogSubsystemToConsole(subsystem)) {
    if (!isVerbose() && subsystem === "agent/embedded" && /(sessionId|runId)=probe-/.test(m))
      return;
    clearActiveProgressLine();
    (loggingState.rawConsole ?? console).log(m);
  }
}

function isEn(
  level: LogLevel,
  subsystem: string,
  target: "any" | "console" | "file" = "any",
): boolean {
  const s = getConsoleSettings();
  const isC =
    shouldLogToConsole(level, { level: s.level }) && shouldLogSubsystemToConsole(subsystem);
  const isF = isFileLogLevelEnabled(level);
  return target === "console" ? isC : target === "file" ? isF : isC || isF;
}

// --- Stateless Helpers (Implicitly Hoisted) ---

function shouldLogToConsole(level: LogLevel, settings: { level: LogLevel }): boolean {
  if (settings.level === "silent") return false;
  return levelToMinLevel(level) <= levelToMinLevel(settings.level);
}

const inspectValue = (() => {
  const getBuiltinModule = (process as any).getBuiltinModule;
  if (typeof getBuiltinModule !== "function") return null;
  try {
    const util = getBuiltinModule("util") as any;
    return typeof util.inspect === "function" ? util.inspect : null;
  } catch {
    return null;
  }
})();

function formatRuntimeArg(arg: unknown): string {
  if (typeof arg === "string") return arg;
  if (inspectValue) return inspectValue(arg);
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

function getColorForConsole(): any {
  const hasForceColor =
    typeof process.env.FORCE_COLOR === "string" &&
    process.env.FORCE_COLOR.trim().length > 0 &&
    process.env.FORCE_COLOR.trim() !== "0";
  if (process.env.NO_COLOR && !hasForceColor) return new Chalk({ level: 0 });
  const hasTty = Boolean(process.stdout.isTTY || process.stderr.isTTY);
  const isRich = !!(
    process.env.COLORTERM ||
    process.env.TERM_PROGRAM ||
    (process.env.TERM && process.env.TERM.toLowerCase() !== "dumb")
  );
  return hasTty || isRich ? new Chalk({ level: 1 }) : new Chalk({ level: 0 });
}

export function stripRedundantSubsystemPrefixForConsole(subsystem: string): string {
  const parts = subsystem.split("/").filter(Boolean);
  const original = parts.join("/") || subsystem;
  const prefixesToDrop = ["gateway", "channels", "providers"];
  while (parts.length > 0 && prefixesToDrop.includes(parts[0])) parts.shift();
  if (parts.length === 0) return original;
  if (new Set(CHAT_CHANNEL_ORDER as readonly any[]).has(parts[0])) return parts[0];
  if (parts.length > 2) return parts.slice(-2).join("/");
  return parts.join("/");
}

function formatConsoleLine(opts: {
  level: LogLevel;
  subsystem: string;
  message: string;
  style: "pretty" | "compact" | "json";
  meta?: Record<string, unknown>;
}): string {
  const displaySubsystem =
    opts.style === "json"
      ? opts.subsystem
      : stripRedundantSubsystemPrefixForConsole(opts.subsystem);
  if (opts.style === "json")
    return JSON.stringify({
      time: new Date().toISOString(),
      level: opts.level,
      subsystem: displaySubsystem,
      message: opts.message,
      ...opts.meta,
    });
  const color = getColorForConsole();
  const subsystemColor = (() => {
    const overrides: Record<string, string> = { "gmail-watcher": "blue" };
    if (overrides[displaySubsystem]) return color[overrides[displaySubsystem] as any];
    let hash = 0;
    for (let i = 0; i < displaySubsystem.length; i++)
      hash = (hash * 31 + displaySubsystem.charCodeAt(i)) | 0;
    const colors = ["cyan", "green", "yellow", "blue", "magenta", "red"];
    return color[colors[Math.abs(hash) % colors.length] as any];
  })();
  const levelColor =
    opts.level === "error" || opts.level === "fatal"
      ? color.red
      : opts.level === "warn"
        ? color.yellow
        : opts.level === "debug" || opts.level === "trace"
          ? color.gray
          : color.cyan;
  const time =
    opts.style === "pretty"
      ? color.gray(new Date().toISOString().slice(11, 19))
      : loggingState.consoleTimestampPrefix
        ? color.gray(new Date().toISOString())
        : "";
  return `${[time, subsystemColor(`[${displaySubsystem}]`)].filter(Boolean).join(" ")} ${levelColor(opts.message)}`;
}

// --- Main Factory ---

export function createSubsystemLogger(subsystem: string): SubsystemLogger {
  const state: { fl: TsLogger<LogObj> | null } = { fl: null };
  return {
    subsystem,
    isEnabled(l, t) {
      return isEn(l, subsystem, t);
    },
    trace(m, x) {
      em("trace", subsystem, state, m, x);
    },
    debug(m, x) {
      em("debug", subsystem, state, m, x);
    },
    info(m, x) {
      em("info", subsystem, state, m, x);
    },
    warn(m, x) {
      em("warn", subsystem, state, m, x);
    },
    error(m, x) {
      em("error", subsystem, state, m, x);
    },
    fatal(m, x) {
      em("fatal", subsystem, state, m, x);
    },
    raw(m) {
      raw(subsystem, state, m);
    },
    child(n) {
      return createSubsystemLogger(`${subsystem}/${n}`);
    },
  };
}

export function runtimeForLogger(
  logger: SubsystemLogger,
  exit: RuntimeEnv["exit"] = defaultRuntime.exit,
): RuntimeEnv {
  const formatArgs = function (...args: unknown[]) {
    return args.map(formatRuntimeArg).join(" ").trim();
  };
  return {
    log: function (...args: unknown[]) {
      logger.info(formatArgs(...args));
    },
    error: function (...args: unknown[]) {
      logger.error(formatArgs(...args));
    },
    exit,
  };
}

export function createSubsystemRuntime(
  subsystem: string,
  exit: RuntimeEnv["exit"] = defaultRuntime.exit,
): RuntimeEnv {
  return runtimeForLogger(createSubsystemLogger(subsystem), exit);
}
