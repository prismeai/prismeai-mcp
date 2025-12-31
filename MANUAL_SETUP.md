# Manual Setup Guide

This guide covers manual configuration for Claude Desktop, Cursor, and other MCP clients.

For the automated setup with Claude Code CLI, see [README.md](./README.md).

## Prerequisites

1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/prisme-ai/mcp-prisme.ai.git
   cd mcp-prisme.ai
   npm install
   ```

2. Build the project:
   ```bash
   npm run build
   ```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PRISME_API_KEY` | Yes | Bearer token for authentication |
| `PRISME_WORKSPACE_ID` | Yes | Default workspace ID |
| `PRISME_API_BASE_URL` | Yes | API base URL (e.g., `https://api.sandbox.prisme.ai/v2`) |
| `PRISME_ENVIRONMENTS` | No | JSON object for multi-environment configuration |
| `PRISME_DEFAULT_ENVIRONMENT` | No | Default environment name |
| `PRISME_WORKSPACES` | No | Legacy workspace name mappings (JSON) |
| `PRISME_FORCE_READONLY` | No | Block all write operations when `true` |

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
      "args": ["/absolute/path/to/mcp-prisme.ai/build/index.js"],
      "env": {
        "PRISME_API_KEY": "your_bearer_token_here",
        "PRISME_WORKSPACE_ID": "your_workspace_id_here",
        "PRISME_API_BASE_URL": "https://api.sandbox.prisme.ai/v2"
      }
    }
  }
}
```

### Multi-Environment Configuration

```json
{
  "mcpServers": {
    "prisme-ai-builder": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-prisme.ai/build/index.js"],
      "env": {
        "PRISME_API_KEY": "your_bearer_token_here",
        "PRISME_WORKSPACE_ID": "your_default_workspace_id",
        "PRISME_ENVIRONMENTS": "{\"sandbox\":{\"apiUrl\":\"https://api.sandbox.prisme.ai/v2\",\"apiKey\":\"sandbox_token\",\"workspaces\":{\"ai-knowledge\":\"gQxyd2S\",\"ai-store\":\"K5boVst\"}},\"prod\":{\"apiUrl\":\"https://api.studio.prisme.ai/v2\",\"apiKey\":\"prod_token\",\"workspaces\":{\"ai-knowledge\":\"wW3UZla\",\"ai-store\":\"KgIMCs2\"}}}",
        "PRISME_DEFAULT_ENVIRONMENT": "sandbox"
      }
    }
  }
}
```

### Legacy Workspace Mappings

For single API URL setups:

```json
{
  "mcpServers": {
    "prisme-ai-builder": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-prisme.ai/build/index.js"],
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

```json
{
  "sandbox": {
    "apiUrl": "https://api.sandbox.prisme.ai/v2",
    "apiKey": "optional_env_specific_key",
    "workspaces": {
      "ai-knowledge": "gQxyd2S",
      "ai-store": "K5boVst"
    }
  },
  "prod": {
    "apiUrl": "https://api.studio.prisme.ai/v2",
    "apiKey": "optional_env_specific_key",
    "workspaces": {
      "ai-knowledge": "wW3UZla",
      "ai-store": "KgIMCs2"
    }
  }
}
```

### Per-Tool Parameters

All tools accept optional parameters:

| Parameter | Description |
|-----------|-------------|
| `environment` | Environment name from `PRISME_ENVIRONMENTS` |
| `workspaceName` | Workspace name from environment or legacy mappings |
| `workspaceId` | Direct workspace ID (overrides everything) |

### Resolution Priority

1. Direct `workspaceId` parameter (with `environment` for API URL if provided)
2. `environment` + `workspaceName` combination
3. `workspaceName` alone (uses default environment or legacy mappings)
4. `environment` alone (uses default workspace ID with environment's API URL)
5. Default workspace and API URL

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

### Available Operations

- `get_automation`
- `list_automations`
- `list_apps`
- `get_app`
- `search_events`
- `search_workspaces`
- `get_prisme_documentation`
- `lint_automation`

### Use Cases

- Production monitoring without risk of modifications
- Read-only API key enforcement
- Audit/compliance access
- Shared environment access without write permissions

## Running Standalone

```bash
# With .env file
cp .env.example .env
# Edit .env with your credentials
npm start

# Development mode (watch for changes)
npm run dev
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

| Endpoint | Operation |
|----------|-----------|
| `POST /v2/workspaces/{workspaceId}/automations` | Create automation |
| `GET /v2/workspaces/{workspaceId}/automations/{automationSlug}` | Get automation |
| `PATCH /v2/workspaces/{workspaceId}/automations/{automationSlug}` | Update automation |
| `DELETE /v2/workspaces/{workspaceId}/automations/{automationSlug}` | Delete automation |
| `GET /v2/workspaces/{workspaceId}` | Get workspace (includes automations list) |
| `POST /v2/workspaces/{workspaceId}/test/{automationSlug}` | Execute automation |
| `POST /v2/workspaces/{workspaceId}/search` | Search events |

## Error Handling

All tools return proper error messages when API calls fail:

| Error | Description |
|-------|-------------|
| 401 | Authentication error |
| 403 | Permission error |
| 404 | Not found error |
| 400 | Validation error |

Error responses include the HTTP status code and API error details.
