---
name: native-mcp
description: Use OpenAEON's MCP-oriented workflow safely: prefer the bundled mcporter skill for ad-hoc MCP discovery, schema inspection, authentication, daemon management, and direct tool calls.
version: 1.0.0
author: OPENAEON
license: MIT
metadata:
  openaeon:
    tags: [MCP, Tools, Integrations]
    related_skills: [mcporter]
---

# Native MCP Notes

OpenAEON currently exposes MCP work through `mcporter` and related runtime bridges, not through a separate startup MCP configuration. Use this skill as a routing note: when a task asks for MCP discovery or MCP tool execution, load `mcporter` and call its CLI-oriented workflow.

## When to Use

Use this whenever the user asks to:

- list available MCP servers or tools
- inspect an MCP tool schema
- authenticate an MCP server
- call a one-off MCP tool
- keep an MCP server warm through a daemon
- compare MCP behavior with OpenAEON tool invocation

## Preferred OpenAEON Flow

1. Load the `mcporter` skill.
2. Inspect configured servers with `mcporter list`.
3. Inspect a schema with `mcporter list <server> --schema`.
4. Call tools with `mcporter call <server.tool> key=value` or `mcporter call <server.tool> --args '{"key":"value"}'`.
5. Use `mcporter daemon start|status|stop|restart` when repeated calls need a warm runtime.

## Safety Notes

- Do not invent startup MCP config keys that OpenAEON does not support directly.
- Prefer JSON output when the result will be parsed by an agent.
- Treat MCP servers as external code. Pass credentials explicitly and only to servers that need them.
- Redact tokens, cookies, and API keys from logs, prompts, and final replies.
