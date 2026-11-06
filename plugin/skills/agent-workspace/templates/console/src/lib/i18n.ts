import { CONFIG, type Label } from '@/console.config'

/* French first (the operators' language, CONFIG.locale), English with ?lang=en
 * (shared links keep it). Strings stay next to their use: tr('Actualiser', 'Refresh').
 * Error codes of DESIGN.md §5.4 become one plain sentence each (errorText); the
 * code itself only shows under « Détails techniques » (errorTechnical). */

export type Locale = 'fr' | 'en'

export function detectLocale(): Locale {
  try {
    const q = new URLSearchParams(window.location.search).get('lang')
    if (q === 'en' || q === 'fr') return q
  } catch {
    /* no window (tests) */
  }
  return CONFIG.locale === 'en' ? 'en' : 'fr'
}

export const LOCALE: Locale = detectLocale()

export function tr(fr: string, en: string): string {
  return LOCALE === 'en' ? en : fr
}

/** A config label in the current language. */
export function lb(l: Label | undefined | null): string {
  if (!l) return ''
  return typeof l === 'string' ? l : LOCALE === 'en' ? l.en : l.fr
}

/** Readable fallback for a key nobody labelled: « product-docs » → « Product docs ». */
export function readable(key: string): string {
  const t = String(key || '').replace(/^(kb|agent|kbdoc|doc|source):/, '').replace(/[-_.]+/g, ' ').replace(/\s+/g, ' ').trim()
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '—'
}

const numberFmt = new Intl.NumberFormat(LOCALE === 'en' ? 'en-GB' : 'fr-FR')

export function num(n: unknown): string {
  return typeof n === 'number' && Number.isFinite(n) ? numberFmt.format(n) : '—'
}

export function plural(n: number, one: string, many: string): string {
  return `${num(n)} ${n > 1 ? many : one}`
}

