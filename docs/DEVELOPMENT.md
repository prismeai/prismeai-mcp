# Development Guide

This page is for maintainers who want an MCP client to run against this local repository checkout instead of the installed plugin bundle.

For normal installation, use [Quick Start](./QUICK_START.md). For non-plugin MCP clients that should use the released bundle, use [Manual Setup](./MANUAL_SETUP.md).

## Local Setup

```bash
# Install dependencies
npm install

# Type-check and build once
npm run build

# Run the MCP server from TypeScript source
npm run dev
```

`npm run dev` starts `tsx src/index.ts`. Use this when testing local source changes before rebuilding the committed plugin artifact.

## Local MCP Client Configuration

Point your MCP client at the local repository, not at the installed plugin cache.

```json
{
  "mcpServers": {
    "prisme-ai-builder-local": {
      "cwd": "/absolute/path/to/prismeai-mcp",
      "command": "npm",
      "args": ["run", "dev"],
      "env": {
        "PRISME_CONFIG_DIR": "/absolute/path/to/prismeai-mcp/.local/prisme-config"
      }
    }
  }
}
```

Then register a token for that local config directory:

```bash
node "/absolute/path/to/prismeai-mcp/plugin/build/index.js" set-token sandbox --config-dir "/absolute/path/to/prismeai-mcp/.local/prisme-config"
```

The `set-token` command can use the committed bundle because token storage format is shared with the source server.

## Bundle Verification

Before releasing plugin changes, rebuild the self-contained artifact:

```bash
npm run build:bundle
```

This updates `plugin/build/index.js`, which is what the Claude Code and Codex plugins run after marketplace installation.

## Minimal Release Flow

1. Bump the same version in `package.json`, `package-lock.json`, both plugin manifests, and `.agents/plugins/marketplace.json`.
2. Run `npm run build:bundle`, `npm test`, and `npm run validate:versions`.
3. Commit the source, manifests, and generated bundle together.
4. Tag that exact commit as `v<version>`.

GitHub Actions validates pull requests, `main`, and version tags. It never changes the repository or publishes a release artifact.

## Project Structure

```
mcp-prisme.ai/
├── src/
│   ├── index.ts          # Main MCP server
│   ├── api-client.ts     # Prisme.ai API client
│   └── config.ts         # Configuration handling
├── plugin/               # The plugin shipped to Claude Code + Codex
│   ├── .claude-plugin/   # Claude plugin manifest
│   ├── .codex-plugin/    # Codex plugin manifest
│   ├── .mcp.json         # Claude MCP server registration
│   ├── skills/           # Plugin skills (/prisme-ai:*)
│   ├── agents/           # Claude agent (prisme-code-review)
│   ├── llmDoc/           # Documentation served by get_prisme_documentation
│   ├── config/           # Default environment topology
│   └── build/index.js    # Committed self-contained bundle (npm run build:bundle)
├── .claude-plugin/       # Claude marketplace (source: ./plugin)
├── .agents/plugins/      # Codex marketplace (source: ./plugin)
├── docs/                 # Documentation
├── build/                # tsc output (gitignored, dev only)
└── README.md
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PRISME_CONFIG_DIR` | No | Directory for `config.json` and `credentials.json`; recommended for local MCP testing |
| `PRISME_API_KEY` | No | Static bearer token for single-environment debugging |
| `PRISME_WORKSPACE_ID` | No | Default workspace ID |
| `PRISME_API_BASE_URL` | No | API base URL |
| `PRISME_DEFAULT_ENVIRONMENT` | No | Default environment name |
| `PRISME_WORKSPACES` | No | Legacy workspace mappings |
| `PRISME_FORCE_READONLY` | No | Block write operations |
| `PRISME_DISABLE_FEEDBACK_TOOLS` | No | Disable feedback reporting tools |

## API Endpoints

The MCP server interacts with:

| Endpoint | Operation |
|----------|-----------|
| `POST /v2/workspaces/{id}/automations` | Create automation |
| `GET /v2/workspaces/{id}/automations/{slug}` | Get automation |
| `PATCH /v2/workspaces/{id}/automations/{slug}` | Update automation |
| `DELETE /v2/workspaces/{id}/automations/{slug}` | Delete automation |
| `GET /v2/workspaces/{id}` | Get workspace |
| `POST /v2/workspaces/{id}/test/{slug}` | Execute automation |
| `POST /v2/workspaces/{id}/search` | Search events |

## Error Codes

| Code | Description |
|------|-------------|
| 401 | Authentication error |
| 403 | Permission error |
| 404 | Not found |
| 400 | Validation error |

## Running Standalone

```bash
# Optional .env-based local run
cp .env.example .env
npm start
```

`npm start` runs the committed bundle at `plugin/build/index.js`. Use `npm run dev` when validating source changes.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run build` to verify
5. Submit a pull request

---

**Back to:** [README](../README.md) | [Quick Start](./QUICK_START.md)
