/**
 * Mock host for local development (`npm run dev`). Never bundled: only
 * src/main.tsx imports it.
 *
 * It answers every console endpoint of DESIGN.md §5.3 (consoleState,
 * consoleAction for each allowed action, consoleDiff, consoleSources) in
 * memory, from src/lib/fixtures.ts, so every agent state can be seen without
 * a workspace. URL parameters:
 *   ?mock=ok|update|install|drift|running   scenario (default: CONFIG.mock.scenario)
 *   ?role=owner|editor|viewer                caller role (default owner: admin)
 *   ?slow=1                                  a real sync takes 55 s (client stops waiting at 50 s)
 *   ?agentsError=1                           the agent read fails (consoleState.agents = [{error, message}])
 *   ?mock=off                                call the real workspace (VITE_PRISME_API_URL + VITE_PRISME_API_KEY)
 * The state lives in memory: reload the page to start the scenario again.
 */

import type { AppProps, MockCall } from '@/types'
import { CONFIG, type MockScenario } from '@/console.config'
import type { Dict, IngestControl, JournalLine, SourceOverlay, SyncAction } from '@/lib/types'
import * as F from '@/lib/fixtures'

type Sync = 'in-sync' | 'workspace-changed' | 'drift' | 'create'

interface Item {
  id: string
  source: string
  url: string
  name: string
  status: string
  attempts: number
  error?: { message: string; stage: string } | null
  due: number
  updatedAt: string
}

interface World {
  scenario: MockScenario
  role: string
  slow: boolean
  agentsError: boolean
  integrateTries: number
  agent: { exists: boolean; sync: Sync; publishedAt: string }
  kbs: Record<string, string | null>
  docs: Record<string, string | null>
  delivered: Record<string, string[]>
  overlay: Record<string, SourceOverlay | null>
  items: Item[]
  control: IngestControl
  lastRefresh: Record<string, Dict | null>
  cases: number
  bench: { id: string; status: string; startedAt: string; updatedAt: string; endAt: number; total: number; remaining?: number } | null
  journal: JournalLine[]
  syncUntil: number
  syncKey: string | null
  syncArgs: Dict
}

const now = () => Date.now()
const iso = (t = now()) => new Date(t).toISOString()
const ago = (min: number) => iso(now() - min * 60_000)
const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms))

/** Stable 16-hex id of an url (the engine uses sha256; any stable hash will do here). */
function hash16(s: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < s.length; i++) {
    h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619) >>> 0
    h2 = Math.imul(h2 ^ s.charCodeAt(s.length - 1 - i), 2246822519) >>> 0
  }
  return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).slice(0, 16)
}

const nameOf = (url: string) => url.split('/').filter(Boolean).pop() || url

/* ------------------------------ world ------------------------------ */

function createWorld(scenario: MockScenario, role: string, slow: boolean, agentsError: boolean): World {
  const installed = scenario !== 'install'
  const w: World = {
    scenario,
    role,
    slow,
    agentsError,
    integrateTries: 0,
    agent: { exists: installed, sync: scenario === 'ok' ? 'in-sync' : scenario === 'drift' ? 'drift' : scenario === 'install' ? 'create' : 'workspace-changed', publishedAt: ago(60 * 26) },
    kbs: Object.fromEntries(F.KBS.map((k) => [k.key, installed && k.create ? `kb_${k.key}_01` : null])),
    docs: Object.fromEntries(F.DOCUMENTS.map((d) => [d.key, installed ? ago(60 * 26) : null])),
    delivered: Object.fromEntries(F.SOURCES.map((s) => [s.key, [...s.urls]])),
    overlay: Object.fromEntries(F.SOURCES.map((s) => [s.key, null])),
    items: [],
    control: { action: 'run' },
    lastRefresh: Object.fromEntries(F.SOURCES.map((s) => [s.key, null])),
    cases: installed ? F.CASES : 0,
    bench: null,
    journal: [],
    syncUntil: 0,
    syncKey: null,
    syncArgs: {},
  }
  if (installed) {
    const running = scenario === 'running'
    F.SOURCES[0].urls.forEach((url, i) => {
      const pending = running && i >= 5
      w.items.push(makeItem(F.SOURCES[0].key, url, pending ? 'queued' : url === F.BROKEN_URL ? 'error' : 'ingested', pending ? now() + 4_000 + (i - 5) * 3_000 : 0))
    })
    w.lastRefresh['docs'] = { startedAt: ago(60 * 25), finishedAt: ago(60 * 25 - 2), discovered: 12, queued: 12, skipped: 0, removed: 0, failed: 0 }
    w.bench = running
      ? { id: 'b-0002', status: 'running', startedAt: ago(3), updatedAt: ago(0), endAt: now() + 45_000, total: F.CASES * 2 }
      : { id: 'b-0001', status: 'completed', startedAt: ago(60 * 20), updatedAt: ago(60 * 19), endAt: now() - 1, total: F.CASES * 2 }
    w.journal.push(line('syncAll', { skipIngest: false }, 'ok', 60 * 26, { summary: 'agent main updated · 2 bases exist · 1 document unchanged' }))
    w.journal.push(line('runBenchmark', { limit: 24 }, 'ok', 60 * 20, { summary: 'bench b-0001 · 48 cases queued' }))
  }
  if (scenario === 'update') {
    w.overlay['docs'] = { added: [F.OVERLAY_URL], removed: [], by: F.OPERATOR, at: ago(60 * 3), baseChanged: false }
    w.items.push(makeItem('docs', F.OVERLAY_URL, 'ingested', 0))
    w.journal.push(line('sources.save', { source: 'docs', add: [F.OVERLAY_URL] }, 'ok', 60 * 3, { summary: '1 address added' }))
  }
  if (scenario === 'drift') w.journal.push(line('describeInstance', {}, 'ok', 30, { summary: 'report exported' }))
  if (scenario === 'running') {
    w.syncUntil = now() + 20_000
    w.syncArgs = { skipIngest: true }
    w.syncKey = 'journal:running-sync'
    w.journal.push({ ...line('syncAll', w.syncArgs, 'running', 0.5, null), key: w.syncKey })
  }
  w.journal.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return w
}

