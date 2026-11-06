import type { ReactNode } from 'react'
import { num, tr } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { agentLabel, resourceWords, skillLabel, toolLabel, toolResource } from '@/lib/labels'
import type { AgentDiff, AgentPlan, NamedRef } from '@/lib/types'

/* ------------------------------------------------------------------ *
 * Plain-language view of what a sync does to an agent, for non-developer
 * users (AGENTS.console.md rules 1, 2 and 8). Both sources are normalised
 * into « what a sync would do »:
 *  - a syncAll dry-run plan (§4.3, live → workspace: added = the sync adds it);
 *  - a describeInstance diff (§4.6, workspace → live: added = present on the
 *    agent only, so the sync would remove it).
 * Output: one summary sentence, an overall severity, changes grouped by
 * meaning with human labels (console.config.ts), each warning with its
 * explanation. The raw detail stays behind « Détails techniques » (callers).
 * ------------------------------------------------------------------ */

export type Severity = 'safe' | 'check' | 'destructive'
export type Group = 'consignes' | 'competences' | 'bases' | 'reglages' | 'equipe'

export interface ChangeItem {
  group: Group
  sev: Severity
  text: string
  why?: string
  /** A tool absent only because its base does not exist yet (comes back with the full sync). */
  waiting?: boolean
}

export interface ChangeSet {
  agent: string
  mode: 'create' | 'update' | 'same' | 'blocked' | 'afterCreate'
  items: ChangeItem[]
  blockers: string[]
  handEdited?: { what: string[] } | null
}

export const GROUPS: Record<Group, () => string> = {
  consignes: () => tr('Consignes', 'Instructions'),
  competences: () => tr('Compétences', 'Skills'),
  bases: () => tr('Sources et outils', 'Sources and tools'),
  reglages: () => tr('Réglages', 'Settings'),
  equipe: () => tr('Sous-agents', 'Sub-agents'),
}

