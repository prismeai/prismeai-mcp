import { useState } from 'react'
import { CONFIG } from '@/console.config'
import { docCountsText, SETTING_LABELS, show, useDiffPart } from '@/components/diffParts'
import { IconAlert, IconDoc, IconInbox, IconRefresh, IconX } from '@/components/icons'
import { journalRunning, useConsole } from '@/lib/console'
import { adminBlock, block, first, roleBlock } from '@/lib/blockers'
import { dateTime, lb, num, tr } from '@/lib/i18n'
import { itemsWord, kbExternal, kbLabel, kbName, sourceLabel } from '@/lib/labels'
import { type Go, viewLabel, viewOn } from '@/lib/nav'
import { controlLabel, ingestTotals } from '@/lib/status'
import type { ConsoleSource, ConsoleState, FailedItem, KbAnswer } from '@/lib/types'
import { Banner, Btn, Confirm, Dot, Empty, PageHeader, Panel, Stat, StatStrip, Table, Td } from '@/components/kit'

/* The import queue (statusReport.ingest, §5.2): knowledge bases with their
 * document counts, the queue, the failed items with a retry, a pass per source,
 * and suspend / resume / stop (controlIngest; stop is admin-only, two confirms). */

const lastRefreshText = (r: NonNullable<ConsoleState['status']['sources']>[number]['lastRefresh'], key: string) => {
  if (!r) return tr('Aucun passage enregistré sur cet environnement.', 'No pass recorded on this environment.')
  const failed = Array.isArray(r.failed) ? r.failed.length : r.failed || 0
  return tr(
    `${dateTime(r.finishedAt || r.startedAt)} · ${itemsWord(key, r.discovered || 0)} trouvé(e)s · ${num(r.queued || 0)} mis en file · ${num(r.skipped || 0)} déjà présents${r.removed ? ` · ${num(r.removed)} retirés de la liste` : ''}${failed ? ` · ${num(failed)} introuvables` : ''}`,
    `${dateTime(r.finishedAt || r.startedAt)} · ${itemsWord(key, r.discovered || 0)} found · ${num(r.queued || 0)} queued · ${num(r.skipped || 0)} already there${r.removed ? ` · ${num(r.removed)} no longer listed` : ''}${failed ? ` · ${num(failed)} not found` : ''}`
  )
}

