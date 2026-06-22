---
name: agent-builder
description: Build, edit, test and deploy a Prisme.ai Agent Factory agent whose definition is git-versioned inside a workspace. The prompt lives in AGENT.md; model/profile/capabilities/app+mcp/tests live in agent.yml. Use when the user wants to scaffold a new agent, change an agent's prompt or capabilities, list/search the platform's available capabilities, install and wire an App+MCP connector as an agent tool, manage the test battery (list/add/edit tests, run the suite), choose or change the deployment organization, or deploy the agent (create/update + publish + push the workspace) to sandbox or prod. Triggers include "crée un agent", "modifie le prompt de l'agent", "ajoute une capacité", "quelles capacités sont dispo", "installe l'app+mcp X", "ajoute/lance les tests", "déploie dans l'organisation X", "change d'organisation", "déploie l'agent", "/agent-builder ...".
---

# Agent Builder

Assist the user in building and maintaining a single **Agent Factory** agent whose
entire definition is stored in a git-versioned workspace folder, so it can be
diffed, reviewed and rolled back like code.

This skill is the action-oriented sibling of `agent-workspace`. Where
`agent-workspace` bootstraps a one-shot RAG+evaluation workspace, **agent-builder**
gives the user durable CRUD over one agent: prompt, capabilities, App+MCP tools,
tests, and multi-environment deployment.

## Source of truth (git-versioned)

Everything the agent IS lives in two files inside the workspace folder:

| File | Holds |
|------|-------|
| `AGENT.md` | The agent's system prompt / instructions (plain Markdown, clean diffs). |
| `agent.yml` | The manifest: `name`, `model`, `temperature`, `profile`, `visibility`, `capabilities[]`, `appMcp[]`, `tests[]`, and `deployedIds` (written by the skill). |

`deploy` is **declarative**: the skill reads `AGENT.md` + `agent.yml` and makes the
remote agent match them exactly. The user edits files; the skill reconciles.

## Workspace layout

Agent workspaces live under `workspaces/<slug>/` in the prismeai-workspaces repo
(the directory that contains `workspaces/` and `docs/`). Detect that root before
doing anything; if the CWD is the parent "Prisme.ai Projects" dir, the repo root is
`prismeai-workspaces/`.

```text
workspaces/<slug>/
├── AGENT.md                 # prompt (source of truth)
├── agent.yml                # manifest (source of truth)
├── index.yml                # workspace config + secret schema
├── security.yml
├── imports/
│   ├── Agents.yml           # Agents app (agent lifecycle)
│   ├── Custom Code.yml      # evalTest() — robust answer extraction + assertion
│   └── <connector>.yml      # one per installed App+MCP connector
└── automations/
    ├── deploy.yml           # create-or-update + publish the agent
    ├── runTests.yml         # inline test runner (sendMessage + Custom Code assert)
    └── whoAmI.yml           # resolve the agent's org (getAgent.orgSlug)
```

Scaffold templates for every file live in `templates/` next to this SKILL.md.

## Non-negotiables

- Drive the agent lifecycle **only through the `Agents` app** (`createAgent`,
  `updateAgent`, `getAgent`, `addTool`, `removeTool`, `publishAgent`, `sendMessage`,
  `deleteAgent`). Never `fetch` Agent Factory directly.
- `AGENT.md` and `agent.yml` are the source of truth. Never mutate the remote agent
  in a way that drifts from them — always update the files, then `deploy`.
- The `Agents` app authenticates with a **Governance org API key (`iak_...`)** set as
  the workspace secret `agentFactoryApiKey` on each target environment. Apps the user
  installs use their own credentials (`x-prismeai-api-key`), not this key.
- Connectors are **sandbox-first**. Default every push / deploy / id to `sandbox`
  unless the user explicitly asks for `prod`.
