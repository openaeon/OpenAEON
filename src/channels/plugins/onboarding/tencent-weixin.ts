/**
 * Onboarding adapter for the tencent-weixin (WeChat iLink) extension.
 *
 * Wires the plugin's existing QR-login flow (`auth.login`) into the interactive
 * wizard so users see a QR code immediately after selecting WeChat during
 * `openaeon setup`, without needing to run a separate
 * `openaeon channels login --channel tencent-weixin` command.
 */
import { formatCliCommand } from "../../../cli/command-format.js";
import type { OPENAEONConfig } from "../../../config/config.js";
import { formatDocsLink } from "../../../terminal/links.js";
import type { ChannelOnboardingAdapter } from "../onboarding-types.js";
import { listChannelPlugins } from "../index.js";

/** Channel id as declared in the plugin (must match weixinPlugin.id). */
const channel = "tencent-weixin" as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Synchronously detect whether any tencent-weixin account is saved. */
function detectWeixinLinked(): boolean {
  try {
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");

    const stateDir =
      process.env.OPENAEON_STATE_DIR?.trim() || `${process.env.HOME ?? "~"}/.openaeon`;
    const accountsDir = path.join(stateDir, "tencent-weixin", "accounts");

    if (!fs.existsSync(accountsDir)) {
      // Also check legacy single-account credentials file.
      const legacyCreds = path.join(stateDir, "credentials", "tencent-weixin", "credentials.json");
      if (fs.existsSync(legacyCreds)) {
        const data = JSON.parse(fs.readFileSync(legacyCreds, "utf-8")) as {
          token?: string;
        };
        return Boolean(data.token?.trim());
      }
      return false;
    }

    for (const file of fs.readdirSync(accountsDir)) {
      if (!file.endsWith(".json")) continue;
      try {
        const data = JSON.parse(fs.readFileSync(path.join(accountsDir, file), "utf-8")) as {
          token?: string;
        };
        if (data.token?.trim()) return true;
      } catch {
        // skip malformed files
      }
    }
  } catch {
    // If we cannot read the filesystem, assume not linked.
  }
  return false;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export const weixinOnboardingAdapter: ChannelOnboardingAdapter = {
  // Type cast: "tencent-weixin" is a ChannelChoice only when the plugin is
  // installed; the builtin onboarding-types declare a subset. The cast is safe
  // because the channel id is validated at runtime against the plugin registry.
  channel: channel as unknown as ChannelOnboardingAdapter["channel"],

  /**
   * Called by the wizard to build the channel-selection menu.
   */
  getStatus: async (_ctx) => {
    const linked = detectWeixinLinked();
    return {
      channel: channel as unknown as ChannelOnboardingAdapter["channel"],
      configured: linked,
      statusLines: [`WeChat (tencent-weixin): ${linked ? "linked ✅" : "not linked"}`],
      selectionHint: linked ? "linked" : "not linked",
      quickstartScore: linked ? 6 : 7,
    };
  },

  /**
   * Interactive configuration step — shown when user selects WeChat in wizard.
   */
  configure: async ({ cfg, runtime, prompter }) => {
    const linked = detectWeixinLinked();

    await prompter.note(
      [
        "WeChat requires scanning a QR code via the iLink gateway.",
        `Docs: ${formatDocsLink("/channels/tencent-weixin", "tencent-weixin")}`,
        "",
        linked
          ? "A WeChat account is already linked."
          : "No WeChat account found. Scan a QR code to link one now.",
      ].join("\n"),
      "WeChat (tencent-weixin)",
    );

    const wantsLink = await prompter.confirm({
      message: linked
        ? "WeChat already linked. Re-link now (scan a new QR)?"
        : "Link WeChat now (scan QR code)?",
      initialValue: !linked,
    });

    if (!wantsLink) {
      if (!linked) {
        await prompter.note(
          `Run \`${formatCliCommand("openaeon channels login --channel tencent-weixin")}\` later to link WeChat.`,
          "WeChat",
        );
      }
      return { cfg };
    }

    // Look up the tencent-weixin plugin from the registry and call auth.login.
    const plugin = listChannelPlugins().find((p) => p.id === "tencent-weixin");
    const authLogin = plugin?.auth?.login;

    if (!authLogin) {
      // Plugin not installed. Give a clear fallback message.
      await prompter.note(
        [
          "The tencent-weixin plugin is not installed or not loaded.",
          `Install it first: ${formatCliCommand("openaeon extension install tencent-weixin")}`,
          `Then link: ${formatCliCommand("openaeon channels login --channel tencent-weixin")}`,
        ].join("\n"),
        "WeChat plugin not found",
      );
      return { cfg };
    }

    // Delegate to the plugin's QR-login implementation. This prints the QR
    // to stdout (via qrcode-terminal) and blocks until the user scans it.
    try {
      runtime.log?.("Fetching WeChat QR code...");
      await authLogin({
        cfg: cfg as unknown as Parameters<typeof authLogin>[0]["cfg"],
        accountId: undefined,
        verbose: true,
        runtime: {
          log: (...args: unknown[]) => runtime.log?.(String(args[0] ?? "")),
          error: (...args: unknown[]) => runtime.error?.(String(args[0] ?? "")),
          exit: (code: number) => {
            throw new Error(`exit ${code}`);
          },
        },
      });
      runtime.log?.("✅ WeChat linked successfully.");
    } catch (err) {
      runtime.error?.(`WeChat QR login failed: ${String(err)}`);
      await prompter.note(
        [
          `Login failed: ${String(err)}`,
          `Retry manually: ${formatCliCommand("openaeon channels login --channel tencent-weixin")}`,
          `Docs: ${formatDocsLink("/channels/tencent-weixin", "tencent-weixin")}`,
        ].join("\n"),
        "WeChat login error",
      );
    }

    return { cfg };
  },
};
