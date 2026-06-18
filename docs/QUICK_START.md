# Quick Start

Install the Prisme.ai plugin from GitHub and start using the bundled MCP server, skills, agents, hooks, and DSUL linter in Claude Code or Codex.

## Prerequisites

- Claude Code and/or Codex
- Node.js v18+ available to the host runtime

## Installation

Repository: [prismeai/prismeai-mcp](https://github.com/prismeai/prismeai-mcp)

**Claude Code**

```text
/plugin marketplace add prismeai/prismeai-mcp
/plugin install prisme-ai@prismeai-mcp
```

**Codex**

```bash
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

## After Install

Run `/prisme-ai:guide` for the skills catalog and Prisme.ai context. In Claude Code, type `@` to see available `mcp__prisme-ai-builder__*` tools.

## Verify Installation

Test with a simple command:

```
List all automations in the ai-knowledge workspace on sandbox
```

If no token is registered yet, the error message gives you the exact token-creation URL.

## Updating

**Claude Code**

```text
/plugin marketplace update prismeai-mcp
```

**Codex**

```bash
codex plugin marketplace upgrade prismeai-mcp
```

---

**Next:** [Available Tools](./TOOLS.md) | [Environment Configuration](./ENVIRONMENTS.md)
