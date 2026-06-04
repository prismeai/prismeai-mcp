# Prisme.ai Products Overview

Prisme.ai's product architecture is modular. Agent Factory is the agent runtime and product entry point; Storage owns knowledge and RAG data; LLM Gateway owns model calls; Capabilities owns reusable tool catalog metadata; Governance and Insights provide control and analytics.

## Architecture

```
+----------------------------------------------------------+
| Product Experience Layer                                 |
| Agent Factory, SecureChat surface, Builder apps          |
+----------------------------------------------------------+
| Agent Intelligence Layer                                 |
| Capabilities, Agent Evaluations, AI Insights, Prompt Lib |
+----------------------------------------------------------+
| Data And Model Layer                                     |
| Storage, AI Collection v3, LLM Gateway                   |
+----------------------------------------------------------+
| Governance And Operations Layer                          |
| AI Governance v2, events, API keys, service accounts     |
+----------------------------------------------------------+
```

## Baseline Products

| Product | Purpose | Primary API / surface |
|---------|---------|-----------------------|
| Agent Factory | Agents, publishing, conversations, streaming, A2A tasks, tools | `agent-factory` webhooks under `/v1/agents` |
| Knowledge (Storage) | Files, vector stores, indexing, RAG search | `storage` webhooks under `/v1/files` and `/v1/vector_stores` |
| LLM Gateway | OpenAI-compatible completions, embeddings, model catalog, routing | `llm-gateway` webhooks under `/v1/chat/completions`, `/v1/embeddings`, `/v1/models` |
| Capabilities | Catalog for MCP servers, file search, functions, skills, guardrails, memory | `capabilities` `/v1/servers` |
| Agent Evaluations | Test cases, async runs, LLM-as-judge, regression summaries | `agent-evaluations` `/v1/eval/*` |
| AI Governance v2 | Org IAM, roles, groups, API keys, service accounts, observability | Native API Gateway `/v2` plus governance webhooks |
| AI Insights v2 | Agent Factory analytics, criteria, feedback, memory analytics, GDPR | `ai-insights-v2` `/v1/analytics`, `/v1/insights`, `/v1/feedback` |
| AI Collection v3 | Structured data MCP tools for agents | `ai-collection-v3` MCP endpoint and `/v1/collections` wrappers |
| Prompt Library | MCP prompt templates and showcase catalogs | `prompt-library` MCP endpoint and `/v1/prompts` |
| Builder | DSUL workspaces, automations, pages, apps | Workspace YAML and runtime automations |

## Agent Factory

Agent Factory is the baseline for agent work. An agent is an Agent Factory `agents` record with runtime configuration, publishing state, access bindings, conversations, tasks, tools, skills, guardrails, memory, and artifacts.

Use:

- `GET/POST /v1/agents` for listing and creation.
- `GET/PATCH/DELETE /v1/agents/:agent_id` for lifecycle changes.
- `POST /v1/agents/:agent_id/messages/send` for non-streaming agent calls.
- `POST /v1/agents/:agent_id/messages/stream` for SSE streaming.
- `POST /v1/agents/:agent_id/a2a` and `.well-known/agent.json` for A2A interoperability.
- `GET/POST /v1/agents/:agent_id/tools` for `file_search`, `mcp`, `function`, and system tools.

## Knowledge (Storage)

Storage is the RAG infrastructure for files, URLs, vector stores, indexing, and semantic search. Create vector stores, add files or URLs, let Storage index them through Crawler and LLM Gateway embeddings, then attach them to an Agent Factory agent as `file_search`.

Use:

- `POST /v1/vector_stores` to create a vector store.
- `POST /v1/vector_stores/:vector_store_id/files` to add files or URLs.
- `POST /v1/vector_stores/:vector_store_id/search` for semantic retrieval.
- Agent Factory `file_search` tools for agent-facing RAG.

## Capabilities And Tool Workspaces

Capabilities stores catalog metadata for reusable abilities. Agent Factory consumes the catalog, but runtime execution happens in Agent Factory and backing workspaces.

| Capability type | Runtime owner |
|-----------------|---------------|
| `file_search` | Storage vector search |
| `mcp` | JSON-RPC `tools/list` and `tools/call` through Agent Factory |
| `function` | Agent Factory HTTP function call |
| `skill` | Agent Factory skill activation, inline or Storage-backed |
| `guardrail` | `tools-guardrails` |
| `sub_agent` | Agent Factory delegation |
| memory | Agent Factory system memory backed by `tools-memories` |

## LLM Gateway

LLM Gateway is the model execution layer. It owns chat completions, embeddings, provider routing, model catalog/defaults, and usage analytics. RAG orchestration and agent tool loops are handled by Agent Factory and Storage.

Use:

- `POST /v1/chat/completions` for OpenAI-compatible chat completions.
- `POST /v1/embeddings` for embeddings.
- `GET /v1/models` and `GET /v1/defaults` for model catalog and effective defaults.

## Governance, Insights, And Evaluations

AI Governance v2 manages org IAM, roles, groups, API keys, service accounts, audit search, announcements, and platform/workspace observability. Native org/IAM endpoints are under API Gateway `/v2`; audit, observability, announcements, and cross-workspace helpers are governance webhooks.

AI Insights v2 analyzes Agent Factory conversations. It computes summaries, topics, sentiment, resolution, custom criteria, feedback analytics, memory intelligence, graph views, queue views, and GDPR/retention controls.

Agent Evaluations stores reusable test cases and starts async runs against Agent Factory agents. It judges responses through LLM Gateway and stores run/result summaries.

## Integration Patterns

### RAG Agent

```
Storage vector store -> Agent Factory file_search -> LLM Gateway -> AI Insights
                         ^                       |
                         |                       v
                    Capabilities              AI Governance v2
```

### Tool-Using Agent

```
Capabilities catalog -> Agent Factory ReAct loop -> MCP/function/tool workspace
                                      |
                                      v
                                 LLM Gateway
```

### Evaluation And Monitoring

```
Agent Evaluations -> Agent Factory messages/send -> LLM Gateway judge
Agent Factory events + LLM Gateway events -> AI Insights + AI Governance v2
```

### Connector-Backed Knowledge

```
SharePoint connector -> Storage vector store -> Agent Factory file_search
```

## Legacy Scope

Dedicated documentation scopes:

| Legacy section | Use |
|----------------|-----|
| `legacy-products-overview` | Legacy product architecture overview |
| `legacy-product-store` | AI Store documentation |
| `legacy-product-knowledge` | AI Knowledge and Knowledge Client documentation |
| `legacy-product-collection` | AI Collection documentation |
| `legacy-product-governance` | AI Governance documentation |
| `legacy-product-insights` | AI Insights documentation |
