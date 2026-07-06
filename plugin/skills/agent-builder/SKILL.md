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

Agent workspaces live under `agents/<slug>/` in the prismeai-workspaces repo —
a **top-level sibling of `workspaces/` and `pages/`** dedicated to `/agent-builder`
agents (so Agent Factory agents are not mixed in with the connector/app workspaces).
Detect the repo root before doing anything (it is the directory that contains
`workspaces/`, `pages/`, `agents/` and `docs/`); if the CWD is the parent
"Prisme.ai Projects" dir, the repo root is `prismeai-workspaces/`.

> Migrated 2026-06-26: agent workspaces moved out of `workspaces/<slug>/` into the
> new top-level `agents/<slug>/`. Discover existing agents under `agents/`; when an
> older agent is still found under `workspaces/<slug>/`, treat that as legacy and
> offer to move it to `agents/<slug>/`.

```text
agents/<slug>/
├── AGENT.md                 # prompt (source of truth)
├── agent.yml                # manifest (source of truth)
├── index.yml                # workspace config + secret schema
├── security.yml
├── imports/
│   ├── Agents.yml           # Agents app (used by runTests for sendMessage)
│   ├── Custom Code.yml      # evalTest() — robust answer extraction + assertion
│   └── <connector>.yml      # one per installed App+MCP connector
└── automations/             # FLAT — every file at this level (see slug=path rule below)
    ├── deploy.yml           # slug deploy · name "Deploy this agent" — run AS THE USER
    ├── runTests.yml         # slug runTests · name "Run the test battery"
    ├── _afCall.yml          # slug _afCall · name "utils/…" · agent-factory webhook (asUser | org-key)
    └── whoAmI.yml           # slug whoAmI · name "utils/…" (legacy) — deploy now returns org
```

⚠️ **`push_workspace` keys each automation by its FILE PATH relative to `automations/`,
and SILENTLY DROPS any file whose `slug:` ≠ that path.** So `automations/utils/_afCall.yml`
(slug `_afCall`) is never imported — the deploy then 404s with "Automation not found:
_afCall", and a webhook at `/webhooks/getContext` 404s "no matching trigger". Keep helper
**files flat at `automations/<slug>.yml`** (slug = filename). The studio "utils" **folder is
purely cosmetic via the `name:` prefix** (`name: utils/Agent Factory API call`) — it groups
the UI without touching the slug. A nested file is only OK if its slug includes the folder
(e.g. `automations/v1/status.yml` with `slug: v1/status`). Verified on cd76 2026-06-26.

Scaffold templates for every file live in `templates/` next to this SKILL.md.

## Non-negotiables

- **Deployment goes through the AgentBuilderSync app** — a single central dashboard
  (one per environment), NOT a per-agent SPA or playground run. The agent workspace only
  needs its definition in `config.value.agent` (compiled from `AGENT.md` + `agent.yml` at
  push time) **plus the label `agent-builder`** to be discoverable. The app lists the
  labeled workspaces, reads each definition, lets the user pick a model from the active
  org's allowed models, and deploys the selected agent **as the user** (so it lands in the
  **active session org**, **human as owner**). The skill does NOT create agents via
  `call_api`, does NOT pick an org, and does NOT ship a deploy SPA per agent. Give the
  user the app URL for the env (see "AgentBuilderSync app" below). (Test sending still
  uses the `Agents` app inside `runTests`; never `fetch` Agent Factory directly.)
- `AGENT.md` and `agent.yml` are the source of truth. Never mutate the remote agent
  in a way that drifts from them — always update the files, then `deploy`.
- Deploy needs **no Governance org key** — it runs as the user. The
  `agentFactoryApiKey` secret (a `iak_...` org key) is **optional/legacy**, used only by
  the `whoAmI` org-key helper; leave it unset unless you keep using that helper. Apps the
  user installs use their own credentials (`x-prismeai-api-key`), unrelated to this.
- Connectors are **sandbox-first**. Default every push / deploy / id to `sandbox`
  unless the user explicitly asks for `prod`.
- The deployment **organization = the org active in the studio when the user deploys
  via the app** (`session.org.slug`), and the **user becomes the owner**
  (`owner_id = user.id`). To deploy elsewhere, the user switches org in the studio and
  re-deploys — the skill never lists or selects orgs. The user must be a **member of the
  target org** with rights to manage agents (else the deploy 403/401s). See Operation 7
  (and Operation 6b for the underlying mechanism).
