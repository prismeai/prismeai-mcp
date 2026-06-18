---
name: app-mcp-document
description: Generate public documentation (MDX) for a Prisme.ai App+MCP connector, mirroring the structure of existing pages (gryzzly.mdx, data-galaxy.mdx, …) in the prismeai/docs repo. Produces one `apps-store/marketplace/connectors/<slug>.mdx` page and inserts a matching `<Card>` into `overview.mdx`. Use when the user says "document the X app+mcp", "écris la doc de X", "/app-mcp-document X", or similar. Assumes the source workspace already exists locally (scaffolded by `/app-mcp-implement`).
argument-hint: "[workspace-slug]"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, Agent
---

# App + MCP documentation writer

You are producing the **public, user-facing documentation** for a connector that already exists as a local Prisme.ai App+MCP workspace. The output is an MDX page in the `prismeai/docs` repo (Mintlify-flavoured) following the **audience-driven model** described below. Canonical references: `google-workspaces.mdx` (Tenant-context + config SPA archetype) and `gitlab.mdx` (Central-OAuth via Governance archetype). Older pages (`gryzzly.mdx`, `data-galaxy.mdx`, `monday.mdx`) predate this model — use them for prose tone only, not for structure.

**Three deliverables**, all under `<docs-repo>/`:
- **`apps-store/marketplace/connectors/<slug>.mdx`** — the full connector page
- An inserted **`<Card>`** in `apps-store/marketplace/connectors/overview.mdx` under `## Available Connectors`, in alphabetical order
- A new entry in **`docs.json`** → `navigation > … > "Apps Marketplace" > "Connectors" > pages`, alphabetical (overview stays first)

---

## Output layout — audience-driven

A connector page is read by **three distinct roles**, and the page must answer each one's question head-on instead of mixing them under "App vs MCP". Two of the roles get a `<Tab>` in the body `<Tabs>` block; the **Platform admin** content lives in a **closed `<Accordion>` placed right under *Prerequisites*** (above the tabs) — it is one-time setup most readers skip, so it is collapsed by default rather than occupying a permanent tab. Order:

| Section | Placement | Role | Answers |
|---------|-----------|------|---------|
| `Agent builder (Agent Factory)` | first `<Tab>` | end-user building an agent | "how do I plug this connector into my agent in **Agent Factory**?" |
| `Platform admin (Governance)` | **closed `<Accordion>` under *Prerequisites*** (NOT a tab) | platform operator | "how do I set this up once for everyone?" |
| `Workspace builder (DSUL)` | second `<Tab>` | Builder developer | "how do I call this from my workspace automations?" |

> **Terminology — Agent Factory, not AI Knowledge.** The agent-building product is **Agent Factory**. Never write "AI Knowledge", "Knowledges", "AIK" or "Agent Creator" in a connector page. The only allowed mention of AI Knowledge is a short *legacy* note (for old agents without the native MCP picker), framed explicitly as legacy.
>
> **`mcp-api-key` is deprecated — do NOT document it.** The signed `mcp-api-key` / HMAC header is an obsolete wiring mechanism. Never feature it as the auth path, and **do not even mention its absence** ("there is no mcp-api-key" is noise). Describe authorization positively: agents are identified by the capability **Scope `context_id,agent_id,user_id`** and the connector resolves credentials server-side; tenant-context connectors additionally gate via the config-app allowlist. Only if a connector *strictly still requires* the header today, relegate it to a one-line legacy note — never a Step.

```
---
title: '<Service>'
description: '<One-line, Agent-Factory-framed SEO description>'
---

<lettrine img>               — Phase 4.5 brand icon, float-left
<Intro paragraph>            — what it exposes; consumed by Agent Factory agents (MCP) or Builder (App); auth modes
<CardGroup cols={3}>         — 3 feature cards
## Who is this for?          — 3 orientation cards (Agent builder / Platform admin / Workspace builder)
## Prerequisites             — provider-side account, APIs to enable, credentials

<Accordion title="Platform admin (Governance) — one-time platform setup" icon="shield-halved">
  — closed by default; <Steps or Warning depending on archetype — see below>
</Accordion>

<Tabs>
  <Tab title="Agent builder (Agent Factory)">
    ## Agent builder        — REQUIRED first heading (see rule below); surfaces the tab in the TOC
    <Note> dependency on the Workspace builder tab + the Platform admin accordion </Note>
    <Steps> get endpoint → add capability (+ Scope) → connect/authorize → brief the agent </Steps>
    <Note> legacy AI Knowledge (Advanced > Tools) — one paragraph, framed as legacy </Note>
    ## Available Tools        — MCP tool table(s)
    ## Output Formats
    ## Tool Details           — 4-6 flagship tools
  </Tab>
  <Tab title="Workspace builder (DSUL)">
    ## Workspace builder      — REQUIRED first heading (see rule below); surfaces the tab in the TOC
    ## Installation
    ## Configuration          — config table + auth-mode table
    ## Available Instructions — one table per resource category
    ## DSUL Examples          — 3-5 snippets
  </Tab>
</Tabs>

## Error Handling             — HTTP codes + common issues
## External Resources         — API docs + Tool Agents cards
```

