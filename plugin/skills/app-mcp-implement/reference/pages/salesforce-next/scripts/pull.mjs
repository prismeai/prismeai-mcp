#!/usr/bin/env node
/**
 * Pull workspace artifacts → local repo.
 *
 * The inverse of npm run deploy. Useful when:
 *   - A teammate edited an automation in the in-builder Builder
 *   - Source files were modified server-side
 *   - You want to bootstrap from an existing workspace
 *
 *   1. GET /v2/workspaces/:id (returns full DSUL incl. automations as object)
 *      → write each automation to automations/<slug>.yml
 *
 *   2. GET /v2/workspaces/:id/files?metadata.type=source
 *      → for each, download URL → write to local at metadata.path
 *
 *   3. Write .prismeai/last-pull.json with hash manifest (for future conflict
 *      detection in deploy — not yet enforced in v0.1).
 *
 * Required env: same as deploy.mjs (PRISMEAI_API_URL, PRISMEAI_ACCESS_TOKEN, PRISMEAI_WORKSPACE_ID).
 *
 * ⚠ This OVERWRITES local files without confirmation. Commit your local
 *   changes first, then `git diff` after pull to review what was fetched.
 */

import dotenv from 'dotenv'
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const AUTOMATIONS_DIR = path.join(ROOT, 'automations')

// Multi-env: same logic as deploy.mjs — pick .env.<name> if --env=<name> or
// PRISMEAI_ENV is set, else .env.
function loadEnv() {
  const argEnv = process.argv.find(a => a.startsWith('--env='))?.slice(6)
  const envName = argEnv || process.env.PRISMEAI_ENV || ''
  const candidates = envName ? [`.env.${envName}`] : ['.env']
  for (const rel of candidates) {
    const abs = path.join(ROOT, rel)
    if (existsSync(abs)) {
      dotenv.config({ path: abs })
      console.log(`· using ${rel}${envName ? ` (env=${envName})` : ''}`)
      return
    }
  }
  if (envName) { console.error(`✗ Env file not found: .env.${envName}`); process.exit(1) }
}
loadEnv()

// Sanity: AUTOMATIONS_DIR resolved at root
const MANIFEST_PATH = path.join(ROOT, '.prismeai/last-pull.json')

const { PRISMEAI_API_URL, PRISMEAI_ACCESS_TOKEN, PRISMEAI_API_KEY, PRISMEAI_WORKSPACE_ID } = process.env
const SKIP_AUTOMATIONS = process.env.PRISMEAI_SKIP_AUTOMATIONS_SYNC === 'true'
const SKIP_SOURCE = process.env.PRISMEAI_SKIP_SOURCE_SYNC === 'true'

function fail(msg) {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

if (!PRISMEAI_API_URL) fail('Missing PRISMEAI_API_URL in .env')
if (!PRISMEAI_ACCESS_TOKEN && !PRISMEAI_API_KEY) fail('Missing PRISMEAI_ACCESS_TOKEN or PRISMEAI_API_KEY in .env')
if (!PRISMEAI_WORKSPACE_ID) fail('Missing PRISMEAI_WORKSPACE_ID in .env')

const API_BASE = PRISMEAI_API_URL.replace(/\/$/, '')
const AUTH_HEADERS = PRISMEAI_ACCESS_TOKEN
  ? { Authorization: `Bearer ${PRISMEAI_ACCESS_TOKEN}` }
  : { 'x-prismeai-api-key': PRISMEAI_API_KEY }

// HTTP timeout + retry — same policy as deploy.mjs (kept inline so the script
// stays standalone; if a third script appears, factor out to scripts/lib/).
const HTTP_TIMEOUT_MS = parseInt(process.env.PRISMEAI_HTTP_TIMEOUT || '30000', 10)
const HTTP_MAX_RETRIES = parseInt(process.env.PRISMEAI_HTTP_RETRIES || '3', 10)

async function fetchWithRetry(url, init = {}) {
  let lastError = ''
  for (let attempt = 0; attempt <= HTTP_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const waitMs = 1000 * Math.pow(2, attempt - 1)
      console.warn(`  ↻ retry ${attempt}/${HTTP_MAX_RETRIES} for ${init.method || 'GET'} ${url} after ${waitMs}ms (last: ${lastError})`)
      await new Promise(r => setTimeout(r, waitMs))
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS)
    let res
    try {
      res = await fetch(url, { ...init, signal: controller.signal })
    } catch (err) {
      clearTimeout(timer)
      lastError = err?.name === 'AbortError' ? `timeout after ${HTTP_TIMEOUT_MS}ms` : (err?.message || String(err))
      continue
    }
    clearTimeout(timer)
    // 4xx — return immediately, caller will fail() (no retry on deterministic errors)
    if (res.status >= 400 && res.status < 500) return res
    // 5xx — retry
    if (res.status >= 500) { lastError = `${res.status} ${res.statusText}`; continue }
    return res
  }
  fail(`${init.method || 'GET'} ${url} failed after ${HTTP_MAX_RETRIES + 1} attempts: ${lastError}`)
}