function makeItem(source: string, url: string, status: string, due: number): Item {
  return {
    id: hash16(url),
    source,
    url,
    name: nameOf(url),
    status,
    attempts: status === 'error' ? 3 : status === 'ingested' ? 1 : 0,
    error: status === 'error' ? { message: 'The page answered 404 (not found).', stage: 'fetch' } : null,
    due,
    updatedAt: status === 'queued' ? iso() : ago(60 * 25),
  }
}

let journalSeq = 0
function line(action: string, args: Dict, status: string, minutesAgo: number, result: Dict | null): JournalLine {
  const at = ago(minutesAgo)
  return { key: `journal:${at.slice(0, 10)}:mock-${++journalSeq}`, status, updatedAt: at, data: { action, args, by: { id: 'user-1', email: F.OPERATOR, role: 'owner' }, startedAt: at, finishedAt: status === 'running' ? undefined : at, correlationId: `mock-${journalSeq}`, result } }
}

function journal(w: World, action: string, args: Dict, status: string, result: Dict | null): JournalLine {
  const l = line(action, args, status, 0, result)
  l.data.by = { id: 'user-1', email: F.OPERATOR, role: w.role }
  w.journal.unshift(l)
  w.journal = w.journal.slice(0, 30)
  return l
}

/* ------------------------------ time ------------------------------ */

function tick(w: World) {
  const t = now()
  if (w.control.action === 'run') {
    for (const it of w.items) {
      if (!['queued', 'dispatched', 'processing'].includes(it.status)) continue
      if (t >= it.due) {
        const broken = it.url === F.BROKEN_URL || /broken|404/.test(it.url)
        it.status = broken ? 'error' : 'ingested'
        it.attempts += 1
        it.error = broken ? { message: 'The page answered 404 (not found).', stage: 'fetch' } : null
        it.updatedAt = iso(t)
      } else if (t >= it.due - 2_500 && it.status !== 'processing') {
        it.status = 'processing'
        it.updatedAt = iso(t)
      }
    }
  }
  if (w.syncKey && t >= w.syncUntil) {
    const l = w.journal.find((j) => j.key === w.syncKey)
    applySync(w, w.syncArgs)
    if (l) {
      l.status = 'ok'
      l.updatedAt = iso(t)
      l.data.finishedAt = iso(t)
      l.data.result = { summary: 'agent main updated' }
    }
    w.syncKey = null
  }
  const b = w.bench
  if (b && b.status === 'running') {
    b.updatedAt = iso(t)
    if (t >= b.endAt) b.status = 'completed'
  }
}

/* ------------------------------ readings ------------------------------ */

const ADMIN_ROLES = ['owner', 'admin']
const CONTROL_ROLES = ['owner', 'admin', 'editor', 'control']
const me = (w: World) => ({ id: 'user-1', email: F.OPERATOR, role: w.role, canControl: CONTROL_ROLES.includes(w.role), canAdmin: ADMIN_ROLES.includes(w.role) })

function effectiveUrls(w: World, key: string): string[] {
  const o = w.overlay[key]
  const base = (w.delivered[key] || []).filter((u) => !(o?.removed || []).includes(u))
  return [...base, ...(o?.added || []).map(String).filter((u) => !base.includes(u))]
}

const paramOf = (type: string) => (type === 'files' ? 'files' : 'urls')

