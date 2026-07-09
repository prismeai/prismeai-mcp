# Environment Configuration

The MCP server supports multiple Prisme.ai environments with custom API URLs and per-environment API tokens.

## Where configuration lives

The server reads and writes its configuration in `PRISME_CONFIG_DIR` (set by the plugin to `${CLAUDE_PLUGIN_DATA}`; defaults to `~/.prisme-ai-mcp` when unset):

| File | Contents |
|------|----------|
| `config.json` | Environment topology: `{ "environments": { name: { apiUrl, studioUrl?, workspaces? } }, "defaultEnvironment"? }` — no secrets |
| `credentials.json` | Per-environment API tokens (`{ name: { token, updatedAt } }`), file mode 600 |

A default topology (sandbox, staging, prod) ships with the plugin in `config/default-environments.json` and is used until you register your own environments.

If a tool call explicitly names an environment that is not configured, the MCP stops before any API call. It does not fall back to the default environment.

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

When `environment` is present, that environment must exist in `config.json` or in the shipped default topology. Unknown explicit environments return a setup error instead of using another environment.

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

Authentication uses **user-created API tokens** (no browser automation).

### Recommended: the `set-token` CLI (keeps the token private)

This path never exposes the token to the chat / LLM provider:

1. Create a token in the studio of the target environment: `https://<studio-domain>/settings/tokens` (e.g. <https://sandbox.prisme.ai/settings/tokens>).
2. Run the server binary's `set-token` command in your own terminal as one shell command (the exact path + config dir are printed in the "no credentials" error). Copy it exactly; do not insert line breaks inside quoted paths:

   ```bash
   node "<plugin>/build/index.js" set-token sandbox --config-dir "<config-dir>"
   ```

   It prompts for the token with **hidden input** (or reads `PRISME_TOKEN` from the env), then asks for the Prisme API URL, e.g. `https://api.sandbox.prisme.ai/v2`. If unsure, open the Prisme instance in a browser and copy the API base URL from the Network tab. The CLI validates the token against the API and saves it to `credentials.json` (mode 600). An invalid token saves nothing.

   For a brand-new environment, either answer the URL prompt or pass `--api-url` (and optionally `--studio-url`):

   ```bash
   node "<plugin>/build/index.js" set-token custom --api-url https://api.custom.prisme.ai/v2 --config-dir "<config-dir>"
   ```

3. Re-run your request. The server re-reads `credentials.json` on the next call, so **no restart is needed**.

### Fallback: the `set_token` MCP tool

If you prefer, you can have the agent register the token with the `set_token` tool (`environment` + `token`, plus `apiUrl` for a new environment). The token is probe-validated before persisting, exactly like the CLI. **Caveat:** passing the token to the tool means it travels through the conversation and is sent to the LLM provider — use the CLI above to avoid that.

### Rotation / expiry

Re-run `set-token` (CLI or tool) with a fresh token whenever the current one expires or is revoked. Calls failing with HTTP 401 include a reminder with the CLI command; calls targeting an environment with no stored token return the exact CLI command and token-creation URL.

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
