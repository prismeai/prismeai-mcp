# `starter-spa`

> Build a Prisme.ai SPA (React frontend + backend automations) locally in VS Code, deploy to a workspace with one command.

This is the **SPA starter** in the [`prismeai/starter-*`](#related-starters) family. It ships the same React + Radix UI + Tailwind template the in-platform Builder seeds when you click **+ Page → New SPA**. Edit it locally, version it on GitHub, deploy via CI — your repo and the in-platform Builder stay in sync.

---

## Quick start

```bash
git clone https://github.com/prismeai/starter-spa my-app
cd my-app
npm install
cp .env.example .env
# Fill in PRISMEAI_API_URL, PRISMEAI_ACCESS_TOKEN, PRISMEAI_WORKSPACE_ID

npm run dev       # local Vite dev server with mocked sdk/workspace
npm run release   # build + deploy
```

After `npm run release`, your app is live at `<your-platform-ui>/apps/<workspace-slug>`.

---

## Prerequisites

- **Node.js 20+** and **npm**
- A **Prisme.ai workspace** you own
- A **personal access token** (see below)
- Your platform's **API URL** including `/v2` (e.g. `https://api.sandbox.prisme.ai/v2`)

### Minting a personal access token

1. Open your Prisme.ai platform UI and log in.
2. Go to **Settings → Access Tokens** (`/settings/tokens`).
3. Click **Create**, give it a name (e.g. `starter-deploy`) and an expiry date.
4. **Copy the token immediately** — the value is shown only once. Format: `at:<uuid>`.
5. Paste it into `.env` as `PRISMEAI_ACCESS_TOKEN=at:...`.

You can list, see days-until-expiry, and revoke your tokens from the same screen.

> **Alternative**: org-scoped API keys (created in the AI Governance app → API Keys) are also supported via `PRISMEAI_API_KEY`. Use ONE of `PRISMEAI_ACCESS_TOKEN` or `PRISMEAI_API_KEY`. Access tokens are preferred for individual contributors; API keys for shared CI service accounts.

---

## Project structure

```
.
├── automations/                      # DSUL automations — pushed to workspace.automations
│   ├── on-app-greeting-requested.yml
│   └── v1/status.yml
├── imports/                          # DSUL imports — installed apps (empty by default)
├── index.yml                         # workspace metadata (optional; created by npm run pull)
├── security.yml                      # workspace RBAC (optional; created by npm run pull)
│
├── src/                              # React app — what gets bundled and deployed
│   ├── App.tsx                       # ← edit this. Default export is what the platform renders.
│   ├── main.tsx                      # local-dev only; the platform never runs this file.
│   ├── lib/
│   │   ├── utils.ts                  # cn() helper
│   │   └── mockHost.ts               # local-dev stub for sdk + workspace props
│   ├── components/ui/                # shadcn-style components (button, card, dialog, ...)
│   └── styles/globals.css
│
├── scripts/                          # build + deploy + pull tooling (Node)
│
├── AGENTS.md                         # AI-agent instructions (CLAUDE.md, .cursorrules point here)
├── README.md
├── .env.example                      # copy to .env (gitignored)
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

**Two independent transport channels — by design:**

| What | How it gets to a workspace |
|---|---|
| DSUL artifacts (`automations/`, `index.yml`, `security.yml`, `imports/`) | **Workspace export/import zip** — these match the export format 1:1. Zip them up, drop into the in-builder Builder's "Import Workspace", done. Also pushed by `npm run deploy`. |
| React source (`src/`, `package.json`, configs) | **Git + npm** — clone the repo, `npm install`, edit, `npm run deploy`. The workspace import zip does NOT carry these (and shouldn't — large source trees don't belong in a portable DSUL archive). |

That's why `src/` is a normal JS layout (universal convention + the in-builder Builder hardcodes `src/App.tsx` as the SPA entry) while DSUL stays at root (zip-and-import compatible). The deploy script bridges them: pushes DSUL via the workspace API AND uploads each `src/*` file as `metadata.type=source` so the in-builder Builder's sandbox sees the same code.

You should normally only touch:

- `src/App.tsx` — your app
- New files under `src/components/`, `src/hooks/`, `src/pages/`, etc.
- `automations/*.yml` — your backend automations

---

## The host contract

In production, the platform loads `dist/bundle.js` and renders the **default export** of `src/App.tsx` with these props:

```ts
interface AppProps {
  sdk: SDK                                                // authenticated client
  user: { id: string; email: string; ... }                // current user
  workspace: { id: string; slug: string; name: string }   // the workspace hosting your app
  backends?: Record<string, { slug: string }>             // optional named backend workspaces
  agents?: Record<string, string>                         // optional pre-resolved agent IDs
}
```

> **Built-in apps and customer apps share the exact same loader and contract.** The platform's `AppRenderer` resolves a built-in app from a static manifest and a custom app via `GET /v2/pages/<slug>/_bundle`, but both paths converge on the same render call. What you build with this starter is loaded the same way as a first-party app shipped in the platform docker image.

Locally (`npm run dev`), `src/main.tsx` provides a stub via `src/lib/mockHost.ts` so the demo renders without a live backend.

### Calling your workspace

The starter ships with two reference patterns — see `src/App.tsx` for full code.

**REST webhook** (synchronous request → JSON response):

```ts
const url = sdk.host + '/workspaces/slug:' + workspace.slug + '/webhooks/v1/status'
const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({}),
})
const data = await res.json()
```

The matching automation:

```yaml
when:
  endpoint: v1/status
do:
  - set:
      name: result
      value: { status: ok, timestamp: '{{run.date}}' }
output: '{{result}}'
```

**WebSocket events** (asynchronous fire-and-listen):

```ts
const events = await sdk.streamEvents(workspace.id, { 'source.sessionId': true })
events.on('app.greeting.completed', (data) => { /* ... */ })
events.emit('app.greeting.requested', { name: 'World' })
```

The `'source.sessionId': true` filter ensures you only receive events tied to *this* user session. The matching automation listens for `app.greeting.requested` and emits `app.greeting.completed` back.

---

## Local development

```bash
npm run dev
```

Opens `http://localhost:5173`. The mock host intercepts:

