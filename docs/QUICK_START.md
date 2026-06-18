# Quick Start

Get the Prisme.ai MCP server running with Claude Code or Codex in minutes.

> **Not using Claude Code or Codex?** See [MANUAL_SETUP.md](./MANUAL_SETUP.md) for Claude Desktop, Cursor, or other MCP clients.

## Prerequisites

- [Node.js](https://nodejs.org) v18+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) (`npm install -g @anthropic-ai/claude-code`) and/or Codex

## Installation

**Claude Code**

```
/plugin marketplace add prismeai/prismeai-mcp
/plugin install prisme-ai@prismeai-mcp
```

**Codex**

```
codex plugin marketplace add prismeai/prismeai-mcp
codex plugin add prisme-ai@prismeai-mcp
```

No clone, no `npm install`, no build: the plugin ships a prebuilt, self-contained MCP server (`plugin/build/index.js`).

## What Gets Installed

| Component | Description |
|-----------|-------------|
| MCP Server (`prisme-ai-builder`) | Workspaces, automations, apps, events, files, AI Knowledge, DSUL linter |
| Skills (`/prisme-ai:*`) | Connector scaffolding/testing/docs, A2UI, agent workspaces, `prisme-assistant`, `ticket-validator` — see `/prisme-ai:guide` |
| Agents (Claude only) | `code-review`, `prisme-assistant` |
| Hooks | `allow-workspace.sh` workspace allowlist template |

## Authenticate

1. Create an API token in the studio of your environment: `https://<studio-domain>/settings/tokens` (e.g. <https://sandbox.prisme.ai/settings/tokens>).
2. Register it with the `set_token` tool (just ask: *"register this token for sandbox: …"*). The token is validated against the API, then persisted to the plugin data dir.
3. Repeat per environment; re-run `set_token` to rotate an expired token.

If you previously installed via `setup.sh`, the server imports your existing environment configuration automatically on first start.

## After Install

Type `@` in Claude to see available `mcp__prisme-ai-builder__*` tools, and run `/prisme-ai:guide` for the skills catalog and Prisme.ai context.

## Verify Installation

Test with a simple command:

```
List all automations in the ai-knowledge workspace on sandbox
```

If no token is registered yet, the error message gives you the exact token-creation URL.

## Updating

```
/plugin marketplace update prismeai-mcp
```

---

**Next:** [Available Tools](./TOOLS.md) | [Environment Configuration](./ENVIRONMENTS.md)
