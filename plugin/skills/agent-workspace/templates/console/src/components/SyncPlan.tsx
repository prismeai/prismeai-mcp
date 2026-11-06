import { errorText, num, tr } from '@/lib/i18n'
import { agentLabel, docEmptyHint, docLabel, kbExternal, kbLabel } from '@/lib/labels'
import type { NamedRef, SyncAction } from '@/lib/types'
import { Banner, Mono, Pill, type Tone } from '@/components/kit'

/* A syncAll result (§4.5) read two ways: the plain line of each non-agent step
 * (bases, documents, other agents) and the raw plan of an agent, which is only
 * ever shown under « Détails techniques ». */

const names = (xs?: (string | NamedRef)[]) => (xs || []).map((x) => (typeof x === 'string' ? x : x?.name || '?')).join(', ')

function actionTone(a: string): Tone {
  if (a === 'drift' || a === 'failed') return 'bad'
  if (a.startsWith('would-')) return 'info'
  if (a === 'updated' || a === 'created' || a === 'uploaded') return 'ok'
  return 'muted'
}

export function actionLabel(a: string): string {
  const m: Record<string, string> = {
    'would-create': tr('sera créé', 'will be created'),
    'would-update': tr('sera mis à jour', 'will be updated'),
    'would-upload': tr('sera publié', 'will be published'),
    drift: tr('modifié à la main : non écrasé', 'edited by hand: not overwritten'),
    failed: tr('échec', 'failed'),
    updated: tr('mis à jour', 'updated'),
    created: tr('créé', 'created'),
    uploaded: tr('publié', 'published'),
    unchanged: tr('inchangé', 'unchanged'),
    exists: tr('existe', 'exists'),
    bound: tr('rattaché', 'bound'),
    unbound: tr('absent', 'absent'),
    skipped: tr('ignoré', 'skipped'),
    optional: tr('optionnel', 'optional'),
  }
  return m[a] || a
}

