# Prisme.ai MCP Plugin

Prisme.ai MCP is distributed as a plugin for **Claude Code**, **Codex**, and **VS Code Copilot**. The plugin bundles the MCP server, Prisme.ai skills, Claude agents, documentation, and the DSUL linter in one repository. On those clients, install and use the plugin only.

Clients that are not plugin hosts — Cursor, Claude Desktop — consume the bundled MCP server directly; see [Manual Setup](./docs/MANUAL_SETUP.md).

## What You Get

| Component | Description |
|-----------|-------------|
| MCP server | `prisme-ai-builder` tools for workspaces, automations, apps, events, files, AI Knowledge, and Prisme.ai documentation |
| DSUL validation | `validate_automation`, backed by the bundled linter |
| Skills | `/prisme-ai:*` skills for connector scaffolding, consumer E2E testing, documentation, A2UI, workspace pages, assistant workflows, and ticket validation |
| Claude agents | `prisme-code-review` for Claude Code |

## Prerequisites

- Claude Code, Codex, or a VS Code build with agent plugin support (Agent Plugins 1.0, August 2026 or later)
- **Node.js v18+**, resolvable from the environment the client is launched from

The plugin runs the committed bundle with `node`; no Node.js runtime ships with it. Check before installing:

```bash
node --version
```

