# Prisme.ai Builder MCP Server

Prisme.ai MCP is distributed as a plugin for **Claude Code** and **Codex**. The plugin bundles the MCP server, Prisme.ai skills, Claude agents and hooks, documentation, and the DSUL linter in one repository.

## Features

| Feature | Description |
|---------|-------------|
| **Workspaces** | Pull/push workspaces, search across workspaces, Edit, search activity |
| **AI Knowledge** | RAG queries, document management, project management |
| **Documentation** | Access Prisme.ai docs directly |

## Quick Start

```bash
git clone https://github.com/prismeai/prismeai-mcp.git
cd mcp-prisme.ai
./claudeBootstrap/setup.sh
cp -r ./claudeBootstrap/.claude /path/to/your/project/
```

Then start Claude Code:

```bash
claude
```

## Example Workflow

```
/design Vector Store, specify vectorStore by agent

> LLM response, creates a design ticket

/guide how to proceed from now?

> LLM instructs to create a GitLab ticket

/gitlab-ticket ./tickets/vector-store-per-agent/base-ticket.md

> LLM produces an in-depth ticket
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
| `plugin/hooks/` | Claude hook configuration and scripts |
| `plugin/llmDoc/` | Prisme.ai documentation exposed to tools |

## Reference Docs

| Guide | Description |
|-------|-------------|
| [Quick Start](./docs/QUICK_START.md) | Installation and setup |
| [Tools Reference](./docs/TOOLS.md) | All available MCP tools |
| [Environments](./docs/ENVIRONMENTS.md) | Multi-environment configuration |
| [Development](./docs/DEVELOPMENT.md) | Contributing and development |
| [Manual Setup](./docs/MANUAL_SETUP.md) | Claude Desktop, Cursor, other clients |
