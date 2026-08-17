# API Reference Bundle

OpenAPI specs for the product APIs this skill builds on, plus a condensed index for each. Bundled here so the skill works without a local clone of the `prismeai-workspaces` or `docs` repos.

| Product | App import | Condensed index | Full spec | Base URL |
|---|---|---|---|---|
| Agent Factory | `Agents` | [agent-factory-api.md](agent-factory-api.md) | `agent-factory.swagger.yml` | `https://{host}/v2/workspaces/slug:agent-factory/webhooks` |
| Knowledges (Storage) | `Storage` | [storage-knowledge-api.md](storage-knowledge-api.md) | `storage-knowledge.swagger.yml` | `https://{host}/v2/workspaces/slug:storage/webhooks` |

`{host}` is `api.studio.prisme.ai` (prod) or `api.sandbox.prisme.ai` (sandbox); self-hosted instances override it.

For product concepts behind these APIs — what a knowledge base is, how agent capabilities work, which models governance exposes — see the public documentation at <https://docs.prisme.ai/get-started/home>. It explains the products; these specs define the contract.

Model calls are not in scope here: a generated workspace runs every completion through an Agent Factory agent (`Agents.sendMessage`), never against an LLM gateway or a provider API.

## How To Use This

Read the condensed index first. Each one opens with the app-method → REST-operation mapping, then lists every endpoint grouped by tag. Open the swagger only when you need a payload shape, an enum, a status code, or an error body the index does not carry.

These specs describe the HTTP surface, not the call path. A generated bootstrap workspace calls these products through the `Agents` and `Storage` app imports — never with `fetch:`. Use the specs to know what an app method sends and what it returns, and to tell the difference between "the app is missing a method" and "the product cannot do this at all":

- The endpoint exists in the spec but has no app method → the app wrapper is missing a method. Stop and report it, as the skill's non-negotiables require.
- The endpoint is not in the spec → the product does not expose it. Say so and propose an alternative.

The specs document the public surface only: private helper automations (`_`-prefixed) and admin/GDPR lifecycle operations are out of contract.

## Provenance

Generated from the `prismeai-workspaces` repo (`docs/agent-factory/swagger.yml`, `docs/storage/swagger.yml`); the same specs are published in the `docs` repo under `api-reference/`. The app-method tables are extracted from the app workspaces `agents-app` and `storage-client`.

Refresh by re-copying the swaggers and regenerating the `*-api.md` indexes when a product API changes. Agent Evaluations has no published swagger yet — use `docs/agent-evaluations/automations.md` in `prismeai-workspaces` for that product.