function effectiveSources(w: World) {
  return F.SOURCES.map((s) => {
    const param = paramOf(s.type)
    const o = w.overlay[s.key]
    return {
      key: s.key,
      type: s.type,
      target: s.target,
      label: s.label,
      params: { [param]: effectiveUrls(w, s.key) },
      overlay: o ? { ...o, param, baseHash: hash16(JSON.stringify(F.SOURCES.find((x) => x.key === s.key)?.urls)) } : null,
      delivered: { param, items: [...(w.delivered[s.key] || [])], hash: hash16(JSON.stringify(w.delivered[s.key] || [])) },
    }
  })
}

function benchTotals(w: World) {
  const b = w.bench
  if (!b) return null
  const frac = b.status === 'completed' ? 1 : b.status === 'running' ? Math.max(0, Math.min(1, 1 - (b.endAt - now()) / 45_000)) : Math.max(0, Math.min(1, 1 - (b.remaining || 0) / 45_000))
  const done = Math.round(b.total * frac)
  const passed = Math.round(done * 0.85)
  const errored = b.status === 'completed' ? 1 : 0
  return { total: b.total, pending: b.total - done, inFlight: b.status === 'running' && done < b.total ? 2 : 0, done: done - errored, passed, failed: done - passed - errored, errored }
}

function benchAgents(w: World) {
  const t = benchTotals(w)
  if (!t || !w.bench) return {}
  if (w.bench.status === 'completed') return F.BENCH_AGENTS
  const half = Math.round(t.done / 2)
  return Object.fromEntries(Object.entries(F.BENCH_AGENTS).map(([k, a]) => [k, { ...a, completed: half, status: w.bench!.status, score: half ? a.score : undefined }]))
}

function statusReport(w: World) {
  tick(w)
  const count = (st: string) => w.items.filter((i) => i.status === st).length
  return {
    knowledgeBases: F.KBS.map((k) => {
      const id = w.kbs[k.key]
      const its = w.items.filter((i) => F.SOURCES.find((s) => s.key === i.source)?.target === k.key)
      const docs = F.DOCUMENTS.filter((d) => d.kb === k.key && w.docs[d.key]).length
      const completed = its.filter((i) => i.status === 'ingested').length + k.baseline + docs
      const inProgress = its.filter((i) => i.status === 'processing').length
      const failed = its.filter((i) => i.status === 'error').length
      return { key: k.key, id, name: k.name, document_counts: id ? { completed, in_progress: inProgress, failed, total: completed + inProgress + failed } : null }
    }),
    agents: [
      { key: F.MAIN, id: w.agent.exists ? 'agt_main_01' : null, status: w.agent.exists ? 'published' : null, published: w.agent.exists, publishedAt: w.agent.exists ? w.agent.publishedAt : undefined, hasDraftChanges: w.agent.sync === 'drift', model: w.agent.sync === 'in-sync' ? 'model-advanced' : 'model-standard', optional: false, variantOf: null },
      { key: F.VARIANT, id: w.agent.exists ? 'agt_next_01' : null, status: w.agent.exists ? 'published' : null, published: w.agent.exists, publishedAt: w.agent.exists ? ago(60 * 24 * 3) : undefined, hasDraftChanges: false, model: 'model-advanced', optional: true, variantOf: F.MAIN },
    ],
    documents: F.DOCUMENTS.map((d) => ({ key: d.key, kb: d.kb, hash: w.docs[d.key] ? d.hash : undefined, lines: w.docs[d.key] ? d.lines : undefined, uploadedAt: w.docs[d.key] || undefined })),
    sources: F.SOURCES.map((s) => ({ key: s.key, type: s.type, target: s.target, lastRefresh: w.lastRefresh[s.key] })),
    ingest: {
      queued: count('queued'),
      dispatched: count('dispatched'),
      processing: count('processing'),
      ingested: count('ingested'),
      error: count('error'),
      cancelled: count('cancelled'),
      removed: count('removed'),
      inFlight: count('processing') + count('dispatched'),
      phase: w.control.action === 'suspend' ? 'suspended' : w.control.action === 'stop' ? 'stopped' : count('queued') + count('processing') ? 'running' : 'idle',
      control: w.control,
      failed: w.items.filter((i) => i.status === 'error').map((i) => ({ source: i.source, id: i.id, name: i.name, url: i.url, error: i.error || undefined, attempts: i.attempts })),
    },
    cases: w.cases ? { count: w.cases, loadedAt: ago(60 * 24 * 2) } : null,
    benchmark: w.bench ? { key: `bench:${w.bench.id}`, benchId: w.bench.id, status: w.bench.status, startedAt: w.bench.startedAt, updatedAt: w.bench.updatedAt, totals: benchTotals(w), agents: benchAgents(w) } : null,
  }
}

