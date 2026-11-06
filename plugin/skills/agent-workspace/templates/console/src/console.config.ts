/* ------------------------------------------------------------------ *
 * console.config.ts — EVERYTHING a new workspace edits lives here.
 *
 * The console reads the workspace through the endpoints of DESIGN.md §5.3
 * and only needs words from you: what the agent is called, what each
 * knowledge base, tool, document and source means for its users, which
 * optional views are on. Keys are the manifest keys of index.yml
 * (config.value.knowledgeBases[].key, agents[].tools[].name, documents[].key,
 * sources[].key…), never product ids.
 *
 * Every label is either a string (same in both languages) or { fr, en }.
 * A key you do not list is still shown, with a readable fallback built from
 * its name (« product-docs » → « Product docs »).
 *
 * The values below are PLACEHOLDERS matching the keys of templates/workspace/index.yml
 * (agent main, base kb-docs, tool kb_docs, source docs, document reference) and the
 * local mock (npm run dev): replace them with your workspace's keys and words.
 * ------------------------------------------------------------------ */

export type Label = string | { fr: string; en: string }

export type BuiltinViewKey = 'dashboard' | 'agent' | 'bench' | 'sources' | 'ingestion' | 'journal'

/** A built-in view, or the key of an agent-specific view (src/views/custom/index.tsx). */
export type ViewKey = BuiltinViewKey | (string & {})

export type MockScenario = 'ok' | 'update' | 'install' | 'drift' | 'running'

export interface ConsoleConfig {
  /** Sidebar title, e.g. « Console Assistant documentation ». */
  title: Label
  /** One or two letters shown in the sidebar tile. */
  monogram: string
  /** Name of the agent as its users know it (titles: « <agentName> est à jour »). */
  agentName: Label
  /** Manifest key of the agent the console is about. Default: the first non-optional agent. */
  mainAgent?: string
  /** Language when the URL has no ?lang=. */
  locale: 'fr' | 'en'
  /** Optional views (the dashboard, the agent page and the journal are always on). */
  views: { ingestion: boolean; sources: boolean; bench: boolean }
  /** Navigation: group titles and view labels. */
  nav: {
    groups: { overview: Label; agent: Label; content: Label; tracking: Label }
    labels: Record<BuiltinViewKey, Label>
  }
  /**
   * Knowledge bases, by manifest key. `label` is the noun used in « la base « … » »;
   * `can` says what the base lets the agent do (« citer la documentation produit »),
   * used in « Ce que l'agent ne pourra pas encore faire »; `external: true` for a base
   * filled outside the console (`create: false` in the manifest).
   */
  knowledgeBases: Record<string, { label: Label; can?: Label; external?: boolean }>
  /** Agent tools, by tool name (agents[].tools[].name). `kb` links a tool to its base. */
  tools: Record<string, { label: Label; kb?: string }>
  /** Agent skills, by skill name: what the agent can do with it. */
  skills: Record<string, Label>
  /** Sub-agents and other agents, by manifest key. */
  agents: Record<string, Label>
  /** Reference documents published by the sync, by manifest key. `emptyHint` says how to fill an empty one. */
  documents: Record<string, { label: Label; emptyHint?: Label }>
  /** Sources, by manifest key. `item` is the word for one item (« page », « fichier »). */
  sources: Record<string, { label?: Label; item?: { one: Label; many: Label } }>
  /** Any other dependency an agent can miss, by `<kind>:<key>` (« les données … »). */
  resources: Record<string, Label>
  /** Journal: label of each action (consoleAction names, plus sources.save / sources.markIntegrated). */
  journalActions: Record<string, Label>
  /** Benchmark view: sizes offered (0 = the full case set) and optional tag filters. */
  bench: { sizes: number[]; tags?: { value: string; label: Label }[] }
  /** Local mock (npm run dev): scenario used when the URL has no ?mock=. */
  mock: { scenario: MockScenario }
}