/** Raw plan of an agent, folded under « Détails techniques ». */
export function TechnicalPlan({ a }: { a: SyncAction }) {
  const p = a.plan
  const ins = p?.instructions
  return (
    <div className="flex flex-col gap-2 text-sm" data-testid={`plan-tech-${a.key}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs">{a.type}:{a.key}</span>
        <Pill tone={actionTone(a.action)}>{actionLabel(a.action)}</Pill>
        {a.forced && <Pill tone="bad">{tr('forcé', 'forced')}</Pill>}
      </div>
      {a.missing?.length ? (
        <Banner tone="warn">
          {tr('Dépendances absentes : ', 'Missing dependencies: ')}
          {a.missing.map((m) => (
            <Mono key={m}>{m}</Mono>
          ))}
        </Banner>
      ) : null}
      {a.drift && (
        <Banner tone="bad">
          drift: {a.drift.reason}
          {a.drift.changes?.length ? ` (${a.drift.changes.join(', ')})` : ''}. {a.drift.summary}
        </Banner>
      )}
      {a.error && <Banner tone="bad"><Mono>{a.error}</Mono></Banner>}
      {p && p.same && <span className="text-muted-foreground">{tr('Aucun changement.', 'No change.')}</span>}
      {p && !p.same && (
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {ins && (
            <li>
              instructions : {num(ins.fromLength)} → {num(ins.toLength)} {tr('caractères', 'characters')} (+{num(ins.addedLines)} / −{num(ins.removedLines)} {tr('lignes', 'lines')})
              {ins.lostSections?.length ? <span className="text-red-600 dark:text-red-400"> · lostSections : {ins.lostSections.join(', ')}</span> : null}
            </li>
          )}
          {p.fields?.map((f) => (
            <li key={f.field}>
              <Mono>{f.field}</Mono> : {JSON.stringify(f.from)} → {JSON.stringify(f.to)}
            </li>
          ))}
          {p.skills && (p.skills.added?.length || p.skills.removed?.length || p.skills.changed?.length) ? (
            <li>
              skills : {p.skills.added?.length ? `+ ${names(p.skills.added)} ` : ''}
              {p.skills.removed?.length ? `− ${names(p.skills.removed)} ` : ''}
              {p.skills.changed?.length ? `~ ${names(p.skills.changed)}` : ''}
            </li>
          ) : null}
          {p.tools && (p.tools.added?.length || p.tools.removed?.length || p.tools.changed?.length || p.tools.replaced?.length) ? (
            <li>
              tools : {p.tools.added?.length ? `+ ${names(p.tools.added)} ` : ''}
              {p.tools.removed?.length ? `− ${names(p.tools.removed)} ` : ''}
              {p.tools.replaced?.length ? `⇄ ${p.tools.replaced.map((r) => `${r.from?.name} → ${r.to?.name}`).join(', ')} ` : ''}
              {p.tools.changed?.length ? `~ ${names(p.tools.changed)}` : ''}
            </li>
          ) : null}
          {p.subAgents && (p.subAgents.added?.length || p.subAgents.removed?.length) ? (
            <li>
              subAgents : {p.subAgents.added?.length ? `+ ${names(p.subAgents.added)} ` : ''}
              {p.subAgents.removed?.length ? `− ${names(p.subAgents.removed)}` : ''}
            </li>
          ) : null}
          {p.skippedTools?.length ? <li>skippedTools : {names(p.skippedTools)}</li> : null}
          {p.destructive?.length ? (
            p.destructive.map((d, i) => (
              <li key={i} className="text-red-600 dark:text-red-400">
                {d}
              </li>
            ))
          ) : (
            <li className="text-muted-foreground">destructive : —</li>
          )}
        </ul>
      )}
      {ins?.firstChanges?.length ? (
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded border border-border p-2 font-mono text-xs">
          {ins.firstChanges.map((c, i) => (
            <div key={i} className={c.op === '+' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}>
              {c.op} {c.line}: {c.text}
            </div>
          ))}
        </pre>
      ) : null}
    </div>
  )
}

/** What the sync does to a base, a published document or another agent, in plain words. */
export function otherLine(a: SyncAction): { text: string; tone: 'ok' | 'warn' | 'bad' | 'muted'; why?: string } {
  if (a.type === 'kbdoc') {
    const name = `« ${docLabel(a.key)} »`
    if (a.action === 'skipped')
      return { text: tr(`Document ${name} : aucun texte à publier, il reste absent de la base`, `Document ${name}: no text to publish, it stays out of the base`), tone: 'warn', why: docEmptyHint(a.key) || tr('L’agent fonctionne sans ; il en tiendra compte dès qu’un texte sera publié.', 'The agent works without it; it uses it as soon as a text is published.') }
    if (a.action === 'failed') return { text: tr(`Document ${name} : échec de la publication`, `Document ${name}: publication failed`), tone: 'bad', why: errorText(a.error) }
    if (a.action === 'would-upload') return { text: tr(`Document ${name} : sera republié dans la base`, `Document ${name}: will be republished in the base`), tone: 'ok' }
    if (a.action === 'uploaded') return { text: tr(`Document ${name} : publié`, `Document ${name}: published`), tone: 'ok' }
    return { text: tr(`Document ${name} : à jour`, `Document ${name}: up to date`), tone: 'muted' }
  }
  if (a.type === 'agent') {
    const name = `« ${agentLabel(a.key)} »`
    if (a.action === 'failed') return { text: tr(`Agent ${name} : échec`, `Agent ${name}: failed`), tone: 'bad' }
    if (a.action === 'drift') return { text: tr(`Agent ${name} : modifié à la main, laissé tel quel`, `Agent ${name}: edited by hand, left as is`), tone: 'warn' }
    if (a.action.startsWith('would-') || a.action === 'created' || a.action === 'updated') return { text: tr(`Agent ${name} : ${actionLabel(a.action)}`, `Agent ${name}: ${actionLabel(a.action)}`), tone: 'ok' }
    return { text: tr(`Agent ${name} : ${actionLabel(a.action)}`, `Agent ${name}: ${actionLabel(a.action)}`), tone: 'muted' }
  }
  const name = `« ${kbLabel(a.key)} »`
  if (a.action === 'failed') return { text: tr(`Base ${name} : échec de la création`, `Base ${name}: creation failed`), tone: 'bad' }
  if (a.action === 'unbound' || (kbExternal(a.key) && !a.id))
    return { text: tr(`Base ${name} : n’existe pas sur cet environnement`, `Base ${name}: does not exist on this environment`), tone: 'muted', why: tr('Elle est alimentée hors de la console : la synchronisation ne la crée pas.', 'It is filled outside the console: the sync does not create it.') }
  if (a.action === 'would-create') return { text: tr(`Base ${name} : sera créée`, `Base ${name}: will be created`), tone: 'ok' }
  if (a.action === 'created') return { text: tr(`Base ${name} : créée`, `Base ${name}: created`), tone: 'ok' }
  return { text: tr(`Base ${name} : déjà en place`, `Base ${name}: already in place`), tone: 'muted' }
}
