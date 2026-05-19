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

type ChatComposeMode = "message" | "task" | "dispatch" | "agent";

const COMPOSE_MODES: Array<{
  id: ChatComposeMode;
  label: string;
  icon: unknown;
  hint: string;
  placeholder: string;
}> = [
  {
    id: "message",
    label: "Message",
    icon: icons.message,
    hint: "Reply in the current thread.",
    placeholder: "Ask, explain, or continue the conversation...",
  },
  {
    id: "task",
    label: "Task",
    icon: icons.check,
    hint: "Turn this into a Cognitive task.",
    placeholder: "Describe the mission. I will decompose, execute, verify, and reflect...",
  },
  {
    id: "dispatch",
    label: "Dispatch",
    icon: icons.terminal,
    hint: "Send work to the agent runtime.",
    placeholder:
      "Dispatch DevAgent / QAAgent / OpsAgent with constraints and acceptance criteria...",
  },
  {
    id: "agent",
    label: "Agent",
    icon: icons.brain,
    hint: "Delegate this as a parallel subagent mission.",
    placeholder:
      "Describe the subagent mission, blocker, or handoff you want to run in parallel...",
  },
];

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
  @state() private currentMode: ChatComposeMode = "message";
  @state() private commandCursor = 0;
  @state() private attachmentError: string | null = null;
  private static readonly MAX_ATTACHMENT_BYTES = 5_000_000;

  static styles = css`
    :host {
      display: block;
      position: relative;
    }

    .chat-compose-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      margin: 0 auto;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(148, 163, 184, 0.15);
      border-radius: 24px;
      padding: 12px 16px;
      transition:
        border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1),
        box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    }

    .chat-compose-container:focus-within {
      border-color: rgba(45, 212, 191, 0.4);
      box-shadow:
        0 0 0 1px rgba(45, 212, 191, 0.1),
        0 8px 32px rgba(0, 0, 0, 0.4);
      background: rgba(15, 23, 42, 0.8);
    }

    .chat-top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }

    .mode-group {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 3px;
      border-radius: 18px;
      background: rgba(2, 6, 23, 0.34);
      border: 1px solid rgba(148, 163, 184, 0.1);
    }

    .mode-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      background: transparent;
      border: 1px solid transparent;
      color: #64748b;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      padding: 6px 12px;
      border-radius: 16px;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .mode-btn svg {
      width: 14px;
      height: 14px;
      opacity: 0.7;
      transition: transform 0.2s;
    }

    .mode-btn:hover {
      background: rgba(255, 255, 255, 0.05);
      color: #94a3b8;
    }

    .mode-btn:hover svg {
      transform: scale(1.1);
      opacity: 1;
    }

    .mode-btn[data-active="true"] {
      background: rgba(45, 212, 191, 0.1);
      color: #2dd4bf;
      border-color: rgba(45, 212, 191, 0.2);
    }

    .mode-btn[data-active="true"] svg {
      opacity: 1;
      filter: drop-shadow(0 0 4px rgba(45, 212, 191, 0.4));
    }

    .mode-hint {
      color: #64748b;
      font-size: 11px;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .chat-compose-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 8px;
      gap: 12px;
    }

    .footer-left,
    .footer-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .context-pill {
      background: rgba(30, 41, 59, 0.6);
      padding: 4px 10px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      color: #94a3b8;
      font-weight: 600;
      font-size: 11px;
      border: 1px solid rgba(148, 163, 184, 0.05);
      transition: all 0.2s;
    }

    .context-pill:hover {
      background: rgba(30, 41, 59, 0.8);
      color: #e2e8f0;
      border-color: rgba(148, 163, 184, 0.2);
    }

    .command-pill {
      border: 1px solid rgba(148, 163, 184, 0.12);
      background: rgba(15, 23, 42, 0.54);
      color: #94a3b8;
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
    }

    .command-pill:hover {
      color: #e2e8f0;
      border-color: rgba(45, 212, 191, 0.28);
      background: rgba(45, 212, 191, 0.08);
    }

    .attach-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.05);
      color: #94a3b8;
      cursor: pointer;
      transition: all 0.2s;
    }

    .attach-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #e2e8f0;
    }

    .attach-btn svg {
      width: 16px;
      height: 16px;
    }

    .action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      height: 36px;
      padding: 0 16px;
      border-radius: 18px;
      border: none;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.02em;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .action-btn svg {
      width: 14px;
      height: 14px;
    }

    .action-btn.send {
      background: linear-gradient(135deg, #0d9488, #0f766e);
      color: white;
      box-shadow: 0 2px 8px rgba(13, 148, 136, 0.2);
    }

    .action-btn.send:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(13, 148, 136, 0.3);
      filter: brightness(1.1);
    }

    .action-btn.send:active:not(:disabled) {
      transform: translateY(0);
    }

    .action-btn.stop {
      background: rgba(225, 29, 72, 0.1);
      color: #e11d48;
      border: 1px solid rgba(225, 29, 72, 0.2);
    }

    .action-btn.stop:hover:not(:disabled) {
      background: rgba(225, 29, 72, 0.2);
      border-color: rgba(225, 29, 72, 0.4);
    }

    .action-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none !important;
      box-shadow: none !important;
    }

    .chat-attachments {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 8px;
    }

    .chat-attachment {
      position: relative;
      width: 54px;
      height: 54px;
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

    textarea::placeholder {
      color: var(--muted-color, #94a3b8);
      opacity: 0.7;
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

  private emitSend() {
    this.dispatchEvent(
      new CustomEvent("send", {
        detail: { message: this.draft, mode: this.currentMode },
        bubbles: true,
        composed: true,
      }),
    );
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
    const activeMode =
      COMPOSE_MODES.find((mode) => mode.id === this.currentMode) ?? COMPOSE_MODES[0];
    const composePlaceholder = this.connected
      ? hasAttachments
        ? t("chat.composePlaceholderWithAttachments")
        : activeMode.placeholder
      : t("chat.composeDisconnectedPlaceholder");

    return html`
      <div class="chat-compose-container">
        <div class="chat-top-bar">
          <div class="mode-group" aria-label="Chat input mode">
            ${COMPOSE_MODES.map(
              (mode) => html`
                <button
                  class="mode-btn"
                  data-active=${String(this.currentMode === mode.id)}
                  @click=${() => (this.currentMode = mode.id)}
                  title=${mode.hint}
                  type="button"
                >
                  ${mode.icon} <span>${mode.label}</span>
                </button>
              `,
            )}
          </div>
          <div class="mode-hint">${activeMode.hint}</div>
        </div>

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
        ${this.attachmentError ? html`<div class="attachment-error" role="status" style="color: #e11d48; font-size: 11px; margin-bottom: 8px; font-weight: 600;">${this.attachmentError}</div>` : nothing}

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
            this.emitSend();
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

        <div class="chat-compose-footer">
          <div class="footer-left">
            <button
              class="attach-btn"
              @click=${() => {
                this.handlePickFiles();
              }}
              title="Upload Files"
              type="button"
            >
              ${icons.paperclip}
            </button>
            <button
              class="command-pill"
              type="button"
              @click=${() => this.applyQuickCommandTemplate(this.draft.trim() ? this.draft : "/")}
              title="Open command palette"
            >
              / Commands
            </button>
          </div>
          <div class="footer-right">
            <button
              class="action-btn stop"
              ?disabled=${!this.connected}
              @click=${() => this.dispatchEvent(new CustomEvent(this.canAbort ? "abort" : "new-session", { bubbles: true, composed: true }))}
              type="button"
            >
              ${this.canAbort ? icons.stop : icons.zap} <span>${this.canAbort ? "Stop" : "Reset"}</span>
            </button>
            <button
              class="action-btn send"
              ?disabled=${!this.connected}
              @click=${() => this.emitSend()}
              type="button"
            >
              ${icons.send} <span>${this.currentMode === "task" ? "Submit Task" : this.currentMode === "dispatch" ? "Dispatch" : this.currentMode === "agent" ? "Delegate Agent" : "Send"}</span>
            </button>
          </div>
        </div>

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

        ${
          commandPanelVisible
            ? html`
                <div class="quick-commands" role="listbox" aria-label="Quick commands" style="position: absolute; bottom: 100%; left: 0; right: 0; z-index: 100; margin-bottom: 12px; background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(12px); border: 1px solid rgba(148, 163, 184, 0.2); box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
                  ${quickCommands.map(
                    (entry, index) => html`
                      <button
                        type="button"
                        class="quick-command-row"
                        data-active=${String(index === this.commandCursor)}
                        @mouseenter=${() => (this.commandCursor = index)}
                        @click=${() => this.applyQuickCommandTemplate(entry.template)}
                        style="padding: 12px 16px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid rgba(148, 163, 184, 0.05);"
                      >
                        <code style="background: rgba(45, 212, 191, 0.1); color: #2dd4bf; padding: 2px 6px; border-radius: 4px; font-weight: 700;">${entry.syntax}</code>
                        <span style="color: #94a3b8; font-size: 11px;">${quickCommandDescription(entry.name)}</span>
                      </button>
                    `,
                  )}
                </div>
              `
            : nothing
        }
      </div>

    `;
  }
}
