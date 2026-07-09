---
name: guide
description: Index of the Prisme.ai plugin skills plus essential Prisme.ai environment context (environments, workspaces, tools, event schema). Use this when starting work on anything Prisme.ai-related and unsure which skill applies, or to discover what is available.
allowed-tools: Read, AskUserQuestion
---

# Prisme.ai skills catalog

This plugin ships a set of skills for Prisme.ai workspace development. They are grouped by domain below — pick the one that matches your task. Skills are namespaced by the plugin: invoke them as `/prisme-ai:<name>` (e.g. `/prisme-ai:app-mcp-implement`).

---

## App + MCP connectors

The connector workflow: scaffold a new SaaS connector, test it, consolidate tests in a consumer workspace, document it, and keep the whole fleet in sync over time.

| Skill | When to use |
|---|---|
| `/prisme-ai:app-mcp-implement` | Scaffold a brand-new App + MCP workspace for a third-party SaaS (REST or GraphQL). Produces `index.yml`, `security.yml`, `.import.yml`, helpers, Custom Code, MCP Core, tool/method automations, and pushes to the target env. |
| `/prisme-ai:app-mcp-test` | E2E smoke-test the tools exposed by an existing App + MCP workspace. Asks for credentials, lists every MCP tool, executes them one by one, fixes errors until the suite passes. Supports static tokens, Basic, OAuth2 client-credentials, and OAuth2 authorization-code (PKCE). |
| `/prisme-ai:app-mcp-build-consumer` | Build or audit the matching `*-consumer` workspace that consolidates the proven smoke-test coverage into a durable DSUL test suite. Typically chained after `/prisme-ai:app-mcp-test`. |
| `/prisme-ai:app-mcp-document` | Generate the public MDX documentation page for an existing connector in the `prismeai/docs` repo (Mintlify). Mirrors the layout of existing pages like `gryzzly.mdx`, `data-galaxy.mdx`. |
| `/prisme-ai:app-mcp-fleet-sync` | Find every connector workspace (by the `app-mcp` label), diff each against the current `/prisme-ai:app-mcp-implement` templates + rule checklist, and apply approved fixes. Run when a template trap-fix lands and the deployed fleet drifts. |

---

## Agents and evaluation

| Skill | When to use |
|---|---|
| `/prisme-ai:agent-builder` | Scaffold or update an Agent Factory-backed Prisme.ai agent workspace with DSUL templates, deployment automations, tests, and agent instructions. |
| `/prisme-ai:agent-workspace` | Create a bootstrap workspace that provisions an Agent Factory agent, attaches Storage-backed sources, seeds Agent Evaluations cases, runs evaluation, and validates the setup through the Agents, Storage, and Evaluation product apps. |
| `/prisme-ai:agent-implement-a2ui` | Add A2UI (Agent-to-UI) surfaces to a Prisme.ai MCP workspace so that LLM agents can render interactive UI (cards, forms, tables, action-cards, confirmations…) through MCP tool calls. The host UI reads the tool's `__surface` payload and renders it from the `prisme://blocks/v1` catalog. |

---

## Embedded React apps

