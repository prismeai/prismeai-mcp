import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CONFIG } from '@/console.config'
import { journalRunning, useConsole } from '@/lib/console'
import { block, first, roleBlock } from '@/lib/blockers'
import { dateTime, errorTechnical, errorText, lb, num, tr } from '@/lib/i18n'
import { itemsWord, kbName, sourceLabel } from '@/lib/labels'
import { type Go, viewLabel, viewOn } from '@/lib/nav'
import type { ActionAnswer, ConsoleSource, OverlayItem, ProgressItem, RefreshPreview } from '@/lib/types'
import { Banner, Btn, Confirm, Dot, Empty, Help, inputClass, Mono, PageHeader, Panel, Segmented, Spinner, Table, Td, textareaClass, type Tone } from '@/components/kit'

/* ------------------------------------------------------------------ *
 * Sources: the generic editor of `urls` sources over git (DESIGN.md §7).
 * The operator adds or removes addresses; the console previews the effect
 * on its own (consoleSources preview = refreshSource dry run), saves the
 * overlay (consoleSources save), starts the import (refreshSource) and
 * follows each added address (consoleSources progress). While an overlay
 * exists, « À reporter dans git » exports the YAML of the entry and
 * markIntegrated drops it once the delivered version contains it.
 * ------------------------------------------------------------------ */

const ref = (x: OverlayItem): string => (typeof x === 'string' ? x : x.url || x.id || x.name || '')
const count = (v: number | unknown[] | undefined): number => (Array.isArray(v) ? v.length : typeof v === 'number' ? v : 0)
const isUrl = (s: string) => /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(s)
const FINAL = ['ingested', 'error', 'cancelled', 'removed']

function progressLabel(p: ProgressItem | undefined): { label: string; tone: Tone } {
  switch (p?.status) {
    case undefined:
    case null:
    case '':
      return { label: tr('pas encore en file', 'not queued yet'), tone: 'muted' }
    case 'queued':
      return { label: tr('en file', 'queued'), tone: 'info' }
    case 'dispatched':
    case 'processing':
      return { label: tr('en cours d’import', 'importing'), tone: 'info' }
    case 'ingested':
      return { label: tr('consultable par l’agent', 'searchable by the agent'), tone: 'ok' }
    case 'error':
      return { label: tr('échec de l’import', 'import failed'), tone: 'bad' }
    case 'cancelled':
      return { label: tr('annulé', 'cancelled'), tone: 'muted' }
    default:
      return { label: p?.status || '—', tone: 'muted' }
  }
}

interface FollowState {
  source: string
  urls: string[]
  since: number
}