- Confirm the spec with the user before creating files (scaffold) or before the first
  remote `deploy`. Subsequent edits + redeploys need no re-confirmation unless the
  user is changing environment.
- Run `validate_automation` on the changed automation (`deploy.yml`, `_afCall.yml`,
  `runTests.yml`, …) after any change, and on the folder after scaffolding a new workspace.
- A workspace's React app (if any) lives in the sibling top-level `pages/<slug>/` folder
  (alongside `workspaces/`/`agents/`, named after the workspace), never inside the
  agent folder. Agent workspaces are DSUL-pure and have none by default.
  `push_workspace` targets the agent's DSUL folder (`agents/<slug>/`) only and never
  touches `pages/<slug>/` — see the project-wide rule.

## AgentBuilderSync app (how agents are deployed)

Deployment is centralized in **one app per environment** — the `agent-builder-sync`
workspace + its SPA. It discovers every workspace labeled **`agent-builder`**, reads each
one's `config.value.agent`, and deploys the chosen agent **as the user** into the active
org. So an agent workspace is just a **definition holder**: `config.value.agent` (compiled
from `AGENT.md` + `agent.yml`) + the `agent-builder` label. No per-agent deploy SPA.

**App coordinates (recall and hand the URL to the user when deploying):**

| Env | Workspace id | App URL |
|-----|-------------|---------|
| sandbox | `65xmBBG` | `https://sandbox.prisme.ai/apps/agent-builder-sync` |
| prod | `JDNlu-Q` | `https://prisme.ai/apps/agent-builder-sync` |

The app's own DSUL/SPA lives at `agents/agent-builder-sync/` + `pages/agent-builder-sync/`
in the prismeai-workspaces repo (built/deployed via `/workspace-page-implement`). Its
`deploy` webhook refetches the target workspace's `config.value.agent`, calls agent-factory
as the user (`_afCall asUser: true`), and persists per-(workspace, org) state in
`global.deploys`. The agent's **org = the user's active studio org**, **owner = the user**.

### MCP tools = capability references (env/org-agnostic) — NEVER hardcode URLs

