import { html } from "lit";
import { t } from "../../../../i18n/index.ts";
import type { ChatProps } from "../../chat.ts";

export function renderEmptyState(props: ChatProps) {
  return html`
    <div class="chat-empty-state fractal-nexus">
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
        <label>SENTIENT_SUGGESTIONS // 意识建议</label>
        <div class="example-pill-cloud">
          <button class="example-pill" @click=${() => props.onDraftChange?.("分析当前项目的自我演化逻辑...")}>分析演化逻辑</button>
          <button class="example-pill" @click=${() => props.onDraftChange?.("查找代码库中的逻辑悖论并重构...")}>查找悖论</button>
          <button class="example-pill" @click=${() => props.onDraftChange?.("优化当前的认知熵评分算法...")}>优化算法</button>
          <button class="example-pill" @click=${() => props.onDraftChange?.("生成下一阶段的奇点跃迁规划...")}>奇点规划</button>
        </div>
      </div>
    </div>
  `;
}