export default function Sources({ go }: { go: Go }) {
  const { state, busy, post, call, refresh, notify, memo, follow } = useConsole()
  const editable = (state?.sources || []).filter((s) => s.type === 'urls')
  const others = (state?.sources || []).filter((s) => s.type !== 'urls')
  const [srcKey, setSrcKey] = useState<string>(editable[0]?.key || '')
  const src: ConsoleSource | undefined = editable.find((s) => s.key === srcKey) || editable[0]

  const [addText, setAddText] = useState('')
  const [removing, setRemoving] = useState<string[]>([])
  const [filter, setFilter] = useState('')
  const [preview, setPreview] = useState<{ sig: string; data: RefreshPreview | null; error?: { code?: string; message?: string } } | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [confirm, setConfirm] = useState<'save' | 'integrated' | null>(null)
  const [yaml, setYaml] = useState<string | null>(null)
  const [integrating, setIntegrating] = useState(false)
  const followKey = `sources:follow:${src?.key || ''}`
  const [followed, setFollowed] = useState<FollowState | null>(memo.get<FollowState>(followKey)?.value ?? null)
  const [progress, setProgress] = useState<ProgressItem[]>([])

  // The overlaid list is params.<param> (§7): `urls` for an `urls` source unless the entry says otherwise.
  const param = src?.overlay?.param || src?.delivered?.param || 'urls'
  const current = useMemo(() => ((src?.params[param] as OverlayItem[] | undefined) || []).map(ref).filter(Boolean), [src, param])
  const lines = addText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const invalid = lines.filter((l) => !isUrl(l))
  const add = [...new Set(lines.filter(isUrl))].filter((u) => !current.includes(u))
  const already = lines.filter((l) => isUrl(l) && current.includes(l))
  const sig = JSON.stringify({ s: src?.key, add, remove: removing })
  const dirty = add.length > 0 || removing.length > 0
  const targetKb = state?.status?.knowledgeBases?.find((k) => k.key === src?.target)
  const refreshRunning = !!src && journalRunning(state, 'refreshSource', (a) => a.source === src.key && !a.dryRun)

  // Switching source resets the draft and reloads its follow-up.
  useEffect(() => {
    setAddText('')
    setRemoving([])
    setPreview(null)
    setYaml(null)
    setFollowed(memo.get<FollowState>(followKey)?.value ?? null)
    setProgress([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src?.key])

  // The preview computes itself shortly after each change of the draft (rule 4).
  const seq = useRef(0)
  useEffect(() => {
    if (!src || !dirty || invalid.length || preview?.sig === sig) return
    const n = ++seq.current
    const t = window.setTimeout(async () => {
      setPreviewing(true)
      const res = await call<RefreshPreview & { preview?: RefreshPreview; result?: RefreshPreview }>('consoleSources', { op: 'preview', source: src.key, add, remove: removing })
      if (n !== seq.current) return
      setPreviewing(false)
      const data = res.data ? res.data.preview || res.data.result || res.data : null
      setPreview(res.ok ? { sig, data } : { sig, data: null, error: { code: res.stillRunning ? 'Http504' : res.error, message: res.message } })
    }, 700)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, invalid.length])

  // Follow-up: state of each added address, every 5 s until every one is done.
  const loadProgress = useCallback(async () => {
    if (!followed) return
    const res = await call<{ items?: ProgressItem[] }>('consoleSources', { op: 'progress', source: followed.source, urls: followed.urls.slice(0, 80) })
    if (res.ok && res.data?.items) setProgress(res.data.items)
  }, [call, followed])
  const allDone = !!followed && progress.length >= followed.urls.length && progress.every((p) => FINAL.includes(p.status || ''))
  useEffect(() => {
    if (!followed) return
    void loadProgress()
    if (allDone) return
    const t = window.setInterval(() => void loadProgress(), 5_000)
    return () => window.clearInterval(t)
  }, [followed, loadProgress, allDone])

  if (!src) {
    return (
      <div className="flex flex-col gap-8" data-testid="view-sources">
        <PageHeader eyebrow={lb(CONFIG.nav.groups.content)} title={viewLabel('sources')} />
        <Empty>
          {others.length
            ? tr('Les sources de ce workspace ne sont pas des listes d’adresses : elles se modifient dans la configuration du workspace (git).', 'The sources of this workspace are not lists of addresses: they are changed in the workspace configuration (git).')
            : tr('Aucune source déclarée dans ce workspace.', 'No source declared in this workspace.')}
        </Empty>
      </div>
    )
  }

  const added = new Set((src.overlay?.added || []).map(ref))
  const removedHere = (src.overlay?.removed || []).map(ref)
  const shown = current.filter((u) => !filter || u.toLowerCase().includes(filter.toLowerCase()))
  const previewOk = preview?.sig === sig && !!preview.data
  const toQueue = count(preview?.data?.toQueue)
  const toRemove = count(preview?.data?.toRemove)
  const alreadyIn = count(preview?.data?.alreadyIngested)

  const saveBlock = first(
    roleBlock(state),
    block(!dirty, tr('Rien à enregistrer', 'Nothing to save'), tr('Ajoutez au moins une adresse, ou retirez-en une de la liste.', 'Add at least one address, or remove one from the list.')),
    block(invalid.length, tr('Adresse(s) non valide(s)', 'Invalid address(es)'), tr('Chaque ligne doit être une adresse complète commençant par https:// (une par ligne).', 'Each line must be a full address starting with https:// (one per line).')),
    block(!targetKb?.id, tr('La base n’existe pas encore', 'The base does not exist yet'), tr(`Lancez d’abord la synchronisation complète depuis la page Agent : elle crée ${kbName(src.target)}.`, `First run the full sync from the Agent page: it creates ${kbName(src.target)}.`)),
    block(refreshRunning, tr('Un passage est déjà en cours', 'A pass is already running'), tr('Il se termine seul ; la page se met à jour automatiquement.', 'It finishes by itself; the page updates automatically.')),
    block(previewing || (dirty && preview?.sig !== sig), tr('Calcul de l’aperçu…', 'Computing the preview…'), tr('L’aperçu se calcule tout seul ; rien n’est enregistré avant votre confirmation.', 'The preview computes itself; nothing is saved before you confirm.')),
    block(preview?.sig === sig && !preview.data, tr('L’aperçu a échoué', 'The preview failed'), errorText(preview?.error?.code, preview?.error?.message))
  )

  const save = async () => {
    setConfirm(null)
    const res = await post('save', 'consoleSources', { op: 'save', source: src.key, add, remove: removing })
    if (!res.ok) return
    notify('ok', tr('Modifications enregistrées. L’import démarre.', 'Changes saved. The import starts.'))
    const f: FollowState = { source: src.key, urls: add, since: Date.now() }
    if (add.length) {
      memo.set(followKey, f)
      setFollowed(f)
      setProgress([])
    }
    setAddText('')
    setRemoving([])
    setPreview(null)
    // Start the import of the new addresses and follow it (a pass already started by the save is fine).
    const label = tr('Import des nouvelles adresses', 'Import of the new addresses')
    const ans = await call<ActionAnswer>('consoleAction', { action: 'refreshSource', args: { source: src.key } })
    const done = (s: typeof state) => !journalRunning(s, 'refreshSource', (a) => a.source === src.key && !a.dryRun)
    if (ans.stillRunning) follow(`pass-${src.key}`, label, done)
    else if (ans.data && !ans.data.ok && ans.data.error !== 'SourceRefreshRunning') notify('bad', `${label} : ${errorText(ans.data.error, ans.data.message)}`, errorTechnical(ans.data.error, ans.data.message))
    else if (!ans.data && !ans.ok) notify('bad', `${label} : ${errorText(ans.error, ans.message)}`, errorTechnical(ans.error, ans.message))
    void refresh({ quiet: true, force: true })
  }

  const retry = async (items: ProgressItem[]) => {
    const ans = await call<ActionAnswer>('consoleAction', { action: 'refreshSource', args: { source: src.key, requeue: items.map((p) => p.id) } })
    if (ans.data?.ok || ans.stillRunning) notify('info', tr('Nouvel essai lancé.', 'Retry started.'))
    else notify('bad', errorText(ans.data?.error || ans.error, ans.data?.message || ans.message), errorTechnical(ans.data?.error || ans.error, ans.data?.message || ans.message))
    void loadProgress()
  }

  const exportYaml = async () => {
    const res = await post<{ yaml?: string }>('export', 'consoleSources', { op: 'export', source: src.key })
    if (!res.ok || !res.data?.yaml) return
    setYaml(res.data.yaml)
    try {
      await navigator.clipboard.writeText(res.data.yaml)
      notify('ok', tr('Bloc YAML copié : collez-le à la place de la même source dans index.yml.', 'YAML block copied: paste it over the same source in index.yml.'))
    } catch {
      /* clipboard refused (iframe): the block stays shown below */
    }
  }

  const markIntegrated = async () => {
    setConfirm(null)
    setIntegrating(true)
    const res = await call<{ missing?: OverlayItem[]; stillDelivered?: OverlayItem[] }>('consoleSources', { op: 'markIntegrated', source: src.key })
    setIntegrating(false)
    if (res.ok) {
      notify('ok', tr('C’est noté : la version de git fait de nouveau référence.', 'Noted: the git version is the reference again.'))
      setYaml(null)
      void refresh({ quiet: true, force: true })
    } else if (res.error === 'NotIntegrated') {
      // Say which items git does not have yet, so the technical team knows what to fix.
      const missing = (res.data?.missing || []).map(ref)
      const still = (res.data?.stillDelivered || []).map(ref)
      notify(
        'warn',
        tr('La version livrée par git ne contient pas encore ces modifications : la console continue de les appliquer et de les signaler.', 'The version delivered from git does not contain these changes yet: the console keeps applying and flagging them.'),
        [missing.length ? `missing: ${missing.join(', ')}` : '', still.length ? `stillDelivered: ${still.join(', ')}` : ''].filter(Boolean).join(' — ') || errorTechnical(res.error, res.message)
      )
    } else notify('bad', errorText(res.error, res.message), errorTechnical(res.error, res.message))
  }

  const failedProgress = progress.filter((p) => p.status === 'error')
  const doneCount = progress.filter((p) => p.status === 'ingested').length

  return (
    <div className="flex flex-col gap-8" data-testid="view-sources">
      <PageHeader
        eyebrow={lb(CONFIG.nav.groups.content)}
        title={viewLabel('sources')}
        sub={tr(`Les adresses que l’agent peut citer, importées dans ${kbName(src.target)}.`, `The addresses the agent can quote, imported into ${kbName(src.target)}.`)}
        actions={
          editable.length > 1 ? <Segmented value={src.key} onChange={setSrcKey} options={editable.map((s) => ({ value: s.key, label: sourceLabel(s.key, s.label), testId: `sources-pick-${s.key}` }))} /> : undefined
        }
      />

      {followed && (
        <Panel
          title={allDone ? tr('Import terminé', 'Import finished') : tr('Import en cours', 'Import running')}
          sub={tr(`${num(doneCount)} / ${num(followed.urls.length)} adresse(s) consultable(s) par l’agent`, `${num(doneCount)} / ${num(followed.urls.length)} address(es) searchable by the agent`)}
          testId="sources-follow"
          actions={
            <>
              {failedProgress.length > 1 && (
                <Btn small onClick={() => void retry(failedProgress)} blocked={roleBlock(state)} testId="sources-retry-all">
                  {tr('Tout réessayer', 'Retry all')}
                </Btn>
              )}
              <Btn
                small
                variant="ghost"
                onClick={() => {
                  memo.drop(followKey)
                  setFollowed(null)
                }}
                testId="sources-follow-close"
              >
                {allDone ? tr('Fermer', 'Close') : tr('Ne plus suivre', 'Stop following')}
              </Btn>
            </>
          }
        >
          <Table head={[tr('Adresse', 'Address'), tr('État', 'State'), '']} testId="sources-progress">
            {followed.urls.map((u) => {
              const p = progress.find((x) => x.url === u)
              const l = progressLabel(p)
              const err = p?.error ? (typeof p.error === 'string' ? p.error : p.error.message) : ''
              return (
                <tr key={u}>
                  <Td className="max-w-md break-all">{u}</Td>
                  <Td>
                    <div className="flex flex-col gap-0.5">
                      <Dot tone={l.tone}>{l.label}</Dot>
                      {err && <span className="text-xs text-muted-foreground">{err}</span>}
                    </div>
                  </Td>
                  <Td className="text-right">
                    {p?.status === 'error' && (
                      <Btn small variant="ghost" onClick={() => void retry([p])} blocked={roleBlock(state)} testId={`sources-retry-${p.id}`}>
                        {tr('Réessayer', 'Retry')}
                      </Btn>
                    )}
                  </Td>
                </tr>
              )
            })}
          </Table>
          {!allDone && (
            <p className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Spinner /> {tr('Mise à jour toutes les 5 secondes ; vous pouvez quitter la page, l’import continue.', 'Updated every 5 seconds; you can leave the page, the import goes on.')}
            </p>
          )}
        </Panel>
      )}

      <Panel
        title={tr(`Adresses déclarées (${num(current.length)})`, `Declared addresses (${num(current.length)})`)}
        sub={sourceLabel(src.key, src.label)}
        testId="sources-list"
        actions={current.length > 15 ? <input className={inputClass + ' h-8'} style={{ width: 220 }} placeholder={tr('Filtrer…', 'Filter…')} value={filter} onChange={(e) => setFilter(e.target.value)} data-testid="sources-filter" /> : undefined}
      >
        {shown.length ? (
          <ul className="flex flex-col divide-y divide-border text-sm">
            {shown.map((u) => {
              const marked = removing.includes(u)
              return (
                <li key={u} className="group flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0" data-testid={`source-url-${u}`}>
                  <span className={marked ? 'min-w-0 break-all text-muted-foreground line-through' : 'min-w-0 break-all'}>
                    {u}
                    {added.has(u) && <span className="ml-2 text-xs text-emerald-700 dark:text-emerald-400">{tr('ajoutée depuis la console', 'added from the console')}</span>}
                  </span>
                  {/* Without a control role the reason is said once, on « Enregistrer et importer ». */}
                  {state?.me.canControl && (
                    <Btn small variant={marked ? 'ghost' : 'dangerGhost'} onClick={() => setRemoving((r) => (marked ? r.filter((x) => x !== u) : [...r, u]))} testId={`source-remove-${u}`}>
                      {marked ? tr('Garder', 'Keep') : tr('Retirer', 'Remove')}
                    </Btn>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <Empty>{filter ? tr('Aucune adresse ne correspond.', 'No address matches.') : tr('Aucune adresse déclarée.', 'No address declared.')}</Empty>
        )}
      </Panel>

      <Panel title={tr('Modifier la liste', 'Change the list')} testId="sources-edit">
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{tr('Adresses à ajouter (une par ligne)', 'Addresses to add (one per line)')}</span>
            <textarea className={textareaClass} rows={4} value={addText} onChange={(e) => setAddText(e.target.value)} placeholder="https://" data-testid="sources-add-input" />
          </label>
          {invalid.length > 0 && <Banner tone="warn">{tr(`Non valide : ${invalid.join(', ')} — une adresse complète commence par https://.`, `Invalid: ${invalid.join(', ')} — a full address starts with https://.`)}</Banner>}
          {already.length > 0 && <p className="text-xs text-muted-foreground">{tr(`Déjà dans la liste, ignorée(s) : ${already.join(', ')}`, `Already in the list, ignored: ${already.join(', ')}`)}</p>}

          {dirty && !invalid.length && (
            <div className="flex flex-col gap-2 border-t border-border pt-4 text-sm" data-testid="sources-preview">
              {previewing || preview?.sig !== sig ? (
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <Spinner /> {tr('Calcul de l’effet… (rien n’est enregistré)', 'Computing the effect… (nothing is saved)')}
                </span>
              ) : previewOk ? (
                <>
                  <p>
                    {toQueue
                      ? tr(`${itemsWord(src.key, toQueue)} seront importé(e)s dans ${kbName(src.target)} : l’agent pourra les citer dès la fin de l’import.`, `${itemsWord(src.key, toQueue)} will be imported into ${kbName(src.target)}: the agent can quote them once imported.`)
                      : tr('Aucun nouveau document à importer.', 'No new document to import.')}
                    {alreadyIn ? ` ${tr(`${num(alreadyIn)} déjà présent(s) dans la base.`, `${num(alreadyIn)} already in the base.`)}` : ''}
                  </p>
                  {count(preview?.data?.failed) > 0 && <p className="border-l-2 border-l-amber-500 pl-3">{tr(`${num(count(preview?.data?.failed))} adresse(s) n’ont pas pu être lues : vérifiez-les avant d’enregistrer.`, `${num(count(preview?.data?.failed))} address(es) could not be read: check them before saving.`)}</p>}
                  {toRemove > 0 && <p className="border-l-2 border-l-amber-500 pl-3">{tr(`${itemsWord(src.key, toRemove)} sortent de la liste : les prochains passages ne les reliront plus. Les documents déjà importés restent dans la base.`, `${itemsWord(src.key, toRemove)} leave the list: later passes will not read them again. Documents already imported stay in the base.`)}</p>}
                  {preview?.data?.items?.length || preview?.data?.warnings?.length ? (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">{tr('Détails techniques', 'Technical details')}</summary>
                      <ul className="mt-2 flex flex-col gap-0.5 font-mono">
                        {(preview.data.items || []).map((it, i) => (
                          <li key={it.id || i} className="break-all">
                            {it.action || it.status ? `${it.action || it.status} · ` : ''}
                            {it.url || it.name || it.id}
                          </li>
                        ))}
                        {(preview.data.warnings || []).map((w, i) => (
                          <li key={`w${i}`} className="break-all text-amber-700 dark:text-amber-400">
                            {w}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </>
              ) : (
                <Banner tone="bad">{errorText(preview?.error?.code, preview?.error?.message)}</Banner>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Btn variant="primary" onClick={() => setConfirm('save')} blocked={saveBlock} busy={busy.save} testId="sources-save">
              {tr('Enregistrer et importer', 'Save and import')}
            </Btn>
            {!targetKb?.id && (
              <Btn small variant="ghost" onClick={() => go('agent')} testId="sources-go-agent">
                {viewLabel('agent')} →
              </Btn>
            )}
            {dirty && (
              <Btn
                small
                variant="ghost"
                onClick={() => {
                  setAddText('')
                  setRemoving([])
                  setPreview(null)
                }}
                testId="sources-reset"
              >
                {tr('Annuler les modifications', 'Discard the changes')}
              </Btn>
            )}
          </div>
          <Help>
            {tr(
              'Les modifications faites ici s’appliquent tout de suite sur cet environnement, sans toucher à la configuration livrée par git. Elles restent signalées « À reporter dans git » jusqu’à ce que l’équipe technique les intègre au dépôt.',
              'Changes made here apply at once on this environment, without touching the configuration delivered from git. They stay flagged « To carry into git » until the technical team merges them into the repository.'
            )}
          </Help>
        </div>
      </Panel>

      {src.overlay && (
        <Panel
          title={tr('À reporter dans git', 'To carry into git')}
          sub={tr('Pour l’équipe technique : à intégrer dans le dépôt à la prochaine livraison.', 'For the technical team: to merge into the repository at the next delivery.')}
          testId="sources-git"
          actions={
            <>
              <Btn small onClick={() => void exportYaml()} busy={busy.export} testId="sources-export">
                {tr('Copier le YAML', 'Copy the YAML')}
              </Btn>
              <Btn small variant="ghost" onClick={() => setConfirm('integrated')} blocked={roleBlock(state)} busy={integrating} testId="sources-integrated">
                {tr('C’est intégré dans git', 'It is merged in git')}
              </Btn>
            </>
          }
        >
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex flex-col gap-1 font-mono text-xs">
              {[...added].map((x) => (
                <span key={`a${x}`} className="break-all text-emerald-700 dark:text-emerald-400">
                  + {x}
                </span>
              ))}
              {removedHere.map((x) => (
                <span key={`r${x}`} className="break-all text-red-700 dark:text-red-400">
                  − {x}
                </span>
              ))}
            </div>
            <p className="text-muted-foreground">
              {src.overlay.by || src.overlay.at ? tr(`Modifié depuis la console${src.overlay.by ? ` par ${src.overlay.by}` : ''}${src.overlay.at ? ` le ${dateTime(src.overlay.at)}` : ''}. `, `Changed from the console${src.overlay.by ? ` by ${src.overlay.by}` : ''}${src.overlay.at ? ` on ${dateTime(src.overlay.at)}` : ''}. `) : ''}
              {tr('Collez le bloc YAML à la place de la même source dans ', 'Paste the YAML block over the same source in ')}
              <Mono>index.yml</Mono> (<Mono>config.value.sources</Mono>).
            </p>
            {src.overlay.baseChanged && <Banner tone="warn">{tr('La version livrée par git a changé depuis ces modifications : elles restent appliquées par-dessus (les adresses déjà livrées sont ignorées). Vérifiez le bloc avant de le coller.', 'The version delivered from git changed since these changes: they stay applied on top (addresses already delivered are ignored). Check the block before pasting it.')}</Banner>}
            {yaml !== null && <textarea readOnly className={textareaClass} rows={Math.min(16, yaml.split('\n').length + 1)} value={yaml} data-testid="sources-yaml" />}
          </div>
        </Panel>
      )}

      {others.length > 0 && (
        <p className="text-sm text-muted-foreground" data-testid="sources-others">
          {tr('Autres sources, modifiables dans la configuration du workspace seulement : ', 'Other sources, changed in the workspace configuration only: ')}
          {others.map((s) => sourceLabel(s.key, s.label)).join(', ')}.
          {viewOn('ingestion') && (
            <>
              {' '}
              <button type="button" className="text-primary hover:underline" onClick={() => go('ingestion')} data-testid="sources-to-ingestion">
                {viewLabel('ingestion')} →
              </button>
            </>
          )}
        </p>
      )}

      <Confirm open={confirm === 'save'} title={tr('Enregistrer et importer ?', 'Save and import?')} confirmLabel={tr('Enregistrer', 'Save')} busy={busy.save} onCancel={() => setConfirm(null)} onConfirm={() => void save()} testId="confirm-sources-save">
        <div className="flex flex-col gap-2">
          <p>
            {add.length ? tr(`${num(add.length)} adresse(s) ajoutée(s)`, `${num(add.length)} address(es) added`) : ''}
            {add.length && removing.length ? ', ' : ''}
            {removing.length ? tr(`${num(removing.length)} retirée(s)`, `${num(removing.length)} removed`) : ''}.{' '}
            {toQueue ? tr(`${itemsWord(src.key, toQueue)} sont ensuite importé(e)s dans ${kbName(src.target)} ; la console suit l’import.`, `${itemsWord(src.key, toQueue)} are then imported into ${kbName(src.target)}; the console follows the import.`) : ''}
          </p>
          <p className="text-muted-foreground">{tr('La modification s’applique sur cet environnement et sera à reporter dans git.', 'The change applies on this environment and is to be carried into git.')}</p>
        </div>
      </Confirm>
      <Confirm open={confirm === 'integrated'} title={tr('Les modifications sont dans git ?', 'Are the changes in git?')} confirmLabel={tr('Oui, c’est intégré', 'Yes, it is merged')} busy={integrating} onCancel={() => setConfirm(null)} onConfirm={() => void markIntegrated()} testId="confirm-sources-integrated">
        {tr('À faire une fois le bloc YAML intégré au dépôt et le workspace livré : la console vérifie que la version livrée contient bien chaque ajout, puis cesse de signaler l’écart.', 'Do it once the YAML block is in the repository and the workspace delivered: the console checks that the delivered version contains every addition, then stops flagging the difference.')}
      </Confirm>
    </div>
  )
}
