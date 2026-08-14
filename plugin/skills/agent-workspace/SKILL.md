---
name: agent-workspace
description: Create a Prisme.ai bootstrap workspace that provisions an Agent Factory agent, attaches Storage-backed file or URL sources, seeds Agent Evaluations cases, runs evaluation, and validates the setup through the supported product apps Agents, Storage, Evaluation, and LLM. Use the LLM app (llm-gateway) for straight model calls that need no agent.
---

# Agent Workspace Bootstrap

Use this skill to build a consumer/bootstrap DSUL workspace whose purpose is to create and validate an Agent Factory agent with Storage sources and Evaluation test cases.

## Bundled API Reference

`reference/` carries the OpenAPI specs for the three products this skill drives, each with a condensed index that starts with the app-method → REST-operation mapping:

| Product | App import | Index | Full spec |
|---|---|---|---|
| Agent Factory | `Agents` | `reference/agent-factory-api.md` | `reference/agent-factory.swagger.yml` |
| Knowledges (Storage) | `Storage` | `reference/storage-knowledge-api.md` | `reference/storage-knowledge.swagger.yml` |
| LLM Gateway | `LLM` | `reference/llm-gateway-api.md` | `reference/llm-gateway.swagger.yml` |

Read the index for the method you are about to call; open the swagger only for payload shapes, enums, or error bodies. The specs are for knowing shapes — the workspace still calls every product through its app import, never with `fetch:`. See `reference/README.md`. Agent Evaluations has no published swagger; use its `automations.md` doc.

## Prisme.ai Documentation

Public product documentation: **<https://docs.prisme.ai/get-started/home>**. Use it for product concepts, terminology, and what a feature is supposed to do. It is not the API contract — for request/response shapes use `reference/`, and for what an app method actually sends use the app workspace itself.

Pages that matter for this skill:

| Topic | URL |
|---|---|
| Platform overview | <https://docs.prisme.ai/get-started/platform-overview> |
| Agent Creator — overview | <https://docs.prisme.ai/products/agent-factory/overview> |
| Agent Creator — creating agents | <https://docs.prisme.ai/products/agent-factory/creating-agents> |
| Agent Creator — instructions | <https://docs.prisme.ai/products/agent-factory/instructions> |
| Agent Creator — capabilities and tools | <https://docs.prisme.ai/products/agent-factory/capabilities> |
| Agent Creator — knowledge architecture | <https://docs.prisme.ai/products/agent-factory/knowledge-architecture> |
| Agent Creator — evaluations | <https://docs.prisme.ai/products/agent-factory/evaluations> |
| Knowledges — overview | <https://docs.prisme.ai/products/ai-knowledge/overview> |
| Knowledges — knowledge bases | <https://docs.prisme.ai/products/ai-knowledge/knowledge-bases> |
| Knowledges — documents | <https://docs.prisme.ai/products/ai-knowledge/documents> |
| Knowledges — website crawling | <https://docs.prisme.ai/products/ai-knowledge/crawl-website> |
| Knowledges — RAG settings | <https://docs.prisme.ai/products/ai-knowledge/rag-settings> |
| Governance — available models | <https://docs.prisme.ai/products/ai-governance/available-models> |
| Governance — model governance | <https://docs.prisme.ai/products/ai-governance/model-governance> |
| Builder — automations | <https://docs.prisme.ai/products/ai-builder/automations> |
| Builder — custom code | <https://docs.prisme.ai/products/ai-builder/custom-code> |
| DSUL overview | <https://docs.prisme.ai/dsul/overview> |
| API reference — authentication | <https://docs.prisme.ai/api-reference/authentication> |
| API reference — errors | <https://docs.prisme.ai/api-reference/errors> |
| Tutorial — no-code RAG agent | <https://docs.prisme.ai/resources/tutorials/no-code-rag-agent> |
| Tutorial — website to RAG agent | <https://docs.prisme.ai/resources/tutorials/website-to-rag-agent> |

Notes:

- The `get_prisme_documentation` MCP tool searches this same documentation from the session; prefer it over guessing a URL.
- The site tracks the latest release. When behaviour on sandbox contradicts a page, trust the environment and say so rather than coding to the doc.
- Product naming differs between the docs and the DSUL: the docs say *Agent Creator* for what this skill imports as `Agents` (agent-factory), and *Knowledges* for what it imports as `Storage`.

## Non-Negotiables

