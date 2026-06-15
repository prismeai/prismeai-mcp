#!/usr/bin/env node
/**
 * Remove a deployed app from a workspace.
 *
 * Inverse of deploy step 5 (config patch). Removes `bundles[<slug>]` from
 * `workspace.config.value` so AppRenderer no longer serves the app at
 * /apps/<slug>. Source files and automations are left intact (those are
 * managed by deploy/pull and may be shared across multiple bundles).
 *
 * Usage:
 *   npm run undeploy                  # remove bundles[<workspace.slug>]
 *   npm run undeploy -- --slug=foo    # remove bundles[foo]
 *   npm run undeploy -- --purge-files # also DELETE the bundle/embed files
 *
 * Required env: same as deploy.mjs (PRISMEAI_API_URL, PRISMEAI_ACCESS_TOKEN,
 * PRISMEAI_WORKSPACE_ID). Multi-env supported via --env=<name>.
 */

import dotenv from 'dotenv'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

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

const { PRISMEAI_API_URL, PRISMEAI_ACCESS_TOKEN, PRISMEAI_API_KEY, PRISMEAI_WORKSPACE_ID } = process.env
const SLUG_OVERRIDE = process.argv.find(a => a.startsWith('--slug='))?.slice(7)
const PURGE = process.argv.includes('--purge-files')

function fail(msg) { console.error(`✗ ${msg}`); process.exit(1) }

if (!PRISMEAI_API_URL) fail('Missing PRISMEAI_API_URL in .env (must include /v2 suffix)')
if (!PRISMEAI_ACCESS_TOKEN && !PRISMEAI_API_KEY) {
  fail('Missing auth: set PRISMEAI_ACCESS_TOKEN (preferred) or PRISMEAI_API_KEY')
}
if (!PRISMEAI_WORKSPACE_ID) fail('Missing PRISMEAI_WORKSPACE_ID')

const API_BASE = PRISMEAI_API_URL.replace(/\/$/, '')
const AUTH = PRISMEAI_ACCESS_TOKEN
  ? { Authorization: `Bearer ${PRISMEAI_ACCESS_TOKEN}` }
  : { 'x-prismeai-api-key': PRISMEAI_API_KEY }

async function api(method, p, body) {
  const res = await fetch(`${API_BASE}${p}`, {
    method,
    headers: { ...AUTH, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) fail(`${method} ${p} → ${res.status}\n${await res.text().catch(() => '')}`)
  if (res.status === 204) return null
  const ct = res.headers.get('content-type') || ''
  return ct.includes('application/json') ? res.json() : res.text()
}

console.log(`Undeploying from ${API_BASE}, workspace=${PRISMEAI_WORKSPACE_ID}`)

const ws = await api('GET', `/workspaces/${PRISMEAI_WORKSPACE_ID}`)
const slug = SLUG_OVERRIDE || ws?.slug || PRISMEAI_WORKSPACE_ID
const existingConfig = ws?.config?.value || {}
const existingBundles = existingConfig.bundles || {}
const target = existingBundles[slug]

if (!target) {
  console.log(`· bundles[${slug}] not present — nothing to undeploy`)
  process.exit(0)
}

console.log(`→ Removing bundles[${slug}]`)
console.log(`  bundle was: ${target.bundle}`)
if (target.embed) console.log(`  embed was:  ${target.embed}`)

const newBundles = { ...existingBundles }
delete newBundles[slug]

await api('PATCH', `/workspaces/${PRISMEAI_WORKSPACE_ID}`, {
  config: { value: { ...existingConfig, bundles: newBundles } },
})

console.log(`✓ Workspace config updated. /apps/${slug} no longer serves a bundle.`)

if (PURGE) {
  console.log(`→ Purging bundle/embed files`)
  const list = await api('GET', `/workspaces/${PRISMEAI_WORKSPACE_ID}/files?limit=1000`)
  const files = Array.isArray(list) ? list : list?.result || []
  const toDelete = files.filter(f =>
    f.public === true &&
    (f.url === target.bundle || (target.embed && f.url === target.embed))
  )
  for (const f of toDelete) {
    await api('DELETE', `/workspaces/${PRISMEAI_WORKSPACE_ID}/files/${encodeURIComponent(f.id)}`)
    console.log(`  ✗ ${f.url}`)
  }
  console.log(`✓ Purged ${toDelete.length} file(s)`)
} else {
  console.log()
  console.log(`Note: bundle/embed files NOT deleted (run with --purge-files to also remove them).`)
  console.log(`The orphan-bundle cleanup at next \`npm run deploy\` will remove them automatically.`)
}