async function api(method, pathSuffix) {
  const res = await fetchWithRetry(`${API_BASE}${pathSuffix}`, { method, headers: AUTH_HEADERS })
  if (!res.ok) fail(`${method} ${pathSuffix} → ${res.status} ${res.statusText}\n${await res.text().catch(() => '')}`)
  if (res.status === 204) return null
  const ct = res.headers.get('content-type') || ''
  return ct.includes('application/json') ? res.json() : res.text()
}

async function fetchText(url) {
  const res = await fetchWithRetry(url, { headers: AUTH_HEADERS })
  if (!res.ok) fail(`GET ${url} → ${res.status}`)
  return res.text()
}

function sha256(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

async function ensureDir(filePath) {
  await mkdir(path.dirname(filePath), { recursive: true })
}

console.log(`Pulling from ${API_BASE}, workspace=${PRISMEAI_WORKSPACE_ID}`)

// Manifest format: server-side hashes only. The deploy script compares these
// against the workspace's CURRENT `metadata.hash` (source files) and
// `checksum` (automations) to detect remote edits since the last pull.
const manifest = {
  pulledAt: new Date().toISOString(),
  workspaceId: PRISMEAI_WORKSPACE_ID,
  automations: {},   // slug → server checksum
  sourceFiles: {},   // path → server metadata.hash
}

// ---------------------------------------------------------------------------
// 1. Pull automations
// ---------------------------------------------------------------------------

// Server-managed fields the API returns but that mustn't go back into YAML
// (they're recomputed/owned by the server).
const SERVER_FIELDS = new Set(['events', 'updatedBy', 'updatedAt', 'createdBy', 'createdAt', 'checksum'])

function stripServerFields(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (!SERVER_FIELDS.has(k)) out[k] = v
  }
  return out
}

if (!SKIP_AUTOMATIONS) {
  console.log(`→ Fetching workspace automations`)
  // /workspaces/:id returns SUMMARY automations (no `do`/`output`).
  // We need per-slug GETs for the full body.
  const ws = await api('GET', `/workspaces/${PRISMEAI_WORKSPACE_ID}`)
  const slugs = Object.keys(ws?.automations || {})

  if (slugs.length === 0) {
    console.log('  (none)')
  } else {
    for (const slug of slugs) {
      const full = await api('GET', `/workspaces/${PRISMEAI_WORKSPACE_ID}/automations/${encodeURIComponent(slug)}`)
      const clean = stripServerFields({ slug, ...full })
      const yamlContent = yaml.dump(clean, { lineWidth: -1, quotingType: "'" })
      const filePath = path.join(AUTOMATIONS_DIR, `${slug}.yml`)
      await ensureDir(filePath)
      await writeFile(filePath, yamlContent, 'utf8')
      // Use the server's checksum from the summary view (set at server-side
      // on every automation update). This is what conflict detection compares.
      manifest.automations[slug] = ws.automations[slug]?.checksum
      console.log(`  ← automations/${slug}.yml`)
    }
  }
} else {
  console.log('· automations pull skipped (PRISMEAI_SKIP_AUTOMATIONS_SYNC=true)')
}

// ---------------------------------------------------------------------------
// 2. Pull source files (metadata.type=source)
// ---------------------------------------------------------------------------

if (!SKIP_SOURCE) {
  console.log(`→ Fetching source files`)
  const params = new URLSearchParams({ limit: '1000', 'metadata.type': 'source' })
  const list = await api('GET', `/workspaces/${PRISMEAI_WORKSPACE_ID}/files?${params}`)
  const files = Array.isArray(list) ? list : list?.result || []

  if (files.length === 0) {
    console.log('  (none)')
  } else {
    for (const f of files) {
      const relPath = f.metadata?.path || f.name
      if (!relPath) continue
      const content = await fetchText(f.url)
      const abs = path.join(ROOT, relPath)
      await ensureDir(abs)
      await writeFile(abs, content, 'utf8')
      // Server's metadata.hash — set by deploy on upload, refreshed on Builder save
      manifest.sourceFiles[relPath] = f.metadata?.hash
      console.log(`  ← ${relPath}`)
    }
  }
} else {
  console.log('· source pull skipped (PRISMEAI_SKIP_SOURCE_SYNC=true)')
}

// ---------------------------------------------------------------------------
// 3. Manifest (for future conflict detection)
// ---------------------------------------------------------------------------

await ensureDir(MANIFEST_PATH)
await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8')

console.log()
console.log(`✓ Pull complete. Review with: git status && git diff`)
console.log(`  Manifest: .prismeai/last-pull.json (used by future conflict detection)`)
