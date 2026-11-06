/* ------------------------------------------------------------------ *
 * Fixtures of the local mock (npm run dev), following DESIGN.md shapes.
 * A fictional workspace: one agent (« assistant ») answering from a product
 * documentation base (filled from a list of pages, source « docs »), a
 * FAQ base (filled from files, source « faq-files ») with one reference
 * document, and an archives base filled outside the console. Replace nothing
 * here when you copy the template: the mock only serves `npm run dev`.
 * Keys match the placeholders of console.config.ts.
 * ------------------------------------------------------------------ */

import type { AgentDiff, AgentPlan, BenchAgentReport } from '@/lib/types'

export const MAIN = 'main'
export const VARIANT = 'main-next'
export const AGENT_NAMES: Record<string, string> = { [MAIN]: 'demo-assistant', [VARIANT]: 'demo-assistant-next' }

export interface KbDef {
  key: string
  name: string
  create: boolean
  /** Documents present in the base that the mock does not model as items (filled by another source). */
  baseline: number
}

export const KBS: KbDef[] = [
  { key: 'kb-docs', name: 'demo-docs', create: true, baseline: 0 },
  { key: 'kb-faq', name: 'demo-faq', create: true, baseline: 36 },
  { key: 'kb-archives', name: 'demo-archives', create: false, baseline: 0 },
]

export const DOCUMENTS = [{ key: 'reference', kb: 'kb-faq', lines: 128, hash: '9f2c41d07ab35e18' }]

const page = (slug: string) => `https://docs.example.com/guide/${slug}`

export const SOURCES = [
  {
    key: 'docs',
    type: 'urls',
    target: 'kb-docs',
    label: 'Documentation pages',
    urls: ['getting-started', 'installation', 'configuration', 'accounts-and-roles', 'projects', 'sharing', 'notifications', 'exports', 'integrations', 'api-overview', 'troubleshooting', 'legacy-plugin'].map(page),
  },
  { key: 'faq-files', type: 'files', target: 'kb-faq', label: 'FAQ files', urls: ['faq/general.pdf', 'faq/billing.pdf', 'faq/security.pdf'] },
]

/** A delivered page that always fails to import (shows the « Réessayer » path). */
export const BROKEN_URL = page('legacy-plugin')

/** Added from the console in the « update » scenario: shows « À reporter dans git ». */
export const OVERLAY_URL = page('release-notes')

export const OPERATOR = 'operator@example.com'

/* ---------- syncAll dry-run plan of the « update » scenario (§4.3, live → workspace) ---------- */

export const UPDATE_PLAN: AgentPlan = {
  mode: 'update',
  same: false,
  fields: [
    { field: 'model', from: 'model-standard', to: 'model-advanced' },
    { field: 'limits.tool_call_budget', from: 40, to: 30 },
  ],
  instructions: {
    fromLength: 6240,
    toLength: 7415,
    addedLines: 18,
    removedLines: 4,
    lostSections: [],
    firstChanges: [
      { op: '-', line: 12, text: 'Answer in at most five sentences.' },
      { op: '+', line: 12, text: 'Answer in at most five sentences, then list the pages you used.' },
      { op: '+', line: 31, text: '## Comparing versions' },
      { op: '+', line: 32, text: 'When the user asks what changed between two versions, use the compare-versions skill.' },
    ],
  },
  tools: { added: [{ name: 'kb_faq', type: 'knowledge' }], removed: [], replaced: [], changed: [] },
  skills: { added: ['compare-versions'], removed: [], changed: ['summarize-document'] },
  subAgents: { added: [], removed: [], changed: [] },
  skippedTools: ['kb_archives'],
  destructive: ['model changed: model-standard → model-advanced', 'limit lowered: tool_call_budget 40 → 30'],
}

/* ---------- describeInstance diff of the « update » scenario (§4.6, workspace → live) ---------- */

export const UPDATE_DIFF: AgentDiff = {
  fields: { model: { from: 'model-advanced', to: 'model-standard' }, 'limits.tool_call_budget': { from: 30, to: 40 } },
  instructions: {
    same: false,
    fromLength: 7415,
    toLength: 6240,
    changes: [
      { op: '-', line: 12, text: 'Answer in at most five sentences, then list the pages you used.' },
      { op: '-', line: 31, text: '## Comparing versions' },
      { op: '-', line: 32, text: 'When the user asks what changed between two versions, use the compare-versions skill.' },
      { op: '+', line: 12, text: 'Answer in at most five sentences.' },
    ],
  },
  tools: { added: [], removed: [{ name: 'kb_faq', type: 'knowledge' }], renamed: [], changed: [] },
  skills: { added: [], removed: ['compare-versions'], changed: ['summarize-document'] },
  subAgents: { added: [], removed: [], changed: [] },
}

/* ---------- « drift »: the agent was edited by hand in Agent Factory ---------- */

export const DRIFT_PLAN: AgentPlan = {
  mode: 'update',
  same: false,
  fields: [],
  instructions: {
    fromLength: 6610,
    toLength: 6240,
    addedLines: 1,
    removedLines: 3,
    lostSections: [],
    firstChanges: [
      { op: '-', line: 40, text: 'If the question is about an old release, search the archives first.' },
      { op: '-', line: 41, text: 'Quote the archive page title in your answer.' },
    ],
  },
  tools: { added: [], removed: [{ name: 'kb_archives', type: 'knowledge' }], replaced: [], changed: [] },
  skills: { added: [], removed: [], changed: [] },
  subAgents: { added: [], removed: [], changed: [] },
  skippedTools: ['kb_archives'],
  destructive: ['tool removed: kb_archives'],
}

export const DRIFT_DIFF: AgentDiff = {
  fields: {},
  instructions: {
    same: false,
    fromLength: 6240,
    toLength: 6610,
    changes: [
      { op: '+', line: 40, text: 'If the question is about an old release, search the archives first.' },
      { op: '+', line: 41, text: 'Quote the archive page title in your answer.' },
      { op: '+', line: 42, text: '' },
      { op: '-', line: 40, text: 'Never answer about releases older than two years.' },
    ],
  },
  tools: { added: [{ name: 'kb_archives', type: 'knowledge' }], removed: [], renamed: [], changed: [] },
  skills: { added: [], removed: [], changed: [] },
  subAgents: { added: [], removed: [], changed: [] },
}

/* ---------- evaluation (§5.1) ---------- */

export const CASES = 24

export const BENCH_AGENTS: Record<string, BenchAgentReport> = {
  [MAIN]: { score: 4.1, passRate: 0.83, total: 24, completed: 24, errored: 0, status: 'completed' },
  [VARIANT]: { score: 4.4, passRate: 0.88, total: 24, completed: 23, errored: 1, status: 'completed' },
}

export const WORST = [
  { caseId: 'case-007', agent: MAIN, score: 1.5, reasons: ['The answer cites a page that does not cover exports.'] },
  { caseId: 'case-019', agent: MAIN, score: 2, reasons: ['Misses the second step of the procedure.'] },
  { caseId: 'case-011', agent: VARIANT, score: 2.5, reasons: ['Correct but too long.'] },
]
