# Prompt Library

Prompt Library is a one-product workspace that exposes reusable prompt templates and agent showcases. It is MCP-first for prompt discovery and agent use, with REST APIs for catalog management.

**Workspace:** `prompt-library` (`4m7-1Oo`)

## MCP APIs

| Method | Purpose |
|--------|---------|
| `initialize` | Return MCP protocol version and server metadata |
| `prompts/list` | Return enabled prompt descriptors with pagination |
| `prompts/get` | Return one prompt as an MCP prompt message |
| `tools/list` | Expose the `prompt_library` MCP tool |
| `tools/call` with `prompt_library` | Search prompts by query, category, or exact name |

Prompt metadata includes `name`, `title`, `description`, `category`, `tags`, `content`, `arguments`, `tool_choice`, `suggested_tools`, `agent_id`, `orgSlug`, and `enabled`. `_meta.tool_choice` and `_meta.suggested_tools` can help an MCP-aware runtime pair a prompt with tools.

## REST Management

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/prompts` | List enabled org-visible prompts |
| `POST /v1/prompts` | Create an org-scoped prompt |
| `GET /v1/prompts/:name` | Fetch one visible prompt |
| `PATCH /v1/prompts/:name` | Update caller-owned org-scoped prompt |
| `DELETE /v1/prompts/:name` | Delete caller-owned org-scoped prompt |
| `GET /v1/showcases?app=secure-chat` | Return demo agent showcase bundles |

## Relationship To Agent Factory And Capabilities

Prompt Library is not the agent runtime. Agent Factory executes agents and can attach Prompt Library as an MCP server. Capabilities can register it through a custom MCP entry unless a first-class catalog entry is added.

Prompt Library complements Agent Factory agent templates and starters. It stores reusable prompt templates that agents and MCP clients can discover and retrieve.
