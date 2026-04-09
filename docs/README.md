# OpenAEON Docs Workspace

This directory contains source files for [https://docs.openaeon.ai](https://docs.openaeon.ai).

## Structure

- `start/`: onboarding and discovery
- `install/`: install and lifecycle operations
- `gateway/`: gateway runtime, security, networking, and config
- `channels/`: channel adapters and routing
- `tools/`: tool behavior and usage
- `concepts/`: architecture and system concepts
- `reference/`: reference and templates
- `help/`: troubleshooting and FAQ
- `platforms/`: platform-specific guides
- `providers/`: model/provider integration
- `nodes/`: node app and media runtime
- `automation/`: jobs, hooks, and webhook workflows
- `web/`: web surfaces

## Local Mintlify workflow

```bash
pnpm docs:dev
pnpm docs:check-links
pnpm check:docs
```

For editorial conventions and update flow, see:

- `/start/docs-maintenance`
