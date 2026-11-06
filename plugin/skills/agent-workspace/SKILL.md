---
name: agent-workspace
description: Create or maintain a Prisme.ai agent workspace from the standard template — an Agent Factory agent, its Storage knowledge bases, sources and Agent Evaluations bench declared in index.yml and applied by an idempotent syncAll with dry run and drift guard — plus its operator console (React page pages/SLUG-console) with the agent-specific maintenance screens. Uses the product apps Agents, Storage and Evaluation.
---

# Agent Workspace

Use this skill to build a DSUL workspace that is the source of truth for an Agent Factory agent: its
prompt, settings, tools, knowledge bases, sources and evaluation cases are declared in the workspace
and applied safely, and the people who maintain it get an operator console.

## Templates and guides

| Need | Read / copy |
|---|---|
| The engine (sync, describe, status, ingestion, bench, console endpoints) | `templates/workspace/` → `workspaces/<slug>/`; its `DESIGN.md` is the contract |
| The operator console | `templates/console/` overlaid on a starter-spa page → `pages/<slug>-console/` |
| Sync, drift, adoption, app gaps, identity limits, engine upgrades | `guides/sync.md` |
| Ingestion queue, custom data sources | `guides/ingestion.md` |
| Bench method | `guides/evaluation.md` |
| Console: plug-in steps, backend, overlay, security, UX and style rules, **agent-specific screens** | `guides/console.md` |

Read a guide when the plan touches its topic; do not load them all up front.

## Bundled API Reference

`reference/` carries the OpenAPI specs for the products this skill drives, each with a condensed index that starts with the app-method → REST-operation mapping:

| Product | App import | Index | Full spec |
|---|---|---|---|
| Agent Factory | `Agents` | `reference/agent-factory-api.md` | `reference/agent-factory.swagger.yml` |
| Knowledges (Storage) | `Storage` | `reference/storage-knowledge-api.md` | `reference/storage-knowledge.swagger.yml` |

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

- Use the product apps:
  - `Agents` for agent creation, configuration, tools, messages, and cleanup.
  - `Storage` for file or URL sources, vector stores, indexing, listing, and cleanup.
  - `Evaluation` for test cases, evaluation runs, run polling, exports/results, and cleanup.
  - `Collection` (import `state`) for workspace state and `Custom Code` for pure functions, as in the template.
  - Import any other app the agent needs (structured data collections…).
- Every model call goes through an agent. Create or reuse an Agent Factory agent and call `Agents.sendMessage` — including for one-shot work such as classification, extraction, translation, summarization, or LLM-as-judge scoring. Do not call an LLM gateway or any provider API directly.
- A direct call is allowed only for an operation the app does not expose, only through `_product-call` (the one automation allowed to `fetch`), signed with the app's own credential and never a personal token, and listed in `guides/sync.md` « App gaps ». Check `reference/` first: an endpoint present in the spec but absent from the app is a missing wrapper method; an endpoint absent from the spec is not supported by the product. Report every new gap in chat and suggest updating the app.
- Every change to an existing environment starts with `syncAll {dryRun: true}`, read before applying. Never overwrite a hand edit: drift stops the sync unless an admin forces it after `describeInstance`.
- No client data in git (cases, real questions, reference text stay empty stubs); no secret, token or customer hostname in the page bundle or the journal.
- Do not add a `one-product` label to the generated workspace.
- First pass is discovery/spec only. Ask for end-user confirmation before creating workspace files.
- After confirmation and local validation, attempt the required test/push workflow for the target environment. Let Codex or Claude surface normal permission prompts for push or remote execution.

## First Pass

Before editing files:

1. Identify the desired workspace slug, agent name, agent instructions, source files/URLs, and evaluation questions. If the agent already exists on the target environment, plan the adoption first (`guides/sync.md` § 4).
2. Read the bundled `reference/` index for each product you will call — it is the authoritative list of what the app methods map to. For product concepts you are unsure about, read the matching page on <https://docs.prisme.ai/get-started/home> or search it with `get_prisme_documentation`.
3. Read the local docs in the `prismeai-workspaces` repo when you need implementation detail beyond the REST contract:
   - `docs/agent-factory/automations.md`
   - `docs/storage/automations.md`
   - `docs/agent-evaluations/automations.md`
4. Check current examples when useful:
   - `workspaces/agent-factory-consumer/` for `Agents.*` app method usage.
   - `workspaces/agent-evaluations-consumer/` for evaluation app method usage; translate `AgentEvaluations.*` calls to this skill's `Evaluation.*` import alias.
   - `workspaces/ai-act-agent/` only for high-level workspace shape. Do not copy its domain filters or any raw HTTP cleanup pattern.
5. Present a concise implementation plan with:
   - workspace slug and display name
   - product apps to import
   - source ingestion plan
   - which agent handles each model call in the flow
   - evaluation cases to seed
   - the operator console: whether it is needed (`guides/console.md` § 1), the generic views it gets (Dashboard, Agent, Journal, and Ingestion / Sources / Bench when the workspace has them), and the **agent-specific screens**: what changes over the agent's life, each recurring maintenance job with every side effect it implies, which side effects become automatic, and the wizard each job gets (`guides/console.md` § 9)
   - test suite behavior
   - test/push target environment
6. Ask for confirmation before creating the workspace. Do not continue until the user confirms.

## Workspace Shape

