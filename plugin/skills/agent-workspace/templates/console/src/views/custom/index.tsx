import type { ReactNode } from 'react'
import type { Label } from '@/console.config'
import type { Go } from '@/lib/nav'

/* ------------------------------------------------------------------ *
 * AGENT CONTENT — the console views specific to this agent (guides/console.md
 * § 9). This file and the views it imports (put them in src/views/custom/) are
 * never overwritten by a newer template; every other file of the overlay is.
 * Each entry adds a sidebar item and a ?view=<key> page; build it with the
 * shared kit (@/components/kit) and the console hooks (@/lib/console).
 *
 *   import AddContent from './AddContent'
 *   export const CUSTOM_VIEWS: CustomView[] = [
 *     { key: 'add-content', group: 'content', label: { fr: 'Ajouter du contenu', en: 'Add content' },
 *       render: (go) => <AddContent go={go} /> },
 *   ]
 * ------------------------------------------------------------------ */

export interface CustomView {
  /** URL key (?view=<key>), unique, kebab-case, not a built-in view name. */
  key: string
  /** Sidebar group. */
  group: 'overview' | 'agent' | 'content' | 'tracking'
  label: Label
  /** Inline SVG icon (components/icons.tsx); a default icon is used when absent. */
  icon?: ReactNode
  render: (go: Go) => ReactNode
}

export const CUSTOM_VIEWS: CustomView[] = []
