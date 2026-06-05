# Agent instructions

This file gives AI coding agents (Claude Code, OpenAI Codex, Cursor, Gemini, etc.) the context they need to work productively in this repo. Humans should also read it.

`CLAUDE.md` and `.cursorrules` exist as one-liner pointers to this file — don't duplicate content across them.

---

## What this repo is

A starter for building a Prisme.ai app locally in VS Code, then deploying it to a workspace via `npm run deploy`.

The deployed artifact is a CommonJS React bundle (`dist/bundle.js`) that the Prisme.ai platform's `AppRenderer` loads at runtime, plus optional DSUL automations under `automations/` that the React app calls.

**Read [`README.md`](./README.md) before making changes.** It explains the host contract, the deploy pipeline, and the constraints (Tailwind class set, lucide icon subset, externals).

---

## Repo layout

```
.
├── src/                          # React app — DEFAULT EXPORT of src/App.tsx is what the platform mounts
│   ├── App.tsx                   # ← edit this
│   ├── main.tsx                  # local dev only
│   ├── components/ui/            # shadcn-style; treat as scaffold (avoid breaking changes)
│   ├── lib/utils.ts              # cn() helper
│   └── lib/mockHost.ts           # local dev stub for {sdk, user, workspace} props
├── automations/                  # DSUL YAML — pushed to workspace by deploy
├── imports/                      # DSUL imports (empty by default)
├── index.yml                     # workspace metadata (optional)
├── security.yml                  # workspace RBAC (optional)
├── scripts/
│   ├── build.mjs                 # esbuild → dist/bundle.js (CJS, externals stripped)
│   ├── deploy.mjs                # push: automations + source files + bundle + config + version
│   ├── pull.mjs                  # pull workspace state → local
│   └── externals.mjs             # CANONICAL list of host-provided modules
├── .vscode/
├── .env.example                  # never commit .env itself
├── README.md                     # read first
├── TODO.md                       # roadmap; check before adding features
└── AGENTS.md                     # this file
```

---

## Hard rules

1. **Don't bundle externals.** If you add a dependency that the platform already provides (React, Radix, lucide-react, clsx, tailwind-merge, class-variance-authority, jotai, `@prisme.ai/sdk`), it MUST be in `scripts/externals.mjs`. Otherwise it gets duplicated and breaks (especially React → "Invalid hook call").

2. **Don't change the default export contract.** `src/App.tsx` exports `default function App({ sdk, user, workspace, backends, agents }: AppProps)`. The platform's `AppRenderer` validates `module.default` exists and passes those exact props. Renaming the export or changing the signature breaks every deployment.

3. **Don't add `process.env.*` access in `src/`.** That's Node-only. Browser code uses `import.meta.env.VITE_*` (Vite convention). Server-side scripts (`scripts/*.mjs`) use `process.env.*` via `dotenv/config`.

4. **Don't commit `.env`.** `.gitignore` already excludes it. If you add new required env vars, document them in `.env.example` AND in the README "Environment variables" table.

5. **Don't bypass the deploy pipeline.** No "quick" `curl` deploys, no manual file uploads. If you need behavior the deploy script doesn't have, extend `scripts/deploy.mjs` and document it.

6. **Don't change auth without good reason.** The script accepts `PRISMEAI_ACCESS_TOKEN` (Bearer) or `PRISMEAI_API_KEY` (`x-prismeai-api-key`). Keep both paths working.

7. **Don't introduce a build for `automations/, imports/, etc.`.** YAMLs under `automations/` are pushed as-is. Don't add a templating layer; keep the DSUL plain.

---

## Common tasks

| Task | Command / file |
|---|---|
| Run dev server | `npm run dev` |
| Build the bundle | `npm run build` |
| Deploy to workspace | `npm run deploy` (or `npm run release` to build+deploy) |
| Pull workspace state | `npm run pull` |
| Add a new automation | Add a YAML under `automations/` with top-level `slug` field |
| Add a UI component | Custom code in `src/components/`, NOT in `src/components/ui/` |
| Add a dependency | Check `npm-dependency-evaluator` agent (if available) and verify it's NOT a host external |

---

## Conventions

- **Auth header**: `Authorization: Bearer at:<uuid>` for personal access tokens; `x-prismeai-api-key: <key>` for org keys. The deploy script picks one based on which env var is set.
- **API base**: `PRISMEAI_API_URL` MUST include `/v2` (e.g. `https://api.sandbox.prisme.ai/v2`). Append paths starting with `/`.
- **Workspace IDs**: short alphanumeric (e.g. `B4eoHS6`), NOT UUIDs. `slug:` prefix works for some endpoints (webhooks) but not all (files).
- **Automation slugs** can contain `/` (e.g. `v1/status`). URL-encode in API paths (`%2F`); use as-is in YAML and file paths.
- **Hash algorithm**: SHA-256 hex for content addressing (matches the platform's own `computeHash`).
- **YAML quoting**: `js-yaml` with `quotingType: "'"` to match the export format.

---

## Things I see agents do wrong

- Adding `react`, `react-dom`, etc. to the bundle by forgetting to update `externals.mjs`. Always cross-check.
- Importing from `@prisme.ai/sdk` in `src/`. The package is NOT on public npm. Use plain `fetch` and `socket.io-client` (when added).
- Calling `process.env.X` in browser code — undefined in Vite/esbuild output.
- Modifying `src/components/ui/*` without realizing they're treated as scaffold by the agent UI in the in-builder Builder. Edits will be preserved but the in-builder AI may regenerate them.
- Writing a "test deploy" that calls the real API without checking which workspace is in `.env`. Always print `PRISMEAI_WORKSPACE_ID` and confirm before destructive ops.

---

## Before you finish a change

1. `npm run typecheck` passes
2. `npm run build` succeeds and `dist/bundle.js` is reasonable size
3. If you touched `scripts/*.mjs`, `node --check` on each
4. If you touched `automations/, imports/, etc.`, `npm run deploy` against a sandbox workspace before claiming "done"
5. Update `README.md` if you changed user-facing behavior
6. Update `TODO.md` if you closed an item or surfaced a new one
