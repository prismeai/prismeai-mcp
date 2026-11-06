# Operator console — template (overlay on starter-spa)

A maintenance console for an agent workspace built from `templates/workspace/` (contract:
`templates/workspace/DESIGN.md`). Operators who are not developers use it to see whether the agent
is up to date, preview and apply a sync, follow the import of its sources, add or remove addresses
of a source without touching git, and run benchmarks.

The template only contains what differs from a fresh **starter-spa** app. Bootstrap the app first
(skill `prisme-ai:workspace-page-implement`), then copy this overlay on top of it.

## What to copy where

| Template file | Goes to (app folder, e.g. `pages/<slug>/`) | How |
|---|---|---|
| `src/**` | `src/` | Copy over. Replaces `App.tsx`, `main.tsx`, `types.ts`, `lib/mockHost.ts`, `styles/globals.css`; adds `console.config.ts`, `components/*.tsx`, `lib/*`, `views/*`. Keep the starter's `src/components/ui/` (unused by the console, left as scaffold). |
| `tailwind.config.js` | app root | Replace (theme colours mapped to the platform variables, `darkMode: 'class'`). |
| `AGENTS.console.md` | append to the app's `AGENTS.md` | Paste it right after the title: these rules are the console contract. |
| `README.md` | — | This file; do not copy. |

Not part of the overlay: `scripts/*.mjs`, `package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`
stay the starter's. The console needs **no new dependency** (React, `clsx`, `tailwind-merge` from the
starter; no lucide icon, no Radix component). Only optional `package.json` edits: `name` and
`description`. You can delete the starter's demo automations (`automations/on-app-greeting-requested.yml`,
`automations/v1/status.yml`): the console calls the workspace endpoints of `templates/workspace/`.

## What a new workspace edits: `src/console.config.ts`

Everything workspace-specific lives in this one file; the values shipped are placeholders that match the
workspace template and the local mock. Same rule as the workspace engine (DESIGN §1.1): this file and the
agent-specific views you add (in `src/views/custom/`, registered in `src/views/custom/index.tsx`) are the agent's content;
every other file of the overlay is replaced as is when you take a newer template. Keys are the manifest keys of `index.yml` (`config.value.…`), never product ids. Every label
is a string or `{fr, en}`; a key you do not list still shows, with a readable fallback from its name.

| Field | What to put |
|---|---|
| `title`, `monogram` | Sidebar title and the letter(s) of its tile. |
| `agentName` | Name of the agent as its users know it (titles: « … est à jour »). |
| `mainAgent` | Manifest key of the agent the console is about (default: first non-optional agent). |
| `locale` | `fr` or `en` when the URL has no `?lang=`. |
| `views` | Optional views: `ingestion` (bases and import), `sources` (address editor), `bench` (benchmarks). Dashboard, Agent and Journal are always on. |
| `nav.groups`, `nav.labels` | Sidebar group titles and view labels. |
| `knowledgeBases` | Per base key: `label` (« la base « … » »), `can` (what it lets the agent do, used in « Ce que l’agent ne pourra pas encore faire »), `external: true` for a base filled outside the console (`create: false`). |
| `tools` | Per tool name (`agents[].tools[].name`): `label`, and `kb` to link a knowledge tool to its base. |
| `skills`, `agents` | What each skill lets the agent do; label of each agent / sub-agent / variant. |
| `documents` | Per reference document key: `label`, `emptyHint` (how to fill it when the sync skips it). |
| `sources` | Per source key: `label`, `item` word (« page / pages », « fichier / fichiers »). |
| `resources` | Plain words for any other dependency an agent can miss (`<kind>:<key>`). |
| `journalActions` | Label of each journaled action (consoleAction names, `sources.save`, `sources.markIntegrated`). |
| `bench` | Sizes offered (`0` = full case set) and optional tag filters. |
| `mock.scenario` | Scenario of `npm run dev` when the URL has no `?mock=`. |

## Views

- **Tableau de bord**: one card per area (agent, content, quality) with its headline and a link; last 3 actions.
- **Agent**: the state card from `agentState()` (à jour, mise à jour prête, à installer, modifié à la main,
  en cours, illisible), the preview computed on its own (`syncAll {dryRun: true}`), « Ce que les
  utilisateurs remarqueront », « Ce que l’agent ne pourra pas encore faire », one « Détails techniques »
  fold, a confirmation, a double confirmation (admin) to replace a hand-edited agent. Old `?view=diff`
  links land here.
- **Historique**: the journal (who, what, result).
- **Sources** (optional): editor of `urls` sources over git (DESIGN §7): add / remove addresses → preview
  (`consoleSources preview`) → save → import (`refreshSource`) followed address by address
  (`consoleSources progress`, « Réessayer ») → « À reporter dans git » (YAML export, `markIntegrated`).
- **Bases et import** (optional): bases with document counts, queue, failures with retry, a pass per
  source, suspend / resume / stop (admin, double confirmation).
- **Banc de test** (optional): load the cases, run, follow, pause / resume / stop, scores per agent, export.

Views are linked with `?view=` (shareable), the language with `?lang=en`.

## Endpoints it reads (DESIGN.md §5.3)

`consoleState` (one read feeds every view, re-read every 30 s while something runs, every 10 s while
following an action), `consoleAction {action, args}` (every write and the dry runs), `consoleDiff
{part: agents | kbs}`, `consoleSources {op: preview | save | progress | export | markIntegrated}`. All
calls use the Studio session (cookie + CSRF header); the page holds no secret. The client stops waiting
at 50 s and follows the run through `consoleState`.

## Local mock

`npm run dev` renders the console with `src/lib/mockHost.ts`, which answers every endpoint in memory
from `src/lib/fixtures.ts` (never bundled: only `src/main.tsx` imports it). URL parameters:

- `?mock=ok | update | install | drift | running` — the agent state (default `CONFIG.mock.scenario`);
- `?role=owner | editor | viewer` — `editor` sees the admin-only blockers; `viewer` (no control role) gets `Forbidden` on every endpoint, as on the workspace;
- `?slow=1` — a sync takes 55 s, longer than the 50 s client timeout (« toujours en cours » path);
- `?agentsError=1` — the agent read fails;
- `?mock=off` — call a real workspace (`VITE_PRISME_API_URL`, `VITE_PRISME_API_KEY`, `VITE_PRISME_WORKSPACE_ID` in `.env`).

In the mock, the first « C’est intégré dans git » is refused (`NotIntegrated`) and the second plays the delivery.

## Checks before shipping

`npm run typecheck`, `npm run build` (about 160 KB including 32 KB of CSS), then the five mock scenarios
in a browser, in light and dark mode, in French and English.
