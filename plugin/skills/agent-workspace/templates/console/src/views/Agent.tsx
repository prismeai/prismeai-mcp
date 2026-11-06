import { useCallback, useEffect, useState } from 'react'
import { CONFIG } from '@/console.config'
import { useConsole } from '@/lib/console'
import { adminBlock, block, first, roleBlock } from '@/lib/blockers'
import { ago, dateTime, errorTechnical, errorText, lb, num, tr } from '@/lib/i18n'
import { agentLabel, docEmptyHint, docLabel, frDe, kbCan, kbExternal, kbName, resourceWords } from '@/lib/labels'
import { type Go, viewLabel, viewOn } from '@/lib/nav'
import { agentState, ingestTotals, mainAgent, missingOf, syncRunning } from '@/lib/status'
import type { AgentRow, ConsoleState, SyncAction, SyncResult } from '@/lib/types'
import { Banner, Btn, Confirm, Dot, PageHeader, Panel, Spinner, type Tone } from '@/components/kit'
import { GROUPS, SEVERITY, UserEffects, fromDiff, overall, type Group } from '@/components/ChangeSummary'
import { otherLine, TechnicalPlan } from '@/components/SyncPlan'
import { AgentTechnical, useDiffPart } from '@/components/diffParts'
import { journalStatusText, journalTone } from '@/views/Journal'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ *
 * Agent page: answers « is my agent up to date, and what is the one
 * thing to do? ». One state card (title, explanation, one action), the
 * preview computed on its own (full syncAll dry run: it only creates what
 * is missing), what users will notice, what the agent cannot do yet, and
 * one « Détails techniques » fold. No scope to pick (rule 4).
 * ------------------------------------------------------------------ */

const PLAN_KEY = 'plan:full'
const NOOP = ['exists', 'unchanged', 'none', 'bound', 'optional']

/** Writes that make a computed preview out of date. */
const isWrite = (action: string, args: Record<string, unknown> | undefined) => (action === 'syncAll' && !args?.dryRun) || action.startsWith('sources.')

