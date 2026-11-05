# Ingestion: filling knowledge bases from declared sources

When sources exceed a few dozen documents, ingestion becomes a queue in workspace state advanced by
events and a schedule, never one long webhook call. Contract: `templates/workspace/DESIGN.md` §3, §5.2
and §7. Console: the optional Ingestion and Sources views.

## 1. Declare sources

```yaml
sources:
  - key: docs
    type: urls            # urls | files | <custom>
    target: kb-docs       # a manifest knowledge base
    label: Site documentation
    params:
      urls: [https://example.com/docs/page-1]
```

Every reader goes through `_sources-effective`, which layers the console overlay (local additions,
DESIGN §7) over the delivered entry.

## 2. The queue

```text
refreshSource {source}          discover → item rows queued → kick
pumpIngest (schedule + event)   queued → dispatched (≤ batchSize, within maxInFlight)
onIngestItem (event)            dispatched → processing → Storage.addFileToVectorStore → ingested
_ingest-housekeeping            stale in-flight → queued; documents that failed to index → error
```

- Item ids are the sha256 of the URL: re-discovering the same document never duplicates it; Storage
  documents carry `{ingestSource, ingestItem}` metadata.
- Failures go back to `queued` until `maxAttempts`, then `error` with the failing stage.
- `controlIngest {action: suspend | resume | stop}` is read fresh at every step; `stop` (admin-only)
  cancels queued items. Use it to relieve the platform, not to fix a source.
- Items no longer listed become `removed`; their documents are deleted only with
  `refreshSource {prune: true}` (admin-only). A discovery that returned nothing but failures removes
  nothing.
- `refreshSource {dryRun: true, params?}` is the preview: what would be queued, already ingested,
  removed. The console uses it before saving a source change.
- Check the knowledge base document quota before planning a large source.

## 3. Adding a custom source type

Add a branch on `source.type` in `_content-sources` (agent content, `automations/content/sources.yml`)
that reads `source.params`, sets `handled: true` and returns one ref per document:
`{url, name?, mime?, fetchUrl?, fileId?, metadata?}`. `_source-discover` (engine) calls it for any type
other than `urls` and `files`; never add the branch to the engine file.

- `url` is required and stable: it is the item id and Storage's `source_url` (dedup key).
- `fetchUrl` is what Storage downloads when it differs (a share link); `fileId` attaches a workspace file.
- Unresolvable refs go to the failed list with a code; on a total listing failure return no ref.
- The branch may use `fetch`, Custom Code or a private helper, but never writes state or calls Storage:
  queueing, dispatch, attach and retries come from the shared tail.
- Set `overlayParam` on the source if the list the console edits is not `params.urls`.

Design rules for a custom source:

- **Separate listing from fetching.** Discovery lists what exists (cheap, read-only); Storage fetches
  the content. Never download documents inside discovery.
- **Choose what one item is.** One document the agent can cite. A container (archive, folder, page of
  results) is expanded into its documents, or attached with `fetchUrl` when Storage can read it as is.
- **Versions.** When content is versioned, decide the rule in `params` (latest only, latest per major
  version, explicit list) and give each version its own stable `url`; an outdated version becomes
  `removed` when the rule stops listing it.
- **Metadata for answers.** Put what the agent needs to cite or filter (title, version, section,
  date, source link) in `metadata`; the prompt can then refer to it.
- **Size.** Split documents too large to index in the discovery branch (one ref per part) rather than
  retrying a failing whole.
- **Credentials and limits.** Read credentials from workspace secrets, never from `params`; respect the
  source's rate limits (page through listings, cap refs per refresh) and report partial listings as
  failures so nothing is removed by mistake.
- **Preview.** Everything above runs unchanged in `refreshSource {dryRun: true}`, which the console
  uses as the preview (`guides/console.md` § 9.6).

## 4. Known limits

- Unattended runs reach Storage with the workspace identity only (guides/sync.md § 8).
- The schedule has no user and Storage refuses it (`guides/sync.md` § 8): it does nothing unless
  `ingestion.unattended` is true. The queue moves with `ingest.pump` events (capped by
  `ingestion.maxHops`, runtime depth limit) and with an open console, which kicks `pumpIngest` every
  minute while items wait. A large source therefore finishes while someone keeps the console open, or
  after « Lancer un passage » again.
- Very large documents may fail to index; split them upstream (in the discovery branch) rather than
  retrying forever.