export default function Ingestion({ go }: { go: Go }) {
  const kbDiff = useDiffPart<KbAnswer>('kbs', {}, false)
  const { state, run, busy } = useConsole()
  const [confirm, setConfirm] = useState<'stop' | 'stop2' | null>(null)
  const [pass, setPass] = useState<ConsoleSource | null>(null)
  if (!state) return null
  const ing = state.status?.ingest || {}
  const tot = ingestTotals(state)
  const ctl = controlLabel(ing.control?.action)
  const kbs = state.status?.knowledgeBases || []
  const failed = ing.failed || []
  const running = !ing.control?.action || ing.control.action === 'run'
  const refreshing = (key: string) => (s: ConsoleState | null) => journalRunning(s, 'refreshSource', (a) => a.source === key && !a.dryRun)

  const control = (action: 'suspend' | 'resume' | 'stop') => run(`ctl-${action}`, action === 'suspend' ? tr('Pause de l’import', 'Import pause') : action === 'resume' ? tr('Reprise de l’import', 'Import resume') : tr('Arrêt de l’import', 'Import stop'), 'controlIngest', { action, reason: 'console' })

  const requeue = (source: string, items: FailedItem[], key: string) => run(key, tr('Nouvel essai', 'Retry'), 'refreshSource', { source, requeue: items.map((f) => f.id) }, (s) => !refreshing(source)(s))

  const bySource = failed.reduce<Record<string, FailedItem[]>>((acc, f) => ((acc[f.source] ||= []).push(f), acc), {})

  return (
    <div className="flex flex-col gap-8" data-testid="view-ingestion">
      <PageHeader
        eyebrow={lb(CONFIG.nav.groups.content)}
        title={viewLabel('ingestion')}
        sub={
          <span className="inline-flex flex-wrap items-center gap-x-2">
            <Dot tone={ctl.tone}>
              <span data-testid="ingest-control">{tr(`Import ${ctl.label.toLowerCase()}`, `Import ${ctl.label.toLowerCase()}`)}</span>
            </Dot>
            {ing.control?.action && ing.control.action !== 'run' && (
              <span>
                {ing.control.by ? tr(`par ${ing.control.by}`, `by ${ing.control.by}`) : ''} {ing.control.at ? dateTime(ing.control.at) : ''}
              </span>
            )}
          </span>
        }
        actions={
          running ? (
            <Btn small onClick={() => void control('suspend')} blocked={roleBlock(state)} busy={busy['ctl-suspend']} testId="ingest-pause">
              {tr('Mettre en pause', 'Pause')}
            </Btn>
          ) : (
            <Btn small variant="primary" onClick={() => void control('resume')} blocked={roleBlock(state)} busy={busy['ctl-resume']} testId="ingest-resume">
              {tr('Reprendre', 'Resume')}
            </Btn>
          )
        }
      />

      <Panel
        title={tr('Bases de connaissance', 'Knowledge bases')}
        actions={
          <Btn small variant="ghost" onClick={() => void kbDiff.load()} busy={kbDiff.loading} testId="kbs-check-settings">
            {tr('Vérifier les réglages', 'Check the settings')}
          </Btn>
        }
        testId="kbs-panel"
      >
        {kbs.length ? (
          <div className="flex flex-col divide-y divide-border text-sm">
            {kbs.map((k) => {
              const settings = kbDiff.data?.kbs?.find((x) => x.key === k.key)?.settings
              const mismatches = (settings?.fields || []).filter((f) => !f.same)
              return (
                <div key={k.key} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0" data-testid={`kb-${k.key}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="font-medium">{kbLabel(k.key)}</span>
                    {k.id ? (
                      <span className="text-muted-foreground">{docCountsText(k.document_counts)}</span>
                    ) : kbExternal(k.key) ? (
                      <span className="text-muted-foreground">{tr('absente de cet environnement · alimentée hors de la console', 'not on this environment · filled outside the console')}</span>
                    ) : (
                      <button type="button" className="text-primary hover:underline" onClick={() => go('agent')} data-testid={`kb-create-${k.key}`}>
                        {tr('Créée par la synchronisation complète (page Agent) →', 'Created by the full sync (Agent page) →')}
                      </button>
                    )}
                  </div>
                  {mismatches.length > 0 && (
                    <span className="text-xs text-amber-700 dark:text-amber-400">
                      {tr('À vérifier : ', 'To check: ')}
                      {mismatches.map((f) => `${SETTING_LABELS[f.field]?.() ?? f.field} (${tr('prévu', 'expected')} ${show(f.manifest)}, ${tr('actuel', 'current')} ${show(f.live)})`).join(' · ')}
                      {tr(' — posés à la création seulement, une synchronisation ne les corrige pas.', ' — set at creation only, a sync does not fix them.')}
                    </span>
                  )}
                  {settings && !mismatches.length && <span className="text-xs text-muted-foreground">{tr('Réglages conformes au workspace.', 'Settings match the workspace.')}</span>}
                </div>
              )
            })}
          </div>
        ) : (
          <Empty>{tr('Aucune base déclarée dans ce workspace.', 'No base declared in this workspace.')}</Empty>
        )}
      </Panel>

      <div className="flex flex-col gap-3">
        <StatStrip cols={5}>
          <Stat label={tr('En file', 'Queued')} value={num(tot.queued)} testId="stat-queued" icon={<IconInbox />} />
          <Stat label={tr('En cours', 'In flight')} value={num(tot.inFlight)} testId="stat-inflight" icon={<IconRefresh />} />
          <Stat label={tr('Importés', 'Imported')} value={num(tot.ingested)} tone="ok" testId="stat-ingested" icon={<IconDoc />} />
          <Stat label={tr('Échecs', 'Failed')} value={num(tot.errors)} tone={tot.errors ? 'bad' : 'muted'} testId="stat-error" icon={<IconAlert />} />
          <Stat label={tr('Annulés', 'Cancelled')} value={num(tot.cancelled)} tone="muted" testId="stat-cancelled" icon={<IconX />} />
        </StatStrip>
        {tot.total > 0 && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-label={tr('Progression', 'Progress')}>
            <div className="h-full bg-emerald-500" style={{ width: `${Math.round((tot.ingested / tot.total) * 100)}%` }} />
          </div>
        )}
        {!running && tot.queued > 0 && <Banner tone="warn">{tr(`${num(tot.queued)} document(s) attendent : l’import reprendra après « Reprendre ».`, `${num(tot.queued)} document(s) wait: the import goes on after « Resume ».`)}</Banner>}
      </div>

      <Panel title={tr('Passages sur les sources', 'Passes on the sources')} testId="sources-passes">
        {state.sources.length ? (
          <div className="flex flex-col divide-y divide-border">
            {state.sources.map((s) => {
              const r = state.status?.sources?.find((x) => x.key === s.key)?.lastRefresh || null
              const kb = kbs.find((k) => k.key === s.target)
              const isRunning = refreshing(s.key)(state)
              return (
                <div key={s.key} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0 text-sm" data-testid={`source-${s.key}`}>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-medium">
                      {sourceLabel(s.key, s.label)} <span className="font-normal text-muted-foreground">→ {kbName(s.target)}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{isRunning ? tr('Passage en cours…', 'Pass running…') : lastRefreshText(r, s.key)}</span>
                  </div>
                  <Btn
                    small
                    onClick={() => setPass(s)}
                    blocked={first(
                      roleBlock(state),
                      block(!kb?.id, tr('La base n’existe pas encore', 'The base does not exist yet'), tr('Lancez d’abord la synchronisation complète depuis la page Agent : elle crée la base.', 'First run the full sync from the Agent page: it creates the base.')),
                      block(isRunning, tr('Un passage est déjà en cours', 'A pass is already running'), tr('Il se termine seul ; la page se met à jour automatiquement.', 'It finishes by itself; the page updates automatically.'))
                    )}
                    busy={busy[`pass-${s.key}`]}
                    testId={`ingest-pass-${s.key}`}
                  >
                    {tr('Lancer un passage', 'Run a pass')}
                  </Btn>
                </div>
              )
            })}
          </div>
        ) : (
          <Empty>{tr('Aucune source déclarée : les bases sont remplies hors de la console.', 'No source declared: the bases are filled outside the console.')}</Empty>
        )}
      </Panel>

      <Panel title={tr(`Échecs (${failed.length})`, `Failures (${failed.length})`)} testId="ingest-failures-panel">
        {failed.length ? (
          <div className="flex flex-col gap-4">
            {Object.entries(bySource).map(([source, items]) => (
              <div key={source} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">{sourceLabel(source)}</span>
                  {items.length > 1 && (
                    <Btn small onClick={() => void requeue(source, items, `requeue-all-${source}`)} blocked={roleBlock(state)} busy={busy[`requeue-all-${source}`]} testId={`ingest-requeue-all-${source}`}>
                      {tr('Tout réessayer', 'Retry all')}
                    </Btn>
                  )}
                </div>
                <Table head={[tr('Document', 'Document'), tr('Cause', 'Cause'), tr('Essais', 'Attempts'), '']} testId={`ingest-failures-${source}`}>
                  {items.map((f) => (
                    <tr key={f.id}>
                      <Td className="max-w-xs break-all">{f.name || f.url || f.id}</Td>
                      <Td className="text-xs">{f.error?.message || '—'}{f.error?.stage ? <span className="text-muted-foreground"> · {f.error.stage}</span> : null}</Td>
                      <Td>{num(f.attempts)}</Td>
                      <Td className="text-right">
                        <Btn small variant="ghost" onClick={() => void requeue(source, [f], `requeue-${f.id}`)} blocked={roleBlock(state)} busy={busy[`requeue-${f.id}`]} testId={`requeue-${f.id}`}>
                          {tr('Réessayer', 'Retry')}
                        </Btn>
                      </Td>
                    </tr>
                  ))}
                </Table>
              </div>
            ))}
          </div>
        ) : (
          <Empty>{tr('Aucun échec.', 'No failure.')}</Empty>
        )}
      </Panel>

      <div className="flex flex-wrap items-center gap-3">
        <Btn
          small
          variant="dangerGhost"
          onClick={() => setConfirm('stop')}
          blocked={first(roleBlock(state), adminBlock(state), block(ing.control?.action === 'stop', tr('L’import est déjà arrêté', 'The import is already stopped'), tr('Utilisez « Reprendre » en haut de la page pour le relancer.', 'Use « Resume » at the top of the page to restart it.')))}
          busy={busy['ctl-stop']}
          testId="ingest-stop"
        >
          {tr('Tout arrêter…', 'Stop everything…')}
        </Btn>
        {viewOn('sources') && (
          <button type="button" className="text-sm text-primary hover:underline" onClick={() => go('sources')} data-testid="ingest-to-sources">
            {tr('Ajouter ou retirer des adresses', 'Add or remove addresses')} →
          </button>
        )}
      </div>

      <Confirm
        open={!!pass}
        title={tr('Lancer un passage ?', 'Run a pass?')}
        confirmLabel={tr('Lancer', 'Run')}
        onCancel={() => setPass(null)}
        onConfirm={() => {
          const s = pass!
          setPass(null)
          void run(`pass-${s.key}`, tr('Passage sur la source', 'Source pass'), 'refreshSource', { source: s.key }, (st) => !refreshing(s.key)(st))
        }}
        testId="confirm-pass"
      >
        {pass && tr(`Le workspace relit « ${sourceLabel(pass.key, pass.label)} », met en file les documents nouveaux et réessaie ceux en échec ; les documents déjà importés sont ignorés. La console suit le passage.`, `The workspace reads « ${sourceLabel(pass.key, pass.label)} » again, queues the new documents and retries the failed ones; documents already imported are skipped. The console follows the pass.`)}
      </Confirm>
      <Confirm open={confirm === 'stop'} title={tr('Tout arrêter ?', 'Stop everything?')} confirmLabel={tr('Continuer', 'Continue')} danger onCancel={() => setConfirm(null)} onConfirm={() => setConfirm('stop2')} testId="confirm-stop-1">
        {tr('Les documents en file sont annulés ; il faudra relancer un passage pour les remettre en file.', 'Queued documents are cancelled; a new pass is needed to queue them again.')}
      </Confirm>
      <Confirm
        open={confirm === 'stop2'}
        title={tr('Confirmer l’arrêt', 'Confirm the stop')}
        confirmLabel={tr('Tout arrêter', 'Stop all')}
        danger
        busy={busy['ctl-stop']}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null)
          void control('stop')
        }}
        testId="confirm-stop-2"
      >
        {tr(`${num(tot.queued)} document(s) en file seront annulés. L’import reste arrêté jusqu’à une reprise.`, `${num(tot.queued)} queued document(s) will be cancelled. The import stays stopped until resumed.`)}
      </Confirm>
    </div>
  )
}