- The deployment **organization** = the org of the caller that creates the agent, and
  the **creator becomes the owner**. Cross-org: the user must be a **member** of the
  target org; create via `call_api` with **`apiKey` (org key) + `withUserBearer: true`**
  so the human owns it and the full lifecycle works. Never key-only for a managed agent
  (creates an unmanageable key-owned orphan). See Operation 6b. Store
  `deployedIds.<env>.org`; propose only orgs the user is a **member** of
  (`call_api /me` → `organizations`), never the full `/orgs` platform list.
- Confirm the spec with the user before creating files (scaffold) or before the first
  remote `deploy`. Subsequent edits + redeploys need no re-confirmation unless the
  user is changing environment.
- Run `validate_automation` on `deploy.yml` and `runTests.yml` after any change to
  them, and after scaffolding a new workspace.
- Never `push_workspace` a `pages/<name>/` React subfolder (none here by default; if
  one is ever added, exclude it — see the project-wide rule).

## The manifest in detail (`agent.yml`)

```yaml
name: <Display name>
slug: <agent-slug>
model: gpt-4o-mini            # llm-gateway model id — ASK the user, do not assume
temperature: 0.2
profile: agent_light          # simple|workflow|agent_light|agent_full|orchestrator
visibility: restricted        # publish visibility: restricted|public|private
# --- Per-agent budget overrides (optional; omit to inherit the profile defaults) ---
token_budget: null            # per-task token budget; agent_light default = 20000
tool_call_budget: null        # max tool calls per task; agent_light default = 15
max_turns: null               # max ReAct turns per task; agent_light default = 10
capabilities: []              # tools other than App+MCP (see Tool types below)
appMcp: []                    # installed App+MCP connectors wired as mcp tools
tests: []                     # inline test battery
knownOrgs: []                 # orgs you work with, e.g. { slug, name } — for reselection
deployedIds:                  # written by the skill, do not hand-edit
  sandbox: { workspaceId: null, agentId: null, org: null }  # org = { slug, name }
  prod:    { workspaceId: null, agentId: null, org: null }
```

**Profiles** gate capability tiers (see `docs/agent-factory/overview.md`):
`simple` (no tools) < `workflow` < `agent_light` (ReAct loop, tools) < `agent_full`
(planning, reflection, long-term memory, HITL) < `orchestrator` (+ delegation).
An agent that uses tools/MCP needs **`agent_light` or higher**.

**Native system tools** (`todo_write`, `knowledge_search`, `planning_create_plan`,
`memory_*`, `human_*`, `agent_delegate`, …) are injected automatically by the
profile. Never list them in `capabilities`.

## Per-agent budget (`token_budget` / `tool_call_budget` / `max_turns`)

Each profile caps every task by a **token budget**, a **tool-call budget**, and a **max
turns** (agent-factory `_init-defaults` reads the agent record first, then falls back to
`config.profiles[<profile>].limits`). The `agent_light` defaults are **`token_budget: 20000`,
`tool_calls: 15`, `max_turns: 10`** — low for tool-heavy agents (big MCP tool schemas +
verbose tool results blow 20000 fast). The symptom is a truncated reply: *"Réponse
incomplète — le traitement a été interrompu … limite de budget."* and `usage.tool_calls`/
`tokens` well under what the flow needed.

Override **per agent** (don't touch the shared `agent_light` profile — it's a protected
`one-product` core workspace and affects every agent): set `token_budget` /
`tool_call_budget` / `max_turns` in `agent.yml`. `_init-defaults` uses the agent's value
when present.

