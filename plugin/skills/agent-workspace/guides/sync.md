# Sync: configuration as code

The workspace is the source of truth for the agent: prompt, model, limits, tools, skills, sub agents,
knowledge bases and reference documents are declared in `index.yml` and applied by one idempotent
entry point, `syncAll`. The Agent Factory UI stays available for quick tests, but anything durable is
folded back into the workspace. Contract: `templates/workspace/DESIGN.md` §2–§4.

## 1. Start from the template

Copy `templates/workspace/` to `workspaces/<slug>/` and replace the placeholders listed at the top of
`index.yml` (slug, names, model, keys, collection name). Then edit only the **content** files
(DESIGN §1.1), never the engine:

1. Per agent: its entry in `config.agents[]` (tools, skills, sub agents) and its prompt text in
   `_content-prompts`, under the agent key (`automations/content/prompts.yml`).
2. Per reference document (glossary, codes, mappings): an entry in `config.documents[]` and its text in
   `_content-documents` under the document key, one entry per line so an anchored exact search
   returns only that entry.
3. Test questions in `_content-agent-tests` (empty in git when they are client questions), custom
   source types in `_content-sources` (`guides/ingestion.md` § 3).

## 2. The loop: dry run, read, apply

```text
syncAll {dryRun: true}   → read actions[].plan and warnings
syncAll {}               → apply (only what the dry run showed)
describeInstance         → confirm in-sync
```

- **One code path.** The dry run and the write share `_ensure-*`; the plan you read is what will run.
- **Order.** Knowledge bases → documents → sub agents → agents → sources (`refreshSource`, unless
  `skipIngest`).
- **Idempotent.** A second run changes nothing (`unchanged`, `exists`, documents `unchanged` while
  their text hash is the same).
- **Scope.** `only: [kbs | documents | agents | sources]`, `agents: [<key>]`; optional agents (variants,
  comparisons) only when named or with `allAgents`, never deleted silently.

## 3. Drift guard

After each apply the engine stores a fingerprint of the agent's managed fields (`res:agentHash:<key>`,
secrets hashed). On the next sync:

| Live agent equals… | Meaning | Action |
|---|---|---|
| the expected config | nothing to do | `unchanged` |
| the stored fingerprint | the workspace changed | `update` |
| neither | someone edited the agent by hand | `drift`: left untouched, plan attached |

`force: true` (admin-only) overwrites a drifted agent and journals it. Before forcing, run
`describeInstance`, fold what matters back into the workspace, and sync without force.

## 4. Adopting an agent that already exists

Before the first sync on an environment where the agent was set up by hand:

1. `describeInstance {includeInstructions: true, upload: true}`: a redacted export of the live agent
   and the diff against the workspace.
2. Fold the live prompt and settings that matter into `_content-prompts` and `index.yml`.
3. `syncAll {dryRun: true}` until the plan only shows intended changes, then apply.

## 5. Owned and bound resources

- **Owned**: created by the engine (`res:kb:<key>` status `created`); may be deleted by a purge.
- **Bound**: an existing base given by id (`existingIdFrom: <name>` + config value
  `<name>: '{{secret.<name>}}'`); never deleted, never renamed.
- **Unbound**: `create: false` and no id; tools that need it are left out of the agent and reported
  (`skippedTools`), never sent with a null id.

Resources are resolved by bound id, then cached id, then exact name.

## 6. Agent settings to set deliberately

`agentDefaults` and each agent may set `model`, `temperature`, `visibility` (never public by default),
`profile` (creation only) and `limits` (`max_turns`, `tool_call_budget`, `token_budget`, `max_tokens`).
Production agents that search long documents usually need higher turn and tool budgets than the
platform defaults: empty answers are often a cut search, not a missing source. Working memory goes in a
`raw` system tool. Lowering a limit or changing the model is flagged « À vérifier » in the plan.

## 7. App methods and gaps