- Use the product apps, never raw product HTTP calls:
  - `Agents` for agent creation, configuration, tools, messages, and cleanup.
  - `Storage` for file or URL sources, vector stores, indexing, listing, and cleanup.
  - `Evaluation` for test cases, evaluation runs, run polling, exports/results, and cleanup.
  - `LLM` (llm-gateway) for straight LLM calls that need no agent: chat completions, embeddings, model catalogue, and resolved defaults.
- Do not create an Agent Factory agent just to make a one-shot model call. If the step is a plain completion or embedding, call `LLM.*` instead of `Agents.*`. See `Direct LLM Calls Without An Agent`.
- Never use `fetch` to Agent Factory, Storage, Agent Evaluations, or the LLM Gateway. For this bootstrap workspace, avoid `fetch:` entirely unless the user explicitly adds an unrelated external integration.
- If an action is not exposed by the app, check `reference/` before reporting: an endpoint present in the spec but absent from the app means a missing wrapper method, while an endpoint absent from the spec means the product does not support it. Either way, stop and report it in chat with which of the two it is. Ask how to proceed and suggest updating the relevant app wrapper.
- Generated workspaces may import only `Agents`, `Storage`, `Evaluation`, and `LLM` among Prisme product apps.
- Do not add a `one-product` label to the generated workspace.
- First pass is discovery/spec only. Ask for end-user confirmation before creating workspace files.
- After confirmation and local validation, attempt the required test/push workflow for the target environment. Let Codex or Claude surface normal permission prompts for push or remote execution.

## First Pass

Before editing files:

1. Identify the desired workspace slug, agent name, agent instructions, source files/URLs, and evaluation questions.
2. Read the bundled `reference/` index for each product you will call — it is the authoritative list of what the app methods map to. For product concepts you are unsure about, read the matching page on <https://docs.prisme.ai/get-started/home> or search it with `get_prisme_documentation`.
3. Read the local docs in the `prismeai-workspaces` repo when you need implementation detail beyond the REST contract:
   - `docs/agent-factory/automations.md`
   - `docs/storage/automations.md`
   - `docs/agent-evaluations/automations.md`
   - `docs/llm-gateway/overview.md` and `docs/llm-gateway/automations.md` when the workspace makes direct LLM calls
4. Check current examples when useful:
   - `workspaces/agent-factory-consumer/` for `Agents.*` app method usage.
   - `workspaces/agent-evaluations-consumer/` for evaluation app method usage; translate `AgentEvaluations.*` calls to this skill's `Evaluation.*` import alias.
   - `workspaces/llm-consumer/` for `LLM.*` app method usage against the llm-gateway.
   - `workspaces/ai-act-agent/` only for high-level workspace shape. Do not copy its domain filters or any raw HTTP cleanup pattern.
5. Present a concise implementation plan with:
   - workspace slug and display name
   - product apps to import
   - source ingestion plan
   - direct LLM calls, if any, and which are agent-less on purpose
   - evaluation cases to seed
   - test suite behavior
   - test/push target environment
6. Ask for confirmation before creating the workspace. Do not continue until the user confirms.

## Workspace Shape

After confirmation, create a local workspace under `workspaces/{slug}/`:

```text
workspaces/{slug}/
├── index.yml
├── security.yml
├── imports/
│   ├── Agents.yml
│   ├── Storage.yml
│   ├── Evaluation.yml
│   └── LLM.yml            # only when the workspace makes direct LLM calls
├── automations/
│   ├── createBootstrap.yml
│   ├── createAgent.yml
│   ├── createStorageSources.yml
│   ├── createEvaluationCases.yml
│   ├── runEvaluation.yml
│   └── tests/
│       └── bootstrap.yml
└── tests/
    └── README.md
```

`tests/` is required for fixtures, status notes, and a human-readable test contract. Executable DSUL tests live under `automations/tests/` so the workspace loader can run them.

## Required Imports

Use these import slugs exactly unless the user explicitly asks for a different local alias.

```yaml
# imports/Agents.yml
slug: Agents
appSlug: Agents
config:
  apiKey: '{{secret.agentFactoryApiKey}}'
```

```yaml
# imports/Storage.yml
slug: Storage
appSlug: Storage
config: {}
```

```yaml
# imports/Evaluation.yml
slug: Evaluation
appSlug: agentEvaluations
config:
  apiKey: '{{secret.agentEvaluationsApiKey}}'
```