- `sdk.streamEvents(...)` — returns an in-memory event bus that locally echoes `app.greeting.requested` → `app.greeting.completed`.
- The webhook URL is built from `sdk.host`. If you set `VITE_PRISMEAI_API_URL` and `VITE_PRISMEAI_API_KEY` in `.env`, the REST tab will hit your real workspace.

---

## Build

```bash
npm run build
```

Compiles `src/App.tsx` → `dist/bundle.js` using esbuild:

- **Format**: CommonJS — the platform's loader expects `module.exports.default`.
- **Externals**: React, Radix, lucide-react, clsx, tailwind-merge, class-variance-authority, jotai, `@prisme.ai/sdk` — provided by the platform at runtime. **Never** bundle them or you will duplicate React and break hooks.
- **Minified**, no source map.

Full externals list: `scripts/externals.mjs`.

---

## Deploy

```bash
npm run deploy        # uploads + patches workspace
npm run release       # alias for npm run build && npm run deploy
```

The deploy script does eight steps in order:

| # | Step | What it writes | Skip with |
|---|---|---|---|
| 0 | **Conflict detection** | Reads `.prismeai/last-pull.json`, refuses if remote diverged from your last pull. Pre-flight check; no state change. | `--force` flag, `PRISMEAI_FORCE=true` |
| 1 | **Automations sync** | Walks `automations/**/*.yml`, parses each, upserts via `POST/PATCH /workspaces/:id/automations[/:slug]`. Deletes any remote slug not present locally. | `PRISMEAI_SKIP_AUTOMATIONS_SYNC=true` |
| 2 | **Source files sync** | Walks `src/` + root config files, SHA-256 hashes each, diffs against existing `metadata.type=source` files. Uploads new, replaces changed, deletes removed. | `PRISMEAI_SKIP_SOURCE_SYNC=true` |
| 3 | **Bundle upload** | `POST /workspaces/:id/files` (`public=true`) — returns the CDN URL. | — |
| 4 | **embed.js upload** | Fetches `${PRISMEAI_PLATFORM_URL}/embed.js` and uploads as a public file. Only needed for 3rd-party `<script>` embedding. | unset `PRISMEAI_PLATFORM_URL` |
| 5 | **Patch workspace config** | `PATCH /workspaces/:id` writes `config.value.bundles[<slug>] = { bundle, embed?, version, name, builtAt }`. **This is the live pointer `AppRenderer` reads on every page load.** | — |
| 6 | **Cleanup orphan bundles** | Lists all public `bundle.js` / `embed.js` files; deletes any not currently referenced in `bundles[*]`. Stops storage growth. | `PRISMEAI_SKIP_BUNDLE_CLEANUP=true` |
| 7 | **Smoke test** | Resolves `/pages/<slug>/_bundle`, fetches the bundle JS, parse-checks via `new Function(...)`, verifies the CJS exports pattern is present. Catches "deploy succeeded but bundle is broken". | `PRISMEAI_SKIP_SMOKE=true` |
| 8 | **Version snapshot** | `POST /workspaces/:id/versions` creates a Prisme.ai workspace version. | `PRISMEAI_SKIP_VERSION_SNAPSHOT=true` |

