# Development Guide

## Setup

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

## Project Structure

```
mcp-prisme.ai/
├── src/
│   ├── index.ts          # Main MCP server
│   ├── api-client.ts     # Prisme.ai API client
│   └── config.ts         # Configuration handling
├── claudeBootstrap/
│   ├── setup.sh          # Automated setup script
│   └── prisme-assistant.md   # Claude agent definition
├── docs/                 # Documentation
├── build/                # Compiled JavaScript
└── README.md
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PRISME_API_KEY` | Yes | Bearer token for authentication |
| `PRISME_WORKSPACE_ID` | Yes | Default workspace ID |
| `PRISME_API_BASE_URL` | Yes | API base URL |
| `PRISME_ENVIRONMENTS` | No | Multi-environment JSON config |
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
# Copy and configure .env
cp .env.example .env
# Edit .env with your credentials

npm start
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run build` to verify
5. Submit a pull request

---

**Back to:** [README](../README.md) | [Quick Start](./QUICK_START.md)
