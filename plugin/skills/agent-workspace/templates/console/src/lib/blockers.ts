import type { ConsoleState } from '@/lib/types'
import { tr } from '@/lib/i18n'

/* Why an action cannot run, said next to it (reason) and how to unblock it (fix,
 * shown when the user clicks the blocked button). Rule for the whole console: no
 * silently greyed-out button (AGENTS.console.md rule 3). */

export type Block = { reason: string; fix?: string } | false | null | undefined

export const block = (cond: unknown, reason: string, fix?: string): Block => (cond ? { reason, fix } : false)

/** The first blocker that applies. */
export const first = (...bs: Block[]): Block => bs.find(Boolean) || false

export function roleBlock(s: ConsoleState | null): Block {
  if (s?.me.canControl) return false
  return {
    reason: tr('Votre rôle ne le permet pas', 'Your role does not allow it'),
    fix: tr(
      `Votre rôle sur ce workspace (« ${s?.me.role || 'aucun'} ») ne permet pas les actions de maintenance. Demandez à un propriétaire ou administrateur du workspace de vous donner le rôle éditeur.`,
      `Your role on this workspace (« ${s?.me.role || 'none'} ») does not allow maintenance actions. Ask a workspace owner or admin for the editor role.`
    ),
  }
}

export function adminBlock(s: ConsoleState | null): Block {
  if (s?.me.canAdmin) return false
  return {
    reason: tr('Réservé aux administrateurs', 'Admins only'),
    fix: tr(
      'Cette action peut faire perdre du travail : seuls les propriétaires et administrateurs du workspace peuvent la lancer. Demandez-leur de le faire.',
      'This action can lose work: only the workspace owners and admins can run it. Ask one of them.'
    ),
  }
}
