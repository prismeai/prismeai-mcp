import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import type { AppProps } from '@/types'
import { CONFIG, type ViewKey } from '@/console.config'
import { makeClient } from '@/lib/api'
import { ConsoleProvider, useConsole } from '@/lib/console'
import { ago, lb, LOCALE, tr } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { viewLabel, viewOn } from '@/lib/nav'
import { Banner, Spinner } from '@/components/kit'
import { IconBot, IconDashboard, IconGauge, IconGlobe, IconInbox, IconList, IconRefresh } from '@/components/icons'
import Dashboard from '@/views/Dashboard'
import Agent from '@/views/Agent'
import Bench from '@/views/Bench'
import Sources from '@/views/Sources'
import Ingestion from '@/views/Ingestion'
import Journal from '@/views/Journal'
import { CUSTOM_VIEWS } from '@/views/custom'

/* ------------------------------------------------------------------ *
 * Operator console of an agent workspace (templates/console, DESIGN.md).
 * One bundle, views selected by ?view= (shareable links). Every read goes
 * through consoleState, every action through the workspace endpoints with
 * the Studio session, so the workspace role check applies. Words and
 * optional views come from src/console.config.ts.
 * ------------------------------------------------------------------ */

type Group = keyof typeof CONFIG.nav.groups

const ALL: { key: ViewKey; group: Group; icon: ReactNode; on: boolean }[] = [
  { key: 'dashboard', group: 'overview', icon: <IconDashboard />, on: true },
  { key: 'agent', group: 'agent', icon: <IconBot />, on: true },
  { key: 'bench', group: 'agent', icon: <IconGauge />, on: CONFIG.views.bench },
  { key: 'sources', group: 'content', icon: <IconGlobe />, on: CONFIG.views.sources },
  { key: 'ingestion', group: 'content', icon: <IconInbox />, on: CONFIG.views.ingestion },
  { key: 'journal', group: 'tracking', icon: <IconList />, on: true },
  ...CUSTOM_VIEWS.map((c) => ({ key: c.key, group: c.group as Group, icon: c.icon ?? <IconInbox />, on: true })),
]

const VIEWS = ALL.filter((v) => v.on && viewOn(v.key))

function readView(): ViewKey {
  try {
    const raw = new URLSearchParams(window.location.search).get('view')
    // « Écarts » (diff) was merged into the Agent page: old links land there.
    const v = (raw === 'diff' ? 'agent' : raw) as ViewKey | null
    return v && viewOn(v) ? v : 'dashboard'
  } catch {
    return 'dashboard'
  }
}

export default function App({ sdk, workspace }: AppProps) {
  const call = useMemo(() => makeClient(sdk, workspace?.id ?? ''), [sdk, workspace?.id])
  return (
    <ConsoleProvider call={call}>
      <Shell workspaceName={workspace?.name ?? ''} />
    </ConsoleProvider>
  )
}

