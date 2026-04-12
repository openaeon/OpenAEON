import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { t } from "../../i18n/index.ts";
import { icons } from "../icons.ts";
import { detectTextDirection } from "../text-direction.ts";
import type { ChatAttachment } from "../ui-types.ts";

type QuickCommandSpec = {
  name: string;
  syntax: string;
  template: string;
};

const QUICK_COMMANDS: QuickCommandSpec[] = [
  { name: "new", syntax: "/new", template: "/new" },
  { name: "main", syntax: "/main", template: "/main" },
  { name: "sandbox", syntax: "/sandbox", template: "/sandbox" },
  { name: "aeon", syntax: "/aeon", template: "/aeon" },
  { name: "focus", syntax: "/focus", template: "/focus" },
  {
    name: "thinking",
    syntax: "/thinking",
    template: "/thinking",
  },
  {
    name: "eternal",
    syntax: "/eternal [on|off|toggle]",
    template: "/eternal toggle",
  },
  {
    name: "web",
    syntax: "/web [on|off|toggle]",
    template: "/web toggle",
  },
  { name: "refresh", syntax: "/refresh", template: "/refresh" },
  { name: "clear", syntax: "/clear", template: "/clear" },
];

function quickCommandDescription(name: string): string {
  const key = `chat.quickCmdDesc_${name}`;
  return t(key as never);
}

@customElement("chat-input-area")
export class ChatInputArea extends LitElement {
  @property({ type: String }) draft = "";
  @property({ type: Boolean }) connected = false;
  @property({ type: Boolean }) sending = false;
  @property({ type: Boolean }) canAbort = false;
  @property({ type: Array }) attachments: ChatAttachment[] = [];
  @state() private commandCursor = 0;
  @state() private attachmentError: string | null = null;
  private static readonly MAX_ATTACHMENT_BYTES = 5_000_000;

