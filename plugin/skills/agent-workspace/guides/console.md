# Operator console

A React page (starter-spa) that ships next to the agent workspace, `pages/<slug>-console/`, so the
people who maintain the agent never run an automation by name with a JSON payload. It reads the
workspace state, previews every change in plain words, applies it after confirmation, and follows
long work until it ends.

The console has two layers:

- **Generic** (`templates/console/` + the console automations of `templates/workspace/`): app shell,
  Dashboard, Agent (sync preview and apply), Journal, and the optional Ingestion, Sources and Bench views.
  Every agent workspace built on the standard engine gets them by copying the template.
- **Specific to your agent**: one screen per recurring maintenance job of *this* agent (add a
  document collection, add a site, map a CRM field…). The template cannot guess them; § 9 is the method.

Contract of every endpoint and shape: `templates/workspace/DESIGN.md` §5.3 and §7.

## 1. When a workspace needs a console

Propose it in the first-pass plan whenever one of these is true:

- someone other than the builder will maintain the agent (business owner, support, client team);
- the agent has content that changes over its life (sources, reference data, cases);
- a maintenance step has side effects in several places (prompt + source + skill…);
- the workspace runs long jobs (ingestion, bench) whose progress must be visible.

A one-shot demo agent with no maintenance does not need one; say so in the plan.

## 2. Plug in the template

1. **Engine first.** The workspace is built from `templates/workspace/` (standard engine: `syncAll`,
   `describeInstance`, `statusReport`, journal, guard). The console only talks to its endpoints.
2. **Bootstrap the page** with `prisme-ai:workspace-page-implement` in `pages/<slug>-console/`
   (starter-spa download, externals and `.dark` fixes, deploy scripts). Do not duplicate its steps.
3. **Overlay the template**: copy `templates/console/src/**` and `tailwind.config.js` over the
   bootstrap, and append `templates/console/AGENTS.console.md` to the page's `AGENTS.md`
   (the UX rules travel with the code). Follow `templates/console/README.md` for package changes.
4. **Edit `src/console.config.ts` only**: title, agent name, labels of the knowledge bases, tools,
   documents and journal actions, the optional views (Ingestion, Sources, Bench) the workspace has.
5. **Run the mock** (`npm run dev`, `?mock=update|install|drift|ok|running`) and check every state in
   light and dark (§ 8). Then build and deploy with `workspace-page-implement`.
6. **Add the specific screens** (§ 9) as views in `src/views/custom/`, registered in
   `src/views/custom/index.tsx` (agent content, like `console.config.ts`). Never edit the other files of
   the overlay: a newer template replaces them as is.
7. **Report the preview URL**: `https://<studio-host>/apps/<slug>?view=dashboard`. The Studio resolves
   `/apps/<X>` as a **workspace slug** and reads `config.value.bundles[<X>]`, so the bundle key is the
   workspace slug (`pages/<slug>-console/` is only the local folder). Keep `socleVersion` and the
   `bundles` entry in `index.yml`: a push then publishes the new bundle pointer as well, and never
   drops it.

## 3. Backend pattern

All in `templates/workspace/automations/`, all guarded by `_guard-control`:

| Endpoint | Job |
|---|---|
| `consoleState` | The one read every view starts from: who am I (role, `canControl`, `canAdmin`), `statusReport`, effective sources, the agents' sync state (`withAgents`, ~4 s, read on demand), the last journal lines. |
| `consoleAction {action, args}` | The one write door. `_console-dispatch` is the allow-list of automations it may run; admin-only actions are listed there too. Admin-only actions are refused by the automation itself and relayed. Journals before (running) and after (ok / error), so an action whose answer the page stopped waiting for still shows. HTTP 200 with `{ok, error, message, result}` once the action ran; 403 / 400 when refused before. |
| `consoleDiff` | Read-only comparisons too slow for `consoleState` (agent field diff, knowledge-base settings). |
| `consoleSources` | List, preview, save, follow, export and integrate local source changes (§ 4). |

Rules that keep it safe and simple:

- **Dry run then confirm.** Every write action has a read-only form (`syncAll {dryRun}`,
  `refreshSource {dryRun}`); the page shows it before the button, and the button opens a confirmation
  that states the consequence.
- **One allow-list.** The page never names an automation that is not in `_console-dispatch`. Adding a
  specific screen that needs a new action = one line in the allow-list (+ admin list if it can lose work).