function Shell({ workspaceName }: { workspaceName: string }) {
  const { state, loading, loadError, refresh, following, toasts, dismiss } = useConsole()
  const [view, setView] = useState<ViewKey>(readView)
  const [, tick] = useState(0)

  const go = useCallback((v: ViewKey) => {
    const target = viewOn(v) ? v : 'dashboard'
    setView(target)
    document.querySelector('[data-testid="console-content"]')?.scrollTo({ top: 0 })
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('view', target)
      window.history.replaceState(null, '', url.toString())
    } catch {
      /* iframe without history access: the view still changes */
    }
  }, [])

  useEffect(() => {
    const onPop = () => setView(readView())
    window.addEventListener('popstate', onPop)
    // Re-render every 5 s so « il y a 12 s » stays true.
    const t = window.setInterval(() => tick((n) => n + 1), 5_000)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.clearInterval(t)
    }
  }, [])

  const setLang = (l: 'fr' | 'en') => {
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('lang', l)
      window.location.href = url.toString()
    } catch {
      /* no navigation possible: keep the current language */
    }
  }
  const grouped = VIEWS.reduce<{ group: string; items: typeof VIEWS }[]>((acc, v) => {
    const g = lb(CONFIG.nav.groups[v.group])
    const last = acc[acc.length - 1]
    if (last && last.group === g) last.items.push(v)
    else acc.push({ group: g, items: [v] })
    return acc
  }, [])

  return (
    <div className="console flex min-h-full flex-col text-foreground md:h-full md:min-h-0 md:flex-row md:overflow-hidden" data-testid="console-root">
      <aside className="con-sidebar flex shrink-0 flex-col md:h-full md:w-60">
        <div className="flex items-center gap-3 px-4 py-4">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">{CONFIG.monogram}</span>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold">{lb(CONFIG.title)}</span>
            {workspaceName && <span className="truncate text-xs opacity-60">{workspaceName}</span>}
          </div>
        </div>
        <nav className="flex flex-1 flex-row flex-wrap gap-1 px-2 pb-2 md:flex-col md:flex-nowrap md:gap-4 md:overflow-y-auto" aria-label={tr('Vues', 'Views')}>
          {grouped.map((g) => (
            <div key={g.group} className="flex flex-row flex-wrap gap-1 md:flex-col md:gap-0.5">
              <span className="hidden px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider opacity-40 md:block">{g.group}</span>
              {g.items.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  data-testid={`nav-${v.key}`}
                  aria-current={view === v.key ? 'page' : undefined}
                  onClick={() => go(v.key)}
                  className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors', view === v.key ? 'bg-primary text-primary-foreground' : 'opacity-70 hover:bg-white/10 hover:opacity-100')}
                >
                  {v.icon}
                  <span className="truncate">{viewLabel(v.key)}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="hidden flex-col gap-3 border-t border-white/10 px-4 py-4 text-xs md:flex">
          {following.length > 0 && (
            <span className="inline-flex items-start gap-1.5 opacity-80" data-testid="following">
              <Spinner className="mt-0.5" /> {following.map((f) => f.label).join(', ')} — {tr('toujours en cours', 'still running')}
            </span>
          )}
          <button type="button" onClick={() => void refresh({ withAgents: view === 'agent' || view === 'dashboard' })} disabled={loading} className="inline-flex items-center gap-2 opacity-70 hover:opacity-100 disabled:opacity-40" data-testid="refresh">
            {loading ? <Spinner /> : <IconRefresh className="h-4 w-4" />}
            {tr('Actualiser', 'Refresh')}
            {state && (
              <span className="opacity-60" data-testid="updated-at">
                · {ago(state.generatedAt)}
              </span>
            )}
          </button>
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex rounded-md bg-white/10 p-0.5" role="group" aria-label={tr('Langue', 'Language')}>
              {(['fr', 'en'] as const).map((l) => (
                <button key={l} type="button" data-testid={`lang-${l}`} onClick={() => LOCALE !== l && setLang(l)} aria-pressed={LOCALE === l} className={cn('rounded px-2 py-0.5 font-semibold uppercase', LOCALE === l ? 'bg-background text-foreground' : 'opacity-60 hover:opacity-100')}>
                  {l}
                </button>
              ))}
            </div>
            {state?.me && (
              <span className="truncate opacity-50" data-testid="my-role">
                {state.me.role || '—'}
                {state.me.canAdmin ? ' · admin' : ''}
              </span>
            )}
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 bg-muted/40 md:overflow-y-auto" data-testid="console-content">
        <main className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-6 px-4 py-8 md:px-8">
          {loadError && (
            <Banner tone="bad" testId="load-error">
              {loadError}
            </Banner>
          )}
          {!state && loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner /> {tr('Lecture de l’état du workspace…', 'Reading the workspace state…')}
            </div>
          )}
          {state && (
            <>
              {!state.me.canControl && <Banner tone="warn">{tr('Lecture seule : les actions demandent un rôle de contrôle sur le workspace.', 'Read only: actions need a control role on the workspace.')}</Banner>}
              {view === 'dashboard' && <Dashboard go={go} />}
              {view === 'agent' && <Agent go={go} />}
              {view === 'bench' && <Bench go={go} />}
              {view === 'sources' && <Sources go={go} />}
              {view === 'ingestion' && <Ingestion go={go} />}
              {view === 'journal' && <Journal />}
              {CUSTOM_VIEWS.find((c) => c.key === view)?.render(go)}
            </>
          )}
        </main>
      </div>

      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 px-4 md:px-0" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            data-testid="toast"
            role={t.tone === 'bad' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex flex-col gap-1 rounded-lg border px-3 py-2 text-left text-sm shadow-md',
              t.tone === 'ok' && 'border-emerald-600/40 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
              t.tone === 'bad' && 'border-red-600/40 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200',
              t.tone === 'warn' && 'border-amber-600/40 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
              t.tone === 'info' && 'border-blue-600/40 bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <span>{t.text}</span>
              <button type="button" data-testid="toast-close" onClick={() => dismiss(t.id)} aria-label={tr('Fermer', 'Close')} className="shrink-0 opacity-60 hover:opacity-100">
                ×
              </button>
            </div>
            {t.technical && (
              <details className="text-xs opacity-80">
                <summary className="cursor-pointer">{tr('Détails techniques', 'Technical details')}</summary>
                <code className="mt-1 block break-all font-mono">{t.technical}</code>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
