import { html } from "lit";
import { t } from "../../../../i18n/index.ts";
import type { ChatProps } from "../../chat.ts";

export function renderEmptyState(props: ChatProps) {
  return html`
    <div class="chat-empty-state fractal-nexus">
      <div class="chat-empty-field" aria-hidden="true">
        <div class="chat-empty-field__grid"></div>
        <div class="chat-empty-field__rings"></div>
        <div class="chat-empty-field__formula"></div>
        <div class="chat-empty-field__noise"></div>
      </div>
      <div class="chat-empty-figure fractal-core">
        <div class="fractal-ring fractal-ring--1"></div>
        <div class="fractal-ring fractal-ring--2"></div>
        <div class="fractal-ring fractal-ring--3"></div>
        <div class="fractal-core-eye"></div>
      </div>
      <h2 class="chat-empty-title aeon-text">${t("chat.emptyTitle")}</h2>
      <p class="chat-empty-subtitle">${t("chat.emptySubtitle")}</p>
      
      <div class="chat-sensory-nodes">
        ${[1, 2, 3, 4, 5, 6].map(
          (i) => html`
          <div class="sensory-node">
            <span class="sensory-node-icon">${["∿", "⋈", "⧖", "⚛", "⌬", "⎇"][i - 1]}</span>
            <span class="sensory-node-text">${t(`chat.emptyAction${i}` as any)}</span>
          </div>
        `,
        )}
      </div>

      <div class="chat-usage-examples">
        <label>${t("chat.sentientSuggestions")}</label>
        <div class="example-pill-cloud">
          <button class="example-pill" @click=${() => props.onDraftChange?.(t("chat.suggestion1Prompt"))}>${t("chat.suggestion1")}</button>
          <button class="example-pill" @click=${() => props.onDraftChange?.(t("chat.suggestion2Prompt"))}>${t("chat.suggestion2")}</button>
          <button class="example-pill" @click=${() => props.onDraftChange?.(t("chat.suggestion3Prompt"))}>${t("chat.suggestion3")}</button>
          <button class="example-pill" @click=${() => props.onDraftChange?.(t("chat.suggestion4Prompt"))}>${t("chat.suggestion4")}</button>
        </div>
      </div>
    </div>
  `;
}
