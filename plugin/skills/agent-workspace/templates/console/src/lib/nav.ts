import { CONFIG, type ViewKey } from '@/console.config'
import { lb } from '@/lib/i18n'
import { CUSTOM_VIEWS } from '@/views/custom'

/* Which views exist (console.config.ts `views`) and their labels. Views link to
 * each other only through these helpers, so a link to a view that is off falls
 * back to the dashboard instead of a dead button. */

export type { ViewKey }

export function viewOn(v: ViewKey): boolean {
  if (v === 'bench') return CONFIG.views.bench
  if (v === 'sources') return CONFIG.views.sources
  if (v === 'ingestion') return CONFIG.views.ingestion
  if (v in CONFIG.nav.labels) return true
  return CUSTOM_VIEWS.some((c) => c.key === v)
}

export function viewLabel(v: ViewKey): string {
  const builtin = (CONFIG.nav.labels as Record<string, Parameters<typeof lb>[0]>)[v]
  if (builtin) return lb(builtin)
  const custom = CUSTOM_VIEWS.find((c) => c.key === v)
  return custom ? lb(custom.label) : v
}

export type Go = (v: ViewKey) => void
