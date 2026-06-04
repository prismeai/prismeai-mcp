# LLM Gateway

LLM Gateway is the centralized model execution layer for one-product workspaces. It exposes OpenAI-compatible chat completions and embeddings, manages the platform model catalog/defaults, routes requests across providers, and emits usage, cost, and carbon analytics.

**Workspace:** `llm-gateway` (`ClBQW_I`)

## Core APIs

Base webhook path: `/workspaces/slug:llm-gateway/webhooks`.

| API | Purpose |
|-----|---------|
| `POST /v1/chat/completions` | OpenAI-compatible chat completions with tools, response format, streaming SSE, and non-streaming JSON |
| `POST /v1/embeddings` | OpenAI-compatible embeddings for string or string-array input, with dimension validation |
| `GET/POST/PUT /v1/models` | Model catalog listing, create, and bulk replace |
| `GET/PATCH/DELETE /v1/models/:model_id` | Single-model catalog CRUD |
| `GET /v1/defaults` | Platform defaults plus org governance overrides for completions, embeddings, image generation, and file parsing |
| `POST /v1/test` | Admin smoke test for a model through the gateway |
| `POST /v1/images/generations` | OpenAI-compatible image generation endpoint when enabled |

## Chat Completions

`/v1/chat/completions` accepts OpenAI-style `model`, `messages`, `temperature`, `max_tokens`, `tools`, `tool_choice`, `response_format`, `seed`, and `stream`. Prisme.ai extensions include `analytics_context` and `task_id`.

Streaming responses are normalized into OpenAI delta chunks. Non-streaming responses are OpenAI-shaped and enriched with `usage.cost`, `usage.duration_ms`, and `usage.carbon` when model metadata supports it.

## Embeddings, Models, Defaults

`/v1/embeddings` resolves a default embedding model when omitted, validates requested dimensions, and uses model catalog provider settings for batching.

The model catalog stores model IDs, type, capabilities, limits, dimensions, metrics, provider config, pricing, tags, enabled state, and optional org visibility. `model: "auto"` can route by configured rules, classifier, capability tags, cost tier, or hybrid strategy.

## Governance And Usage

Access is enforced through authentication, org allowlists, agent allowlists, API key scopes, and model RBAC. Chat endpoints also apply rate limiting. Completion and embedding events include model, provider, tokens, cost, carbon, duration, stream flag, tool counts, and caller analytics context.

Monthly quota fields are governance metadata. Runtime enforcement uses authentication, allowlists, API key scopes, model RBAC, and rate limiting.

## Product Scope

LLM Gateway owns model execution concerns: chat completions, embeddings, provider routing, model defaults, failover behavior, and usage/carbon calculation. RAG orchestration, prompt building, retrieval, and tool execution live in Agent Factory and Storage.
