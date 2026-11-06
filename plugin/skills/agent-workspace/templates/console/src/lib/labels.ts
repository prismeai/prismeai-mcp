import { CONFIG } from '@/console.config'
import { lb, num, readable, tr } from '@/lib/i18n'

/* Human names of the workspace's things, from console.config.ts, with a readable
 * fallback built from the key. Views never print a manifest key or a tool slug
 * outside « Détails techniques » (AGENTS.console.md rule 8). */

export const agentDisplayName = (): string => lb(CONFIG.agentName) || tr('L’agent', 'The agent')

/** « Documentation produit » */
export function kbLabel(key: string): string {
  return lb(CONFIG.knowledgeBases[key]?.label) || readable(key)
}

/** « la base « Documentation produit » » */
export function kbName(key: string): string {
  return tr(`la base « ${kbLabel(key)} »`, `the « ${kbLabel(key)} » base`)
}

export function kbExternal(key: string): boolean {
  return !!CONFIG.knowledgeBases[key]?.external
}

/** What the base lets the agent do, for « ce que l'agent ne pourra pas encore faire ». */
export function kbCan(key: string): string {
  return lb(CONFIG.knowledgeBases[key]?.can) || tr(`chercher dans ${kbName(key)}`, `search ${kbName(key)}`)
}

export function toolLabel(name: string): string {
  const t = CONFIG.tools[name]
  if (t?.label) return lb(t.label)
  if (t?.kb) return tr(`recherche dans ${kbName(t.kb)}`, `search in ${kbName(t.kb)}`)
  return readable(name).toLowerCase()
}

/** The manifest base a tool reads (`kb:<key>`), if declared. */
export function toolResource(name: string): string | null {
  const kb = CONFIG.tools[name]?.kb
  return kb ? `kb:${kb}` : null
}

export function skillLabel(name: string): string {
  return `« ${lb(CONFIG.skills[name]) || readable(name)} »`
}

export function agentLabel(key: string): string {
  return lb(CONFIG.agents[key]) || readable(key)
}

export function docLabel(key: string): string {
  return lb(CONFIG.documents[key]?.label) || readable(key)
}

export function docEmptyHint(key: string): string {
  return lb(CONFIG.documents[key]?.emptyHint)
}

export function sourceLabel(key: string, fromManifest?: string): string {
  return lb(CONFIG.sources[key]?.label) || fromManifest || readable(key)
}

/** « 3 pages », « 1 page » (falls back to « document(s) »). */
export function itemsWord(sourceKey: string | undefined, n: number): string {
  const it = sourceKey ? CONFIG.sources[sourceKey]?.item : undefined
  const one = lb(it?.one) || tr('document', 'document')
  const many = lb(it?.many) || tr('documents', 'documents')
  return `${num(n)} ${n > 1 ? many : one}`
}

/** A missing dependency (`kb:<key>`, `agent:<key>`, any `<kind>:<key>`) in plain words. */
export function resourceWords(raw: string): string {
  if (CONFIG.resources[raw]) return lb(CONFIG.resources[raw])
  const [kind, ...rest] = raw.split(':')
  const key = rest.join(':') || kind
  if (kind === 'kb') return kbName(key)
  if (kind === 'agent') return tr(`l’agent « ${agentLabel(key)} »`, `the « ${agentLabel(key)} » agent`)
  if (kind === 'kbdoc' || kind === 'doc') return tr(`le document « ${docLabel(key)} »`, `the « ${docLabel(key)} » document`)
  return readable(key)
}

export function journalActionLabel(action?: string): string {
  if (!action) return '—'
  return lb(CONFIG.journalActions[action]) || readable(action)
}

/** A and B, A, B and C. */
export function listWords(xs: string[]): string {
  return xs.length > 1 ? `${xs.slice(0, -1).join(', ')} ${tr('et', 'and')} ${xs[xs.length - 1]}` : xs[0] || ''
}

/** French elision before a name: « de Assistant » → « d’Assistant », « que Assistant » → « qu’Assistant ». */
export function frDe(name: string, word: 'de' | 'que' = 'de'): string {
  return /^[aeiouyhàâäéèêëîïôöûü]/i.test(name) ? `${word === 'de' ? 'd' : 'qu'}’${name}` : `${word} ${name}`
}
