import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Call, CallResult } from '@/lib/api'
import type { ActionAnswer, ConsoleSource, ConsoleState, Dict } from '@/lib/types'
import { errorTechnical, errorText, tr } from '@/lib/i18n'

/* ------------------------------------------------------------------ *
 * Console state: one consoleState read feeds every view. It is re-read
 * every 30 s while something runs on the workspace, every 10 s while the
 * console follows an action whose answer it stopped waiting for (50 s),
 * and on demand. Actions go through consoleAction (journal + role check).
 * ------------------------------------------------------------------ */

const ACTIVE_POLL_MS = 30_000
const FOLLOW_POLL_MS = 10_000
const TICK_MS = 60_000
const FOLLOW_MAX_MS = 20 * 60_000

export interface Toast {
  id: number
  tone: 'ok' | 'bad' | 'info' | 'warn'
  text: string
  /** Error code and raw message, shown folded under « Détails techniques ». */
  technical?: string
}

export interface Following {
  key: string
  label: string
  since: number
  done: (s: ConsoleState) => boolean
}

export interface Memo {
  get<T>(key: string): { at: number; value: T } | undefined
  set<T>(key: string, value: T): void
  drop(key: string): void
}

export interface Ctx {
  state: ConsoleState | null
  loading: boolean
  loadError: string
  refresh: (opts?: { withAgents?: boolean; quiet?: boolean; force?: boolean }) => Promise<ConsoleState | null>
  call: Call
  /** Runs a control automation through consoleAction. `follow` tells when a run the client stopped waiting for is over. */
  run: <R = Dict>(key: string, label: string, action: string, args?: Dict, follow?: (s: ConsoleState) => boolean) => Promise<ActionAnswer<R> | null>
  /** Direct call of a console endpoint (consoleSources, consoleDiff) with the same error handling. */
  post: <T = Dict>(key: string, slug: string, body: Dict) => Promise<CallResult<T>>
  busy: Record<string, boolean>
  following: Following[]
  follow: (key: string, label: string, done: (s: ConsoleState) => boolean) => void
  toasts: Toast[]
  notify: (tone: Toast['tone'], text: string, technical?: string) => void
  dismiss: (id: number) => void
  /** Results of slow read-only calls (comparison, dry run) kept while the console is open. */
  memo: Memo
}

/** Exported for tests (a view can be rendered with a hand-made context value). */
export const ConsoleContext = createContext<Ctx | null>(null)

export function useConsole(): Ctx {
  const c = useContext(ConsoleContext)
  if (!c) throw new Error('useConsole outside ConsoleProvider')
  return c
}

/** Is an action of this name (optionally matching its args) running according to the journal? */
export function journalRunning(s: ConsoleState | null, action: string | ((a: string) => boolean), args?: (a: Dict) => boolean): boolean {
  return !!s?.journal?.some((j) => j.status === 'running' && (typeof action === 'string' ? j.data.action === action : action(j.data.action || '')) && (!args || args(j.data.args || {})))
}

/** Something is running on the workspace: keep the views fresh. */
export function isActive(s: ConsoleState | null): boolean {
  if (!s) return false
  const ing = s.status?.ingest
  const ctl = ing?.control?.action
  if (ing && ((ing.inFlight || 0) > 0 || (ing.processing || 0) > 0 || ((ing.queued || 0) > 0 && ctl !== 'suspend' && ctl !== 'stop'))) return true
  if (s.status?.benchmark?.status === 'running') return true
  return s.journal?.some((j) => j.status === 'running') ?? false
}

/** consoleState.sources is the output of _sources-effective: accept the list or {sources: [...]}. */
function normaliseSources(raw: unknown): ConsoleSource[] {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' && Array.isArray((raw as Dict).sources) ? ((raw as Dict).sources as unknown[]) : []
  return list.map((x) => {
    const s = x as ConsoleSource
    return { ...s, params: s.params || {}, overlay: s.overlay && ((s.overlay.added?.length || 0) > 0 || (s.overlay.removed?.length || 0) > 0) ? s.overlay : null }
  })
}

