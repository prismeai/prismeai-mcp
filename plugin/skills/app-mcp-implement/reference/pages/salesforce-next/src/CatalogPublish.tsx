import { useCallback, useEffect, useState } from 'react'
import type { SDK } from './types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { apiHeaders } from '@/lib/utils'
import { t } from '@/lib/i18n'

/**
 * CatalogPublish — one-click "Add this connector to the Capabilities catalog".
 *
 * The Capabilities catalog (workspace `capabilities`) is the org-wide registry
 * Agent Factory reads when a builder adds a catalog-backed tool. An MCP
 * connector is registered there as a `type: mcp` entry whose
 * `config_schema.properties.server.default` is the connector's MCP endpoint
 * (and, for per-user OAuth, an `auth` block carrying the connect/status/disconnect
 * URLs). This component:
 *
 *   1. PRE-CHECKS existence — GET /v1/servers?type=mcp&built_in=false and matches
 *      an entry whose `server` default === our `serverUrl`. Gating the button on
 *      this is the "only enable if it doesn't exist yet" requirement.
 *   2. CREATES via POST /v1/servers when absent (org-scoped to the caller's active
 *      org server-side), or UPDATES via PATCH /v1/servers/:id when present (server
 *      URL / auth block may have drifted, e.g. after a workspace re-import).
 *
 * Auth: runs with the user's Studio session (Bearer + CSRF, credentials:'include')
 * — the SAME creds the SPA uses for /security/secrets. The caller must have catalog
 * write rights in their org (a 403 surfaces as a clear message).
 *
 * SCOPE CAVEAT: a catalog entry is **org-wide** — once published, every builder
 * in the org can attach the connector. That is the intended "publish" semantics
 * (distinct from the per-agent "Install capability" button, which wires ONE agent
 * via POST /agents/:id/tools). Surface this in the button's helper text.
 *
 * Generic by design — drop it into BOTH:
 *   • the tenant ConfigApp (serverUrl = the per-tenant mcpEndpoint), and
 *   • the central-OAuth MaintainerSetup view (serverUrl = the CORE
 *     slug:<slug>/webhooks/mcp endpoint, gated on `disabled` until the central
 *     client is configured) — see reference/central-oauth/MaintainerSetup-excerpt.tsx.
 */

export interface CatalogIdentity {
  /** Machine name (snake_case), e.g. `salesforce_next`. Becomes the entry `name`. */
  toolName: string
  /** Human label, e.g. `Salesforce Next`. */
  displayName: string
  description?: string
  category?: string
  iconUrl?: string
  docUrl?: string
}

/** OAuth auth block for the catalog entry. NOTE the type is `oauth2` here (the
 *  catalog convention), NOT `oauth` (the per-agent tool convention). */
export interface CatalogAuth {
  type: 'oauth2'
  status_url: string
  connect_url: string
  disconnect_url: string
  scopes?: string[]
}

interface CatalogServer {
  id?: string
  _id?: string
  name?: string
  type?: string
  built_in?: boolean
  config_schema?: { properties?: { server?: { default?: string } } }
}

export interface CatalogPublishProps {
  sdk: SDK
  /** Platform host base (…/v2), from resolveHost(sdk). */
  host: string
  identity: CatalogIdentity
  /** The MCP endpoint this entry points at — also the dedup key. */
  serverUrl: string
  /** Scope-injection field. Defaults to `context_id,agent_id,user_id`. */
  scope?: string
  /** OAuth connect flow, when the connector authenticates per-user. */
  auth?: CatalogAuth | null
  /** When true, the Add/Update button is disabled (e.g. auth not configured yet). */
  disabled?: boolean
  /** Helper shown under the button explaining a `disabled` state. */
  disabledHint?: string
}

const CATALOG_WS = 'slug:capabilities'

// STOPGAP role gate: the catalog write API (`capabilities` workspace `/v1/servers`)
// is org-scoped but currently has NO server-side role check — ANY authenticated org
// member (incl. builder/member) can POST. Until the platform enforces a role there,
// we only SHOW the "Add to catalog" button to org owners/admins. This is UI-only and
// NOT a security boundary (a privileged-enough API caller can still POST directly);
// the authoritative fix is a role gate in the capabilities workspace DSUL.
// We read the role on the ACTIVE org — the same org the write runs under server-side
// (capabilities `_auth.yml` resolves `session.org.slug`).
const PRIVILEGED_CATALOG_ROLES = ['org:owner', 'org:admin']

/** Build the `/v1/servers` body for an `mcp` catalog entry. Mirrors the shape of
 *  the platform's own custom entries (Figma, Gitlab, …). */
