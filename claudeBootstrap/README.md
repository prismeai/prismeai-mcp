# Moved: install as a plugin

`setup.sh` is retired. The MCP server, skills, agents, and hooks are now distributed as a **plugin** consumable by both Claude Code and Codex, straight from this repository.

## Install

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

No `npm install`, no build: the plugin ships a prebuilt, self-contained `plugin/build/index.js` (Node-only, no Playwright).

## Authenticate

1. Create an API token in the studio of your environment: `https://<studio-domain>/settings/tokens` (e.g. <https://sandbox.prisme.ai/settings/tokens>).
2. Ask the agent to register it, or call the `set_token` tool directly with `environment` + `token`. The token is validated against the API, then persisted in the plugin data dir (`credentials.json`, mode 600).
3. Repeat per environment. Re-run `set_token` to rotate an expired token.

If a tool call targets an environment with no stored token, the error message contains the exact token-creation URL for that environment.

## Migrating from setup.sh

If you previously ran `setup.sh`, the server automatically imports your existing `PRISME_ENVIRONMENTS` (from the env var or `~/.claude.json`) into the new config dir on first start. You can then remove the old registrations:

```
claude mcp remove prisme-ai-builder
codex mcp remove prisme-ai-builder
```

The `~/.claude/settings.json` `apiKeyHelper` written by old setup.sh versions is no longer used; remove it if you authenticate with your own `claude` login.

## What the plugin contains

- **MCP server** (`prisme-ai-builder`): workspaces, automations, apps, events, files, AI Knowledge, DSUL linter (`validate_automation`)
- **Skills** (`/prisme-ai:<name>`): run `/prisme-ai:guide` for the catalog — includes `prisme-assistant` and `ticket-validator`
- **Agents** (Claude only): `code-review`, `prisme-assistant`
- **Hooks**: `allow-workspace.sh` workspace allowlist template for `execute_automation` / `push_workspace`

See the root [README](../README.md) for full documentation.