export function ConsoleProvider({ call, children }: { call: Call; children: ReactNode }) {
  const [state, setState] = useState<ConsoleState | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [following, setFollowing] = useState<Following[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastId = useRef(0)
  const agentsRef = useRef<ConsoleState['agents']>(null)
  const inflight = useRef(false)

  const notify = useCallback((tone: Toast['tone'], text: string, technical?: string) => {
    const id = ++toastId.current
    setToasts((t) => [...t.slice(-3), { id, tone, text, technical }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'bad' ? 20_000 : 6_000)
  }, [])
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const refresh = useCallback(
    async (opts: { withAgents?: boolean; quiet?: boolean; force?: boolean } = {}) => {
      if (inflight.current && opts.quiet && !opts.force) return null
      inflight.current = true
      if (!opts.quiet) setLoading(true)
      const res = await call<ConsoleState>('consoleState', { withAgents: !!opts.withAgents })
      inflight.current = false
      setLoading(false)
      if (!res.ok || !res.data) {
        setLoadError(res.stillRunning ? tr('Le workspace met trop de temps à répondre.', 'The workspace takes too long to answer.') : errorText(res.error, res.message))
        return null
      }
      const next: ConsoleState = { ...res.data, sources: normaliseSources(res.data.sources), journal: res.data.journal || [], status: res.data.status || {} }
      // The agents block (describeInstance, a few seconds) is only read on demand: keep the last one.
      if (opts.withAgents) agentsRef.current = next.agents
      else next.agents = agentsRef.current
      setLoadError('')
      setState(next)
      return next
    },
    [call]
  )

  useEffect(() => {
    void refresh({ withAgents: true })
  }, [refresh])

  // Background refresh: every 10 s while following an action, every 30 s while the workspace is busy.
  // Ticks while the console is open (DESIGN 5.3): the platform runs schedules at most every
  // 15 min and a schedule run has no user, so an open console moves a running bench and a
  // waiting ingestion queue on every minute, with the viewer's identity. Not journaled.
  const benchRunning = state?.status?.benchmark?.status === 'running'
  const ingestWaiting = (state?.status?.ingest?.queued || 0) > 0 && !(state?.status?.ingest?.inFlight || 0) && state?.status?.ingest?.phase !== 'suspended' && state?.status?.ingest?.phase !== 'stopped'
  const canTick = !!state?.me?.canControl
  useEffect(() => {
    if (!canTick || (!benchRunning && !ingestWaiting)) return
    const t = window.setInterval(() => {
      if (benchRunning) void call('consoleAction', { action: 'advanceBenchmark', args: {} })
      if (ingestWaiting) void call('consoleAction', { action: 'pumpIngest', args: {} })
    }, TICK_MS)
    return () => window.clearInterval(t)
  }, [canTick, benchRunning, ingestWaiting, call])

  useEffect(() => {
    const period = following.length ? FOLLOW_POLL_MS : isActive(state) ? ACTIVE_POLL_MS : 0
    if (!period) return
    const t = window.setInterval(() => void refresh({ quiet: true }), period)
    return () => window.clearInterval(t)
  }, [following.length, state, refresh])

  // End the follow-ups whose condition is met (or that ran for too long).
  useEffect(() => {
    if (!state || !following.length) return
    const now = Date.now()
    const over = following.filter((f) => f.done(state) || now - f.since > FOLLOW_MAX_MS)
    if (!over.length) return
    for (const f of over) {
      const done = f.done(state)
      notify(done ? 'ok' : 'warn', done ? tr(`${f.label} : terminé.`, `${f.label}: done.`) : tr(`${f.label} : suivi arrêté après 20 min, vérifiez l’historique.`, `${f.label}: stopped following after 20 min, check the history.`))
    }
    setFollowing((fs) => fs.filter((f) => !over.includes(f)))
    // A follow-up that ends may change the agent state: read it again.
    void refresh({ quiet: true, force: true, withAgents: true })
  }, [state, following, notify, refresh])

  const setKey = (key: string, v: boolean) => setBusy((b) => ({ ...b, [key]: v }))

  const follow = useCallback((key: string, label: string, done: (s: ConsoleState) => boolean) => {
    setFollowing((fs) => [...fs.filter((f) => f.key !== key), { key, label, since: Date.now(), done }])
  }, [])

  const run = useCallback(
    async <R = Dict,>(key: string, label: string, action: string, args: Dict = {}, done?: (s: ConsoleState) => boolean) => {
      setKey(key, true)
      try {
        const res = await call<ActionAnswer<R>>('consoleAction', { action, args })
        if (res.stillRunning) {
          notify('info', tr(`${label} : toujours en cours, suivi automatique.`, `${label}: still running, following it.`))
          follow(key, label, done || (() => true))
          void refresh({ quiet: true })
          return null
        }
        if (!res.data || res.status >= 400) {
          notify('bad', `${label} : ${errorText(res.error, res.message)}`, errorTechnical(res.error, res.message))
          return null
        }
        const ans = res.data
        if (!ans.ok) notify('bad', `${label} : ${errorText(ans.error, ans.message)}`, errorTechnical(ans.error, ans.message))
        void refresh({ quiet: true })
        return ans
      } finally {
        setKey(key, false)
      }
    },
    [call, notify, refresh, follow]
  )

  const post = useCallback(
    async <T = Dict,>(key: string, slug: string, body: Dict) => {
      setKey(key, true)
      try {
        const res = await call<T>(slug, body)
        if (!res.ok && !res.stillRunning) notify('bad', errorText(res.error, res.message), errorTechnical(res.error, res.message))
        return res
      } finally {
        setKey(key, false)
      }
    },
    [call, notify]
  )

  const store = useRef(new Map<string, { at: number; value: unknown }>())
  const memo = useMemo<Memo>(
    () => ({
      get: <T,>(k: string) => store.current.get(k) as { at: number; value: T } | undefined,
      set: <T,>(k: string, v: T) => void store.current.set(k, { at: Date.now(), value: v }),
      drop: (k: string) => void store.current.delete(k),
    }),
    []
  )

  const value = useMemo<Ctx>(
    () => ({ state, loading, loadError, refresh, call, run, post, busy, following, follow, toasts, notify, dismiss, memo }),
    [state, loading, loadError, refresh, call, run, post, busy, following, follow, toasts, notify, dismiss, memo]
  )
  return <ConsoleContext.Provider value={value}>{children}</ConsoleContext.Provider>
}