- **Long work never blocks a request.** The gateway cuts a webhook at ~60 s while the run goes on. The
  page stops waiting at 50 s, says « toujours en cours » and follows the work through `consoleState`
  (every 10 s while following, every 30 s while something runs).
- **Product errors become sentences.** Automations return PascalCase codes (DESIGN §5.4); the page maps
  each to one plain sentence (`errorText`) and keeps the code under « Détails techniques ».

## 4. Live configuration over git

The delivered configuration (`index.yml`) is versioned in git and pushed as a whole. If the console
rewrote it, the next push from git would silently erase what operators added. So:

- the console never writes `config`; local additions live in state rows `overlay:<list>`
  (`{added, removed, by, at, baseHash}`);
- every reader goes through `_sources-effective`, which layers the overlay over the delivered entry;
- the page shows « À reporter dans git » while an overlay exists, with the YAML of the entry with the
  overlay folded in (`consoleSources {op: export}`) to paste into `index.yml`;
- once git contains it, « Intégré dans git » (`markIntegrated`) drops the overlay; it refuses while the
  delivered list still lacks an addition (`NotIntegrated`).

Use the same pattern for any list operators extend (reference terms, evaluation cases, mappings): one
`overlay:<list>` row, one `*-effective` reader, one export.

## 5. Security

- **Control roles.** `config.controlRoles` lists the workspace roles allowed on every console endpoint;
  `config.adminRoles` the roles allowed on actions that can lose work (force a sync over a hand edit,
  stop the ingestion, abandon a bench, prune documents). Both are checked server-side; the page only
  mirrors them (`canControl`, `canAdmin`) to explain blocked buttons.
- **The `control` role** is granted only through a workspace API key in `security.yml`, never through
  `prismeai` auth (that would hand it to every authenticated platform user).
- **No secret in the page.** The bundle is public. The page calls the workspace webhooks with the Studio
  session (`credentials: 'include'`) and the CSRF header `x-prismeai-csrf-token` from `sdk._csrfToken`,
  so the automations see the real caller and `user.role`.
- **Journal summaries only**: never a token, a secret or a full document in `args` or `result`.

## 6. UX rules for non-developer users

These rules are the console's contract; keep them in every view, generic or specific
(`templates/console/AGENTS.console.md` carries the same text for the page's `AGENTS.md`).

1. **Plain language first, technical detail folded.** Anything that describes a change (sync plan,
   differences, ingestion results) starts with one or two sentences saying what changes *for the agent
   and for its users*. Then the changes grouped by meaning (Consignes, Compétences, Sources et outils,
   Réglages, Sous-agents) with human labels, never raw field names, JSON paths or tool slugs. The raw data
   stays behind a « Détails techniques » toggle (`ChangeSummary`).
2. **Every warning has a severity and an explanation.** Three levels only: « Rien de risqué » (green),
   « À vérifier » (amber), « Destructif » (red). Each non-green item says *why* in one sentence. Lowering a
   limit, changing the model or the visibility is « À vérifier »; removing a skill, a source access or a
   sub-agent is « Destructif ».
3. **No silently disabled button.** An action that cannot run uses `<Btn blocked={…}>`: the reason is
   shown next to the button, and clicking it shows how to unblock it (`lib/blockers.ts`: `roleBlock`,
   `adminBlock`, `block(cond, reason, fix)`, `first(...)`). When a blocker points to another screen, add a
   button that opens it.
4. **Preview before any write, computed for the user, confirmation with the consequence.** The preview
   runs on its own when the page opens and something is to do; it sits above a single primary button.
   The console chooses the technical scope; never ask the operator to pick one. Destructive or admin-only
   actions need a second confirmation.
5. **Long actions never look frozen.** Stop waiting at 50 s, say « toujours en cours », follow through
   `consoleState`.
6. **Appearance comes from the platform theme** (§ 7).
7. **One state = one title, one explanation, one action; one place per fact.** The agent state is
   computed once (`agentState()` in `lib/status.ts`) and read by every view. A blocker is said once, where
   it is resolved; elsewhere, a link. The dashboard shows each area's headline and links to the page that
   fixes it: no alert list, no actions.
8. **Describe changes by what the agent's users will notice** (« Il sait faire 4 nouvelles choses »,
   « Il change de modèle »), not by system terms; one name per concept. Never show « ressource »,
   « collection », « schéma », « manifeste », « instance » or tool slugs outside « Détails techniques ».
