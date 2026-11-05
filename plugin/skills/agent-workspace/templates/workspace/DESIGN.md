# Standard agent workspace — design contract

Implementation reference of `templates/workspace/` (the DSUL engine) and `templates/console/` (the
operator console). Every automation, Custom Code function and console view follows this file; when
the code and this file disagree, fix one of them in the same change.

The engine is the generic part of a validated production agent workspace, with every domain piece
(source-specific crawling, structured customer data, reference extraction, prompts) removed. Placeholders are
written `<slug>`, `<agent-key>`, `<kb-key>`, `<source-key>` and must be replaced when the template is
copied; every other name is fixed.

## 1. Files and ownership

```text
templates/workspace/                 → copied to workspaces/<slug>/
├── DESIGN.md                        this contract (keep it in the workspace, extend it)
├── index.yml                        manifest skeleton (§2)
├── security.yml                     roles (§8)
├── imports/
│   ├── Agents.yml                   appSlug Agents        (agent-factory)
│   ├── Storage.yml                  appSlug Storage       (knowledges)
│   ├── Evaluation.yml               appSlug agentEvaluations
│   ├── state.yml                    appSlug Collection    (§3)
│   └── Custom Code.yml              appSlug Custom Code   (§6)
└── automations/
    ├── helpers      _state-get _state-set _state-find _guard-control _manifest-get
    │                _product-call _resolve-agent _resolve-kb _lock
    ├── sync         _agent-expected _ensure-kb _ensure-kb-document
    │                _ensure-agent syncAll describeInstance statusReport
    ├── ingestion    _source-discover _ingest-counts _ingest-housekeeping _ingest-control
    │                _ingest-refresh-plan _ingest-requeue _ingest-attach
    │                refreshSource pumpIngest onIngestItem controlIngest
    ├── evaluation   _cases-load importCases runBenchmark _bench-advance _bench-collect
    │                advanceBenchmark pollBenchmark controlBenchmark benchmarkReport exportBenchmark
    ├── console      consoleState consoleAction _console-dispatch _console-journal
    │                _console-summary consoleDiff _console-kb-diff consoleSources _overlay-get _overlay-set
    │                _sources-effective (read by every module that reads sources)
    ├── tests/       tests/engine (smoke test of the engine, §9)
    └── content/     AGENT CONTENT: _content-prompts _content-documents
                     _content-agent-tests _content-sources (§1.1)
```

### 1.1 Engine and content

Two kinds of files, so a workspace can take a new template version without losing its work:

| Content — owned by the agent, never overwritten | Engine — replaced as is by an upgrade |
|---|---|
| `index.yml` (the manifest, `templateVersion` included) | every other file of `automations/` |
| `automations/content/*`: `_content-prompts` (`{prompts: {<prompt-key>: text}}`), `_content-documents` (`{documents: {<doc-key>: text}}`), `_content-agent-tests` (`{tests: [...]}`), `_content-sources` (custom source types) | `imports/*`, `security.yml` |
| automations the agent adds under its own slugs, imports it adds | `DESIGN.md` (extend it in a separate file, e.g. `DESIGN-agent.md`) |

The engine calls the content by these fixed slugs (DSUL cannot call a slug held in a variable): an
engine file never holds an agent-specific line. `config.templateVersion` (semver) names the engine
version a workspace runs; `statusReport` returns it. Upgrade procedure: `guides/sync.md` § 9. A
change that needs an agent-specific branch in an engine file is a change of the template (a new
content hook), not of the workspace.

Module boundaries: a module only calls the helpers and the endpoints listed here; it never reads
another module's state rows except through the shapes of §3 and §5.

## 2. Manifest (`index.yml` → `config.value`)

The manifest is the desired state. Everything the engine creates or updates is declared here; a
resource that is not declared is never touched.

