# Capabilities

Capabilities is the one-product catalog for reusable agent abilities. It stores catalog metadata, schemas, org visibility, and built-in templates in `tools_catalog`; execution happens in Agent Factory and backing workspaces.

**Workspace:** `capabilities` (`3ueUyns`)

## Catalog Types

| Type | Meaning | Runtime owner |
|------|---------|---------------|
| `mcp` | MCP server connection with server URL, headers, and scope | Agent Factory JSON-RPC `tools/list` and `tools/call` |
| `file_search` | Storage vector-store RAG tool | Storage `/v1/vector_stores/:id/search` |
| `function` | HTTP endpoint as an LLM-callable function | Agent Factory direct `POST` fetch |
| `skill` | Progressive-disclosure instructions, inline or Storage-backed | Agent Factory `activate_skill` |
| `guardrail` | Input/output/action safety check | `tools-guardrails` |
| `sub_agent` | Delegation to another Agent Factory agent | Agent Factory delegation tools |
| `memory` | Catalog/governance type; runtime memory is system-backed | Agent Factory system memory + `tools-memories` |

## APIs

| Endpoint | Methods | Purpose |
|----------|---------|---------|
| `/v1/servers` | `GET` | List visible entries: built-ins plus same-org custom entries. Filters include `type`, `category`, `built_in`, `search`, `limit`, `page`. |
| `/v1/servers` | `POST` | Create a custom entry. Requires `name` and `type`. |
| `/v1/servers/:server_id` | `GET` | Get one visible entry. |
| `/v1/servers/:server_id` | `PATCH` | Update a custom same-org entry. Built-ins are protected. |
| `/v1/servers/:server_id` | `DELETE` | Delete a custom same-org entry. |

## Agent Factory Consumption

Agent Factory reads the Capabilities catalog when adding catalog-backed tools. Writes are split by type:

| Catalog type | Agent write path |
|--------------|------------------|
| `mcp`, `file_search`, `function` | `POST /v1/agents/:agent_id/tools` |
| `skill` | `PATCH /v1/agents/:agent_id` with `skills[]` |
| `guardrail` | `PATCH /v1/agents/:agent_id` with `guardrails[]` |
| `sub_agent` | `PATCH /v1/agents/:agent_id` with `sub_agents[]` |
| runtime memory | Agent Factory system tool `memory` |

## Current Wording

Use "Agent Creator capabilities" or "Capabilities catalog" wording. Use `file_search` for Storage-backed RAG, `mcp` for MCP servers, `function` for HTTP functions, `guardrail` for safety checks, `sub_agent` for delegation, and system memory backed by `tools-memories`.
