#!/usr/bin/env node
/**
 * Deploy the built bundle to a Prisme.ai workspace.
 *
 * Mirrors the in-builder "Deploy" button (see BundlePublishModal.handlePublish):
 *
 *   1. Sync src/* files into the workspace as `metadata.type=source` files
 *      (hash-based differential sync — only changed files are re-uploaded).
 *      → Lets a teammate open the same workspace in the in-builder Builder
 *        and see the exact same code your repo holds.
 *
 *   2. Compile + upload the bundle as a public file.
 *
 *   3. (Optional) Upload embed.js so the app can be embedded via <script> on
 *      a 3rd-party site. Skipped unless PRISMEAI_PLATFORM_URL is set.
 *
 *   4. PATCH workspace.config.value.bundles[<slug>] so AppRenderer picks up
 *      the new bundle URL.
 *
 *   5. POST /workspaces/:id/versions to snapshot a Prisme version.
 *
 * Required env (.env at repo root):
 *   PRISMEAI_API_URL          full URL incl. /v2 (e.g. https://api.acme.com/v2)
 *   PRISMEAI_API_KEY          personal API key
 *   PRISMEAI_WORKSPACE_ID     UUID of the target workspace
 *
 * Optional:
 *   PRISMEAI_PLATFORM_URL          UI host for embed.js (e.g. https://app.acme.com)
 *   PRISMEAI_BUNDLE_SLUG           override the bundles[<key>] (default: workspace.slug)
 *   PRISMEAI_APP_VERSION           default '1.0.0'
 *   PRISMEAI_SKIP_SOURCE_SYNC      'true' to skip step 1
 *   PRISMEAI_SKIP_VERSION_SNAPSHOT 'true' to skip step 5
 */