```yaml
config:
  value:
    templateVersion: 1.0.0                          # engine version this workspace runs (§1.1)
    # agentFactoryApiKey / agentEvaluationsApiKey: optional org keys (secrets), only for runs without a user;
    # by default the apps act with the identity of whoever runs the automation (guides/sync.md § 8)
    controlRoles: [owner, admin, editor, control]   # workspace roles allowed on control endpoints
    adminRoles: [owner, admin]                      # roles allowed on admin-only actions (force, stop)
    agentDefaults:                                  # applied to every agent, overridable per agent
      model: <model-id>
      temperature: 0.2
      visibility: restricted                        # never public by default
      profile: agent_light                          # sent at creation only
      limits: {max_turns: 30, tool_call_budget: 40, token_budget: 500000, max_tokens: 32000}
    knowledgeBases:
      - key: <kb-key>                               # stable manifest key, never the product id
        name: <slug>-<kb-key>                       # exact name in Storage (resolution by name)
        description: …
        create: true                                # false = never created by the engine
        existingIdFrom: <name>                      # optional: bind to an existing base by id (bound, never deleted);
                                                    # declare config value <name>: '{{secret.<name>}}', bound only when it holds a plain id
        parser: tika
        chunking_strategy: {type: static, max_chunk_size_tokens: 800, chunk_overlap_tokens: 100}
    documents:                                      # reference documents published by syncAll (§4.4)
      - key: <doc-key>
        kb: <kb-key>
        fileName: <doc-key>.txt
        optional: true                              # an empty text is a skip with a warning, never a failure
    sources:                                        # what fills the knowledge bases (§5.3)
      - key: <source-key>
        type: urls                                  # urls | files | <custom type handled by _content-sources>
        target: <kb-key>
        label: Site documentation                   # shown in the console
        overlayParam: urls                          # list the console overlay edits (default: urls, files for type files)
        params:
          urls: [https://example.com/docs/page-1]
    ingestion:
      batchSize: 5                                  # items dispatched per pump run
      maxInFlight: 10
      staleAfterMinutes: 30                         # in-flight item older than this is re-queued
      maxAttempts: 3
      maxHops: 4                                    # cap of the ingest.item → ingest.pump event chain (runtime depth 30)
      unattended: false                             # true only when schedule runs have an identity Storage accepts
    agents:
      - key: <agent-key>
        name: <slug>-<agent-key>                    # exact name in Agent Factory (resolution by name)
        description: …
        optional: false                             # true = synced only when named (variants, comparisons)
        variantOf: null                             # key of the agent it derives from (bench comparisons)
        prompt: <prompt-key>                        # optional key in _content-prompts (default: the agent key)
        model: …                                    # overrides agentDefaults
        limits: {…}
        tools:
          - type: knowledge                         # a manifest knowledge base
            kb: <kb-key>
            name: <kb-key-as-identifier>            # tool name the prompt refers to
            mode: file_search                       # file_search (semantic) | explorer (find/grep/read MCP)
            description: …
          - type: raw                               # any Agent Factory tool, sent as is
            tool: {type: system, name: memory, …}
        skills: []                                  # [{name, description, instructions}] (Agent Factory inline skills)
        subAgents: []                               # [{agent: <agent-key>, name, description}]
    evaluation:
      agents: [<agent-key>]                         # default bench targets
      runner: {batchSize: 5, maxAttempts: 2, messagesPerHour: 120, parallelAgents: 1, batchTimeoutMin: 45, maxRateRetries: 10, erroredThreshold: 0.05}
      criteria: []                                  # default criteria of every case
    console:
      title: Console <Agent name>
      overlays: [sources]                           # config lists the console may layer local additions over (§7)
```

Prompts, document texts and test questions are not in the manifest: they are the agent content of
§1.1, read by key (`agents[].prompt` or the agent key, `documents[].key`).

A knowledge base tool whose base is missing (`create: false` and not bound) is left out of the
agent and reported (`skippedTools`), never sent with a null id.

## 3. State (`imports/state.yml`, Collection app, `collectionName: <slug>State_v1`)

Columns `key` (unique), `kind`, `status`, `data` (json), `error` (json), `updatedAt`. Row keys:

