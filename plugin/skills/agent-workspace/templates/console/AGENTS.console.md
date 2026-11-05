## Console UX rules (non-developer users) — READ FIRST

This app is the **operator console** of an agent workspace (template `agent-workspace/templates/console`,
contract `DESIGN.md` of the workspace). Its users are operators, not developers. These rules are part of
its contract: keep them when you change a view, add one, or copy the console to another workspace.

1. **Plain language first, technical detail folded.** Anything that describes a change (sync plan,
   differences, import results) starts with one or two sentences saying what changes *for the agent and
   for its users*. Then the changes grouped by meaning — Consignes, Compétences, Sources et outils,
   Réglages, Sous-agents — with human labels (from `src/console.config.ts`), never raw field names, JSON
   paths or tool slugs. The raw data stays available behind one « Détails techniques » toggle.
   Implementation: `src/components/ChangeSummary.tsx` (`fromPlan` for a syncAll dry run, `fromDiff` for a
   describeInstance diff; both mean « what a sync would do »).
2. **Every warning has a severity and an explanation.** Three levels only: « Rien de risqué » (green),
   « À vérifier » (amber), « Destructif » (red). Each non-green item says *why* in one sentence (what the
   user loses or must check). Lowering a limit, changing the model, the temperature or the visibility is
   « À vérifier »; removing a skill, a tool or source access, a sub-agent, or instruction sections is
   « Destructif ».
3. **No silently disabled button.** An action that cannot run uses `<Btn blocked={…}>` (never a bare
   `disabled`): the reason is shown next to the button, and clicking it shows how to unblock it
   (`src/lib/blockers.ts`: `roleBlock`, `adminBlock`, `block(cond, reason, fix)`, `first(...)`). Typical
   reasons: « Votre rôle ne le permet pas », « Réservé aux administrateurs », « Un passage est déjà en
   cours », « Calcul de l’aperçu… », « Rien à enregistrer ». When a blocker points to another screen, add
   a button that opens it. Without a control role, say it once (on the main action), not on every row.
4. **Preview before any write, computed for the user, confirmation with the consequence.** The preview
   (read-only dry run) runs on its own when the page opens and something is to do, or right after the
   operator edits something; it is shown above a single primary button. The console chooses the
   technical scope (the Agent page always previews a full sync, which only creates what is missing);
   never ask the operator to pick one. Writes go through a `Confirm` dialog that states what will happen;
   destructive or admin-only actions (replace a hand-edited agent, stop the whole import) need a second
   confirmation.
5. **Long actions never look frozen.** The client stops waiting at 50 s, says « toujours en cours » and
   follows the work through `consoleState` (every 10 s), see `src/lib/console.tsx`. Imports are followed
   item by item (`consoleSources progress`), with « Réessayer » on each failure.
6. **Appearance comes from the platform theme.** Colours only through the theme variables (`--primary`,
   `--card`, `--muted`, `--border`, `--foreground`…; no hard-coded brand colour), dark mode through the
   Studio `.dark` class (`:where(.dark)` fallback and the `.console` scoped overrides of
   `src/styles/globals.css`), inline SVG icons only (`src/components/icons.tsx`), layout of the platform
   operator pages (ink sidebar grouped by section, eyebrow + title + lead, `rounded-xl` cards, one card
   level, the content column scrolls alone).
7. **One state = one title, one explanation, one action; one place per fact.** The agent state is
   computed once (`agentState()` in `src/lib/status.ts`) and read by the dashboard and the Agent page. A
   blocker is said once, where it is resolved; elsewhere, a link. The dashboard only shows each area's
   headline and links to the page that fixes it (no alert list, no actions).
8. **Describe changes by what the agent's users will notice** (« Il sait faire 2 nouvelles choses »,
   « Il change de modèle »), not by system terms; one name per concept (« synchronisation complète »,
   « mise à jour de l’agent », « source de données », « À reporter dans git »). Never show « ressource »,
   « collection », « schéma », « manifeste », « instance », « overlay » or tool slugs outside « Détails
   techniques ». Every name comes from `src/console.config.ts` (with a readable fallback from the key).
9. **French first** (`CONFIG.locale`, `?lang=en` for English), strings next to their use with
   `tr(fr, en)`, every error code turned into one plain sentence (`errorText` in `src/lib/i18n.ts`, the
   code itself under « Détails techniques »), a `data-testid` on every action.

### Working on the console

- Words and optional views: `src/console.config.ts` only. A view never hard-codes a base, tool or source name.
- Shapes: `src/lib/types.ts` mirrors `DESIGN.md` §4.3, §4.6, §4.7, §5.1–5.3, §7. When the workspace contract
  changes, change both in the same commit, then the mock (`src/lib/mockHost.ts`, `src/lib/fixtures.ts`).
- Check every agent state with the mock before shipping: `npm run dev`, then `?mock=ok|update|install|drift|running`,
  `?role=owner|editor|viewer`, `?slow=1` (sync longer than the client timeout), `?agentsError=1`.