The engine calls products through the app imports `Agents`, `Storage`, `Evaluation`, the `state`
collection (`Collection`) and `Custom Code`. An operation an app does not expose goes through
`_product-call`, the only automation allowed to `fetch`, signed with the same credential as the app of
that product (never a personal token).

| Operation | Route | Why direct |
|---|---|---|
| Upload a workspace file (reference document, describe report, bench export) | `POST /workspaces/{id}/files` (multipart) | No app covers platform files |
| Delete the previous workspace file | `DELETE /workspaces/{id}/files/{fileId}` | Same |

Platform calls are signed with the workspace API key of the security role `files`
(`prismeaiApiKey: {name: files}`). Check `reference/` before adding a gap; record every new one here.

## 8. Identity and known limits

- **No secret by default.** With `config: {}` in their imports, the Agents, Storage and Evaluation apps
  act with the identity of whoever runs the automation (verified on sandbox: the agent is created and
  published as the caller). Do not declare an `apiKey` that points to a secret nobody sets: the Agents
  app always sends `x-prismeai-api-key: {{config.apiKey}}`, and an unset secret makes every call
  answer 401 (the engine then reports `AgentReadFailed`, never an agent to create).
- **Agent Factory adds a default `memory` tool** to every new agent and ignores `max_tokens` at creation.
  The engine applies the full body right after creating the agent, and the template agent declares
  the memory tool explicitly: drop it from the manifest only if the agent must not remember.
- **Runs without a user** (the `pollBenchmark` schedule) have no identity to forward: add an
  organization API key as a secret only if the bench must advance unattended; otherwise it advances
  from the console (`advanceBenchmark`) or any user-triggered run.
- **The Storage app wraps every answer in `structuredData`** (`{structuredData: {id, …}}`, lists in
  `structuredData.data`); read product fields there.
- **Storage authenticates as the caller.** Bases created by one user's sync are owned by that user;
  another user's sync finds them through the cached id only if they can read them, otherwise it may
  create a duplicate. Decide up front who runs the sync on each environment (an org-level service
  account) and who must see the bases in the Knowledge UI.
- **Schedule runs have no user, and Storage refuses them** (401 « Authentication required », seen on
  sandbox). So `pumpIngest` does nothing on its schedule unless `config.ingestion.unattended` is true;
  the queue moves on with `ingest.pump` events, which keep the user of the run that started them, and
  with an open console, which sends `pumpIngest` every minute while items wait. A Storage identity
  refusal (401 / 403) puts the item in `error` at once (stage `identity`), without burning retries.
  Agent Evaluations accepts schedule runs, so `pollBenchmark` still advances a bench unattended, at the
  15-minute pace.
- **Webhook time limit.** A request is cut at ~60 s while the run goes on; anything longer (ingestion,
  bench) advances by events and schedules, never inside one webhook call.
- **Schedules** run at most every 15 minutes, whatever their cron. An open console sends the ticks
  (`advanceBenchmark`, `pumpIngest`) every minute; leave it open on the Bench or Ingestion page to go at
  the documented pace.
- **Runtime depth.** Successive automation calls stop at 30 levels; event chains carry a hop counter.

## 9. Upgrading the engine

`config.templateVersion` says which template version a workspace runs. To take a newer one:

1. Read what changed between the two versions of `templates/workspace/` (the skill's git history).
2. Copy every **engine** file of the new template over the workspace (DESIGN §1.1): all of
   `automations/` except `automations/content/`, plus `imports/` and `security.yml`. Never copy
   `index.yml` or `automations/content/`; merge new manifest keys by hand from the template's
   `index.yml`, then set `templateVersion`.
3. Push, run `syncAll {dryRun: true}` and `tests/engine`: the plan must show only the changes the new
   version brings. Then apply.

A workspace whose engine files were edited by hand cannot be upgraded safely: move those edits into
content files, or propose them as a template change.