| Key | kind | status | data |
|---|---|---|---|
| `res:kb:<kb-key>` | resource | created \| bound | `{id, name, createdAt}` |
| `res:agent:<agent-key>` | resource | created | `{id, name, createdAt}` |
| `res:agentHash:<agent-key>` | resource | applied | `{hash, snapshot, at, by}` fingerprint of the last apply |
| `res:kbdoc:<doc-key>` | resource | uploaded | `{hash, lines, documentId, uploadedAt}` |
| `item:<source-key>:<itemId>` | item | queued \| dispatched \| processing \| ingested \| error \| cancelled \| removed | `{id, source, target, url, name, mime, fileId, fetchUrl, metadata, documentId, attempts, queuedAt, dispatchedAt, processingAt, ingestedAt, documentStatus, dispatchToken, claimToken}`; error column `{message, stage: attach \| kb \| stale \| indexing, attempt}` |
| `setting:ingestControl` | setting | run \| suspend \| stop | `{action, reason, by, at, source}` |
| `setting:lastRefresh:<source-key>` | setting | — | `{startedAt, finishedAt, discovered, queued, skipped, removed, failed}` |
| `lock:<name>` | lock | held \| free | `{correlationId, startedAt}` (stale after 15 min; only the run that took it releases it). Names: `source:<source-key>`, `bench` |
| `bench:<benchId>` | bench | running \| completed \| interrupted \| failed \| abandoned | `{agentKeys, startedAt, totals, agents, runner, batches}` |
| `benchcase:<benchId>:<agent-key>:<caseId>` | benchcase | pending \| inflight \| done \| errored \| cancelled | `{question, expected, criteria, tags, answer, score, passed, reasons, tokens, durationMs, attempts, runId, lastRunId, lastError}` |
| `setting:benchExport:<benchId>` | setting | — | `{benchId, status, file {name, id, url}, format, counts, exportedAt, by}` |
| `setting:benchControl` | setting | run \| pause \| stop | `{action, by, at}` |
| `setting:cases` | setting | — | `{count, hash, loadedAt, by}` |
| `journal:<iso-date>:<correlationId>` | journal | running \| ok \| error | §5.5 |
| `overlay:<list>:<key>` | overlay | open \| cleared \| integrated | §7 |

Helpers: `_state-get {key} → {found, row}`, `_state-set {key, kind?, status?, data?, error?} → {row}`
(upsert, data replaced never merged), `_state-find {query, sort?, limit?} → {rows}` (default sort
`{updatedAt: -1}`, limit 1000).

## 4. Sync (agents, knowledge bases, documents)

### 4.1 Helpers

- `_guard-control {admin?: bool} → {allowed, role, admin, platformAdmin}`: allowed when `user.role` is in
  `config.controlRoles` or the run is a schedule; `admin` when the role is in `config.adminRoles` or the
  caller is a platform admin. Every control endpoint starts with it and answers 403 `Forbidden`.
  With `admin: true`, `allowed` also requires admin; an endpoint that must answer `AdminRequired`
  (not `Forbidden`) calls the guard without `admin` and tests `admin` itself.
- `_manifest-get {list, key} → {found, item}` over `config.<list>`.
- `_product-call {service, method, path, query?, body?, headers?, multipart?} → {ok, status, body}`: the
  only place allowed to `fetch`, for operations the app imports do not expose (§6.2). `service`
  agent-factory | agent-evaluations | storage (product webhooks) | platform (platform API, signed with the
  workspace API key of the security role `files`). Never throws.
- `_resolve-kb {key} → {id, by: bound | cached | name | notFound, name}`; `_resolve-agent {key} → {id, by: cached | name | notFound, ids}`.
  Resolution order: bound id (`existingIdFrom` secret) → cached state row whose id still exists →
  exact name among own resources. Several same-name agents → the cached one, else the oldest, warning.
- `_lock {name, op: take | release} → {taken, holder}`.

### 4.2 `_agent-expected {key, plannedKbs?} → {body, visibility, skippedTools, missing}`

Builds the exact body `_ensure-agent` sends: defaults merged with the agent entry, instructions from
the `prompt` automation, tools from `tools[]` (knowledge tools resolved to the base id; `explorer` mode
= the Storage MCP tool of the base), skills, sub agents resolved to ids. `missing` lists
`kb:<kb-key>` / `agent:<agent-key>` that do not exist yet; `plannedKbs` (dry run) counts as existing.

### 4.3 `_ensure-agent {key, dryRun?, force?, plannedKbs?} → action`

Reads the live draft, runs `agentConfig check` (§6.1) against the expected body and the stored
fingerprint, then: create, update, leave in drift, or fail. Publishes after every write. Stores the new
fingerprint in `res:agentHash:<key>`. Action shape (also used by `syncAll.actions[]`):

