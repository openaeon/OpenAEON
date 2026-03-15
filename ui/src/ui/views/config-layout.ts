import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import "../components/config-sidebar.ts";

export type ConfigLayoutProps = {
  // Sidebar Props
  validity: "valid" | "invalid" | "unknown";
  searchQuery: string;
  selectedTags: Set<string>;
  activeSection: string | null;
  allSections: Array<{ key: string; label: string }>;
  formMode: "form" | "raw";
  schemaLoading: boolean;
  hasSchema: boolean;

  // Actions Props
  hasChanges: boolean;
  diffCount: number;
  loading: boolean;
  saving: boolean;
  applying: boolean;
  updating: boolean;
  canSave: boolean;
  canApply: boolean;
  canUpdate: boolean;

  // Events
  onSearchChange: (query: string) => void;
  onSectionChange: (key: string | null) => void;
  onFormModeChange: (mode: "form" | "raw") => void;
  onReload: () => void;
  onSave: () => void;
  onApply: () => void;
  onUpdate: () => void;
};

@customElement("config-layout")
export class ConfigLayout extends LitElement {
  @property({ type: Object }) props!: ConfigLayoutProps;
  @property({ type: Array }) issues: unknown[] = [];

  protected createRenderRoot() {
    return this; // Render to Light DOM
  }

  render() {
    if (!this.props) {
      return nothing;
    }

    return html`
      <div class="config-layout">
        <!-- Sidebar -->
        <config-sidebar
          .validity=${this.props.validity}
          .searchQuery=${this.props.searchQuery}
          .selectedTags=${this.props.selectedTags}
          .activeSection=${this.props.activeSection}
          .allSections=${this.props.allSections}
          .formMode=${this.props.formMode}
          .schemaLoading=${this.props.schemaLoading}
          .hasSchema=${this.props.hasSchema}
          @search-change=${(e: CustomEvent) => this.props.onSearchChange(e.detail.query)}
          @section-change=${(e: CustomEvent) => this.props.onSectionChange(e.detail.key)}
          @mode-change=${(e: CustomEvent) => this.props.onFormModeChange(e.detail.mode)}
        ></config-sidebar>

        <!-- Main content -->
        <main class="config-main">
          <!-- Action bar -->
          <div class="config-actions">
            <div class="config-actions__left">
              ${
                this.props.hasChanges
                  ? html`
                    <span class="config-changes-badge">
                      ${
                        this.props.formMode === "raw"
                          ? "Unsaved changes"
                          : `${this.props.diffCount} unsaved change${this.props.diffCount !== 1 ? "s" : ""}`
                      }
                    </span>
                  `
                  : html`
                      <span class="config-status muted">No changes</span>
                    `
              }
            </div>
            <div class="config-actions__right">
              <button
                class="btn btn--sm"
                ?disabled=${this.props.loading}
                @click=${this.props.onReload}
              >
                ${this.props.loading ? "Loading…" : "Reload"}
              </button>
              <button
                class="btn btn--sm primary"
                ?disabled=${!this.props.canSave}
                @click=${this.props.onSave}
              >
                ${this.props.saving ? "Saving…" : "Save"}
              </button>
              <button
                class="btn btn--sm"
                ?disabled=${!this.props.canApply}
                @click=${this.props.onApply}
              >
                ${this.props.applying ? "Applying…" : "Apply"}
              </button>
              <button
                class="btn btn--sm"
                ?disabled=${!this.props.canUpdate}
                @click=${this.props.onUpdate}
              >
                ${this.props.updating ? "Updating…" : "Update"}
              </button>
            </div>
          </div>

          <!-- Diff Panel & Form Header go here via slots or we can render them inside ConfigLayout -->
          <slot name="content-header"></slot>

          <!-- Form content -->
          <div class="config-content">
            <slot></slot>
          </div>

          ${
            this.issues.length > 0
              ? html`<div class="callout danger" style="margin-top: 12px;">
                <pre class="code-block">${JSON.stringify(this.issues, null, 2)}</pre>
              </div>`
              : nothing
          }
        </main>
      </div>
    `;
  }
}

// Add Custom Element type definitions
declare global {
  interface HTMLElementTagNameMap {
    "config-layout": ConfigLayout;
  }
}
