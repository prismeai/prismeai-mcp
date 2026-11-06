/* Shapes of the workspace answers the console reads — DESIGN.md §4.3 (sync
 * actions and plans), §4.6 (describe / diff), §4.7 (statusReport), §5.1–5.3
 * (bench, ingestion, console endpoints), §7 (overlay). Only the fields the
 * views use are typed; everything is optional because an empty workspace
 * answers with nulls. */

export type Dict = Record<string, unknown>

/* ---------------- statusReport (§4.7) ---------------- */

export interface DocCounts {
  completed?: number
  in_progress?: number
  failed?: number
  total?: number
  [k: string]: number | undefined
}

export interface KbStatus {
  key: string
  id: string | null
  name?: string
  document_counts: DocCounts | null
}

export interface AgentStatus {
  key: string
  id: string | null
  status?: string | null
  published?: boolean
  publishedAt?: string
  hasDraftChanges?: boolean
  model?: string
  optional?: boolean
  variantOf?: string | null
}

export interface DocumentStatus {
  key: string
  kb: string
  hash?: string
  lines?: number
  uploadedAt?: string
}

export interface LastRefresh {
  startedAt?: string
  finishedAt?: string
  discovered?: number
  queued?: number
  skipped?: number
  removed?: number
  failed?: number | unknown[]
}

export interface SourceStatus {
  key: string
  type: string
  target: string
  lastRefresh: LastRefresh | null
}

export interface FailedItem {
  source: string
  id: string
  name?: string
  url?: string
  error?: { message?: string; stage?: string }
  attempts?: number
}

export interface IngestControl {
  action?: 'run' | 'suspend' | 'stop'
  reason?: string
  by?: string
  at?: string
  source?: string | null
}

export interface IngestStatus {
  queued?: number
  dispatched?: number
  processing?: number
  ingested?: number
  error?: number
  cancelled?: number
  removed?: number
  inFlight?: number
  phase?: 'idle' | 'running' | 'suspended' | 'stopped' | string
  control?: IngestControl
  failed?: FailedItem[]
}

export interface BenchAgentReport {
  score?: number
  passRate?: number
  total?: number
  completed?: number
  errored?: number
  status?: string
}

export interface BenchTotals {
  total?: number
  pending?: number
  inFlight?: number
  done?: number
  passed?: number
  failed?: number
  errored?: number
  cancelled?: number
}

export interface BenchmarkStatus {
  key?: string
  benchId?: string
  status?: 'running' | 'completed' | 'interrupted' | 'failed' | 'abandoned' | string
  startedAt?: string
  updatedAt?: string
  totals?: BenchTotals
  agents?: Record<string, BenchAgentReport>
  /** Last error Agent Evaluations reported for a batch run (statusReport). */
  lastRunError?: { agentKey?: string; runId?: string; message?: string; at?: string } | null
}

export interface StatusReport {
  knowledgeBases?: KbStatus[]
  agents?: AgentStatus[]
  documents?: DocumentStatus[]
  sources?: SourceStatus[]
  ingest?: IngestStatus
  cases?: { count?: number; loadedAt?: string } | null
  benchmark?: BenchmarkStatus | null
}

/* ---------------- consoleState (§5.3) ---------------- */

/** An overlay item: a string (an URL for `urls` sources) or an object carrying it. */
export type OverlayItem = string | { url?: string; id?: string; name?: string }

export interface SourceOverlay {
  added: OverlayItem[]
  removed: OverlayItem[]
  by?: string
  at?: string
  /** Hash of the delivered entry when the overlay was first written (§7). */
  baseHash?: string
  /** The overlaid list: params.<param> (urls for an `urls` source). */
  param?: string
  /** The delivered entry changed since the overlay was written (null when the workspace cannot tell). */
  baseChanged?: boolean | null
}

export interface ConsoleSource {
  key: string
  type: string
  target: string
  label?: string
  params: { urls?: string[]; [k: string]: unknown }
  overlay: SourceOverlay | null
  /** The list as delivered by git (consoleState only). */
  delivered?: { param?: string; items?: OverlayItem[]; hash?: string } | null
}

/** consoleState.agents entry. A failed describe gives a single {error, message} entry (no key). */
export interface AgentSync {
  key: string
  name?: string
  optional?: boolean
  variantOf?: string | null
  id?: string | null
  wouldDo?: 'create' | 'update' | 'drift' | 'failed' | 'optional' | string
  reason?: 'in-sync' | 'workspace-changed' | 'no-baseline' | 'edited-outside-workspace' | 'not-found' | string
  summary?: string
  publishedAt?: string
  hasDraftChanges?: boolean
  status?: string
  /** Missing dependencies of a `failed` agent (`kb:<key>`…); else parsed from summary « (missing: …) ». */
  missing?: string[]
  error?: string
  message?: string
}

export interface JournalLine {
  key: string
  status: 'running' | 'ok' | 'error' | string
  updatedAt: string
  data: {
    action?: string
    args?: Dict
    by?: { id?: string; email?: string; role?: string }
    startedAt?: string
    finishedAt?: string
    correlationId?: string
    result?: Dict | null
  }
}

