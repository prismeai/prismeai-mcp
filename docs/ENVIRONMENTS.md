# Environment Configuration

The MCP server supports multiple Prisme.ai environments with custom API URLs and JWT tokens.

## Dynamic Environments

Environments are configured during setup. You can add any number of custom environments with any name.

### Common Environment Examples

| Environment | API URL |
|-------------|---------|
| `prod` | `https://api.studio.prisme.ai/v2` |
| `custom` | `https://api.your-instance.prisme.ai/v2` |

## Using Environments

Specify environment and workspace in tool calls:

```typescript
// Sandbox workspace by name
{
  "environment": "sandbox",
  "workspaceName": "ai-knowledge"
}

// Production with direct workspace ID
{
  "environment": "prod",
  "workspaceId": "wks_123abc"
}

// Default environment (from config)
{
  "workspaceName": "ai-knowledge"
}
```

## Resolution Priority

When resolving workspace and API URL:

1. Direct `workspaceId` + `environment` for API URL
2. `environment` + `workspaceName` combination
3. `workspaceName` alone (uses default environment)
4. `environment` alone (uses default workspace ID)
5. Fall back to default workspace and API URL

## Environment Structure

Each environment contains:

```json
{
  "sandbox": {
    "apiUrl": "https://api.sandbox.prisme.ai/v2",
    "apiKey": "your_jwt_token_here"
  },
  "prod": {
    "apiUrl": "https://api.studio.prisme.ai/v2",
    "apiKey": "another_jwt_token"
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `apiUrl` | Yes | Base API URL for this environment |
| `apiKey` | Yes | JWT token (from browser cookies) |
| `workspaces` | No | Optional name-to-ID mappings |

### With Workspace Mappings (Optional)

```json
{
  "sandbox": {
    "apiUrl": "https://api.sandbox.prisme.ai/v2",
    "apiKey": "your_jwt_token",
    "workspaces": {
      "ai-knowledge": "gQxyd2S",
      "ai-store": "K5boVst"
    }
  }
}
```

## Adding Environments

### Via Setup Script (Fresh Install)

```bash
./claudeBootstrap/setup.sh
# Choose "Fresh install" mode
# Answer "y" to "Do you want to add a Prisme.ai environment?"
# Provide: environment name, API URL, JWT token
# Repeat for additional environments
```

### Via Setup Script (Update Existing)

```bash
./claudeBootstrap/setup.sh
# Choose "Update API key" mode
# Choose "Add a new environment"
# Provide: environment name, API URL, JWT token
```

### Getting Your JWT Token

1. Open your Prisme.ai instance in a browser
2. Open DevTools (F12 or Inspect)
3. Go to **Application** > **Cookies**
4. Find the `access-token` cookie
5. Copy the value (starts with `ey...`)

### Manual Configuration

Set the `PRISME_ENVIRONMENTS` environment variable:

```json
{
  "custom-env": {
    "apiUrl": "https://api.custom.prisme.ai/v2",
    "apiKey": "your_jwt_token"
  }
}
```

## Readonly Mode

For safe production monitoring, enable readonly mode:

```bash
PRISME_FORCE_READONLY=true
```

### Blocked in Readonly

- `create_automation`
- `update_automation`
- `delete_automation`
- `execute_automation`
- `push_workspace`
- `pull_workspace`
- `install_app_instance`
- `update_app_instance`
- `uninstall_app_instance`
- `update_app_instance_config`

### Available in Readonly

- `get_automation`
- `list_automations`
- `list_apps`, `get_app`
- `list_app_instances`
- `get_app_instance`
- `get_app_instance_config`
- `search_events`
- `search_workspaces`
- `get_prisme_documentation`
- `lint_doc`

## Feedback Tools

The MCP server includes feedback reporting tools that allow Claude to send bug reports and feedback to Prisme.ai servers:

- `report_issue_or_feedback`
- `update_report`
- `get_reports`

### Disabling Feedback Tools

If you prefer not to have any data sent to Prisme.ai servers, you can disable these tools:

```bash
PRISME_DISABLE_FEEDBACK_TOOLS=true
```

### Via Setup Script

```bash
./claudeBootstrap/setup.sh
# Choose option 4) Toggle feedback tools
```

During fresh install, you'll be asked whether to enable or disable feedback tools with a clear explanation of what they do.

### Privacy Implications

| Setting | Behavior |
|---------|----------|
| `false` (default) | Claude can send bug reports and feedback to Prisme.ai |
| `true` | Feedback tools are hidden and blocked; no data sent to Prisme.ai |

---

**Next:** [Development Guide](./DEVELOPMENT.md) | [Manual Setup](./MANUAL_SETUP.md)