const toneBorder: Record<Tone, string> = { ok: 'border-l-emerald-500', warn: 'border-l-amber-500', bad: 'border-l-red-500', info: 'border-l-primary', muted: 'border-l-border' }

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export default function Agent({ go }: { go: Go }) {
  const { state, run, busy, refresh, memo } = useConsole()
  const st = agentState(state)
  const main = mainAgent(state)
  const needsAction = st.kind === 'update' || st.kind === 'install' || st.kind === 'drift'

  // What users will notice: the agent comparison, read on its own when something is to do.
  const diff = useDiffPart<{ agents: AgentRow[] }>('agents', { agents: main ? [main.key] : [] }, needsAction && !!main)
  const row = diff.data?.agents?.find((a) => a.key === main?.key)

  // The preview: a full syncAll dry run (creates what is missing, then updates the agent), kept in memo.
  const cachedPlan = memo.get<SyncResult>(PLAN_KEY)
  const [plan, setPlan] = useState<SyncResult | null>(cachedPlan?.value ?? null)
  const [planAt, setPlanAt] = useState<number | null>(cachedPlan?.at ?? null)
  const [planErr, setPlanErr] = useState<{ code?: string; message?: string } | null>(null)
  const [withImport, setWithImport] = useState(true)
  const [confirm, setConfirm] = useState<'apply' | 'force1' | 'force2' | null>(null)
  const [result, setResult] = useState<{ ok: boolean; code?: string; message?: string; at: string; created: number; imported: boolean } | null>(null)
  const [snapshot, setSnapshot] = useState<{ name?: string; url?: string } | null>(null)

  const loadPlan = useCallback(async () => {
    setPlanErr(null)
    const ans = await run<SyncResult>('agent-plan', tr('Calcul des changements', 'Computing the changes'), 'syncAll', { dryRun: true })
    if (ans) {
      if (ans.ok || ans.result?.actions) {
        memo.set(PLAN_KEY, ans.result)
        setPlan(ans.result)
        setPlanAt(Date.now())
      }
      if (!ans.ok) setPlanErr({ code: ans.error || undefined, message: ans.message || undefined })
    } else setPlanErr({ code: 'NetworkError' })
  }, [run, memo])

  useEffect(() => {
    if (needsAction && !plan && !busy['agent-plan']) void loadPlan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsAction])

  // The preview is out of date when another write happened since it was computed.
  const stale = !!planAt && !!state?.journal?.some((j) => isWrite(j.data.action || '', j.data.args) && j.status !== 'running' && new Date(j.data.startedAt || j.updatedAt).getTime() > planAt)

  const acts: SyncAction[] = plan?.actions || []
  const created = acts.filter((a) => a.type === 'kb' && a.action === 'would-create')
  const createdKeys = created.map((a) => `kb:${a.key}`)
  const otherLines = acts.filter((a) => (a.type === 'kb' || a.type === 'kbdoc' || (a.type === 'agent' && a.key !== main?.key)))
  const noteLines = otherLines.filter((a) => !NOOP.includes(a.action) && a.action !== 'would-create')
  const inPlace = otherLines.filter((a) => NOOP.includes(a.action))
  const agentAct = acts.find((a) => a.type === 'agent' && a.key === main?.key)
  const missing = missingOf(main)
  const change = row ? fromDiff(row, missing) : null
  const kbs = state?.status?.knowledgeBases || []
  const ing = ingestTotals(state)
  const sources = state?.sources || []
  const willHave = (kb: string) => !!kbs.find((k) => k.key === kb)?.id || createdKeys.includes(`kb:${kb}`)
  const importable = sources.filter((s) => willHave(s.target))
  const statusRow = (state?.status?.agents || []).find((x) => x.key === (main?.key || CONFIG.mainAgent))

  const applyBlock = first(
    roleBlock(state),
    block(busy['agent-plan'] || (needsAction && !plan && !planErr), tr('Calcul des changements…', 'Computing the changes…'), tr('L’aperçu se calcule tout seul (quelques secondes) ; rien n’est modifié avant votre confirmation.', 'The preview computes itself (a few seconds); nothing changes before you confirm.')),
    block(planErr && !plan, tr('L’aperçu a échoué', 'The preview failed'), `${errorText(planErr?.code, planErr?.message)} ${tr('Cliquez sur « Recalculer l’aperçu » dans les détails techniques.', 'Click « Recalculate the preview » in the technical details.')}`),
    block(stale, tr('L’aperçu n’est plus à jour', 'The preview is out of date'), tr('Une autre modification a eu lieu depuis : cliquez sur « Recalculer ».', 'Another change happened since: click « Recalculate ».'))
  )

  const apply = async (force = false) => {
    setConfirm(null)
    const doImport = withImport && importable.length > 0
    const ans = await run<SyncResult>(
      'agent-apply',
      force ? tr('Remplacement par la version du workspace', 'Replacement with the workspace version') : tr('Synchronisation', 'Sync'),
      'syncAll',
      { skipIngest: !doImport, ...(force ? { force: true } : {}) },
      (s: ConsoleState) => !syncRunning(s)
    )
    if (ans) {
      setResult({ ok: ans.ok, code: ans.error || undefined, message: ans.message || undefined, at: new Date().toISOString(), created: (ans.result?.actions || []).filter((a) => a.action === 'created').length, imported: doImport })
      memo.drop(PLAN_KEY)
      setPlan(null)
      setPlanAt(null)
      void refresh({ withAgents: true })
      void diff.load()
    }
  }

  const takeSnapshot = async () => {
    const ans = await run<{ file?: { name?: string; url?: string } }>('snapshot', tr('Rapport technique', 'Technical report'), 'describeInstance', { includeInstructions: true, upload: true })
    if (ans?.ok) setSnapshot(ans.result.file || null)
  }

  const lastSync = state?.journal?.find((j) => j.data.action === 'syncAll' && !j.data.args?.dryRun)
  const optional = (state?.agents || []).filter((a) => a.optional)
  const sev = change ? overall(change) : 'safe'
  const contentView = viewOn('sources') ? 'sources' : viewOn('ingestion') ? 'ingestion' : null

  // What the agent cannot do yet: bases missing or empty, reference documents not published.
  const limits: { text: string; view?: 'sources' | 'ingestion'; why?: string }[] = []
  for (const k of kbs) {
    const fed = sources.some((s) => s.target === k.key)
    if (!k.id && kbExternal(k.key)) limits.push({ text: tr(`${cap(kbCan(k.key))} : ${kbName(k.key)} n’existe pas sur cet environnement et est alimentée hors de la console.`, `${cap(kbCan(k.key))}: ${kbName(k.key)} does not exist on this environment and is filled outside the console.`) })
    else if (!k.id) limits.push({ text: tr(`${cap(kbCan(k.key))} : ${kbName(k.key)} sera créée par la synchronisation complète, puis remplie.`, `${cap(kbCan(k.key))}: ${kbName(k.key)} is created by the full sync, then filled.`) })
    else if (!(k.document_counts?.completed || 0)) limits.push({ text: tr(`${cap(kbCan(k.key))} : ${kbName(k.key)} est encore vide.`, `${cap(kbCan(k.key))}: ${kbName(k.key)} is still empty.`), view: fed && contentView ? contentView : viewOn('ingestion') ? 'ingestion' : undefined })
  }
  for (const d of state?.status?.documents || []) {
    if (!d.uploadedAt) limits.push({ text: tr(`S’appuyer sur « ${docLabel(d.key)} » : rien n’est encore publié (il fonctionne sans).`, `Rely on « ${docLabel(d.key)} »: nothing is published yet (it works without).`), why: docEmptyHint(d.key) })
  }

  const groupWord = (g: Group) => GROUPS[g]().toLowerCase()

  return (
    <div className="flex flex-col gap-6" data-testid="view-agent">
      <PageHeader
        eyebrow={lb(CONFIG.nav.groups.agent)}
        title={st.agent}
        sub={statusRow?.published ? tr(`Version en service du ${dateTime(statusRow.publishedAt)}${statusRow.model ? ` · ${statusRow.model}` : ''}`, `Version in service from ${dateTime(statusRow.publishedAt)}${statusRow.model ? ` · ${statusRow.model}` : ''}`) : tr('Pas encore publié', 'Not published yet')}
      />

      {/* A. State card: one title, one explanation, one action. */}
      <section className={cn('flex flex-col gap-4 rounded-xl border border-l-4 border-border bg-card p-5 shadow-sm', toneBorder[result ? (result.ok ? 'ok' : 'bad') : st.tone])} data-testid="agent-state">
        {result ? (
          <div className="flex flex-col gap-3" data-testid="agent-result">
            <h3 className="text-lg font-semibold">{result.ok ? tr(`${st.agent} est à jour`, `${st.agent} is up to date`) : tr('La synchronisation ne s’est pas terminée', 'The sync did not finish')}</h3>
            <p className="text-sm text-muted-foreground">
              {result.ok ? tr(`Synchronisé ${ago(result.at)}.`, `Synced ${ago(result.at)}.`) : errorText(result.code, result.message)}
              {result.ok && result.created ? ` ${tr(`${result.created} élément(s) créé(s).`, `${result.created} item(s) created.`)}` : ''}
              {result.ok && result.imported ? ` ${tr('L’import des sources a démarré.', 'The import of the sources started.')}` : ''}
            </p>
            {!result.ok && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer hover:text-foreground">{tr('Détails techniques', 'Technical details')}</summary>
                <code className="mt-1 block break-all font-mono">{errorTechnical(result.code, result.message)}</code>
              </details>
            )}
            <div className="flex flex-wrap gap-2">
              {viewOn('bench') && (
                <Btn variant="primary" onClick={() => go('bench')} testId="agent-next-bench">
                  {tr('Lancer un banc de test', 'Run a benchmark')}
                </Btn>
              )}
              {result.imported && viewOn('ingestion') && (
                <Btn onClick={() => go('ingestion')} testId="agent-next-import">
                  {tr('Suivre l’import', 'Follow the import')}
                </Btn>
              )}
              <Btn variant="ghost" onClick={() => setResult(null)} testId="agent-result-close">
                {tr('Fermer', 'Close')}
              </Btn>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <h3 className="text-lg font-semibold" data-testid="agent-state-title">
                {st.title}
              </h3>
              <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{st.explain}</p>
              {change && sev !== 'safe' && (st.kind === 'update' || st.kind === 'install') && (
                <p className={cn('text-sm', SEVERITY[sev].cls)} data-testid="agent-state-severity">
                  {SEVERITY[sev].label()} :{' '}
                  {change.items
                    .filter((i) => i.sev !== 'safe' && !i.waiting)
                    .map((i) => i.text.replace(/\.$/, ''))
                    .join(' · ')}
                </p>
              )}
            </div>

            {(st.kind === 'loading' || st.kind === 'running') && (
              <span className="inline-flex items-center gap-2 text-sm text-muted-foreground" data-testid="agent-waiting">
                <Spinner /> {st.kind === 'running' ? tr('La page se met à jour toute seule.', 'The page updates by itself.') : tr('Lecture de l’agent dans Agent Factory…', 'Reading the agent in Agent Factory…')}
              </span>
            )}
            {st.kind === 'error' && (
              <div>
                <Btn onClick={() => void refresh({ withAgents: true })} testId="agent-retry">
                  {st.action}
                </Btn>
              </div>
            )}
            {st.kind === 'ok' && viewOn('bench') && (
              <div className="flex flex-wrap gap-2">
                <Btn onClick={() => go('bench')} testId="agent-bench">
                  {tr('Lancer un banc de test', 'Run a benchmark')}
                </Btn>
              </div>
            )}

            {needsAction && (
              <div className="flex flex-col gap-3 border-t border-border pt-4">
                {(busy['agent-plan'] || (!plan && !planErr)) && (
                  <span className="inline-flex items-center gap-2 text-sm text-muted-foreground" data-testid="agent-plan-loading">
                    <Spinner /> {tr('Calcul des changements… (rien n’est modifié)', 'Computing the changes… (nothing changes)')}
                  </span>
                )}
                {plan && (
                  <div className="flex flex-col gap-1.5 text-sm" data-testid="agent-plan">
                    {created.length > 0 && (
                      <span>
                        <span className="font-medium">{tr('Créé d’abord : ', 'Created first: ')}</span>
                        {created.map((a) => kbName(a.key)).join(', ')}
                      </span>
                    )}
                    {agentAct && (
                      <span>
                        <span className="font-medium">{created.length ? tr('Puis : ', 'Then: ') : tr('Prévu : ', 'Planned: ')}</span>
                        {agentAct.action === 'would-create' ? tr(`création ${frDe(st.agent)}.`, `creation of ${st.agent}.`) : agentAct.action === 'failed' ? tr(`${st.agent} : ${errorText(agentAct.error)}`, `${st.agent}: ${errorText(agentAct.error)}`) : tr(`mise à jour ${frDe(st.agent)} (changements ci-dessous).`, `update of ${st.agent} (changes below).`)}
                      </span>
                    )}
                    {agentAct?.missing?.filter((m) => !createdKeys.includes(m)).length ? (
                      <Banner tone="warn">
                        {tr('Il manquera encore : ', 'Still missing afterwards: ')}
                        {agentAct.missing.filter((m) => !createdKeys.includes(m)).map(resourceWords).join(', ')}
                      </Banner>
                    ) : null}
                    {noteLines.map((a) => {
                      const l = otherLine(a)
                      return (
                        <span key={`${a.type}-${a.key}`} className="text-muted-foreground">
                          {l.text}
                          {l.why ? ` — ${l.why.charAt(0).toLowerCase()}${l.why.slice(1)}` : ''}
                        </span>
                      )
                    })}
                  </div>
                )}
                {plan && st.kind !== 'drift' && importable.length > 0 && (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={withImport} onChange={(e) => setWithImport(e.target.checked)} data-testid="agent-with-import" />
                    {tr(`Lancer ensuite l’import des sources (${num(importable.length)} déclarée(s), ${num(ing.ingested)} document(s) déjà importé(s) : peut prendre du temps)`, `Then start the import of the sources (${num(importable.length)} declared, ${num(ing.ingested)} document(s) already imported: may take time)`)}
                  </label>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {st.kind === 'drift' ? (
                    <Btn variant="dangerGhost" onClick={() => setConfirm('force1')} blocked={first(roleBlock(state), adminBlock(state), block(!plan, tr('Calcul des changements…', 'Computing the changes…'), tr('L’aperçu se calcule tout seul.', 'The preview computes itself.')))} busy={busy['agent-apply']} testId="agent-force">
                      {st.action}
                    </Btn>
                  ) : (
                    <Btn variant="primary" onClick={() => setConfirm('apply')} blocked={applyBlock} busy={busy['agent-apply']} testId="agent-apply">
                      {st.action}
                    </Btn>
                  )}
                  {stale && (
                    <Btn variant="ghost" onClick={() => void loadPlan()} busy={busy['agent-plan']} testId="agent-replan">
                      {tr('Recalculer', 'Recalculate')}
                    </Btn>
                  )}
                  {!stale && plan && <span className="text-xs text-muted-foreground">{tr('Rien n’est modifié avant votre confirmation.', 'Nothing changes before you confirm.')}</span>}
                </div>
                {planErr && plan && <Banner tone="warn">{errorText(planErr.code, planErr.message)}</Banner>}
              </div>
            )}
          </>
        )}
      </section>

      {/* B. What users will notice. */}
      {needsAction && !result && (
        <Panel title={st.kind === 'drift' ? tr('Ce qui serait remplacé', 'What would be replaced') : tr('Ce que les utilisateurs remarqueront', 'What users will notice')} testId="agent-effects">
          {diff.loading && !change ? (
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner /> {tr('Comparaison avec l’agent en service…', 'Comparing with the agent in service…')}
            </span>
          ) : st.kind === 'install' && (!row?.diff || main?.wouldDo === 'create') ? (
            <p className="text-sm text-muted-foreground">{tr(`Les utilisateurs découvriront ${st.agent} dès la fin de la synchronisation, avec la configuration du workspace.`, `Users discover ${st.agent} as soon as the sync ends, with the workspace configuration.`)}</p>
          ) : change ? (
            <UserEffects change={change} dropWaiting testId="agent-effects-list" />
          ) : (
            <p className="text-sm text-muted-foreground">{tr('Comparaison indisponible.', 'Comparison unavailable.')}</p>
          )}
        </Panel>
      )}

      {/* C. What the agent cannot do yet. */}
      {limits.length > 0 && (
        <Panel title={tr(`Ce ${frDe(st.agent, 'que')} ne pourra pas encore faire`, `What ${st.agent} cannot do yet`)} testId="agent-limits">
          <ul className="flex flex-col gap-2 text-sm">
            {limits.map((l, i) => (
              <li key={i} className="flex items-baseline gap-2">
                <span className="shrink-0 text-muted-foreground">—</span>
                <span className="flex min-w-0 flex-col">
                  <span>
                    {l.text}{' '}
                    {l.view && (
                      <button type="button" className="whitespace-nowrap text-primary hover:underline" onClick={() => go(l.view!)} data-testid={`agent-limit-link-${i}`}>
                        {viewLabel(l.view)} →
                      </button>
                    )}
                  </span>
                  {l.why && <span className="text-xs text-muted-foreground">{l.why}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* D. Last sync, one technical fold, the other agents. */}
      <div className="flex flex-col gap-3 text-sm">
        {lastSync && (
          <p className="text-muted-foreground" data-testid="agent-last-sync">
            {tr('Dernière synchronisation : ', 'Last sync: ')}
            {ago(lastSync.data.startedAt || lastSync.updatedAt)} {tr('par', 'by')} {lastSync.data.by?.email || '—'} · <Dot tone={journalTone(lastSync.status)}>{journalStatusText(lastSync.status)}</Dot> ·{' '}
            <button type="button" className="text-primary hover:underline" onClick={() => go('journal')} data-testid="agent-history">
              {viewLabel('journal')}
            </button>
          </p>
        )}
        <details data-testid="agent-technical">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">{tr('Détails techniques', 'Technical details')}</summary>
          <div className="mt-3 flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
            {row && <AgentTechnical a={row} />}
            {agentAct && <TechnicalPlan a={agentAct} />}
            {inPlace.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="font-medium">{tr('Déjà en place', 'Already in place')}</span>
                {inPlace.map((a) => (
                  <span key={`${a.type}-${a.key}`} className="text-muted-foreground">
                    {otherLine(a).text}
                  </span>
                ))}
              </div>
            )}
            {plan?.warnings?.length ? (
              <div className="flex flex-col gap-1">
                <span className="font-medium">{tr('Avertissements techniques', 'Technical warnings')}</span>
                {plan.warnings.map((w, i) => (
                  <code key={i} className="block break-words font-mono text-xs text-muted-foreground">
                    {w}
                  </code>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Btn small onClick={() => void takeSnapshot()} blocked={roleBlock(state)} busy={busy.snapshot} testId="agent-snapshot">
                {tr('Exporter un rapport (JSON) pour l’équipe technique', 'Export a report (JSON) for the technical team')}
              </Btn>
              {snapshot?.url && (
                <a href={snapshot.url} target="_blank" rel="noreferrer" className="text-primary underline" data-testid="agent-snapshot-link">
                  {snapshot.name || tr('rapport', 'report')}
                </a>
              )}
              {needsAction && (
                <Btn small variant="ghost" onClick={() => void loadPlan()} busy={busy['agent-plan']} testId="agent-replan-tech">
                  {tr('Recalculer l’aperçu', 'Recalculate the preview')}
                </Btn>
              )}
            </div>
          </div>
        </details>
        {optional.length > 0 && (
          <details data-testid="agent-optional">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">{tr(`Autres agents du workspace (${optional.length}) : non synchronisés par défaut`, `Other workspace agents (${optional.length}): not synced by default`)}</summary>
            <ul className="mt-2 flex flex-col gap-1 pl-4 text-muted-foreground">
              {optional.map((a) => (
                <li key={a.key}>
                  {agentLabel(a.key)}
                  {a.variantOf ? tr(` (variante ${frDe(agentLabel(a.variantOf))})`, ` (variant of ${agentLabel(a.variantOf)})`) : ''}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <Confirm
        open={confirm === 'apply'}
        title={st.kind === 'install' ? tr('Lancer la synchronisation complète ?', 'Run the full sync?') : tr(`Mettre à jour ${st.agent} ?`, `Update ${st.agent}?`)}
        confirmLabel={tr('Synchroniser', 'Sync')}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void apply(false)}
        testId="confirm-sync"
      >
        <p>
          {created.length ? tr(`${created.length} base(s) sont créées, puis `, `${created.length} base(s) are created, then `) : ''}
          {agentAct?.action === 'would-create' ? tr(`${st.agent} est créé`, `${st.agent} is created`) : tr(`${st.agent} est mis à jour`, `${st.agent} is updated`)}
          {change?.items.length
            ? ` (${change.items
                .map((i) => i.group)
                .filter((g, i, xs) => xs.indexOf(g) === i)
                .map(groupWord)
                .join(', ')})`
            : ''}
          . {tr('Ses utilisateurs verront la nouvelle version dès la fin.', 'Its users see the new version as soon as it ends.')}
          {withImport && importable.length > 0 ? ` ${tr('L’import des sources démarre ensuite et se poursuit en arrière-plan.', 'The import of the sources starts afterwards and goes on in the background.')}` : ''}
        </p>
      </Confirm>
      <Confirm open={confirm === 'force1'} title={tr('Remplacer la configuration actuelle de l’agent ?', 'Replace the current agent configuration?')} confirmLabel={tr('Continuer', 'Continue')} danger onCancel={() => setConfirm(null)} onConfirm={() => setConfirm('force2')} testId="confirm-force-1">
        {tr(`Les changements faits à la main dans Agent Factory sur ${st.agent} seront perdus.`, `The changes made by hand in Agent Factory on ${st.agent} will be lost.`)}
      </Confirm>
      <Confirm open={confirm === 'force2'} title={tr('Confirmer une seconde fois', 'Confirm once more')} confirmLabel={tr('Remplacer', 'Replace')} danger busy={busy['agent-apply']} onCancel={() => setConfirm(null)} onConfirm={() => void apply(true)} testId="confirm-force-2">
        {tr(`${st.agent} reprend la configuration du workspace. Cette action est journalisée.`, `${st.agent} gets the workspace configuration back. This action is journaled.`)}
      </Confirm>
    </div>
  )
}
