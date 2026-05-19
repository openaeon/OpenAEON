import { Type } from "@sinclair/typebox";
import { optionalStringEnum, stringEnum } from "../schema/typebox.js";

const DESKTOP_ACTIONS = [
  "status",
  "permissions",
  "see",
  "inspect_ui",
  "image",
  "list",
  "click",
  "type",
  "set_value",
  "perform_action",
  "press",
  "hotkey",
  "scroll",
  "move",
  "window",
  "app",
  "menu",
  "menubar",
  "dock",
  "dialog",
  "sleep",
  "clean",
] as const;

const DESKTOP_LIST_KINDS = ["apps", "windows", "screens", "menubar", "permissions"] as const;
const DESKTOP_MODES = ["screen", "window", "frontmost", "multi", "area", "menu"] as const;
const DESKTOP_CLICK_TYPES = ["single", "double", "right"] as const;
const DESKTOP_SCROLL_DIRECTIONS = ["up", "down", "left", "right"] as const;
const DESKTOP_MOUSE_PROFILES = ["human", "linear"] as const;
const DESKTOP_WINDOW_SUBACTIONS = [
  "list",
  "focus",
  "move",
  "resize",
  "set_bounds",
  "close",
  "minimize",
  "maximize",
] as const;
const DESKTOP_APP_SUBACTIONS = [
  "list",
  "launch",
  "quit",
  "relaunch",
  "switch",
  "hide",
  "unhide",
] as const;
const DESKTOP_MENU_SUBACTIONS = ["list", "list_all", "click", "click_extra"] as const;
const DESKTOP_MENUBAR_SUBACTIONS = ["list", "click"] as const;
const DESKTOP_DOCK_SUBACTIONS = ["list", "launch", "right_click", "hide", "show"] as const;
const DESKTOP_DIALOG_SUBACTIONS = ["list", "click", "input", "file", "dismiss"] as const;
const DESKTOP_CLEAN_SCOPES = ["snapshot", "all_snapshots"] as const;

// Keep this flat: several providers reject root unions/anyOf.
export const DesktopToolSchema = Type.Object({
  action: stringEnum(DESKTOP_ACTIONS),
  bridgeSocket: Type.Optional(Type.String()),
  timeoutMs: Type.Optional(Type.Number()),
  noRemote: Type.Optional(Type.Boolean()),

  // Common app/window targeting.
  app: Type.Optional(Type.String()),
  pid: Type.Optional(Type.Number()),
  windowTitle: Type.Optional(Type.String()),
  windowId: Type.Optional(Type.Number()),
  windowIndex: Type.Optional(Type.Number()),
  snapshot: Type.Optional(Type.String()),

  // Observation/capture.
  mode: optionalStringEnum(DESKTOP_MODES),
  kind: optionalStringEnum(DESKTOP_LIST_KINDS),
  screenIndex: Type.Optional(Type.Number()),
  outputPath: Type.Optional(Type.String()),
  annotate: Type.Optional(Type.Boolean()),
  retina: Type.Optional(Type.Boolean()),
  analyze: Type.Optional(Type.String()),
  menubar: Type.Optional(Type.Boolean()),
  maxDepth: Type.Optional(Type.Number()),
  maxElements: Type.Optional(Type.Number()),
  maxChildren: Type.Optional(Type.Number()),

  // Element/input targeting.
  query: Type.Optional(Type.String()),
  on: Type.Optional(Type.String()),
  coords: Type.Optional(Type.String()),
  globalCoords: Type.Optional(Type.Boolean()),
  clickType: optionalStringEnum(DESKTOP_CLICK_TYPES),
  waitForMs: Type.Optional(Type.Number()),
  text: Type.Optional(Type.String()),
  value: Type.Optional(Type.String()),
  key: Type.Optional(Type.String()),
  keys: Type.Optional(Type.String()),
  clear: Type.Optional(Type.Boolean()),
  delayMs: Type.Optional(Type.Number()),
  count: Type.Optional(Type.Number()),
  direction: optionalStringEnum(DESKTOP_SCROLL_DIRECTIONS),
  amount: Type.Optional(Type.Number()),
  smooth: Type.Optional(Type.Boolean()),
  to: Type.Optional(Type.String()),
  durationMs: Type.Optional(Type.Number()),
  steps: Type.Optional(Type.Number()),
  profile: optionalStringEnum(DESKTOP_MOUSE_PROFILES),
  axAction: Type.Optional(Type.String()),

  // Compound command routing.
  subaction: Type.Optional(
    stringEnum([
      ...DESKTOP_WINDOW_SUBACTIONS,
      ...DESKTOP_APP_SUBACTIONS,
      ...DESKTOP_MENU_SUBACTIONS,
      ...DESKTOP_MENUBAR_SUBACTIONS,
      ...DESKTOP_DOCK_SUBACTIONS,
      ...DESKTOP_DIALOG_SUBACTIONS,
    ] as const),
  ),
  item: Type.Optional(Type.String()),
  menuPath: Type.Optional(Type.String()),
  title: Type.Optional(Type.String()),
  name: Type.Optional(Type.String()),
  filePath: Type.Optional(Type.String()),
  x: Type.Optional(Type.Number()),
  y: Type.Optional(Type.Number()),
  width: Type.Optional(Type.Number()),
  height: Type.Optional(Type.Number()),
  cleanScope: optionalStringEnum(DESKTOP_CLEAN_SCOPES),
});
