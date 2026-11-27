# Environment Configuration

The MCP server supports multiple Prisme.ai environments with custom API URLs and per-environment API tokens.

## Where configuration lives

The server reads and writes its configuration in `PRISME_CONFIG_DIR` (set by the plugin to `${CLAUDE_PLUGIN_DATA}`; defaults to `~/.prisme-ai-mcp` when unset).

The `set-token` CLI usually runs from your own terminal, where that variable does not exist. It picks its directory in this order: `--config-dir`, `PRISME_CONFIG_DIR`, the Claude Code plugin data dir when the CLI runs from the installed plugin (`<claude>/plugins/data/prisme-ai-<marketplace>`), then `~/.prisme-ai-mcp`. It prints the directory it chose. VS Code Copilot reads `~/.prisme-ai-mcp`: pass `--config-dir` there explicitly.

| File | Contents |
|------|----------|
| `config.json` | Environment topology: `{ "environments": { name: { apiUrl, studioUrl?, nodeExtraCaCerts?, workspaces? } }, "defaultEnvironment"? }` — no secrets |
| `credentials.json` | Per-environment API tokens (`{ name: { token, updatedAt } }`), file mode 600 |

Only the environments you register exist. `config/default-environments.json` lists the Prisme.ai SaaS environments (`sandbox`, `staging`, `prod`) as a catalog: when you register one of these names, `set-token` offers its API URL as the example and reuses its Studio URL. They are never configured on their own, so a customer install contains only its own instances.

If a tool call explicitly names an environment that is not configured, the MCP stops before any API call. It does not fall back to the default environment. An environment registered with the CLI while a session is running is picked up on the next call, without a restart.

### Default environment

A tool call without `environment` uses the default environment, chosen in this order:

1. the environment marked `"default": true` in `config.json`;
2. `defaultEnvironment` in `config.json`;
3. the `PRISME_DEFAULT_ENVIRONMENT` variable of the server;
4. the only configured environment, when there is just one.

With several environments and none chosen, there is no default: a call without `environment` is refused with the list of configured names, rather than sent to whichever comes first. Choose one when registering its token:

```bash
node "<plugin>/build/index.js" set-token acme-hprd --default --config-dir "<config-dir>"
```

### Removing an environment

```bash
node "<plugin>/build/index.js" remove-env sandbox --config-dir "<config-dir>"
```

This deletes the environment from `config.json` and its token from `credentials.json`. Reconnect the MCP server afterwards (`/mcp` in Claude Code) so the running session forgets it. Up to 2.0.2, the first `set-token` copied `sandbox`, `staging` and `prod` into `config.json`, with `sandbox` as the default: remove the ones that do not belong on a customer workstation.

## Dynamic Environments

You can add any number of custom environments with any name. Registering a token for an unknown environment via `set_token` (passing `apiUrl`) creates it.

### Common Environment Examples

| Environment | API URL |
|-------------|---------|
| `sandbox` | `https://api.sandbox.prisme.ai/v2` |
| `prod` | `https://api.studio.prisme.ai/v2` |
| `custom` | `https://api.your-instance.prisme.ai/v2` |

## On-premise / self-hosted instances

A Prisme.ai instance deployed on a client's own domain is just a custom environment: give it any name and point `apiUrl` at their API base URL. Nothing is hardcoded to `*.prisme.ai`.

> **You don't need to resolve `<plugin>` or `<config-dir>` by hand.** Ask the agent to run any Prisme tool against your instance (e.g. `environment: "acme-onprem"`); the MCP replies with the exact `set-token` command — absolute path and `--config-dir` already filled in, with an `--api-url <api-url>` slot for your instance URL. Or run `/prisme-ai:setup`. The `<plugin>` / `<config-dir>` placeholders below are only for illustration.

### Register in one command (recommended)

```bash
node "<plugin>/build/index.js" set-token acme-onprem \
  --api-url https://api.acme.example.com/v2 \
  --studio-url https://studio.acme.example.com \
  --config-dir "<config-dir>"
```

This validates the token against `<apiUrl>/me`, then writes the environment topology to `config.json` **and** the token to `credentials.json` (mode 600) in one step. Reference it afterwards with `"environment": "acme-onprem"` in any tool call.

### Or declare several instances up front

Pre-declare the topology (no secrets) in `<config-dir>/config.json`, then register a token per environment:

```json
{
  "environments": {
    "acme-onprem": {
      "apiUrl": "https://api.acme.example.com/v2",
      "studioUrl": "https://studio.acme.example.com",
      "default": true
    },
    "acme-onprem-preprod": {
      "apiUrl": "https://api.preprod.acme.example.com/v2",
      "studioUrl": "https://studio.preprod.acme.example.com"
    }
  },
  "defaultEnvironment": "acme-onprem"
}
```

```bash
node "<plugin>/build/index.js" set-token acme-onprem --config-dir "<config-dir>"
node "<plugin>/build/index.js" set-token acme-onprem-preprod --config-dir "<config-dir>"
```

Because each environment already exists in `config.json`, `set-token` reuses its declared `apiUrl` and does not need `--api-url` here.

### On-premise specifics

| Point | Detail |
|-------|--------|
| **`apiUrl` must include `/v2`** | It is the API **base URL**; every call is relative to it (`<apiUrl>/me`, `<apiUrl>/workspaces/…`). Use `https://api.acme.example.com/v2`, not `https://api.acme.example.com`. |
| **`--studio-url` is optional** | Used only to build "create a token here" links. When omitted it is derived by stripping the `api.`/`api-` prefix from the API host — pass it explicitly when the on-prem hostname does not follow that convention. |
| **Network reachability** | The `set-token` probe calls the customer's API directly from wherever the CLI runs. It must be able to reach the internal `apiUrl`, otherwise validation fails and nothing is saved. |

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

When `environment` is present, that environment must exist in `config.json`. Unknown explicit environments return a setup error instead of using another environment.

## Environment Structure

Each environment in `config.json` contains:

```json
{
  "environments": {
    "sandbox": {
      "apiUrl": "https://api.sandbox.prisme.ai/v2",
      "studioUrl": "https://sandbox.prisme.ai",
      "nodeExtraCaCerts": "/absolute/path/to/company-ca.pem"
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
| `nodeExtraCaCerts` | No | Absolute path to a readable PEM CA bundle. The environment trusts it in addition to Node's built-in roots, matching `NODE_EXTRA_CA_CERTS` semantics. |
| `workspaces` | No | Optional name-to-ID mappings |
| `default` | No | Marks the default environment (see [Default environment](#default-environment)) |

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

   It prompts for the token with **hidden input** (or reads `PRISME_TOKEN` from the env), the Prisme API URL, the Studio URL, and an optional `NODE_EXTRA_CA_CERTS` PEM path. The certificate path is stored as `nodeExtraCaCerts` in `config.json`. The CLI uses the extra CA for its token probe, and the MCP uses it for subsequent HTTPS calls. The CLI saves the validated token to `credentials.json` (mode 600); an invalid token or unreadable CA file saves nothing.

   For a brand-new environment, either answer the prompts or pass `--api-url` with optional `--studio-url` and `--node-extra-ca-certs` flags:

   ```bash
   node "<plugin>/build/index.js" set-token custom --api-url https://api.custom.prisme.ai/v2 --studio-url https://custom.prisme.ai --node-extra-ca-certs /absolute/path/to/company-ca.pem --config-dir "<config-dir>"
   ```

3. Re-run your request. The server re-reads `config.json` and `credentials.json` on the next call, so **no restart is needed**, even for a new environment.

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