function syncOf(w: World): { wouldDo: string; reason?: string; summary: string } {
  switch (w.agent.sync) {
    case 'in-sync':
      return { wouldDo: 'update', reason: 'in-sync', summary: 'live = expected' }
    case 'workspace-changed':
      return { wouldDo: 'update', reason: 'workspace-changed', summary: 'instructions, tools, skills, model, limits' }
    case 'drift':
      return { wouldDo: 'drift', reason: 'edited-outside-workspace', summary: 'instructions, tools edited in Agent Factory' }
    default:
      return { wouldDo: 'create', reason: 'not-found', summary: 'agent not found' }
  }
}

function agentsSync(w: World) {
  const s = syncOf(w)
  return [
    { key: F.MAIN, name: F.AGENT_NAMES[F.MAIN], optional: false, variantOf: null, id: w.agent.exists ? 'agt_main_01' : null, ...s, publishedAt: w.agent.exists ? w.agent.publishedAt : undefined, hasDraftChanges: w.agent.sync === 'drift', status: w.agent.exists ? 'published' : null },
    { key: F.VARIANT, name: F.AGENT_NAMES[F.VARIANT], optional: true, variantOf: F.MAIN, id: w.agent.exists ? 'agt_next_01' : null, wouldDo: 'optional', summary: 'synced only when named', publishedAt: undefined, hasDraftChanges: false, status: w.agent.exists ? 'published' : null },
  ]
}

function describeAgent(w: World, key: string) {
  const s = key === F.MAIN ? syncOf(w) : { wouldDo: 'optional', summary: 'synced only when named' }
  const diff = key !== F.MAIN || !w.agent.exists ? null : w.agent.sync === 'workspace-changed' ? F.UPDATE_DIFF : w.agent.sync === 'drift' ? F.DRIFT_DIFF : { fields: {}, instructions: { same: true, fromLength: 7415, toLength: 7415, changes: [] }, tools: { added: [], removed: [], renamed: [], changed: [] }, skills: { added: [], removed: [], changed: [] }, subAgents: { added: [], removed: [], changed: [] } }
  return {
    key,
    name: F.AGENT_NAMES[key],
    optional: key !== F.MAIN,
    variantOf: key === F.MAIN ? null : F.MAIN,
    resolution: { by: w.agent.exists ? 'cached' : 'notFound', id: w.agent.exists ? (key === F.MAIN ? 'agt_main_01' : 'agt_next_01') : null },
    live: w.agent.exists ? { id: 'agt_main_01', model: w.agent.sync === 'in-sync' ? 'model-advanced' : 'model-standard', status: 'published', publishedAt: w.agent.publishedAt, hasDraftChanges: w.agent.sync === 'drift', tools: ['kb_docs', 'memory'] } : null,
    expected: {},
    diff,
    syncAll: s,
  }
}

/* ------------------------------ sync ------------------------------ */

function plan(w: World, force: boolean): { actions: SyncAction[]; warnings: string[]; drifted: string[]; summary: string[] } {
  const actions: SyncAction[] = []
  for (const k of F.KBS) {
    const id = w.kbs[k.key]
    actions.push({ type: 'kb', key: k.key, action: id ? 'exists' : k.create ? 'would-create' : 'unbound', id })
  }
  for (const d of F.DOCUMENTS) {
    actions.push({ type: 'kbdoc', key: d.key, action: !w.docs[d.key] || w.agent.sync === 'workspace-changed' ? 'would-upload' : 'unchanged', lines: d.lines })
  }
  const a = w.agent.sync
  if (a === 'create') actions.push({ type: 'agent', key: F.MAIN, action: 'would-create', missing: [], plan: { mode: 'create', same: false, skippedTools: ['kb_archives'] } })
  else if (a === 'in-sync') actions.push({ type: 'agent', key: F.MAIN, action: 'unchanged', id: 'agt_main_01', plan: { mode: 'update', same: true } })
  else if (a === 'workspace-changed') actions.push({ type: 'agent', key: F.MAIN, action: 'would-update', id: 'agt_main_01', plan: F.UPDATE_PLAN })
  else actions.push({ type: 'agent', key: F.MAIN, action: force ? 'would-update' : 'drift', id: 'agt_main_01', forced: force, drift: { reason: 'edited-outside-workspace', changes: ['instructions', 'tools'], summary: 'live differs from the last applied fingerprint' }, plan: F.DRIFT_PLAN })
  return {
    actions,
    warnings: ['tool kb_archives skipped: knowledge base kb-archives is not bound on this environment'],
    drifted: a === 'drift' && !force ? [F.MAIN] : [],
    summary: [`${actions.filter((x) => x.action.startsWith('would-')).length} change(s) planned`],
  }
}