export const CONFIG: ConsoleConfig = {
  title: { fr: 'Console Assistant documentation', en: 'Documentation assistant console' },
  monogram: 'A',
  agentName: { fr: 'Assistant documentation', en: 'Documentation assistant' },
  mainAgent: 'main',
  locale: 'fr',
  views: { ingestion: true, sources: true, bench: true },
  nav: {
    groups: {
      overview: { fr: 'Pilotage', en: 'Overview' },
      agent: { fr: 'Agent', en: 'Agent' },
      content: { fr: 'Contenu', en: 'Content' },
      tracking: { fr: 'Suivi', en: 'Tracking' },
    },
    labels: {
      dashboard: { fr: 'Tableau de bord', en: 'Dashboard' },
      agent: { fr: 'Agent', en: 'Agent' },
      bench: { fr: 'Banc de test', en: 'Benchmark' },
      sources: { fr: 'Sources', en: 'Sources' },
      ingestion: { fr: 'Bases et import', en: 'Bases and import' },
      journal: { fr: 'Historique', en: 'History' },
    },
  },
  knowledgeBases: {
    'kb-docs': { label: { fr: 'Documentation produit', en: 'Product documentation' }, can: { fr: 'citer la documentation produit', en: 'quote the product documentation' } },
    'kb-faq': { label: { fr: 'Questions fréquentes', en: 'Frequently asked questions' }, can: { fr: 'reprendre les réponses de la FAQ', en: 'reuse the FAQ answers' } },
    'kb-archives': { label: { fr: 'Archives', en: 'Archives' }, can: { fr: 'chercher dans les archives', en: 'search the archives' }, external: true },
  },
  tools: {
    kb_docs: { label: { fr: 'recherche dans la documentation produit', en: 'search in the product documentation' }, kb: 'kb-docs' },
    kb_faq: { label: { fr: 'recherche dans la FAQ', en: 'search in the FAQ' }, kb: 'kb-faq' },
    kb_archives: { label: { fr: 'recherche dans les archives', en: 'search in the archives' }, kb: 'kb-archives' },
    memory: { label: { fr: 'mémoire des conversations', en: 'conversation memory' } },
  },
  skills: {
    'summarize-document': { fr: 'résumer un document', en: 'summarize a document' },
    'compare-versions': { fr: 'comparer deux versions', en: 'compare two versions' },
  },
  agents: {
    main: { fr: 'Assistant documentation', en: 'Documentation assistant' },
    'main-next': { fr: 'Assistant documentation (variante)', en: 'Documentation assistant (variant)' },
  },
  documents: {
    reference: { label: { fr: 'Fiche de référence', en: 'Reference sheet' }, emptyHint: { fr: 'Son texte se trouve dans le contenu de l’agent (_content-documents) : rien n’est publié tant qu’il est vide.', en: 'Its text lives in the agent content (_content-documents): nothing is published while it is empty.' } },
  },
  sources: {
    docs: { label: { fr: 'Pages de la documentation', en: 'Documentation pages' }, item: { one: { fr: 'page', en: 'page' }, many: { fr: 'pages', en: 'pages' } } },
    'faq-files': { label: { fr: 'Fichiers de la FAQ', en: 'FAQ files' }, item: { one: { fr: 'fichier', en: 'file' }, many: { fr: 'fichiers', en: 'files' } } },
  },
  resources: {},
  journalActions: {
    syncAll: { fr: 'Synchronisation', en: 'Sync' },
    refreshSource: { fr: 'Passage sur une source', en: 'Source pass' },
    controlIngest: { fr: 'Contrôle de l’import', en: 'Import control' },
    pumpIngest: { fr: 'Relance de la file d’import', en: 'Import queue kick' },
    importCases: { fr: 'Chargement des cas de test', en: 'Test cases loaded' },
    runBenchmark: { fr: 'Lancement d’un banc', en: 'Benchmark start' },
    advanceBenchmark: { fr: 'Avancement du banc', en: 'Benchmark tick' },
    controlBenchmark: { fr: 'Contrôle du banc', en: 'Benchmark control' },
    exportBenchmark: { fr: 'Export du banc', en: 'Benchmark export' },
    describeInstance: { fr: 'Rapport technique', en: 'Technical report' },
    'sources.save': { fr: 'Modification des sources', en: 'Sources change' },
    'sources.markIntegrated': { fr: 'Sources reportées dans git', en: 'Sources carried into git' },
  },
  bench: {
    sizes: [20, 0],
    tags: [],
  },
  mock: { scenario: 'update' },
}
