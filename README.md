# Prisme.ai Builder MCP Server

A Model Context Protocol (MCP) server for interacting with the Prisme.ai AI Builder API.

## Features

| Feature | Description |
|---------|-------------|
| **Workspaces** | Pull/push workspaces, search across workspaces, Edit, search activity |
| **AI Knowledge** | RAG queries, document management, project management |
| **Documentation** | Access Prisme.ai docs directly |

## Quick Start

```bash
git clone https://github.com/prisme-ai/mcp-prisme.ai.git
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

## Documentation

| Guide | Description |
|-------|-------------|
| [Quick Start](./docs/QUICK_START.md) | Installation and setup |
| [Tools Reference](./docs/TOOLS.md) | All available MCP tools |
| [Environments](./docs/ENVIRONMENTS.md) | Multi-environment configuration |
| [Development](./docs/DEVELOPMENT.md) | Contributing and development |
| [Manual Setup](./docs/MANUAL_SETUP.md) | Claude Desktop, Cursor, other clients |