  static styles = css`
    :host {
      display: block;
      position: relative;
    }

    .chat-compose {
      background: var(--input-bg, rgba(5, 5, 15, 0.75));
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border-radius: 12px;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      box-shadow: var(--input-shadow, 0 12px 40px rgba(0, 0, 0, 0.6));
      max-width: 840px;
      margin: 0 auto;
      width: 100%;
      position: relative;
    }

    .chat-compose::before {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      padding: 1px;
      background: var(
        --input-border-grad,
        linear-gradient(135deg, rgba(0, 240, 255, 0.5), rgba(139, 92, 246, 0.6), rgba(225, 29, 72, 0.3))
      );
      mask:
        linear-gradient(#fff 0 0) content-box,
        linear-gradient(#fff 0 0);
      -webkit-mask:
        linear-gradient(#fff 0 0) content-box,
        linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      pointer-events: none;
    }

    :host-context([data-theme="light"]) .chat-compose {
      --input-bg: rgba(255, 255, 255, 0.85);
      --input-border: rgba(99, 102, 241, 0.3);
      --input-shadow: 0 8px 32px rgba(99, 102, 241, 0.1);
    }

    .chat-attachments {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 4px;
    }

    .chat-attachment {
      position: relative;
      width: 60px;
      height: 60px;
      border-radius: 8px;
      border: 1px solid var(--border);
      overflow: hidden;
      background: var(--bg-accent);
    }

    .chat-attachment__img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .chat-attachment__name {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      font-size: 10px;
      line-height: 1.2;
      padding: 2px 4px;
      color: #e2e8f0;
      background: rgba(2, 6, 23, 0.78);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .chat-attachment__remove {
      position: absolute;
      top: 2px;
      right: 2px;
      background: rgba(0, 0, 0, 0.6);
      color: white;
      border: none;
      border-radius: 50%;
      width: 18px;
      height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      padding: 0;
      font-size: 10px;
      transition: background 0.2s;
    }

    .chat-attachment__remove:hover {
      background: rgba(255, 77, 79, 0.8);
    }

    .chat-compose__row {
      display: flex;
      align-items: flex-end;
      gap: 12px;
    }

    .chat-compose__field {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .chat-compose__field span {
      display: none;
    }

    textarea {
      width: 100%;
      min-height: 40px;
      max-height: 240px;
      resize: none;
      background: transparent;
      border: none;
      color: var(--text-color, #f8fafc);
      font-family: inherit;
      font-size: 14px;
      line-height: 1.5;
      padding: 8px 0;
      outline: none;
    }
    :host-context([data-theme="light"]) textarea {
      --text-color: #0f172a;
    }

    textarea::placeholder {
      color: var(--muted-color, #94a3b8);
      opacity: 0.7;
    }
    :host-context([data-theme="light"]) textarea::placeholder {
      --muted-color: #64748b;
    }

    .chat-compose__actions {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px; /* Align with textarea text center better */
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 16px;
      height: 36px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--bg-accent);
      color: var(--text);
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s var(--ease-out);
      white-space: nowrap;
    }

    .btn:hover:not(:disabled) {
      background: var(--bg-hover);
      border-color: var(--border-strong);
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn.primary {
      background: var(--primary);
      color: var(--primary-foreground);
      border-color: var(--primary);
    }

    .btn.primary:hover:not(:disabled) {
      filter: brightness(1.05);
      box-shadow: 0 2px 8px var(--accent-subtle);
    }

    .btn-kbd {
      margin-left: 8px;
      font-family: var(--mono);
      font-size: 11px;
      opacity: 0.6;
      padding: 1px 4px;
      background: rgba(0, 0, 0, 0.05);
      border-radius: 4px;
    }

    .attachment-error {
      font-size: 12px;
      color: #f87171;
      margin-top: 2px;
    }

    .quick-commands {
      border: 1px solid var(--border-color);
      border-radius: 10px;
      background: var(--surface-1, rgba(2, 6, 23, 0.75));
      overflow: hidden;
    }

    .quick-command-row {
      width: 100%;
      border: none;
      background: transparent;
      color: var(--text-color);
      display: grid;
      grid-template-columns: 160px 1fr;
      gap: 10px;
      text-align: left;
      padding: 8px 10px;
      cursor: pointer;
      border-bottom: 1px solid var(--border-color);
      font-size: 12px;
    }

    .quick-command-row:last-child {
      border-bottom: none;
    }

    .quick-command-row:hover,
    .quick-command-row[data-active="true"] {
      background: var(--surface-2, rgba(15, 23, 42, 0.6));
    }

    .quick-command-row code {
      font-family: var(--mono, ui-monospace, SFMono-Regular, Menlo, monospace);
      color: #2dd4bf;
    }

    .quick-command-hint {
      font-size: 11px;
      color: var(--muted-color, #94a3b8);
      padding: 0 2px;
    }

    :host-context(.chat[data-visual-mode="professional"]) .chat-compose {
      background: #161d28;
      border: 1px solid rgba(148, 163, 184, 0.26);
      box-shadow: none;
      border-radius: 10px;
      padding: 10px 12px;
      gap: 8px;
    }

    :host-context(.chat[data-visual-mode="professional"]) .chat-compose::before {
      display: none;
    }

    :host-context(.chat[data-visual-mode="professional"]) textarea {
      min-height: 36px;
      color: #e2e8f0;
      font-size: 13px;
      line-height: 1.45;
    }

    :host-context(.chat[data-visual-mode="professional"]) .btn {
      height: 34px;
      border-radius: 8px;
      border-color: rgba(148, 163, 184, 0.28);
      background: rgba(15, 23, 42, 0.72);
      color: #cbd5e1;
      font-size: 12px;
    }

    :host-context(.chat[data-visual-mode="professional"]) .btn.primary {
      background: rgba(56, 189, 248, 0.2);
      border-color: rgba(56, 189, 248, 0.45);
      color: #e0f2fe;
    }

    :host-context(.chat[data-visual-density="compact"]) .chat-compose {
      padding: 8px 10px;
      gap: 6px;
    }

    :host-context(.chat[data-visual-density="compact"]) .chat-compose__row {
      gap: 8px;
    }

    :host-context(.chat[data-visual-density="compact"]) textarea {
      font-size: 12px;
      min-height: 32px;
    }
  `;

