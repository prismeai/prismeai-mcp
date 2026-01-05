# Prisme.ai Builder MCP Server

A Model Context Protocol (MCP) server that provides AI assistants with tools to interact with the Prisme.ai AI Builder API.

## Features

- **Automation Management**: Create, read, update, and delete automations
- **Automation Execution**: Test and execute automations with custom payloads
- **Event Search**: Query Elasticsearch events with full DSL support
- **Workspace Management**: Pull/push workspaces, search workspaces
- **Documentation Access**: Get Prisme.ai documentation directly
- **App Store**: Browse and inspect Prisme.ai apps

## Quick Start (Recommended)

The easiest way to set up this MCP server with Claude Code is using the automated setup script.

> **Not using Claude Code?** See [MANUAL_SETUP.md](./MANUAL_SETUP.md) for Claude Desktop, Cursor, or other MCP clients.

### Prerequisites

- [Node.js](https://nodejs.org) (v18+)
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) (`npm install -g @anthropic-ai/claude-code`)

### Installation

```bash
# Clone the repository
git clone https://github.com/prisme-ai/mcp-prisme.ai.git
cd mcp-prisme.ai

# Run the setup script
./claudeBootstrap/setup.sh
```

The setup script will guide you through:

1. **Prerequisites check** - Verifies Node.js, npm, Claude CLI, and installs jq if needed
2. **Anthropic API key** (optional) - Configure if you don't have Claude Max subscription
3. **Build** - Compiles the MCP server
4. **Prisme.ai configuration** - Set up sandbox and/or production API keys
5. **Agent installation** - Installs the `prisme-assistant` agent for Claude Code

### Setup Modes

The script offers three modes:

| Mode | Use Case |
|------|----------|
| **Fresh install** | First-time setup - configure API keys and install everything |
| **Update** | Rebuild server and update agent (preserves API keys) |
| **Update API key** | Add or update a Prisme.ai environment API key |

### After Setup

```bash
# Start Claude Code
claude

# Or use with the Prisme assistant agent
claude --agent prisme-assistant
```

Type `@` in Claude to see `mcp__prisme-ai-builder__*` tools.

## Available Tools

| Tool | Description |
|------|-------------|
| `create_automation` | Create a new automation |
| `get_automation` | Get a specific automation by slug |
| `update_automation` | Update an existing automation |
| `delete_automation` | Delete an automation |
| `list_automations` | List all automations in the workspace |
| `execute_automation` | Execute/test an automation |
| `search_events` | Search events using Elasticsearch DSL |
| `get_prisme_documentation` | Get Prisme.ai documentation |
| `list_apps` | Browse Prisme.ai app store |
| `get_app` | Get app details and configuration schema |
| `search_workspaces` | Search workspaces by name/description |
| `pull_workspace` | Download workspace to local directory |
| `push_workspace` | Upload local workspace to Prisme.ai |
| `lint_doc` | Get automation linting rules document |

## Environments

The setup script configures two environments:

| Environment | API URL | Default Workspaces |
|-------------|---------|-------------------|
| `sandbox` | `api.sandbox.prisme.ai` | ai-knowledge, ai-store |
| `prod` | `api.studio.prisme.ai` | ai-knowledge, ai-store |

Use environment and workspace parameters in tool calls:

```typescript
// Example: List automations in sandbox ai-knowledge workspace
{
  "environment": "sandbox",
  "workspaceName": "ai-knowledge"
}

// Example: Search events in production with a specific workspace ID
{
  "environment": "prod",
  "workspaceId": "wks_123abc"
}
```

## Manual Setup

For custom configurations (different clients, manual environment setup), see **[MANUAL_SETUP.md](./MANUAL_SETUP.md)**.

This includes:
- Configuration for Claude Desktop, Cursor, and other MCP clients
- Environment variable reference
- Multi-workspace configuration options
- Readonly mode setup
- Running standalone

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Development mode (watch)
npm run dev

# Start server
npm start
```

### Project Structure

```
mcp-prisme.ai/
├── src/
│   ├── index.ts         # Main MCP server
│   └── api-client.ts    # Prisme.ai API client
├── claudeBootstrap/
│   ├── setup.sh         # Automated setup script
│   └── prisme-assistant.md  # Claude agent definition
├── build/               # Compiled JavaScript
└── README.md
```

## Support

- **This MCP server**: Create an issue in this repository
- **Prisme.ai API**: Contact support@prisme.ai
- **MCP Protocol**: See https://modelcontextprotocol.io

## License

MIT
