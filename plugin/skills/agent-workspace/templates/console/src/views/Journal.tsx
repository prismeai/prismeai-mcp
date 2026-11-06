import { CONFIG } from '@/console.config'
import { useConsole } from '@/lib/console'
import { dateTime, lb, tr } from '@/lib/i18n'
import { journalActionLabel } from '@/lib/labels'
import type { JournalLine } from '@/lib/types'
import { Dot, Empty, PageHeader, Panel, Table, Td } from '@/components/kit'

/* Last control actions done from the console (state rows journal:*, §5.5): who,
 * what, result. The result is the short summary written by _console-summary. */

export function journalTone(status: string) {
  return status === 'ok' ? 'ok' : status === 'error' ? 'bad' : 'info'
}

export function journalStatusText(status: string) {
  return status === 'ok' ? tr('réussi', 'done') : status === 'error' ? tr('échec', 'failed') : tr('en cours', 'running')
}

const flat = (v: unknown): string => (Array.isArray(v) ? v.map(flat).join(', ') : v && typeof v === 'object' ? Object.entries(v as Record<string, unknown>).map(([k, x]) => `${k} ${flat(x)}`).join(' · ') : String(v))

/** The few counts of the journal result, else the main arguments. */
export function journalSummary(j: JournalLine): string {
  const r = j.data.result || {}
  if (typeof r.summary === 'string') return r.summary
  if (Array.isArray(r.summary)) return r.summary.join(' · ')
  const src = r.summary && typeof r.summary === 'object' ? (r.summary as Record<string, unknown>) : r
  const parts: string[] = []
  for (const [k, v] of Object.entries(src)) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue
    parts.push(`${k} ${flat(v)}`)
  }
  if (!parts.length) {
    const a = j.data.args || {}
    for (const k of ['source', 'action', 'dryRun', 'force', 'limit', 'agents']) if (a[k] !== undefined && a[k] !== null) parts.push(`${k} ${flat(a[k])}`)
  }
  return parts.join(' · ').slice(0, 300)
}

export default function Journal() {
  const { state } = useConsole()
  const lines = state?.journal || []
  return (
    <div className="flex flex-col gap-8" data-testid="view-journal">
      <PageHeader eyebrow={lb(CONFIG.nav.groups.tracking)} title={lb(CONFIG.nav.labels.journal)} sub={tr('Les dernières actions faites depuis la console : qui, quoi, résultat. Les lectures et les aperçus ne sont pas journalisés.', 'The last actions done from the console: who, what, result. Reads and previews are not journaled.')} />
      <Panel>
        {lines.length ? (
          <Table head={[tr('Date', 'Date'), tr('Qui', 'Who'), tr('Action', 'Action'), tr('Résultat', 'Result'), tr('Détail', 'Detail')]} testId="journal-table">
            {lines.map((j) => (
              <tr key={j.key} data-testid={`journal-${j.key}`}>
                <Td className="whitespace-nowrap">{dateTime(j.data.startedAt || j.updatedAt)}</Td>
                <Td>
                  {j.data.by?.email || j.data.by?.id || '—'} <span className="text-muted-foreground">{j.data.by?.role}</span>
                </Td>
                <Td>{journalActionLabel(j.data.action)}</Td>
                <Td className="whitespace-nowrap">
                  <Dot tone={journalTone(j.status)}>{journalStatusText(j.status)}</Dot>
                </Td>
                <Td className="text-xs text-muted-foreground">{journalSummary(j)}</Td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty>{tr('Aucune action enregistrée depuis la console.', 'No action recorded from the console.')}</Empty>
        )}
      </Panel>
    </div>
  )
}