⚠️ **Deploy gotcha — these do NOT survive a normal `deploy`.** The `Agents` app's
`createAgent`/`updateAgent` does **not** carry `token_budget`/`tool_call_budget`/`max_turns`
(they're outside its schema), so an Agents-app deploy leaves them unset → the agent reverts
to the profile default (e.g. 20000). **Set them with a direct PATCH** to the agent record,
NOT through the `Agents` app:

```
call_api { path: "/workspaces/slug:agent-factory/webhooks/v1/agents/<agentId>", method: "PATCH",
           apiKey: "<iak_org_key>", withUserBearer: true,
           body: { token_budget, tool_call_budget, max_turns } }
```

So after every `deploy` that changes the agent, re-PATCH the budget (or PATCH it standalone).
`deploy.yml` forwards these args too, but until the `Agents` app supports them the direct
PATCH is authoritative. Read them back with `getAgent` (the record exposes the three fields).

## Tool types

`capabilities[]` and `appMcp[].tool` entries map to Agent Factory tools:

| `type` | Shape passed to `addTool` / `tools[]` |
|--------|----------------------------------------|
| `function` | `{ type, name, description, extra: { url, parameters } }` (parameters = JSON Schema) |
| `mcp` | `{ type, name, description, server }` (server = MCP endpoint URL) |
| `file_search` | `{ type, name, description }` (RAG over a Storage vector store) |
| `skill` | `{ type, name, description, ... }` (a Prisme.ai automation as a tool) |
| `guardrail` | `{ type, name, description }` (inline safety check, not LLM-chosen) |

On `deploy`, the skill builds the agent's `tools` array = `capabilities[]` +
one `mcp` tool per `appMcp[]` entry (with `server` resolved per environment).

## Available models (per org)

An agent's `model` **must be in the allowed-model list of the org the agent lives in**,
otherwise the agent fails at runtime (the org's `quota_policy` is typically
`hard_block`). The allowed list is **per-org** and is the source of truth for what you
may offer:

```
call_api { path: "/orgs/<orgSlug>", pick: ["slug","name","settings"], environment }
→ data.settings.llm.allowed_models   (+ default_completion_model / default_embedding_model)
```

- Whenever you ask the user to pick a `model` — at **scaffold (Op 1)** and at **edit
  (Op 3 / changing the model)** — first fetch the **target org's** `allowed_models` and
  present only those. Never propose a model that isn't in the list.
- **Filter out embedding models** for a chat/completion agent — drop entries whose id
  contains `embed` / `embedding` (e.g. `text-embedding-ada-002`,
  `amazon.titan-embed-image-v1`). Offer the completion models only.
- If the org has a `default_completion_model`, surface it as the recommended default.
- For a cross-org agent, the relevant org is the **deploy target** (`deployedIds.<env>.org`),
  not the caller's org — they can differ, and their model lists differ too.
- On `deploy`, the chosen `model` is sent in the create/update body; an out-of-list
  model surfaces as a model/quota error, not as a generic failure.

---

# Operations

The user invokes operations conversationally or as `/agent-builder <verb> ...`.
Pick the matching section. Always end by reporting what changed and, when relevant,
the agent URL.

## 1. Scaffold a new agent

When the user asks to create a new agent:

1. Gather the spec: display name, slug (kebab-case), a first draft of the prompt,
   `model` (**fetch the target org's allowed models and let the user pick — never
   assume**; see "Available models" below), `profile` (default `agent_light`), and any
   initial capabilities/tests.
2. Present a concise plan (slug, model, profile, capabilities, tests, target env)
   and **ask for confirmation**.
3. Copy `templates/` into `workspaces/<slug>/`, filling placeholders:
   - `index.yml`: `name`, `slug`.
   - `AGENT.md`: the prompt draft.
   - `agent.yml`: `name`, `slug`, `model`, `temperature`, `profile`, `visibility`,
     and any seed `capabilities`/`tests`.
   - keep `imports/Agents.yml`, `automations/deploy.yml`, `automations/runTests.yml`
     as-is.
4. `validate_automation` on the two automations.
5. Offer to `deploy` (Operation 7). Do not deploy without the user's go-ahead.

## 2. Edit the prompt

- Edit `workspaces/<slug>/AGENT.md` directly (it is plain Markdown).
- Summarize the change. Offer to `deploy` so it takes effect.

## 3. Manage capabilities (capability catalog)

The **capability catalog** is the source of truth for ready-to-add capabilities. It is
the `capabilities` workspace (app `MCPServers`), exposed as a webhook API. Query it with
`call_api` (the catalog is per-env; built-in entries are visible to everyone, org-custom
entries are scoped to the caller's org — so query with the **target org's** context when
it matters, i.e. `apiKey` + `withUserBearer` for a cross-org agent).

### List / search the catalog

```
call_api { path: "/workspaces/slug:capabilities/webhooks/v1/servers",
           query: { type, category, search, page, limit },
           pick: ["id","name","type","category","description"], environment }
→ { items: [...], total, page, limit }   # paginate: total may exceed limit (20)
```

Entry `type` is one of `mcp`, `guardrail`, `file_search`, `function`, `skill`, `hook`,
`memory`. Present results grouped by type with `name` + one-line `description`. Filter
with `search`/`type`/`category` for "list the X capabilities". Real examples seen:
`Sharepoint MCP`, `Powerpoint MCP`, `Brave Search`, `DataGalaxy`, `Excel`, `Outlook`,
`ServiceNow` (mcp); `Send E-mail`, `Generate PPTX from template` (function); the 6
guardrails (`injection-detect`, `toxicity-check`, `pii-detect`, `hallucination-check`,
`topic-guard`, `action-approval`).

> **Native system tools** (`knowledge_search`, planning, memory, delegation, …) are NOT
> in the catalog — they're injected by the profile. Don't add them; just mention them.

### "Add the capability X" — read its config, then wire it

1. Resolve the entry id from the user's phrasing (list/search the catalog, match on
   name). Fetch full details:
   ```
   call_api { path: ".../v1/servers/<entry_id>",
              pick: ["id","name","type","config_schema","auth","tools","agent_tools","server"], environment }
   ```
