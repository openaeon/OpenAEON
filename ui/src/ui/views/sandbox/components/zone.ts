import { html, nothing } from "lit";
import { t } from "../../../../i18n/index.ts";

/** ─── Zone Rendering Helpers ────────────────────────────────────────────────── */
export function renderCitadelZone(approvals: number) {
  return html`
    <div class="sandbox-zone zone--citadel">
      <div class="zone__label">${t("sandbox.zones.citadel")}</div>
      <div class="zone__icon">🏰</div>
      <div class="zone__props">
        <div class="prop--throne"></div>
      </div>
      ${approvals > 0 ? html`<div class="zone__badge zone__badge--warning">${approvals} ${t("common.pending")}</div>` : nothing}
    </div>
  `;
}

export function renderLogisticsZone(usage: any, health: any) {
  return html`
    <div class="sandbox-zone zone--logistics">
      <div class="zone__label">${t("sandbox.zones.logistics")}</div>
      <div class="zone__icon">📦</div>
      <div class="zone__props">
        <div class="prop--conveyor">
          <div class="conveyor__belt"></div>
        </div>
      </div>
      <div class="zone__stat">${usage?.totalTokens ? `${Math.round(usage.totalTokens / 1000)}k tkn` : "0 tkn"}</div>
      <div class="zone__status-dot zone__status-dot--${health?.status || "unknown"}"></div>
    </div>
  `;
}

export function renderCommsZone(channels: any) {
  const activeCount = channels?.channelMeta?.length || 0;
  return html`
    <div class="sandbox-zone zone--comms">
      <div class="zone__label">${t("sandbox.zones.comms")}</div>
      <div class="zone__icon">📡</div>
      <div class="zone__stat">${activeCount} Ch active</div>
    </div>
  `;
}

export function renderClusterZone(nodes: any[]) {
  const nodeCount = nodes?.length || 0;
  return html`
    <div class="sandbox-zone zone--cluster">
      <div class="zone__label">${t("sandbox.zones.cluster")}</div>
      <div class="zone__icon">🖥️</div>
      <div class="zone__props">
        <div class="prop--rack">
          <div class="rack__leds">
            <div class="led led--active"></div>
            <div class="led led--blink"></div>
            <div class="led led--active"></div>
          </div>
        </div>
      </div>
      <div class="zone__nodes">
        ${nodes?.slice(0, 3).map(
          () =>
            html`
              <div class="node-mini"></div>
            `,
        )}
        ${nodeCount > 3 ? html`<div class="node-more">+${nodeCount - 3}</div>` : nothing}
      </div>
    </div>
  `;
}