function applySync(w: World, args: Dict) {
  for (const k of F.KBS) if (!w.kbs[k.key] && k.create) w.kbs[k.key] = `kb_${k.key}_01`
  for (const d of F.DOCUMENTS) w.docs[d.key] = iso()
  if (w.agent.sync !== 'drift' || args.force) w.agent = { exists: true, sync: 'in-sync', publishedAt: iso() }
  if (!w.cases) w.cases = F.CASES
  if (!args.skipIngest) for (const s of F.SOURCES) if (s.type === 'urls') refreshSource(w, s.key, [])
}

function refreshSource(w: World, key: string, requeue: string[]): Dict {
  const urls = effectiveUrls(w, key)
  const t = now()
  let queued = 0
  let skipped = 0
  let slot = 0
  for (const url of urls) {
    const it = w.items.find((i) => i.source === key && i.url === url)
    if (!it) {
      w.items.push(makeItem(key, url, 'queued', t + 3_000 + slot++ * 2_500))
      queued++
    } else if (it.status === 'error' || it.status === 'cancelled' || it.status === 'removed' || requeue.includes(it.id)) {
      if (it.status === 'ingested') continue
      it.status = 'queued'
      it.error = null
      it.due = t + 3_000 + slot++ * 2_500
      it.updatedAt = iso(t)
      queued++
    } else skipped++
  }
  let removed = 0
  for (const it of w.items) {
    if (it.source === key && !urls.includes(it.url) && it.status !== 'removed') {
      it.status = 'removed'
      removed++
    }
  }
  const r = { startedAt: iso(t), finishedAt: iso(t + 1_500), discovered: urls.length, queued, skipped, removed, failed: 0 }
  w.lastRefresh[key] = r
  return r
}

/* ------------------------------ endpoints ------------------------------ */

type Res = { status: number; body: unknown }
const ok = (body: unknown): Res => ({ status: 200, body })
const fail = (status: number, error: string, message: string): Res => ({ status, body: { error, message } })

const READ_ONLY = (action: string, args: Dict) => action === 'describeInstance' || action === 'benchmarkReport' || action === 'advanceBenchmark' || action === 'pumpIngest' || (action === 'syncAll' && !!args.dryRun) || (action === 'refreshSource' && !!args.dryRun) || (action === 'exportBenchmark' && !!args.last)
const ADMIN_ONLY = (action: string, args: Dict) => (action === 'syncAll' && !!args.force) || (action === 'runBenchmark' && !!args.force) || (action === 'controlIngest' && args.action === 'stop') || (action === 'refreshSource' && !!args.prune && !args.dryRun) || (action === 'controlBenchmark' && args.action === 'abandon')
const ALLOWED = ['syncAll', 'describeInstance', 'refreshSource', 'controlIngest', 'pumpIngest', 'importCases', 'runBenchmark', 'advanceBenchmark', 'controlBenchmark', 'benchmarkReport', 'exportBenchmark']

