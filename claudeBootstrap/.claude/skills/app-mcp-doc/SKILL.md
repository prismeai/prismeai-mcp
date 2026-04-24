---
name: app-mcp-doc
description: Generate public documentation (MDX) for a Prisme.ai App+MCP connector, mirroring the structure of existing pages (gryzzly.mdx, data-galaxy.mdx, …) in the prismeai/docs repo. Produces one `apps-store/marketplace/connectors/<slug>.mdx` page and inserts a matching `<Card>` into `overview.mdx`. Use when the user says "document the X app+mcp", "écris la doc de X", "/app-mcp-doc X", or similar. Assumes the source workspace already exists locally (scaffolded by `/app-mcp`).
argument-hint: "[workspace-slug]"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, Agent
---

# App + MCP documentation writer

You are producing the **public, user-facing documentation** for a connector that already exists as a local Prisme.ai App+MCP workspace. The output is an MDX page in the `prismeai/docs` repo (Mintlify-flavoured) matching the layout of existing connector pages like `gryzzly.mdx`, `data-galaxy.mdx`, `monday.mdx`.

**Three deliverables**, all under `<docs-repo>/`:
- **`apps-store/marketplace/connectors/<slug>.mdx`** — the full connector page
- An inserted **`<Card>`** in `apps-store/marketplace/connectors/overview.mdx` under `## Available Connectors`, in alphabetical order
- A new entry in **`docs.json`** → `navigation > … > "Apps Marketplace" > "Connectors" > pages`, alphabetical (overview stays first)

---

## Output layout (reference)

Every connector page is built from this skeleton:

```
---
title: '<Service>'
description: '<One-line description for SEO>'
---

<Intro paragraph>             — what the connector exposes, usable as App or MCP
<CardGroup cols={3}>          — 3 top-level feature categories
  <Card icon="..." title="...">...</Card> × 3

## Prerequisites              — account, credentials, base URL

<Tabs>
  <Tab title="Usage as App">
    ## Installation
    ## Configuration          — config.schema table
    ## Available Instructions — one table per resource category
    ## DSUL Examples          — 3-5 realistic snippets
  </Tab>

  <Tab title="Usage as MCP">
    <intro + Legacy MCP Install Steps>
    ## Output Formats
    ## Available Tools        — one table per resource category
    ## Tool Details           — deep-dive on 4-6 flagship tools
  </Tab>
</Tabs>

## Error Handling             — HTTP codes + common issues
## External Resources         — API docs + Tool Agents cards
```

Read `./templates/reference-example.mdx` (bundled with this skill) once before writing anything. It's a verbatim copy of the `Gryzzly` connector page — the canonical reference. Anything inconsistent with it is a bug.

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
- `photo` → logo URL (used as reference, not in the MDX)
- `config.schema` → build the Configuration table
  - Fields flagged `readOnly: true` go in the table as "Auto-populated on install"
  - Fields flagged `secret: true` mention "stored as a workspace secret"
  - `baseUrl` always shown with its default from `config.value.baseUrl`
- `config.value.mcpTools[]` → tool list to categorize

Also introspect:
- `automations/buildAppAuth.yml` → identify the auth mode (static token / Basic / OAuth2 client-credentials / OAuth2 AC) — affects wording of the Prerequisites + Configuration tables.
- `automations/initiateOAuth.yml` (optional) → if present, document the OAuth flow as an extra step inside the `Usage as App` tab (how tenant admins set it up).

### Phase 3 — Categorize the tools

**Goal**: group the ~N tools into ~6-10 thematic categories matching the resource model of the underlying API.