9. **French first** (`?lang=en` for English), strings next to their use with `tr(fr, en)`, a
   `data-testid` on every action.

## 7. Style rules

- Colours only through the platform theme variables (`--primary`, `--card`, `--muted`, `--border`,
  `--foreground`…), never a hard-coded brand colour. Status tones (green / amber / red / blue) use the
  Tailwind palette with a `dark:` variant.
- Dark mode follows the Studio `.dark` class on `<html>`, not `prefers-color-scheme`. Keep the
  `:where(.dark)` fallback outside `@layer` so Tailwind does not purge it, and the scoped overrides of the
  Studio's `--accent` and global `button, label` font rules (`globals.css`).
- Layout of the platform blueprint pages: ink sidebar grouped by section (fixed, only the content column
  scrolls), eyebrow + title + one lead line, `rounded-xl` cards, one card level (nothing boxed inside a
  card).
- Icons are inline SVG (`components/icons.tsx`, 24×24, stroke 1.75, `currentColor`): the host ships only
  a subset of lucide.

## 8. Testing

- **Mock host.** `npm run dev` mounts the app with `lib/mockHost.ts`, which answers every console endpoint
  from `lib/fixtures.ts`. `?mock=update|install|drift|ok|running` switches the agent state; add a fixture
  for every specific screen so it can be reviewed without a workspace.