export function dateTime(iso: unknown): string {
  if (typeof iso !== 'string' || !iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(LOCALE === 'en' ? 'en-GB' : 'fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function ago(iso: unknown, now = Date.now()): string {
  if (typeof iso !== 'string' || !iso) return '—'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 60) return tr(`il y a ${s} s`, `${s} s ago`)
  const m = Math.round(s / 60)
  if (m < 60) return tr(`il y a ${m} min`, `${m} min ago`)
  const h = Math.round(m / 60)
  if (h < 48) return tr(`il y a ${h} h`, `${h} h ago`)
  return dateTime(iso)
}

/* -- naming used by error sentences (the full label helpers live in lib/labels.ts) -- */

function baseWords(key: string): string {
  const l = lb(CONFIG.knowledgeBases[key]?.label) || readable(key)
  return tr(`la base « ${l} »`, `the « ${l} » base`)
}

function stepWords(type: string, key: string): string {
  if (type === 'kb') return baseWords(key)
  if (type === 'kbdoc') {
    const l = lb(CONFIG.documents[key]?.label) || readable(key)
    return tr(`le document « ${l} »`, `the « ${l} » document`)
  }
  if (type === 'agent') return tr(`l’agent « ${lb(CONFIG.agents[key]) || key} »`, `the « ${lb(CONFIG.agents[key]) || key} » agent`)
  if (type === 'source') return tr(`la source « ${lb(CONFIG.sources[key]?.label) || readable(key)} »`, `the « ${lb(CONFIG.sources[key]?.label) || readable(key)} » source`)
  return readable(key)
}

/** Plain reason for a product error code, lower case, without final dot (null if unknown). */
function reason(code: string): string | null {
  switch (code) {
    case 'Forbidden':
      return tr('votre rôle sur ce workspace ne permet pas les actions de maintenance', 'your role on this workspace does not allow maintenance actions')
    case 'AdminRequired':
      return tr('cette action est réservée aux propriétaires et administrateurs du workspace', 'this action is reserved to the workspace owners and admins')
    case 'InvalidAction':
      return tr('la console a demandé une action que le workspace ne connaît pas (versions de la console et du workspace différentes)', 'the console asked for an action the workspace does not know (console and workspace versions differ)')
    case 'InvalidOp':
      return tr('la console a demandé une opération que le workspace ne connaît pas (versions de la console et du workspace différentes)', 'the console asked for an operation the workspace does not know (console and workspace versions differ)')
    case 'InvalidOnly':
      return tr('le périmètre demandé n’est pas valide (versions de la console et du workspace différentes)', 'the requested scope is not valid (console and workspace versions differ)')
    case 'ActionFailed':
      return tr('l’automation du workspace s’est arrêtée sur une erreur : réessayez, et prévenez l’équipe technique si cela persiste', 'the workspace automation stopped on an error: retry, and tell the technical team if it persists')
    case 'UnknownManifestKey':
      return tr('l’élément demandé n’est pas déclaré dans la configuration du workspace', 'the requested item is not declared in the workspace configuration')
    case 'MissingDependency':
      return tr('une base ou un agent dont il dépend n’existe pas encore : lancez la synchronisation complète', 'a base or an agent it depends on does not exist yet: run the full sync')
    case 'AgentSaveFailed':
      return tr('Agent Factory a refusé la mise à jour de l’agent', 'Agent Factory refused the agent update')
    case 'AgentReadFailed':
      return tr('l’agent n’a pas pu être relu dans Agent Factory', 'the agent could not be read in Agent Factory')
    case 'KnowledgeBaseCreateFailed':
      return tr('la base n’a pas pu être créée', 'the base could not be created')
    case 'KbDocumentUploadFailed':
      return tr('le document n’a pas pu être envoyé dans la base', 'the document could not be sent to the base')
    case 'EmptyText':
      return tr('le document est vide : rien à publier', 'the document is empty: nothing to publish')
    case 'SourceNotConfigured':
      return tr('cette source n’est pas déclarée dans le workspace', 'this source is not declared in the workspace')
    case 'SourceRefreshRunning':
      return tr('un passage sur cette source est déjà en cours : attendez qu’il se termine', 'a pass on this source is already running: wait for it to finish')
    case 'SourceTypeUnsupported':
      return tr('ce type de source n’est pas pris en charge par le workspace', 'this source type is not supported by the workspace')
    case 'SourceRefreshFailed':
      return tr('le passage sur la source a échoué : réessayez, et prévenez l’équipe technique si cela persiste', 'the pass on the source failed: retry, and tell the technical team if it persists')
    case 'KnowledgeBaseNotFound':
      return tr('la base de destination n’existe pas encore : lancez la synchronisation complète (page Agent)', 'the target base does not exist yet: run the full sync (Agent page)')
    case 'BenchmarkRunning':
      return tr('un banc de test est déjà en cours', 'a benchmark is already running')
    case 'BenchmarkBusy':
      return tr('le banc de test est occupé : réessayez dans quelques secondes', 'the benchmark is busy: retry in a few seconds')
    case 'BenchmarkNotFound':
      return tr('ce banc de test est introuvable (il a peut-être été remplacé par un plus récent)', 'this benchmark is not found (a newer one may have replaced it)')
    case 'ExportNotFound':
      return tr('aucun export n’a encore été fait pour ce banc : lancez « Exporter les réponses »', 'no export was made for this benchmark yet: run « Export the answers »')
    case 'ExportUploadFailed':
      return tr('le fichier d’export n’a pas pu être enregistré : réessayez dans un instant', 'the export file could not be saved: retry in a moment')
    case 'NothingQueued':
      return tr('il n’y a rien à traiter', 'there is nothing to process')
    case 'NoCaseLoaded':
      return tr('aucun cas de test n’est chargé dans ce workspace', 'no test case is loaded in this workspace')
    case 'NothingToSave':
      return tr('rien n’a changé par rapport à la version enregistrée', 'nothing changed compared with the saved version')
    case 'NotIntegrated':
      return tr('la version livrée par git ne contient pas encore toutes les modifications : la console les garde tant qu’elles ne sont pas reportées', 'the version delivered from git does not contain every change yet: the console keeps them until they are carried over')
    case 'CustomCodeUnavailable':
      return tr('un service interne du workspace ne répond pas : réessayez dans une minute', 'an internal workspace service does not answer: retry in a minute')
    case 'AppMethodMissing':
      return tr('une application installée dans le workspace n’a pas la fonction attendue : prévenez l’équipe technique', 'an app installed in the workspace lacks the expected function: tell the technical team')
    case 'NetworkError':
      return tr('le workspace ne répond pas (réseau)', 'the workspace does not answer (network)')
    default:
      if (/^Http5\d\d$/.test(code)) return tr('le workspace a rencontré une erreur : réessayez, et prévenez l’équipe technique si cela persiste', 'the workspace hit an error: retry, and tell the technical team if it persists')
      if (code === 'Http401' || code === 'Http403') return tr('votre session ne donne pas accès à ce workspace', 'your session does not give access to this workspace')
      if (code === 'Http404') return tr('le point d’entrée du workspace est introuvable (workspace pas encore à jour ?)', 'the workspace endpoint is not found (workspace not up to date yet?)')
      return null
  }
}

const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1) + '.'

/** « kbdoc reference: EmptyText » → « La synchronisation s’est arrêtée sur une étape — le document « … » : … ». */
function syncActionText(message?: string): string {
  const m = (message || '').match(/^(\w+) ([\w.:-]+): (\w+)/)
  if (!m) return tr('Une étape de la synchronisation a échoué. Le reste a été appliqué.', 'A sync step failed. The rest was applied.')
  const [, type, key, code] = m
  const why = reason(code) || tr('erreur technique', 'technical error')
  return tr(`La synchronisation s’est arrêtée sur une étape — ${stepWords(type, key)} : ${why}. Le reste a été appliqué.`, `The sync stopped on one step — ${stepWords(type, key)}: ${why}. The rest was applied.`)
}

/** One sentence an operator understands, for every error code the workspace returns. */
export function errorText(code?: string | null, message?: string | null): string {
  if (!code) return tr('L’action a échoué (voir les détails techniques).', 'The action failed (see the technical details).')
  if (code === 'SyncActionFailed') return syncActionText(message || undefined)
  const r = reason(code)
  return r ? sentence(r) : tr('L’action a échoué (erreur technique, voir les détails).', 'The action failed (technical error, see the details).')
}

/** Technical code and raw message, for « Détails techniques ». */
export function errorTechnical(code?: string | null, message?: string | null): string {
  return [code, message].filter(Boolean).join(' — ')
}
