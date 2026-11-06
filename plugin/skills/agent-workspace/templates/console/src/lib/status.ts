import type { Tone } from '@/components/kit'
import { CONFIG } from '@/console.config'
import type { AgentSync, ConsoleState, DocCounts } from '@/lib/types'
import { dateTime, tr } from '@/lib/i18n'
import { agentDisplayName, frDe, listWords, resourceWords } from '@/lib/labels'
import { journalRunning } from '@/lib/console'

/* Readings of the workspace state shared by several views. */

export function docTotal(c: DocCounts | null | undefined): number | null {
  if (!c) return null
  if (typeof c.total === 'number') return c.total
  return (c.completed || 0) + (c.in_progress || 0) + (c.failed || 0)
}

export function ingestTotals(s: ConsoleState | null) {
  const i = s?.status?.ingest || {}
  const pending = (i.queued || 0) + (i.dispatched || 0) + (i.processing || 0)
  const total = pending + (i.ingested || 0) + (i.error || 0) + (i.cancelled || 0)
  return { pending, total, ingested: i.ingested || 0, errors: i.error || 0, cancelled: i.cancelled || 0, inFlight: i.inFlight || (i.processing || 0) + (i.dispatched || 0), queued: i.queued || 0 }
}

export function controlLabel(action?: string): { label: string; tone: Tone } {
  if (action === 'suspend') return { label: tr('En pause', 'Paused'), tone: 'warn' }
  if (action === 'stop') return { label: tr('Arrêté', 'Stopped'), tone: 'bad' }
  return { label: tr('Actif', 'Running'), tone: 'ok' }
}

export function benchStatusLabel(status?: string): { label: string; tone: Tone } {
  switch (status) {
    case 'running':
      return { label: tr('En cours', 'Running'), tone: 'info' }
    case 'paused':
      return { label: tr('En pause', 'Paused'), tone: 'warn' }
    case 'completed':
      return { label: tr('Terminé', 'Completed'), tone: 'ok' }
    case 'interrupted':
      return { label: tr('Interrompu', 'Interrupted'), tone: 'warn' }
    case 'failed':
    case 'rejected':
      return { label: tr('Échoué', 'Failed'), tone: 'bad' }
    case 'abandoned':
      return { label: tr('Abandonné', 'Abandoned'), tone: 'muted' }
    default:
      return { label: status || '—', tone: 'muted' }
  }
}

/** Missing dependencies of an agent: `missing` when the workspace gives it, else « (missing: a, b) » in its summary or wouldDo. */
export function missingOf(a: { missing?: string[]; summary?: string; wouldDo?: string } | null | undefined): string[] {
  if (!a) return []
  if (a.missing?.length) return a.missing
  const m = `${a.wouldDo || ''} ${a.summary || ''}`.match(/missing:?\s*([^)]*)\)?/i)
  return m ? m[1].split(/[,\s]+/).map((x) => x.trim()).filter((x) => x.includes(':')) : []
}

/** The agent the console is about: CONFIG.mainAgent, else the first non-optional agent. */
export function mainAgent(s: ConsoleState | null): AgentSync | undefined {
  const list = s?.agents || []
  if (CONFIG.mainAgent) {
    const a = list.find((x) => x.key === CONFIG.mainAgent)
    if (a) return a
  }
  return list.find((a) => !a.optional && !a.error) || list.find((a) => !a.optional)
}

/* ------------------------------------------------------------------ *
 * The state of the managed agent, computed once and read by every view
 * (dashboard card, Agent page). One state = one title, one explanation,
 * one action (AGENTS.console.md rule 7).
 * ------------------------------------------------------------------ */

export type AgentStateKind = 'loading' | 'ok' | 'update' | 'install' | 'drift' | 'error' | 'running'

export interface AgentStateView {
  kind: AgentStateKind
  tone: Tone
  agent: string
  title: string
  explain: string
  /** Label of the single primary action, absent when there is nothing to do. */
  action?: string
  /** Missing dependencies (raw `kb:<key>`…). */
  missing: string[]
  /** Drift without any fingerprint: the agent exists but was never synced from this workspace. */
  noBaseline?: boolean
}

export function syncRunning(s: ConsoleState | null): boolean {
  return journalRunning(s, 'syncAll', (a) => !a.dryRun)
}

