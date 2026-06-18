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

Recommended (keeps the token out of the chat / off the wire to the LLM provider):

1. Create an API token in the studio of your environment: `https://<studio-domain>/settings/tokens` (e.g. <https://sandbox.prisme.ai/settings/tokens>).
2. Run `set-token` in your own terminal (the exact command, with path + config dir, is in the "no credentials" error):
   ```bash
   node "<plugin>/build/index.js" set-token sandbox --config-dir "<config-dir>"
   ```
   It prompts for the token with hidden input, validates it against the API, then saves it to the plugin data dir (`credentials.json`, mode 600).
3. Re-run your request — no restart needed. Repeat per environment; re-run to rotate.

Fallback: ask the agent to register a pasted token via the `set_token` tool — but that token is sent to the LLM provider as part of the conversation, so prefer the CLI.

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