### Each connector archetype gets a personalized page

The two tabs + the Platform admin accordion share the skeleton, but their content MUST match the connector's actual architecture. Detect the archetype in Phase 2 (from `buildAppAuth.yml` + `index.yml`) and fill them accordingly (the *Platform admin* column below renders inside the closed accordion under *Prerequisites*, not a tab):

| Archetype | Detect by | Agent builder tab | Platform admin accordion | Workspace builder tab |
|-----------|-----------|-------------------|--------------------|-----------------------|
| **Static-credential** (API key / PAT / Basic / client-credentials) | `config.schema` has the token field; no `initiateOAuth.yml` | capability pointing at the MCP endpoint (credential resolved server-side from the app config). *Legacy note only if the connector still requires a signed header — never a Step.* | **N/A** — say "No platform-level setup. Each workspace pastes its own credential." | install app + paste token |
| **Central-OAuth via Governance** | `<slug>OauthClient*` in `secrets.schema`; `mcp.yml` has a central + tenant dispatch | enable the Governance capability + *Connect* (per-user OAuth) | full `<Steps>`: register OAuth app → store secrets in core ws → **Governance auth-config JSON** (status/connect/disconnect webhooks) → grant roles → smoke-test (reference `gitlab.mdx`) | install app + optional shared-credential path |
| **Tenant-context + config SPA** | `config.schema` ≈ `configAppUrl` only; `mcp.yml` runs in tenant context, **no `mcp-api-key`**; agent allowlist + `validateAgent` | if a catalog capability exists (admin §2), split into **Option A** (enable the shared catalog capability — easy, NO allowlist step since the shared instance accepts every agent) + **Option B** (run it from your own workspace — recommended, lead with a `<Warning>` on security/least-privilege isolation; allowlist your agent here); else single flow: capability **Scope `context_id,agent_id,user_id`** (no key) + **allowlist the agent** in the config app | two `## ` sub-sections — **§1 Configure the connector** (provision the central OAuth client by opening the **core workspace's config app** `<studio>/apps/<slug>` and following its instructions — it writes the secrets, never hand-edit Studio Secrets) + **§2 Declare the capability in AI Governance** (generic connectors only: name the capability, point it at the MCP endpoint, Scope `context_id,agent_id,user_id` — it then shows up in the agent builders' capability picker; catalog access follows org RBAC, there is **NO per-capability "grant to roles" step for tenant-context** connectors, that gate only exists for Central-OAuth). **`<Warning>`: declaring the capability ≠ authorizing an agent — per-agent gating is the config-app allowlist; no OAuth auth-config JSON here**; skip if every ws uses its own creds | config app drives auth-mode + allowlist; auth-mode table; instructions tables |
| **Webhook bridge** (inbound bot → agent) | endpoint automations bridge a provider bot; no entity tools | N/A (the agent IS the target) | register the bot/webhook at the provider | configure the bridge target agent |

`google-workspaces.mdx` is the canonical reference for the **tenant-context + config SPA** archetype; `gitlab.mdx` for **central-OAuth via Governance**. Read the one matching your connector before writing. `./templates/connector.mdx` is the authoritative skeleton. **Never** date a section heading ("(2026, …)").

Read `./templates/reference-example.mdx` once for tone, table layout and prose density (it predates the audience-driven structure, so use it for *style*, not section ordering).

---

## Workflow — 5 phases

Run sequentially. Pause after phase 1 for confirmation.

### Phase 1 — Locate the docs repo and the source workspace

**Goal**: lock the two directory paths.

1. If `$ARGUMENTS` is empty, ask via `AskUserQuestion`:
   - "Quel connecteur documenter ? (slug / nom de dossier local)"
2. Ask for the docs repo path via `AskUserQuestion`:
   - "Où se trouve le repo `prismeai/docs` ?" — suggest the user paste an absolute path; no default is assumed.
   - Verify `<docs-repo>/apps-store/marketplace/connectors/overview.mdx` exists; abort with a clear message otherwise.
