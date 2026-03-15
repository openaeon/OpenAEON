import type { BrowserFormField } from "../client-actions-core.js";
import { normalizeBrowserFormField } from "../form-fields.js";
import type { BrowserRouteContext } from "../server-context.js";
import { withBrowserNavigationPolicy } from "../navigation-guard.js";
import { registerBrowserAgentActDownloadRoutes } from "./agent.act.download.js";
import { registerBrowserAgentActHookRoutes } from "./agent.act.hooks.js";
import {
  type ActKind,
  isActKind,
  parseClickButton,
  parseClickModifiers,
} from "./agent.act.shared.js";
import {
  getPwAiModule,
  handleRouteError,
  readBody,
  requirePwAi,
  resolveProfileContext,
  resolveTargetIdFromBody,
  withPlaywrightRouteContext,
  SELECTOR_UNSUPPORTED_MESSAGE,
} from "./agent.shared.js";
import { resolveTargetIdAfterNavigate } from "./agent.snapshot.js";
import type { BrowserRouteRegistrar } from "./types.js";
import { jsonError, toBoolean, toNumber, toStringArray, toStringOrEmpty } from "./utils.js";

export function registerBrowserAgentActRoutes(
  app: BrowserRouteRegistrar,
  ctx: BrowserRouteContext,
) {
  app.post("/act", async (req, res) => {
    const body = readBody(req);
    const kindRaw = toStringOrEmpty(body.kind);
    if (!isActKind(kindRaw)) {
      return jsonError(res, 400, "kind is required");
    }
    const kind: ActKind = kindRaw;
    const targetId = resolveTargetIdFromBody(body);
    if (Object.hasOwn(body, "selector") && kind !== "wait") {
      return jsonError(res, 400, SELECTOR_UNSUPPORTED_MESSAGE);
    }

    await withPlaywrightRouteContext({
      req,
      res,
      ctx,
      targetId,
      feature: `act:${kind}`,
      run: async ({ cdpUrl, tab, pw }) => {
        const evaluateEnabled = ctx.state().resolved.evaluateEnabled;

        switch (kind) {
          case "click": {
            const ref = toStringOrEmpty(body.ref);
            if (!ref) {
              return jsonError(res, 400, "ref is required");
            }
            const doubleClick = toBoolean(body.doubleClick) ?? false;
            const timeoutMs = toNumber(body.timeoutMs);
            const buttonRaw = toStringOrEmpty(body.button) || "";
            const button = buttonRaw ? parseClickButton(buttonRaw) : undefined;
            if (buttonRaw && !button) {
              return jsonError(res, 400, "button must be left|right|middle");
            }

            const modifiersRaw = toStringArray(body.modifiers) ?? [];
            const parsedModifiers = parseClickModifiers(modifiersRaw);
            if (parsedModifiers.error) {
              return jsonError(res, 400, parsedModifiers.error);
            }
            const modifiers = parsedModifiers.modifiers;
            const clickRequest: Parameters<typeof pw.clickViaPlaywright>[0] = {
              cdpUrl,
              targetId: tab.targetId,
              ref,
              doubleClick,
            };
            if (button) {
              clickRequest.button = button;
            }
            if (modifiers) {
              clickRequest.modifiers = modifiers;
            }
            if (timeoutMs) {
              clickRequest.timeoutMs = timeoutMs;
            }
            await pw.clickViaPlaywright(clickRequest);
            return res.json({ ok: true, targetId: tab.targetId, url: tab.url });
          }
          case "type": {
            const ref = toStringOrEmpty(body.ref);
            if (!ref) {
              return jsonError(res, 400, "ref is required");
            }
            if (typeof body.text !== "string") {
              return jsonError(res, 400, "text is required");
            }
            const text = body.text;
            const submit = toBoolean(body.submit) ?? false;
            const slowly = toBoolean(body.slowly) ?? false;
            const timeoutMs = toNumber(body.timeoutMs);
            const typeRequest: Parameters<typeof pw.typeViaPlaywright>[0] = {
              cdpUrl,
              targetId: tab.targetId,
              ref,
              text,
              submit,
              slowly,
            };
            if (timeoutMs) {
              typeRequest.timeoutMs = timeoutMs;
            }
            await pw.typeViaPlaywright(typeRequest);
            return res.json({ ok: true, targetId: tab.targetId });
          }
          case "press": {
            const key = toStringOrEmpty(body.key);
            if (!key) {
              return jsonError(res, 400, "key is required");
            }
            const delayMs = toNumber(body.delayMs);
            await pw.pressKeyViaPlaywright({
              cdpUrl,
              targetId: tab.targetId,
              key,
              delayMs: delayMs ?? undefined,
            });
            return res.json({ ok: true, targetId: tab.targetId });
          }
          case "hover": {
            const ref = toStringOrEmpty(body.ref);
            if (!ref) {
              return jsonError(res, 400, "ref is required");
            }
            const timeoutMs = toNumber(body.timeoutMs);
            await pw.hoverViaPlaywright({
              cdpUrl,
              targetId: tab.targetId,
              ref,
              timeoutMs: timeoutMs ?? undefined,
            });
            return res.json({ ok: true, targetId: tab.targetId });
          }
          case "scrollIntoView": {
            const ref = toStringOrEmpty(body.ref);
            if (!ref) {
              return jsonError(res, 400, "ref is required");
            }
            const timeoutMs = toNumber(body.timeoutMs);
            const scrollRequest: Parameters<typeof pw.scrollIntoViewViaPlaywright>[0] = {
              cdpUrl,
              targetId: tab.targetId,
              ref,
            };
            if (timeoutMs) {
              scrollRequest.timeoutMs = timeoutMs;
            }
            await pw.scrollIntoViewViaPlaywright(scrollRequest);
            return res.json({ ok: true, targetId: tab.targetId });
          }
          case "drag": {
            const startRef = toStringOrEmpty(body.startRef);
            const endRef = toStringOrEmpty(body.endRef);
            if (!startRef || !endRef) {
              return jsonError(res, 400, "startRef and endRef are required");
            }
            const timeoutMs = toNumber(body.timeoutMs);
            await pw.dragViaPlaywright({
              cdpUrl,
              targetId: tab.targetId,
              startRef,
              endRef,
              timeoutMs: timeoutMs ?? undefined,
            });
            return res.json({ ok: true, targetId: tab.targetId });
          }
          case "select": {
            const ref = toStringOrEmpty(body.ref);
            const values = toStringArray(body.values);
            if (!ref || !values?.length) {
              return jsonError(res, 400, "ref and values are required");
            }
            const timeoutMs = toNumber(body.timeoutMs);
            await pw.selectOptionViaPlaywright({
              cdpUrl,
              targetId: tab.targetId,
              ref,
              values,
              timeoutMs: timeoutMs ?? undefined,
            });
            return res.json({ ok: true, targetId: tab.targetId });
          }
          case "fill": {
            const rawFields = Array.isArray(body.fields) ? body.fields : [];
            const fields = rawFields
              .map((field) => {
                if (!field || typeof field !== "object") {
                  return null;
                }
                return normalizeBrowserFormField(field as Record<string, unknown>);
              })
              .filter((field): field is BrowserFormField => field !== null);
            if (!fields.length) {
              return jsonError(res, 400, "fields are required");
            }
            const timeoutMs = toNumber(body.timeoutMs);
            await pw.fillFormViaPlaywright({
              cdpUrl,
              targetId: tab.targetId,
              fields,
              timeoutMs: timeoutMs ?? undefined,
            });
            return res.json({ ok: true, targetId: tab.targetId });
          }
          case "resize": {
            const width = toNumber(body.width);
            const height = toNumber(body.height);
            if (!width || !height) {
              return jsonError(res, 400, "width and height are required");
            }
            await pw.resizeViewportViaPlaywright({
              cdpUrl,
              targetId: tab.targetId,
              width,
              height,
            });
            return res.json({ ok: true, targetId: tab.targetId, url: tab.url });
          }
          case "wait": {
            const timeMs = toNumber(body.timeMs);
            const text = toStringOrEmpty(body.text) || undefined;
            const textGone = toStringOrEmpty(body.textGone) || undefined;
            const selector = toStringOrEmpty(body.selector) || undefined;
            const url = toStringOrEmpty(body.url) || undefined;
            const loadStateRaw = toStringOrEmpty(body.loadState);
            const loadState =
              loadStateRaw === "load" ||
              loadStateRaw === "domcontentloaded" ||
              loadStateRaw === "networkidle"
                ? loadStateRaw
                : undefined;
            const fn = toStringOrEmpty(body.fn) || undefined;
            const timeoutMs = toNumber(body.timeoutMs) ?? undefined;
            if (fn && !evaluateEnabled) {
              return jsonError(
                res,
                403,
                [
                  "wait --fn is disabled by config (browser.evaluateEnabled=false).",
                  "Docs: /gateway/configuration#browser-openaeon-managed-browser",
                ].join("\n"),
              );
            }
            if (
              timeMs === undefined &&
              !text &&
              !textGone &&
              !selector &&
              !url &&
              !loadState &&
              !fn
            ) {
              return jsonError(
                res,
                400,
                "wait requires at least one of: timeMs, text, textGone, selector, url, loadState, fn",
              );
            }
            await pw.waitForViaPlaywright({
              cdpUrl,
              targetId: tab.targetId,
              timeMs,
              text,
              textGone,
              selector,
              url,
              loadState,
              fn,
              timeoutMs,
            });
            return res.json({ ok: true, targetId: tab.targetId });
          }
          case "evaluate": {
            if (!evaluateEnabled) {
              return jsonError(
                res,
                403,
                [
                  "act:evaluate is disabled by config (browser.evaluateEnabled=false).",
                  "Docs: /gateway/configuration#browser-openaeon-managed-browser",
                ].join("\n"),
              );
            }
            const fn = toStringOrEmpty(body.fn);
            if (!fn) {
              return jsonError(res, 400, "fn is required");
            }
            const ref = toStringOrEmpty(body.ref) || undefined;
            const evalTimeoutMs = toNumber(body.timeoutMs);
            const evalRequest: Parameters<typeof pw.evaluateViaPlaywright>[0] = {
              cdpUrl,
              targetId: tab.targetId,
              fn,
              ref,
              signal: req.signal,
            };
            if (evalTimeoutMs !== undefined) {
              evalRequest.timeoutMs = evalTimeoutMs;
            }
            const result = await pw.evaluateViaPlaywright(evalRequest);
            return res.json({
              ok: true,
              targetId: tab.targetId,
              url: tab.url,
              result,
            });
          }
          case "close": {
            await pw.closePageViaPlaywright({ cdpUrl, targetId: tab.targetId });
            return res.json({ ok: true, targetId: tab.targetId });
          }
          default: {
            return jsonError(res, 400, "unsupported kind");
          }
        }
      },
    });
  });

  registerBrowserAgentActHookRoutes(app, ctx);
  registerBrowserAgentActDownloadRoutes(app, ctx);

  // ─── Batch Actions ─────────────────────────────────────────────────────────
  // Mirrors agent-browser's `&&` command chaining:
  //   agent-browser open url && agent-browser wait --load networkidle && agent-browser snapshot -i
  // AI agents submit a sequence of steps in one request to minimize round-trips.
  app.post("/batch", async (req, res) => {
    const body = readBody(req);
    const steps = Array.isArray(body.steps) ? body.steps : [];
    if (steps.length === 0) {
      return jsonError(res, 400, "steps array is required");
    }
    const batchTargetId = resolveTargetIdFromBody(body);
    const stopOnSnapshot = toBoolean(body.stopOnSnapshot) ?? false;

    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) {
      return;
    }

    try {
      let tab = await profileCtx.ensureTabAvailable(batchTargetId);
      let cdpUrl = profileCtx.profile.cdpUrl;
      const results: Array<{ ok: boolean; kind: string; result?: unknown; error?: string }> = [];
      let failedAt: number | undefined;

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i] as Record<string, unknown>;
        const kind = typeof step.kind === "string" ? step.kind : "";

        try {
          // ── navigate ──
          if (kind === "navigate") {
            const url = toStringOrEmpty(step.url);
            if (!url) {
              results.push({ ok: false, kind, error: "url is required" });
              failedAt = i;
              break;
            }
            const pw = await requirePwAi(res, "batch:navigate");
            if (!pw) {
              return;
            }
            const navResult = await pw.navigateViaPlaywright({
              cdpUrl,
              targetId: tab.targetId,
              url,
              timeoutMs: toNumber(step.timeoutMs) ?? undefined,
              ...withBrowserNavigationPolicy(ctx.state().resolved.ssrfPolicy),
            });
            const newTargetId = await resolveTargetIdAfterNavigate({
              oldTargetId: tab.targetId,
              navigatedUrl: navResult.url,
              listTabs: () => profileCtx.listTabs(),
            });
            // Refresh tab ref if targetId changed (renderer swap)
            if (newTargetId !== tab.targetId) {
              tab = await profileCtx.ensureTabAvailable(newTargetId);
            }
            results.push({
              ok: true,
              kind,
              result: { url: navResult.url, targetId: tab.targetId },
            });
            continue;
          }

          // ── snapshot ──
          if (kind === "snapshot") {
            const pw = await getPwAiModule();
            if (!pw) {
              results.push({ ok: false, kind, error: "Playwright not available for snapshot" });
              failedAt = i;
              break;
            }
            const modeRaw = toStringOrEmpty(step.mode);
            const isEfficient = modeRaw === "efficient";
            const interactiveRaw = toBoolean(step.interactive);
            const compactRaw = toBoolean(step.compact);
            const depthRaw = toNumber(step.depth);
            const interactive = interactiveRaw ?? (isEfficient ? true : undefined);
            const compact = compactRaw ?? (isEfficient ? true : undefined);
            const depth = depthRaw ?? (isEfficient ? 6 : undefined);

            const snap = await pw.snapshotRoleViaPlaywright({
              cdpUrl,
              targetId: tab.targetId,
              options: {
                interactive: interactive ?? undefined,
                compact: compact ?? undefined,
                maxDepth: depth ?? undefined,
              },
            });
            results.push({ ok: true, kind, result: snap });
            if (stopOnSnapshot) {
              break;
            }
            continue;
          }

          // ── act (click / type / wait / press / etc.) ──
          if (isActKind(kind)) {
            const pw = await requirePwAi(res, `batch:${kind}`);
            if (!pw) {
              return;
            }
            const evaluateEnabled = ctx.state().resolved.evaluateEnabled;

            if (kind === "evaluate" && !evaluateEnabled) {
              results.push({ ok: false, kind, error: "act:evaluate is disabled by config" });
              failedAt = i;
              break;
            }

            switch (kind) {
              case "click": {
                const ref = toStringOrEmpty(step.ref);
                if (!ref) {
                  results.push({ ok: false, kind, error: "ref is required" });
                  failedAt = i;
                  break;
                }
                await pw.clickViaPlaywright({
                  cdpUrl,
                  targetId: tab.targetId,
                  ref,
                  doubleClick: toBoolean(step.doubleClick) ?? false,
                });
                break;
              }
              case "type": {
                const ref = toStringOrEmpty(step.ref);
                if (!ref || typeof step.text !== "string") {
                  results.push({ ok: false, kind, error: "ref and text are required" });
                  failedAt = i;
                  break;
                }
                await pw.typeViaPlaywright({
                  cdpUrl,
                  targetId: tab.targetId,
                  ref,
                  text: step.text,
                  submit: toBoolean(step.submit) ?? false,
                  slowly: toBoolean(step.slowly) ?? false,
                });
                break;
              }
              case "press": {
                const key = toStringOrEmpty(step.key);
                if (!key) {
                  results.push({ ok: false, kind, error: "key is required" });
                  failedAt = i;
                  break;
                }
                await pw.pressKeyViaPlaywright({ cdpUrl, targetId: tab.targetId, key });
                break;
              }
              case "hover": {
                const ref = toStringOrEmpty(step.ref);
                if (!ref) {
                  results.push({ ok: false, kind, error: "ref is required" });
                  failedAt = i;
                  break;
                }
                await pw.hoverViaPlaywright({ cdpUrl, targetId: tab.targetId, ref });
                break;
              }
              case "scrollIntoView": {
                const ref = toStringOrEmpty(step.ref);
                if (!ref) {
                  results.push({ ok: false, kind, error: "ref is required" });
                  failedAt = i;
                  break;
                }
                await pw.scrollIntoViewViaPlaywright({ cdpUrl, targetId: tab.targetId, ref });
                break;
              }
              case "select": {
                const ref = toStringOrEmpty(step.ref);
                const values = toStringArray(step.values);
                if (!ref || !values?.length) {
                  results.push({ ok: false, kind, error: "ref and values are required" });
                  failedAt = i;
                  break;
                }
                await pw.selectOptionViaPlaywright({ cdpUrl, targetId: tab.targetId, ref, values });
                break;
              }
              case "wait": {
                const timeMs = toNumber(step.timeMs);
                const loadStateRaw = toStringOrEmpty(step.loadState);
                const loadState =
                  loadStateRaw === "load" ||
                  loadStateRaw === "domcontentloaded" ||
                  loadStateRaw === "networkidle"
                    ? loadStateRaw
                    : undefined;
                await pw.waitForViaPlaywright({
                  cdpUrl,
                  targetId: tab.targetId,
                  timeMs: timeMs ?? undefined,
                  text: toStringOrEmpty(step.text) || undefined,
                  textGone: toStringOrEmpty(step.textGone) || undefined,
                  selector: toStringOrEmpty(step.selector) || undefined,
                  url: toStringOrEmpty(step.url) || undefined,
                  loadState,
                  fn: toStringOrEmpty(step.fn) || undefined,
                  timeoutMs: toNumber(step.timeoutMs) ?? undefined,
                });
                break;
              }
              case "fill": {
                const rawFields = Array.isArray(step.fields) ? step.fields : [];
                const fields = rawFields
                  .map((f) =>
                    !f || typeof f !== "object"
                      ? null
                      : normalizeBrowserFormField(f as Record<string, unknown>),
                  )
                  .filter((f): f is BrowserFormField => f !== null);
                if (!fields.length) {
                  results.push({ ok: false, kind, error: "fields are required" });
                  failedAt = i;
                  break;
                }
                await pw.fillFormViaPlaywright({ cdpUrl, targetId: tab.targetId, fields });
                break;
              }
              case "drag": {
                const startRef = toStringOrEmpty(step.startRef);
                const endRef = toStringOrEmpty(step.endRef);
                if (!startRef || !endRef) {
                  results.push({ ok: false, kind, error: "startRef and endRef are required" });
                  failedAt = i;
                  break;
                }
                await pw.dragViaPlaywright({ cdpUrl, targetId: tab.targetId, startRef, endRef });
                break;
              }
              case "evaluate": {
                const fn = toStringOrEmpty(step.fn);
                if (!fn) {
                  results.push({ ok: false, kind, error: "fn is required" });
                  failedAt = i;
                  break;
                }
                const result = await pw.evaluateViaPlaywright({
                  cdpUrl,
                  targetId: tab.targetId,
                  fn,
                });
                results.push({ ok: true, kind, result });
                continue;
              }
              case "close": {
                await pw.closePageViaPlaywright({ cdpUrl, targetId: tab.targetId });
                break;
              }
              case "resize": {
                const width = toNumber(step.width);
                const height = toNumber(step.height);
                if (!width || !height) {
                  results.push({ ok: false, kind, error: "width and height are required" });
                  failedAt = i;
                  break;
                }
                await pw.resizeViewportViaPlaywright({
                  cdpUrl,
                  targetId: tab.targetId,
                  width,
                  height,
                });
                break;
              }
            }

            if (failedAt !== undefined) {
              break;
            }
            results.push({ ok: true, kind });
            continue;
          }

          results.push({
            ok: false,
            kind: kind || "unknown",
            error: `Unsupported step kind: ${JSON.stringify(kind)}`,
          });
          failedAt = i;
          break;
        } catch (err) {
          results.push({ ok: false, kind, error: String(err) });
          failedAt = i;
          break;
        }
      }

      // Promote the last successful snapshot result to the top-level for easier AI consumption.
      // AI agents can read `response.snapshot` directly without iterating results[].
      const lastSnapshotResult = [...results]
        .toReversed()
        .find((r) => r.ok && r.kind === "snapshot");
      const topLevelSnapshot =
        lastSnapshotResult && "result" in lastSnapshotResult
          ? lastSnapshotResult.result
          : undefined;

      return res.json({
        ok: true,
        targetId: tab.targetId,
        url: tab.url,
        results,
        ...(topLevelSnapshot !== undefined ? { snapshot: topLevelSnapshot } : {}),
        ...(failedAt !== undefined ? { failedAt } : {}),
      });
    } catch (err) {
      handleRouteError(ctx, res, err);
    }
  });

  app.post("/response/body", async (req, res) => {
    const body = readBody(req);
    const targetId = resolveTargetIdFromBody(body);
    const url = toStringOrEmpty(body.url);
    const timeoutMs = toNumber(body.timeoutMs);
    const maxChars = toNumber(body.maxChars);
    if (!url) {
      return jsonError(res, 400, "url is required");
    }

    await withPlaywrightRouteContext({
      req,
      res,
      ctx,
      targetId,
      feature: "response body",
      run: async ({ cdpUrl, tab, pw }) => {
        const result = await pw.responseBodyViaPlaywright({
          cdpUrl,
          targetId: tab.targetId,
          url,
          timeoutMs: timeoutMs ?? undefined,
          maxChars: maxChars ?? undefined,
        });
        res.json({ ok: true, targetId: tab.targetId, response: result });
      },
    });
  });

  app.post("/highlight", async (req, res) => {
    const body = readBody(req);
    const targetId = resolveTargetIdFromBody(body);
    const ref = toStringOrEmpty(body.ref);
    if (!ref) {
      return jsonError(res, 400, "ref is required");
    }

    await withPlaywrightRouteContext({
      req,
      res,
      ctx,
      targetId,
      feature: "highlight",
      run: async ({ cdpUrl, tab, pw }) => {
        await pw.highlightViaPlaywright({
          cdpUrl,
          targetId: tab.targetId,
          ref,
        });
        res.json({ ok: true, targetId: tab.targetId });
      },
    });
  });
}