| Skill | When to use |
|---|---|
| `/prisme-ai:workspace-page-implement` | Edit (or bootstrap) the React app embedded in a Prisme.ai workspace following the [starter-spa](https://github.com/prismeai/starter-spa) pattern. Modifies `src/` (React) and/or `automations/` (DSUL), builds the CJS bundle, and pushes to the workspace. |

---

## Investigation and validation

| Skill | When to use |
|---|---|
| `/prisme-ai:prisme-assistant` | Investigate Prisme automations, apps, events, or search Prisme documentation. The expert for event-feed debugging (correlationId, activity feed, execution logs). |
| `/prisme-ai:debug-events` | Debug Prisme.ai runtime events, activity feeds, and correlationId traces with focused event-search patterns. |
| `/prisme-ai:dsul-rules` | Check current DSUL authoring/deployment rules and edge cases before editing automations or workspace configuration. |
| `/prisme-ai:ticket-validator` | After implementing a feature, verify every ticket requirement was met. Run before code review. |

---

## Quick reference

| Situation | Skill |
|---|---|
| Build a new third-party SaaS connector (App + MCP) | `/prisme-ai:app-mcp-implement` |
| Test the tools of an existing connector with real credentials | `/prisme-ai:app-mcp-test` |
| Consolidate test coverage into a `*-consumer` workspace | `/prisme-ai:app-mcp-build-consumer` |
| Write or update the public docs of a connector | `/prisme-ai:app-mcp-document` |
| Propagate a template fix across all connectors | `/prisme-ai:app-mcp-fleet-sync` |
| Scaffold an Agent Factory DSUL workspace | `/prisme-ai:agent-builder` |
| Provision + evaluate an Agent Factory agent | `/prisme-ai:agent-workspace` |
| Render interactive UI from agent tool calls | `/prisme-ai:agent-implement-a2ui` |
| Edit the React frontend of a workspace | `/prisme-ai:workspace-page-implement` |
| Debug events / trace an execution | `/prisme-ai:prisme-assistant` |
| Configure an MCP environment or token | `/prisme-ai:setup` |
| Check DSUL rules before editing automations | `/prisme-ai:dsul-rules` |
| Check an implementation against its ticket | `/prisme-ai:ticket-validator` |
| I don't know where to start | `/prisme-ai:guide` (this) |

---

# Prisme.ai environment context

## Authentication

The MCP authenticates with user-created API tokens. When a tool call fails with "No credentials for environment …" (or a 401), **do not ask the user to paste their token into the chat** — that would send it to the LLM provider.

Instead, relay the CLI command from the error message and ask the user to run it in **their own terminal**. Preserve it as one shell command; do not insert line breaks inside quoted paths.

```
node "<plugin>/build/index.js" set-token <environment> --config-dir "<config-dir>"
```

The error message already contains the exact path and config dir. The command prompts for the token with hidden input, then asks for the Prisme API URL (e.g. https://api.sandbox.prisme.ai/v2). If the user is unsure, tell them to open the Prisme instance in a browser and copy the API base URL from the Network tab. It validates the token and saves it. After it succeeds, just retry the request — the server picks up the new token automatically (no restart). To create the token, the studio page is `<studio-origin>/settings/tokens` (e.g. https://sandbox.prisme.ai/settings/tokens).

Only if the user explicitly insists on pasting the token in the conversation should you fall back to the `set_token` tool — and first warn them the token will be transmitted to the LLM provider as part of the chat.

## Environment configuration

| Environment | Aliases | Default workspace |
|-------------|---------|-------------------|
| `sandbox` | sb | ai-knowledge |
| `prod` | production | - |

**Default behavior**: search on the `ai-knowledge` workspace in the `sandbox` environment unless specified otherwise.

### Workspace parameter rules

Use the correct parameter based on user input:

| User provides | Use parameter | Example |
|---------------|---------------|---------|
| Raw ID (e.g., `e-sdfwe`) | `workspaceId` | `workspaceId: "e-sdfwe"` |
| Named alias (e.g., `ai-knowledge`) | `workspaceName` | `workspaceName: "ai-knowledge"` |

Known workspace aliases: `ai-knowledge` (AIK), `ai-store` (AIS). Any other workspace has no `workspaceName` to provide to tools. **Never pass a raw ID as `workspaceName` — it will fail.**

### Local workspace priority

**IMPORTANT**: The local codebase may contain Prisme.ai workspace folders. **Always search locally first** using `Read`, `Glob`, `Grep` before calling remote APIs.

1. Each workspace folder contains automations, pages, and config as YAML
2. Read local YAML files directly — they represent the current working state
3. Check local folders before `search_workspaces` — if the workspace exists locally, its `index.yml` contains the `id` field with the workspace ID; use it with the `workspaceId` parameter
4. Only call remote APIs for remote-only data (events, execution) or when the workspace is not found locally

## Tool usage guide

| Tool | Use when |
|------|----------|
| `search_events` | User mentions: correlationId, activity feed, events, execution history, logs, tracing, debugging, errors/failures |
| `get_automation` | Need to inspect a specific automation's YAML |
| `list_automations` | Need to see all automations in a workspace |
| `get_prisme_documentation` | Need Prisme.ai syntax, patterns, or feature reference |
| `validate_automation` | Validate automation YAML for syntax/semantic errors |
| `get_app` / `list_apps` | Working with apps from the marketplace |
| `pull_workspace` / `push_workspace` | Syncing workspace files locally |
| `execute_automation` | Testing an automation with a payload |
| `set_token` | Register or rotate the API token for an environment |

### `push_workspace` must never upload `pages/<name>/` subfolders

When a workspace embeds a React app under `pages/<name>/` (starter-spa / nested-app convention), that subfolder is a full frontend project (`src/`, `node_modules/`, `dist/`, build tooling), not DSUL. Never `push_workspace` it:

- `node_modules` can make the importer fail and leave the workspace locked mid-import.
- The remote keeps app sources at canonical paths that differ from the local nested layout; pushing the local `pages/<name>/` can overwrite that structure and make the Studio page disappear.
- `push_workspace` does not update runtime `config.value`, so it cannot deploy the bundle pointer.

Any MCP push/sync must exclude every `pages/*/` subdirectory. To deploy a workspace React app / SPA bundle, use `/prisme-ai:workspace-page-implement`; it builds the CJS bundle, uploads it, and patches `config.value` correctly.

**After creating or editing YAML/DSUL automations**, always run `validate_automation` to check for syntax and semantic errors. It is authoritative for DSUL validation — trust it over existing workspace patterns (which may contain legacy mistakes). If validation conflicts with documentation, list issues and report to the human before fixing.

### Event search patterns

Common Elasticsearch DSL patterns for `search_events`:

```json
{"bool": {"filter": [{"term": {"source.correlationId": "uuid-here"}}]}}
```

```json
{"bool": {"filter": [{"term": {"type": "runtime.automations.executed"}}]}}
```

```json
{"bool": {"filter": [{"term": {"source.automationSlug": "automation-name"}}]}}
```

```json
{"bool": {"filter": [{"term": {"type": "error"}}]}}
```

**Sorting**: always use `@timestamp` (not `timestamp`) for time-based sorting.

### Event schema quick reference

| Field | Description |
|-------|-------------|
| `type` | Event category (e.g., `runtime.automations.executed`, `error`) |
| `source.correlationId` | Groups related events from same operation |
| `source.automationSlug` | Automation name |
| `source.workspaceId` | Workspace identifier |
| `source.userId` | User who triggered event |
| `payload` | Event-specific data |
| `@timestamp` | Event timestamp (use for sorting) |

Common event types:
- `runtime.automations.executed` - Automation completed
- `runtime.fetch.failed` - HTTP request failed
- `error` - Generic error
- `workspaces.automations.updated` - Automation changed

## Products quick reference

| Product | Nickname | Purpose |
|---------|----------|---------|
| AI Knowledge | AIK | RAG, knowledge bases, LLM middleware |
| AI Store | AIS | Chat interface, agent marketplace |
| Builder | - | Custom workflows, automations, pages |
| SecureChat | - | Enterprise conversational interface |
| Collection | - | Tabular data with AI querying |
| Governance | - | Platform admin, RBAC |
| Insights | - | Conversation analytics |

### AI Knowledge query flow

Entry point is `genericQuery`, which orchestrates:
1. Config phase: rate limits, model specs, attachments
2. Prompt building: system prompt, history, context
3. Tool loop: `callLLMWithTools` handles tool calling
4. Post-processing: suggestions, source filtering

Key automations: `query`, `genericQuery`, `buildPrompt`, `LLMCompletion`, `callLLMWithTools`, `executeTool`

### AI Store architecture

- Each "agent" in AI Store = AI Knowledge project
- Uses `Knowledge Client` app to interface with AIK
- Conversations stored via `Conversations Service App`
- SSE streaming for real-time responses

### Agent URLs

URLs to access agents in the Prisme.ai interface follow this pattern:

```
https://{environment}.prisme.ai/fr/product/ai-knowledge/documents?id={projectId}
```

| Environment | Base URL |
|-------------|----------|
| sandbox | `https://sandbox.prisme.ai` |
| prod | `https://prisme.ai` |

**Finding the project ID**: the `id` parameter is found in the workspace's `imports/Knowledge Client.yml` file.

**Usage**: when working on a workspace with a Knowledge Client, provide the full clickable URL to the user so they can easily test the agent in their browser.

## Isolate workspace dev in a worktree

When the user starts a development task on a workspace (any request to implement, edit, or build a feature/fix on a workspace — i.e. before writing or changing any DSUL/automation/page), **spontaneously propose, as the first thing, to do the implementation in a dedicated git worktree on a new branch.**

- Make this a short one-line offer, e.g. *"Je crée un worktree + branche `workspace/<slug>-<short-desc>` pour isoler ce dev ?"* — derive the branch name from the workspace slug and a short kebab-case description of the task.
- If the user accepts, create the worktree (use the worktree isolation mechanism), branch from `sandbox`, and do all edits there.
- If the user declines or says to proceed in place, work in the current directory without asking again for that task.
- Skip the offer for pure read-only work (diagnostics, event tracing, questions) — it only applies when actual file changes are coming.

## Development steps to edit a workspace

- Check if there is a local version of the workspace in `./`
- Read the documentation of the relevant products and automations before anything
- Edit the automations locally
- Once completed, run `validate_automation` to check for common mistakes
- Execute a sub-task to review the changed code and give a list of eventual issues rated MAJOR | NEED_HUMAN, formatted with emoji in a bulleted list:
  - 🔴 Solve the MAJOR issues
  - 🟠 Ask the human for the NEED_HUMAN issues

If you encounter any issue (e.g. the Prisme.ai API returns an error), use the `report_issue_or_feedback` tool so we can enhance the tooling.