In `config.value.agent.tools`, store an App+MCP tool as a **capability reference**:
`{ type: mcp, capability: <catalog name> }` — NOT a full `{ server, auth, … }` with URLs.
At deploy, the `deploy` webhook looks `capability` up in the **ACTIVE org's capabilities
catalog** (`/workspaces/slug:capabilities/webhooks/v1/servers?type=mcp&search=<name>`, exact
name match) and builds the real tool: `server` (= the entry's `config_schema.properties.
server.default`) + the OAuth **`auth` block** (`{type: oauth, connect_url, status_url,
disconnect_url, scopes}` from the entry's `auth`). Why this matters:
- **Env-agnostic**: the catalog is per-env, so the same definition resolves to sandbox URLs
  on sandbox and prod URLs on prod — no host swap when pushing a definition across envs.
- **Per-org**: the catalog is per-org, so cd76 can register its own connector under the
  **same capability name** (`sharepoint_next`) pointing at `slug:sharepoint-cd76`, and the
  deploy picks it up automatically for that org.
- **OAuth always wired**: the `auth` block comes from the catalog → the OAuth "Connect"
  popup always appears (agent-factory `_route-tool` gates it on the tool's `auth` block; a
  tool without `auth` silently runs unauthenticated and never shows a Connect button).
- If the capability isn't in the target org's catalog, `deploy` returns `CapabilityNotFound`
  with the list of available capabilities. **Pre-req**: the connector must be **registered in
  each target env/org's capabilities catalog** (`POST …/v1/servers`, or the connector SPA's
  CatalogPublish) — deploying the connector workspace alone does NOT add it to the catalog.

> Migration note: `data-analyst-cd76` still carries a legacy per-agent deploy SPA +
> automations (the POC). New agents should NOT get one — they only need
> `config.value.agent` + the label. Slimming the POC is a separate cleanup step.

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
# knownOrgs is legacy — the skill no longer selects orgs (deploy follows the active
# playground session). Kept only as a human note of orgs you target; not used by the skill.
deployedIds:                  # written by the skill, do not hand-edit
  sandbox: { workspaceId: null, agentId: null, org: null }  # org = { slug } (read back from deploy)
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

⚠️ **Deploy gotcha — budgets do NOT survive a `deploy`.** The `deploy` automation sends
only `name/instructions/model/temperature/profile/tools`, so a deploy leaves
`token_budget`/`tool_call_budget`/`max_turns` unset → the agent reverts to the profile
default (e.g. 20000). **Set them with a direct PATCH** to the agent record, in the **same
org/user context** as the deploy — i.e. as the user, against the agent that now lives in
the active org:

```
PATCH {{apiUrl}}/workspaces/slug:agent-factory/webhooks/v1/agents/<agentId>
       body: { token_budget, tool_call_budget, max_turns }
```

Run it the same way the deploy ran (from the playground / as the user — e.g. an
`_afCall asUser:true` PATCH), since the agent is owner-scoped to that user in that org.
Re-do this after EVERY deploy. Read them back via `GET .../v1/agents/<agentId>`.

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
- The relevant org is the **one the agent lives in** — `deployedIds.<env>.org` once
  deployed, otherwise the org the user says they'll switch to before running `deploy`.
  Ask the user for that org slug to fetch its `allowed_models`; don't enumerate orgs.
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
3. Copy `templates/` into `agents/<slug>/`, filling placeholders:
   - `index.yml`: `name`, `slug`.
   - `AGENT.md`: the prompt draft.
   - `agent.yml`: `name`, `slug`, `model`, `temperature`, `profile`, `visibility`,
     and any seed `capabilities`/`tests`.
   - keep `imports/Agents.yml`, `imports/Custom Code.yml`, and the automations
     (`deploy.yml`, `_afCall.yml`, `runTests.yml`, `whoAmI.yml`) as-is.
4. `validate_automation` on the automations folder.
5. Offer to `deploy` (Operation 7). Do not deploy without the user's go-ahead.

## 2. Edit the prompt

- Edit `agents/<slug>/AGENT.md` directly (it is plain Markdown).
- Summarize the change. Offer to `deploy` so it takes effect.

## 3. Manage capabilities (capability catalog)

The **capability catalog** is the source of truth for ready-to-add capabilities. It is
the `capabilities` workspace (app `MCPServers`), exposed as a webhook API. Query it with
`call_api` (the catalog is per-env; built-in entries are visible to everyone, org-custom
entries are scoped to the caller's org — so to see an org's custom entries, query while
that org is the active one).

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

## 6b. Deployment organization — no selection, it follows the playground session

**The agent's org = the org active in the studio when `deploy` runs from the workspace
playground** (`session.org.slug`), and the **user who clicks run becomes the owner**
(`owner_id = user.id`). This is enforced by the agent-factory `_auth` middleware, which
reads org and owner straight from the calling session — verified in
`workspaces/agent-factory/automations/_auth.yml`. The `deploy` automation authenticates
as that user (`_afCall asUser: true`, no api key), so the runtime auto-mints a user
bearer carrying the session, and the agent lands wherever the studio is pointed.

**Consequences — the skill no longer chooses an org:**
- There is **no org-list step**. Do not call `/me` to enumerate memberships, do not
  present orgs, do not ask the user to pick one, do not handle org `iak_` keys for deploy.
- "Deploy to org X" = the **user switches the studio to org X, then runs `deploy` from
  the playground**. To move an agent to a different org, switch + re-run; the org is never
  passed as an argument (a `body.orgSlug` would be ignored anyway).
- The user must be a **member of the active org with rights to manage agents**, otherwise
  the webhook returns 401/403. That's the user's responsibility (they switch to an org
  they can manage); the skill just surfaces the error.
- After a deploy, **read the landing org/owner from `deploy`'s output** (`org`, `owner` —
  it reads the agent back) and record `deployedIds.<env>.org = { slug }`. No separate
  `whoAmI` / `call_api` confirmation needed.

For **how to actually run the deploy** (where the user clicks, what payload to paste),
see Operation 7.

## 7. Deploy the agent (via the AgentBuilderSync app)

The skill's job is to make the agent **discoverable and current**; the actual deploy is a
click in the **AgentBuilderSync app** (the user picks the agent + model and deploys, as
themselves, into their active org). The skill no longer runs `deploy` itself.

1. Confirm the **environment** (`sandbox` default; `prod` only on explicit request).
2. **Compile the definition into `config.value.agent`** in the workspace's `index.yml`,
   from `AGENT.md` (→ `instructions`) + `agent.yml`:
   `{ name, model (default), temperature, profile, visibility, tools, instructions }`,
   where `tools` = `capabilities[]` + one resolved `mcp` tool per `appMcp[]` entry
   (resolve each `mcp` `server` via `get_app_instance_config` on the target env). This is
   what the app reads — re-compile it on every prompt/model/capability change.
3. Ensure the workspace carries the **label `agent-builder`** (so the app lists it) and
   exists remotely:
   - First time: `create_workspace` → capture id into `deployedIds.<env>.workspaceId`.
   - `push_workspace` (`agents/<slug>/`) to upload `index.yml` (with the fresh
     `config.value.agent`) + DSUL. `push_workspace` DOES update `config.value`, so the
     app sees the new definition immediately. No `agentFactoryApiKey` secret needed.
4. **Hand the user the app URL** for the env (see "AgentBuilderSync app" — e.g. sandbox
   `https://sandbox.prisme.ai/apps/agent-builder-sync`). Tell them: *open it, switch the
   studio to the target org if needed, pick `<agent name>` in the left list, choose the
   model, and click Déployer.* The app deploys as them (active org, human owner), shows a
   success popup with a link to the agent, and a "Voir l'agent" link if already deployed.
5. The app tracks the deployed agent id per (workspace, org) in its own `global.deploys`
   — you don't need to write `deployedIds` for the app to work. (You MAY still record the
   resulting agent id in `agent.yml` `deployedIds.<env>` for git history if the user wants.)
