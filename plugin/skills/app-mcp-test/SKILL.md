---
name: app-mcp-test
description: End-to-end smoke-test the tools exposed by a Prisme.ai App+MCP workspace, then hand off to app-mcp-build-consumer to consolidate the successful coverage into a consumer test workspace. Asks for the workspace and environment, collects the credentials required by the app's config schema, lists every MCP tool, then executes them one by one, diagnosing and fixing errors in the workspace until the full suite passes. Supports static tokens, Basic, OAuth2 client-credentials, AND OAuth2 authorization-code (PKCE) when the user supplies a pre-configured tenant workspace whose user already completed the browser auth — in that mode we call `ensureAuthentication` first to mint a `$secret:` accessToken ref and inject it into `routeToolCall`/`tool-*` directly. Use when the user says "test this app+mcp", "tester les tools du MCP X", "/app-mcp-test", or similar.
argument-hint: "[workspace-slug] [?sandbox|prod]"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, Agent, mcp__prisme-ai-builder__get_prisme_documentation, mcp__prisme-ai-builder__list_automations, mcp__prisme-ai-builder__get_automation, mcp__prisme-ai-builder__execute_automation, mcp__prisme-ai-builder__search_events, mcp__prisme-ai-builder__validate_automation, mcp__prisme-ai-builder__push_workspace, mcp__prisme-ai-builder__search_workspaces
---

# App + MCP test runner

You are running a **smoke test** of every tool exposed by a Prisme.ai App + MCP workspace.
The goal is: for a given workspace + environment, invoke each `tool-<op>` automation with realistic arguments and the user's real credentials, and keep fixing until every tool returns a non-error result.

The workspace layout you are testing follows the scaffold produced by the `/app-mcp-implement` skill. Re-read `${CLAUDE_PLUGIN_ROOT}/skills/app-mcp-implement/SKILL.md` if you need a refresher on the conventions (especially `tool-*` and `method-*`).