- **Browser check, light and dark.** For each view and each mock state: no raw field name outside
  « Détails techniques », every blocked button says why, the confirmation states the consequence, nothing
  overflows at 375 px. Add `&theme=dark` to the mock URL to check dark mode (it sets the Studio's `dark` class on `<html>`).
- **Typecheck and build**: `npm run typecheck`, `npm run build`.
- **On the environment**: after deploy, reload the page once (the Studio may still serve the previous
  bundle on the first load), open `?view=agent` and check the preview runs on its own and the
  journal records an action; then `tests/engine` of the workspace (DESIGN §9).

## 9. Designing the screens specific to your agent

The generic views cover what every agent has. The screens that make a console worth having are the
ones built for the jobs *this* agent needs over its life. Design them with this method, and write the
result into the first-pass plan.

### 9.1 List what changes over the agent's life

For the agent you are building, list every thing that will change after go-live, and who changes it:

- its **sources** (documents, sites, specifications, folders, feeds);
- its **reference data** (glossary, codes, product lists, mappings);
- its **prompt pieces** that depend on that content (scope lists, examples, rules per source);
- its **evaluation cases** (new real questions, expected answers);
- its **external connectors** (fields, objects, credentials owned by the client);
- its **settings** that the business may tune (model, limits, visibility).

Anything only the builder changes, once, stays in git. Anything an operator will change more than once
is a candidate screen.

### 9.2 For each recurring job, list every side effect

Write the job as the operator would say it, then list every place in the workspace it touches. Be
exhaustive; this list is the screen's specification.

> A job as small as « add a document collection to the agent » typically touches: the source
> parameters, the documents to fetch and index, the list of covered topics in the prompt, the same
> list in a skill, the display titles used in citations, and the reference terms. Five or six places an
> operator cannot be expected to remember.

### 9.3 Make side effects automatic where possible

Each side effect is one of:

- **derived**: computable from something else → generate it at sync time, never ask for it (a scope list in the prompt and a
  skill's text are generated from the declared sources; display titles are read during the preview);
- **follow-up**: another job the operator must do → the screen ends by pointing to it (« Mettre à jour
  l'agent » on the Agent page);
- **manual**: needs a human decision → ask for it in the screen, with a default.

Aim for one manual input per job. If the list of manual inputs is long, the data model is wrong: move
the derived parts into the engine first.

### 9.4 Build a wizard: choose → preview → apply → follow

1. **Choose.** The smallest input that identifies the change (an identifier, a URL, a field). Validate
   while typing (format, duplicate, already present) through a read-only `op: parse`.
2. **Preview.** What will be fetched, created or changed, with numbers: documents found and already
   ingested, quota left, the prompt text before / after, the risks in the three severities. Nothing is
   written. Run it on its own when the input is valid.
3. **Apply.** Save through the overlay (§ 4) and journal it; if the agent must be re-synced, show the
   sync preview (the generic Agent page) instead of a second plan; confirmation states the consequence.
4. **Follow.** The state of every item the change started (queued, ingested, failed), from
   `consoleSources {op: progress}` or `consoleState`, with « Réessayer » on the failures only.

### 9.5 Add the endpoints it needs

- a **preview mode** on the automation that does the work (`refreshSource {dryRun, params}` for a
  source; a `dryRun` on any custom job), so preview and apply share one code path;
- the source type's **discovery branch** in `_source-discover` if the source is not a plain URL list;
- **`consoleSources` ops** (parse, preview, save, progress) for the list the screen edits, writing local
  additions to the overlay;
- the job's write action in the **`_console-dispatch` allow-list** (and the admin list if it can lose work);
- **labels** of the new resources and actions in `console.config.ts`, and its error codes in `errorText`.

### 9.6 Guidelines for a custom data source screen

When the agent reads a source the template does not cover (an internal portal, a document
repository, an API, a versioned archive…), its maintenance screen follows the same shape. Keep the
specifics of the source in one discovery branch and one parser; everything else is generic.

- **Input in the operator's words.** Accept the identifiers people already use for that content and
  normalise them server-side (`consoleSources {op: parse}`): format, duplicate, already declared, not
  found. Show each problem next to the entry it concerns.
- **Discovery is read-only and shared.** The preview calls the same discovery as the real refresh
  (`_source-discover` through `refreshSource {dryRun: true, params}`), never a second code path that
  could disagree with what will be ingested.
- **Preview in numbers.** Documents found, already ingested, to download, to remove; base quota left;
  the text the prompt or skills will carry before / after; slow lookups (titles, sizes) fetched in the
  background so the preview is never blocked by them.
- **One preview call per entry, in parallel**, when an entry is expensive to resolve; merge the results
  client-side and keep each entry's failure separate.
- **Stable identity.** One item per document with a stable URL or key, so re-running a refresh never
  duplicates and a removal can be traced.
- **Derived text is generated.** Lists of covered content in the prompt, skill text and display labels
  come from the effective sources at sync time; the screen ends by pointing to the Agent page, which
  previews that sync.
- **Follow and retry per item.** After saving, show the state of every item the change started and
  re-queue only the failed ones (`refreshSource {requeue: [ids]}`).
- **Fold into git.** The change lives in the overlay until the delivered config contains it (§ 4).

`guides/ingestion.md` § 3 lists what the discovery branch must return.

### 9.7 Sketches for other agent types

**Website-crawl RAG agent — « Ajouter ou retirer un site ».**
Changes over life: the list of sites, their crawl depth, excluded paths. Side effects: the source
`urls` list, the documents to crawl or delete, the « sites couverts » list in the prompt, the citation
labels. Automatic: the prompt list generated from the effective sources; labels from the page titles
found in the preview. Wizard: choose a URL (checked: reachable, not already covered, robots allowed) →
preview (pages found, already indexed, documents left in the base quota, prompt list before / after) →
apply (overlay + `refreshSource`; removal deletes documents only with `prune`, admin-only, red
severity) → follow (pages queued / indexed / failed, retry failures). The generic Sources view of the
template already covers the plain `urls` case; add depth and exclusions as a custom source type.

**CRM connector agent — « Mapper un champ ».**
Changes over life: which CRM objects and fields the agent may read, their business names, which are
sensitive. Side effects: the connector's field allow-list, the tool descriptions the agent sees, the
prompt's glossary of field names, the evaluation cases that use the field. Automatic: tool descriptions
and the prompt glossary generated from the mapping. Wizard: choose an object and field from the live
CRM schema (read through the connector) → preview (sample values redacted, which tools change, « À
vérifier » when the field looks personal) → apply (mapping overlay + agent sync preview) → follow (a
generated test question answered with the new field). Endpoint: a `dryRun` on the mapping automation
that returns the tool descriptions before / after.

**FAQ agent — « Ajouter des cas d'évaluation ».**
Changes over life: real questions users asked, their expected answers, the criteria. Side effects: the
case list, the bench baseline (a new case is not comparable with older runs), possibly a missing source.
Automatic: case ids, tags from the matching source, the « not comparable » flag on the next report.
Wizard: choose questions (paste, or pick from recent conversations with a low rating) → preview (the
agent's current answer to each, duplicates of existing cases, which source would answer) → apply (cases
overlay + `importCases`) → follow (a bench limited to the new cases, scores per case). Endpoints:
`consoleCases {op: parse | preview | save}` over `overlay:cases`, and `runBenchmark {tags}`.