After successful deploy, the script also refreshes `.prismeai/last-pull.json` with the current workspace state so the next deploy doesn't trip conflict detection on changes you just pushed.

After deploy, hard-reload your browser to bypass any cached bundle.

If a step fails mid-deploy, the script prints a structured summary and per-step recovery guidance — what completed, what failed, what to do next. The atomic boundary is step 5: failures BEFORE it leave the live UI on the previous version (safe to retry); failures AFTER mean deploy succeeded but a side-effect failed (also safe).

### Multi-environment

Use one `.env` file per environment. The deploy and pull scripts pick the right one via `--env=<name>` flag or `PRISMEAI_ENV=<name>` env var:

```
.env                  # default (used when no --env or PRISMEAI_ENV)
.env.staging          # used by `npm run deploy -- --env=staging`
.env.production       # used by `PRISMEAI_ENV=production npm run release`
```

Each file should hold its own `PRISMEAI_API_URL`, `PRISMEAI_WORKSPACE_ID`, and `PRISMEAI_ACCESS_TOKEN` (you don't want sandbox credentials on a prod workspace).

The script prints which file it loaded at start (`· using .env.staging (env=staging)`) so you can't accidentally push dev code to prod.

All `.env*` files except `.env.example` are gitignored.

### Environment variables

| Var | Required | Purpose |
|---|---|---|
| `PRISMEAI_API_URL` | yes | Your platform's API URL **including `/v2`** (e.g. `https://api.acme.example.com/v2`) |
| `PRISMEAI_ACCESS_TOKEN` | one of these | Personal access token (`at:<uuid>`). Sent as `Authorization: Bearer ...` |
| `PRISMEAI_API_KEY` | one of these | Org-scoped API key. Sent as `x-prismeai-api-key`. Use access token instead when possible. |
| `PRISMEAI_WORKSPACE_ID` | yes | Short ID of the target workspace (e.g. `B4eoHS6`) |
| `PRISMEAI_PLATFORM_URL` | no | UI host (e.g. `https://app.acme.example.com`). Only needed for embed.js. |
| `PRISMEAI_BUNDLE_SLUG` | no | Override the bundles[<key>] (default: workspace slug) |
| `PRISMEAI_APP_VERSION` | no | Version label written to workspace config (default `1.0.0`) |
| `PRISMEAI_HTTP_TIMEOUT` | no | Per-request timeout in ms (default `30000`) |
| `PRISMEAI_HTTP_RETRIES` | no | Max retries on 5xx / network errors (default `3`) |
| `PRISMEAI_BUNDLE_SIZE_WARN` | no | Bundle size warn threshold in bytes (default `512000` = 500 KB) |
| `PRISMEAI_BUNDLE_SIZE_MAX` | no | Bundle size hard limit in bytes (default `2097152` = 2 MB) |
| `PRISMEAI_FORCE` | no | `true` to bypass conflict detection |
| `PRISMEAI_SKIP_AUTOMATIONS_SYNC` | no | `true` to skip step 1 |
| `PRISMEAI_SKIP_SOURCE_SYNC` | no | `true` to skip step 2 |
| `PRISMEAI_SKIP_BUNDLE_CLEANUP` | no | `true` to skip step 6 |
| `PRISMEAI_SKIP_SMOKE` | no | `true` to skip step 7 |
| `PRISMEAI_SKIP_VERSION_SNAPSHOT` | no | `true` to skip step 8 |

---

## Undeploy

```bash
npm run undeploy                  # remove bundles[<workspace.slug>] from workspace config
npm run undeploy -- --slug=foo    # remove bundles[foo] (different key)
npm run undeploy -- --purge-files # also DELETE the underlying bundle/embed files
```

Inverse of step 5. Removes the live pointer so `/apps/<slug>` no longer serves a bundle. Source files and automations are left intact (they may be shared across multiple bundles or you may want to keep them for re-deploy). Without `--purge-files`, the bundle artifacts stay in workspace storage — next `npm run deploy` will clean them up via step 6.

Idempotent: running on a workspace that has no `bundles[<slug>]` is a noop.

## Pull workspace state

```bash
npm run pull
```

Inverse of deploy. Fetches:

- All workspace automations → written to `automations/<slug>.yml`
- All `metadata.type=source` files → written to local at their `metadata.path`

Use after a teammate edited automations or source files in the in-builder Builder, OR to bootstrap from an existing workspace. Writes a hash manifest to `.prismeai/last-pull.json` consumed by the deploy script's conflict detection.

> ⚠ Pull **overwrites local files without confirmation**. Commit your local changes first; review with `git diff` after.

### Conflict detection

Before pushing, the deploy script compares server-side hashes against `.prismeai/last-pull.json`. If anything changed remotely since your last pull, the deploy is **refused**:

```
✗ Deploy refused: 2 item(s) changed remotely since your last pull.
    ~ automations/v1/status.yml — modified remotely since last pull
    + src/NewComponent.tsx — added remotely since last pull
```

Resolution paths:
- `npm run pull` → fetch the remote changes, `git diff` to review, then `npm run release`
- `PRISMEAI_FORCE=true npm run release` → ⚠ overwrite remote changes with your local copy
- `npm run deploy -- --force` → same, skips the build step
- *(Heads-up: `npm run release -- --force` does NOT work — npm consumes `--force` as its own flag. Use the env var instead.)*

When **no manifest** exists (first deploy from a clean clone), conflict detection is skipped silently. When the manifest's `workspaceId` doesn't match `PRISMEAI_WORKSPACE_ID`, the deploy refuses with an explanation.

---

## Choose your source of truth

Both this repo and the in-builder Builder UI can write source files and automations to the same workspace. To avoid surprises, pick **one** of these three modes per workspace and commit to it:

### Mode A — Git only (recommended for customer-built apps)

All edits happen in VS Code. Nobody opens the in-builder Builder for source changes.

- Set `PRISMEAI_SKIP_SOURCE_SYNC=true` to avoid leaving stale files in the workspace.
- The deploy script then only writes the bundle + config + version snapshot.
- Code review happens in your git host (GitHub PRs, GitLab MRs).

### Mode B — Builder only

All edits happen in the platform UI. This starter isn't useful for that workflow — work directly in the in-builder Builder and use its own Deploy button.

### Mode C — Hybrid

Both ends edit. Treat the **workspace as the source of truth** and **always pull before deploying**.

1. Pull workspace state into local before editing.
2. Commit the pulled state to git as a checkpoint.
3. Make local edits.
4. `npm run release`.
5. Conflict detection refuses if a teammate edited remotely while you were working — pull first.

---

## Constraints worth knowing

### Tailwind utility classes

Your bundle does **not** ship CSS. The platform serves a single Tailwind stylesheet that all hosted apps share. **Only utility classes already present in that stylesheet will style your app.** The classes used in this starter (`bg-background`, `text-muted-foreground`, `rounded-md`, the standard color/spacing/layout palette) are guaranteed because they match the platform's own design system. Exotic classes may not render — stick to the standard set or use inline `style={...}`.

### lucide-react icons

The platform pre-loads a curated subset (~250 icons) for tree-shaking. Common ones (`ZapIcon`, `BotIcon`, `GlobeIcon`, `Loader2Icon`, `CheckCircleIcon`, ...) are guaranteed. If you import an icon and it renders as `undefined` at runtime, it isn't in the subset — pick a different one or open a request to add it.

### Authentication context

When the platform mounts your app, the user is already authenticated and `sdk.token` is set. You do not need to sign in. For REST calls, **use `credentials: 'include'`** so the browser sends the auth cookie. The example in `src/App.tsx` does this.

### Bundle size

Aim to keep your bundle under ~500 KB minified. Tree-shake unused exports, code-split heavy panels with `React.lazy`, and don't import `lodash` whole — use the per-method imports.

---

## Secret hygiene

`.env` is gitignored by default. The deploy script warns at start if it's tracked anyway (force-added) — that means your token may be in commit history.

For long-term storage, prefer your OS keychain over a plaintext `.env`:

**macOS** — store once, fetch at deploy time:
```bash
security add-generic-password -s prismeai-sandbox -a $USER -w  # prompts silently
# Then in your shell or CI:
export PRISMEAI_ACCESS_TOKEN=$(security find-generic-password -s prismeai-sandbox -w)
npm run release
```

**Linux** (GNOME / `libsecret`):
```bash
secret-tool store --label="Prisme.ai sandbox" service prismeai-sandbox account $USER
export PRISMEAI_ACCESS_TOKEN=$(secret-tool lookup service prismeai-sandbox account $USER)
```

**Windows** (Credential Manager via `cmdkey`):
```cmd
cmdkey /generic:prismeai-sandbox /user:%USERNAME% /pass
```

**CI** (GitHub Actions / GitLab CI): use the platform's secrets store — never put the token in repo files. Inject as `PRISMEAI_ACCESS_TOKEN` env at job start.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Cannot find module 'react'` at runtime | esbuild bundled React instead of treating it as external | Check `scripts/externals.mjs` — the package must be listed |
| `XIcon is not defined` | Icon not in the platform's curated lucide subset | Pick another icon |
| Webhook returns 401 | Missing auth cookie on the request | Add `credentials: 'include'` to the `fetch()` |
| Webhook returns 404 | Automation slug mismatch — `endpoint:` in the YAML must equal the path in the URL | Open the automation in the Builder, copy its endpoint |
| `streamEvents` never connects | Wrong workspace identifier | Use `workspace.id` (UUID), not `workspace.slug` — the events service requires the UUID for non-`slug:` identifiers |
| `npm run deploy` → `404 /v2/v2/...` | `PRISMEAI_API_URL` doesn't include `/v2`, or includes it twice | Set it to `https://api.example.com/v2` (one `/v2`, no trailing slash) |
| Deploy succeeds but app doesn't update | CDN cache | Hard-reload (Cmd+Shift+R) or wait ~30s |
| `Failed to upload bundle: server returned no file` | Token/key lacks write access to that workspace | Check the workspace's RBAC; the token's owner must be a workspace admin |
| Deploy fails with 401 | Token expired or wrong | Mint a new one in **Settings → Access Tokens**; re-check `PRISMEAI_API_URL` includes `/v2` |
| Deploy refused after a teammate edited in Builder | Conflict detection working as intended | Run `npm run pull` to fetch their changes, review with `git diff`, then `npm run release` |

---

## CI/CD

Two recipes ship with the starter:

- **GitHub Actions** — `.github/workflows/deploy.yml`. Triggers on push to `main` (and via manual `workflow_dispatch`). Uses Node 20, caches npm, runs `npm run release`.
- **GitLab CI** — `.gitlab-ci.yml`. Same shape. Includes commented branch-based env routing (`develop` → staging, `main` → production with manual approval).

### Setting secrets

| Where | How |
|---|---|
| GitHub | Repo **Settings → Secrets and variables → Actions → New repository secret** |
| GitLab | Project **Settings → CI/CD → Variables** — mark them **Masked** and **Protected** |
| Both | Add `PRISMEAI_API_URL`, `PRISMEAI_ACCESS_TOKEN`, `PRISMEAI_WORKSPACE_ID`. Optional: `PRISMEAI_PLATFORM_URL`, `PRISMEAI_BUNDLE_SLUG` |

The token used in CI should be a service-account or shared-account access token with explicit expiry. Rotate quarterly. Don't reuse a personal access token.

## Related starters

This is part of the [`prismeai/starter-*`](https://github.com/orgs/prismeai/repositories?q=starter-) family:

| Repo | What it's for |
|---|---|
| **`prismeai/starter-spa`** (this one) | React SPA + DSUL automations — full UI for end users |
| `prismeai/starter-mcp` | Workspace exposing automations as MCP tools, no UI |
| `prismeai/starter-webhooks` | Workspace with webhook-triggered automations only |
| `prismeai/starter-agent` | Agent-factory style workspace for LLM agents |

> Some starters in the family may not be published yet — check the org page for the current set.

---

## License

MIT — fork it, change it, ship it.