```yaml
# imports/LLM.yml
slug: LLM
appSlug: LLM
config:
  apiKey: '{{secret.llmGatewayApiKey}}'
```

Import `LLM` only when the workspace actually makes direct model calls.

## Direct LLM Calls Without An Agent

Use the `LLM` app whenever a step is a plain model call with no agent behind it: classification, extraction, translation, reformulation, summarization, LLM-as-judge scoring, or embeddings. It goes through the `llm-gateway` workspace, so governance, model allowlists, failover, cost, and carbon analytics still apply — the same guarantees an agent would give you, without provisioning one.

Reach for `Agents.sendMessage` only when the call needs agent state: attached Storage sources and `file_search`, tools, system instructions held server-side, conversation context, or an evaluation target. A single completion is not one of those cases.

| Method | Purpose |
|---|---|
| `LLM.chatCompletion` | Non-streaming chat completion. Arguments: `model`, `messages`, `temperature`, `max_tokens`, `tools`, `tool_choice`, `response_format`, `analytics_context`, `headers`. |
| `LLM.embeddings` | Text embeddings. Arguments: `input`, `model`, `dimensions`, `analytics_context`, `headers`. |
| `LLM.listModels` | Model catalogue, filterable by `type`, `enabled`, `tags`, `visible_only`. |
| `LLM.getModel` | Full metadata for one `model_id`. |
| `LLM.getDefaults` | Resolved default models for completions, embeddings, image generation, file parsing. |

Rules:

- Omit `model` to take the gateway default, or read it from `config` so it stays editable. Do not hardcode a provider model id in several automations.
- Responses are OpenAI-compatible. Check `output.error` before reading `output.choices` or `output.data`; the app returns an error payload instead of throwing.
- Non-streaming responses carry `usage.cost`, `usage.duration_ms`, and `usage.carbon`. Pass `analytics_context` (`orgSlug`, `agent_id`, `user_id`, `context_id`) when the call should be attributable in analytics.
- `LLM.chatCompletion` is non-streaming by design (`stream: false`). SSE streaming requires calling the gateway endpoint directly and is out of scope for a bootstrap workspace.
- Declare the `llmGatewayApiKey` secret in `index.yml`.
- The public REST contract is bundled at `reference/llm-gateway.swagger.yml` (index: `reference/llm-gateway-api.md`), served from `https://{host}/v2/workspaces/slug:llm-gateway/webhooks`. Read it for request/response shapes only — call the gateway through the `LLM` app, never with `fetch:`.

Example:

```yaml
- LLM.chatCompletion:
    model: '{{config.llm.model}}'
    messages:
      - role: system
        content: Classify the document into one of the allowed categories.
      - role: user
        content: '{{document}}'
    temperature: 0
    output: completion
- conditions:
    '{% {{completion.error}} %}':
      - break:
          scope: automation
```

## Workspace Config

Keep `index.yml` focused on bootstrap state and secrets:

- Labels: include project/domain labels such as `agent-bootstrap`, `rag`, or the customer/domain name. Do not include `one-product`.
- Secrets: define `agentFactoryApiKey`, `agentEvaluationsApiKey`, and `llmGatewayApiKey` when the `LLM` app is imported.
- Config value:
  - `agent`: `id`, `name`, `model`, `instructions`, optional `temperature`.
  - `storage`: `vectorStoreId`, `provider`, chunking/embedding defaults when needed.
- `bootstrap.sources`: source list classified as `url`, `file_id`, or `local_file`, with names, filenames, MIME types, source values, and tags.
- `bootstrap.evaluationCases`: question, expected answer, and criteria list.

## Automation Contract

Create small automations with one responsibility each:

- `createAgent.yml`: calls `Agents.createAgent` with `config.agent.name`, `config.agent.instructions`, `config.agent.model`, and `config.agent.temperature`, stores `config.agent.id`, returns the created agent.
- `createStorageSources.yml`: calls `Storage.createVectorStore`, `Agents.addTool` with `type: file_search`, then attaches each source with `Storage.addFileToVectorStore`.
  - URL sources pass `url`, `file_name`, `mime_type`, `tags`, `metadata`, optional `headers`, optional `force_recrawl`, and `agent_id` directly to `Storage.addFileToVectorStore`.
  - Existing files pass `file_id` to `Storage.addFileToVectorStore`.
  - Local files require a Storage app upload method before attach. Use `Storage.uploadFile` when the local file can be represented by the app's supported arguments. If the needed upload shape is not exposed by the app, stop and report the missing method.
  - Poll attached files with `Storage.listVectorStoreFiles` or `Storage.getVectorStoreFile` until each file reaches a terminal indexed or failed state before sending messages or starting evaluation.