6. **Budget overrides** (`token_budget`/`tool_call_budget`/`max_turns`) are still NOT
   carried by the app's deploy — if `agent.yml` sets them, PATCH them onto the agent after
   it's deployed, in the same org/user context (see "Per-agent budget"):
   `PATCH .../v1/agents/<agentId> { token_budget, tool_call_budget, max_turns }`.

> The underlying mechanism (deploy webhook → agent-factory as the user → org from
> `session.org.slug`, owner from `user.id`) is unchanged from Operation 6b; the app just
> wraps it with a dashboard. If AgentBuilderSync isn't deployed on the target env yet,
> deploy it first (`agents/agent-builder-sync/` + `pages/agent-builder-sync/` via
> `/workspace-page-implement`) and record its id + URL in the table above.

---

# Reference

## Agent Factory access (templates)

`deploy` and `whoAmI` call the **agent-factory webhook directly** via the private
`_afCall` helper (the published `Agents` app's argument schema is rejected by the prod
runtime). `_afCall` has two auth modes:
- `asUser: true` → no api key; the runtime auto-mints the **triggering user's** bearer,
  so agent-factory resolves org from `session.org.slug` and owner from `user.id`. Used by
  `deploy` (create `POST /v1/agents`, update `PATCH /v1/agents/<id>`, publish
  `POST /v1/agents/<id>/publish`, read back `GET /v1/agents/<id>`).
- default (org key) → `x-prismeai-api-key: {{secret.agentFactoryApiKey}}`, org fixed by
  the key. Used by the legacy `whoAmI` only.

The `Agents` app is still imported and used by **`runTests`** for `Agents.sendMessage`
(`{ agent_id, message: { message_id, role: user, parts: [{ type: text, text }] } }` →
`{ task: { output: { messages: [{ parts: [{ text }] }] } } }`).

## Multi-environment

`deployedIds` stores **both** the workspaceId and the agentId per environment, because
each is distinct between sandbox and prod. The skill never reuses a sandbox id for prod.

## Validation & guardrails

- `validate_automation` is authoritative — trust it over existing patterns.
- After scaffolding, guardrail-scan the new workspace for hardcoded agent/workspace ids
  and stray `fetch:` to Agent Factory: the only allowed agent-factory fetch is inside
  `_afCall` (templated, via `{{global.apiUrl}}` — never a hardcoded host or id).
- DSUL gotchas that bit these templates: string-literal compares use
  `'{{x}} = "value"'`; var-to-var compares use `'{{a}} = {{b}}'` (no quotes);
  `matches` is regex and condition-level only; `lower()` runs inside `{% %}`;
  endpoint automations read top-level args when called via `execute_automation`.

## Response shape

When done, report: files changed; capabilities/tests touched; validation status;
deploy target + agent id; test-suite result if run; and the agent URL to try it.