export const SEVERITY: Record<Severity, { label: () => string; cls: string; dot: string }> = {
  safe: { label: () => tr('Rien de risqué', 'Nothing risky'), cls: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  check: { label: () => tr('À vérifier', 'To check'), cls: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  destructive: { label: () => tr('Destructif', 'Destructive'), cls: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
}

export const FIELD_LABELS: Record<string, () => string> = {
  model: () => tr('Modèle', 'Model'),
  temperature: () => tr('Température (part d’aléatoire des réponses)', 'Temperature (randomness of answers)'),
  tool_call_budget: () => tr('Nombre maximum de recherches par réponse', 'Maximum searches per answer'),
  token_budget: () => tr('Budget de texte lu et écrit par réponse', 'Text budget read and written per answer'),
  max_turns: () => tr('Nombre maximum d’étapes par réponse', 'Maximum steps per answer'),
  max_tokens: () => tr('Longueur maximale d’une réponse', 'Maximum answer length'),
  visibility: () => tr('Qui peut utiliser l’agent', 'Who can use the agent'),
  description: () => tr('Description', 'Description'),
  instructions: () => tr('consignes', 'instructions'),
  tools: () => tr('outils', 'tools'),
  skills: () => tr('compétences', 'skills'),
  subAgents: () => tr('sous-agents', 'sub-agents'),
}

const LIMITS = ['tool_call_budget', 'token_budget', 'max_turns', 'max_tokens']
const limitKey = (f: string) => f.replace(/^limits\./, '')

const showVal = (v: unknown): string => {
  if (v === undefined || v === null || v === '') return tr('par défaut', 'default')
  if (typeof v === 'number') return num(v)
  if (v === 'restricted') return tr('restreint', 'restricted')
  if (v === 'public') return tr('tout le monde', 'everyone')
  if (v === 'private') return tr('vous seul', 'only you')
  return typeof v === 'object' ? JSON.stringify(v) : String(v)
}

const names = (xs?: unknown[] | null): string[] => (xs || []).map((x) => (typeof x === 'string' ? x : (x as NamedRef)?.name || ((x as { id?: string })?.id ?? '?')))

interface FieldChange {
  field: string
  from: unknown
  to: unknown
}

interface Normalised {
  fields: FieldChange[]
  instructions: { from?: number; to?: number; added?: number; removed?: number; lost?: string[] } | null
  toolsAdd: string[]
  toolsRemove: string[]
  toolsReplace: string[]
  toolsChange: string[]
  skillsAdd: string[]
  skillsRemove: string[]
  skillsChange: string[]
  subAdd: string[]
  subRemove: string[]
  toolsWaiting?: string[]
}

/** Splits the removed tools: those whose base is missing come back with the full sync. */
function splitWaiting(n: Normalised, missing: string[]): Normalised {
  const waiting = n.toolsRemove.filter((t) => {
    const r = toolResource(t)
    return !!r && missing.includes(r)
  })
  return { ...n, toolsRemove: n.toolsRemove.filter((t) => !waiting.includes(t)), toolsWaiting: waiting }
}

function itemsOf(n: Normalised): ChangeItem[] {
  const out: ChangeItem[] = []
  const ins = n.instructions
  if (ins) {
    const shrink = ins.from && ins.to !== undefined ? 1 - ins.to / ins.from : 0
    if (ins.lost?.length) {
      const lost = ins.lost.slice(0, 4).map((h) => `« ${h} »`).join(', ')
      out.push({ group: 'consignes', sev: 'destructive', text: tr(`Les consignes perdent des sections : ${lost}.`, `The instructions lose sections: ${lost}.`), why: tr('L’agent ne suivra plus ces passages : relisez le détail technique avant d’appliquer.', 'The agent will stop following these parts: read the technical detail before applying.') })
    }
    if (shrink > 0.1) {
      out.push({ group: 'consignes', sev: 'check', text: tr(`Les consignes raccourcissent de ${Math.round(shrink * 100)} %.`, `The instructions get ${Math.round(shrink * 100)} % shorter.`), why: tr('Une partie du texte actuel disparaît : vérifiez que ce n’est pas un travail fait à la main qui serait perdu.', 'Part of the current text goes away: check it is not hand-made work that would be lost.') })
    } else {
      out.push({
        group: 'consignes',
        sev: 'safe',
        text:
          ins.from && ins.to && ins.to > ins.from * 1.2
            ? tr(`Il suit des consignes nettement plus détaillées (${num(ins.from)} → ${num(ins.to)} caractères).`, `It follows much more detailed instructions (${num(ins.from)} → ${num(ins.to)} characters).`)
            : tr(`Il suit des consignes mises à jour (${num(ins.added)} lignes ajoutées, ${num(ins.removed)} retirées).`, `It follows updated instructions (${num(ins.added)} lines added, ${num(ins.removed)} removed).`),
      })
    }
  }
  if (n.skillsAdd.length) out.push({ group: 'competences', sev: 'safe', text: n.skillsAdd.length > 1 ? tr(`Il sait faire ${n.skillsAdd.length} nouvelles choses : ${n.skillsAdd.map(skillLabel).join(', ')}.`, `It can do ${n.skillsAdd.length} new things: ${n.skillsAdd.map(skillLabel).join(', ')}.`) : tr(`Il sait faire une nouvelle chose : ${skillLabel(n.skillsAdd[0])}.`, `It can do a new thing: ${skillLabel(n.skillsAdd[0])}.`) })
  if (n.skillsChange.length) out.push({ group: 'competences', sev: 'safe', text: tr(`Ces savoir-faire sont mis à jour : ${n.skillsChange.map(skillLabel).join(', ')}.`, `These skills are updated: ${n.skillsChange.map(skillLabel).join(', ')}.`) })
  if (n.skillsRemove.length) out.push({ group: 'competences', sev: 'destructive', text: tr(`Il ne sait plus faire : ${n.skillsRemove.map(skillLabel).join(', ')}.`, `It can no longer do: ${n.skillsRemove.map(skillLabel).join(', ')}.`), why: tr('Les utilisateurs ne bénéficieront plus de ces procédures guidées.', 'Users will no longer get these guided procedures.') })
  if (n.toolsAdd.length) out.push({ group: 'bases', sev: 'safe', text: n.toolsAdd.length === 1 && n.toolsAdd[0] === 'memory' ? tr('Il se souvient du fil de la conversation.', 'It remembers the thread of the conversation.') : tr(`Il peut désormais utiliser : ${n.toolsAdd.map(toolLabel).join(', ')}.`, `It can now use: ${n.toolsAdd.map(toolLabel).join(', ')}.`) })
  if (n.toolsChange.length) out.push({ group: 'bases', sev: 'safe', text: tr(`Réglage d’accès mis à jour : ${n.toolsChange.map(toolLabel).join(', ')}.`, `Access setting updated: ${n.toolsChange.map(toolLabel).join(', ')}.`) })
  if (n.toolsReplace.length) out.push({ group: 'bases', sev: 'destructive', text: tr(`Accès remplacé : ${n.toolsReplace.join(', ')}.`, `Access replaced: ${n.toolsReplace.join(', ')}.`), why: tr('L’agent cherchera autrement dans cette source : lancez un banc de test après.', 'The agent will search this source differently: run a benchmark afterwards.') })
  if (n.toolsWaiting?.length) out.push({ group: 'bases', sev: 'check', waiting: true, text: tr(`Accès momentanément absent : ${n.toolsWaiting.map(toolLabel).join(', ')} (la source n’existe pas encore sur cet environnement).`, `Access temporarily missing: ${n.toolsWaiting.map(toolLabel).join(', ')} (the source does not exist on this environment yet).`), why: tr('Il sera rétabli par la synchronisation complète, qui crée la source.', 'It comes back with the full sync, which creates the source.') })
  if (n.toolsRemove.length) out.push({ group: 'bases', sev: 'destructive', text: tr(`Il ne peut plus utiliser : ${n.toolsRemove.map(toolLabel).join(', ')}.`, `It can no longer use: ${n.toolsRemove.map(toolLabel).join(', ')}.`), why: tr('L’agent ne pourra plus chercher dans ces sources : les questions qui en dépendent n’auront plus de réponse.', 'The agent will no longer search these sources: questions relying on them will go unanswered.') })
  for (const f of n.fields) {
    const key = limitKey(f.field)
    const label = FIELD_LABELS[key]?.() ?? key
    if (key === 'description') {
      out.push({ group: 'reglages', sev: 'safe', text: tr('Description de l’agent mise à jour.', 'Agent description updated.') })
    } else if (key === 'model') {
      out.push({ group: 'reglages', sev: 'check', text: tr(`Il change de modèle : ${showVal(f.from)} → ${showVal(f.to)}.`, `It changes model: ${showVal(f.from)} → ${showVal(f.to)}.`), why: tr('Le ton et la qualité des réponses peuvent changer : lancez un banc de test après.', 'Answer tone and quality may change: run a benchmark afterwards.') })
    } else if (key === 'visibility') {
      out.push({ group: 'reglages', sev: 'check', text: `${label} : ${showVal(f.from)} → ${showVal(f.to)}.`, why: tr('La liste des personnes qui peuvent ouvrir l’agent change.', 'The list of people who can open the agent changes.') })
    } else if (LIMITS.includes(key) && (f.to === null || f.to === undefined || Number(f.to) < Number(f.from))) {
      out.push({ group: 'reglages', sev: 'check', text: `${label} : ${showVal(f.from)} → ${showVal(f.to)}.`, why: tr('La limite baisse : les réponses longues ou qui demandent beaucoup de recherches risquent d’être coupées.', 'The limit goes down: long answers or ones needing many searches may get cut.') })
    } else {
      out.push({ group: 'reglages', sev: key === 'temperature' ? 'check' : 'safe', text: `${label} : ${showVal(f.from)} → ${showVal(f.to)}.`, why: key === 'temperature' ? tr('Les réponses deviennent plus ou moins variables.', 'Answers become more or less variable.') : undefined })
    }
  }
  if (n.subAdd.length) out.push({ group: 'equipe', sev: 'safe', text: tr(`Il peut confier des questions à : ${n.subAdd.map(agentLabel).join(', ')}.`, `It can hand questions over to: ${n.subAdd.map(agentLabel).join(', ')}.`) })
  if (n.subRemove.length) out.push({ group: 'equipe', sev: 'destructive', text: tr(`Il ne confie plus de questions à : ${n.subRemove.map(agentLabel).join(', ')}.`, `It no longer hands questions over to: ${n.subRemove.map(agentLabel).join(', ')}.`), why: tr('Les questions que traitaient ces sous-agents n’auront plus la même réponse.', 'The questions these sub-agents handled will not get the same answer anymore.') })
  return out
}

/** From a syncAll dry-run agent action (§4.3). */
export function fromPlan(a: { key: string; action: string; missing?: string[]; drift?: { changes?: string[] }; plan?: AgentPlan }): ChangeSet {
  const p = a.plan || {}
  const blockers = (a.missing || []).map(resourceWords)
  const handEdited = a.action === 'drift' ? { what: a.drift?.changes || [] } : null
  if (p.mode === 'create' || a.action === 'would-create') return { agent: a.key, mode: blockers.length ? 'blocked' : 'create', items: [], blockers, handEdited }
  const ins = p.instructions
  const n: Normalised = {
    fields: (p.fields || []).map((f) => ({ field: f.field, from: f.from, to: f.to })),
    instructions: ins && (ins.addedLines || ins.removedLines || ins.fromLength !== ins.toLength) ? { from: ins.fromLength, to: ins.toLength, added: ins.addedLines, removed: ins.removedLines, lost: ins.lostSections } : null,
    toolsAdd: names(p.tools?.added),
    toolsRemove: names(p.tools?.removed),
    toolsReplace: (p.tools?.replaced || []).map((r) => `${toolLabel(r.from?.name || '?')} → ${toolLabel(r.to?.name || '?')}`),
    toolsChange: names(p.tools?.changed),
    skillsAdd: names(p.skills?.added),
    skillsRemove: names(p.skills?.removed),
    skillsChange: names(p.skills?.changed),
    subAdd: names(p.subAgents?.added),
    subRemove: names(p.subAgents?.removed),
  }
  const items = itemsOf(splitWaiting(n, a.missing || []))
  return { agent: a.key, mode: blockers.length ? 'blocked' : items.length ? 'update' : 'same', items, blockers, handEdited }
}

/** From a describeInstance diff (§4.6, workspace → agent), expressed as what a sync would do. */
export function fromDiff(a: { key: string; diff?: AgentDiff | null; syncAll?: { wouldDo?: string; reason?: string } | null }, missing: string[] = []): ChangeSet {
  const w = a.syncAll?.wouldDo || ''
  const blockers = w === 'failed' || w.startsWith('failed') ? missing.map(resourceWords) : []
  const handEdited = w === 'drift' ? { what: [] } : null
  const d = a.diff
  if (!d) return { agent: a.key, mode: w === 'create' ? 'create' : 'same', items: [], blockers, handEdited }
  const fields = Object.entries(d.fields || {}).map(([field, v]) => ({ field, from: v.to, to: v.from }))
  const ins = d.instructions
  const changes = ins?.changes || []
  const n: Normalised = {
    fields,
    instructions: ins && ins.same === false ? { from: ins.toLength, to: ins.fromLength, added: changes.filter((c) => c.op === '-').length, removed: changes.filter((c) => c.op === '+').length } : null,
    toolsAdd: names(d.tools?.removed),
    toolsRemove: names(d.tools?.added),
    toolsReplace: (d.tools?.renamed || []).map((r) => `${toolLabel(r.to)} → ${toolLabel(r.from)}`),
    toolsChange: names(d.tools?.changed),
    skillsAdd: names(d.skills?.removed),
    skillsRemove: names(d.skills?.added),
    skillsChange: names(d.skills?.changed),
    subAdd: names(d.subAgents?.removed),
    subRemove: names(d.subAgents?.added),
  }
  const items = itemsOf(splitWaiting(n, missing))
  return { agent: a.key, mode: blockers.length ? 'blocked' : items.length ? 'update' : 'same', items, blockers, handEdited }
}

export function overall(c: ChangeSet): Severity {
  if (c.items.some((i) => i.sev === 'destructive')) return 'destructive'
  if (c.handEdited || c.items.some((i) => i.sev === 'check')) return 'check'
  return 'safe'
}

/** One or two sentences: what changes for the agent and for its users. */
export function sentence(c: ChangeSet, agentName: string, conditional: boolean): string {
  const lead = conditional ? tr(`Si vous synchronisez, ${agentName}`, `If you sync, ${agentName}`) : agentName
  if (c.mode === 'afterCreate') return tr(`${agentName} sera mis à jour juste après la création des sources de données qui lui manquent, dans cette même synchronisation.`, `${agentName} is updated right after the data sources it lacks are created, in this same sync.`)
  if (c.mode === 'blocked') return tr(`${agentName} ne peut pas encore être synchronisé : il manque ${c.blockers.join(', ')}.`, `${agentName} cannot be synced yet: ${c.blockers.join(', ')} missing.`)
  if (c.mode === 'create') return tr(`${agentName} n’existe pas encore : la synchronisation le créera avec la configuration du workspace.`, `${agentName} does not exist yet: the sync will create it with the workspace configuration.`)
  if (c.mode === 'same') return tr(`${agentName} est identique à ce que prévoit le workspace : rien à changer.`, `${agentName} matches the workspace: nothing to change.`)
  const parts: string[] = []
  const g = (k: Group) => c.items.some((i) => i.group === k)
  if (g('consignes')) parts.push(tr('ses consignes sont mises à jour', 'its instructions are updated'))
  if (g('competences')) parts.push(tr('ses compétences changent', 'its skills change'))
  if (g('bases')) parts.push(tr('ses accès aux sources changent', 'its access to sources changes'))
  if (g('reglages')) parts.push(tr('certains réglages changent', 'some settings change'))
  if (g('equipe')) parts.push(tr('ses sous-agents changent', 'its sub-agents change'))
  const users = c.items.some((i) => i.sev === 'destructive') ? tr(' Attention : certaines capacités disparaissent pour les utilisateurs.', ' Careful: some capabilities go away for users.') : tr(' Les utilisateurs ne perdent aucune capacité.', ' Users lose no capability.')
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} ${tr('et', 'and')} ${parts[parts.length - 1]}` : parts[0]
  return `${lead} : ${list}.${users}`
}

export function SeverityBadge({ sev }: { sev: Severity }) {
  const s = SEVERITY[sev]
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium', s.cls)} data-testid={`severity-${sev}`}>
      <span aria-hidden className={cn('inline-block h-2 w-2 rounded-full', s.dot)} />
      {s.label()}
    </span>
  )
}

/** The summary block: sentence, severity, grouped changes with explanations, then the caller's technical detail folded. */
export default function ChangeSummary({ change, agentName, conditional = true, technical, testId }: { change: ChangeSet; agentName: string; conditional?: boolean; technical?: ReactNode; testId?: string }) {
  const sev = overall(change)
  const groups = (Object.keys(GROUPS) as Group[]).map((g) => ({ g, items: change.items.filter((i) => i.group === g) })).filter((x) => x.items.length)
  return (
    <div className="flex flex-col gap-3" data-testid={testId}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <p className="max-w-2xl text-sm leading-relaxed">{sentence(change, agentName, conditional)}</p>
        {change.mode === 'update' && <SeverityBadge sev={sev} />}
      </div>
      {change.blockers.length > 0 && (
        <p className="border-l-2 border-l-amber-500 pl-3 text-sm">
          {tr('À faire d’abord : lancez la synchronisation complète (page Agent) pour créer ', 'First: run the full sync (Agent page) to create ')}
          {change.blockers.join(', ')}.
        </p>
      )}
      {change.handEdited && (
        <p className="border-l-2 border-l-amber-500 pl-3 text-sm">
          {tr('Cet agent a été modifié à la main dans Agent Factory depuis la dernière synchronisation. La console ne l’écrasera pas : relisez les différences, puis faites reporter ces changements dans le workspace, ou demandez à un administrateur de forcer.', 'This agent was edited by hand in Agent Factory since the last sync. The console will not overwrite it: read the differences, then have these changes carried into the workspace, or ask an admin to force.')}
          {change.handEdited.what.length ? ` (${change.handEdited.what.map((w) => FIELD_LABELS[w]?.() ?? w).join(', ')})` : ''}
        </p>
      )}
      {groups.length > 0 && (
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {groups.map(({ g, items }) => (
            <div key={g} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:gap-4">
              <span className="w-36 shrink-0 text-sm font-medium text-muted-foreground">{GROUPS[g]()}</span>
              <ul className="flex min-w-0 flex-1 flex-col gap-2">
                {items.map((i, k) => (
                  <li key={k} className="flex flex-col gap-0.5 text-sm">
                    <span className="flex items-start gap-2">
                      <span aria-hidden className={cn('mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full', SEVERITY[i.sev].dot)} />
                      <span>
                        {i.text}
                        {i.sev !== 'safe' && <span className={cn('ml-1.5 text-xs font-medium', SEVERITY[i.sev].cls)}>{SEVERITY[i.sev].label()}</span>}
                      </span>
                    </span>
                    {i.why && <span className="pl-4 text-xs text-muted-foreground">{i.why}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {technical && (
        <details className="text-sm" data-testid={testId ? `${testId}-technical` : undefined}>
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">{tr('Détails techniques', 'Technical details')}</summary>
          <div className="mt-3">{technical}</div>
        </details>
      )}
    </div>
  )
}

/** What the agent's users will notice, as one flat list (rule 8): markers only on « À vérifier » / « Destructif ». */
export function UserEffects({ change, dropWaiting, testId }: { change: ChangeSet; dropWaiting?: boolean; testId?: string }) {
  const items = change.items.filter((i) => !(dropWaiting && i.waiting))
  if (!items.length) return <p className="text-sm text-muted-foreground" data-testid={testId}>{tr('Rien que les utilisateurs remarqueront : la mise à jour ne change pas ce que fait l’agent.', 'Nothing users will notice: the update does not change what the agent does.')}</p>
  const destructive = items.some((i) => i.sev === 'destructive')
  return (
    <ul className="flex flex-col gap-2.5" data-testid={testId}>
      {items.map((i, k) => (
        <li key={k} className="flex flex-col gap-0.5 text-sm">
          <span className="flex items-start gap-2">
            <span aria-hidden className={cn('mt-[7px] inline-block h-1.5 w-1.5 shrink-0 rounded-full', i.sev === 'safe' ? 'bg-muted-foreground/40' : SEVERITY[i.sev].dot)} />
            <span>
              {i.sev !== 'safe' && <span className={cn('mr-1.5 font-medium', SEVERITY[i.sev].cls)}>{SEVERITY[i.sev].label()} ·</span>}
              {i.text}
            </span>
          </span>
          {i.why && i.sev !== 'safe' && <span className="pl-3.5 text-xs text-muted-foreground">{i.why}</span>}
        </li>
      ))}
      {!destructive && (
        <li className="flex items-start gap-2 text-sm text-muted-foreground">
          <span aria-hidden className="mt-[7px] inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
          {tr('Rien n’est retiré à l’agent.', 'Nothing is taken away from the agent.')}
        </li>
      )}
    </ul>
  )
}
