# Manual Setup Guide

This guide covers manual MCP configuration for Claude Desktop, Cursor, and other clients that do not install Codex or Claude Code plugins directly.

For Claude Code or Codex, prefer the plugin install flow in [README.md](../README.md) or [Quick Start](./QUICK_START.md). For local repository development, use [Development](./DEVELOPMENT.md).

## Prerequisites

- A local copy of the released plugin source, or another path that contains the committed runtime bundle.
- Node.js v18+ available to the MCP client.

Manual clients should point at the committed plugin bundle:

```text
plugin/build/index.js
```

No `npm install` or build step is required for normal manual MCP use.

## Getting Your API Token

Create a token in the studio of your environment: `https://<studio-domain>/settings/tokens` (e.g. <https://sandbox.prisme.ai/settings/tokens>).

Register it with the `set-token` CLI (recommended — the token stays local and is validated before being saved to `PRISME_CONFIG_DIR`):

```bash
node "/absolute/path/to/prismeai-mcp/plugin/build/index.js" set-token sandbox --config-dir "$HOME/.prisme-ai-mcp"
```

It prompts for the token with hidden input (or reads `PRISME_TOKEN` from the env), then asks for the Prisme API URL, e.g. `https://api.sandbox.prisme.ai/v2`. If unsure, open the Prisme instance in a browser and copy the API base URL from the Network tab. Alternatively, register it at runtime with the `set_token` MCP tool, or pass a single environment statically via the environment variables below.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PRISME_CONFIG_DIR` | No | Directory for `config.json` (environments) and `credentials.json` (tokens). Defaults to `~/.prisme-ai-mcp` |
| `PRISME_API_KEY` | No | Static API token for single-environment setups (prefer `set_token`) |
| `PRISME_API_BASE_URL` | No | API base URL (e.g., `https://api.sandbox.prisme.ai/v2`) |
| `PRISME_WORKSPACE_ID` | No | Default workspace ID (can be empty) |
| `PRISME_DEFAULT_ENVIRONMENT` | No | Default environment name |
| `PRISME_WORKSPACES` | No | Legacy workspace name mappings (JSON) |
| `PRISME_FORCE_READONLY` | No | Block all write operations when `true` |
| `PRISME_DISABLE_FEEDBACK_TOOLS` | No | Disable feedback tools when `true` (no data sent to Prisme.ai) |

## Claude Desktop Configuration

Config file location:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

### Basic Configuration

```json
{
  "mcpServers": {
    "prisme-ai-builder": {
      "command": "node",
      "args": ["/absolute/path/to/prismeai-mcp/plugin/build/index.js"],
      "env": {
        "PRISME_API_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "PRISME_API_BASE_URL": "https://api.sandbox.prisme.ai/v2",
        "PRISME_WORKSPACE_ID": ""
      }
    }
  }
}
```

### Multi-Environment Configuration

Create or edit `$PRISME_CONFIG_DIR/config.json` with environment topology only, then register each token with `set-token`. For self-hosted / on-premise instances with their own API URL, see [Environment Configuration → On-premise / self-hosted instances](./ENVIRONMENTS.md#on-premise--self-hosted-instances).

Example `$HOME/.prisme-ai-mcp/config.json`:

```json
{
  "environments": {
    "sandbox": {
      "apiUrl": "https://api.sandbox.prisme.ai/v2",
      "studioUrl": "https://sandbox.prisme.ai",
      "default": true
    },
    "prod": {
      "apiUrl": "https://api.studio.prisme.ai/v2",
      "studioUrl": "https://studio.prisme.ai"
    }
  },
  "defaultEnvironment": "sandbox"
}
```

Then register tokens:

```bash
node "/absolute/path/to/prismeai-mcp/plugin/build/index.js" set-token sandbox --config-dir "$HOME/.prisme-ai-mcp"
node "/absolute/path/to/prismeai-mcp/plugin/build/index.js" set-token prod --config-dir "$HOME/.prisme-ai-mcp"
```

For a new environment that is not already in `config.json`, answer the URL prompt or pass `--api-url`:

```bash
node "/absolute/path/to/prismeai-mcp/plugin/build/index.js" set-token custom --api-url https://api.custom.prisme.ai/v2 --config-dir "$HOME/.prisme-ai-mcp"
```

### Workspace Mappings

For single API URL setups, `PRISME_WORKSPACES` can map friendly names to workspace IDs:

```json
{
  "mcpServers": {
    "prisme-ai-builder": {
      "command": "node",
      "args": ["/absolute/path/to/prismeai-mcp/plugin/build/index.js"],
      "env": {
        "PRISME_API_KEY": "your_bearer_token_here",
        "PRISME_WORKSPACE_ID": "your_default_workspace_id",
        "PRISME_API_BASE_URL": "https://api.sandbox.prisme.ai/v2",
        "PRISME_WORKSPACES": "{\"prod\":\"wks_123abc\",\"staging\":\"wks_456def\"}"
      }
    }
  }
}
```

## Cursor Configuration

Config file location:
- **macOS/Linux**: `~/.cursor/mcp.json`
- **Windows**: `%APPDATA%\Cursor\mcp.json`

Use the same configuration format as Claude Desktop above.

After configuration, restart Cursor to load the MCP server.

## Multi-Environment Details

### Environment Structure

Environments are dynamically configured. Each environment requires an API URL in `config.json`; tokens live separately in `credentials.json` and are written by `set-token` or `set_token`:

```json
{
  "environments": {
    "sandbox": {
      "apiUrl": "https://api.sandbox.prisme.ai/v2",
      "studioUrl": "https://sandbox.prisme.ai"
    },
    "staging": {
      "apiUrl": "https://api.staging.prisme.ai/v2",
      "studioUrl": "https://staging.prisme.ai"
    },
    "prod": {
      "apiUrl": "https://api.studio.prisme.ai/v2",
      "studioUrl": "https://studio.prisme.ai"
    },
    "custom": {
      "apiUrl": "https://api.your-instance.prisme.ai/v2"
    }
  }
}
```

### Per-Tool Parameters

All tools accept optional parameters:

| Parameter | Description |
|-----------|-------------|
| `environment` | Environment name from the configured environment topology |
| `workspaceName` | Workspace name from environment or workspace mappings |
| `workspaceId` | Direct workspace ID (overrides everything) |

### Resolution Priority

1. Direct `workspaceId` parameter (with `environment` for API URL if provided)
2. `environment` + `workspaceName` combination
3. `workspaceName` alone (uses default environment or workspace mappings)
4. `environment` alone (uses default workspace ID with environment's API URL)
5. Default workspace and API URL

If `environment` is provided, it must be configured. The server will not fall back to another environment.

### Usage Examples

```typescript
// Use environment + workspace name
{
  "automationSlug": "my-automation",
  "environment": "sandbox",
  "workspaceName": "ai-knowledge"
}

// Use just environment (uses default workspace ID)
{
  "automationSlug": "my-automation",
  "environment": "prod"
}

// Use direct workspace ID
{
  "automationSlug": "my-automation",
  "environment": "prod",
  "workspaceId": "custom_wks_id"
}
```

## Readonly Mode

Block all write operations for safe production monitoring:

```bash
PRISME_FORCE_READONLY=true
```

### Blocked Operations

- `create_automation`
- `update_automation`
- `delete_automation`
- `execute_automation`
- `push_workspace`
- `pull_workspace` (blocks local file modifications)
- `push_workspace_version`
- `pull_workspace_version`
- `install_app_instance`
- `update_app_instance`
- `uninstall_app_instance`
- `update_app_instance_config`

### Available Operations

- `get_automation`
- `list_automations`
- `list_apps`
- `get_app`
- `list_app_instances`
- `get_app_instance`
- `get_app_instance_config`
- `search_events`
- `search_workspaces`
- `get_prisme_documentation`
- `validate_automation`
- `report_issue_or_feedback`

### Use Cases

- Production monitoring without risk of modifications
- Read-only API key enforcement
- Audit/compliance access
- Shared environment access without write permissions

## Disabling Feedback Tools

The MCP server includes feedback reporting tools that send data to Prisme.ai servers. To disable these for privacy:

```bash
PRISME_DISABLE_FEEDBACK_TOOLS=true
```

### Disabled Tools

When enabled, these tools are hidden and blocked:

- `report_issue_or_feedback`
- `update_report`
- `get_reports`

### Configuration Example

```json
{
  "mcpServers": {
    "prisme-ai-builder": {
      "command": "node",
      "args": ["/absolute/path/to/prismeai-mcp/plugin/build/index.js"],
      "env": {
        "PRISME_API_KEY": "your_bearer_token_here",
        "PRISME_WORKSPACE_ID": "your_workspace_id_here",
        "PRISME_API_BASE_URL": "https://api.sandbox.prisme.ai/v2",
        "PRISME_DISABLE_FEEDBACK_TOOLS": "true"
      }
    }
  }
}
```

## Tool Usage Examples

### Create Automation

```typescript
{
  "automation": {
    "name": "My Automation",
    "do": [
      { "log": "Hello World" }
    ],
    "when": {
      "endpoint": true
    }
  }
}
```

### Search Events

```typescript
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "type": "runtime.automations.executed" } },
        { "term": { "source.automationSlug": "my-automation" } }
      ]
    }
  },
  "limit": 10,
  "sort": [{ "@timestamp": { "order": "desc" } }]
}
```

### Execute Automation

```typescript
{
  "automationSlug": "my-automation",
  "payload": {
    "key": "value"
  }
}
```

## API Reference

This MCP server interacts with the following Prisme.ai API endpoints:

**Automations**

| Endpoint | Operation |
|----------|-----------|
| `POST /v2/workspaces/{id}/automations` | Create automation |
| `GET /v2/workspaces/{id}/automations/{slug}` | Get automation |
| `PATCH /v2/workspaces/{id}/automations/{slug}` | Update automation |
| `DELETE /v2/workspaces/{id}/automations/{slug}` | Delete automation |
| `POST /v2/workspaces/{id}/test/{slug}` | Execute automation |

**Workspaces**

| Endpoint | Operation |
|----------|-----------|
| `GET /v2/workspaces/{id}` | List automations |
| `GET /v2/workspaces` | Search workspaces |
| `GET /v2/workspaces/{id}/versions/current/export` | Pull workspace |
| `POST /v2/workspaces/{id}/versions/import` | Push workspace |

**App Store & Instances**

| Endpoint | Operation |
|----------|-----------|
| `GET /v2/apps` | List / search apps |
| `GET /v2/apps/{slug}` | Get app details |
| `POST /v2/workspaces/{id}/imports` | Install app instance |
| `GET /v2/workspaces/{id}/imports` | List app instances |
| `GET /v2/workspaces/{id}/imports/{slug}` | Get app instance |
| `PATCH /v2/workspaces/{id}/imports/{slug}` | Update app instance |
| `DELETE /v2/workspaces/{id}/imports/{slug}` | Uninstall app instance |

**Events & Search**

| Endpoint | Operation |
|----------|-----------|
| `POST /v2/workspaces/{id}/search` | Search events |

**AI Knowledge**

| Endpoint | Operation |
|----------|-----------|
| `POST /projects/{id}/query` | RAG query |
| `POST /projects/{id}/chat/completions` | LLM completion |
| `GET /projects/{id}/documents` | Document CRUD |
| `GET /projects` | Project management |

## Error Handling

All tools return proper error messages when API calls fail:

| Error | Description |
|-------|-------------|
| 401 | Authentication error |
| 403 | Permission error |
| 404 | Not found error |
| 400 | Validation error |

Error responses include the HTTP status code and API error details.
