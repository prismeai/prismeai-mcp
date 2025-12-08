# Prisme.ai Builder MCP Server

A Model Context Protocol (MCP) server that provides AI assistants with tools to interact with the Prisme.ai AI Builder API. This server enables creating, reading, updating, and deleting automations, searching events, executing automations, and accessing Prisme.ai documentation.

## Features

- **Automation Management**: Full CRUD operations for automations
- **Automation Execution**: Test and execute automations with custom payloads
- **Event Search**: Query Elasticsearch events with full DSL support
- **Documentation Access**: Get Prisme.ai documentation directly

## Available Tools

1. **create_automation** - Create a new automation
2. **get_automation** - Get a specific automation by slug
3. **update_automation** - Update an existing automation
4. **delete_automation** - Delete an automation
5. **list_automations** - List all automations in the workspace
6. **execute_automation** - Execute/test an automation
7. **search_events** - Search for events using Elasticsearch DSL
8. **get_prisme_documentation** - Get the complete Prisme.ai documentation

## Installation

1. Clone this repository or download the files
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```

4. Configure your `.env` file with your Prisme.ai credentials:
   ```
   PRISME_API_KEY=your_bearer_token_here
   PRISME_WORKSPACE_ID=your_workspace_id_here
   PRISME_API_BASE_URL=https://api.staging.prisme.ai/v2
   ```

   **Optional: Multi-Workspace Support**
   ```
   # Add workspace name mappings for easy reference
   PRISME_WORKSPACES={"prod":"wks_123abc","staging":"wks_456def"}
   ```

   **Optional: Readonly Mode**
   ```
   # Block all write operations (useful for production)
   PRISME_FORCE_READONLY=true
   ```

5. Build the project:
   ```bash
   npm run build
   ```

## Usage

### With Claude Desktop

Add this configuration to your Claude Desktop config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

**Basic configuration:**
```json
{
  "mcpServers": {
    "prisme-ai-builder": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-prisme.ai/build/index.js"],
      "env": {
        "PRISME_API_KEY": "your_bearer_token_here",
        "PRISME_WORKSPACE_ID": "your_workspace_id_here",
        "PRISME_API_BASE_URL": "https://api.staging.prisme.ai/v2"
      }
    }
  }
}
```

**With multi-workspace support and readonly mode:**
```json
{
  "mcpServers": {
    "prisme-ai-builder": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-prisme.ai/build/index.js"],
      "env": {
        "PRISME_API_KEY": "your_bearer_token_here",
        "PRISME_WORKSPACE_ID": "your_default_workspace_id",
        "PRISME_API_BASE_URL": "https://api.staging.prisme.ai/v2",
        "PRISME_WORKSPACES": "{\"prod\":\"wks_123abc\",\"staging\":\"wks_456def\"}",
        "PRISME_FORCE_READONLY": "false"
      }
    }
  }
}
```

Replace `/absolute/path/to/mcp-prisme.ai` with the actual path to this project.

### With Cursor

Add this configuration to your Cursor/Antigravity MCP settings file:

**macOS/Linux**: `~/.cursor/mcp.json`
**Windows**: `%APPDATA%\Cursor\mcp.json`

**Basic configuration:**
```json
{
  "mcpServers": {
    "prisme-ai-builder": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-prisme.ai/build/index.js"],
      "env": {
        "PRISME_API_KEY": "your_bearer_token_here",
        "PRISME_WORKSPACE_ID": "your_workspace_id_here",
        "PRISME_API_BASE_URL": "https://api.staging.prisme.ai/v2"
      }
    }
  }
}
```

**With multi-workspace support and readonly mode:**
```json
{
  "mcpServers": {
    "prisme-ai-builder": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-prisme.ai/build/index.js"],
      "env": {
        "PRISME_API_KEY": "your_bearer_token_here",
        "PRISME_WORKSPACE_ID": "your_default_workspace_id",
        "PRISME_API_BASE_URL": "https://api.staging.prisme.ai/v2",
        "PRISME_WORKSPACES": "{\"prod\":\"wks_123abc\",\"staging\":\"wks_456def\"}",
        "PRISME_FORCE_READONLY": "false"
      }
    }
  }
}
```

Replace `/absolute/path/to/mcp-prisme.ai` with the actual path to this project.

**After configuration, restart Cursor to load the MCP server.**

### Running Standalone

```bash
npm start
```

### Development Mode

```bash
npm run dev
```

## Multi-Workspace Configuration

The MCP server supports working with multiple Prisme.ai workspaces through two mechanisms:

### Workspace Name Mappings

Configure friendly names for your workspaces in the `PRISME_WORKSPACES` environment variable:

```bash
PRISME_WORKSPACES={"prod":"wks_123abc","staging":"wks_456def","dev":"wks_789ghi"}
```

**Usage in tools:**
- Use `workspaceName` parameter with any tool: `{ "workspaceName": "prod", ... }`
- Direct `workspaceId` parameter still works: `{ "workspaceId": "wks_123abc", ... }`
- If neither is provided, uses `PRISME_WORKSPACE_ID` (default workspace)

**Priority:** `workspaceId` parameter > `workspaceName` parameter > default workspace

### Per-Tool Workspace Parameters

All tools (except `get_prisme_documentation` and `lint_automation`) accept optional workspace parameters:

```typescript
{
  "automationSlug": "my-automation",
  "workspaceName": "staging"  // Use staging workspace instead of default
}
```

Or use workspace ID directly:

```typescript
{
  "automationSlug": "my-automation",
  "workspaceId": "wks_specific_id"  // Override with specific workspace ID
}
```

### Benefits

- **Simplified CLI/Tool usage:** Use readable names instead of cryptic IDs
- **Multi-environment workflows:** Easily switch between prod/staging/dev
- **Backward compatible:** Existing configurations work unchanged

## Readonly Mode

Force readonly mode blocks all write operations, making the MCP server safe for production monitoring or read-only access.

### Configuration

```bash
PRISME_FORCE_READONLY=true
```

### Blocked Operations

When readonly mode is active, these tools will return clear error messages:
- `create_automation`
- `update_automation`
- `delete_automation`
- `execute_automation`
- `push_workspace`
- `pull_workspace` (blocks local file modifications)

### Available Operations

These readonly tools remain available:
- `get_automation`
- `list_automations`
- `list_apps`
- `get_app`
- `search_events`
- `get_prisme_documentation`
- `lint_automation`

### Use Cases

- **Production monitoring:** Read events and automations without risk of modifications
- **Read-only API keys:** Enforce read-only access at MCP level
- **Audit/compliance:** Prevent accidental changes during audits
- **Shared environments:** Safely share access without write permissions

## Tool Usage Examples

### Create Automation

```typescript
{
  "automation": {
    "name": "My Automation",
    "do": [
      {
        "log": "Hello World"
      }
    ],
    "when": {
      "endpoint": true
    }
  }
}
```

**With workspace parameter:**
```typescript
{
  "automation": {
    "name": "My Automation",
    "do": [{ "log": "Hello from staging" }],
    "when": { "endpoint": true }
  },
  "workspaceName": "staging"  // Create in staging workspace
}
```

### Search Events

Search for events by automation:
```typescript
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "type": "ExecutedAutomation" } },
        { "term": { "source.automationSlug": "my-automation" } }
      ]
    }
  },
  "limit": 10,
  "sort": [{ "@timestamp": { "order": "desc" } }]
}
```

**Search events in specific workspace:**
```typescript
{
  "query": { "match_all": {} },
  "limit": 50,
  "workspaceName": "prod"  // Search events in production workspace
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

- `POST /v2/workspaces/{workspaceId}/automations` - Create automation
- `GET /v2/workspaces/{workspaceId}/automations/{automationSlug}` - Get automation
- `PATCH /v2/workspaces/{workspaceId}/automations/{automationSlug}` - Update automation
- `DELETE /v2/workspaces/{workspaceId}/automations/{automationSlug}` - Delete automation
- `GET /v2/workspaces/{workspaceId}` - Get workspace (includes automations list)
- `POST /v2/workspaces/{workspaceId}/test/{automationSlug}` - Execute automation
- `POST /v2/workspaces/{workspaceId}/search` - Search events

## Error Handling

All tools return proper error messages when API calls fail, including:
- Authentication errors (401)
- Permission errors (403)
- Not found errors (404)
- Validation errors (400)

Error responses include the HTTP status code and API error details.

## Development

### Project Structure

```
mcp-prisme.ai/
├── src/
│   ├── index.ts         # Main MCP server
│   └── api-client.ts    # Prisme.ai API client
├── build/               # Compiled JavaScript
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

### Building

```bash
npm run build
```

### Type Checking

TypeScript will automatically check types during build. All API responses and requests are properly typed.

## License

MIT

## Support

For issues related to:
- **This MCP server**: Create an issue in this repository
- **Prisme.ai API**: Contact support@prisme.ai
- **MCP Protocol**: See https://modelcontextprotocol.io
