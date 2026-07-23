---
name: prisme-mcp-setup
description: Configure or repair Prisme.ai MCP environment and token storage without exposing credentials in chat. Use when an environment is unknown, no token is registered, a stored token is rejected, or the user asks to configure MCP authentication.
---

# Prisme.ai MCP Setup

Use this procedure when a Prisme.ai MCP tool reports that an environment is unknown, no token is registered, or a stored token was rejected.

## Rules

- Do not ask the user to paste an API token into the chat unless they explicitly choose that fallback after being warned that the token will be sent to the LLM provider.
- Do not try another environment when the user specified one. The requested environment must be configured before retrying.
- For a new environment, ask the user for the studio URL or API URL if it is not obvious.
- Use the out-of-band `set-token` CLI as the default setup path.

## Environment URLs

Common mappings:

| Studio URL | API URL |
|------------|---------|
| `https://sandbox.prisme.ai` | `https://api.sandbox.prisme.ai/v2` |
| `https://staging.prisme.ai` | `https://api.staging.prisme.ai/v2` |
| `https://studio.prisme.ai` | `https://api.studio.prisme.ai/v2` |

For other deployments, derive the API URL from the user's Prisme.ai host or ask the user to confirm it.

## Setup Flow

1. Identify the target environment name from the failed request or user request.
2. Tell the user to create a token in the target studio at:

   ```text
   <studio-url>/settings/tokens
   ```

3. Tell the user to run the exact CLI command from the MCP error in their own terminal. Preserve it as one shell command; do not insert line breaks inside quoted paths. The CLI prompts for the token, the Prisme API and Studio URLs, and an optional `NODE_EXTRA_CA_CERTS` PEM path. Give `https://api.sandbox.prisme.ai/v2` and `https://sandbox.prisme.ai` as examples.

   For a known environment:

   ```bash
   node "<plugin>/build/index.js" set-token <environment> --config-dir "<config-dir>"
   ```

   For an unknown environment:

   ```bash
   node "<plugin>/build/index.js" set-token <environment> --api-url <api-url> --config-dir "<config-dir>"
   ```

4. After the command succeeds, retry the original MCP tool call with the same explicit environment.

## Fallback

Only if the user explicitly wants to paste the token in chat, warn them first:

```text
Using set_token means the token is sent through this conversation to the LLM provider. The CLI path keeps it local.
```

Then call `set_token` with `environment`, `token`, and `apiUrl` for a new environment. Include `studioUrl` and `nodeExtraCaCerts` when needed.
