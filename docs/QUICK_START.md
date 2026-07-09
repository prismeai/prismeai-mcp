# Quick Start

Install the Prisme.ai plugin from GitHub and start using the bundled MCP server, skills, agents, and DSUL linter in Claude Code or Codex.

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

## Authenticate

The recommended path keeps your token out of the chat (it is never sent to the LLM provider):

1. Create an API token in the studio of your environment: `https://<studio-domain>/settings/tokens` (e.g. <https://sandbox.prisme.ai/settings/tokens>).
2. Run `set-token` in your own terminal as one shell command — the exact command (with path + config dir) is printed in the "no credentials" error when you first call a tool. Copy it exactly; do not insert line breaks inside quoted paths:
   ```bash
   node "<plugin>/build/index.js" set-token sandbox --config-dir "<config-dir>"
   ```
   It prompts for the token with hidden input, then asks for the Prisme API URL, e.g. `https://api.sandbox.prisme.ai/v2`. If unsure, open the Prisme instance in a browser and copy the API base URL from the Network tab.
3. Re-run your request — the token is picked up automatically (no restart). Repeat per environment; re-run to rotate.

You can instead ask the agent to register a pasted token via the `set_token` tool, but that sends the token to the LLM provider — prefer the CLI above.

## After Install

Run `/prisme-ai:guide` for the skills catalog and Prisme.ai context. In Claude Code, type `@` to see available `mcp__prisme-ai-builder__*` tools. In Codex, plugin MCP tools may be loaded lazily; use a request that clearly needs Prisme.ai tools, or search for the Prisme.ai Builder tools.

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
