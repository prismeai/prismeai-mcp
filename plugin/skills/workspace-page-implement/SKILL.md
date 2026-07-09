---
name: workspace-page-implement
description: Edit a React app embedded in a Prisme.ai workspace (starter-spa pattern). Bootstraps from github.com/prismeai/starter-spa if the workspace has no app yet, then modifies src/ (React) and/or automations/ (DSUL), builds the CJS bundle if needed, and pushes to the workspace via the prisme-ai-builder MCP (automations) + direct fetch (bundle/files/config). Use when the user says "edit the X app", "modifier l'app de <workspace>", "/workspace-page-implement <workspace> <change>", or when src/App.tsx + scripts/deploy.mjs are detected in a workspace folder.
argument-hint: "[workspace-folder] <description of the change>"
allowed-tools: Read, Grep, Glob, Edit, Write, Bash, AskUserQuestion, Task, mcp__prisme-ai-builder__get_prisme_documentation, mcp__prisme-ai-builder__validate_automation, mcp__prisme-ai-builder__validate_automation, mcp__prisme-ai-builder__create_automation, mcp__prisme-ai-builder__update_automation, mcp__prisme-ai-builder__delete_automation, mcp__prisme-ai-builder__get_automation, mcp__prisme-ai-builder__list_automations, mcp__prisme-ai-builder__pull_workspace, mcp__prisme-ai-builder__push_workspace, mcp__prisme-ai-builder__search_workspaces
---

# Skill `/workspace-page-implement` — Prisme.ai workspace-embedded React app editor

This skill edits the React app embedded in a Prisme.ai workspace (the starter-spa
pattern : `dist/bundle.js` CJS hosted as a public file of the workspace, referenced
via `config.value.bundles[<slug>]`, loaded at runtime by the platform's `AppRenderer`).

**Reference repo**: `https://github.com/prismeai/starter-spa`. A working local
example is `/Users/hadrien/Documents/pptx-generator/` — read its `AGENTS.md` and
`scripts/deploy.mjs` when in doubt about the contract.

The app **lives in `pages/<workspace>/`** — a TOP-LEVEL folder that is a SIBLING
of `workspaces/` at the repo root, **named after the workspace** (strict 1:1 by
name; `pages/<workspace>/` ↔ `workspaces/<workspace>/`). The workspace folder
`workspaces/<workspace>/` stays DSUL-pure (`index.yml`, `security.yml`,
`.import.yml`, `automations/`, `imports/`), and the React project (`src/`,
`scripts/`, `package.json`, `dist/`, `node_modules/`, `.env`, `.prismeai/`, etc.)
lives in the sibling tree `pages/<workspace>/`.

```
prismeai-workspaces/
├── workspaces/<workspace>/   ← DSUL only (index.yml, automations/, imports/, security.yml)
└── pages/<workspace>/        ← React app (src/, scripts/, package.json, dist/, node_modules/)
```

**One app per workspace, named after the workspace, is the convention.** If a
second app is ever genuinely needed (rare / defensive), add a sibling
`pages/<workspace>-<variant>/` folder. See [[convention_react_app_nested]] for the
full rationale.

> **Legacy layout warning** — older workspaces use one of two now-legacy layouts:
> (1) the React project flat at the workspace root (`workspaces/<ws>/src/App.tsx`
> directly, no subfolder), or (2) the React project NESTED inside the workspace
> at `workspaces/<ws>/pages/<appName>/`. Both are deprecated; the current
> convention is the sibling `pages/<workspace>/` tree. If you encounter either
> legacy form, treat it as legacy and either keep it or offer migration to the
> sibling layout.

## Conventions (recap — read before bootstrapping)

Treat each bullet as a checklist item when bootstrapping a new app.

1. **Layout** : React project in `pages/<workspace>/` (sibling of `workspaces/`,
   named after the workspace). The workspace folder `workspaces/<workspace>/`
   = DSUL only (`index.yml`, `automations/`, `imports/`).
2. **`metadata.path` of source files stays CANONICAL** (`src/App.tsx`,
   `package.json`, etc.) — **never** prefix with the app-dir path. The Studio
   derives its editable source-view from canonical paths ; prefixing makes the
   auto-page disappear with an `InvalidVersionError` alert. Local↔remote
   asymmetry is intentional. See [[convention_react_app_nested]].
3. **Studio SPA detection needs NO automation** (corrected 2026-07-07, verified on
   workspace `cat-ia-v2`). Detection is driven by the **source files**
   (`metadata.type=source`) + the **`config.value.bundles[<slug>]`** pointer — the
   editable source-view appears from those alone. The starter ships two *demo*
   automations, `v1/status` and `on-app-greeting-requested`, but they are **example
   endpoints, not a requirement** : `v1/status` is only a health-check the starter's
   `App.tsx` pings, and `on-app-greeting-requested` is a demo async echo. If you drop
   the starter's ping/greeting demo (as any real app does), **delete both** — they
   add nothing at runtime and each `v1/status` hit runs an automation. Keep
   `v1/status` only if you keep the template's ping in `App.tsx`. See
   [[feedback_studio_spa_detection_no_automations]].
4. **MCP `upload_file` drops the `metadata` parameter silently** — uploads
   succeed but server-side `metadata: {}` ends up empty. Use `curl` multipart
   with explicit `metadata.path` / `metadata.type` / `metadata.hash` form
   fields for source uploads (or follow `upload_file` with a
   `PATCH /workspaces/:id/files/:id {metadata:{path,type:'source',hash}}`).
   See [[feedback_mcp_upload_file_metadata_dropped]].
   **PLATFORM FIX 2026-06-23 ~11:30 (commit `ada8572b7` `fix/native-files-upload-metadata`,
   `services/workspaces/src/utils/uploadMetadata.ts`)**: the upload route now
   persists both the top-level `metadata` object AND `metadata.<key>` form fields,
   so on an env running ≥ that build the drop is gone. **Why this matters for the
   native preview**: a source file uploaded/saved WITHOUT `metadata.path` is keyed
   by its bare `file.name` (no `src/` prefix) in the sandbox files-map, so the
   preview compiler's `@/x → src/x` alias resolution FAILS for it (relative `./x`
   still resolves). Symptom: `@/lib/utils` red-underlined / `(0, import_utils3.readParam)
   is not a function`, `./` works — NOT a compiler/alias bug (`resolveInVfs` is
   correct); the cause is the dropped `metadata.path`. On a fixed env, keep `@/`
   imports and just re-save/redeploy so files regain `metadata.path`.
5. **In-Builder Builder cannot resolve npm deps outside the socle**
   (`@react-three/*`, `three`, viz libs, etc.). If your app depends on those,
   **warn the user not to click the "Déployer" UI button** — it rebuilds from
   sources and overwrites your good bundle with a broken one. Build locally +
   push the prebuilt bundle. See [[feedback_inbuilder_builder_limited_deps]].
6. **`pages/*.yml` (DSUL Pages) is deprecated** — don't create new ones. (Legacy
   DSUL pages may still sit in `workspaces/<workspace>/pages/*.yml`; don't add
   more.) The React app no longer lives under the workspace — it's the top-level
   sibling `pages/<workspace>/`. See [[feedback_dsul_pages_yml_deprecated]].