```json
{"type": "agent", "key": "<agent-key>", "action": "would-create | would-update | created | updated | unchanged | drift | failed | optional",
 "id": "…", "forced": false, "missing": ["kb:<kb-key>"], "error": "…",
 "drift": {"reason": "edited-outside-workspace | no-baseline", "changes": ["instructions", "tools"], "summary": "…"},
 "plan": {"mode": "create | update", "same": false,
          "fields": [{"field": "model", "from": "…", "to": "…"}],
          "instructions": {"fromLength": 0, "toLength": 0, "addedLines": 0, "removedLines": 0, "lostSections": [], "firstChanges": [{"op": "+", "line": 1, "text": "…"}]},
          "tools": {"added": [{"name": "…"}], "removed": [], "replaced": [{"from": {"name": "…", "type": "…"}, "to": {"name": "…", "type": "…"}}], "changed": []},
          "skills": {"added": [], "removed": [], "changed": []},
          "subAgents": {"added": [], "removed": [], "changed": []},
          "skippedTools": [], "destructive": ["…"]}}
```

Fingerprint rule: live = expected → `unchanged` (in-sync); live = stored → workspace changed, update;
otherwise drift (`edited-outside-workspace` with a stored hash, `no-baseline` without): untouched unless
`force`.

### 4.4 Knowledge bases and documents

- `_ensure-kb {key, dryRun?} → {type: kb, key, action: exists | bound | unbound | would-create | created | failed, id}`.
- `_ensure-kb-document {key, dryRun?} → {type: kbdoc, key, action: unchanged | would-upload | uploaded | skipped | failed, reason, lines}`:
  text from `_content-documents` (by document key), sha256 compared with `res:kbdoc:<key>.hash`, upload through Storage with a
  stable file name so a new version replaces the old document. Empty text → `skipped`, reason
  `EmptyText`, plus a warning (never a failure).

### 4.5 `syncAll` (endpoint, guarded)

Body `{dryRun?, force?, only?: [kbs | documents | agents | sources], agents?: [<agent-key>], allAgents?, skipIngest?}`.
Order: knowledge bases → documents → sub agents → other agents → `refreshSource` of every source
(unless `skipIngest` or dry run). Optional agents only when named or `allAgents`. `force` is admin-only
(checked by `consoleAction`, and again here). Optional agents not selected appear as `{type: agent, action: optional}`;
an unknown part answers 400 `InvalidOnly`, an unknown agent 400 `UnknownManifestKey`. Returns `{dryRun, actions: [action…], warnings: [string], drifted: [<agent-key>], summary: [string]}`.
HTTP 200 even when one action failed (the console reads `actions[].action = failed`).

### 4.6 `describeInstance` (endpoint, guarded, read-only)

Body `{agents?, includeInstructions? (default true), upload? (default false)}`. Returns
`{instance {workspace, caller, date}, agents: [{key, name, optional, variantOf, resolution {by, id}, live {id, model, status, publishedAt, hasDraftChanges, tools}, expected, diff, syncAll {wouldDo: create | update | drift | failed | optional, reason: in-sync | workspace-changed | no-baseline | edited-outside-workspace | not-found | read-failed, summary, missing?, error?}}], knowledgeBases: [{key, id, by, name}], file?: {name, url}}`.
An agent in sync is `wouldDo: update` with `reason: in-sync` (the console reads it as « à jour »).
`diff` goes from what the workspace would apply to what the agent has: `fields {<field>: {from: workspace, to: live}}`,
`instructions {same, fromLength, toLength, changes: [{op: "-" (workspace only) | "+" (agent only), line, text}]}` (≤ 200 lines),
`tools {added (agent only), removed (workspace only), renamed, changed}`, `skills`, `subAgents`.

### 4.7 `statusReport` (endpoint, guarded, read-only, body `{}`)

