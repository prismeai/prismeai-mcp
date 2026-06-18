# Environment Configuration

The MCP server supports multiple Prisme.ai environments with custom API URLs and per-environment API tokens.

## Where configuration lives

The server reads and writes its configuration in `PRISME_CONFIG_DIR` (set by the plugin to `${CLAUDE_PLUGIN_DATA}`; defaults to `~/.prisme-ai-mcp` when unset):

| File | Contents |
|------|----------|
| `config.json` | Environment topology: `{ "environments": { name: { apiUrl, studioUrl?, workspaces? } }, "defaultEnvironment"? }` — no secrets |
| `credentials.json` | Per-environment API tokens (`{ name: { token, updatedAt } }`), file mode 600 |

A default topology (sandbox, staging, prod) ships with the plugin in `config/default-environments.json` and is used until you register your own environments.

## Dynamic Environments

You can add any number of custom environments with any name. Registering a token for an unknown environment via `set_token` (passing `apiUrl`) creates it.

### Common Environment Examples

| Environment | API URL |
|-------------|---------|
| `sandbox` | `https://api.sandbox.prisme.ai/v2` |
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

Each environment in `config.json` contains:

```json
{
  "environments": {
    "sandbox": {
      "apiUrl": "https://api.sandbox.prisme.ai/v2",
      "studioUrl": "https://sandbox.prisme.ai"
    },
    "prod": {
      "apiUrl": "https://api.studio.prisme.ai/v2"
    }
  },
  "defaultEnvironment": "sandbox"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `apiUrl` | Yes | Base API URL for this environment |
| `studioUrl` | No | Studio origin, used to build the token-creation URL. Derived from `apiUrl` when absent. |
| `workspaces` | No | Optional name-to-ID mappings |
| `default` | No | Marks the default environment |

Tokens are **not** stored in `config.json` — they live in `credentials.json`, written by the `set_token` tool.

### With Workspace Mappings (Optional)

```json
{
  "environments": {
    "sandbox": {
      "apiUrl": "https://api.sandbox.prisme.ai/v2",
      "workspaces": {
        "ai-knowledge": "gQxyd2S",
        "ai-store": "K5boVst"
      }
    }
  }
}
```

## Authentication: API tokens

Authentication uses **user-created API tokens** (no browser automation):

1. Create a token in the studio of the target environment: `https://<studio-domain>/settings/tokens` (e.g. <https://sandbox.prisme.ai/settings/tokens>).
2. Register it with the `set_token` tool:

```typescript
{
  "environment": "sandbox",
  "token": "your-api-token"
}
```

The token is validated with a probe call to the API before being persisted; an invalid token persists nothing. To register a brand-new environment, also pass `apiUrl` (and optionally `studioUrl`):

```typescript
{
  "environment": "custom",
  "token": "your-api-token",
  "apiUrl": "https://api.custom.prisme.ai/v2"
}
```

### Rotation / expiry

Re-run `set_token` with a fresh token whenever the current one expires or is revoked. Calls failing with HTTP 401 include a reminder of this flow; calls targeting an environment with no stored token return the exact token-creation URL.

### Migration from setup.sh

On first start, if the config dir is empty, the server imports any legacy `PRISME_ENVIRONMENTS` configuration (from the environment variable or from the old `~/.claude.json` registration) into `config.json` + `credentials.json` automatically.

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
- `push_workspace_version`
- `pull_workspace_version`
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
- `validate_automation`
- `set_token`

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

### Privacy Implications

| Setting | Behavior |
|---------|----------|
| `false` (default) | Claude can send bug reports and feedback to Prisme.ai |
| `true` | Feedback tools are hidden and blocked; no data sent to Prisme.ai |

---

**Next:** [Development Guide](./DEVELOPMENT.md)