export interface ConsoleState {
  generatedAt: string
  me: { id: string; email?: string; role?: string; canControl: boolean; canAdmin: boolean }
  status: StatusReport
  sources: ConsoleSource[]
  agents: AgentSync[] | null
  journal: JournalLine[]
}

export interface ActionAnswer<R = Dict> {
  action: string
  ok: boolean
  error?: string | null
  message?: string | null
  journalKey?: string | null
  result: R
}

/* ---------------- syncAll actions and plans (§4.3–4.5) ---------------- */

export interface LineChange {
  op: '+' | '-'
  line: number
  text: string
}

export interface NamedRef {
  name: string
  type?: string
}

export interface AgentPlan {
  mode?: 'create' | 'update'
  same?: boolean
  fields?: { field: string; from: unknown; to: unknown }[]
  instructions?: { fromLength?: number; toLength?: number; addedLines?: number; removedLines?: number; lostSections?: string[]; firstChanges?: LineChange[] }
  tools?: { added?: NamedRef[]; removed?: NamedRef[]; replaced?: { from: NamedRef; to: NamedRef }[]; changed?: NamedRef[] }
  skills?: { added?: (string | NamedRef)[]; removed?: (string | NamedRef)[]; changed?: (string | NamedRef)[] }
  subAgents?: { added?: (string | NamedRef)[]; removed?: (string | NamedRef)[]; changed?: (string | NamedRef)[] }
  skippedTools?: (string | NamedRef)[]
  destructive?: string[]
}

export interface SyncAction {
  type: 'agent' | 'kb' | 'kbdoc' | 'source' | string
  key: string
  action: string
  id?: string | null
  forced?: boolean
  missing?: string[]
  error?: string
  reason?: string
  lines?: number
  drift?: { reason?: string; changes?: string[]; summary?: string }
  plan?: AgentPlan
}

export interface SyncResult {
  dryRun?: boolean
  actions?: SyncAction[]
  warnings?: string[]
  drifted?: string[]
  summary?: string[]
}

/* ---------------- describeInstance / consoleDiff (§4.6, §5.3) ---------------- */

export interface AgentDiff {
  fields?: Record<string, { from?: unknown; to?: unknown }>
  instructions?: { same?: boolean; fromLength?: number; toLength?: number; changes?: LineChange[] }
  tools?: { added?: NamedRef[]; removed?: NamedRef[]; renamed?: { from: string; to: string }[]; changed?: (NamedRef & { fields?: string[] })[] }
  skills?: { added?: (string | NamedRef)[]; removed?: (string | NamedRef)[]; changed?: (string | NamedRef)[] } | null
  subAgents?: { added?: (string | NamedRef)[]; removed?: (string | NamedRef)[]; changed?: (string | NamedRef)[] } | null
}

export interface AgentRow {
  key: string
  name?: string
  optional?: boolean
  variantOf?: string | null
  resolution?: { by?: string; id?: string | null }
  live?: { id?: string; model?: string; status?: string; publishedAt?: string; hasDraftChanges?: boolean } | null
  syncAll?: { wouldDo?: string; reason?: string; summary?: string } | null
  diff?: AgentDiff | null
}

export interface KbRow {
  key: string
  name?: string
  id?: string | null
  by?: string
  document_counts?: DocCounts | null
  settings?: { same: boolean; fields: { field: string; manifest: unknown; live: unknown; same: boolean }[] } | null
}

export interface KbAnswer {
  kbs: KbRow[]
  documents: SyncAction[]
}

/* ---------------- sources (§5.2, §5.3) ---------------- */

export interface PreviewItem {
  id?: string
  url?: string
  name?: string
  status?: string
  action?: 'queue' | 'requeue' | 'ingested' | 'queued' | 'inFlight' | 'remove' | string
}

/** refreshSource dry run. Counts may come as numbers or as lists. */
export interface RefreshPreview {
  discovered?: number | PreviewItem[]
  toQueue?: number | PreviewItem[]
  alreadyIngested?: number | PreviewItem[]
  toRemove?: number | PreviewItem[]
  toPrune?: number | PreviewItem[]
  skipped?: number | PreviewItem[]
  items?: PreviewItem[]
  failed?: number | { ref?: string; error?: unknown }[]
  warnings?: string[]
  overlay?: SourceOverlay | null
}

export interface ProgressItem {
  id: string
  url?: string
  status?: 'queued' | 'dispatched' | 'processing' | 'ingested' | 'error' | 'cancelled' | 'removed' | string
  updatedAt?: string
  error?: { message?: string; stage?: string } | string | null
  attempts?: number
}

/* ---------------- evaluation (§5.1) ---------------- */

export interface BenchReport {
  benchId?: string
  status?: string
  totals?: BenchTotals
  agents?: Record<string, BenchAgentReport>
  comparisons?: Dict[] | Dict
  worst?: { caseId: string; agent: string; score?: number; reasons?: string | string[] }[]
}