async function action(w: World, name: string, args: Dict): Promise<Res> {
  if (!ALLOWED.includes(name)) return ok({ action: name, ok: false, error: 'InvalidAction', message: `${name} is not in the console allow-list`, journalKey: null, result: null })
  const jl = READ_ONLY(name, args) ? null : journal(w, name, args, 'running', null)
  const done = (result: Dict, error?: string, message?: string): Res => {
    if (jl) {
      jl.status = error ? 'error' : 'ok'
      jl.updatedAt = iso()
      jl.data.finishedAt = iso()
      jl.data.result = error ? { error, message } : { summary: summarise(name, result) }
    }
    return ok({ action: name, ok: !error, error: error || null, message: message || null, journalKey: jl?.key || null, result })
  }
  tick(w)
  // Like the workspace: the automation refuses an admin-only action itself, consoleAction relays it.
  if (ADMIN_ONLY(name, args) && !me(w).canAdmin) return done({ error: 'AdminRequired' }, 'AdminRequired', `${name} needs an admin role`)
  switch (name) {
    case 'syncAll': {
      if (args.dryRun) {
        await sleep(1_200)
        return done({ dryRun: true, ...plan(w, !!args.force) })
      }
      if (w.syncKey) return done({}, 'SyncActionFailed', 'agent main: SourceRefreshRunning')
      const p = plan(w, !!args.force)
      w.syncKey = jl!.key
      w.syncArgs = args
      w.syncUntil = now() + (w.slow ? 55_000 : 2_500)
      await sleep(w.slow ? 55_000 : 2_600)
      tick(w)
      const actions = p.actions.map((a) => ({ ...a, action: a.action === 'would-create' ? 'created' : a.action === 'would-update' ? 'updated' : a.action === 'would-upload' ? 'uploaded' : a.action }))
      return done({ dryRun: false, actions, warnings: p.warnings, drifted: p.drifted, summary: p.summary })
    }
    case 'describeInstance':
      await sleep(900)
      return done({ instance: { workspace: 'demo', caller: F.OPERATOR, date: iso() }, agents: [describeAgent(w, F.MAIN), describeAgent(w, F.VARIANT)], knowledgeBases: F.KBS.map((k) => ({ key: k.key, id: w.kbs[k.key], by: w.kbs[k.key] ? 'cached' : 'notFound', name: k.name })), file: args.upload ? { name: 'describe-instance.json', url: dataUrl('application/json', JSON.stringify({ agents: [describeAgent(w, F.MAIN)] }, null, 2)) } : undefined })
    case 'refreshSource': {
      const key = String(args.source || '')
      const s = F.SOURCES.find((x) => x.key === key)
      if (!s) return done({}, 'SourceNotConfigured', `source ${key} is not declared`)
      if (!w.kbs[s.target]) return done({}, 'KnowledgeBaseNotFound', `knowledge base ${s.target} does not exist`)
      await sleep(800)
      return done(refreshSource(w, key, (args.requeue as string[]) || []))
    }
    case 'controlIngest': {
      const a = String(args.action)
      if (!['suspend', 'resume', 'stop'].includes(a)) return done({}, 'InvalidAction', `controlIngest ${a}`)
      w.control = { action: a === 'resume' ? 'run' : (a as 'suspend' | 'stop'), reason: String(args.reason || ''), by: F.OPERATOR, at: iso() }
      let cancelled = 0
      if (a === 'stop') {
        for (const it of w.items) {
          if (it.status !== 'queued') continue
          it.status = 'cancelled'
          cancelled++
        }
      }
      if (a === 'resume') {
        w.items
          .filter((i) => i.status === 'queued' || i.status === 'processing')
          .forEach((it, i) => {
            it.status = 'queued'
            it.due = now() + 3_000 + i * 2_500
          })
      }
      return done({ control: w.control, cancelled })
    }
    case 'importCases':
      w.cases = F.CASES
      return done({ count: F.CASES, hash: 'c41f0e9a7b2d5c38', source: 'config', imported: F.CASES, warnings: [] })
    case 'runBenchmark':
      if (!w.cases) return done({}, 'NoCaseLoaded', 'no case loaded')
      if (w.bench?.status === 'running') return done({}, 'BenchmarkRunning', 'a benchmark is running')
      w.bench = { id: `b-${String(Date.now()).slice(-4)}`, status: 'running', startedAt: iso(), updatedAt: iso(), endAt: now() + 45_000, total: (Number(args.limit) || w.cases) * 2 }
      return done({ benchId: w.bench.id, queued: w.bench.total, status: 'running', byAgent: { [F.MAIN]: w.bench.total / 2, [F.VARIANT]: w.bench.total / 2 }, started: 2, totals: benchTotals(w), warnings: [] })
    case 'pumpIngest':
      tick(w)
      return done({ dispatched: 0 })
    case 'advanceBenchmark':
      if (w.bench?.status === 'running') w.bench.endAt -= 8_000
      tick(w)
      return done({ status: w.bench?.status || null })
    case 'controlBenchmark': {
      const b = w.bench
      if (!b) return done({}, 'BenchmarkBusy', 'no benchmark')
      const a = String(args.action)
      // pause and stop both leave the bench « interrupted » (the batch in flight is collected or cancelled).
      if (a === 'pause' && b.status === 'running') {
        b.status = 'interrupted'
        b.remaining = b.endAt - now()
      } else if (a === 'resume' && b.status === 'interrupted') {
        b.status = 'running'
        b.endAt = now() + (b.remaining ?? 20_000)
      } else if (a === 'stop') {
        b.status = 'interrupted'
        b.remaining = Math.max(0, b.endAt - now())
      } else if (a === 'abandon') b.status = 'abandoned'
      b.updatedAt = iso()
      return done({ action: a, benchId: b.id, status: b.status, control: { status: a === 'pause' || a === 'stop' ? a : 'run', data: { action: a, benchId: b.id, by: F.OPERATOR, at: iso() } } })
    }
    case 'benchmarkReport':
      await sleep(400)
      return done({ benchId: w.bench?.id, status: w.bench?.status, totals: benchTotals(w), agents: benchAgents(w), comparisons: [], worst: w.bench?.status === 'completed' ? F.WORST : [] })
    case 'exportBenchmark': {
      const rows = F.WORST.map((x) => JSON.stringify({ caseId: x.caseId, agent: x.agent, question: '…', answer: '…', expected: '…', score: x.score, reasons: x.reasons }))
      if (!w.bench) return done({}, 'BenchmarkNotFound', 'no benchmark')
      return done({ benchId: w.bench.id, file: { name: `bench-${w.bench.id}.jsonl`, id: `file_${w.bench.id}`, url: dataUrl('application/x-ndjson', rows.join('\n')) }, counts: { records: rows.length } })
    }
  }
  return done({}, 'InvalidAction', name)
}

