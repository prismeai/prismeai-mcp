# Prisme.ai Builder MCP Server

A Model Context Protocol (MCP) server for interacting with the Prisme.ai AI Builder API, distributed as a plugin for **Claude Code** and **Codex** (one repo, both manifests).

## Features

| Feature | Description |
|---------|-------------|
| **Workspaces** | Pull/push workspaces, search across workspaces, edit, search activity |
| **Automations** | CRUD, execution, authoritative DSUL linting (`validate_automation`) |
| **AI Knowledge** | RAG queries, document management, project management |
| **Documentation** | Access Prisme.ai docs directly |
| **Skills & agents** | `/prisme-ai:*` skills (connector scaffolding, testing, docs, A2UI…), `code-review` + `prisme-assistant` agents |

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

The plugin ships a prebuilt, self-contained `plugin/build/index.js`: the only runtime requirement is `node` (already required by both tools). No `npm install`, no build step, no SessionStart cost.

## Authenticate

Credentials are user-created API tokens, registered per environment:

1. Create a token in the studio of the target environment: `https://<studio-domain>/settings/tokens` (e.g. <https://sandbox.prisme.ai/settings/tokens>).
2. Register it with the `set_token` tool (`environment` + `token`). The token is probe-validated against the API, then persisted to the plugin data dir (`credentials.json`, mode 600) — an invalid token persists nothing.
3. Re-run `set_token` anytime to rotate an expired token.

If a tool call targets an environment with no stored token, the error contains the exact token-creation URL for that environment. Users migrating from the old `setup.sh` install are imported automatically on first start (from `PRISME_ENVIRONMENTS` or `~/.claude.json`).

## Getting started

Run `/prisme-ai:guide` for the skills catalog and the Prisme.ai environment context (environments, workspace parameters, event schema, recommended workflow).

## Updating

Releases bump the plugin `version` and refresh the committed bundle (see `.github/workflows/release.yml`). Pull the update with:

```
/plugin marketplace update prismeai-mcp
```

## Development

```bash
npm install           # also installs linter/ deps
npm run dev           # run from TypeScript sources (tsx)
npm run build         # tsc build (build/ tree)
npm run build:bundle  # self-contained single-file bundle -> plugin/build/index.js
```

`plugin/build/index.js` is a committed artifact rebuilt by CI on each release tag.

## Documentation

| Guide | Description |
|-------|-------------|
| [Quick Start](./docs/QUICK_START.md) | Installation and setup |
| [Tools Reference](./docs/TOOLS.md) | All available MCP tools |
| [Environments](./docs/ENVIRONMENTS.md) | Multi-environment configuration |
| [Development](./docs/DEVELOPMENT.md) | Contributing and development |
| [Manual Setup](./docs/MANUAL_SETUP.md) | Claude Desktop, Cursor, other clients |