export function buildMcpCatalogEntry(props: Pick<CatalogPublishProps, 'identity' | 'serverUrl' | 'scope' | 'auth'>) {
  const { identity, serverUrl, scope = 'context_id,agent_id,user_id', auth } = props
  return {
    name: identity.toolName,
    display_name: identity.displayName,
    type: 'mcp' as const,
    category: identity.category,
    description: identity.description,
    icon_url: identity.iconUrl,
    documentation_url: identity.docUrl,
    config_schema: {
      type: 'object',
      required: ['name', 'server'],
      properties: {
        name: { type: 'string', title: 'Server Name', default: identity.toolName },
        server: { type: 'string', title: 'SSE/WebSocket URL', default: serverUrl },
        scope: { type: 'string', title: 'Scope', default: scope },
        headers: { type: 'object', title: 'Auth Headers (JSON)' },
      },
    },
    auth: auth || null,
  }
}

export function CatalogPublish(props: CatalogPublishProps) {
  const { sdk, host, serverUrl, disabled, disabledHint } = props
  const catalogUrl = `${host}/workspaces/${CATALOG_WS}/webhooks/v1/servers`

  const [loading, setLoading] = useState(true)
  const [existing, setExisting] = useState<CatalogServer | null>(null)
  const [checkFailed, setCheckFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  // Role gate: null = resolving (render nothing), false = hide entirely, true = show.
  const [canPublish, setCanPublish] = useState<boolean | null>(null)

  // Resolve the user's role on the ACTIVE org via /me and decide whether to show
  // the button at all. Fail-closed (hide) on error.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const r = await fetch(`${host}/me`, { headers: apiHeaders(sdk), credentials: 'include' })
        const me = (await r.json().catch(() => ({}))) || {}
        const roleSlug: string = me?.org?.role?.slug || ''
        if (!cancelled) setCanPublish(PRIVILEGED_CATALOG_ROLES.includes(roleSlug))
      } catch {
        if (!cancelled) setCanPublish(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [host, sdk])

  // Existence pre-check: match a same-org custom mcp entry on the server URL
  // (names can collide across connectors; the endpoint is the real identity).
  const check = useCallback(async () => {
    setLoading(true)
    setCheckFailed(false)
    try {
      const r = await fetch(`${catalogUrl}?type=mcp&built_in=false&limit=200`, {
        headers: apiHeaders(sdk),
        credentials: 'include',
      })
      if (!r.ok) {
        setCheckFailed(true)
        return
      }
      const d = (await r.json().catch(() => ({}))) || {}
      const items: CatalogServer[] = Array.isArray(d) ? d : d.items || d.results || []
      const found = items.find((e) => e?.config_schema?.properties?.server?.default === serverUrl) || null
      setExisting(found)
    } catch {
      setCheckFailed(true)
    } finally {
      setLoading(false)
    }
  }, [catalogUrl, serverUrl, sdk])

  // Only probe the catalog once the user is known to be privileged (avoids a
  // needless catalog GET for users who won't see the button).
  useEffect(() => {
    if (canPublish === true) void check()
  }, [check, canPublish])

  async function publish() {
    setBusy(true)
    setMsg(null)
    try {
      const body = buildMcpCatalogEntry(props)
      const id = existing?.id || existing?._id
      const url = id ? `${catalogUrl}/${encodeURIComponent(id)}` : catalogUrl
      const r = await fetch(url, {
        method: id ? 'PATCH' : 'POST',
        headers: apiHeaders(sdk),
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const d = (await r.json().catch(() => ({}))) || {}
      if (!r.ok) {
        throw new Error(r.status === 403 ? t('cat.forbidden') : t('cat.saveFailed', { status: r.status, detail: d?.error || d?.message || '' }).trim())
      }
      setExisting({ id: d?.id || d?._id || id, name: body.name, type: 'mcp', config_schema: body.config_schema })
      setMsg({ kind: 'ok', text: id ? t('cat.updated') : t('cat.added') })
    } catch (e: any) {
      setMsg({ kind: 'err', text: e?.message || String(e) })
    } finally {
      setBusy(false)
    }
  }

  // Hidden for non-privileged users (and while the role is still resolving).
  if (canPublish !== true) return null

  return (
    <div className="space-y-2 border-t pt-4">
      <Label>{t('cat.title')}</Label>
      <p className="text-sm text-muted-foreground">{t('cat.hint')}</p>
      {loading ? (
        <p className="text-sm text-muted-foreground">{t('cat.checking')}</p>
      ) : existing ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-600 dark:text-emerald-400">
            ✓ {t('cat.present')}
          </span>
          <Button variant="outline" size="sm" disabled={busy || disabled} onClick={publish}>
            {busy ? t('cat.saving') : t('cat.update')}
          </Button>
        </div>
      ) : (
        <Button disabled={busy || disabled} onClick={publish}>
          {busy ? t('cat.saving') : t('cat.add')}
        </Button>
      )}
      {disabled && disabledHint && <p className="text-xs text-muted-foreground">{disabledHint}</p>}
      {checkFailed && !existing && <p className="text-xs text-muted-foreground">{t('cat.checkFailed')}</p>}
      {msg && (
        <div
          className={
            'rounded-md px-3 py-2 text-sm ' +
            (msg.kind === 'ok' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-destructive/10 text-destructive')
          }
        >
          {msg.text}
        </div>
      )}
    </div>
  )
}
