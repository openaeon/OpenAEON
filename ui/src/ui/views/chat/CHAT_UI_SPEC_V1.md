# Chat UI Spec v1

## 1) Information Architecture

### Three-level hierarchy

- Level 1: primary chat thread and message composer.
- Level 2: session status strip (session identity + key runtime status).
- Level 3: advanced orchestration surfaces (plan sidebar, subagent sidebar, tool output sidebar).

### Default visibility rules

- Default state shows Level 1 and Level 2.
- Level 3 is explicit-open only through "Show workbench".
- Tool output sidebar can still open on demand from message tool content.

### Standard page states

- Empty: no message history in current session.
- Chatting: message history present and no active execution stream.
- Executing: sending or streaming is active.
- Recovery: execution watchdog reports degraded state.

## 2) Visual System

### Token set

- Spacing scale: 4, 8, 12, 16, 24.
- Border radius: 8 (controls), 10 (composer/callout), 12 (containers).
- Semantic colors:
  - Neutral surface/border/text/muted.
  - Info accent for executing state.
  - Warning accent for recovery state.
  - Danger accent for fatal errors.

### Style direction

- `professional` mode is the default visual mode.
- `legacy` mode keeps the previous high-effects style path.
- Glow/gradient effects are limited to legacy mode only.

## 3) Component Behavior

### Session status strip

- Default collapsed summary fields: model, delivery status, session activity.
- Expandable details: thinking level, persisted timestamp, eternal mode, session key.
- Includes explicit controls for workbench toggle and detail toggle.

### Advanced sidebars

- Plan/subagent sidebars are hidden by default.
- Workbench toggle controls visibility.
- Tool output sidebar remains higher-priority and can open independently.

### Composer

- Keep existing features: attachments, quick commands, send/stop/new session.
- Align control heights, spacing, and contrast with professional mode tokens.

## 4) Responsive strategy

### Desktop-first

- Desktop remains split layout with optional right sidebar.
- Compact density reduces spacing in status strip, thread, and composer.

### Narrow view fallback

- Sidebar remains explicit-open and avoids forced split by default.
- Status strip supports wrap and retains readable chip/button sizes.

## 5) Implementation Mapping

- Layout and hierarchy logic:
  - `ui/src/ui/views/chat-layout.ts`
- Primary chat visual tokens and state styling:
  - `ui/src/ui/views/chat/styles/layout.ts`
- Sidebar visual unification:
  - `ui/src/ui/views/chat/styles/sidebar.ts`
- Composer visual unification:
  - `ui/src/ui/components/chat-input-area.ts`
- Settings surface for rollout toggles:
  - `ui/src/ui/storage.ts`
  - `ui/src/ui/app-render.ts`
  - `ui/src/ui/views/chat.ts`

## 6) Compatibility and Risk Note

- No gateway/chat protocol changes.
- No business-logic changes to send/abort/stream flow.
- Main risk is visual regression only (spacing, color contrast, snapshot drift).
- Rollout knobs are internal UI settings:
  - `chatVisualDensity`: `comfortable | compact`
  - `chatSidebarDefault`: `collapsed | last-state`
  - `chatVisualMode`: `professional | legacy`