**Scope guardrails**:
- Supported credential models: static tokens (PAT / Bearer), Basic (email + token), OAuth2 `client_credentials`, AND OAuth2 authorization-code / PKCE **via the tenant-injection pattern** — see Phase 2 + Phase 5 below. The only thing still out of scope is OAuth-AC when no pre-configured tenant exists (i.e. you'd need to drive a real browser flow yourself).
- You **must never** invent credentials. Always ask the user.
- You **must never** push structural changes without the user's approval; bug fixes to the workspace during the test loop should be proposed, confirmed, then applied with `push_workspace` on the matching environment.

### OAuth-AC via tenant-injection (the Salesforce pattern)

If the app uses OAuth-AC (a `pages/connector-callback.yml` exists, plus an `ensureAuthentication.yml` reading `user.<app>.oauth.*`), DO NOT exit. Ask the user for a **tenant workspace ID** where they have already installed the app and completed OAuth via the browser. Then:

1. `list_app_instances(tenantWorkspaceId)` → find the app instance slug.
2. `get_app_instance_config(tenantWorkspaceId, instanceSlug)` → grab `oauthClientId`, `oauthClientSecret`, `mcpApiKey`, `mcpEndpoint`.
3. Call `execute_automation(centralWorkspaceId, "ensureAuthentication", { tenantId: <tenantWorkspaceId>, tenantConfig: { oauth: { clientId, clientSecret }, apiVersion, loginHost } })`.
   - On success returns `{ authenticated: true, accessToken: "$secret:<ref>", instanceUrl, baseUrl, authMethod: "delegated" }`.
   - The `$secret:` is a **short-lived (~few minutes)** runtime-resolved ref — re-call `ensureAuthentication` between batches when you get a `Secret ref expired` 500 error.
4. For each tool call: route via the workspace's dispatcher automation (`routeToolCall` in dispatcher-pattern workspaces, or `tool-<op>` directly in per-op workspaces) with payload `{ toolName, toolArgs: { arguments, accessToken: "$secret:<ref>", baseUrl, apiVersion } }`. The `tool-*` automation passes accessToken+baseUrl to `executeApiCall` which short-circuits the per-user auth resolution (it only kicks in when these are empty).

This pattern is the cleanest way to exercise the data plane (registry + path/method mapping + REST plumbing) without the browser. The OAuth flow itself (`connect`/`disconnect`/`oauthCallback`/`initiateOAuth`) cannot be tested this way — classify those tools as ⚪ SKIPPED.

---

## Workflow — 7 phases

Run phases sequentially. Do not skip. Pause after phase 1 and phase 3 to confirm.

### Phase 1 — Identify the target workspace

**Goal**: lock the workspace folder, workspace ID, and environment.

1. Parse `$ARGUMENTS`:
   - First token → candidate workspace slug (kebab-case folder name)
   - Second token → environment (`sandbox` | `sb` | `prod` | `production`)
2. If the slug is missing, ask via `AskUserQuestion`:
   - "Quel workspace App+MCP veux-tu tester ? (slug / nom de dossier local)"
3. If the environment is missing, ask:
   - "Sur quel environnement ? (sandbox / prod)"
4. Locate the workspace locally:
   - Prefer `./prismeai-workspaces/workspaces/<slug>/` (new layout).
   - Fallback to `./<slug>/` (legacy flat layout).
   - If neither exists, call `search_workspaces` with the slug on the chosen environment and abort if not found — we need the folder to read the tool list and fix bugs.
5. Read `<workspace>/index.yml` and extract:
   - `id` → used as `workspaceId` in every MCP tool call
   - `config.schema` → which credential fields exist (plus their `secret: true` flags)
   - `config.value.mcpTools` → the canonical list of MCP tools with `inputSchema`
6. Confirm to the user in one short message: workspace slug, workspace ID, environment, tool count.

**Do NOT** proceed to phase 2 without these four facts printed and confirmed.

### Phase 2 — Detect the auth model

**Goal**: know exactly which credentials to collect — and pick the right invocation pattern (App-mode args vs tenant-injection).

1. Inspect `config.schema` keys. Map to one of:
   - **Static token / PAT**: a single secret field (e.g. `token`, `apiKey`, `pat`) + optional `baseUrl`.
   - **Basic auth**: `email` + `token` (or `password`), both non-readOnly.
   - **OAuth2 client-credentials**: `clientId` + `clientSecret` (sometimes `tenantId`, `scope`). Server-to-server, no user interaction — **in scope**.
   - **OAuth2 authorization-code / PKCE**: detect via `pages/connector-callback.yml`, `automations/initiateOAuth.yml`, `automations/oauthCallback.yml`, `automations/ensureAuthentication.yml` reading `user.<app>.oauth.*`, OR a `refreshToken`/`userRefreshToken` field that's `readOnly: true`. **In scope via tenant-injection** — ask the user for a tenant workspace ID where they've completed OAuth in the browser, then drive `ensureAuthentication` to mint a short-lived `$secret:` accessToken ref (see the "OAuth-AC via tenant-injection" section at the top).
2. Also inspect `automations/buildAppAuth.yml` to cross-check which fields are actually consumed — the schema can be wider than what auth needs. The real required set = intersection of `config.schema` (non-readOnly) ∪ what `buildAppAuth` reads.
3. Identify `readOnly: true` fields — skip them (they're auto-generated, e.g. `mcpEndpoint`, `mcpApiKey`, `appSecret`).
4. Detect dispatcher vs per-op pattern: if `automations/` contains only `tool-restOp.yml` / `tool-graphqlOp.yml` (one tool file for N ops, plus a `routeToolCall.yml`), it's a **dispatcher** workspace — every MCP tool from `config.value.mcpTools` routes through `routeToolCall(toolName, toolArgs)`. If instead each MCP tool has its own `tool-<name>.yml`, it's **per-op** — call `tool-<name>` directly.

Output a short summary of the credential fields you will ask for.

### Phase 3 — Collect credentials

**Goal**: get real values from the user for every non-readOnly credential field.

1. For each required field, ask via `AskUserQuestion`:
   - Title: the `title` from `config.schema` (fallback to field name)
   - Prompt: the `description` from `config.schema`
   - Add `"(secret — will only be kept in memory for this test run)"` when `secret: true`
2. Offer a sensible default for `baseUrl` when `config.value.baseUrl` has one (show it and let the user press Enter to keep it).
3. Store the collected credentials in a single in-memory object `creds = { <field>: <value>, ... }`. **Never** write them to a file, never log them to shell output, never include them in commit-worthy artifacts.
4. Confirm to the user: "Credentials collected for N fields (values hidden). Ready to run the test suite ?"

### Phase 4 — Build the test plan

**Goal**: compile the list of tools to exercise and the argument payload for each.

1. Source the tool list in this priority order:
   1. `config.value.mcpTools[].name` from `index.yml` (authoritative)
   2. Fallback: `Glob tool-*.yml` under `automations/` and strip the `tool-` prefix
2. For each tool, build a payload by walking its `inputSchema.properties`:
   - `required` fields → must have a value. If the property lists `enum`, pick the first value. Otherwise pick a plausible sample based on `type`, `format`, `example`, and `description` (e.g. `format: uuid` → `"00000000-0000-0000-0000-000000000001"`, `format: date` → today's ISO date, `type: integer` → `1`, `type: boolean` → `false`, free-string → `"test-{{toolName}}"`). Prefer values that are safe to send against a real backend (read-only operations first, mutations use obviously-fake names like `"PRISMEAI-TEST-<timestamp>"`).
   - Optional fields → skip by default. Only include them if they're needed to make the call meaningful (e.g. a `list*` tool that requires a pagination cursor).
3. Classify each tool:
   - **read** — `get*`, `list*`, `search*`, `count*` → safe, always run
   - **write** — `create*`, `update*`, `delete*`, `add*`, `remove*` → destructive, ask the user before running. Offer three modes: `skip all writes`, `run reads first then ask per-write`, `run everything` (only recommended on sandbox/dev tenants).
4. Print the plan: `"N tools total: R reads, W writes. Mode: <chosen>. OK to start ?"`. Wait for confirmation.

### Phase 5 — Execute the loop

**Goal**: for each planned tool, call `execute_automation`, capture the result, and fix the workspace when a tool fails.

For each tool in order (reads first, then writes):

1. Build the call. Two variants depending on the pattern detected in phase 2:
   - **Per-op pattern** (one `tool-<name>.yml` per MCP tool):
     - `slug` = `"tool-<op>"`, `payload` = `{ body: { arguments: <generated-args>, <flattened creds> } }`.
     - `<flattened creds>` are the fields that `tool-*` accepts directly (typically `accessToken` and `baseUrl` — check the tool's `arguments.body.properties` to confirm).
   - **Dispatcher pattern** (single `tool-restOp.yml` + `routeToolCall.yml`):
     - `slug` = `"routeToolCall"`, `payload` = `{ toolName: <mcpToolName>, toolArgs: { arguments: <generated-args>, accessToken, baseUrl, apiVersion } }`.
     - In this mode the MCP tool name from `config.value.mcpTools[].name` (e.g. `versions`, `sobjects`, `query`) is passed as `toolName`, and the `arguments` object contains the entity-level `action` enum plus any path/query/body params declared in the tool's `inputSchema`.
   - For **OAuth-AC tenant-injection**: pass `accessToken: "$secret:<ref>"` and `baseUrl: "<instanceUrl>/<api-prefix>"` straight from the `ensureAuthentication` output. The runtime resolves `$secret:` at interpolation time.
2. Call `execute_automation(workspaceId, slug, payload)` on the target environment.
   - **Watch for `Secret ref expired`** (500 error, only in OAuth-AC mode): the `$secret:` ref lives only a few minutes. When you see it, call `ensureAuthentication` again to mint a fresh ref and replace it in subsequent payloads. Don't try to refresh in advance — just react to the error and retry once.
3. Capture the response. A successful MCP tool response has shape:
   ```json
   { "content": [ { "type": "text", "text": "..." } ] }
   ```
   A failure has `isError: true` AND/OR `error: "<message>"`.
4. Report to the user in one line per tool:
   - ✅ `<tool>` — 200 OK, <N> chars output
   - ❌ `<tool>` — <error short-message>
5. **On failure**, run the Fix loop (below) before moving on. Do not batch failures — fix them one at a time, because fixes often cascade (one bad helper breaks many tools).

**Rate limiting**: add a 300ms pause between calls to avoid hitting provider rate limits. If a tool returns a 429, pause 5s and retry once before classifying it as a failure.

#### Fix loop (per failing tool)

1. **Diagnose** — fetch the last 10 events for that correlation:
   - Use `search_events(workspaceId, query: { bool: { filter: [ { term: { "source.correlationId": "<id from execute_automation response>" } } ] } }, sort: [ { "@timestamp": "asc" } ])`
   - Look for `type: "error"` and `type: "runtime.fetch.failed"`.
2. **Locate the root cause**, in this order:
   - `tool-<op>.yml` — wrong argument mapping?
   - `method-<op>.yml` — wrong path, wrong method, missing header, wrong body shape?
   - `buildAppAuth.yml` — wrong auth header name / prefix?
   - `executeApiCall.yml` — URL composition, query-string handling?
   - `handleApiError.yml` — misreporting a success as an error?
   - `formatToolOutput.yml` — bad format crashing downstream?
3. **Classify** the failure:
   - 🔴 **MAJOR** — workspace bug (wrong API path, wrong header, missing arg mapping). Propose the fix, show the diff, ask the user to confirm, then edit the YAML, run `validate_automation`, then `push_workspace` on the target environment, then re-execute the failing tool.
   - 🟠 **NEED_HUMAN** — provider returned a real 4xx/5xx (e.g. quota, permissions, unknown resource ID), or the input sample hit a business rule (e.g. "customer already exists"). Do NOT "fix" the workspace — regenerate the sample arguments with different values (e.g. add a timestamp suffix, pick a different enum) and retry once. If it still fails, report to the user and keep the failure on record.
   - ⚪ **SKIPPED** — OAuth-required / write tool while in `skip all writes` mode.
4. **Re-test** the same tool after each fix. Stop after 3 fix attempts per tool — escalate to the user with the raw events and ask how to proceed.

### Phase 6 — Final report

**Goal**: give the user a concise verdict and an actionable next-steps list.

After the loop ends, print a single Markdown block:

```
## Test run: <workspace> on <env>

- Total tools: N
- ✅ Passed: P
- ❌ Failed: F
- ⚪ Skipped: S

### Fixed during the run
- `<tool>` — <one-line description of what was fixed>

### Still failing (NEED_HUMAN)
- `<tool>` — <error> — <suggested next step>

### Skipped
- `<tool>` — <reason>
```

If any workspace files were modified, remind the user that changes were pushed to `<env>` and that a `push_workspace` to the other env may be needed if it should propagate.

### Phase 7 — Build the consolidated consumer workspace

**Goal**: turn the proven smoke-test coverage into a durable consumer workspace.

After the tool test loop is complete, call `/app-mcp-build-consumer <workspace-slug>` to create or update the corresponding `*-consumer` workspace. Pass along the tested workspace slug, environment, tool list, operation classifications, known safe fixture values, skipped/destructive tools, and any fixes made during this run.

The consumer workspace should consolidate the tested App operations and MCP-through-Agent Factory paths into repeatable DSUL test suites. Do not rebuild this logic inside `/app-mcp-test`; hand off to `/app-mcp-build-consumer`.

---

## Guardrails & gotchas

- **Credentials**: collect in memory only. Never write them to disk, never echo them in shell output. If the user asks you to save them, refuse and suggest the platform's secret manager.
- **execute_automation vs MCP JSON-RPC**: prefer `execute_automation` on the `tool-<op>` slug — it bypasses the HMAC-signed `mcp-api-key` layer and removes a whole class of errors from the loop. The JSON-RPC endpoint is a nice end-to-end test but only useful **after** every tool-* call already passes on its own.
- **Destructive tools**: always default to read-only. A typo in a `delete*` input wipes real data. Always prefix any created resource with `PRISMEAI-TEST-<timestamp>` so cleanup is easy.
- **Fix scope**: only edit files under the workspace being tested. Never touch shared apps (`Custom Code`, `MCP Core`) unless the user explicitly asks — they're cross-workspace.
- **Environment**: `push_workspace` targets an environment. Re-read the env chosen in phase 1 before every push. Never push to prod without the user's explicit "oui" on that specific change.
- **validate_automation** is authoritative — if it complains, fix before pushing, don't skip.
- **Rate limits**: 300ms between calls; 5s + 1 retry on 429. Do not parallelize the tool calls — the fix loop needs ordered context.
- **Stop conditions**: if the MCP endpoint itself is down (the first read-tool already returns network error) or if credentials are clearly wrong (every call returns 401), stop the loop, report the symptom, and ask the user to re-check credentials before burning through the whole suite.

## Out of scope

- OAuth2 authorization-code / PKCE flows (require browser interaction)
- Load testing / concurrent calls
- Tool behavior beyond the happy path (edge cases, input fuzzing)
- Generating or modifying the MCP key — `onInstall.yml` already handles that