  private generateAttachmentId(): string {
    return `att-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  private async readFileAsDataUrl(file: File): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        const dataUrl = typeof reader.result === "string" ? reader.result : "";
        if (!dataUrl) {
          reject(new Error("Failed to read file as data URL"));
          return;
        }
        resolve(dataUrl);
      });
      reader.addEventListener("error", () => reject(new Error("Failed to read file")));
      reader.readAsDataURL(file);
    });
  }

  private emitAttachments(next: ChatAttachment[]) {
    this.dispatchEvent(
      new CustomEvent("attachments-change", {
        detail: { attachments: next },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private async addFiles(files: File[]) {
    this.attachmentError = null;
    const accepted = files.filter((file) => file.type.startsWith("image/"));
    if (accepted.length !== files.length) {
      this.attachmentError = t("chat.uploadOnlyImages");
    }
    const tooLarge = accepted.find((file) => file.size > ChatInputArea.MAX_ATTACHMENT_BYTES);
    if (tooLarge) {
      this.attachmentError = t("chat.uploadTooLarge", { name: tooLarge.name });
      return;
    }
    const appended: ChatAttachment[] = [];
    for (const file of accepted) {
      try {
        const dataUrl = await this.readFileAsDataUrl(file);
        appended.push({
          id: this.generateAttachmentId(),
          dataUrl,
          mimeType: file.type,
          fileName: file.name,
          sizeBytes: file.size,
        });
      } catch {
        this.attachmentError = t("chat.uploadReadFailed", { name: file.name });
      }
    }
    if (appended.length > 0) {
      this.emitAttachments([...this.attachments, ...appended]);
    }
  }

  private handlePaste = (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) {
      return;
    }

    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.type.startsWith("image/")) {
        continue;
      }
      const file = item.getAsFile();
      if (file) {
        imageFiles.push(file);
      }
    }

    if (imageFiles.length === 0) {
      return;
    }
    e.preventDefault();
    void this.addFiles(imageFiles);
  };

  private adjustTextareaHeight(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("keydown", this.handleGlobalKeydown);
  }

  disconnectedCallback(): void {
    window.removeEventListener("keydown", this.handleGlobalKeydown);
    super.disconnectedCallback();
  }

  private handleGlobalKeydown = (event: KeyboardEvent) => {
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k" || event.shiftKey) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
    ) {
      return;
    }
    event.preventDefault();
    this.focusTextarea();
  };

  private focusTextarea() {
    const textarea = this.renderRoot.querySelector("textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) {
      return;
    }
    textarea.focus();
  }

  private emitDraftChange(draft: string) {
    this.dispatchEvent(
      new CustomEvent("draft-change", {
        detail: { draft },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private parseQuickCommand(
    rawDraft: string,
  ): { name: string; args: string[]; raw: string } | null {
    const trimmed = rawDraft.trim();
    if (!trimmed.startsWith("/")) {
      return null;
    }
    if (trimmed === "/") {
      return { name: "", args: [], raw: trimmed };
    }
    const parts = trimmed.slice(1).split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      return null;
    }
    const [name, ...args] = parts;
    return { name: name.toLowerCase(), args, raw: trimmed };
  }

  private quickCommandOptions(): QuickCommandSpec[] {
    const parsed = this.parseQuickCommand(this.draft);
    if (!parsed) {
      return [];
    }
    const token = parsed.name;
    if (!token) {
      return QUICK_COMMANDS;
    }
    return QUICK_COMMANDS.filter((entry) => entry.name.startsWith(token));
  }

  private tryDispatchQuickCommand(): boolean {
    const parsed = this.parseQuickCommand(this.draft);
    if (!parsed) {
      return false;
    }
    const allowed = new Set(QUICK_COMMANDS.map((entry) => entry.name));
    if (!allowed.has(parsed.name)) {
      return false;
    }
    this.dispatchEvent(
      new CustomEvent("local-command", {
        detail: parsed,
        bubbles: true,
        composed: true,
      }),
    );
    this.emitDraftChange("");
    return true;
  }

  private applyQuickCommandTemplate(next: string) {
    this.emitDraftChange(next);
    requestAnimationFrame(() => this.focusTextarea());
  }

  private handlePickFiles() {
    const input = this.renderRoot.querySelector<HTMLInputElement>("#chat-file-input");
    input?.click();
  }

  render() {
    const hasAttachments = this.attachments.length > 0;
    const quickCommands = this.quickCommandOptions();
    const commandPanelVisible = quickCommands.length > 0 && this.connected;
    const activeCommand =
      quickCommands[Math.max(0, Math.min(this.commandCursor, quickCommands.length - 1))];
    const composePlaceholder = this.connected
      ? hasAttachments
        ? t("chat.composePlaceholderWithAttachments")
        : t("chat.composePlaceholder")
      : t("chat.composeDisconnectedPlaceholder");

    return html`
      <div class="chat-compose">
        ${
          this.attachments.length > 0
            ? html`
          <div class="chat-attachments">
            ${this.attachments.map(
              (att) => html`
              <div class="chat-attachment">
                <img src=${att.dataUrl} alt="Attachment" class="chat-attachment__img" />
                ${att.fileName ? html`<div class="chat-attachment__name" title=${att.fileName}>${att.fileName}</div>` : nothing}
                <button
                  class="chat-attachment__remove"
                  @click=${() => {
                    const next = this.attachments.filter((a) => a.id !== att.id);
                    this.emitAttachments(next);
                  }}
                >${icons.x}</button>
              </div>
            `,
            )}
          </div>
        `
            : nothing
        }
        ${this.attachmentError ? html`<div class="attachment-error" role="status">${this.attachmentError}</div>` : nothing}

        <div class="chat-compose__row">
          <label class="field chat-compose__field">
            <span>${t("chat.messageLabel")}</span>
            <textarea
              .value=${this.draft}
              dir=${detectTextDirection(this.draft)}
              ?disabled=${!this.connected}
              @keydown=${(e: KeyboardEvent) => {
                if (commandPanelVisible && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                  e.preventDefault();
                  const delta = e.key === "ArrowDown" ? 1 : -1;
                  const size = quickCommands.length;
                  this.commandCursor = (this.commandCursor + delta + size) % size;
                  return;
                }
                if (commandPanelVisible && e.key === "Tab" && !e.shiftKey) {
                  e.preventDefault();
                  if (activeCommand) {
                    this.applyQuickCommandTemplate(activeCommand.template);
                  }
                  return;
                }
                if (
                  e.key !== "Enter" ||
                  e.isComposing ||
                  e.keyCode === 229 ||
                  e.shiftKey ||
                  !this.connected
                ) {
                  return;
                }
                e.preventDefault();
                if (this.tryDispatchQuickCommand()) {
                  return;
                }
                this.dispatchEvent(new CustomEvent("send", { bubbles: true, composed: true }));
              }}
              @input=${(e: Event) => {
                const target = e.target as HTMLTextAreaElement;
                this.adjustTextareaHeight(target);
                this.emitDraftChange(target.value);
                if (this.commandCursor >= quickCommands.length) {
                  this.commandCursor = 0;
                }
              }}
              @paste=${this.handlePaste}
              @dragover=${(e: DragEvent) => {
                if (!this.connected) {
                  return;
                }
                e.preventDefault();
              }}
              @drop=${(e: DragEvent) => {
                const files = Array.from(e.dataTransfer?.files ?? []);
                if (files.length === 0) {
                  return;
                }
                e.preventDefault();
                void this.addFiles(files);
              }}
              placeholder=${composePlaceholder}
            ></textarea>
          </label>

          <div class="chat-compose__actions">
            <input
              id="chat-file-input"
              type="file"
              accept="image/*"
              multiple
              hidden
              @change=${(e: Event) => {
                const input = e.target as HTMLInputElement;
                const files = Array.from(input.files ?? []);
                if (files.length > 0) {
                  void this.addFiles(files);
                }
                input.value = "";
              }}
            />
            <button
              class="btn"
              type="button"
              ?disabled=${!this.connected}
              @click=${() => this.handlePickFiles()}
              title=${t("chat.uploadTitle")}
            >
              ${icons.paperclip} ${t("chat.uploadButton")}
            </button>
            <button
              class="btn"
              ?disabled=${!this.connected || (!this.canAbort && this.sending)}
              @click=${() => this.dispatchEvent(new CustomEvent(this.canAbort ? "abort" : "new-session", { bubbles: true, composed: true }))}
            >
              ${this.canAbort ? t("chat.stop") : t("chat.newSession")}
            </button>
            <button
              class="btn primary"
              ?disabled=${!this.connected}
              @click=${() => this.dispatchEvent(new CustomEvent("send", { bubbles: true, composed: true }))}
            >
              ${this.sending ? t("chat.queue") : t("chat.send")}<kbd class="btn-kbd">↵</kbd>
            </button>
          </div>
        </div>
        ${
          commandPanelVisible
            ? html`
                <div class="quick-commands" role="listbox" aria-label="Quick commands">
                  ${quickCommands.map(
                    (entry, index) => html`
                      <button
                        type="button"
                        class="quick-command-row"
                        data-active=${String(index === this.commandCursor)}
                        @mouseenter=${() => (this.commandCursor = index)}
                        @click=${() => this.applyQuickCommandTemplate(entry.template)}
                      >
                        <code>${entry.syntax}</code>
                        <span>${quickCommandDescription(entry.name)}</span>
                      </button>
                    `,
                  )}
                </div>
                <div class="quick-command-hint">${t("chat.quickCommandTip")}</div>
              `
            : nothing
        }
      </div>
    `;
  }
}
