import { useCallback, useEffect, useState } from 'react'
import { useConsole } from '@/lib/console'
import { errorTechnical, errorText, num, tr } from '@/lib/i18n'
import type { AgentRow, DocCounts, NamedRef } from '@/lib/types'
import { Pill, Table, Td, type Tone } from '@/components/kit'

/* Blocks of the comparison endpoint (consoleDiff, §5.3), shared by the Agent page
 * (agent part, folded under « Détails techniques ») and Bases et import (bases part).
 * Results are kept in the console memo so leaving a page does not recompute them. */

export const SETTING_LABELS: Record<string, () => string> = {
  name: () => tr('Nom', 'Name'),
  description: () => tr('Description', 'Description'),
  parser: () => tr('Lecture des fichiers', 'File reading'),
  chunking_strategy: () => tr('Découpage en passages', 'Splitting into passages'),
}

export const show = (v: unknown) => (v === undefined || v === null || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v))

const nameOf = (x: string | NamedRef) => (typeof x === 'string' ? x : x.name)

function List({ title, items, tone }: { title: string; items: string[]; tone: Tone }) {
  if (!items.length) return null
  return (
    <div className="flex flex-wrap items-baseline gap-1.5 text-sm">
      <span className="text-muted-foreground">{title}</span>
      {items.map((x) => (
        <Pill key={x} tone={tone}>
          {x}
        </Pill>
      ))}
    </div>
  )
}

/** Raw agent diff (field names, slugs, prompt line diff): only ever shown under « Détails techniques ». */
export function AgentTechnical({ a }: { a: AgentRow }) {
  const d = a.diff
  if (!d) return <p className="text-sm text-muted-foreground">{tr('Pas de comparaison disponible.', 'No comparison available.')}</p>
  const fields = Object.entries(d.fields || {})
  const ins = d.instructions
  const t = d.tools
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        {a.key} · {a.syncAll?.wouldDo || '—'} / {a.syncAll?.reason || '—'} · id {a.resolution?.id || '—'} ({a.resolution?.by || '—'})
      </p>
      {fields.length > 0 && (
        <Table head={[tr('Champ', 'Field'), tr('Workspace', 'Workspace'), tr('Agent en service', 'Agent in service')]}>
          {fields.map(([f, v]) => (
            <tr key={f}>
              <Td className="font-mono text-xs">{f}</Td>
              <Td className="text-xs">{show(v.from)}</Td>
              <Td className="text-xs">{show(v.to)}</Td>
            </tr>
          ))}
        </Table>
      )}
      <List title={tr('Outils seulement dans le workspace', 'Tools only in the workspace')} items={(t?.removed || []).map(nameOf)} tone="warn" />
      <List title={tr('Outils seulement sur l’agent', 'Tools only on the agent')} items={(t?.added || []).map(nameOf)} tone="info" />
      <List title={tr('Outils renommés', 'Renamed tools')} items={(t?.renamed || []).map((x) => `${x.from} → ${x.to}`)} tone="muted" />
      <List title={tr('Outils modifiés', 'Changed tools')} items={(t?.changed || []).map((x) => `${x.name}${x.fields?.length ? ` (${x.fields.join(', ')})` : ''}`)} tone="muted" />
      <List title={tr('Compétences seulement dans le workspace', 'Skills only in the workspace')} items={(d.skills?.removed || []).map(nameOf)} tone="warn" />
      <List title={tr('Compétences seulement sur l’agent', 'Skills only on the agent')} items={(d.skills?.added || []).map(nameOf)} tone="info" />
      <List title={tr('Compétences modifiées', 'Changed skills')} items={(d.skills?.changed || []).map(nameOf)} tone="muted" />
      <List title={tr('Sous-agents', 'Sub-agents')} items={[...(d.subAgents?.removed || []).map((x) => `− ${nameOf(x)}`), ...(d.subAgents?.added || []).map((x) => `+ ${nameOf(x)}`), ...(d.subAgents?.changed || []).map((x) => `~ ${nameOf(x)}`)]} tone="muted" />
      {ins && !ins.same && (
        <details className="rounded-md border border-border">
          <summary className="cursor-pointer px-3 py-2 text-sm">
            {tr('Consignes', 'Instructions')} : {num(ins.fromLength)} → {num(ins.toLength)} {tr('caractères', 'characters')} · {num(ins.changes?.length)} {tr('lignes différentes', 'different lines')}
          </summary>
          <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
            <span className="text-red-700 dark:text-red-400">−</span> {tr('dans le workspace seulement', 'in the workspace only')} · <span className="text-emerald-700 dark:text-emerald-400">+</span> {tr('sur l’agent seulement (ajout ou modification à la main)', 'on the agent only (added or edited by hand)')}
          </div>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap border-t border-border p-3 font-mono text-xs leading-relaxed">
            {(ins.changes || []).map((c, i) => (
              <div key={i} className={c.op === '+' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}>
                <span className="inline-block w-12 select-none text-muted-foreground">{c.line}</span>
                {c.op} {c.text}
              </div>
            ))}
          </pre>
        </details>
      )}
    </div>
  )
}

export interface PartState<T> {
  data: T | null
  loading: boolean
  at: number | null
  load: () => Promise<void>
}

/** Loads one part of consoleDiff once, keeps it in the console memo, and reloads on demand. */
export function useDiffPart<T>(part: 'agents' | 'kbs', extra: Record<string, unknown> = {}, auto = true): PartState<T> {
  const { call, memo, notify } = useConsole()
  const key = `diff:${part}:${JSON.stringify(extra)}`
  const cached = memo.get<T>(key)
  const [data, setData] = useState<T | null>(cached?.value ?? null)
  const [at, setAt] = useState<number | null>(cached?.at ?? null)
  const [loading, setLoading] = useState(false)
  const load = useCallback(async () => {
    setLoading(true)
    const res = await call<T>('consoleDiff', { part, ...extra })
    setLoading(false)
    if (!res.ok || !res.data) {
      notify('bad', res.stillRunning ? tr('La comparaison prend trop de temps : réessayez dans un instant.', 'The comparison takes too long: retry in a moment.') : errorText(res.error, res.message), errorTechnical(res.error, res.message))
      return
    }
    memo.set(key, res.data)
    setData(res.data)
    setAt(Date.now())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call, memo, notify, key])
  useEffect(() => {
    if (auto && !memo.get(key)) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, key])
  return { data, loading, at, load }
}

export function docCountsText(c: DocCounts | null | undefined): string {
  if (!c) return '—'
  const pending = c.in_progress || 0
  return `${num(c.completed || 0)} ${tr('consultables', 'searchable')}${pending ? ` · ${num(pending)} ${tr('en cours', 'in progress')}` : ''}${c.failed ? ` · ${num(c.failed)} ${tr('en échec', 'failed')}` : ''}`
}