Default algorithm (Python, inline via Bash):
1. For each tool `name`, strip the leading verb (`list|get|search|create|update|delete|add|remove|close|reopen|approve|unapprove|merge|cancel|retry|revert|cherryPick|archive|unarchive|fork|stop|invite`).
2. Map the remaining noun to a category label. Singularize trivially (e.g. `Projects` → `Project`). Multi-word nouns split on camelCase (`IssueNote` → `Issue Note`).
3. Group related resources together when it feels natural: `Issue` + `IssueNote` → "Issues"; `MergeRequest` + `MergeRequestNote` → "Merge Requests"; `Tag` + `Tagset`.
4. OAuth-only tools (`connect`, `disconnect`) go at the bottom as an "OAuth Session" sub-section.

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
3. **Auto-generate** the dynamic sections:
   - **Feature cards** (`<<FEATURE_CARDS>>`) — 3 cards. Infer from the top categories; icon is a Mintlify Font Awesome name (e.g. `book`, `diagram-project`, `users`, `clock`, `plug`). Ask the user to review before locking.
   - **Configuration table** (`<<CONFIG_TABLE>>`) — rendered from `config.schema` non-readOnly fields + the two standard readOnly `MCP Endpoint` / `MCP API Key` rows. OAuth fields get their own section below the main table when present.
   - **Instructions tables** (`<<INSTRUCTIONS_TABLES>>`) — one `### CategoryName` + table per category (columns: Instruction, Arguments). Arguments list comes from `inputSchema.properties` minus `outputFormat`. Required args get a `*` suffix.
   - **MCP tools tables** (`<<MCP_TOOLS_TABLES>>`) — same grouping, columns (Tool, Description). Description is the mcpTool's own description, truncated if >100 chars.
4. **Assisted-generate** the remaining sections — present a draft to the user, let them refine:
   - **Prerequisites** (`<<PREREQUISITES>>`) — bullet list with account type, credentials source (UI path at the provider), base URL. Infer from `config.schema` descriptions + `oauthClientId` description (which already contains the provider app URL, captured at scaffold time in `/app-mcp` Phase 1).
   - **DSUL examples** (`<<DSUL_EXAMPLES>>`) — 3-4 realistic snippets covering a read, a create, a compound flow, and a flagship action. Use real tool names and plausible argument values (`'{{var}}'` placeholders allowed).
   - **Tool Details** (`<<TOOL_DETAILS>>`) — deep-dive on 4-6 flagship MCP tools (usually the creates + a signature search/list). For each: JSON call example + a parameters table (Required / Description). Pull required/description from `inputSchema`.
   - **Error Handling table** (`<<ERROR_HANDLING_TABLE>>`) — HTTP codes typical for the API (401 / 403 / 404 / 422 / 429 / 500 usually suffice) + 2-4 "Common Issues" paragraphs (generic: "Not configured" / "Invalid API key (MCP)" / "Credentials lookup failed" + one service-specific gotcha). Adapt the provider-name references.
5. **External Resources** (`<<EXTERNAL_RESOURCES>>`) — two cards: API docs (link is `<<API_DOCS_URL>>` from phase 1) and "Tool Agents" (constant link `/create-agents/tool-agents/overview`).

Write to `<docs-repo>/apps-store/marketplace/connectors/<slug>.mdx`. **Never** overwrite an existing file silently — if it exists, `AskUserQuestion`: overwrite / merge / abort.

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
   - `<<ICON>>` — pick a concise Font Awesome name that fits (e.g. `ticket` for ticketing, `clock` for time tracking, `book` for catalogs, `folder-open` for files, `envelope` for email). Ask the user to confirm.
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

### Phase 6 — Report

Print to the user:
- Paths **created** (the new `.mdx` page)
- Paths **modified** (`overview.mdx`, `docs.json`)
- A deep-link preview URL (`https://docs.prisme.ai/apps-store/marketplace/connectors/<slug>` if the repo publishes to that domain — otherwise just the file path)
- Any sections flagged for human review (`<!-- REVIEW: ... -->` comments in the generated MDX)
- A reminder that `docs.json` validation passed (`json.load` succeeded)

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
- **`<Tabs>` / `<Tab>` are Mintlify components** — keep the exact casing and make sure the two tabs are named "Usage as App" and "Usage as MCP" (verbatim).
- **Mintlify headings inside `<Tab>`** — use `##` for top-level within the tab (e.g. `## Installation`), `###` for sub-categories. Do not skip levels.
- **The overview card order is alphabetical** — insert at the right position. Hunt for an adjacent card whose title comes just before/after and anchor the `Edit` there.
