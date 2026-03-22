import { html, nothing } from "lit";
import { formatRelativeTimestamp } from "../format.ts";
import type { WeixinStatus } from "../types.ts";
import { renderChannelConfigSection } from "./channels.config.ts";
import type { ChannelsProps } from "./channels.types.ts";

export function renderWeixinCard(params: {
  props: ChannelsProps;
  weixin?: WeixinStatus | null;
  accountCountLabel: unknown;
}) {
  const { props, weixin, accountCountLabel } = params;

  return html`
    <div class="card">
      <div class="card-title">Tencent WeChat</div>
      <div class="card-sub">Link WeChat via iLink and monitor connection health.</div>
      ${accountCountLabel}

      <div class="status-list" style="margin-top: 16px;">
        <div>
          <span class="label">Configured</span>
          <span>${weixin?.configured ? "Yes" : "No"}</span>
        </div>
        <div>
          <span class="label">Self</span>
          <span>${weixin?.self?.nickname ?? "n/a"}</span>
        </div>
        <div>
          <span class="label">Linked</span>
          <span>${weixin?.linked ? "Yes" : "No"}</span>
        </div>
        <div>
          <span class="label">Running</span>
          <span>${weixin?.running ? "Yes" : "No"}</span>
        </div>
        <div>
          <span class="label">Connected</span>
          <span>${weixin?.connected ? "Yes" : "No"}</span>
        </div>
        <div>
          <span class="label">Last connect</span>
          <span>
            ${weixin?.lastConnectedAt ? formatRelativeTimestamp(weixin.lastConnectedAt) : "n/a"}
          </span>
        </div>
        <div>
          <span class="label">Last message</span>
          <span>
            ${weixin?.lastMessageAt ? formatRelativeTimestamp(weixin.lastMessageAt) : "n/a"}
          </span>
        </div>
      </div>

      ${
        weixin?.lastError
          ? html`<div class="callout danger" style="margin-top: 12px;">
            ${weixin.lastError}
          </div>`
          : nothing
      }

      ${
        props.weixinMessage
          ? html`<div class="callout" style="margin-top: 12px;">
            ${props.weixinMessage}
          </div>`
          : nothing
      }

      ${
        props.weixinQrDataUrl
          ? html`<div class="qr-wrap" style="text-align: center; margin-top: 16px;">
            <img src=${props.weixinQrDataUrl} alt="WeChat QR" style="max-width: 200px; border-radius: 8px;" />
            <div style="font-size: 12px; margin-top: 8px; opacity: 0.8;">Scan with WeChat</div>
          </div>`
          : nothing
      }

      <div class="row" style="margin-top: 14px; flex-wrap: wrap; gap: 8px;">
        <button
          class="btn primary"
          ?disabled=${props.weixinBusy}
          @click=${() => props.onWeixinStart(false)}
        >
          ${props.weixinBusy ? "Working…" : "Show QR"}
        </button>
        <button
          class="btn"
          ?disabled=${props.weixinBusy}
          @click=${() => props.onWeixinStart(true)}
        >
          Relink
        </button>
        <button
          class="btn"
          ?disabled=${props.weixinBusy}
          @click=${() => props.onWeixinWait()}
        >
          Wait for scan
        </button>
        <button
          class="btn danger"
          ?disabled=${props.weixinBusy}
          @click=${() => props.onWeixinLogout()}
        >
          Logout
        </button>
        <button class="btn" @click=${() => props.onRefresh(true)}>
          Refresh
        </button>
      </div>

      ${renderChannelConfigSection({ channelId: "tencent-weixin", props })}
    </div>
  `;
}