```json
{"knowledgeBases": [{"key": "…", "id": "…", "name": "…", "document_counts": {"completed": 0, "in_progress": 0, "failed": 0, "total": 0}}],
 "agents": [{"key": "…", "id": "…", "status": "…", "published": true, "publishedAt": "…", "hasDraftChanges": false, "model": "…", "optional": false, "variantOf": null}],
 "documents": [{"key": "…", "kb": "…", "hash": "…", "lines": 0, "uploadedAt": "…"}],
 "sources": [{"key": "…", "type": "…", "target": "…", "lastRefresh": {…}}],
 "ingest": {"queued": 0, "dispatched": 0, "processing": 0, "ingested": 0, "error": 0, "cancelled": 0, "inFlight": 0,
            "phase": "idle | running | suspended | stopped", "control": {"action": "run"}, "failed": [{"source": "…", "id": "…", "name": "…", "url": "…", "error": {"message": "…", "stage": "…"}, "attempts": 1}]},
 "cases": {"count": 0, "loadedAt": "…"},
 "benchmark": {"key": "bench:…", "benchId": "…", "status": "…", "startedAt": "…", "updatedAt": "…",
               "totals": {"total": 0, "pending": 0, "inFlight": 0, "done": 0, "passed": 0, "failed": 0, "errored": 0},
               "agents": {"<agent-key>": {"score": 0, "passRate": 0, "total": 0, "completed": 0, "errored": 0, "status": "…"}},
               "lastRunError": {"agentKey": "…", "runId": "…", "message": "…", "at": "…"}}}
```

## 5. Endpoints of the other modules

### 5.1 Evaluation (`guides/evaluation.md`)

- `importCases {cases?: [...]} `: loads cases from the body or from `_content-agent-tests` into
  `setting:cases` (+ Agent Evaluations cases through `Evaluation.importCases`). → `{count, hash}`.
- `runBenchmark {agents?, limit?, tags?, onlyErrored?, benchId?, force?}`: one bench at a time
  (409 `BenchmarkRunning` unless `force`, admin-only), queues `benchcase:*` rows, runs one tick. → `{benchId, queued, status}`.
- `advanceBenchmark {}` (one tick) and `pollBenchmark` (schedule, run by the platform at most every 15 min;
  an open console sends `advanceBenchmark` every minute while a bench runs, §5.3): starts at most one batch per agent through `Evaluation.startRun`, collects finished
  runs with `Evaluation.getRun` / results, retries error-like results up to `maxAttempts`, respects
  `messagesPerHour`, computes the report when every case is done or errored.
- `controlBenchmark {action: pause | resume | stop | abandon}` → `{status}`.
- `benchmarkReport {benchId?}` → `{benchId, status, totals, agents, comparisons, worst: [{caseId, agent, score, reasons}]}`.
- `exportBenchmark {benchId?, last?}` → `{file {name, url}}` JSONL, one line per case and agent (question,
  answer, expected, score, judge reasons, tokens, duration).

### 5.2 Ingestion (`guides/ingestion.md`)

- `_sources-effective {key?} → {sources: [{key, type, target, label, params, overlay: {added, removed} | null}]}`:
  delivered `config.sources` with the console overlay applied (§7). Every reader of sources calls it.
- `_source-discover {source} → {items: [{id, url, name, mime, metadata}], failed: [{ref, error}]}`: one
  branch per source type. `urls` and `files` are generic; any other type is handed to `_content-sources` (agent content, `guides/ingestion.md` § 3). Item ids are stable (sha256 of the url, 16 hex).
- `refreshSource {source, dryRun?, requeue?: [itemId]}`: per-source lock, discovers, queues new items,
  re-queues error / cancelled ones, marks items no longer listed `removed` (their documents are deleted
  only with `prune: true`, admin-only; nothing is removed when discovery returned no item and some
  failures), records `setting:lastRefresh:<key>`, kicks `pumpIngest`. Body `params` replaces the effective
  params in memory (console preview of an unsaved change).
  Dry run takes no lock, writes nothing and returns `{discovered, toQueue, alreadyIngested, toRemove,
  toPrune, skipped, items (≤ 50, each with action queue | requeue | ingested | queued | inFlight | remove), failed, warnings}`.
- `pumpIngest` (event `ingest.pump {source?, hop}`; webhook; an open console sends it every minute while items
  wait; schedule `*/15 * * * *` only with `config.ingestion.unattended`, since a schedule run has no user and
  Storage answers 401, so it returns `{skipped: NoUserIdentity}` otherwise): reads
  `setting:ingestControl` fresh; claims up to `batchSize` queued items within `maxInFlight` (conditional
  update queued → dispatched with a `dispatchToken`) and emits `ingest.item {key, token, hop}` per item.