If the command is not found, install Node.js first ([nodejs.org](https://nodejs.org), or a version manager such as `nvm` or `fnm`). A client started from a desktop launcher does not always inherit a `PATH` set up in your shell profile — starting it from a terminal is the reliable path.

## Install From GitHub

Repository: [prismeai/prismeai-mcp](https://github.com/prismeai/prismeai-mcp)

### Claude Code

In Claude Code:

```text
/plugin marketplace add prismeai/prismeai-mcp
/plugin install prisme-ai@prismeai-mcp
```

Then reload plugins or restart the session if the tools are not visible immediately.

### Codex

From a terminal:

```bash
codex plugin marketplace add prismeai/prismeai-mcp
codex plugin add prisme-ai@prismeai-mcp
```

The plugin source is `./plugin` inside this repository. Both marketplaces point there, so the same GitHub repo installs cleanly in Claude Code and Codex.

### VS Code Copilot

VS Code detects Claude-format plugins, so this repository installs as an agent plugin — no manual MCP configuration.

1. Add the marketplace in `Preferences: Open User Settings (JSON)`:

   ```json
   "chat.plugins.marketplaces": ["prismeai/prismeai-mcp"]
   ```

2. Open the Extensions view (`⇧⌘X` / `Ctrl+Shift+X`), search `@agentPlugins`, and install **prisme-ai**. `Chat: Open Customizations` → **Plugins** → **Browse Marketplace** is the equivalent path.

3. The `prisme-ai-builder` MCP server starts automatically once the plugin is enabled, and stops when it is disabled.

To register the plugin for a whole team, commit the recommendation to `.github/copilot/settings.json` in the target project instead:

```json
{
  "extraKnownMarketplaces": {
    "prismeai-mcp": {
      "source": { "source": "github", "repo": "prismeai/prismeai-mcp" }
    }
  },
  "enabledPlugins": {
    "prisme-ai@prismeai-mcp": true
  }
}
```

For a local checkout — maintainers, or testing an unreleased branch — skip the marketplace and register the folder with `chat.pluginLocations`:

```json
"chat.pluginLocations": {
  "/absolute/path/to/prismeai-mcp/plugin": true
}
```

**What loads.** The `prisme-ai-builder` tools and the bundled skills, which Copilot loads on demand rather than as `/prisme-ai:*` slash commands. The `prisme-code-review` agent is Claude Code-specific and is not exposed.

**Config directory.** VS Code expands `${CLAUDE_PLUGIN_ROOT}` but not `${PLUGIN_DATA}` for Claude-format plugins. The server detects the unexpanded value and falls back to `~/.prisme-ai-mcp`, so register tokens against that directory — see [Authenticate](#authenticate).

## Authenticate

Credentials are user-created API tokens, registered per environment. The recommended path keeps the token **out of the chat** (it is never sent to the LLM provider):

1. Create a token in the studio of the target environment: `https://<studio-domain>/settings/tokens` (e.g. <https://sandbox.prisme.ai/settings/tokens>).
2. Run the `set-token` command in your own terminal — the exact path + config dir are printed in the "no credentials" error:

   ```bash
   node "<plugin>/build/index.js" set-token sandbox --config-dir "<config-dir>"
   ```

   It prompts for the token with hidden input, the API and Studio URLs, and an optional `NODE_EXTRA_CA_CERTS` PEM path. It probe-validates the token (using the extra CA when configured), then saves it to the plugin data dir (`credentials.json`, mode 600). An invalid token saves nothing.
3. Re-run your request — the server picks up the new token automatically (no restart). Run `set-token` again anytime to rotate.

On VS Code Copilot the config dir is always `~/.prisme-ai-mcp` (see [VS Code Copilot](#vs-code-copilot)):

```bash
node "<plugin>/build/index.js" set-token sandbox --config-dir "$HOME/.prisme-ai-mcp"
```

When a tool call has no token (or hits a 401), the error message contains the exact command to run. If you first try to use any tool from the chat, the LLM agent will read that error and provide the proper `set-token` arguments for your environment and config dir. You can instead let the agent register a pasted token via the `set_token` tool, but that token is sent to the LLM provider as part of the conversation — prefer the CLI.

## First Use

The slash commands below are Claude Code and Codex syntax. VS Code Copilot loads the same skills, but invokes them from the request itself — ask for the Prisme.ai guide rather than typing `/prisme-ai:guide`.

After installation, run:

```text
/prisme-ai:guide
```

The guide lists every bundled skill and includes the Prisme.ai environment rules, workspace parameter rules, event-search patterns, and recommended workflow.

For environment or token setup help, run:

```text
/prisme-ai:prisme-mcp-setup
```

Typical requests:

```text
List automations in ai-knowledge on sandbox
```

```text
Trace this correlationId in sandbox: <id>
```

```text
/prisme-ai:app-mcp-implement Salesforce connector
```

## Updating

Update in this order: first refresh the marketplace catalog, then update the
installed plugin. Refreshing the marketplace alone does not replace the
installed copy.

### Claude Code

```text
/plugin marketplace update prismeai-mcp
/plugin update prisme-ai@prismeai-mcp
/reload-plugins
```

### Codex

```bash
codex plugin marketplace upgrade prismeai-mcp
codex plugin add prisme-ai@prismeai-mcp
```

Codex does not currently provide a separate `plugin update` command. Re-running
`plugin add` after the marketplace upgrade installs the latest version from the
refreshed catalog. Start a new Codex session (or restart the desktop app) to load
the updated plugin.

### VS Code Copilot

VS Code checks for plugin updates every 24 hours when `extensions.autoUpdate` is on. To force a check, run `Extensions: Check for Extension Updates` from the Command Palette, then confirm the update on the **prisme-ai** entry in the **Agent Plugins - Installed** view.

Plugin updates are distributed from the committed source. Maintainers rebuild and commit `plugin/build/index.js` before tagging; CI only verifies that the tagged commit is consistent.

## Runtime Model

The plugin starts the committed bundle:

```text
plugin/build/index.js
```

Runtime requirements:

- Node.js, provided by the host environment
- No `npm install`
- No local build
- No Playwright
- No browser token capture

## Troubleshooting

### No `prisme-ai-builder` tools, and no error message

The client spawns the MCP server with `node` when the session starts. If `node` is not resolvable at that moment, the spawn fails and is not retried for the rest of the session: no tools appear, and no "no credentials" error is raised — so the `set-token` command that error normally prints never surfaces.

Check in this order:

1. `node --version` resolves in the shell the client was launched from.
2. Restart the client after installing Node.js. A session that already failed to spawn the server does not retry, so `set-token` alone will not recover it — this is the one case where the CLI's "no restart needed" message does not apply.
3. Only then register a token, as described in [Authenticate](#authenticate).

On VS Code, an editor started from the Dock or Start menu frequently misses a `PATH` set in your shell profile. Launch it with `code .` from a terminal, then disable and re-enable the plugin from the **Agent Plugins - Installed** view to respawn the server. `MCP: Show Output` prints the spawn error.

## Maintainer Development

Only plugin maintainers need source-based local setup. Use [Development](./docs/DEVELOPMENT.md) to run an MCP client against this repository checkout and rebuild the committed runtime artifact.

## Plugin Layout

| Path | Purpose |
|------|---------|
| `.claude-plugin/marketplace.json` | Claude marketplace entry, pointing to `./plugin`; also read by VS Code Copilot |
| `.agents/plugins/marketplace.json` | Codex marketplace entry, pointing to `./plugin` |
| `plugin/.claude-plugin/plugin.json` | Claude plugin manifest |
| `plugin/.mcp.json` | Claude MCP server definition, reused by VS Code Copilot |
| `plugin/.codex-plugin/plugin.json` | Codex manifest with its inline MCP server definition |
| `plugin/build/index.js` | Self-contained MCP server bundle |
| `plugin/skills/` | Bundled Prisme.ai skills |
| `plugin/agents/` | Claude Code agents |
| `plugin/llmDoc/` | Prisme.ai documentation exposed to tools |

Manual MCP clients bypass all of this and point directly at `plugin/build/index.js`.

## Reference Docs

| Guide | Description |
|-------|-------------|
| [Quick Start](./docs/QUICK_START.md) | Plugin install and first token setup |
| [Manual Setup](./docs/MANUAL_SETUP.md) | Configure non-plugin MCP clients against the committed plugin bundle |
| [Tools Reference](./docs/TOOLS.md) | MCP tools exposed by the plugin |
| [Environments](./docs/ENVIRONMENTS.md) | Plugin environment and token persistence |
| [Development](./docs/DEVELOPMENT.md) | Local repository setup for maintainers and release flow |