export function agentState(s: ConsoleState | null): AgentStateView {
  const a = mainAgent(s)
  const name = agentDisplayName()
  const st = (s?.status?.agents || []).find((x) => x.key === (a?.key || CONFIG.mainAgent))
  const since = st?.publishedAt ? dateTime(st.publishedAt) : ''
  if (syncRunning(s))
    return { kind: 'running', tone: 'info', agent: name, title: tr('Synchronisation en cours…', 'Sync running…'), explain: tr('Vous pouvez quitter la page : elle continue sur le workspace, et cette page se met à jour toute seule.', 'You can leave the page: it goes on in the workspace, and this page updates by itself.'), missing: [] }
  if (!a) return { kind: 'loading', tone: 'muted', agent: name, title: tr('Lecture de l’agent…', 'Reading the agent…'), explain: tr('Lecture de l’agent dans Agent Factory.', 'Reading the agent in Agent Factory.'), missing: [] }
  if (a.reason === 'read-failed')
    return { kind: 'error', tone: 'bad', agent: name, title: tr(`Impossible de lire l’état ${frDe(name)}`, `Cannot read the state of ${name}`), explain: tr('Le workspace n’a pas accès à Agent Factory : sa clé d’accès est absente ou refusée. Rien ne sera créé tant que l’agent ne peut pas être lu. Prévenez l’équipe technique.', 'The workspace has no access to Agent Factory: its access key is missing or refused. Nothing is created while the agent cannot be read. Tell the technical team.'), action: tr('Réessayer', 'Retry'), missing: [] }
  if (a.error) return { kind: 'error', tone: 'bad', agent: name, title: tr(`Impossible de lire l’état ${frDe(name)}`, `Cannot read the state of ${name}`), explain: tr('Agent Factory n’a pas répondu. Réessayez dans un instant ; si cela persiste, prévenez l’équipe technique.', 'Agent Factory did not answer. Retry in a moment; if it persists, tell the technical team.'), action: tr('Réessayer', 'Retry'), missing: [] }
  const w = a.wouldDo || ''
  if (w === 'drift') {
    const noBaseline = a.reason === 'no-baseline'
    return {
      kind: 'drift',
      tone: 'bad',
      agent: name,
      noBaseline,
      title: noBaseline ? tr(`${name} existe déjà mais n’a jamais été synchronisé depuis ce workspace`, `${name} already exists but was never synced from this workspace`) : tr(`${name} a été modifié directement dans Agent Factory`, `${name} was edited directly in Agent Factory`),
      explain: noBaseline
        ? tr('La console ne sait pas si sa configuration actuelle a été faite à la main : elle ne la remplace pas d’elle-même. Relisez ce qui serait remplacé, puis demandez à un administrateur de lui appliquer la version du workspace.', 'The console cannot tell whether its current configuration was made by hand: it does not replace it by itself. Read what would be replaced, then ask an admin to apply the workspace version.')
        : tr('La console ne remplace jamais une modification manuelle. Reportez-la dans le workspace, ou demandez à un administrateur de la remplacer par la version du workspace.', 'The console never replaces a manual edit. Carry it into the workspace, or ask an admin to replace it with the workspace version.'),
      action: tr('Remplacer par la version du workspace', 'Replace with the workspace version'),
      missing: [],
    }
  }
  if (w === 'create' || w === 'failed' || w.startsWith('failed')) {
    const missing = missingOf(a)
    const words = missing.map(resourceWords)
    const explain =
      w === 'create'
        ? tr(`${name} n’existe pas encore sur cet environnement. La synchronisation complète crée ses sources de données, puis l’agent.`, `${name} does not exist on this environment yet. The full sync creates its data sources, then the agent.`)
        : words.length
          ? tr(
              `${since ? `La version en service date du ${since} et il` : 'Il'} lui manque ${words.length > 1 ? `${words.length} sources de données` : 'une source de données'} sur cet environnement : ${listWords(words)}. La synchronisation complète les crée, puis met à jour ${name}, en une seule fois.`,
              `${since ? `The version in service dates from ${since} and it` : 'It'} lacks ${words.length > 1 ? `${words.length} data sources` : 'a data source'} on this environment: ${listWords(words)}. The full sync creates them, then updates ${name}, in one go.`
            )
          : tr(`La dernière lecture de ${name} a signalé un problème. La synchronisation complète recrée ce qui manque ; l’aperçu ci-dessous dit ce qu’elle fera.`, `The last read of ${name} reported a problem. The full sync recreates what is missing; the preview below says what it will do.`)
    return { kind: 'install', tone: 'warn', agent: name, title: w === 'create' ? tr(`${name} n’est pas encore installé`, `${name} is not installed yet`) : tr('Une synchronisation complète est nécessaire', 'A full sync is needed'), explain, action: w === 'create' ? tr(`Créer ${name}`, `Create ${name}`) : tr('Lancer la synchronisation complète', 'Run the full sync'), missing }
  }
  if (w === 'unchanged' || w === 'none' || (w === 'update' && a.reason === 'in-sync'))
    return { kind: 'ok', tone: 'ok', agent: name, title: tr(`${name} est à jour`, `${name} is up to date`), explain: since ? tr(`Il correspond à la configuration de ce workspace. Version en service du ${since}.`, `It matches the workspace configuration. Version in service from ${since}.`) : tr('Il correspond à la configuration de ce workspace.', 'It matches the workspace configuration.'), missing: [] }
  return { kind: 'update', tone: 'warn', agent: name, title: tr(`Une mise à jour ${frDe(name)} est prête`, `An update of ${name} is ready`), explain: tr('La configuration du workspace a changé depuis la dernière synchronisation. Voici ce que les utilisateurs remarqueront.', 'The workspace configuration changed since the last sync. Here is what users will notice.'), action: tr(`Mettre à jour ${name}`, `Update ${name}`), missing: [] }
}