7. **The bundle key in `config.value.bundles` MUST equal the workspace slug**.
   The Studio routes `/apps/<X>` by looking up `config.value.bundles[<X>]`
   where `<X>` is the workspace slug — an arbitrary key (e.g.
   `connector-callback` on a workspace whose slug is `gitlab`) yields
   "L'application X n'existe pas ou a été dépubliée". The app folder
   `pages/<workspace>/` is named after the workspace, so it normally matches the
   bundle key — but the key that matters is always the workspace slug. **The
   platform currently exposes only ONE bundle per workspace** : if you ever need
   multiple views, route them via `?status=`, `?view=`, or `?screen=` query
   params inside the single bundle, not separate `bundles.X` entries.
8. **Follow the STUDIO theme via a `.dark` class — NEVER `@media (prefers-color-scheme)`.**
   The Studio toggles a `.dark` class on `<html>` per its own theme (default light;
   app-mcp Gotcha 10) and the app inherits it. So gate the dark palette on the **`.dark`
   selector** in `globals.css` (`.dark { --background: …; }`). **Do NOT** gate it on
   `@media (prefers-color-scheme: dark)` — that follows the **OS**, not the studio, so a
   user with a dark OS gets a dark app inside a light studio (the classic "forgot the
   light theme" bug — hit on AgentBuilderSync 2026-06-26). `darkMode: 'class'` in
   `tailwind.config.js` is the matching setting if you use `dark:` utilities (raw `.dark
   { --vars }` works regardless). **Put the `.dark { --vars }` block OUTSIDE `@layer base`**
   (plain CSS) — inside `@layer base` Tailwind PURGES it (the `.dark` class is never
   referenced in `src/`; the Studio adds it on `<html>` at runtime), so the bundle ships
   `:root`-only = permanently light even in a dark studio (same 2026-06-26 incident). Avoid
   `bg-X dark:bg-Y` on the root wrapper too : if the
   app is rendered inside a Studio shell, a full-bleed background paints a visible frame
   around the content in the host's theme. Let the host provide the page background ;
   only style the card itself.
9. **Localize via `navigator.language`** when the app surfaces user-facing
   strings. Detection walks `navigator.languages` then falls back to
   `navigator.language` and finally to a hard default (usually `en`).
   Strings live in `MESSAGES: Record<Locale, Messages>` ; the component
   reads `MESSAGES[detectLocale()]`. Pattern from `pages/gitlab/src/App.tsx`
   (the `gitlab` workspace's app, sandbox).

---

## Arguments

- `$1` (optional) — the workspace folder (path or name).
- `$2..` — natural-language description of the change to make.

If `$1` is missing or ambiguous, run Phase 1 detection.

---

## Phase 1 — Resolve the target workspace

1. If `$1` is provided, treat it as a workspace name (or a path to its DSUL
   folder, absolute or relative to cwd). Resolve `<workspace>` = the workspace
   name/slug.
   - `Glob: workspaces/<workspace>/index.yml` to confirm it's a Prisme.ai workspace folder.
   - If no `index.yml`, abort with a clear error.
2. If `$1` is missing, run `Glob: workspaces/*/index.yml`. If multiple workspaces are
   present, ask the user via `AskUserQuestion` which one to target.
3. Read `workspaces/<workspace>/index.yml` to extract the workspace `id`, `name`, `slug`.
4. Detect the layout mode and operation :
   - **Sibling layout** (current convention) : check for `pages/<workspace>/scripts/deploy.mjs` via Glob.
     - Match present → **Edit** mode targeting that app (run Phase 2B).
     - No match → **Bootstrap** (run Phase 2A, scaffold under `pages/<workspace>/`).
   - **Legacy nested layout** : if `workspaces/<workspace>/pages/*/scripts/deploy.mjs` exists → **Edit** mode on the (now deprecated) nested app. Offer (don't force) migration to the sibling `pages/<workspace>/` before editing.
   - **Legacy flat layout** : if `workspaces/<workspace>/scripts/deploy.mjs` + `workspaces/<workspace>/src/App.tsx` exist at the workspace root → **Edit** mode on the legacy layout. Offer (don't force) migration to `pages/<workspace>/` before editing.
   - **Hybrid / corrupted** : files split between the legacy locations and `pages/<workspace>/` → ask the user before continuing.

In all cases, set the variable `<appDir>` = the path to the app's project root (`pages/<workspace>/` in the current sibling layout ; `workspaces/<workspace>/pages/<appName>/` or `workspaces/<workspace>/` for the two legacy layouts). All subsequent `cd`/path references in this skill use `<appDir>`. The default `<appName>` collapses to the workspace slug.

### Caveat — creating a brand-new remote workspace (rare)

If the user asks to create a brand-new workspace on Prisme.ai (not just bootstrap
an app inside an existing one), call `mcp__prisme-ai-builder__create_workspace`. Two things to know:

- **`create_workspace` ignores the `slug` parameter** — the platform auto-generates a slug like `fast-duck-97`. If the user wants a specific slug (e.g. `pptx-generator`), PATCH it **after** creation:
  ```bash
  curl -X PATCH "$API/workspaces/$ID" -d '{"slug":"pptx-generator"}'
  ```
  (will 4xx if the slug is already taken on the same env — slugs are globally unique per env)
- After renaming the slug, propagate it to every file that hardcodes it: `src/App.tsx` (`APP_WORKSPACE_SLUG`), `automations/onInstall.yml` (`slug:<workspace>/webhooks/*`), `automations/method-openUI.yml` (`/apps/<workspace>`), and the `bundles` key in `config.value.bundles`. **Rebuild the bundle** after the source change.

---

## Phase 2 (common) — Use the configured Prisme.ai MCP environment

Use the `prisme-ai-builder` MCP tools with an explicit `environment` parameter.
If the environment or token is not configured, stop and follow `/prisme-ai:setup`;
do not ask the user to paste a token into the chat unless they explicitly choose
the `set_token` fallback after being warned.

1. Pick the environment:
   - Default `sandbox` unless the user's request contains `prod` / `production`.
   - When ambiguous, ask before continuing.
2. Use MCP tools with the selected `environment` and either `workspaceName` or
   `workspaceId`. If setup is missing, follow `/prisme-ai:setup`.
3. For local frontend `.env` files, never extract or print the MCP token. Tell the
   user to create a token at `<studio-url>/settings/tokens` and fill the local
   `.env` value in their own terminal/editor.

---

## Phase 2A — Bootstrap (when no app exists yet)

By default `<appName>` = workspace slug, and the app folder is named after the
workspace : `<appDir>` = `pages/<workspace>/`.

1. Confirm with the user: "Le workspace `<name>` n'a pas encore d'app React. Je bootstrap depuis github.com/prismeai/starter-spa dans `pages/<workspace>/` sur `<env>` ?"
2. Download the starter tarball:
   ```bash
   curl -fL https://github.com/prismeai/starter-spa/archive/refs/heads/main.tar.gz -o /tmp/starter-spa.tgz
   rm -rf /tmp/starter-spa-main
   tar -xzf /tmp/starter-spa.tgz -C /tmp/
   ```
3. Create `<appDir>` and copy the starter contents into it. Exclude `automations/`
   (the DSUL folder `workspaces/<workspace>/` owns DSUL), `.git*`, `dist/`, `node_modules/`,
   `package-lock.json`, `.env`, `TODO.md`, `package.json` and `src/App.tsx`
   (both templated below):
   ```bash
   mkdir -p pages/<workspace>
   rsync -av \
     --exclude='automations' \
     --exclude='.git*' \
     --exclude='dist' \
     --exclude='node_modules' \
     --exclude='package-lock.json' \
     --exclude='.env' \
     --exclude='TODO.md' \
     --exclude='package.json' \
     --exclude='src/App.tsx' \
     /tmp/starter-spa-main/ pages/<workspace>/
   ```
4. Render the 3 templates from this skill's `templates/` folder. **All variables
   are auto-filled — never prompt the user for these values**:

   | Template | Target | Variables |
   |---|---|---|
   | `templates/App.tsx.tpl` | `<appDir>/src/App.tsx` | `{{workspace_name}}` (from `index.yml > name` or folder name) |
   | `templates/package.json.tpl` | `<appDir>/package.json` | `{{name}}` (kebab-case of `<appName>`), `{{workspace_name}}` |
   | `templates/env.tpl` | `<appDir>/.env` | `{{api_url}}`, `{{workspace_id}}`, `{{studio_url}}`; the user fills `PRISMEAI_ACCESS_TOKEN` locally |

   Use `Read` + string replacement, then `Write` to the target. Don't echo
   access tokens to the conversation.

5. `chmod 600 <appDir>/.env` (defense-in-depth against accidental read).
6. Verify `<appDir>/.gitignore` excludes `.env` (already done by the tarball — `Read` and `Grep` to confirm).
7. Install deps :
   ```bash
   cd <appDir> && npm install
   ```

7b. **Bootstrap hardening — apply these BEFORE the first build.** All three ship
    broken in starter-spa and each is a *recurring* boot-time crash if skipped
    (observed again 2026-06-23). Fix them proactively, don't wait for the smoke test.

    a. **Trim `scripts/externals.mjs` to the real socle.** starter-spa marks
       `@radix-ui/react-label`, `@radix-ui/react-switch`, `@radix-ui/react-slider`
       as host-provided, but the AppRenderer socle does **not** expose them →
       `ModuleLoadError: Module "@radix-ui/react-label" is not available in the
       shared socle` at boot (a bundled `<Label>`/shadcn input is enough to hit it).
       **Remove those three lines** so esbuild bundles them. The runtime's
       `ModuleLoadError` prints the exact "Available modules" list — trim to match
       if any other module surfaces. See [[feedback_starter_spa_externals_drift]].

    b. **Keep dark mode CLASS-based (`.dark { … }`) in `src/styles/globals.css` — do NOT
       convert it to `@media (prefers-color-scheme)`.** The Studio toggles a `.dark` class
       on `<html>` per its theme (app-mcp Gotcha 10), so the starter-spa's `.dark { … }`
       block is exactly right: the app follows the STUDIO theme. An `@media
       (prefers-color-scheme: dark)` override follows the **OS** instead → dark app inside a
       light studio (the "forgot the light theme" bug, hit on AgentBuilderSync 2026-06-26).
       Set `darkMode: 'class'` in `tailwind.config.js` if you use `dark:` utilities (raw
       `.dark { --vars }` works regardless). Also drop the full-bleed `body { @apply
       bg-background … }` (keep only `text-foreground`) so the app doesn't paint a frame in
       the host's theme. Cf. rule 8.

    c. **Don't rely on lucide-react icons beyond a tiny verified set.** lucide-react is
       external (socle) and the socle ships only a **curated subset** (~250 icons). A
       valid-looking import (`FileSpreadsheetIcon`, `PresentationIcon`, …) that isn't in
       the subset resolves to `undefined` at runtime and the whole app crashes with
       **Minified React error #130** ("Element type is invalid … got: undefined") — and
       **typecheck passes**, because TS sees the full npm package. Safest default for a
       fresh app: a **CSS spinner** for loading and **inline SVG / emoji** for decoration;
       add lucide icons only one-by-one after confirming each renders. Cf. rule 7.

8. First build :
   ```bash
   cd <appDir> && npm run build
   ```
   If it fails, surface the esbuild output to the user. Don't proceed.

9. **(Optional) Starter demo automations — NOT required for SPA detection** (cf.
   convention 3 ; the editable source-view comes from the source files +
   `config.value.bundles` pointer alone). Create `v1/status` **only if** you keep
   the starter template's health-check ping in `App.tsx` ; otherwise skip it.
   `on-app-greeting-requested` is a pure demo echo — skip it unless you want the
   greeting round-trip. For reference, the YAMLs are :

   `workspaces/<workspace>/automations/v1/status.yml` :
   ```yaml
   slug: v1/status
   name: API/v1/Status
   description: 'Sync: HTTP endpoint that returns the current server status'
   when:
     endpoint: true
   do:
     - set:
         name: result
         value:
           status: ok
           timestamp: '{{run.date}}'
   output: '{{result}}'
   ```

   `workspaces/<workspace>/automations/on-app-greeting-requested.yml` :
   ```yaml
   slug: on-app-greeting-requested
   name: On App Greeting Requested
   description: 'Async: listens for "app.greeting.requested" and responds with "app.greeting.completed"'
   when:
     events:
       - app.greeting.requested
   do:
     - emit:
         event: app.greeting.completed
         payload:
           message: Hello {{app.greeting.requested.name}} from the automation!
   ```

   Push each via `mcp__prisme-ai-builder__create_automation` (the MCP handles
   the slashed slug `v1/status` correctly for `create_automation`, unlike
   `update_automation` — cf. [[feedback_mcp_update_automation_slash_slugs]]).

10. **Warn the user if the app depends on packages outside the runtime socle**
    (three.js, @react-three/*, recharts, d3, viz libs, etc. — anything not in
    `scripts/externals.mjs`). Tell them to **never click the UI "Déployer"
    button** for this app: the in-Builder Builder cannot resolve those deps
    and would overwrite the good bundle with a broken one. Cf.
    [[feedback_inbuilder_builder_limited_deps]].

11. Optionally proceed to a first deploy (Phase 7). For a fresh bootstrap, ask
    the user first — "Premier deploy maintenant ?".

---

## Phase 2B — Defensive state pull (Edit mode)

1. Check `<appDir>/.env` exists. If the token is empty or expired, regenerate
   from the MCP env (same logic as bootstrap step 4, only `.env`).
2. Read `<appDir>/.prismeai/last-pull.json` if present.
3. If missing or older than 24h, do a defensive sync before editing :
   - **DSUL (automations + imports + index.yml)** : `mcp__prisme-ai-builder__pull_workspace(workspaceId, path: workspaces/<workspace>)` (pulls into the **DSUL workspace folder**, never into `<appDir>`).
   - **Source files + bundle config** : direct API (the MCP doesn't cover these) :
     ```bash
     curl -fsS -H "Authorization: Bearer $TOKEN" \
       "$API_URL/workspaces/$WORKSPACE_ID/files?metadata.type=source&limit=200"
     curl -fsS -H "Authorization: Bearer $TOKEN" \
       "$API_URL/workspaces/$WORKSPACE_ID" | jq '.config.value.bundles'
     ```
     Remote `metadata.path` is canonical (`src/App.tsx`, etc. — NOT prefixed
     with the app-dir path). The local source files live in `<appDir>/<path>`.
     The mapping is **local `<appDir>/<path>` ↔ remote `metadata.path = <path>`** —
     this asymmetry is intentional, see [[convention_react_app_nested]].
     The exact path/payload contract lives in `<appDir>/scripts/pull.mjs` —
     Read it when you need the details.
4. Diff against the local files. If divergences are found, surface them and ask
   the user whether to integrate before editing.
5. Goal : avoid overwriting work done by another dev in the platform UI.

---

## Phase 3 — Understand the request

Before editing :

1. Read `<appDir>/AGENTS.md` (authoritative — defers to `scripts/deploy.mjs` for the contract).
2. Read `<appDir>/README.md` (host contract section).
3. Read `<appDir>/src/types.ts` (the `AppProps` contract).
4. Read `<appDir>/src/App.tsx` (entry point).
5. If the request touches automations :
   - `Glob: workspaces/<workspace>/automations/**/*.yml` → list, read concerned files. (Automations live in the DSUL folder `workspaces/<workspace>/`, never in `<appDir>`.)
   - Call `mcp__prisme-ai-builder__get_prisme_documentation(section: "automations")` for DSUL syntax.
6. Read `<appDir>/scripts/deploy.mjs` only when you need exact endpoint/payload shapes for direct fetch calls.

---

## Phase 4 — Hard rules (apply during edits)

These come straight from `pptx-generator/AGENTS.md`. They MUST be respected.

1. **Externals = modules provided by Prisme.ai at runtime** — `scripts/externals.mjs`
   is a **closed list** : React, some Radix-*, lucide-react, clsx, tailwind-merge,
   class-variance-authority, jotai, `@prisme.ai/sdk`. These must **never** end up
   in `dist/bundle.js` (else duplicate React → "Invalid hook call").
   **All other dependencies** (axios, zod, date-fns, react-query, etc.) are
   bundled normally by esbuild — **do not** add them to `externals.mjs`.

   ⚠️ **starter-spa's externals.mjs drifts from the real runtime socle** (verified
   2026-05-12: it listed `react-label`, `react-switch`, `react-slider` which the
   AppRenderer does NOT actually pre-load, causing a `ModuleLoadError` at boot).
   On first deploy to a new env, open the rendered app once, copy the runtime's
   "Available modules" list from any `ModuleLoadError`, and **trim externals.mjs
   to match**. Then rebuild + re-upload. See `feedback_starter_spa_externals_drift.md`.

2. **Default-export contract — accept both prop shapes** :
   ```tsx
   export default function App(props: AppProps)
   ```
   Studio's `AppRenderer` passes `{sdk, user, workspace, backends, agents}` ;
   embed.js (canvas inline / popover / modal / sidebar / bottom-sheet) passes
   a different shape (`{workspaceId, workspaceSlug, apiUrl, consoleUrl, token, ...}`).
   For studio-only apps the legacy `{sdk}` destructuring works ; for any app
   that also targets the canvas, type as `AppProps = Partial<StudioProps> & EmbedProps`
   and build a synthetic sdk in embed mode. See **Phase 9** below + memories
   [[feedback_embed_js_prop_shape]] [[feedback_embed_js_no_data_token]].

3. **No `process.env.*` in `src/`** — that's Node-only. Browser code uses
   `import.meta.env.VITE_*` (Vite convention). Node scripts (`scripts/*.mjs`) keep
   `process.env.*`.

4. **Don't commit `.env`** (already gitignored). If the user adds a new env var,
   document it in `.env.example` AND in the README's "Environment variables" table.

5. **No templating in `automations/`** — YAMLs are pushed as-is. Don't introduce a
   build step there.

6. **Keep both auth paths working** : `PRISMEAI_ACCESS_TOKEN` (Bearer) AND
   `PRISMEAI_API_KEY` (`x-prismeai-api-key`) in scripts/deploy.mjs.

7. **lucide icons** : stick to the curated subset (~250 icons) guaranteed at
   runtime. A missing icon resolves to `undefined` at load time → the app crashes
   with **Minified React error #130** ("Element type is invalid … got: undefined").
   **Typecheck does NOT catch this** (TS sees the full npm package; the socle ships a
   subset). When in doubt, use a CSS spinner + inline SVG instead — see bootstrap step 7b.

8. **Tailwind classes** : stick to standard utility classes present in the
   platform's pre-compiled CSS. **Arbitrary value classes (`h-[70vh]`,
   `w-[min(90vw,720px)]`, `max-w-[24rem]`, `min-w-[16rem]`…) are NO-OPS** — the
   renderer ships a pre-compiled stylesheet without JIT, so bracket utilities
   never match and silently do nothing (symptom: a "fullscreen" modal that
   shrinks to its content). For any non-standard dimension/transform, use an
   inline `style={{…}}` instead. Stick to safe theme tokens too
   (`bg-background/card/muted/accent`, not `bg-popover`).

9. **Tooltips** : never rely on the native `title=` attribute for tooltips —
   it's inconsistent and unstyled. Use a real floating tooltip: the scaffold's
   `@/components/ui/tooltip` (Radix, `@radix-ui/react-tooltip` is in the socle).
   Wrap the subtree in one `<TooltipProvider>` and use
   `<Tooltip><TooltipTrigger asChild>{button}</TooltipTrigger><TooltipContent>…</TooltipContent></Tooltip>`
   (a tiny `Tip({label,children})` helper keeps it DRY). Keep `aria-label` on
   icon-only buttons for a11y; drop the redundant `title`.

10. **Don't touch `src/components/ui/*`** without explicit user request — that's
    shadcn scaffold, regenerated by the in-builder AI.

---

## Phase 5 — Make the edits

- **React** : `Edit` / `Write` files under `<appDir>/src/` (e.g. `pages/<workspace>/src/`).
- **Automations** : `Edit` / `Write` YAML files under `workspaces/<workspace>/automations/` (the DSUL folder — a SIBLING of the app dir `pages/<workspace>/`, NOT its parent and NOT inside it).
  Apply the DSUL conventions from skill `04-workspace-edit` :
  - camelCase slugs (no `/`).
  - Names use `/` for folder scoping on private automations.
  - Public automations have FR + EN localized names.
  - Error format : `{error: "PascalCase", message: "...", details: {}}`.
  - ≤ 200 lines per automation (excluding `arguments`).
  - Entry points use `validateArguments: true`.
- **Dependencies** : if you need a new npm package, run `cd <appDir> && npm install <pkg>`. Only add to `externals.mjs` if it's a Prisme.ai runtime module (rare, ask user). If the dep is heavy / non-socle (three, r3f, viz libs, charting…), remind the user that the in-Builder UI "Déployer" button will break for this app — [[feedback_inbuilder_builder_limited_deps]].

---

## Phase 6 — Local validation

| Step | When | How |
|---|---|---|
| Type check | If `src/` was touched | `cd <appDir> && npm run typecheck` |
| Automation validation | Each YAML touched in `automations/` | `mcp__prisme-ai-builder__validate_automation` |
| Lint reference | When unsure on DSUL syntax | `mcp__prisme-ai-builder__validate_automation` |
| Build | If `src/` was touched | `cd <appDir> && npm run build` (skip if only YAML changed) |
| Code review (optional) | On the full diff before push | `Task(subagent_type: "code-review", ...)` |

Fix any 🔴 MAJOR issue before moving on.

---

## Phase 7 — Targeted push (deploy workspace + page)

Two equivalent paths: **all-MCP** (push_workspace + upload_file + call_api PATCH +
publish_app — see the MCP recipe just below, no local creds) or **MCP for automations
+ curl for the React side** (needs the JWT from Phase 2). Pick MCP-only when you don't
have a local token.

Build an action plan from the diff and execute it. Show the plan to the user and
get explicit confirmation before any remote write.

**Auth for direct fetch** :
- Header : `Authorization: Bearer <apiKey>` (the JWT from Phase 2).
- Base URL : `apiUrl` (from Phase 2 ; already includes `/v2`).

### Deploy the workspace + its page entirely via the prisme-ai-builder MCP (no local creds)

When you don't have / don't want to use a local JWT for `deploy.mjs`/curl, the **whole
deploy (workspace DSUL + page bundle + config) goes through MCP tools**. This is the
validated `google-workspaces` recipe (2026-06-25). Same order-of-operations as below ;
each curl step maps to an MCP tool :

1. **DSUL** → `mcp__prisme-ai-builder__push_workspace(workspaceId, path: "<repo>/workspaces/<workspace>", prune: false)`.
   Targets the DSUL-pure workspace folder. `prune:false` so it can't delete remote files
   it doesn't know about (the page bundle, source files). **NEVER** pass the app dir
   `pages/<workspace>` — push only ever sees `workspaces/<workspace>`.
2. **Build** → `cd <repo>/pages/<workspace> && npm run build` → `dist/bundle.js`.
3. **Upload bundle** (public, no metadata) → `mcp__prisme-ai-builder__upload_file(workspaceId, path: "<repo>/pages/<workspace>/dist/bundle.js", public: true)` → grab the new URL.
   (MCP `upload_file` drops `metadata`, so it's fine for the bundle but NOT for SOURCE
   files that need `metadata.path` — those still go via curl, see Action matrix.)
4. **PATCH config** → `mcp__prisme-ai-builder__call_api(method: PATCH, path: "/workspaces/<id>", body: {config:{block, schema, value}})`.
   First `call_api(GET /workspaces/<id>)` → `.config`, then set `config.block` **and**
   `config.value.bundles[<slug>].bundle` to the new URL, **preserving every other key**
   (`mcpTools`, `appSecret`, auth). NEVER send a partial `value` — `config.value` is
   replace-in-whole. For an app+mcp connector with an inline config UI, point BOTH
   `block` and `bundles[<slug>]` at the same new bundle.
5. **publish_app** (app+mcp connectors only) → `mcp__prisme-ai-builder__publish_app(workspaceId)`.
   Snapshots `config.block` into the **published App** so tenant instances pick up the
   new bundle — WITHOUT it, instances keep the old block (the config UI looks stale).
   Publish **before** deleting the old bundle file.
6. **Cleanup + smoke test** → delete orphan old bundle(s) via `call_api(DELETE /workspaces/<id>/files/<fileId>)` ; fetch the new bundle and assert it exports CJS `module.exports.default` (esbuild form `Et(Zt,{default:()=>App});module.exports=...`).

See [[project_app_mcp_config_block_sync]] for the full recipe + the `publish_app`
gotcha. For the curl/JWT variant, follow the Action matrix below.

### 🚨 CRITICAL — Order of operations (learned the hard way)

The Prisme.ai API has **two non-merging endpoints** that both touch
`config.value` and will silently wipe each other if you don't follow the order :

- **`mcp__prisme-ai-builder__push_workspace`** deserializes `config.value` from the
  local `index.yml`. If `bundles` isn't in the local YAML, push **wipes** the remote
  `bundles` entry.
- **`PATCH /workspaces/:id { config: { value: {...} } }`** **replaces** `config.value`
  entirely. A partial PATCH containing only `bundles` wipes `appSecret`, `mcpTools`,
  and any other key. (Same caveat as `update_app_instance_config`.)

### 🚨 CRITICAL — mcpTools live in `imports/MCP Core.yml`, NOT in `index.yml`

For app+mcp workspaces that use the `MCP Core` import (very common — pptx-generator,
gryzzly, etc.), the `tools/list` JSON-RPC response is built from
`imports/MCP Core.yml > config.mcpTools`. The `config.value.mcpTools` in `index.yml`
is documentation/duplicate only — editing it has **zero effect** on what tenants see.

→ When adding/removing/renaming an mcpTool, **always edit `imports/MCP Core.yml >
config.mcpTools`** and only mirror to `index.yml > config.value.mcpTools` for
consistency. Verify the change with:

```bash
curl -X POST "$API/workspaces/slug:<slug>/webhooks/mcp" \
  -H "mcp-api-key: <any-valid-key>" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq '.result.tools[].name'
```

Tenants see the change immediately — no app instance reinstall needed.

→ **Always run in this exact order**, with the bundles PATCH **last** :

```
1. push_workspace      (DSUL only — targets workspaces/<workspace>: automations + imports + index.yml + legacy pages + security ; NEVER the app dir pages/<workspace>)
2. Upload bundle        (POST /files, public=true)
3. Upload source files  (POST /files, metadata.type=source, public=false)
4. PATCH config.value   (FULL value: appSecret + mcpTools + bundles + everything from local index.yml > config.value, plus the new bundles entry — never a partial PATCH)
5. DELETE orphan bundle files (not in current bundles[*])
6. Smoke test           (GET /pages/<slug>/_bundle + parse the JS)
7. Version snapshot     (POST /versions)
8. Refresh .prismeai/last-pull.json
```

Step 4 is the **atomic boundary** — before it, the old bundle is still live ; after
it, the new one takes over. Always save the previous `bundles[<slug>].bundle` URL
before step 4 so you can roll back on smoke-test failure.

### Action matrix

| Diff | Method | Action |
|---|---|---|
| Automation added (`automations/foo.yml` new) | **MCP** | `validate_automation` then `create_automation(workspaceId, slug, ...)` |
| Automation modified | **MCP** | `validate_automation` then `update_automation(workspaceId, slug, ...)` |
| Automation deleted | **MCP** | `delete_automation(workspaceId, slug)` |
| > 5 automations touched, OR imports/pages/security changed | **MCP** | `push_workspace(workspaceId, path: workspaces/<workspace>, message)` for the whole DSUL bulk — `path` is always the DSUL folder, never `pages/<workspace>` |
| File under `src/**` changed | **curl** | Mirror `scripts/deploy.mjs > collectSourceFiles`: 6 root-of-`<appDir>` files (`package.json`, `tsconfig.json`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `index.html`) + everything under `<appDir>/src/**` (except `.yml`/`.yaml` and files matching `* copy*`). For each: SHA-256, GET `/workspaces/:id/files?metadata.path=<path>&metadata.type=source` to find existing, DELETE old if hash differs, then POST multipart with `metadata.path=<canonicalPath>` (e.g. `src/App.tsx`, **never** prefixed with the app-dir path like `pages/<workspace>/src/App.tsx`) + `metadata.type=source` + `metadata.hash` + `public=false`. **This is NOT optional** — without it, the Studio source-view stays empty. **Do NOT use `mcp__prisme-ai-builder__upload_file`**: it drops the `metadata` parameter silently — [[feedback_mcp_upload_file_metadata_dropped]]. |
| `dist/bundle.js` rebuilt | **curl** | POST multipart `/workspaces/:id/files` (`public=true`), grab the URL returned. |
| Bundles PATCH (step 4) | **curl** | PATCH `/workspaces/:id` with `{ config: { value: <FULL value incl. bundles> } }`. Recompute the full `config.value` from the local `index.yml` + add the new `bundles[<slug>]` entry. |
| After PATCH succeeds | **curl** | DELETE orphan bundle/embed files not in current `bundles[*]`. |
| Smoke test (post-push) | **curl** | GET `/pages/<slug>/_bundle`, fetch the JS returned, parse with `new Function()`, assert `module.exports.default` exists. |
| Version snapshot | **curl** | POST `/workspaces/:id/versions` with `{ "description": "..." }`. |
| End | local | Refresh `<appDir>/.prismeai/last-pull.json` (i.e. `pages/<workspace>/.prismeai/last-pull.json`) with new hashes. |

### Concrete curl examples

```bash
# 1. push_workspace (via MCP — not curl)
#    mcp__prisme-ai-builder__push_workspace(workspaceId, path, message)

# 2. Upload the bundle (public)
curl -fsS -X POST "$API_URL/workspaces/$WORKSPACE_ID/files" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@<appDir>/dist/bundle.js;filename=bundle.js;type=application/octet-stream" \
  -F "public=true"
# → grab .url and .id from the response[0]
# (mcp__prisme-ai-builder__upload_file is OK for the bundle since no structured
#  metadata is needed — only public=true. But stay on curl for consistency with
#  the source-file uploads below.)

# 3. Upload a source file (private)
#    Note: metadata.path is CANONICAL (src/App.tsx), NOT prefixed with the app-dir path.
#    Local path = <appDir>/src/App.tsx (= pages/<workspace>/src/App.tsx) ; remote metadata.path = src/App.tsx. Asymmetric on purpose.
HASH=$(shasum -a 256 <appDir>/src/App.tsx | cut -d' ' -f1)
curl -fsS -X POST "$API_URL/workspaces/$WORKSPACE_ID/files" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@<appDir>/src/App.tsx;filename=App.tsx;type=text/plain" \
  -F "metadata.path=src/App.tsx" \
  -F "metadata.type=source" \
  -F "metadata.hash=$HASH" \
  -F "public=false"
# Do NOT use mcp__prisme-ai-builder__upload_file here: it drops the metadata
# parameter silently — see [[feedback_mcp_upload_file_metadata_dropped]].

# 4. PATCH config.value (FULL — read local index.yml first, then merge bundles)
#    Reconstruct config.value from the DSUL index.yml (workspaces/<workspace>/index.yml ; yq or python yaml),
#    then jq-merge the new bundles entry, then PATCH.
#    ⚠️ Preserve socleVersion: "1.0.0" — required for Studio to surface the SPA page.
python3 -c "
import yaml, json, sys
with open('workspaces/<workspace>/index.yml') as f:
    doc = yaml.safe_load(f)
print(json.dumps(doc['config']['value']))" > /tmp/config-value.json

PAYLOAD=$(jq -c \
  --arg url "$BUNDLE_URL" \
  --arg iso "$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")" \
  '. + {bundles: {"'$SLUG'": {bundle: $url, version: "'$VERSION'", name: "'$SLUG'", builtAt: $iso}}}' \
  /tmp/config-value.json | jq -nc --argjson cv "$(cat)" '{config: {value: $cv}}')

curl -fsS -X PATCH "$API_URL/workspaces/$WORKSPACE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"

# 5. Version snapshot
curl -fsS -X POST "$API_URL/workspaces/$WORKSPACE_ID/versions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description":"workspace-page-implement v<version>"}'
```

### Confirmation before push

Print workspace name + ID, env (sandbox / staging / prod), the exact list of MCP
and curl actions queued. Wait for user OK.

### Failure handling

- MCP automation call fails → surface the MCP error verbatim, ask the user to fix the YAML.
- Step 1 (push_workspace) error "Could not publish app — duplicate slug" → **non-blocking** for the workspace itself, only the marketplace publication failed. The DSUL is still imported. Suggest the user change the app slug in `index.yml > slug` (different from workspace slug) if they want to publish.
- Step 2 (bundle upload) fails → no remote state change. Retry.
- Step 4 (config PATCH) fails → previous bundle is still live, no harm. Retry.
- Smoke test fails after step 4 → the new bundle is broken **and live**. Offer immediate rollback : PATCH `config.value.bundles[<slug>].bundle` back to the previous URL (saved before step 4). Then DELETE the broken bundle file.

---

## Phase 8 — Post-push report

1. Build the access URL : the `studioUrl` (Phase 2) + `/apps/<bundleKey>`
   (`<bundleKey>` is the workspace slug — one app per workspace, named after it ;
   cf. [[convention_react_app_nested]]). Print it as a clickable link.
2. Report :
   - Workspace ID + name
   - App name (`<appName>`, = workspace slug) + local path (`pages/<workspace>/`)
   - Env (sandbox / staging / prod)
   - Version (`PRISMEAI_APP_VERSION`)
   - Automations touched : counts (created / updated / deleted). The starter demo
     endpoints (`v1/status`, `on-app-greeting-requested`) are optional and NOT
     needed for SPA detection — mention them only if you actually created any.
   - Source files pushed : count + bundle size
3. **Reminder for the user** : if the app uses non-socle deps (three.js,
   @react-three/*, viz libs…), say it explicitly — "ne clique pas sur
   'Déployer' depuis l'UI Studio, ça écraserait le bundle". Cf.
   [[feedback_inbuilder_builder_limited_deps]].
4. If the workspace folder is under git, suggest a commit. **Don't commit
   automatically.**

---

## Phase 9 — Canvas embed mode (optional, additive to Phases 1-8)

Enter Phase 9 **in addition to** Phases 1-8 when the user wants the bundle to run
inside an agent's chat canvas (`<pr-canvas type="webpage">` artifact rendered
by agent-factory's `_extract-artifacts`), or any of the 4 alternative display
modes that embed.js handles (`inline` / `popover` / `modal` / `sidebar` /
`bottom-sheet`). Triggers : "afficher dans le canvas", "embed inline", "div
embed", "popover", "bottom sheet", "intégrer l'app".

The studio popup mode (`/apps/<slug>?ticket=...`) **does not change** — Phases
1-8 still cover it. Phase 9 only adds dual-mode plumbing.

### 9.1 — Hard rules (cite memories, don't duplicate)

| Constraint | Memory |
|---|---|
| embed.js prop shape ≠ studio shape ; bundle must support both | [[feedback_embed_js_prop_shape]] |
| `data-token` is NOT auto-parsed by embed.js — bundle must read `script[data-token]` itself | [[feedback_embed_js_no_data_token]] |
| `<pr-canvas>` is extracted from the LLM's `assistant_message.content` only (NOT from tool outputs directly) — return canvas snippet from the tool + hint "Echo VERBATIM" | [[feedback_canvas_extract_scope]] |
| Canvas iframe is sandboxed without `allow-same-origin` → `document.cookie` throws, cross-origin cookies blocked, no authenticated POST back to Prismeai is possible from inside | [[feedback_pr_canvas_sandbox_no_auth]] |
| `@radix-ui/react-slot` polyfill in embed.js is stale (no `createSlot`) — remove from `externals.mjs` to bundle locally | [[feedback_embed_js_react_slot_polyfill_broken]] |
| Tailwind CDN JIT scans before React mounts ; `globals.css` `:root` overrides host palette — pre-compile statically + inject via `<style>` in useEffect | [[feedback_embed_tailwind_static_inject]] |
| api-gateway strips custom request headers — pass auth/context in JSON body, not headers | [[feedback_api_gateway_strips_headers]] |
| `routeToolCall` passes scope-injected fields under `arguments.*` (nested), not at handler top-level | [[feedback_mcp_scope_nested_args]] |
| agent-factory MCP scope mechanism : declare `scope: "context_id,agent_id,..."` in agent's MCP server config to auto-inject context into tool args | [[feedback_agent_factory_mcp_scope]] |
| UI "Déployer" button resets the bundle + adds `bundles[*].embed` + `socleVersion` to config.value | [[feedback_ui_deploy_resets_bundle]] |
| `update_automation` MCP returns 404 for slugs with `/` (e.g. `v1/listTemplates`) — fallback curl PATCH with `%2F` | [[feedback_mcp_update_automation_slash_slugs]] |

### 9.2 — Bundle changes (src/)

1. **`src/types.ts`** : declare both shapes, union them.
   ```ts
   export interface StudioProps { sdk: SDK; user: unknown; workspace: ...; ... }
   export interface EmbedProps { workspaceId?: string; workspaceSlug?: string;
     apiUrl?: string; consoleUrl?: string; token?: string; auth?: string;
     theme?: string; close?: () => void; ... }
   export type AppProps = Partial<StudioProps> & EmbedProps
   ```
   Add `_isEmbed?: boolean` and `_embedTicket?: string` to the `SDK` type — used
   internally to flag the synthetic sdk built in embed mode.

2. **`src/App.tsx`** :
   - `resolveSdk(props)` : if `props.sdk` present → return it (studio mode) ;
     else build a synthetic sdk : `{ host: deriveApiUrl(props), _isEmbed: true,
     _embedTicket: props.token || readTicketFromScripts() }`.
   - `deriveApiUrl(props)` : prefer `props.apiUrl`, else derive from
     `props.consoleUrl` (`https://sandbox.prisme.ai` → `https://api.sandbox.prisme.ai/v2`),
     else `window.location.origin + '/v2'` with `api.` prefix injection.
   - `readTicketFromScripts()` : `document.querySelector('script[data-token], script[data-ticket]')`
     → return the first non-empty attribute value.
   - `apiHeaders(sdk)` : in embed mode, send only `Content-Type` (no Bearer,
     no CSRF — both unreachable from the sandboxed iframe).
   - `callEndpoint(sdk, slug, path, body)` : in embed mode use
     `credentials: 'omit'` and inject `body.ticket = sdk._embedTicket` (the
     api-gateway strips custom headers so the ticket rides in the body).
   - `useEffect` bootstrap : in embed mode **skip `v1/exchangeTicket`** and go
     directly to `refresh()` ; each call carries the ticket.
   - `useEffect` styling : if `sdk._isEmbed`, call `injectEmbedStyles()` once.
   - **Workspace slug fallback** : `resolveWorkspaceSlug(props)` returns
     `props.workspace?.slug || props.workspaceSlug || APP_WORKSPACE_SLUG`. Apply
     to every webhook call, not the hardcoded constant.

3. **`src/styles/embed.css`** (new) : `@tailwind base; @tailwind components;
   @tailwind utilities;` ONLY — no `@layer base { :root { --primary, ... } }`,
   so the host's palette stays in charge.

4. **`src/embed-styles.ts`** (new) :
   ```ts
   import css from '../dist/embed.css'
   export function injectEmbedStyles(): () => void {
     if (document.getElementById('app-embed-tailwind')) return () => {}
     const style = document.createElement('style')
     style.id = 'app-embed-tailwind'
     style.textContent = css
     document.head.appendChild(style)
     return () => style.remove()
   }
   ```

5. **`scripts/externals.mjs`** : remove `@radix-ui/react-slot` (comment why).
   All other Radix primitives stay external (they're loaded from esm.sh by
   embed.js's `STALE_BUNDLE_DEPS`).

6. **`scripts/build.mjs`** : prepend a Tailwind CLI step before esbuild :
   ```js
   const tw = spawnSync('npx', [
     'tailwindcss', '-i', 'src/styles/embed.css', '-o', 'dist/embed.css',
     '--content', './src/**/*.tsx', '--minify',
   ], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
   if (tw.status !== 0) process.exit(1)
   ```
   Add `'.css': 'text'` to esbuild's `loader` config so `import css from '../dist/embed.css'`
   inlines the file as a string.

### 9.3 — Backend changes (DSUL stateless auth)

For every webhook the embed app calls (e.g., `v1/listTemplates`, `addTemplate`,
`removeTemplate`, `downloadTemplate`), accept `body.ticket` as an alternative
to `session.tenantId` :

```yaml
do:
  - set: { name: tenantId, value: '{{session.tenantId}}' }
  - conditions:
      '!{{tenantId}} && {{body.ticket}}':
        - Custom Code.run:
            function: verifyExchangeTicket
            parameters:
              ticket: '{{body.ticket}}'
              secret: '{{config.appSecret}}'
            output: decoded
        - conditions:
            '!{{decoded.error}}':
              - set: { name: tenantId, value: '{{decoded.tenantId}}' }
  - conditions:
      '!{{tenantId}}':
        - set: { name: $http, value: { status: 401 } }
        - set: { name: response, value: { ok: false, error: 'Unauthorized' } }
        - break: {}
  # ... rest of the handler uses {{tenantId}} as before
```

The studio popup path (`v1/exchangeTicket` → `session.tenantId`) still works ;
this branch only activates when there's no session AND a ticket is in the body.

### 9.4 — Canvas snippet (formatToolOutput / openUI handler)

The tool that opens the canvas (typically `method-openUI` → `formatToolOutput`
with `operation: openUI`) emits a `<pr-canvas>` block alongside the popup link
fallback :

```yaml
- set:
    name: canvasBlock
    value: |
      <pr-canvas>
      {"type": "webpage", "title": "<Tool Title>"}
      ---
      <!doctype html>
      <html><body>
        <div id="prisme-app"></div>
        <script src="{{global.studioUrl}}/embed.js"
          data-container="#prisme-app"
          data-bundle-url="{{config.bundles[\"<slug>\"].bundle}}"
          data-workspace-id="{{tenantId}}"
          data-workspace-slug="<slug>"
          data-mode="inline"
          data-api-url="<api-url>"
          data-console-url="<console-url>"
          data-token="{{ticket}}"
          data-context-id="{{embedContextId}}"
          data-agent-id="{{embedAgentId}}"
        ></script>
      </body></html>
      </pr-canvas>
- set:
    name: verboseMessage
    value: |
      <intro line>

      {{canvasBlock}}

      🔗 Fallback: [open in a window]({{popupUrl}}) (single-use, {{expiresIn}}s).
- hint: 'IMPORTANT: Echo the <pr-canvas>...</pr-canvas> block VERBATIM in your reply — do not rephrase or summarize. The chat renders it as an inline canvas.'
```

The handler must read `embedContextId`/`embedAgentId` from `{{arguments.context_id}}`/
`{{arguments.agent_id}}` (nested under arguments — see [[feedback_mcp_scope_nested_args]]),
not at top-level. Tell the user to configure `scope: "context_id,agent_id"` on
their agent's MCP server config to enable this propagation —
[[feedback_agent_factory_mcp_scope]].

### 9.5 — Agent ↔ canvas back-channel (still limited)

The canvas iframe can't make authenticated calls to Prismeai APIs (sandbox).
Two fallbacks for "tell the agent to do X" buttons :

1. **`window.parent.postMessage({type: 'prismeai.canvas.userMessage', text, agentId, contextId}, '*')`** — no-op today (chat client doesn't listen) but cheap to ship for future plumbing.
2. **`navigator.clipboard.writeText(text)`** + a toast "Copied — paste in the chat (Cmd/Ctrl+V)" — works inside the sandbox iframe (clipboard API doesn't need same-origin).

Hide / disable agent-injection buttons when `agent_id` data attr is empty (= scope
not configured on the consumer side) — graceful degradation.

### 9.6 — Push specifics for embed mode

Phase 7 mostly applies. Additions :

1. **Build outputs**: `dist/bundle.js` (CJS) + `dist/embed.css` (Tailwind static).
   `embed.css` is inlined into the bundle via esbuild text loader — DO NOT
   upload it separately. The bundle is bigger (~35-40 KB vs 15 KB studio-only)
   but self-contained.

2. **If a UI "Déployer" happened** since your last push, `config.value.bundles[<slug>]`
   has been mutated by the platform (cf. [[feedback_ui_deploy_resets_bundle]]).
   Before PATCHing :
   - Pull fresh `config.value` (don't reuse a cached one from earlier in the session).
   - Capture the orphan `bundles[<slug>].embed` URL ; you'll DELETE that file
     after PATCH.
   - Preserve `bundles[<slug>].name`, `socleVersion`, all other fields when
     reconstructing the PATCH body :
     ```bash
     jq '.bundles["<slug>"].bundle = $url
       | .bundles["<slug>"].builtAt = $now
       | .bundles["<slug>"].version = "$ver"
       | del(.bundles["<slug>"].embed)' /tmp/cfg-fresh.json
     ```

3. **Slashed automation slugs** (e.g. `v1/listTemplates`) — the MCP
   `update_automation` returns 404, fallback to curl `PATCH /v2/workspaces/X/automations/v1%2FlistTemplates`.
   See [[feedback_mcp_update_automation_slash_slugs]] for the body shape.

### 9.7 — Debug recipes

| Symptom | Probable cause | Diagnostic |
|---|---|---|
| `[PrismeApp] Bundle execution error: (0, le.createSlot) is not a function` | `@radix-ui/react-slot` still in externals.mjs ; embed.js polyfill missing `createSlot` | Remove from externals, rebuild. [[feedback_embed_js_react_slot_polyfill_broken]] |
| Canvas mounts but no Tailwind styling | embed.css not injected OR `globals.css` `:root` is winning over host palette | Verify `injectEmbedStyles()` runs in useEffect ; use the `embed.css` entry (no `:root`). [[feedback_embed_tailwind_static_inject]] |
| `Failed to read the 'cookie' property from 'Document': The document is sandboxed and lacks the 'allow-same-origin' flag.` | Canvas iframe sandbox ; cookie/session auth impossible | Switch to body.ticket auth ; for messages/send fallback to clipboard. [[feedback_pr_canvas_sandbox_no_auth]] |
| `data-context-id=""` / `data-agent-id=""` in rendered snippet | Either (a) scope not enabled in agent's MCP config, or (b) handler reads `{{context_id}}` instead of `{{arguments.context_id}}` | Inspect tool-call payload via `search_events` (filter `source.automationSlug=mcp`, look at `payload.payload.body.params.arguments`). [[feedback_mcp_scope_nested_args]] [[feedback_agent_factory_mcp_scope]] |
| 401 from webhook with **no runtime event** | api-gateway rejected before runtime (cookie session / CSRF / origin null) | `search_events` for the slug returns nothing → it's gateway-level. Switch to anonymous + body.ticket. [[feedback_pr_canvas_sandbox_no_auth]] |
| 401 from webhook **with** runtime event | DSUL-level (`session.tenantId` empty, ticket invalid, etc.) | Read `payload.output.error` in the event. |
| Custom HTTP header set by client doesn't appear in runtime `{{headers}}` | api-gateway strip | Move the value into `body.<field>`. [[feedback_api_gateway_strips_headers]] |
| Bundle "disappears" between sessions (different file ID, build time changed) | User pressed UI "Déployer" in the studio | Re-push your local bundle ; delete orphan embed file. [[feedback_ui_deploy_resets_bundle]] |
| `[AppRenderer] Failed to load bundle: ModuleLoadError … SyntaxError: Unexpected token '<'` (thrown in `new Function`) | `config.value.bundles[<slug>].bundle` is still the placeholder `<TO_FILL_AT_BUNDLE_UPLOAD>` (or any URL serving HTML/404) → the renderer fetches an HTML page and `new Function("<…")` chokes on `<`. The SPA bundle was never deployed. | `curl .../v2/pages/<slug>/_bundle` — if `.bundles[<slug>].bundle` is `<TO_FILL…>` or not a `/v2/files/...` URL, the bundle was never wired. Fix = redo Phase 7 (build → upload bundle → **PATCH full `config.value`** with the real URL). **NOT** `publish_app` (App/MCP def only, ignores the bundle) nor `push_workspace` (it only ships the DSUL folder `workspaces/<workspace>` and never updates the runtime `config.value`, so it can't wire the bundle pointer). Trap: the workspace-doc `config.value.bundles` may already show a real URL while `_bundle` still serves the placeholder (stale snapshot) — the PATCH resyncs `_bundle`. [[feedback_app_mcp_spa_bundle_placeholder]] |

### 9.8 — Smoke tests

After a Phase 9 push, verify in this order :

1. `GET /v2/files/<workspaceId>/<bundle-filename>` → HTTP 200, body starts with `var __require=...` (CJS).
2. Studio popup (`/apps/<slug>?ticket=<fresh>`) still loads — Phase 9 must not regress studio mode.
3. Open an agent chat with the workspace's MCP installed and `scope: "context_id,agent_id"` enabled. Send a message that triggers `manageTemplates` (or the openUI tool). Expected :
   - LLM echoes the `<pr-canvas>` block verbatim.
   - Canvas opens, console shows `[PrismeApp] App mounted successfully`.
   - App renders styled (Tailwind palette = host's, not dark gray).
   - Initial data load (e.g., listTemplates) succeeds without "Session expirée".
4. `search_events` confirms `body.ticket` arrived and `decoded.tenantId` was set in the webhook execution.

---



- **No interactive OAuth** : the JWT comes from the MCP env. If it's expired, the
  user must refresh it through their platform UI / MCP setup, not through this skill.
- **No multi-bundle routing** : honors `PRISMEAI_BUNDLE_SLUG` in `.env` but doesn't
  manage multiple bundles per workspace dynamically.
- **No `npm run deploy`** : all remote pushes go through MCP (automations) + curl
  (React side). `scripts/deploy.mjs` is a reference for the contract, not an
  execution path.
- **No edits to `scripts/*.mjs`** unless the user asks. If you must edit them, run
  `node --check <file>` after every change.
- **No migration** of a pre-existing app project laid out differently from
  starter-spa. The skill assumes the starter-spa layout or a bootstrap-from-empty.

---

## Reference files (cite, don't duplicate)

| Path (relative to workspace) | Role |
|---|---|
| `AGENTS.md` | Authoritative hard rules |
| `README.md` | Host contract + deploy pipeline narrative |
| `scripts/deploy.mjs` | Source of truth for API endpoints + payload shapes |
| `scripts/externals.mjs` | Canonical list of host-provided modules (remove `@radix-ui/react-slot` for embed mode — Phase 9) |
| `scripts/build.mjs` | esbuild config ; Phase 9 prepends a Tailwind CLI step |
| `scripts/pull.mjs` | Contract for the defensive state sync (Phase 2B) |
| `src/types.ts` | `AppProps` contract (`Partial<StudioProps> & EmbedProps`) |
| `src/lib/mockHost.ts` | Local dev stub for `{sdk, user, workspace}` |
| `src/styles/globals.css` | Studio mode entry (Tailwind + `:root` palette) |
| `src/styles/embed.css` | Phase 9 entry — Tailwind without `:root` overrides |
| `src/embed-styles.ts` | Phase 9 — exports `injectEmbedStyles()` injecting `dist/embed.css` as a `<style>` at mount |

When you need the exact contract for an endpoint or payload, **read `scripts/deploy.mjs`** rather than guessing.
