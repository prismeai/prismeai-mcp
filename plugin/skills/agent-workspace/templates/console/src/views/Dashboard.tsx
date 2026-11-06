import type { ReactNode } from 'react'
import { CONFIG } from '@/console.config'
import { useConsole } from '@/lib/console'
import { ago, lb, num, plural, tr } from '@/lib/i18n'
import { agentLabel, journalActionLabel, kbExternal } from '@/lib/labels'
import { type Go, viewLabel, viewOn } from '@/lib/nav'
import { agentState, ingestTotals } from '@/lib/status'
import { Dot, PageHeader, Panel, Tile, type Tone } from '@/components/kit'
import { IconBot, IconGauge, IconLayers } from '@/components/icons'
import { journalTone } from '@/views/Journal'
import { cn } from '@/lib/utils'

/* « Which job needs me? »: one card per area, each with the state headline of the
 * page that fixes it and a link there. No action and no alert list here: every fact
 * has one home (AGENTS.console.md rule 7). */

function Card({ title, icon, tone, state, detail, link, onClick, testId }: { title: string; icon: ReactNode; tone: Tone; state: string; detail?: string; link: string; onClick: () => void; testId: string }) {
  return (
    <button type="button" onClick={onClick} data-testid={testId} className="flex min-w-0 items-start gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40">
      <Tile icon={icon} tone={tone} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</span>
        <span className="text-sm font-semibold leading-snug">{state}</span>
        {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
        <span className="pt-1 text-xs font-medium text-primary">{link} →</span>
      </span>
    </button>
  )
}

export default function Dashboard({ go }: { go: Go }) {
  const { state } = useConsole()
  if (!state) return null
  const st = state.status || {}
  const agent = agentState(state)
  const ing = ingestTotals(state)
  const kbs = (st.knowledgeBases || []).filter((k) => k.id || !kbExternal(k.key))
  const created = kbs.filter((k) => k.id)
  const searchable = created.reduce((n, k) => n + (k.document_counts?.completed || 0), 0)
  const contentView = viewOn('sources') ? 'sources' : 'ingestion'
  const showContent = viewOn('sources') || viewOn('ingestion')

  const content: { tone: Tone; state: string; detail?: string } = !created.length
    ? { tone: 'muted', state: tr('Disponible après la synchronisation de l’agent', 'Available after the agent sync'), detail: kbs.length ? plural(kbs.length, tr('base prévue', 'base planned'), tr('bases prévues', 'bases planned')) : undefined }
    : ing.errors
      ? { tone: 'bad', state: tr(`${num(ing.errors)} document(s) en échec d’import`, `${num(ing.errors)} document(s) failed to import`), detail: tr(`${num(searchable)} documents consultables par l’agent`, `${num(searchable)} documents searchable by the agent`) }
      : ing.pending
        ? { tone: 'info', state: tr(`Import en cours : ${num(ing.ingested)} / ${num(ing.total)}`, `Import running: ${num(ing.ingested)} / ${num(ing.total)}`) }
        : { tone: searchable ? 'ok' : 'warn', state: searchable ? tr(`${num(searchable)} documents consultables par l’agent`, `${num(searchable)} documents searchable by the agent`) : tr('Aucun document importé', 'No document imported'), detail: plural(created.length, tr('base', 'base'), tr('bases', 'bases')) }

  const bench = st.benchmark
  const score = (k: string) => {
    const a = bench?.agents?.[k]
    return typeof a?.score === 'number' ? a.score.toFixed(1) : '—'
  }
  const benchKeys = Object.keys(bench?.agents || {})
  const quality: { tone: Tone; state: string; detail?: string } = !st.cases?.count
    ? { tone: 'muted', state: tr('Aucun cas de test chargé', 'No test case loaded') }
    : !bench
      ? { tone: 'muted', state: tr('Aucun banc lancé', 'No benchmark run'), detail: plural(st.cases.count, tr('cas de test', 'test case'), tr('cas de test', 'test cases')) }
      : bench.status === 'running'
        ? { tone: 'info', state: tr(`Banc en cours : ${num(bench.totals?.done)} / ${num(bench.totals?.total)}`, `Benchmark running: ${num(bench.totals?.done)} / ${num(bench.totals?.total)}`), detail: ago(bench.updatedAt) }
        : { tone: 'info', state: benchKeys.length ? benchKeys.slice(0, 2).map((k) => `${agentLabel(k)} ${score(k)}`).join(' · ') : tr('Banc terminé', 'Benchmark done'), detail: ago(bench.updatedAt) }

  const gitPending = viewOn('sources') && state.sources.some((s) => s.overlay)
  const recent = (state.journal || []).slice(0, 3)
  const cards = 1 + (showContent ? 1 : 0) + (viewOn('bench') ? 1 : 0)

  return (
    <div className="flex flex-col gap-6" data-testid="view-dashboard">
      <PageHeader eyebrow={lb(CONFIG.nav.groups.overview)} title={viewLabel('dashboard')} sub={tr('Ce qui demande votre attention, et où le régler.', 'What needs your attention, and where to fix it.')} />

      <div className={cn('grid grid-cols-1 gap-3', cards >= 3 ? 'md:grid-cols-3' : cards === 2 ? 'md:grid-cols-2' : '')}>
        <Card testId="card-agent" title={tr('Agent', 'Agent')} icon={<IconBot />} tone={agent.tone} state={agent.title} detail={agent.kind === 'ok' ? undefined : agent.action} link={tr('Ouvrir la page Agent', 'Open the Agent page')} onClick={() => go('agent')} />
        {showContent && <Card testId="card-content" title={tr('Contenu', 'Content')} icon={<IconLayers />} tone={content.tone} state={content.state} detail={content.detail} link={viewLabel(contentView)} onClick={() => go(contentView)} />}
        {viewOn('bench') && <Card testId="card-bench" title={tr('Qualité', 'Quality')} icon={<IconGauge />} tone={quality.tone} state={quality.state} detail={quality.detail} link={viewLabel('bench')} onClick={() => go('bench')} />}
      </div>

      {gitPending && (
        <button type="button" onClick={() => go('sources')} className="self-start text-sm text-muted-foreground hover:text-foreground" data-testid="dash-git">
          {tr('Des modifications des sources sont à reporter dans git →', 'Source changes are to be carried into git →')}
        </button>
      )}

      {recent.length > 0 && (
        <Panel
          title={tr('Dernières actions', 'Recent actions')}
          actions={
            <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => go('journal')} data-testid="dash-journal">
              {viewLabel('journal')} →
            </button>
          }
        >
          <ul className="flex flex-col divide-y divide-border text-sm">
            {recent.map((j) => (
              <li key={j.key} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 first:pt-0 last:pb-0">
                <span>{journalActionLabel(j.data.action)}</span>
                <span className="flex items-center gap-3 text-xs text-muted-foreground">
                  {j.data.by?.email}
                  <Dot tone={journalTone(j.status)}>{ago(j.data.startedAt || j.updatedAt)}</Dot>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}
