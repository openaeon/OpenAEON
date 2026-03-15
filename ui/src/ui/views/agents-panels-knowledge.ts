import { html, nothing } from "lit";
import type { AgentsMemoryListResult, AgentsMemoryStatusResult } from "../types.ts";
import { t } from "../../i18n/index.ts";
import { formatBytes } from "./agents-utils.ts";

export function renderAgentKnowledge(params: {
  agentId: string;
  agentKnowledgeList: AgentsMemoryListResult | null;
  agentKnowledgeStatus: AgentsMemoryStatusResult | null;
  agentKnowledgeLoading: boolean;
  agentKnowledgeError: string | null;
  agentKnowledgeFileActive: string | null;
  agentKnowledgeFileContents: Record<string, string>;
  agentKnowledgeFileDrafts: Record<string, string>;
  agentKnowledgeSaving: boolean;
  onLoadFiles: (agentId: string) => void;
  onSelectFile: (name: string) => void;
  onFileDraftChange: (name: string, content: string) => void;
  onFileReset: (name: string) => void;
  onFileSave: (name: string) => void;
  onFileDelete: (name: string) => void;
}) {
  const list =
    params.agentKnowledgeList?.agentId === params.agentId ? params.agentKnowledgeList : null;
  const files = list?.files ?? [];
  const active = params.agentKnowledgeFileActive ?? null;
  const activeEntry = active ? (files.find((file) => file.name === active) ?? null) : null;
  const baseContent = active ? (params.agentKnowledgeFileContents[active] ?? "") : "";
  const draft = active ? (params.agentKnowledgeFileDrafts[active] ?? baseContent) : "";
  const isDirty = active ? draft !== baseContent : false;
  const status =
    params.agentKnowledgeStatus?.agentId === params.agentId
      ? params.agentKnowledgeStatus.status
      : null;

  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">${t("agents.knowledge.title")}</div>
          <div class="card-sub">${t("agents.knowledge.subtitle")}</div>
        </div>
        <button
          class="btn btn--sm"
          ?disabled=${params.agentKnowledgeLoading}
          @click=${() => params.onLoadFiles(params.agentId)}
        >
          ${params.agentKnowledgeLoading ? t("agents.knowledge.loading") : t("agents.knowledge.refresh")}
        </button>
      </div>
      ${
        status
          ? html`
              <div class="stat-grid" style="margin-top: 16px;">
                <div class="stat">
                  <div class="stat-label">${t("agents.knowledge.totalDocuments")}</div>
                  <div class="stat-value">${files.length}</div>
                </div>
                <div class="stat">
                  <div class="stat-label">${t("agents.knowledge.totalChunks")}</div>
                  <div class="stat-value">${status.totalChunks}</div>
                </div>
                <div class="stat">
                  <div class="stat-label">${t("agents.knowledge.totalVectors")}</div>
                  <div class="stat-value">${status.totalVectors}</div>
                </div>
              </div>
            `
          : nothing
      }
      ${
        list
          ? html`<div class="muted mono" style="margin-top: 16px;">${t("agents.knowledge.workspace", { workspace: list.workspace })}</div>`
          : nothing
      }
      ${
        params.agentKnowledgeError
          ? html`<div class="callout danger" style="margin-top: 12px;">${params.agentKnowledgeError}</div>`
          : nothing
      }
    </section>

    <div class="row" style="align-items: flex-start; gap: 16px; margin-top: 16px;">
      <section class="card" style="flex: 1 1 300px; max-width: 400px; margin: 0; min-height: 400px;">
        <div class="row" style="justify-content: space-between;">
          <div class="card-title">${t("agents.knowledge.files")}</div>
          <button
            class="btn btn--sm"
            @click=${() => {
              const name = window.prompt(t("agents.knowledge.promptNewFile"));
              if (name) {
                params.onSelectFile(name);
              }
            }}
          >
            ${t("agents.knowledge.newFile")}
          </button>
        </div>
        ${
          files.length === 0
            ? html`<div class="muted" style="margin-top: 16px;">${t("agents.knowledge.noFiles")}</div>`
            : html`
                <div class="list" style="margin-top: 16px;">
                  ${files.map((file) => {
                    const isActive = file.name === active;
                    return html`
                      <div
                        class="list-item clickable ${isActive ? "active" : ""}"
                        @click=${() => params.onSelectFile(file.name)}
                      >
                        <div class="list-main">
                          <div class="list-title mono">${file.name}</div>
                          ${
                            file.size != null
                              ? html`<div class="list-sub">${formatBytes(file.size)}</div>`
                              : nothing
                          }
                        </div>
                      </div>
                    `;
                  })}
                </div>
              `
        }
      </section>

      <section class="card" style="flex: 2 1 500px; margin: 0; min-height: 400px; display: flex; flex-direction: column;">
        <div class="row" style="justify-content: space-between;">
          <div>
            <div class="card-title">${active || t("agents.knowledge.selectAFile")}</div>
            ${
              activeEntry && activeEntry.updatedAtMs
                ? html`<div class="card-sub">${t("agents.knowledge.lastUpdated", { time: new Date(activeEntry.updatedAtMs).toLocaleString() })}</div>`
                : nothing
            }
          </div>
          <div class="row">
            ${
              active
                ? html`
                    <button
                      class="btn btn--icon danger"
                      title=${t("agents.knowledge.deleteFileHint")}
                      ?disabled=${params.agentKnowledgeSaving}
                      @click=${() => {
                        if (confirm(t("agents.knowledge.deleteConfirm", { name: active }))) {
                          params.onFileDelete(active);
                        }
                      }}
                    >
                      <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  `
                : nothing
            }
          </div>
        </div>

        ${
          active
            ? html`
                <div style="flex: 1; display: flex; flex-direction: column; margin-top: 16px;">
                  <textarea
                    class="input mono"
                    style="flex: 1; min-height: 400px; resize: vertical;"
                    .value=${draft}
                    @input=${(e: Event) => {
                      const val = (e.target as HTMLTextAreaElement).value;
                      params.onFileDraftChange(active, val);
                    }}
                    ?disabled=${params.agentKnowledgeLoading || params.agentKnowledgeSaving}
                  ></textarea>
                  <div class="row" style="justify-content: flex-end; margin-top: 12px; gap: 8px;">
                    <button
                      class="btn"
                      ?disabled=${!isDirty || params.agentKnowledgeSaving || params.agentKnowledgeLoading}
                      @click=${() => params.onFileReset(active)}
                    >
                      ${t("agents.knowledge.reset")}
                    </button>
                    <button
                      class="btn btn--primary"
                      ?disabled=${!isDirty || params.agentKnowledgeSaving || params.agentKnowledgeLoading}
                      @click=${() => params.onFileSave(active)}
                    >
                      ${params.agentKnowledgeSaving ? t("agents.knowledge.saving") : t("agents.knowledge.saveChanges")}
                    </button>
                  </div>
                </div>
              `
            : html`
                <div class="muted" style="margin-top: 16px; flex: 1; display: flex; align-items: center; justify-content: center;">
                  ${t("agents.knowledge.selectFileHint")}
                </div>
              `
        }
      </section>
    </div>
  `;
}
