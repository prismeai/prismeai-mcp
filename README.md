# Prisme.ai MCP Plugin

Prisme.ai MCP is distributed as a plugin for **Claude Code** and **Codex**. The plugin bundles the MCP server, Prisme.ai skills, Claude agents, hooks, documentation, and the DSUL linter in one repository.

Legacy direct MCP registration, `setup.sh`, local `build/index.js` registration, Playwright token capture, and manual `.claude` copying are retired. Install and use the plugin only.

## What You Get

| Component | Description |
|-----------|-------------|
| MCP server | `prisme-ai-builder` tools for workspaces, automations, apps, events, files, AI Knowledge, and Prisme.ai documentation |
| DSUL validation | `validate_automation`, backed by the bundled linter |
| Skills | `/prisme-ai:*` skills for connector scaffolding, testing, documentation, fleet sync, A2UI, workspace pages, assistant workflows, and ticket validation |
| Claude agents | `code-review` and `prisme-assistant` for Claude Code |
| Hooks | Workspace allowlist hook for sensitive Prisme.ai write/execution tools |

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

## Authenticate

Authentication uses user-created Prisme.ai API tokens.

1. Create a token in the target studio: `https://<studio-domain>/settings/tokens`
   Example: <https://sandbox.prisme.ai/settings/tokens>
2. Ask the agent to register the token for the environment, or call the MCP tool directly:

```json
{
  "environment": "sandbox",
  "token": "<your token>"
}
```

`set_token` validates the token with the API before persisting it. Valid tokens are stored in the plugin data directory as `credentials.json` with file mode `600`; invalid tokens persist nothing.

Run `set_token` again any time you need to rotate a token.

## First Use

After installation, run:

```text
/prisme-ai:guide
```

The guide lists every bundled skill and includes the Prisme.ai environment rules, workspace parameter rules, event-search patterns, and recommended workflow.

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

Pull plugin updates from the marketplace:

### Claude Code

```text
/plugin marketplace update prismeai-mcp
```

### Codex

```bash
codex plugin marketplace upgrade prismeai-mcp
```

Release tags rebuild and commit the self-contained bundle at `plugin/build/index.js`.

## Legacy Cleanup

This section is only for machines that used the retired installer or manual MCP registration.

Remove old MCP registrations after installing the plugin:

```bash
claude mcp remove prisme-ai-builder
codex mcp remove prisme-ai-builder
```

The plugin automatically imports legacy `PRISME_ENVIRONMENTS` from the old environment variable or `~/.claude.json` on first start when its config directory is empty.

Do not run `claudeBootstrap/setup.sh`; it is retired. Do not register `build/index.js` manually. Do not copy `claudeBootstrap/.claude` into projects.

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

## Maintainer Development

Only plugin maintainers need local development commands:

```bash
npm install
npm run dev
npm run build
npm run build:bundle
```

`npm run build:bundle` rebuilds the committed runtime artifact at `plugin/build/index.js`.

## Plugin Layout

| Path | Purpose |
|------|---------|
| `.claude-plugin/marketplace.json` | Claude marketplace entry, pointing to `./plugin` |
| `.agents/plugins/marketplace.json` | Codex marketplace entry, pointing to `./plugin` |
| `plugin/.claude-plugin/plugin.json` | Claude plugin manifest |
| `plugin/.codex-plugin/plugin.json` | Codex plugin manifest |
| `plugin/.mcp.json` | MCP server definition |
| `plugin/build/index.js` | Self-contained MCP server bundle |
| `plugin/skills/` | Bundled Prisme.ai skills |
| `plugin/agents/` | Claude Code agents |
| `plugin/hooks/` | Hook configuration and scripts |
| `plugin/llmDoc/` | Prisme.ai documentation exposed to tools |

## Reference Docs

| Guide | Description |
|-------|-------------|
| [Quick Start](./docs/QUICK_START.md) | Plugin install and first token setup |
| [Tools Reference](./docs/TOOLS.md) | MCP tools exposed by the plugin |
| [Environments](./docs/ENVIRONMENTS.md) | Plugin environment and token persistence |
| [Development](./docs/DEVELOPMENT.md) | Maintainer development and release flow |