- `createEvaluationCases.yml`: calls `Evaluation.importCases` or `Evaluation.createCase`, then `Evaluation.listCases`.
- `runEvaluation.yml`: calls `Evaluation.startRun`, polls `Evaluation.getRun` until `completed`, `failed`, `cancelled`, or timeout, then returns the run and result summary.
- `createBootstrap.yml`: endpoint automation that runs the full flow in order and returns IDs plus next steps.

Use `comment:` instructions for explanations inside DSUL. Do not use YAML comments in automation files.

## Endpoint And Security Rules

- Helper automations are `private: true`.
- Test automation file `automations/tests/bootstrap.yml` must set `slug: tests/bootstrap`, a matching name such as `/tests/bootstrap`, and `when.endpoint: true`.
- `security.yml` must define the intended authorization posture. Default to manual/admin bootstrap endpoints; do not expose bootstrap or test endpoints as unauthenticated public endpoints unless the user explicitly requests it.

## Bootstrap Test Suite

The first implementation must include a runnable bootstrap test. It must create temporary resources, verify them, run evaluation, and clean up.

Executable automation: `automations/tests/bootstrap.yml`.

Required checks:

1. Generate a unique test suffix from `run.correlationId`; use it in names, tags, and metadata.
2. Create a temporary agent with `Agents.createAgent`.
3. Create a simple vector store with `Storage.createVectorStore`.
4. Attach it to the agent with `Agents.addTool` as `file_search`.
5. Add at least one simple URL source through `Storage.addFileToVectorStore` using the `url` argument.
6. Poll Storage until attached source files are indexed or failed.
7. Create at least two evaluation cases through `Evaluation.importCases` or `Evaluation.createCase`.
8. Optionally call `Agents.sendMessage` and verify a non-empty task response after Storage indexing is complete.
9. Start an evaluation run with `Evaluation.startRun`.
10. Poll with `Evaluation.getRun`; never use `fetch` for run creation or polling.
11. Verify:
   - `Agents.getAgent` returns the agent.
   - `Storage.getVectorStore` returns the vector store.
   - `Storage.listVectorStoreFiles` or `Storage.getVectorStoreFile` shows each source file in a terminal indexed or failed state.
   - `Evaluation.listCases` returns the seeded cases.
   - the evaluation run reaches a terminal status and exposes results or a clear failure.
12. Clean up only resources created by the test, using captured IDs. Do not delete by broad tags or agent-wide filters. Use app methods for cases, runs, vector store files, vector store, and agent.

If the workspace imports `LLM`, add one more check: call `LLM.chatCompletion` with a short prompt and assert the response has no `error` and a non-empty `choices` array. This call creates nothing, so it needs no cleanup.

If the test fails because the generated DSUL is wrong, fix and rerun. Iterate until it passes or until a product app capability is missing. If a product app capability is missing, stop, report the missing method, and propose an app update.

Use try/catch cleanup blocks so failed setup attempts cleanup for captured IDs. Keep cleanup outputs in the test result.

## Validation

Before reporting completion:

1. Run DSUL validation for every generated automation, including `automations/tests/bootstrap.yml`, with `validate_automation`. If the validation tool is unavailable, report that explicitly.
2. Run a local guardrail scan:

```bash
rg -ni "Knowledge[[:space:]-]*Client|KnowledgeClient|AI[[:space:]-]*Knowledge|AI[[:space:]-]*Store|ai-knowledge|ai-store|appSlug:\\s*Knowledge|one-product|fetch:" workspaces/{slug}
```

There should be no matches in generated files. If the user explicitly requested an unrelated external integration and a legitimate unrelated `fetch:` exists, explain why it is outside Agent Factory, Storage, and Evaluation.

3. Run local automation testing through the project `/test-automation` workflow when available.
4. Attempt the required push/test path for the target environment so the bootstrap test can execute against real product apps. Let Codex or Claude request permissions when the toolchain needs them.
5. Rerun validation and tests after each fix until the suite passes or a missing product app method blocks progress.

## Response Shape

When the workspace is ready locally, report:

- files created or changed
- app imports used
- validation/test status
- any missing app methods or product limitations
- whether a push/test attempt happened and the resulting environment/status