function summarise(name: string, r: Dict): string {
  if (name === 'syncAll') return `${((r.actions as SyncAction[]) || []).filter((a) => ['created', 'updated', 'uploaded'].includes(a.action)).length} change(s) applied`
  if (name === 'refreshSource') return `${r.discovered ?? 0} found · ${r.queued ?? 0} queued · ${r.removed ?? 0} removed`
  if (name === 'runBenchmark') return `bench ${r.benchId} · ${r.queued} cases queued`
  if (name === 'controlIngest' || name === 'controlBenchmark') return `${(r.control as Dict)?.action || r.status || ''}`
  if (name === 'importCases') return `${r.count} cases`
  return ''
}

const dataUrl = (mime: string, text: string) => `data:${mime};charset=utf-8,${encodeURIComponent(text)}`

function yamlOf(w: World, key: string): string {
  const s = F.SOURCES.find((x) => x.key === key)!
  return [`      - key: ${s.key}`, `        type: ${s.type}`, `        target: ${s.target}`, `        label: ${s.label}`, '        params:', '          urls:', ...effectiveUrls(w, key).map((u) => `            - ${u}`)].join('\n')
}

async function sources(w: World, body: Dict): Promise<Res> {
  const op = String(body.op || '')
  const key = String(body.source || '')
  const s = F.SOURCES.find((x) => x.key === key)
  if (op === 'list') return ok({ sources: effectiveSources(w) })
  if (!s) return fail(404, 'SourceNotConfigured', `source ${key} is not declared`)
  const add = ((body.add as string[]) || []).map(String)
  const remove = ((body.remove as string[]) || []).map(String)
  tick(w)
  switch (op) {
    case 'preview': {
      if (!w.kbs[s.target]) return fail(409, 'KnowledgeBaseNotFound', `knowledge base ${s.target} does not exist`)
      await sleep(700)
      const cur = effectiveUrls(w, key)
      const next = [...cur.filter((u) => !remove.includes(u)), ...add.filter((u) => !cur.includes(u))]
      const known = (u: string) => w.items.find((i) => i.source === key && i.url === u && i.status === 'ingested')
      const toQueue = next.filter((u) => !known(u))
      const items = [
        ...next.map((u) => ({ id: hash16(u), name: nameOf(u), url: u, status: known(u) ? 'ingested' : w.items.find((i) => i.url === u)?.status, action: known(u) ? 'ingested' : w.items.some((i) => i.url === u && i.status === 'error') ? 'requeue' : 'queue' })),
        ...remove.map((u) => ({ id: hash16(u), name: nameOf(u), url: u, status: 'ingested', action: 'remove' })),
      ]
      return ok({ discovered: next.length, toQueue: toQueue.length, alreadyIngested: next.length - toQueue.length, toRemove: remove.length, toPrune: 0, skipped: 0, items: items.slice(0, 50), failed: [], warnings: [], overlay: { added: add, removed: remove } })
    }
    case 'save': {
      if (!add.length && !remove.length) return fail(400, 'NothingToSave', 'no change')
      if (!me(w).canControl) return fail(403, 'Forbidden', 'control role needed')
      const o: SourceOverlay = w.overlay[key] || { added: [], removed: [], by: F.OPERATOR, at: iso(), baseChanged: false }
      const delivered = w.delivered[key]
      let added = o.added.map(String).filter((u) => !remove.includes(u))
      added = [...added, ...add.filter((u) => !delivered.includes(u) && !added.includes(u))]
      const removed = [...o.removed.map(String).filter((u) => !add.includes(u)), ...remove.filter((u) => delivered.includes(u) && !o.removed.includes(u))]
      w.overlay[key] = added.length || removed.length ? { ...o, added, removed, by: F.OPERATOR, at: iso() } : null
      const jl = journal(w, 'sources.save', { source: key, add, remove }, 'ok', { summary: `${add.length} added · ${remove.length} removed` })
      await sleep(500)
      return ok({ source: key, overlay: w.overlay[key], status: w.overlay[key] ? 'open' : 'cleared', journalKey: jl.key })
    }
    case 'export':
      return ok({ source: key, yaml: yamlOf(w, key), overlay: w.overlay[key] })
    case 'markIntegrated': {
      // First try: git does not have the changes yet (409 NotIntegrated). Next try: the mock plays the delivery.
      const o = w.overlay[key]
      if (o && w.integrateTries++ === 0) return { status: 409, body: { error: 'NotIntegrated', message: 'the delivered list does not contain every change', missing: o.added, stillDelivered: o.removed } }
      w.delivered[key] = effectiveUrls(w, key)
      w.overlay[key] = null
      journal(w, 'sources.markIntegrated', { source: key }, 'ok', { summary: 'overlay dropped' })
      return ok({ ok: true, source: key, integrated: true })
    }
    case 'progress': {
      const ids = (body.ids as string[]) || []
      const urls = ((body.urls as string[]) || []).slice(0, 80)
      const wanted = urls.length ? urls.map((u) => ({ id: hash16(u), url: u })) : ids.slice(0, 80).map((id) => ({ id, url: w.items.find((i) => i.id === id)?.url }))
      return ok({
        items: wanted.map((x) => {
          const it = w.items.find((i) => i.source === key && i.id === x.id)
          return it ? { id: it.id, url: it.url, status: it.status, updatedAt: it.updatedAt, error: it.error || null, attempts: it.attempts } : { id: x.id, url: x.url }
        }),
      })
    }
  }
  return fail(400, 'InvalidOp', `consoleSources ${op}`)
}