- `onIngestItem` (event `ingest.item`): checks the token, claims the row (dispatched → processing), adds the
  document to the target base through `Storage.addFileToVectorStore` (url) or the file upload method,
  records `documentId`, status `ingested`; on failure back to `queued` while `attempts < maxAttempts`, then
  `error` with `{message, stage}`. Every finished item emits `ingest.pump` (hop + 1, capped by `maxHops`).
  Storage documents carry the metadata `{ingestSource, ingestItem}`.
  Indexing state is read later by `_ingest-housekeeping` (documents that failed to index → error).
- `controlIngest {action: suspend | resume | stop, reason?, source?}`: writes `setting:ingestControl`;
  `stop` (admin-only) cancels every queued item of the scope.

### 5.3 Console (`guides/console.md`)

- `consoleState {withAgents?, withJournal? (default true), journalLimit? (default 30)}` →
  `{generatedAt, me {id, email, role, canControl, canAdmin}, status (statusReport), sources (_sources-effective),
  agents: [{key, name, optional, variantOf, id, wouldDo, reason, summary, publishedAt, hasDraftChanges, status}] | null,
  journal: [{key, status, updatedAt, data}]}`. `agents` is read only with `withAgents` (describeInstance
  without instructions); a failed read gives `agents: [{error, message}]`. `sources` carries
  `delivered {param, items, hash}` and `overlay {added, removed, by, at, baseHash, param, baseChanged}`.
  A refresh in progress is read from `status.ingest` and the journal (no per-source lock in the answer).
- `consoleAction {action, args}`: the allow-list is `_console-dispatch`. Admin-only actions (syncAll force,
  runBenchmark force, controlIngest stop, refreshSource prune outside a dry run, controlBenchmark abandon)
  are refused by the automation itself (`AdminRequired`), and `consoleAction` relays it: one rule, one
  place. Not journaled: read-only actions (describeInstance, benchmarkReport, syncAll dryRun,
  refreshSource dryRun, exportBenchmark last) and the console ticks (advanceBenchmark, pumpIngest); every
  other action writes a journal line before the run (running) and completes it after (ok | error).
  Refused before the run: 403 `Forbidden` (no control role), 400 `InvalidAction`. Once the action ran,
  HTTP 200 `{action, ok, error, message, journalKey, result}`; `ok` is false when the result carries an
  error or when a `syncAll` action failed (`error: SyncActionFailed`, `message: "<type> <key>: <code>"`).
  Control rows (ingestion and bench control keys) take their author from the session, never the body.
- `consoleDiff {part: agents | kbs, agents?}`: `agents` → `{agents: [describeInstance agent entries with diff]}`;
  `kbs` → `{kbs: [{key, name, id, by, document_counts, settings {fields: [{field, manifest, live, same}], same}}], documents: [syncAll dry-run kbdoc actions]}`.
- `consoleSources {op, source, …}`: `list` → effective sources; `preview {add, remove}` → the
  `refreshSource` dry run of the source with the change applied in memory; `save {add, remove}` → writes the
  overlay (§7), journaled; `progress {ids? | urls?}` (≤ 80) → `{items: [{id, url, status (absent when never queued), updatedAt, error, attempts}]}`
  read from the `item:<source-key>:<id>` rows (ids derived from urls when urls are given);
  `export` → `{yaml}` the delivered entry with the overlay folded in; `markIntegrated`
  → drops the overlay once the git version contains it (it refuses while the delivered list does not
  contain every added item, `NotIntegrated`).

### 5.4 Error codes

PascalCase, in `{error, message}`: `Forbidden`, `AdminRequired`, `InvalidAction`, `InvalidOp`,
`UnknownManifestKey`, `InvalidOnly`, `ActionFailed` (a dispatched automation threw), `MissingDependency`, `SyncActionFailed`, `AgentSaveFailed`, `AgentReadFailed`,
`KnowledgeBaseCreateFailed`, `KbDocumentUploadFailed`, `EmptyText`, `SourceNotConfigured`,
`SourceRefreshRunning`, `SourceTypeUnsupported`, `SourceRefreshFailed`, `KnowledgeBaseNotFound`,
`BenchmarkRunning`, `BenchmarkBusy`, `BenchmarkNotFound`, `ExportNotFound`, `ExportUploadFailed`, `NothingQueued`,
`NoCaseLoaded`, `NothingToSave`, `NotIntegrated`, `CustomCodeUnavailable`, `AppMethodMissing`.
The console maps each to one plain sentence (`src/lib/i18n.ts` `errorText`).