3. Locate the source workspace locally:
   - Prefer `./prismeai-workspaces/workspaces/<slug>/`
   - Fallback `./<slug>/`
   - Abort if neither exists — this skill cannot fabricate a doc from API calls.
4. Confirm the three paths to the user in one short message before continuing.

### Phase 2 — Extract workspace metadata

**Goal**: pull everything we need out of `index.yml`.

Read `<workspace>/index.yml` and collect:
- `name` → human-readable service name (e.g. `GitLab`, `DataGalaxy`, `Gryzzly`)
- `slug` → kebab-case, used as the MDX filename + URL path
- `description` → short description (we'll rewrite the first sentence to match the doc tone)
- **`photo` → logo URL** (used in Phase 4.5 to copy the asset into the docs repo — NOT hotlinked into the MDX). Typically points at `uploads.prisme.ai` or `api.<env>.prisme.ai/v2/files/...`. If empty, the overview card falls back to a Font Awesome icon (skill asks the user).
- `config.schema` → build the Configuration table
  - Fields flagged `readOnly: true` go in the table as "Auto-populated on install"
  - Fields flagged `secret: true` mention "stored as a workspace secret"
  - `baseUrl` always shown with its default from `config.value.baseUrl`
- `config.value.mcpTools[]` → tool list to categorize

Also introspect:
- `automations/buildAppAuth.yml` → identify the auth mode (static token / Basic / OAuth2 client-credentials / OAuth2 AC) — affects wording of the Prerequisites + Configuration tables.
- `automations/initiateOAuth.yml` (optional) → if present, the connector supports OAuth2 authorization-code. **Since the OAuth-central migration (gitlab pilot, 2026-05-28)** the credentials are NOT tenant-facing anymore: check `secrets.schema` in `index.yml` for `<<SERVICE_SLUG>>OauthClientId` / `<<SERVICE_SLUG>>OauthClientSecret`. If both are declared at the workspace level (and absent from `config.schema`), the connector is in the **Central-OAuth via Governance** archetype — fill the *Platform admin (Governance)* accordion with the full `<Steps>` block (see the gitlab.mdx reference). If `oauthClientId` is still in `config.schema`, the connector is on the legacy per-tenant model — flag it as a candidate for `/app-mcp-fleet-sync` migration.
- `automations/mcp.yml` → inspect the dispatch to pin the archetype (see the archetype table above). `authMode: central` default + `conditions: '{{headers["mcp-api-key"]}}' → authMode: tenant` ⇒ **Central-OAuth via Governance**. A single tenant-context flow with `validateAgent` + an agent allowlist and **no `mcp-api-key`** ⇒ **Tenant-context + config SPA** (e.g. `google-workspaces`). A bare static-token resolution ⇒ **Static-credential**.

### Phase 3 — Categorize the tools

**Goal**: group the ~N tools into ~6-10 thematic categories matching the resource model of the underlying API.

Default algorithm (Python, inline via Bash):
1. For each tool `name`, strip the leading verb (`list|get|search|create|update|delete|add|remove|close|reopen|approve|unapprove|merge|cancel|retry|revert|cherryPick|archive|unarchive|fork|stop|invite`).
2. Map the remaining noun to a category label. Singularize trivially (e.g. `Projects` → `Project`). Multi-word nouns split on camelCase (`IssueNote` → `Issue Note`).
3. Group related resources together when it feels natural: `Issue` + `IssueNote` → "Issues"; `MergeRequest` + `MergeRequestNote` → "Merge Requests"; `Tag` + `Tagset`.
4. OAuth-only tools (`connect`, `disconnect`), when the connector exposes them as tools, go at the bottom as an "OAuth Session" sub-section. Tenant-context connectors (e.g. `google-workspaces`) do NOT expose them as tools — the connect flow is the config-app **Connect** button / the agent-factory `connect_url`; in that case omit the OAuth Session sub-section entirely.

Print the proposed categorization to the user and ask for confirmation before rendering. Example output:

```
Proposed categories for gitlab (94 tools):
  Projects (8): listProjects, getProject, createProject, updateProject, deleteProject, archiveProject, unarchiveProject, forkProject
  Issues (12): listIssues, getIssue, createIssue, ..., createIssueNote, ...
  Merge Requests (13): ...
  ...
  OAuth Session (2): connect, disconnect
OK to proceed with this grouping?
```

The user can override by saying "merge X and Y" or "split X into A + B".

### Phase 4 — Render the MDX page

**Goal**: fill the template and write the `.mdx` file.

1. Read `./templates/connector.mdx` (in this skill folder). It uses `<<PLACEHOLDER>>` syntax.
2. Substitute the static placeholders:
   - `<<SERVICE_NAME>>`, `<<SERVICE_SLUG>>`, `<<BASE_URL>>`, `<<API_DOCS_URL>>` (ask if not in `index.yml`), `<<ONE_LINE_DESCRIPTION>>`, `<<INTRO_PARAGRAPH>>`.
   - `<<HEADER_ICON>>` — **always render the service brand as a drop-cap "lettrine"** at the very top of the page body so the connector page is visually anchored to its service. When Phase 4.5 produced an `iconPath`, substitute exactly this JSX (no other variant; the float + margins are what make the intro paragraph wrap around the icon, which is the desired "lettrine" effect):

     ```mdx
     <img
       src="<<iconPath from Phase 4.5>>"
       alt="<<SERVICE_NAME>>"
       width="96"
       height="96"
       noZoom
       style={{ float: "left", marginRight: "1.25rem", marginBottom: "0.5rem" }}
     />
     ```

     When Phase 4.5 fell back to `iconFallback` (no asset), substitute the empty string — the page renders without a lettrine, and the Font Awesome glyph from the overview card carries the brand. Do NOT inline `<Icon icon="..." />` from Mintlify here: the lettrine is meant as a *visual brand mark*, not a hint glyph. NEVER use a hotlinked URL in the `src=` (same rule as Phase 5.1).
3. **Auto-generate** the dynamic sections:
   - **Feature cards** (`<<FEATURE_CARDS>>`) — 3 cards. Infer from the top categories; icon is a Mintlify Font Awesome name (e.g. `book`, `diagram-project`, `users`, `clock`, `plug`). Ask the user to review before locking.
   - **Configuration table** (`<<CONFIG_TABLE>>`) — rendered from `config.schema` non-readOnly fields + the readOnly `MCP Endpoint` row. Do NOT add an `MCP API Key` row (deprecated). For **tenant-context + config SPA** connectors the schema is just `configAppUrl` — render the single `Configuration app` row and an auth-mode table (which auth mode → what you provide → best for), since the config app drives everything. For **static-credential** connectors, list the token/baseUrl fields. Never list OAuth client id/secret/urls here — they live in the central workspace secrets (provisioned via the config app, see the *Platform admin* tab).
   - **Instructions tables** (`<<INSTRUCTIONS_TABLES>>`) — one `### CategoryName` + table per category, columns **Instruction | Description | Returns**. A bare argument-name list is low-value — do NOT use it. *Description* = what the op does, folding the key/required inputs inline (e.g. "…by `fileId`", "`body` = `{role,type,emailAddress}`"). *Returns* = the output shape (the underlying provider resource), e.g. `{ files: [{ id, name }], nextPageToken }` or "Empty (HTTP 204)". The op automations' own `description` is usually boilerplate ("App-mode wrapper for…") and dispatch is registry-driven (no literal URL), so author the description + output shape from the provider's API reference (`swagger.yml` `servers[0].url` per op gives the endpoint) rather than copying the automation.
   - **MCP tools tables** (`<<MCP_TOOLS_TABLES>>`) — same grouping, columns (Tool, Description). Description is the mcpTool's own description, truncated if >100 chars.
4. **Assisted-generate** the remaining sections — present a draft to the user, let them refine:
   - **Prerequisites** (`<<PREREQUISITES>>`) — a SINGLE provider-side block: account type, which provider APIs to enable, credentials source (UI path at the provider), OAuth scopes, base URL. Keep auth-mode and platform specifics OUT of here — they belong elsewhere (the *Platform admin* accordion, placed right after this Prerequisites block, for central setup; the *Workspace builder* tab for the per-mode credential table). Pull the provider's OAuth-app management page URL from the `<<SERVICE_SLUG>>OauthClient*` secret description (captured at scaffold time in `/app-mcp-implement` Phase 1) or, for legacy per-tenant connectors, from the `oauthClientId` description in `config.schema`.
   - **Platform setup** lives INSIDE the *Platform admin (Governance)* **closed `<Accordion>`** placed right under *Prerequisites* (see the archetype table), NOT as a tab and NOT as a standalone top-level section. The redirect URI is `<api-url>/workspaces/slug:<<SERVICE_SLUG>>/webhooks/oauthCallback`; document `<api-url>` as a placeholder for the production API URL (`https://api.studio.prisme.ai/v2`) — never enumerate non-production environments.
     - **Tenant-context + config SPA** (e.g. `google-workspaces`): the central OAuth client is entered through the **core workspace's config app** (`<studio>/apps/<<SERVICE_SLUG>>`), which writes the secrets — never instruct hand-editing Studio Secrets. There is **no auth-config JSON** in Governance; the §2 capability just points at the MCP endpoint with Scope `context_id,agent_id,user_id`.
     - **Central-OAuth via Governance** (e.g. `gitlab`): the admin stores `<<SERVICE_SLUG>>OauthClientId/Secret` in the core workspace and attaches an auth-config JSON to the Governance capability:

        ````
        ```json
        {
          "type": "oauth2",
          "status_url": "<api-url>/workspaces/slug:<<SERVICE_SLUG>>/webhooks/checkAuthStatus",
          "connect_url": "<api-url>/workspaces/slug:<<SERVICE_SLUG>>/webhooks/initiateOAuth",
          "disconnect_url": "<api-url>/workspaces/slug:<<SERVICE_SLUG>>/webhooks/disconnectOAuth"
        }
        ```
        ````

        These URLs come from the matching `automations/{checkAuthStatus,initiateOAuth,disconnectOAuth}.yml`. Without the capability grant, callers get `401 Authentication required`.
   - **DSUL examples** (`<<DSUL_EXAMPLES>>`) — 3-4 realistic snippets covering a read, a create, a compound flow, and a flagship action. Use real tool names and plausible argument values (`'{{var}}'` placeholders allowed).
   - **Tool Details** (`<<TOOL_DETAILS>>`) — deep-dive on 4-6 flagship MCP tools (usually the creates + a signature search/list). For each: JSON call example + a parameters table (Required / Description). Pull required/description from `inputSchema`.
   - **Error Handling table** (`<<ERROR_HANDLING_TABLE>>`) — HTTP codes typical for the API (401 / 403 / 404 / 422 / 429 / 500 usually suffice) + 2-4 "Common Issues" paragraphs, tailored to the archetype:
     - **Tenant-context + config SPA**: `"This agent is not authorized to use this connector"` (not allowlisted), `"The calling agent could not be identified"` (capability *Scope* missing `agent_id`), `"<Service> is not connected for this user"` (no OAuth token), `"token refresh failed … must reconnect"` (dead refresh token), `"OAuth is not configured"` (no tenant client and no central client).
     - **Central-OAuth via Governance**: `"Authentication required"` (caller not signed in / capability not granted), `"Central OAuth config missing"` (admin secrets unset), `"<Service> capability not granted"` (Governance grant missing).
     - **Static-credential**: `"Not configured"` (no credential in the app config), `"Invalid credentials"` (provider rejected the key).
     - Never use `mcp-api-key` wording (deprecated). Always add one service-specific gotcha at the end.
5. **External Resources** (`<<EXTERNAL_RESOURCES>>`) — two cards: API docs (link is `<<API_DOCS_URL>>` from phase 1) and "Tool Agents" (constant link `/products/agent-factory/capabilities`). **This and every other internal link you place will be checked in Phase 5.3 — do not invent paths.** The old `/create-agents/tool-agents/overview` path is dead (404); never emit it.

Write to `<docs-repo>/apps-store/marketplace/connectors/<slug>.mdx`. **Never** overwrite an existing file silently — if it exists, `AskUserQuestion`: overwrite / merge / abort.

### Phase 4.5 — Copy the service icon into the docs assets

**Goal**: have a local copy of the service logo so the overview card uses the real brand icon instead of a generic Font Awesome glyph. **Do NOT hotlink** `uploads.prisme.ai` / `api.<env>.prisme.ai` URLs in the MDX — those are environment-specific, can rotate, and bypass the docs CDN. The asset must live in the docs repo.

Destination convention: **`<docs-repo>/images/connectors/<slug>.<ext>`** (kebab slug + original extension). Mintlify serves the `images/` folder at root, so the icon prop becomes `/images/connectors/<slug>.<ext>`.

Resolution order — first hit wins:

1. **Local file already in the workspace folder**. Glob `<workspace>/logo.{svg,png,jpg,jpeg,webp,ico}` and `<workspace>/icon.{svg,png,jpg,jpeg,webp,ico}`. If found, `cp` it to the destination preserving the extension. This is fast and never depends on network state.
2. **Download from `photo:` URL** captured in Phase 2. Use `curl -sSL -D /tmp/headers "<photo>" -o /tmp/icon.bin`, then derive the extension from the `Content-Type` header (`image/png` → `.png`, `image/svg+xml` → `.svg`, `image/jpeg` → `.jpg`, `image/webp` → `.webp`, `image/x-icon` → `.ico`). If the Content-Type is missing or non-image, fall back to the URL's path suffix. Move the binary into place.
3. **Neither available** → ask the user via `AskUserQuestion` whether to (a) provide a path to a local image, (b) keep a Font Awesome icon name as before (fallback), or (c) skip the icon entirely.

Pre-write checks:

- Create `<docs-repo>/images/connectors/` if it does not exist (`mkdir -p`).
- If the destination file already exists, `AskUserQuestion`: overwrite / keep existing / abort. Don't overwrite silently — a tenant may have curated a hand-made SVG.
- For SVG downloads, sanity-check the first bytes start with `<svg` or `<?xml` before saving; if it looks like an HTML 403 page, abort with a clear message.
- Strip any color profiles or excessive metadata only if the user explicitly asks — by default keep the asset byte-for-byte (auditability).

Output to capture for Phase 5.1:

- `iconPath` → the relative path Mintlify will resolve (e.g. `/images/connectors/google-mail.png`). Always starts with a single leading `/`, NO repo prefix, NO file system absolute path.
- `iconFallback` → null when an asset was copied; otherwise the Font Awesome name confirmed with the user in step 3.

Report the absolute destination path to the user once the file is in place: `Copied <source> → <docs-repo>/images/connectors/<slug>.<ext> (N bytes)`.

### Phase 5 — Wire the new page into navigation

**Goal**: make the page discoverable. Two files to touch, both under `<docs-repo>/`.

#### 5.1 Add a `<Card>` in `apps-store/marketplace/connectors/overview.mdx`

1. Read `<docs-repo>/apps-store/marketplace/connectors/overview.mdx`.
2. Build the card using `./templates/overview-card.mdx`:
   ```
   <Card title="<<SERVICE_NAME>>" icon="<<ICON>>" href="/apps-store/marketplace/connectors/<<SERVICE_SLUG>>">
     <<CARD_SUMMARY>>
   </Card>
   ```
   - `<<ICON>>` — **prefer the local asset path produced by Phase 4.5** (e.g. `/images/connectors/google-mail.png`). Mintlify treats any `icon` value that isn't a known Font Awesome name as an image URL and renders it as `<img>`, so the service brand icon appears on the card instead of a generic glyph. **Never** put a hotlinked external URL here — Phase 4.5 already downloaded the file into the docs repo. Only fall back to a Font Awesome name (e.g. `ticket`, `clock`, `book`, `folder-open`, `envelope`) when Phase 4.5 explicitly bailed (no `photo:`, no local logo, user declined to provide one). Confirm the final value with the user before locking.
   - `<<CARD_SUMMARY>>` — one sentence derived from the page's intro paragraph, max ~140 chars.
3. Insert it in the existing `<CardGroup cols={2}>` under `## Available Connectors` at the right **alphabetical** slot. Don't add a new `<CardGroup>` — the existing one is authoritative.
4. Use the `Edit` tool with a narrow anchor that's unambiguous (match on an existing adjacent `<Card ...` line), not a full-file rewrite.

#### 5.2 Register the page in `docs.json` navigation

The Mintlify sidebar is driven by `<docs-repo>/docs.json`. The connector pages live in a nested group at `navigation > tabs[*] > groups > "Apps Marketplace" > pages > {group: "Connectors"} > pages`. The array is an ordered list of `"apps-store/marketplace/connectors/<slug>"` strings — `overview` is always first, the rest are alphabetical.

1. Locate the Connectors group programmatically (it has `"group": "Connectors"`). A small Python helper makes this safer than a raw Edit because nested JSON indentation is brittle:
   ```python
   import json
   p = "<docs-repo>/docs.json"
   d = json.load(open(p))
   def find(node):
       if isinstance(node, dict):
           if node.get("group") == "Connectors":
               return node
           for v in node.values():
               r = find(v)
               if r: return r
       elif isinstance(node, list):
           for x in node:
               r = find(x)
               if r: return r
   grp = find(d)
   entry = "apps-store/marketplace/connectors/<<SERVICE_SLUG>>"
   if entry not in grp["pages"]:
       # Keep overview first, rest alphabetical
       head = grp["pages"][:1]
       tail = sorted(grp["pages"][1:] + [entry])
       grp["pages"] = head + tail
       with open(p, "w") as f:
           json.dump(d, f, indent=2, ensure_ascii=False)
           f.write("\n")
   ```
2. Use this via `Bash` inline — don't hand-edit `docs.json`, a single misplaced comma breaks the whole site navigation.
3. Run a quick validation after write: `python3 -c "import json; json.load(open('<docs-repo>/docs.json'))"` should exit 0.

#### 5.3 Validate every internal link resolves (no 404s)

**Goal**: never ship a dead internal link. Mintlify routes have no file extension, so a typo or a stale path (like the retired `/create-agents/tool-agents/overview`) renders a silent 404. Check every link you placed against the actual docs repo *before* reporting.

1. Extract every link target from the page you just wrote **and** the `<Card>` you inserted in `overview.mdx`. Cover both syntaxes: `href="..."` (JSX cards) and `](...)` (markdown links).
2. Split internal vs external:
   - **Internal** = starts with `/` (a Mintlify route) — these are the ones that 404 silently and MUST be resolved against the repo.
   - **External** = `http(s)://` — leave provider/API links as confirmed in Phase 1; do not network-poll them here (flaky), but do sanity-check they are well-formed.
3. For each **internal** link, strip any `#anchor`/`?query`, then confirm it resolves to a real page or asset in `<docs-repo>`. A route `/a/b/c` is valid if any of these exists: `<docs-repo>/a/b/c.mdx`, `<docs-repo>/a/b/c/index.mdx`, or — for asset routes like `/images/...` — the literal file `<docs-repo>/a/b/c`. Belt-and-braces: also accept it if the exact string appears as a page entry in `docs.json`.
4. Run this inline via `Bash` (point `PAGE` at the new `.mdx`):

   ```python
   import re, os, json
   DOCS = "<docs-repo>"
   PAGE = "<docs-repo>/apps-store/marketplace/connectors/<slug>.mdx"
   text = open(PAGE).read()
   links = set(re.findall(r'href="([^"]+)"', text)) | set(re.findall(r'\]\((/[^)\s]+)\)', text))
   nav = json.load(open(os.path.join(DOCS, "docs.json")))
   nav_pages = set(re.findall(r'"([^"]+)"', json.dumps(nav)))
   def ok(route):
       r = route.split("#")[0].split("?")[0].strip("/")
       if not r: return True
       return (os.path.exists(os.path.join(DOCS, r+".mdx")) or
               os.path.exists(os.path.join(DOCS, r, "index.mdx")) or
               os.path.exists(os.path.join(DOCS, r)) or
               r in nav_pages)
   broken = [l for l in links if l.startswith("/") and not ok(l)]
   print("BROKEN:", broken or "none")
   ```
5. For each broken internal link, **find the correct replacement** instead of deleting the card: list the candidate pages (`grep`/`find` the docs repo, or scan `docs.json` nav) for the closest topic, pick the canonical one, and fix the `href`. The standard "Tool Agents" card → `/products/agent-factory/capabilities` (the page describing how Agent Factory agents consume MCP tools/capabilities). If no sensible target exists, leave a `<!-- REVIEW: dead link <route> — no replacement found -->` and surface it to the user in Phase 6 rather than shipping the 404.
6. Re-run the check until `BROKEN: none`. Apply the same fix to any **other** connector pages that still carry the dead link if you happen to touch them (the retired path lived in several pages).

### Phase 6 — Report

Print to the user:
- Paths **created** (the new `.mdx` page **and** the icon asset under `images/connectors/<slug>.<ext>` when Phase 4.5 produced one — give the byte size next to it so the user spots an accidentally-empty file)
- Paths **modified** (`overview.mdx`, `docs.json`)
- A deep-link preview URL (`https://docs.prisme.ai/apps-store/marketplace/connectors/<slug>` if the repo publishes to that domain — otherwise just the file path)
- Any sections flagged for human review (`<!-- REVIEW: ... -->` comments in the generated MDX)
- A reminder that `docs.json` validation passed (`json.load` succeeded)
- A reminder that the internal-link check (Phase 5.3) passed (`BROKEN: none`), and any link that had to be re-pointed
- The next recommended step: run `/app-mcp-test <workspace-slug> <environment>` to test the App+MCP workspace with real credentials before publishing or announcing the connector.

### Phase 7 — Guide the user to run the local preview

**Goal**: tell the user exactly how to see the rendered page before committing/opening a PR.

**Do NOT launch `npm start` yourself via the Bash tool** — on Apple Silicon the Claude Code Bash sandbox runs Node under Rosetta (`process.arch === "x64"`) while the user's terminal runs arm64 natively. Mintlify's `sharp` dependency ships per-arch prebuilt binaries, and `npm install` in the user's terminal only installs `sharp-darwin-arm64`, so a background `npm start` from the sandbox fails with `Could not load the "sharp" module using the darwin-x64 runtime`. The user's own terminal works fine. Running it ourselves is misleading — it looks like we broke their docs setup.

Instead:
1. Verify `<docs-repo>/package.json` has a `"start"` script (typically `"mintlify dev"`). If absent, print a fallback: `npx mintlify dev`.
2. Print a short, copy-pasteable block to the user:
   ```
   To preview:
     cd <docs-repo>
     npm start
   
   Then open:
     http://localhost:3000/apps-store/marketplace/connectors/<slug>
   
   (Mintlify prints the exact port on startup; stop the server with Ctrl+C.)
   ```
3. If the page doesn't appear, the most common cause is `docs.json` not being reloaded — Mintlify sometimes requires a restart after nav changes. Mention this as a troubleshooting note.

This avoids the architecture mismatch entirely and keeps the user in control of their dev environment.

---

## Style rules — match the reference pages

- **Tone** — neutral, factual, no marketing. Short sentences, technical vocabulary.
- **English** — the entire page is in English, regardless of user language (match existing pages). Titles use `<Card title="Tool Agents">` casing.
- **Arguments tables** — align exactly like gryzzly.mdx: `| Instruction | Arguments |` with a trailing `*` on required args. No types or descriptions in this compact table.
- **Tool Details JSON blocks** — use `"name": "<tool>"` and `"arguments": { ... }` shape; include a Parameters table below each block with Required column.
- **No emojis** in prose. `<Note>` / `<Warning>` admonitions are fine.
- **External links** — use Mintlify `<Card icon="..." href="...">` format, not plain Markdown.
- **No mention of Prisme.ai internals** (correlationId, DSUL break scope, etc.) — this is user-facing.

---

## Common traps

- **Don't fabricate categories** — if the API clearly has 6 resources, don't invent a 7th. If unsure, ask the user.
- **Don't paraphrase tool descriptions** that already read well in `index.yml`. Copy them verbatim (truncate only if exceedingly long).
- **Don't over-detail the Tool Details section** — 4-6 tools is the sweet spot. More and the page becomes a dumping ground.
- **`<Tabs>` / `<Tab>` / `<Accordion>` are Mintlify components** — keep the exact casing. The body has **two tabs**, in order: `Agent builder (Agent Factory)`, `Workspace builder (DSUL)`. The **Platform admin (Governance)** content is a **closed `<Accordion>`** placed right under *Prerequisites* (above the `<Tabs>`), NOT a third tab. An `<Accordion>` with no `defaultOpen` is collapsed by default — that is the intended state (one-time setup, most readers skip it). Do not wrap a single accordion in an `<AccordionGroup>`.
- **Mintlify headings inside `<Tab>` / `<Accordion>`** — use `##` for top-level within the container (e.g. `## Installation`, `## 1. Configure the connector`), `###` for sub-categories. Do not skip levels.
- **Each tab MUST open with its audience `##` heading** — `## Agent builder` as the first line inside the *Agent builder* tab, `## Workspace builder` inside the *Workspace builder* tab. Mintlify excludes tab *labels* from the "On this page" TOC but DOES include headings inside the active tab, so this opener is the only way the audience title appears in the right-hand TOC. Keep it short (`Agent builder`, not the full `Agent builder (Agent Factory)` label) to avoid visual redundancy with the tab button. Confirmed working on `google-search.mdx`.
- **The overview card order is alphabetical** — insert at the right position. Hunt for an adjacent card whose title comes just before/after and anchor the `Edit` there.
- **Never hotlink the workspace `photo:` URL** in the MDX. Those `uploads.prisme.ai` / `api.<env>.prisme.ai` URLs are env-specific (a sandbox file URL breaks once published to prod docs), rotate on workspace re-creation, hit the platform CDN instead of the docs CDN, and leak a request to a third-party host on every page render. Phase 4.5 copies the binary into `<docs-repo>/images/connectors/<slug>.<ext>` for that reason — use that relative path.
- **Don't skip the `<<HEADER_ICON>>` lettrine.** Phase 4 substitutes a float-left `<img width="96">` at the very top of the body so the connector page opens on the service's brand mark (the same asset that drives the overview card icon). It is what makes a connector page recognizable in a tab of 20 docs. Only omit it when Phase 4.5 had no asset to copy. Keep the exact JSX shape from the SKILL — the `float: left` + `marginRight` + `marginBottom` combo is what wraps the intro paragraph around the icon; changing it to `<Frame>` or centering it breaks the lettrine effect.