2. **`config_schema`** (JSON Schema) tells you exactly how to configure it. Use its
   `default`s; ask the user only for `required` fields that have no default. Per type:
   - `mcp` → `{ name, server (SSE/WS URL, usually has a default), headers?, scope? }`
     → agent tool `{ type: mcp, name, server }` (+ headers/scope if given).
   - `function` → `{ url, parameters (JSON Schema) }` → tool `{ type: function, name,
     description, extra: { url, parameters } }`.
   - `file_search` → knowledge-base config → tool `{ type: file_search, name, description }`.
   - `guardrail` → tool `{ type: guardrail, name, description }` (+ `guardrail_type`).
3. **`auth`**: if present (e.g. `{ type: oauth2, connect_url, status_url, disconnect_url,
   scopes }`), the capability needs a **per-user OAuth connection** — adding the tool is
   not enough. Give the user the `connect_url` to connect their account (browser flow),
   and note they can check via `status_url`. (Pure config-key capabilities have no `auth`
   block — just fill `config_schema`.)
4. Add the resulting tool to `agent.yml` `capabilities[]` (or `appMcp[]` for an MCP with
   a connector you also install — Operation 4). Then `deploy` (declarative — the tool
   list is rebuilt from the manifest).

### Remove a capability

Delete its entry from `agent.yml` `capabilities[]`/`appMcp[]`, then `deploy` (the agent's
tools are replaced with the manifest set).

## 4. Install + configure an App+MCP connector

Goal: install a connector into the agent's workspace, configure its credentials, and
wire it to the agent as an `mcp` tool.

1. `list_apps` (and/or `get_app`) to find the connector and read its config schema.
   For connector specifics, defer to the `app-mcp-implement` / `app-mcp-test` skills.
2. Ensure the workspace exists on the **target env** (deploy at least once, Op 7, so
   `deployedIds.<env>.workspaceId` is set).
3. `install_app_instance` into `deployedIds.<env>.workspaceId` with `appSlug`, a local
   `slug`, and the `config` (credentials/options). Mirror the resulting import locally
   as `imports/<slug>.yml` so it stays git-versioned.