After confirmation, copy `templates/workspace/` to `workspaces/{slug}/`, replace the placeholders listed at the top of its `index.yml`, and write the agent-specific parts only in the content files (`automations/content/`: prompts, reference documents, test questions, custom source types; DESIGN §1.1), never in engine files, so later template versions can be applied (`guides/sync.md` § 9). Then, when the plan includes a console, create `pages/{slug}-console/` (`guides/console.md` § 2):

```text
workspaces/{slug}/
├── DESIGN.md                 the contract, extended with the agent-specific parts
├── index.yml                 manifest: agents, knowledgeBases, documents, sources, evaluation, console
├── security.yml              control (API key) and files roles
├── imports/                  Agents, Storage, Evaluation, state (Collection), Custom Code
├── automations/
│   ├── helpers, sync         _state-*, _guard-control, _product-call, _ensure-*, syncAll, describeInstance, statusReport
│   ├── content/              AGENT CONTENT: _content-prompts, _content-documents, _content-agent-tests, _content-sources
│   ├── ingestion             refreshSource, pumpIngest, onIngestItem, controlIngest, _source-discover
│   ├── evaluation            importCases, runBenchmark, pollBenchmark, benchmarkReport, exportBenchmark
│   ├── console               consoleState, consoleAction, consoleDiff, consoleSources, _sources-effective
│   └── tests/                engine.yml (+ bootstrap.yml)
└── tests/
    └── README.md
pages/{slug}-console/         starter-spa + templates/console overlay + agent-specific views
```

Drop a module the agent does not need (no sources → no ingestion; no cases → no bench) together with its `_console-dispatch` entries and console view. `tests/` is required for fixtures, status notes, and a human-readable test contract. Executable DSUL tests live under `automations/tests/` so the workspace loader can run them.

## Imports, Config And Automations

The imports, the manifest (`config.value`) and every automation's arguments and output are fixed by
`templates/workspace/DESIGN.md` (§2 manifest, §3 state, §4 sync, §5 ingestion, evaluation and console
endpoints). Keep the import slugs `Agents`, `Storage`, `Evaluation` (appSlug `agentEvaluations`),
`state` and `Custom Code`. When the workspace needs something the template does not have, extend
`DESIGN.md` in the same change.

- Labels: project/domain labels such as `agent-workspace`, `rag`, or the domain name. Do not include `one-product`.
- Secrets: none by default (the apps act with the caller's identity); an organization API key only for runs without a user (`guides/sync.md` § 8), plus one per bound resource id.
- One responsibility per automation; `comment:` instructions for explanations inside DSUL, never YAML comments in automation files.

## Endpoint And Security Rules

- Helper automations are `private: true`.
- Test automation file `automations/tests/bootstrap.yml` must set `slug: tests/bootstrap`, a matching name such as `/tests/bootstrap`, and `when.endpoint: true`.
- `security.yml` must define the intended authorization posture: the `control` role only through a workspace API key, never `prismeai` auth. Every control endpoint is guarded by `_guard-control` (`config.controlRoles`, admin-only actions on `config.adminRoles`). Do not expose bootstrap, test or console endpoints as unauthenticated public endpoints unless the user explicitly requests it.

## Bootstrap Test Suite

Two tests. `automations/tests/engine.yml` (from the template) checks the engine read-only: syncAll dry run, describeInstance, statusReport, consoleState, consoleAction. The first implementation must also include a runnable bootstrap test that creates temporary resources, verifies them, runs evaluation, and cleans up.

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

If the test fails because the generated DSUL is wrong, fix and rerun. Iterate until it passes or until a product app capability is missing. If a product app capability is missing, stop, report the missing method, and propose an app update.

Use try/catch cleanup blocks so failed setup attempts cleanup for captured IDs. Keep cleanup outputs in the test result.

## Validation

Before reporting completion:

1. Run DSUL validation for every generated automation, including `automations/tests/bootstrap.yml`, with `validate_automation`. If the validation tool is unavailable, report that explicitly.
2. Run a local guardrail scan:

```bash
rg -ni "Knowledge[[:space:]-]*Client|KnowledgeClient|AI[[:space:]-]*Knowledge|AI[[:space:]-]*Store|ai-knowledge|ai-store|appSlug:\\s*Knowledge|one-product|installToken" workspaces/{slug}
rg -n "fetch:" workspaces/{slug}/automations | rg -v "_product-call.yml"
```

There should be no matches, except a `fetch:` in a custom `_source-discover` branch that reads an external source (explain it). Any other direct product call belongs in `_product-call` and in the app gaps list.

3. Run local automation testing through the project `/test-automation` workflow when available.
4. Console: `npm run typecheck` and `npm run build` in `pages/{slug}-console/`, then the mock check of `guides/console.md` § 8 in light and dark.
5. Attempt the required push/test path for the target environment so the bootstrap test can execute against real product apps. Let Codex or Claude request permissions when the toolchain needs them.
6. Rerun validation and tests after each fix until the suite passes or a missing product app method blocks progress.

## Response Shape

When the workspace is ready locally, report:

- files created or changed
- app imports used
- validation/test status
- any missing app methods or product limitations
- whether a push/test attempt happened and the resulting environment/status
- the console preview URL, `https://<studio-host>/apps/{slug}?view=dashboard` (the page is served under the workspace slug), and the agent-specific screens it has
