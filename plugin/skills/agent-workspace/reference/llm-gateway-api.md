# LLM Gateway — REST API Reference

Condensed index of `llm-gateway.swagger.yml`, bundled next to this file. Read the spec itself for full request/response schemas, enums, and error codes.

- **Base URL**: `https://{host}/v2/workspaces/slug:llm-gateway/webhooks`
- **Auth**: BearerAuth, WorkspaceApiKeyAuth
- **Operations**: 10
- **How to call it from a generated workspace**: through the `LLM` app import (`LLM.<method>`), never with `fetch:`. This spec tells you the payload shape the app forwards.

## `LLM` App Methods

| Method | REST operation | Purpose |
|---|---|---|
| `LLM.chatCompletion` | `POST /v1/chat/completions` | Call LLM chat completion (non-streaming). |
| `LLM.embeddings` | `POST /v1/embeddings` | Generate text embeddings via llm-gateway. |
| `LLM.getDefaults` | `GET /v1/defaults` | Get resolved default models (completions, embeddings, image_generation). |
| `LLM.getModel` | `GET /v1/models/{model_id}` | Get a model by ID with full metadata. |
| `LLM.listModels` | `GET /v1/models` | List available models with optional filters. |

A `—` means the app builds the path dynamically. Anything this table does not cover is not reachable through the app: report the missing method instead of falling back to `fetch:`.

## Endpoints

### Completions

OpenAI-compatible chat completions (with optional SSE streaming).

| Verb | Path | Operation | Summary |
|---|---|---|---|
| POST | `/v1/chat/completions` | `createChatCompletion` | Create a chat completion |

### Embeddings

OpenAI-compatible text embeddings.

| Verb | Path | Operation | Summary |
|---|---|---|---|
| POST | `/v1/embeddings` | `createEmbedding` | Create text embeddings |

### Models

Model catalogue (CRUD + bulk replace + governance-aware listing).

| Verb | Path | Operation | Summary |
|---|---|---|---|
| GET | `/v1/models` | `listModels` | List models from the catalogue |
| POST | `/v1/models` | `createModel` | Create a model in the catalogue |
| PUT | `/v1/models` | `replaceModels` | Bulk-replace the entire model catalogue |
| GET | `/v1/models/{modelId}` | `getModel` | Get a model by ID |
| PATCH | `/v1/models/{modelId}` | `updateModel` | Update a model |
| DELETE | `/v1/models/{modelId}` | `deleteModel` | Delete a model |

### Defaults

Resolved default models for completions / embeddings / image generation / file parsing.

| Verb | Path | Operation | Summary |
|---|---|---|---|
| GET | `/v1/defaults` | `getDefaults` | Get resolved default models |

### Test

Smoke-test reachability of a model through the gateway.

| Verb | Path | Operation | Summary |
|---|---|---|---|
| POST | `/v1/test` | `runModelTest` | Smoke-test a model through the gateway |