4. Configure / verify credentials with `update_app_instance_config` if needed. Smoke
   the connector with the `app-mcp-test` skill when the user wants confidence.
5. Add an `appMcp[]` entry to `agent.yml`: `appSlug`, `slug`, `config`, and a `tool`
   block (`type: mcp`, `name`, `description`). **Do not hardcode `server`** — it
   embeds the per-env workspaceId.
6. `deploy` (Op 7). At deploy time the skill resolves each `appMcp` tool's `server`
   from the installed instance config (`get_app_instance_config` → `mcpEndpoint`) on
   the target env, so the URL is always correct for that environment. If that field
   comes back as an unresolved `{{...}}` template (connector-dependent), call the
   connector's own config/getConfig automation to get the concrete endpoint instead
   of wiring a literal template as the tool `server`.

## 5. Manage tests

Tests are the git-versioned source in `agent.yml` `tests[]`. Each test:

```yaml
- name: <short label>
  input: <message sent to the agent>
  expected: <substring/regex (contains) or exact string (equals)>
  mode: contains    # contains (default, regex match) | equals (case-insensitive equality)
```

- **List**: read and print `tests[]`.
- **Add / edit / remove**: edit `agent.yml` `tests[]`.
- No remote sync needed — tests run live against the deployed agent (Operation 6).

## 6. Run the test battery

1. Ensure the agent is deployed on the target env (`deployedIds.<env>.agentId` set);
   if the manifest changed since last deploy, `deploy` first so tests hit current
   behavior.
2. `execute_automation` `runTests` on `deployedIds.<env>.workspaceId` with
   `{ agentId: <deployedIds.<env>.agentId>, tests: <agent.yml tests[]> }`.
3. `runTests` sends each `input` via `Agents.sendMessage`, then calls the Custom Code
   function via the dispatcher `Custom Code.run` (`function: evalTest`, `parameters: {…}`)
   — NOT `Custom Code.evalTest` directly. The current Custom Code app exposes functions
   ONLY through `.run`; the per-function-as-automation form raises
   `ObjectNotFoundError: Custom Code.evalTest` at runtime (this is a hard error, not a
   reload lag — see below). `evalTest` extracts the answer from
   `response.task.output.messages[<last>].parts[].text` (plural `messages` array; older
   shape `output.message.parts` handled as fallback) and asserts per `mode` (in JS, so
   arbitrary LLM output can't crash the run).
4. Report the suite result: `passed/total`, and per-test `name`, `answer`, `passed`.
   For failures, show expected vs. actual and offer to refine the prompt or the test.

If `runTests` errors with `Custom Code.evalTest` "not found", it's almost always the
call-style bug above (use `Custom Code.run` with `function: evalTest`), NOT a reload lag
— a `update_app_instance_config` reload will NOT fix it. Only if you are already using
`Custom Code.run` and still get "not found" right after the first push, force a reload
(`update_app_instance_config` on the `Custom Code` instance with its full config).

## 6b. Choose / change the deployment organization

**The agent's org = the org of the caller that creates it** (fixed at create from the
caller's session org; `body.orgSlug` is ignored — verified; `publish` keeps it). So
"deploy to org X" = "authenticate the create call AS a member of org X, with org X
active". And **whoever's identity creates the agent becomes its `owner_id`** — owners get
full per-agent access; non-owners are gated by per-agent IAM.

**THE VALIDATED MODEL (cross-org) — be a member, then create with Bearer + org key:**
the user must be a **member of the target org** (any role that grants agent management;
Owner is simplest). Then call `call_api` with **both** `apiKey: <iak_target_org_key>`
**and** `withUserBearer: true`. The key selects the org context; the Bearer supplies the
**human identity**, so the gateway passes the membership check and sets `owner_id` to the
**user** (not the key). Verified end-to-end on cd76: create ✓, publish ✓, read ✓,
PATCH ✓ — full lifecycle, because the human is the owner.

```
# create (owner = the user, org = target):
call_api { path: "/workspaces/slug:agent-factory/webhooks/v1/agents", method: "POST",
           apiKey: "<iak_org_key>", withUserBearer: true,
           body: { name, instructions, model, temperature, profile, tools } }
# then publish / read / patch / messages-send — all with apiKey + withUserBearer:
call_api { path: ".../v1/agents/<id>/publish",          method: "POST",  apiKey, withUserBearer, body: { visibility } }
call_api { path: ".../v1/agents/<id>",                  method: "PATCH", apiKey, withUserBearer, body: { model, instructions, tools } }
call_api { path: ".../v1/agents/<id>/messages/send",    method: "POST",  apiKey, withUserBearer, body: { message: {...} } }
```

**Do NOT use key-only (`apiKey` without `withUserBearer`) to create a cross-org agent:**
it works for create+publish but sets `owner_id` to the **key's** identity, producing a
**key-owned orphan** that nobody (not even that key) can later read/update/delete —
per-agent ops then 403 `missing permission 'agents:read'/'agents:write'` no matter the
key's permissions or cache. (Hard-learned: an anonymous-key create on cd76 had to be
abandoned + recreated with Bearer+key once the user joined the org.) Key-only is only
acceptable for throwaway one-shots you never need to manage.

