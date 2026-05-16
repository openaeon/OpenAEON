import { html, nothing } from "lit";
import type { AppViewState } from "../app-view-state.ts";

export function renderCognitivePlanConfirmation(state: AppViewState) {
  const dialog = state.cognitivePlanConfirmDialog;
  if (!dialog) {
    return nothing;
  }
  return html`
    <div class="exec-approval-overlay" role="dialog" aria-modal="true" aria-live="polite">
      <div class="exec-approval-card">
        <div class="exec-approval-header">
          <div>
            <div class="exec-approval-title">${dialog.title}</div>
            <div class="exec-approval-sub">${dialog.message}</div>
          </div>
        </div>
        ${
          Array.isArray(dialog.details) && dialog.details.length > 0
            ? html`
                <div class="exec-approval-meta">
                  ${dialog.details.map(
                    (line) => html`<div class="exec-approval-meta-row"><span>${line}</span></div>`,
                  )}
                </div>
              `
            : nothing
        }
        <div class="exec-approval-actions">
          <button
            class="btn primary"
            @click=${() => state.handleCognitivePlanConfirmDecision(true)}
          >
            ${dialog.confirmLabel}
          </button>
          <button
            class="btn"
            @click=${() => state.handleCognitivePlanConfirmDecision(false)}
          >
            ${dialog.cancelLabel ?? "Cancel"}
          </button>
        </div>
      </div>
    </div>
  `;
}