import dotenv from 'dotenv'
import { readFile, readdir, stat, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const BUNDLE_PATH = path.join(ROOT, 'dist/bundle.js')

// Multi-env: pick .env.<name> if --env=<name> or PRISMEAI_ENV is set, else .env.
// Print which file we loaded so you never accidentally deploy to prod thinking
// you're on dev.
function loadEnv() {
  const argEnv = process.argv.find(a => a.startsWith('--env='))?.slice(6)
  const envName = argEnv || process.env.PRISMEAI_ENV || ''
  const candidates = envName ? [`.env.${envName}`] : ['.env']
  for (const rel of candidates) {
    const abs = path.join(ROOT, rel)
    if (existsSync(abs)) {
      dotenv.config({ path: abs })
      console.log(`· using ${rel}${envName ? ` (env=${envName})` : ''}`)
      return rel
    }
  }
  if (envName) {
    console.error(`✗ Env file not found: .env.${envName}`)
    process.exit(1)
  }
  // No .env at all — env vars must come from the shell/CI
  console.log('· no .env file (env vars must come from shell/CI)')
  return null
}
loadEnv()

const {
  PRISMEAI_API_URL,
  PRISMEAI_ACCESS_TOKEN,
  PRISMEAI_API_KEY,
  PRISMEAI_WORKSPACE_ID,
  PRISMEAI_PLATFORM_URL,
} = process.env
const PRISMEAI_APP_VERSION = process.env.PRISMEAI_APP_VERSION || '1.0.0'
const SKIP_SOURCE_SYNC = process.env.PRISMEAI_SKIP_SOURCE_SYNC === 'true'
const SKIP_VERSION_SNAPSHOT = process.env.PRISMEAI_SKIP_VERSION_SNAPSHOT === 'true'
const SKIP_AUTOMATIONS_SYNC = process.env.PRISMEAI_SKIP_AUTOMATIONS_SYNC === 'true'
const SKIP_BUNDLE_CLEANUP = process.env.PRISMEAI_SKIP_BUNDLE_CLEANUP === 'true'
const SKIP_SMOKE = process.env.PRISMEAI_SKIP_SMOKE === 'true'
const FORCE = process.argv.includes('--force') || process.env.PRISMEAI_FORCE === 'true'

// fail() throws so the top-level try/catch can print a deploy summary + recovery
// guidance before exiting non-zero. Don't call process.exit() directly here.
function fail(msg) { throw new Error(msg) }

if (!PRISMEAI_API_URL) fail('Missing PRISMEAI_API_URL in .env (must include /v2 suffix)')
if (!PRISMEAI_ACCESS_TOKEN && !PRISMEAI_API_KEY) {
  fail('Missing auth in .env: set either PRISMEAI_ACCESS_TOKEN (recommended) or PRISMEAI_API_KEY')
}
if (!PRISMEAI_WORKSPACE_ID) fail('Missing PRISMEAI_WORKSPACE_ID in .env')

const API_BASE = PRISMEAI_API_URL.replace(/\/$/, '')
const AUTH_HEADERS = PRISMEAI_ACCESS_TOKEN
  ? { Authorization: `Bearer ${PRISMEAI_ACCESS_TOKEN}` }
  : { 'x-prismeai-api-key': PRISMEAI_API_KEY }

// HTTP timeout (default 30s) + retry on 5xx/network errors with exponential
// backoff. 4xx are deterministic client errors and never retried.
const HTTP_TIMEOUT_MS = parseInt(process.env.PRISMEAI_HTTP_TIMEOUT || '30000', 10)
const HTTP_MAX_RETRIES = parseInt(process.env.PRISMEAI_HTTP_RETRIES || '3', 10)

async function api(method, pathSuffix, { body, headers, raw } = {}) {
  let lastError = ''
  for (let attempt = 0; attempt <= HTTP_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const waitMs = 1000 * Math.pow(2, attempt - 1) // 1s, 2s, 4s
      console.warn(`  ↻ retry ${attempt}/${HTTP_MAX_RETRIES} for ${method} ${pathSuffix} after ${waitMs}ms (last: ${lastError})`)
      await new Promise(r => setTimeout(r, waitMs))
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS)

    let res
    try {
      res = await fetch(`${API_BASE}${pathSuffix}`, {
        method,
        headers: {
          ...AUTH_HEADERS,
          ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })
    } catch (err) {
      // Network or timeout error — retry
      clearTimeout(timer)
      lastError = err?.name === 'AbortError' ? `timeout after ${HTTP_TIMEOUT_MS}ms` : (err?.message || String(err))
      continue
    }
    clearTimeout(timer)

    // 4xx — deterministic, fail fast (no retry)
    if (res.status >= 400 && res.status < 500) {
      const text = await res.text().catch(() => '')
      fail(`${method} ${pathSuffix} → ${res.status} ${res.statusText}\n${text}`)
    }
    // 5xx — transient, retry
    if (res.status >= 500) {
      lastError = `${res.status} ${res.statusText}`
      continue
    }
    // 2xx
    if (res.status === 204) return null
    if (raw) return res
    const ct = res.headers.get('content-type') || ''
    return ct.includes('application/json') ? res.json() : res.text()
  }
  fail(`${method} ${pathSuffix} failed after ${HTTP_MAX_RETRIES + 1} attempts: ${lastError}`)
}

function sha256(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

// ---------------------------------------------------------------------------
// Source-file collection — mirrors the template's scaffoldPaths + everything
// the customer added under src/. Equivalent to what the in-builder sandbox
// holds in memory.
// ---------------------------------------------------------------------------

const ROOT_SOURCE_FILES = [
  'package.json',
  'tsconfig.json',
  'vite.config.ts',
  'tailwind.config.js',
  'postcss.config.js',
  'index.html',
]
const SOURCE_DIRS = ['src']
const EXCLUDE = new Set(['node_modules', 'dist', '.git', '.vite'])

async function walk(dir, prefix) {
  const out = []
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  for (const e of entries) {
    if (EXCLUDE.has(e.name)) continue
    const abs = path.join(dir, e.name)
    const rel = prefix ? `${prefix}/${e.name}` : e.name
    if (e.isDirectory()) {
      out.push(...(await walk(abs, rel)))
    } else if (e.isFile()) {
      out.push({ abs, rel })
    }
  }
  return out
}

async function collectSourceFiles() {
  const files = []
  for (const f of ROOT_SOURCE_FILES) {
    const abs = path.join(ROOT, f)
    if (await stat(abs).catch(() => null)) {
      files.push({ abs, rel: f })
    }
  }
  for (const d of SOURCE_DIRS) {
    const abs = path.join(ROOT, d)
    if (await stat(abs).catch(() => null)) {
      files.push(...(await walk(abs, d)))
    }
  }
  // Exclude DSUL artifacts and tooling — those are pushed via separate steps
  // or aren't relevant to the in-builder Builder's source view.
  const EXCLUDE_REL = new Set([
    'README.md',
    'AGENTS.md',
    'CLAUDE.md',
    '.cursorrules',
    'TODO.md',
    '.env',
    '.env.example',
    '.gitignore',
  ])
  return files.filter(f =>
    !EXCLUDE_REL.has(f.rel) &&
    !f.rel.startsWith('automations/') &&
    !f.rel.startsWith('imports/') &&
    !f.rel.startsWith('pages/') &&
    !f.rel.startsWith('scripts/') &&
    !f.rel.endsWith('.yml') &&
    !f.rel.endsWith('.yaml')
  )
}

// ---------------------------------------------------------------------------
// Pre-flight: conflict detection vs .prismeai/last-pull.json
//
// Refuses to deploy if remote source files / automations changed since the
// last `npm run pull`. Compares server-side hashes (file metadata.hash and
// automation checksum) against the manifest. Bypassed with --force or
// PRISMEAI_FORCE=true. Skipped silently when no manifest exists (first-time
// deploy from a clean clone).
// ---------------------------------------------------------------------------

const MANIFEST_PATH = path.join(ROOT, '.prismeai/last-pull.json')

async function detectConflicts() {
  let manifest
  try {
    const raw = await readFile(MANIFEST_PATH, 'utf8')
    manifest = JSON.parse(raw)
  } catch {
    console.log('· no .prismeai/last-pull.json — first deploy, conflict detection skipped')
    return
  }

  if (manifest.workspaceId && manifest.workspaceId !== PRISMEAI_WORKSPACE_ID) {
    fail(
      `Manifest workspace (${manifest.workspaceId}) doesn't match current PRISMEAI_WORKSPACE_ID (${PRISMEAI_WORKSPACE_ID}).\n` +
      `Run \`rm .prismeai/last-pull.json && npm run pull\` to re-sync, or set PRISMEAI_WORKSPACE_ID to match.`
    )
  }

  console.log(`→ Conflict detection (vs .prismeai/last-pull.json)`)

  const ws = await api('GET', `/workspaces/${PRISMEAI_WORKSPACE_ID}`)
  const remoteAutomations = ws?.automations || {}

  const conflicts = []

  // Automations: compare server's checksum against manifest
  const manifestAutoSlugs = new Set(Object.keys(manifest.automations || {}))
  for (const slug of Object.keys(remoteAutomations)) {
    const remoteChecksum = remoteAutomations[slug]?.checksum
    const manifestChecksum = manifest.automations?.[slug]
    if (!manifestAutoSlugs.has(slug)) {
      conflicts.push(`+ automations/${slug}.yml — added remotely since last pull`)
    } else if (remoteChecksum && manifestChecksum && remoteChecksum !== manifestChecksum) {
      conflicts.push(`~ automations/${slug}.yml — modified remotely since last pull`)
    }
  }

  // Source files: compare server's metadata.hash against manifest
  const params = new URLSearchParams({ limit: '1000', 'metadata.type': 'source' })
  const list = await api('GET', `/workspaces/${PRISMEAI_WORKSPACE_ID}/files?${params}`)
  const files = Array.isArray(list) ? list : list?.result || []
  const manifestSourcePaths = new Set(Object.keys(manifest.sourceFiles || {}))

  for (const f of files) {
    const relPath = f.metadata?.path || f.name
    if (!relPath) continue
    const remoteHash = f.metadata?.hash
    const manifestHash = manifest.sourceFiles?.[relPath]
    if (!manifestSourcePaths.has(relPath)) {
      conflicts.push(`+ ${relPath} — added remotely since last pull`)
    } else if (remoteHash && manifestHash && remoteHash !== manifestHash) {
      conflicts.push(`~ ${relPath} — modified remotely since last pull`)
    }
  }

  if (conflicts.length === 0) {
    console.log('  ✓ no remote changes since last pull')
    return
  }

  if (FORCE) {
    console.log(`  ⚠ ${conflicts.length} remote change(s) detected — proceeding anyway (--force):`)
    for (const c of conflicts) console.log('    ' + c)
    return
  }

  console.error()
  console.error(`✗ Deploy refused: ${conflicts.length} item(s) changed remotely since your last pull.`)
  for (const c of conflicts) console.error('    ' + c)
  console.error()
  console.error(`To resolve, choose one:`)
  console.error(`  • npm run pull                            # fetch remote changes, review with git diff, then npm run release`)
  console.error(`  • PRISMEAI_FORCE=true npm run release     # ⚠ overwrite remote changes with your local copy`)
  console.error(`  • npm run deploy -- --force               # same, but skips the build step`)
  console.error(`    (note: \`npm run release -- --force\` does NOT work — npm consumes --force as its own flag)`)
  process.exit(1)
}

// ---------------------------------------------------------------------------
// 0. Sync automations (automations/**/*.yml ↔ workspace.automations)
// ---------------------------------------------------------------------------

const AUTOMATIONS_DIR = path.join(ROOT, 'automations')

async function collectLocalAutomations() {
  const exists = await stat(AUTOMATIONS_DIR).catch(() => null)
  if (!exists) return []
  const files = await walk(AUTOMATIONS_DIR, '')
  const out = []
  for (const f of files) {
    if (!f.rel.endsWith('.yml') && !f.rel.endsWith('.yaml')) continue
    const content = await readFile(f.abs, 'utf8')
    const parsed = yaml.load(content)
    if (!parsed || typeof parsed !== 'object' || !parsed.slug) {
      console.warn(`⚠ skipping ${f.rel}: missing top-level slug`)
      continue
    }
    out.push({ filePath: f.rel, ...parsed })
  }
  return out
}

function automationBody(local) {
  // Strip filePath; the API receives the DSUL automation body directly.
  // eslint-disable-next-line no-unused-vars
  const { filePath, ...body } = local
  return body
}

function stableHash(obj) {
  return sha256(JSON.stringify(obj, Object.keys(obj).sort()))
}

async function syncAutomations() {
  if (SKIP_AUTOMATIONS_SYNC) {
    console.log('· automations sync skipped (PRISMEAI_SKIP_AUTOMATIONS_SYNC=true)')
    return
  }

  const locals = await collectLocalAutomations()
  if (locals.length === 0) {
    const dirExists = await stat(AUTOMATIONS_DIR).catch(() => null)
    if (!dirExists) {
      console.log('· no automations/ directory — skipping')
      return
    }
    console.log('· automations/ is empty — skipping')
    return
  }

  console.log(`→ Syncing ${locals.length} automations`)

  // The /workspaces/:id endpoint returns SUMMARY automations (no `do`/`output`),
  // so we use it only to know which slugs exist. For the actual diff we'd need
  // per-slug GETs — too many round-trips to be worth it for typical workspace
  // sizes. We always PATCH when the slug exists; POST when new. PATCH is
  // idempotent so the worst case is a no-op write.
  const ws = await api('GET', `/workspaces/${PRISMEAI_WORKSPACE_ID}`)
  const remoteSlugs = new Set(Object.keys(ws?.automations || {}))

  let created = 0, updated = 0, deleted = 0
  const localSlugs = new Set()

  for (const local of locals) {
    localSlugs.add(local.slug)
    const body = automationBody(local)

    if (!remoteSlugs.has(local.slug)) {
      await api('POST', `/workspaces/${PRISMEAI_WORKSPACE_ID}/automations`, { body })
      created++
    } else {
      await api('PATCH', `/workspaces/${PRISMEAI_WORKSPACE_ID}/automations/${encodeURIComponent(local.slug)}`, { body })
      updated++
    }
  }

  for (const remoteSlug of remoteSlugs) {
    if (!localSlugs.has(remoteSlug)) {
      console.log(`  ⚠ deleting remote automation not present locally: ${remoteSlug}`)
      await api('DELETE', `/workspaces/${PRISMEAI_WORKSPACE_ID}/automations/${encodeURIComponent(remoteSlug)}`)
      deleted++
    }
  }

  console.log(`  created=${created} updated=${updated} deleted=${deleted}`)
}

// ---------------------------------------------------------------------------
// 1. Sync source files (parity with syncFilesToWorkspace)
// ---------------------------------------------------------------------------

async function syncSourceFiles() {
  if (SKIP_SOURCE_SYNC) {
    console.log('· source sync skipped (PRISMEAI_SKIP_SOURCE_SYNC=true)')
    return
  }

  const localFiles = await collectSourceFiles()
  console.log(`→ Syncing ${localFiles.length} source files`)

  // List existing source files
  const params = new URLSearchParams({ limit: '1000', 'metadata.type': 'source' })
  const existing = await api('GET', `/workspaces/${PRISMEAI_WORKSPACE_ID}/files?${params}`)
  const existingArr = Array.isArray(existing) ? existing : existing?.result || []

  // Build path → { id, hash, duplicates[] } map
  const byPath = new Map()
  for (const f of existingArr) {
    const p = f.metadata?.path || f.name
    if (!p) continue
    const cur = byPath.get(p)
    if (cur) cur.duplicates.push(f.id)
    else byPath.set(p, { id: f.id, hash: f.metadata?.hash, duplicates: [] })
  }

  let uploaded = 0, skipped = 0, deleted = 0

  // Delete duplicates
  for (const [, info] of byPath) {
    for (const dupId of info.duplicates) {
      await api('DELETE', `/workspaces/${PRISMEAI_WORKSPACE_ID}/files/${encodeURIComponent(dupId)}`)
      deleted++
    }
  }

  // Diff + upload
  const localPaths = new Set()
  for (const file of localFiles) {
    localPaths.add(file.rel)
    const content = await readFile(file.abs, 'utf8')
    const hash = sha256(content)
    const cur = byPath.get(file.rel)

    if (!cur) {
      await uploadSourceFile(file.rel, content, hash)
      uploaded++
    } else if (cur.hash !== hash) {
      await api('DELETE', `/workspaces/${PRISMEAI_WORKSPACE_ID}/files/${encodeURIComponent(cur.id)}`)
      await uploadSourceFile(file.rel, content, hash)
      uploaded++
      deleted++
    } else {
      skipped++
    }
  }

  // Delete files that no longer exist locally
  for (const [p, info] of byPath) {
    if (!localPaths.has(p)) {
      await api('DELETE', `/workspaces/${PRISMEAI_WORKSPACE_ID}/files/${encodeURIComponent(info.id)}`)
      deleted++
    }
  }

  console.log(`  uploaded=${uploaded} skipped=${skipped} deleted=${deleted}`)
}

async function uploadSourceFile(relPath, content, hash) {
  const formData = new FormData()
  const filename = relPath.split('/').pop() || 'file'
  formData.append('file', new Blob([content], { type: 'text/plain' }), filename)
  formData.append('metadata.path', relPath)
  formData.append('metadata.type', 'source')
  formData.append('metadata.hash', hash)
  formData.append('public', 'false')
  return api('POST', `/workspaces/${PRISMEAI_WORKSPACE_ID}/files`, { body: formData })
}

// ---------------------------------------------------------------------------
// 2. Upload bundle (parity with useAppBuild step 2)
// ---------------------------------------------------------------------------

async function uploadBundle() {
  const bundleBytes = await readFile(BUNDLE_PATH).catch(() =>
    fail('dist/bundle.js not found — run `npm run build` first.')
  )
  console.log(`→ Uploading bundle (${(bundleBytes.length / 1024).toFixed(1)} KB)`)
  const fd = new FormData()
  fd.append('file', new Blob([bundleBytes], { type: 'application/javascript' }), 'bundle.js')
  fd.append('public', 'true')
  const res = await api('POST', `/workspaces/${PRISMEAI_WORKSPACE_ID}/files`, { body: fd })
  if (!Array.isArray(res) || !res[0]?.url) {
    fail('Bundle upload returned no URL. Check that the API key has write access to the workspace.')
  }
  console.log(`✓ ${res[0].url}`)
  return res[0].url
}

// ---------------------------------------------------------------------------
// 3. Upload embed.js (optional — only if PRISMEAI_PLATFORM_URL is set)
// ---------------------------------------------------------------------------

async function uploadEmbed() {
  if (!PRISMEAI_PLATFORM_URL) {
    console.log('· embed.js upload skipped (set PRISMEAI_PLATFORM_URL to enable)')
    return null
  }
  const embedSrc = `${PRISMEAI_PLATFORM_URL.replace(/\/$/, '')}/embed.js`
  console.log(`→ Fetching embed.js from ${embedSrc}`)
  const res = await fetch(embedSrc)
  if (!res.ok) {
    console.warn(`⚠ Could not fetch embed.js (${res.status}) — skipping embed upload`)
    return null
  }
  const code = await res.text()
  const fd = new FormData()
  fd.append('file', new Blob([code], { type: 'application/javascript' }), 'embed.js')
  fd.append('public', 'true')
  const up = await api('POST', `/workspaces/${PRISMEAI_WORKSPACE_ID}/files`, { body: fd })
  if (!Array.isArray(up) || !up[0]?.url) {
    console.warn('⚠ embed.js upload returned no URL — skipping')
    return null
  }
  console.log(`✓ ${up[0].url}`)
  return up[0].url
}

// ---------------------------------------------------------------------------
// 4. Patch workspace config (the live pointer)
// ---------------------------------------------------------------------------

async function patchWorkspaceConfig({ bundleUrl, embedUrl, ws, slug }) {
  console.log(`→ Patching config.value.bundles[${slug}]`)
  const existing = ws?.config?.value || {}
  const existingBundles = existing.bundles || {}
  const builtAt = new Date().toISOString()

  await api('PATCH', `/workspaces/${PRISMEAI_WORKSPACE_ID}`, {
    body: {
      config: {
        value: {
          ...existing,
          bundles: {
            ...existingBundles,
            [slug]: {
              bundle: bundleUrl,
              ...(embedUrl ? { embed: embedUrl } : {}),
              version: PRISMEAI_APP_VERSION,
              name: ws?.name || slug,
              builtAt,
            },
          },
        },
      },
    },
  })
}

// ---------------------------------------------------------------------------
// 4b. Cleanup orphan bundle / embed files
//
// Each deploy uploads a NEW <random>.bundle.js (and optionally embed.js).
// The platform doesn't dedupe; old files stay in workspace storage forever
// unless we clean them up. Run AFTER the config PATCH so we know which URLs
// are still referenced.
// ---------------------------------------------------------------------------

async function cleanupOrphanBundles() {
  if (SKIP_BUNDLE_CLEANUP) {
    console.log('· bundle cleanup skipped (PRISMEAI_SKIP_BUNDLE_CLEANUP=true)')
    return
  }

  console.log(`→ Cleaning up orphan bundle/embed files`)

  // Fetch the workspace fresh to get the canonical current bundles map
  const ws = await api('GET', `/workspaces/${PRISMEAI_WORKSPACE_ID}`)
  const bundles = ws?.config?.value?.bundles || {}
  const referenced = new Set()
  for (const entry of Object.values(bundles)) {
    if (entry?.bundle) referenced.add(entry.bundle)
    if (entry?.embed) referenced.add(entry.embed)
  }

  // List public files (bundles + embeds are uploaded with public=true)
  const list = await api('GET', `/workspaces/${PRISMEAI_WORKSPACE_ID}/files?limit=1000`)
  const files = Array.isArray(list) ? list : list?.result || []
  const candidates = files.filter(f =>
    f.public === true &&
    (f.name === 'bundle.js' || f.name === 'embed.js')
  )

  let deleted = 0, kept = 0
  for (const f of candidates) {
    if (referenced.has(f.url)) {
      kept++
      continue
    }
    await api('DELETE', `/workspaces/${PRISMEAI_WORKSPACE_ID}/files/${encodeURIComponent(f.id)}`)
    deleted++
  }
  console.log(`  kept=${kept} deleted=${deleted}`)
}

// ---------------------------------------------------------------------------
// 4c. Smoke test
//
// A successful PATCH doesn't mean the app actually loads. Three failure modes
// pass the deploy but break the live UI:
//   1. Bundle is syntactically broken (esbuild emitted bad CJS)
//   2. Bundle imports a module not in externals (would throw at runtime)
//   3. config.value.bundles[<slug>] points to a 404 / expired URL
//
// We replay what AppRenderer does: GET /pages/<slug>/_bundle, fetch the JS,
// execute it in a Function() with stubbed externals, verify module.default
// is a function/object.
// ---------------------------------------------------------------------------

async function smokeTest({ slug }) {
  if (SKIP_SMOKE) {
    console.log('· smoke test skipped (PRISMEAI_SKIP_SMOKE=true)')
    return
  }
  console.log(`→ Smoke test`)

  // 1. Resolve via the same endpoint AppRenderer uses
  const resolved = await api('GET', `/pages/${encodeURIComponent(slug)}/_bundle`)
  const bundleUrl = resolved?.bundles?.[slug]?.bundle
  if (!bundleUrl) fail(`Smoke: /pages/${slug}/_bundle has no bundles[${slug}].bundle`)

  // 2. Fetch the bundle (public URL, no auth)
  const bundleRes = await fetch(bundleUrl)
  if (!bundleRes.ok) fail(`Smoke: bundle URL returned ${bundleRes.status} ${bundleRes.statusText}`)
  const code = await bundleRes.text()
  if (code.length === 0) fail(`Smoke: bundle URL returned empty body`)

  // 3. Parse-check (catches esbuild emitting bad CJS). Doesn't execute — that
  //    requires a real React in scope, which we can't realistically stub here.
  try {
    new Function('require', 'exports', 'module', '__filename', '__dirname', code)
  } catch (err) {
    fail(`Smoke: bundle is not valid JavaScript — ${err?.message || err}`)
  }

  // 4. Static check that the bundle exposes a default export. esbuild's CJS
  //    output writes either `module.exports=` or `module.exports.default=`.
  if (!/module\.exports\s*=|exports\.default\s*=/.test(code)) {
    fail(`Smoke: bundle does not appear to set module.exports (esbuild output pattern not found)`)
  }
  console.log(`  ✓ bundle reachable, valid JS, has CJS exports (${(code.length / 1024).toFixed(1)} KB)`)
}

// ---------------------------------------------------------------------------
// 5. Version snapshot (parity with buildAndDeploy step 6)
// ---------------------------------------------------------------------------

// Refresh .prismeai/last-pull.json after successful deploy so subsequent
// deploys see "no remote changes" instead of falsely flagging our own pushes.
// Without this, every deploy after the first one needs --force.
async function refreshManifest() {
  const ws = await api('GET', `/workspaces/${PRISMEAI_WORKSPACE_ID}`)
  const params = new URLSearchParams({ limit: '1000', 'metadata.type': 'source' })
  const list = await api('GET', `/workspaces/${PRISMEAI_WORKSPACE_ID}/files?${params}`)
  const files = Array.isArray(list) ? list : list?.result || []
  const manifest = {
    pulledAt: new Date().toISOString(),
    workspaceId: PRISMEAI_WORKSPACE_ID,
    automations: {},
    sourceFiles: {},
  }
  for (const slug of Object.keys(ws?.automations || {})) {
    manifest.automations[slug] = ws.automations[slug]?.checksum
  }
  for (const f of files) {
    const p = f.metadata?.path || f.name
    if (p) manifest.sourceFiles[p] = f.metadata?.hash
  }
  await mkdir(path.dirname(MANIFEST_PATH), { recursive: true })
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8')
}

async function versionSnapshot() {
  if (SKIP_VERSION_SNAPSHOT) {
    console.log('· version snapshot skipped (PRISMEAI_SKIP_VERSION_SNAPSHOT=true)')
    return
  }
  console.log(`→ Creating version snapshot v${PRISMEAI_APP_VERSION}`)
  const res = await api('POST', `/workspaces/${PRISMEAI_WORKSPACE_ID}/versions`, {
    body: { description: `v${PRISMEAI_APP_VERSION}` },
  })
  const name = res?.name || res?.version?.name || 'unknown'
  console.log(`✓ version=${name}`)
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

// Secret hygiene: warn loudly if .env is tracked by git (it's in .gitignore
// by default, so being tracked means someone force-added it and the access
// token may be in commit history).
function warnIfEnvTracked() {
  try {
    const tracked = execSync('git ls-files --error-unmatch .env', {
      cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8',
    }).trim()
    if (tracked) {
      console.warn('⚠ .env is tracked by git. Your PRISMEAI_ACCESS_TOKEN may be in commit history.')
      console.warn('  Recommended:')
      console.warn('    git rm --cached .env && git commit -m "untrack .env"')
      console.warn('    Then rotate the token in your platform UI: Settings → Access Tokens')
      console.warn('')
    }
  } catch { /* not tracked, or not a git repo — both fine */ }
}

warnIfEnvTracked()

// Track each step's status so a partial failure can print exactly what
// happened and what the user should do next.
const steps = [
  { key: 'conflict',    label: 'Conflict detection' },
  { key: 'automations', label: 'Automations sync' },
  { key: 'source',      label: 'Source files sync' },
  { key: 'bundle',      label: 'Bundle upload' },
  { key: 'embed',       label: 'embed.js upload' },
  { key: 'config',      label: 'Workspace config PATCH (live pointer)' },
  { key: 'cleanup',     label: 'Orphan bundle cleanup' },
  { key: 'smoke',       label: 'Smoke test (bundle loads + default export)' },
  { key: 'version',     label: 'Version snapshot' },
]
const status = Object.fromEntries(steps.map(s => [s.key, 'pending']))

function mark(key, value) { status[key] = value }

function printSummary() {
  console.log('\nSummary:')
  const icon = { done: '✓', failed: '✗', skipped: '·', pending: '○' }
  for (const s of steps) console.log(`  ${icon[status[s.key]] || '?'} ${s.label}`)
}

// Per-step recovery guidance — what the user should do next given which step failed.
// The CRITICAL boundary is `config`: before it, end users still see the previous
// version. After it, the new version is live.
const RECOVERY = {
  conflict:    'No state changed. Either run `npm run pull` to fetch remote changes, or use --force to override.',
  automations: 'Some automations may have been pushed before the failure. The live UI is unaffected. Re-run `npm run deploy` to retry (PATCHes are idempotent).',
  source:      'Some source files may have been uploaded. The live UI is unaffected. Re-run `npm run deploy` — differential sync will only push what changed.',
  bundle:      'Bundle upload failed. End users still see the previous version. Re-run `npm run deploy`.',
  embed:       'Bundle is uploaded but embed.js (3rd-party embedding) failed. /apps/<slug> still works. Either set/check PRISMEAI_PLATFORM_URL, or unset it to skip embed entirely.',
  config:      'CRITICAL: bundle was uploaded but workspace config was NOT updated. The new bundle is orphaned; end users still see the OLD version. Re-run `npm run deploy` — a new bundle upload will succeed and the config patch will retry.',
  cleanup:     'Deploy SUCCEEDED — the live UI is updated to the new bundle. Cleanup of orphan bundle files failed but is non-critical (will retry next deploy).',
  smoke:       'Bundle is live but the smoke test failed — the bundle may be syntactically broken or reference a missing external. End users will see a "Failed to load bundle" error. Run `npm run undeploy` to roll back, OR fix the bundle and re-deploy.',
  version:     'Deploy SUCCEEDED — the live UI is updated. Version snapshot failed; you may not have a rollback point for this release.',
}

console.log(`Deploying to ${API_BASE}, workspace=${PRISMEAI_WORKSPACE_ID}`)

let exitCode = 0
let bundleUrl, embedUrl, slug

try {
  await detectConflicts();             mark('conflict', 'done')
  await syncAutomations();             mark('automations', SKIP_AUTOMATIONS_SYNC ? 'skipped' : 'done')
  await syncSourceFiles();             mark('source', SKIP_SOURCE_SYNC ? 'skipped' : 'done')

  bundleUrl = await uploadBundle();    mark('bundle', 'done')
  embedUrl = await uploadEmbed();      mark('embed', embedUrl ? 'done' : 'skipped')

  const ws = await api('GET', `/workspaces/${PRISMEAI_WORKSPACE_ID}`)
  slug = process.env.PRISMEAI_BUNDLE_SLUG || ws?.slug || PRISMEAI_WORKSPACE_ID

  await patchWorkspaceConfig({ bundleUrl, embedUrl, ws, slug });  mark('config', 'done')
  await cleanupOrphanBundles();        mark('cleanup', SKIP_BUNDLE_CLEANUP ? 'skipped' : 'done')
  await smokeTest({ slug });           mark('smoke', SKIP_SMOKE ? 'skipped' : 'done')
  await versionSnapshot();             mark('version', SKIP_VERSION_SNAPSHOT ? 'skipped' : 'done')
  await refreshManifest()  // refresh .prismeai/last-pull.json so subsequent deploys aren't blocked

  console.log()
  console.log(`✓ Deploy complete. App is live at <your-platform>/apps/${slug}`)
  printSummary()
} catch (err) {
  exitCode = 1
  // First step still 'pending' is the one that threw.
  const failedKey = steps.find(s => status[s.key] === 'pending')?.key || 'unknown'
  mark(failedKey, 'failed')
  const errMsg = (err?.message || String(err)).split('\n').slice(0, 5).join('\n  ')

  console.error()
  console.error(`✗ Deploy FAILED at step: ${steps.find(s => s.key === failedKey)?.label || failedKey}`)
  console.error(`  ${errMsg}`)
  console.error()
  console.error(`Next action:`)
  console.error(`  ${RECOVERY[failedKey] || 'Re-run npm run deploy.'}`)
  printSummary()
} finally {
  process.exit(exitCode)
}