### 5.5 Journal (`_console-journal`)

`op start {action, args} → {key}` writes `journal:<date>:<cid>` running with
`{action, args (never a secret), by {id, email, role}, startedAt, correlationId}`; `op finish {key, status, result}`
sets status and `result` (`_console-summary {action, result} → {summary}`: a few counts, never the full payload).
Never throws.

## 6. Custom Code and product calls

### 6.1 `Custom Code` functions (pure, no I/O)

- `agentConfig {op: check | plan | report | summary, live, expected, stored, options, data}`: fingerprint
  (normalised snapshot of the managed fields, secrets hashed, tools and sub agents sorted by name), drift
  decision, plan (§4.3), describe entry (§4.6), summary + warnings of a sync. Destructive rules: tool
  removed or replaced by another type, target changed, sub agent removed, a limit lowered or removed,
  model changed, visibility changed, instructions shorter by more than 10 % or losing headings.
- `benchEngine {op: cases | units | plan | collect | report | export, …}`: case normalisation, bench
  batching and report.
- `consoleKit {op: hash | yaml | kbSettings}`: overlay hashes, the YAML export of a source, knowledge-base
  settings comparison.
- `sha256 {text}` → `{hash (16 hex), lines, length, base64}`; item ids and document hashes use it.

Function rules: parameter types string, number, object or boolean only; no `description` at function
level; no `#` comment lines in the code.

### 6.2 App methods and gaps

Use `Agents.*`, `Storage.*`, `Evaluation.*`. An operation the app does not expose goes through
`_product-call`, and is listed in `guides/sync.md` « App gaps » with the REST route. Known gaps at the
time of writing: none on the products (`Agents.getAgent` forwards `x-draft-mode`, `createAgent` /
`updateAgent` forward limits, skills and sub agents, `Storage.addFileToVectorStore` forwards
`source_url` / `fetch_url` / `native_file_id`); the platform workspace files (upload of a reference
document, of a describe report and of a bench export, deletion of the previous file) go through
`_product-call {service: platform}`. `_product-call` signs with the same credential as the app import of
that product, never with a personal token.

App answer shapes observed on sandbox: Storage methods answer `{structuredData: <product body>}`
(lists: `structuredData.data`, `structuredData.has_more`); Agents methods answer the product body as is,
or `{error: true, status, message}` on an HTTP error. A failed read is reported as `failed`
(`AgentReadFailed`), never taken for an absent resource.

## 7. Live configuration over git (overlay)

The delivered configuration (`index.yml`, versioned in git) is never rewritten by the console. Local
additions made from the console live in `overlay:<list>:<key>` rows (status open, cleared when a save empties
it, integrated after `markIntegrated`; never deleted): `{list, key, added: [...], removed: [...], by, at, baseHash, param}`
where `baseHash` is the hash of the delivered entry when the overlay was first written. `_sources-effective`
applies `removed` then `added` on the delivered entry. A workspace push from git keeps the overlay (state
survives a push). The console shows « À reporter dans git » while an overlay exists, exports the YAML of
the entry with the overlay folded in, and `markIntegrated` drops it once the delivered list contains the
additions and no longer contains the removals (`NotIntegrated {missing, stillDelivered}`). When the delivered entry changed since `baseHash`, the console says so and still applies the
overlay (additions of items already delivered are ignored).

## 8. Security

- `security.yml`: role `control` granted only through a workspace API key (`auth: {apiKey: {}}`), never
  through `prismeai` auth; editors manage automations, files, pages.
- Every endpoint used by the console is guarded by `_guard-control`; admin-only actions are refused with
  403 `AdminRequired` by `consoleAction` and by the automation itself.
- The page holds no secret: it calls the workspace webhooks with the Studio session (cookie + CSRF
  header) so `user.role` is the real caller's role.
- Journal arguments are summaries; never log a secret, a token or a full document.

## 9. Tests

Run it with the MCP `execute_automation` as `tests%2Fengine` (a slug containing `/` must be URL-encoded
there).

`automations/tests/engine.yml` (`slug: tests/engine`, endpoint): runs `syncAll {dryRun: true}`,
`describeInstance {includeInstructions: false}`, `statusReport`, `consoleState`, `consoleAction
{action: describeInstance}` and checks their shapes against this file. It writes nothing.
