# Capability Workspaces

Capability workspaces are backing services for one-product agents. They are usually consumed through Capabilities and Agent Factory, not presented as standalone user-facing products.

## Workspace Roles

| Workspace | Role | Correct surface |
|-----------|------|-----------------|
| `tools-guardrails` | Guardrail provider | `injection-detect`, `toxicity-check`, `pii-detect`, `hallucination-check`, `topic-guard`, `action-approval` |
| `tools-memories` | Long-term memory provider | `v1/memories`, `v1/memories/recall`, `v1/memories/:memory_id` |
| `tools-search-bing` | Bing MCP search provider | MCP endpoint `bing-search/mcp`, tool `bing_search` |
| `tools-search-brave` | Brave MCP search provider | MCP endpoint `brave-search/mcp`, tools `brave_search`, `brave_llm_context` |
| `vector-elasticsearch` | Vector provider for Storage | `create-index`, `upsert`, `search`, `delete-vectors`, `list-vectors` |
| `vector-opensearch` | Vector provider for Storage | Same provider contract as Elasticsearch, with OpenSearch-specific filtering |
| `vector-mock` | Test vector provider | Fake provider for tests only |
| `sharepoint-mcp` | SharePoint MCP app | MCP tools/resources over Microsoft Graph |
| `sharepoint-connector` | SharePoint-to-RAG sync connector | REST `v1/connections*`, async sync to Storage vector stores |

## How Agents Consume Them

- `file_search` becomes an OpenAI-style function and calls Storage vector search.
- MCP tools are discovered with `tools/list` and executed with JSON-RPC `tools/call`.
- Long-term memory injects `memory_remember`, `memory_recall`, and `memory_forget` when enabled.
- Guardrails run from `agent_config.guardrails` through Agent Factory `_guardrails`.
- Vector provider workspaces are called by Storage, not by agents directly.
- Connectors such as SharePoint sync external content into Storage vector stores used by Agent Factory `file_search`.

## Agent Capability Terminology

| Concept | Product wording |
|---------|-----------------|
| Document-backed retrieval | Storage vector store + Agent Factory `file_search` |
| Web search | MCP search capability such as Bing or Brave |
| Custom MCP tool | Capability catalog MCP entry + Agent Factory MCP runtime |
| Agent tools | Agent capabilities |
| Uploaded file search | Conversation-scoped Storage vectors with `conversation_id` |

## Caveats

- Memory recall is documented as filter/recency based; embeddings are generated on remember.
- `vector-mock` is a test provider.
- OpenSearch metadata filter deletion is not a general-purpose bulk delete path.
- Code Interpreter, Image Generation, and Deep Research are outside this workspace set.