async function diff(w: World, body: Dict): Promise<Res> {
  await sleep(800)
  tick(w)
  if (body.part === 'kbs') {
    const st = statusReport(w)
    return ok({
      kbs: F.KBS.map((k) => {
        const id = w.kbs[k.key]
        const fields = id ? [{ field: 'parser', manifest: 'tika', live: 'tika', same: true }, k.key === 'kb-faq' ? { field: 'chunking_strategy', manifest: { max_chunk_size_tokens: 800 }, live: { max_chunk_size_tokens: 1000 }, same: false } : { field: 'chunking_strategy', manifest: { max_chunk_size_tokens: 800 }, live: { max_chunk_size_tokens: 800 }, same: true }] : []
        return { key: k.key, name: k.name, id, by: id ? 'cached' : 'notFound', document_counts: st.knowledgeBases.find((x) => x.key === k.key)?.document_counts || null, settings: id ? { fields, same: fields.every((f) => f.same) } : null }
      }),
      documents: plan(w, false).actions.filter((a) => a.type === 'kbdoc'),
    })
  }
  const keys = ((body.agents as string[]) || []).length ? (body.agents as string[]) : [F.MAIN]
  return ok({ agents: keys.map((k) => describeAgent(w, k)) })
}

function makeMockCall(w: World): MockCall {
  return async (slug, body) => {
    await sleep(200 + Math.random() * 300)
    if (!me(w).canControl) {
      // Like the workspace: every console endpoint, reads included, is guarded by _guard-control (§8).
      return fail(403, 'Forbidden', 'control role needed')
    }
    switch (slug) {
      case 'consoleState': {
        const status = statusReport(w)
        const limit = Number(body.journalLimit) || 30
        const agents = body.withAgents ? (w.agentsError ? [{ error: 'AgentReadFailed', message: 'Agent Factory answered 503' }] : agentsSync(w)) : null
        return ok({ generatedAt: iso(), me: me(w), status, sources: effectiveSources(w), agents, journal: body.withJournal === false ? [] : w.journal.slice(0, limit) })
      }
      case 'consoleAction':
        return action(w, String(body.action || ''), (body.args as Dict) || {})
      case 'consoleSources':
        return sources(w, body)
      case 'consoleDiff':
        return diff(w, body)
      default:
        return fail(404, 'Http404', `no endpoint ${slug}`)
    }
  }
}

/* ------------------------------ host props ------------------------------ */

const SCENARIOS: MockScenario[] = ['ok', 'update', 'install', 'drift', 'running']

export function buildMockProps(): AppProps {
  const q = new URLSearchParams(window.location.search)
  const apiUrl = (import.meta.env.VITE_PRISME_API_URL as string | undefined) || ''
  const apiToken = (import.meta.env.VITE_PRISME_API_KEY as string | undefined) || ''
  const raw = q.get('mock')
  const real = raw === 'off' && !!apiUrl
  const scenario = (SCENARIOS as string[]).includes(raw || '') ? (raw as MockScenario) : CONFIG.mock.scenario
  const role = q.get('role') || 'owner'
  const world = createWorld(scenario, role, q.get('slow') === '1', q.get('agentsError') === '1')
  if (!real) console.info(`[mock] scenario « ${scenario} », role « ${role} » — ?mock=ok|update|install|drift|running, ?role=owner|editor|viewer, ?slow=1`)
  return {
    sdk: {
      host: real ? apiUrl : 'mock://local',
      token: real ? apiToken : undefined,
      mockCall: real ? undefined : makeMockCall(world),
      async streamEvents() {
        return { on: () => () => undefined, emit: () => undefined, close: () => undefined }
      },
    },
    user: { id: 'user-1', email: F.OPERATOR },
    workspace: { id: (import.meta.env.VITE_PRISME_WORKSPACE_ID as string | undefined) || 'local-dev-workspace', slug: 'local-dev', name: real ? 'Workspace' : 'Demo workspace (mock)' },
    backends: {},
  }
}
