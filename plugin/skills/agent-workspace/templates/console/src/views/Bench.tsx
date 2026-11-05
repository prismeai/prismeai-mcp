import { useEffect, useState } from 'react'
import { CONFIG } from '@/console.config'
import { useConsole } from '@/lib/console'
import { block, first, roleBlock } from '@/lib/blockers'
import { ago, dateTime, lb, num, plural, tr } from '@/lib/i18n'
import { agentLabel } from '@/lib/labels'
import { type Go, viewLabel } from '@/lib/nav'
import { benchStatusLabel, mainAgent } from '@/lib/status'
import type { BenchReport, Dict } from '@/lib/types'
import { Banner, Btn, Confirm, Dot, Empty, Field, Help, inputClass, PageHeader, Panel, Stat, StatStrip, Table, Td } from '@/components/kit'

/* Benchmarks (§5.1): load the cases, run a bench on the evaluated agents, follow
 * it (the console advances it every minute while open; otherwise the platform schedule, at most every 15 min),
 * pause / resume / stop it, read the scores per agent and export the answers. */

export default function Bench({ go }: { go: Go }) {
  const { state, run, busy } = useConsole()
  const [report, setReport] = useState<BenchReport | null>(null)
  const sizes = CONFIG.bench.sizes.length ? CONFIG.bench.sizes : [0]
  const [size, setSize] = useState<number>(sizes[0])
  const [tag, setTag] = useState('')
  const [confirm, setConfirm] = useState<'run' | 'stop' | null>(null)
  const [file, setFile] = useState<{ name?: string; url?: string } | null>(null)
  const bench = state?.status?.benchmark
  const lbl = benchStatusLabel(bench?.status)
  const running = bench?.status === 'running'
  // pause and stop both leave the bench « interrupted » until it is resumed (§5.1).
  const resumable = bench?.status === 'interrupted'
  const benchId = bench?.benchId || bench?.key?.replace(/^bench:/, '')

  const loadReport = async () => {
    const ans = await run<BenchReport>('bench-report', tr('Rapport du banc', 'Benchmark report'), 'benchmarkReport', benchId ? { benchId } : {})
    if (ans?.ok) setReport(ans.result)
  }

  useEffect(() => {
    if (bench) void loadReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bench?.updatedAt, bench?.status])

  if (!state) return null
  const cases = state.status?.cases?.count || 0
  const main = mainAgent(state)

  const start = async () => {
    setConfirm(null)
    const args: Dict = {}
    if (size > 0) args.limit = size
    if (tag) args.tags = [tag]
    await run('bench-run', tr('Lancement du banc', 'Benchmark start'), 'runBenchmark', args)
  }

  const doExport = async () => {
    const ans = await run<{ file?: { name?: string; url?: string } }>('bench-export', tr('Export du banc', 'Benchmark export'), 'exportBenchmark', benchId ? { benchId } : {})
    if (ans?.ok) setFile(ans.result.file || null)
  }

  const replayErrored = () => run('bench-replay', tr('Nouvel essai des cas en erreur', 'Retry of the errored cases'), 'runBenchmark', { onlyErrored: true, ...(benchId ? { benchId } : {}) })

  /** Why cases could not be played, in plain words (the raw message stays in « Détails techniques »). */
  const runErrorText = (m?: string): string => {
    const s = (m || '').toLowerCase()
    if (s.includes('no user session') || s.includes('org api key') || s.includes('401'))
      return tr('Le service d’évaluation n’a pas pu interroger l’agent : il lui faut une clé d’accès d’organisation pour jouer les cas sans utilisateur connecté. Prévenez l’équipe technique, puis rejouez les cas en erreur.', 'The evaluation service could not query the agent: it needs an organization access key to play cases without a signed-in user. Tell the technical team, then retry the errored cases.')
    if (s.includes('rate') || s.includes('429')) return tr('Le service d’évaluation a été limité en débit : rejouez les cas en erreur un peu plus tard.', 'The evaluation service was rate limited: retry the errored cases a bit later.')
    return tr('L’agent n’a pas pu répondre à ces cas (erreur technique). Rejouez-les ; si cela persiste, prévenez l’équipe technique.', 'The agent could not answer these cases (technical error). Retry them; if it persists, tell the technical team.')
  }

  const control = (action: 'pause' | 'resume' | 'stop') =>
    run(`bench-${action}`, action === 'pause' ? tr('Pause du banc', 'Benchmark pause') : action === 'resume' ? tr('Reprise du banc', 'Benchmark resume') : tr('Arrêt du banc', 'Benchmark stop'), 'controlBenchmark', { action, benchId })

  const agents = Object.entries(report?.agents || bench?.agents || {})
  const t = report?.totals || bench?.totals
  const progress = t?.total ? Math.round(((t.done || 0) + (t.errored || 0)) / t.total * 100) : 0

  return (
    <div className="flex flex-col gap-8" data-testid="view-bench">
      <PageHeader
        eyebrow={lb(CONFIG.nav.groups.agent)}
        title={viewLabel('bench')}
        sub={
          bench ? (
            <span className="inline-flex flex-wrap items-center gap-x-2">
              <Dot tone={lbl.tone}>
                <span data-testid="bench-status">{lbl.label}</span>
              </Dot>
              <span>
                · {tr('démarré', 'started')} {dateTime(bench.startedAt)} · {tr('mis à jour', 'updated')} {ago(bench.updatedAt)}
              </span>
            </span>
          ) : (
            tr('Pose les questions du jeu de cas aux agents évalués et note leurs réponses.', 'Asks the case set questions to the evaluated agents and scores their answers.')
          )
        }
        actions={
          <>
            {running && (
              <>
                <Btn small variant="ghost" onClick={() => void run('bench-advance', tr('Avancement du banc', 'Benchmark tick'), 'advanceBenchmark', {})} blocked={roleBlock(state)} busy={busy['bench-advance']} testId="bench-advance">
                  {tr('Faire avancer', 'Advance')}
                </Btn>
                <Btn small onClick={() => void control('pause')} blocked={roleBlock(state)} busy={busy['bench-pause']} testId="bench-pause">
                  {tr('Mettre en pause', 'Pause')}
                </Btn>
                <Btn small variant="dangerGhost" onClick={() => setConfirm('stop')} blocked={roleBlock(state)} busy={busy['bench-stop']} testId="bench-stop">
                  {tr('Arrêter', 'Stop')}
                </Btn>
              </>
            )}
            {resumable && (
              <Btn small variant="primary" onClick={() => void control('resume')} blocked={roleBlock(state)} busy={busy['bench-resume']} testId="bench-resume">
                {tr('Reprendre', 'Resume')}
              </Btn>
            )}
          </>
        }
      />

      {!cases ? (
        <Panel title={tr('Aucun cas de test chargé', 'No test case loaded')} testId="bench-no-cases">
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-muted-foreground">{tr('Le banc a besoin des questions de référence du workspace (avec la réponse attendue). Chargez-les : rien n’est envoyé aux agents à cette étape.', 'The benchmark needs the reference questions of the workspace (with the expected answer). Load them: nothing is sent to the agents at this step.')}</p>
            <div>
              <Btn variant="primary" onClick={() => void run('bench-import', tr('Chargement des cas', 'Loading the cases'), 'importCases', {})} blocked={roleBlock(state)} busy={busy['bench-import']} testId="bench-import-cases">
                {tr('Charger les cas du workspace', 'Load the workspace cases')}
              </Btn>
            </div>
          </div>
        </Panel>
      ) : (
        <>
          {bench && (
            <Panel
              title={tr('Résultats', 'Results')}
              actions={
                <Btn small variant="ghost" onClick={() => void loadReport()} busy={busy['bench-report']} testId="bench-reload">
                  {tr('Relire', 'Reload')}
                </Btn>
              }
              testId="bench-results"
            >
              <div className="flex flex-col gap-4">
                {t && (
                  <>
                    <StatStrip cols={4}>
                      <Stat label={tr('Questions', 'Questions')} value={num(t.total)} />
                      <Stat label={tr('Réponses acceptées', 'Passed answers')} value={num(t.passed)} tone="ok" />
                      <Stat label={tr('Réponses refusées', 'Failed answers')} value={num(t.failed)} tone={t.failed ? 'warn' : undefined} />
                      <Stat label={tr('Erreurs techniques', 'Technical errors')} value={num(t.errored)} tone={t.errored ? 'bad' : undefined} />
                    </StatStrip>
                    {!running && (t.errored || 0) > 0 && (
                      <div className="flex flex-col gap-2" data-testid="bench-errored">
                        <Banner tone="bad">
                          {tr(`${num(t.errored)} cas n’ont pas pu être joués : ils sont exclus des scores. `, `${num(t.errored)} case(s) could not be played: they are left out of the scores. `)}
                          {runErrorText(bench?.lastRunError?.message)}
                        </Banner>
                        <div className="flex flex-wrap items-center gap-3">
                          <Btn small onClick={() => void replayErrored()} blocked={roleBlock(state)} busy={busy['bench-replay']} testId="bench-replay">
                            {tr('Rejouer les cas en erreur', 'Retry the errored cases')}
                          </Btn>
                          {bench?.lastRunError?.message && (
                            <details className="text-xs text-muted-foreground">
                              <summary className="cursor-pointer hover:text-foreground">{tr('Détails techniques', 'Technical details')}</summary>
                              <code className="mt-1 block break-all font-mono">{bench.lastRunError.message}</code>
                            </details>
                          )}
                        </div>
                      </div>
                    )}
                    {running && (
                      <div className="flex flex-col gap-1">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-label={tr('Progression', 'Progress')}>
                          <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{tr(`${progress} % · le banc avance tout seul en arrière-plan, vous pouvez quitter la page.`, `${progress} % · the benchmark advances by itself in the background, you can leave the page.`)}</span>
                      </div>
                    )}
                  </>
                )}
                {agents.length > 0 && (
                  <Table head={[tr('Agent', 'Agent'), tr('Score', 'Score'), tr('Acceptées', 'Passed'), tr('Erreurs', 'Errors')]} testId="bench-agents">
                    {agents.map(([k, a]) => (
                      <tr key={k} data-testid={`bench-agent-${k}`}>
                        <Td className="whitespace-nowrap font-medium">
                          {agentLabel(k)}
                          {k === main?.key ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">{tr('(en service)', '(in service)')}</span> : null}
                        </Td>
                        <Td className="font-mono">{typeof a.score === 'number' ? a.score.toFixed(1) : '—'}</Td>
                        <Td className="whitespace-nowrap">
                          {typeof a.passRate === 'number' ? `${Math.round(a.passRate * 100)} %` : '—'} · {num(a.completed)} / {num(a.total)}
                        </Td>
                        <Td>{num(a.errored)}</Td>
                      </tr>
                    ))}
                  </Table>
                )}
                {report?.worst?.length ? (
                  <details className="text-sm" data-testid="bench-worst">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">{tr(`Les réponses les moins bien notées (${report.worst.length})`, `The lowest-scored answers (${report.worst.length})`)}</summary>
                    <ul className="mt-2 flex flex-col gap-2">
                      {report.worst.slice(0, 10).map((w, i) => (
                        <li key={i} className="flex flex-col gap-0.5">
                          <span>
                            <span className="font-mono text-xs text-muted-foreground">{w.caseId}</span> · {agentLabel(w.agent)} · {typeof w.score === 'number' ? w.score.toFixed(1) : '—'}
                          </span>
                          {w.reasons && <span className="text-xs text-muted-foreground">{Array.isArray(w.reasons) ? w.reasons.join(' · ') : w.reasons}</span>}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            </Panel>
          )}

          <Panel title={tr('Lancer un banc', 'Run a benchmark')} sub={plural(cases, tr('cas de test chargé', 'test case loaded'), tr('cas de test chargés', 'test cases loaded'))} testId="bench-run-panel">
            <div className="flex flex-wrap items-end gap-3">
              {sizes.length > 1 && (
                <div style={{ width: 200 }}>
                  <Field label={tr('Taille', 'Size')}>
                    <select className={inputClass} value={size} onChange={(e) => setSize(Number(e.target.value))} data-testid="bench-size">
                      {sizes.map((s) => (
                        <option key={s} value={s}>
                          {s > 0 ? tr(`${s} questions`, `${s} questions`) : tr('Jeu complet', 'Full set')}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              )}
              {CONFIG.bench.tags?.length ? (
                <div style={{ width: 220 }}>
                  <Field label={tr('Thème', 'Topic')}>
                    <select className={inputClass} value={tag} onChange={(e) => setTag(e.target.value)} data-testid="bench-tag">
                      <option value="">{tr('Tous', 'All')}</option>
                      {CONFIG.bench.tags.map((x) => (
                        <option key={x.value} value={x.value}>
                          {lb(x.label)}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              ) : null}
              <Btn
                variant="primary"
                onClick={() => setConfirm('run')}
                blocked={first(roleBlock(state), block(running, tr('Un banc est déjà en cours', 'A benchmark is already running'), tr('Attendez qu’il se termine, ou arrêtez-le avec « Arrêter » en haut de la page.', 'Wait for it to finish, or stop it with « Stop » at the top of the page.')))}
                busy={busy['bench-run']}
                testId="bench-run"
              >
                {tr('Lancer', 'Run')}
              </Btn>
            </div>
            <div className="mt-3">
              <Help>{tr('Le banc tourne en arrière-plan sur le workspace, par lots, au rythme autorisé ; « Faire avancer » démarre le lot suivant sans attendre la tâche planifiée. Les conversations du banc comptent dans la consommation de l’organisation.', 'The benchmark runs in the background on the workspace, in batches, at the allowed rate; « Advance » starts the next batch without waiting for the schedule. Benchmark conversations count in the organization usage.')}</Help>
            </div>
          </Panel>

          {bench && (
            <Panel
              title={tr('Export', 'Export')}
              actions={
                <Btn small onClick={() => void doExport()} blocked={roleBlock(state)} busy={busy['bench-export']} testId="bench-export">
                  {tr('Exporter les réponses', 'Export the answers')}
                </Btn>
              }
            >
              {file?.url ? (
                <a href={file.url} target="_blank" rel="noreferrer" className="text-sm text-primary underline" data-testid="bench-export-link">
                  {file.name || tr('export', 'export')}
                </a>
              ) : (
                <Empty>{tr('Un fichier JSONL : une ligne par question et par agent (question, réponse, réponse attendue, note et raisons).', 'A JSONL file: one line per question and agent (question, answer, expected answer, score and reasons).')}</Empty>
              )}
            </Panel>
          )}
        </>
      )}

      <p className="text-sm text-muted-foreground">
        <button type="button" className="text-primary hover:underline" onClick={() => go('agent')} data-testid="bench-to-agent">
          {viewLabel('agent')} →
        </button>
      </p>

      <Confirm open={confirm === 'run'} title={tr('Lancer un banc ?', 'Run a benchmark?')} confirmLabel={tr('Lancer', 'Run')} onCancel={() => setConfirm(null)} onConfirm={() => void start()} testId="confirm-bench-run">
        {tr(`${size > 0 ? `${size} questions` : 'Le jeu complet'}${tag ? ' du thème choisi' : ''}, posées aux agents évalués du workspace. Les conversations comptent dans la consommation de l’organisation ; le banc tourne en arrière-plan.`, `${size > 0 ? `${size} questions` : 'The full set'}${tag ? ' of the chosen topic' : ''}, asked to the evaluated agents of the workspace. Conversations count in the organization usage; the benchmark runs in the background.`)}
        {resumable ? <p className="mt-2 text-muted-foreground">{tr('Le banc interrompu reste consultable mais ne sera plus repris : utilisez « Reprendre » pour le terminer plutôt.', 'The interrupted benchmark stays readable but will not be resumed: use « Resume » to finish it instead.')}</p> : null}
      </Confirm>
      <Confirm
        open={confirm === 'stop'}
        title={tr('Arrêter le banc ?', 'Stop the benchmark?')}
        confirmLabel={tr('Arrêter', 'Stop')}
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null)
          void control('stop')
        }}
        testId="confirm-bench-stop"
      >
        {tr('Aucune nouvelle question n’est posée ; les réponses déjà notées sont gardées dans le rapport.', 'No new question is asked; the answers already scored are kept in the report.')}
      </Confirm>
    </div>
  )
}
