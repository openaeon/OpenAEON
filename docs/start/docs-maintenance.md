---
summary: "How to update OpenAEON docs with a Mintlify friendly workflow."
read_when:
  - You are editing docs and want a stable process
  - You need to run Mintlify locally and avoid broken links
title: "Docs Maintenance"
---

# Docs maintenance

Use this page as the source of truth for keeping `docs/` clean, discoverable, and Mintlify-friendly.

## What docs are for

OpenAEON docs are designed for three outcomes:

1. Help users install, configure, and operate OpenAEON safely.
2. Help contributors make changes without guessing hidden conventions.
3. Keep product behavior and public docs aligned release by release.

## Directory map

Use this structure when adding or moving pages:

- `docs/start/*`: onboarding and first-use flows
- `docs/install/*`: install methods, migration, update, uninstall
- `docs/gateway/*`: gateway architecture, config, security, operations
- `docs/channels/*`: channel integrations and routing behavior
- `docs/tools/*`: tool behavior and operational usage
- `docs/concepts/*`: system concepts and architecture mental models
- `docs/reference/*`: reference material, templates, release and test docs
- `docs/help/*`: troubleshooting, FAQ, environment, debugging
- `docs/platforms/*`: platform specific guidance (macOS/iOS/Android/Linux/Windows)
- `docs/providers/*`: model and service provider setup
- `docs/nodes/*`: node app and media capture runtime docs
- `docs/automation/*`: automation jobs, hooks, webhooks, scheduling
- `docs/web/*`: WebChat/Control UI/TUI docs

If a page spans multiple domains, put it under the closest operational owner and cross-link from related hubs.

## Mintlify friendly writing rules

- Internal links must be root-relative and extensionless, for example: `/gateway/configuration`.
- Do not use `.md` or `.mdx` suffixes in internal links.
- Prefer short, stable headings to preserve anchor reliability.
- Keep one primary intent per page and add a short `summary`.
- Add "Related docs" near the end of long pages.
- For renamed pages, add redirects in `docs/docs.json`.

## Update workflow

1. Edit or add English source pages in `docs/` (avoid editing generated `docs/zh-CN/**` directly).
2. Update navigation in `docs/docs.json` if the page should appear in left nav.
3. Run local checks:
   ```bash
   pnpm docs:dev
   pnpm docs:check-links
   pnpm check:docs
   ```
4. Verify:
   - page appears in the intended nav group
   - no broken internal links
   - no orphan pages for important user journeys

## Quick checklist for PRs

- Added/updated page has clear purpose and scope.
- New page is reachable from nav or from a hub page.
- Internal links are root-relative and extensionless.
- Release-facing behavior changes include docs updates in the same PR.
- Docs commands pass locally.