Dead ends (verified, don't retry): `body.orgSlug` (ignored); `PUT /user/active-org`
(forbidden with `at:` token, "malformed" as cookie); `create_workspace` org targeting
(no org field — a workspace is not org-bound, only the agent is); Bearer **without** being
a member of the target org (`401 not a member of org`).

Org key permissions: provision the `iak_` key with `agent-factory:*` plus the bare
`agents:read` / `agents:write` / `agents:delete` (and the message/execute action). With
the Bearer+member+owner model these mostly matter for non-owner/admin paths, but grant
them for robustness. Permission/membership changes are cached (~60s api-key + a longer
`agent_perms` TTL) — allow propagation before retrying.

Listing orgs (to choose the target): **only propose orgs the user is actually a member
of** — `call_api { path: "/me", pick: ["organizations","orgSlugs"] }` →
`data.organizations` (each `{slug,name,roleSlug}`). Deploying requires membership (the
Bearer+key model fails `401 not a member` otherwise), so do **not** offer the full
platform list from `/orgs` (a superadmin sees every org there, almost none deployable).
Use `/orgs` only if the user explicitly wants to join/target a new org first.

Resolution flow (ask once, store, reuse):

1. If `deployedIds.<env>.org` is set, use it without asking unless the user changes org.
2. Otherwise list the user's **memberships** (`/me` → `organizations`), ask which, and
   obtain that org's `iak_` key. Store `{slug,name}` in `knownOrgs`; the key is
   user-provided (not committed). (If the user wants an org they're not in yet, they must
   join it first — deploy needs membership.)
3. Create + publish (+ later edits/tests) via `call_api` with `apiKey` **and**
   `withUserBearer: true`. Read the agent back (same auth) to confirm `orgSlug` and that
   `owner_id` is the user. Write `deployedIds.<env>.org` and `deployedIds.<env>.agentId`.
   The answer text for tests is at `task.output.messages[<last>].parts[].text` (note the
   **plural `messages` array**).

## 7. Deploy the agent

Deploy makes the remote agent match the local files on the chosen environment and
publishes it so the user can test immediately. It also pushes the workspace so any
installed App+MCP connectors run.

1. Confirm the **environment** (`sandbox` default; `prod` only on explicit request)
   and resolve the **organization** (Operation 6b) — ask only if
   `deployedIds.<env>.org` is unset or the user wants to change it.
2. Read `AGENT.md` (→ `instructions`) and `agent.yml`. Build the `tools` array:
   `capabilities[]` + one resolved `mcp` tool per `appMcp[]` entry.
3. Ensure the workspace exists remotely on that env:
   - First time: `create_workspace` → capture the id into
     `deployedIds.<env>.workspaceId`.
   - Then `push_workspace` (workspace id + local folder) to upload the DSUL
     (automations + imports). `push_workspace` does NOT push secret *values*, so
     ensure the `agentFactoryApiKey` secret (the `iak_...` org key) is set on the env
     out-of-band first — otherwise the Agents app calls fail with a `401` that
     `deploy` surfaces as `error`.
4. For each `appMcp` entry, resolve its `server` via `get_app_instance_config` on the
   target env (`mcpEndpoint`).
5. `execute_automation` `deploy` on the env workspace with:
   `{ name, instructions, model, temperature, profile, tools, visibility,
      agentId: <deployedIds.<env>.agentId or empty> }`.
   - empty `agentId` → `createAgent`; otherwise → `updateAgent`. Then `publishAgent`.
6. Capture the returned `id` and write it to `deployedIds.<env>.agentId` in
   `agent.yml` (git-versioned). The Agents app surfaces failures as a structured
   `{ error: true, status, message }` (e.g. `401` when `agentFactoryApiKey` is unset
   or wrong), which `deploy.yml` returns as a non-empty `error` — if present, surface
   it and stop (do not write an id). Then run `whoAmI` with the new id to confirm the
   org and write `deployedIds.<env>.org = { slug, name }` (reconcile `knownOrgs`).
6b. **If `agent.yml` sets any budget override** (`token_budget`/`tool_call_budget`/
   `max_turns`), **PATCH them onto the agent now** — the Agents-app deploy did NOT persist
   them (see "Per-agent budget"): `call_api PATCH /workspaces/slug:agent-factory/webhooks/
   v1/agents/<agentId>` (apiKey + withUserBearer) `{ token_budget, tool_call_budget,
   max_turns }`. Re-do this after EVERY deploy that re-runs createAgent/updateAgent.
7. Give the user the SecureChat URL for that env to test the agent (the chat
   frontend, e.g. `https://<env-host>/c/<agentId>`). Confirm the exact host with the
   user rather than guessing, so you never hand over a dead link.

---

# Reference

## Agents app methods (used by the templates)

- `Agents.createAgent`: `{ name, instructions, model, temperature, tools[], extra }`
  → `{ id, name, ... }`.
- `Agents.updateAgent`: `{ agent_id, updates: { name, instructions, model,
  temperature, profile, tools } }`.
- `Agents.getAgent`: `{ agent_id }` → full config incl. `tools[]`.
- `Agents.addTool` / `Agents.removeTool`: single-tool CRUD (declarative `deploy`
  rebuilds the whole list, so prefer editing the manifest + redeploy).
- `Agents.publishAgent`: `{ agent_id, body: { visibility, category, tags } }`
  → `{ status: "published" }`.
- `Agents.sendMessage`: `{ agent_id, message: { message_id, role: user,
  parts: [{ type: text, text }] } }` → `{ task: { id, contextId,
  output: { message: { parts: [{ text }] } } } }`.
- `Agents.deleteAgent`: `{ agent_id }`.

## Multi-environment

`deployedIds` stores **both** the workspaceId and the agentId per environment, because
each is distinct between sandbox and prod. The skill never reuses a sandbox id for prod.

## Validation & guardrails

- `validate_automation` is authoritative — trust it over existing patterns.
- After scaffolding, guardrail-scan the new workspace for stray `fetch:` to Agent
  Factory or hardcoded ids; there should be none (the templates use the `Agents` app).
- DSUL gotchas that bit these templates: string-literal compares use
  `'{{x}} = "value"'`; var-to-var compares use `'{{a}} = {{b}}'` (no quotes);
  `matches` is regex and condition-level only; `lower()` runs inside `{% %}`;
  endpoint automations read top-level args when called via `execute_automation`.

## Response shape

When done, report: files changed; capabilities/tests touched; validation status;
deploy target + agent id; test-suite result if run; and the agent URL to try it.
