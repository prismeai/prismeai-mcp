import { useEffect, useState, useCallback } from 'react'
import type { AppProps } from './types'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { Copy, Check, Eye, EyeOff } from 'lucide-react'
import { t } from '@/lib/i18n'

/**
 * Salesforce Next — connector config SPA (model B: direct platform API).
 *
 * Auth is stored as a single tenant secret object `salesforceNextAuth`
 * ({mode, loginHost, jwtUsername, oauthClientId, oauthClientSecret,
 * jwtPrivateKey, accessToken, instanceUrl}); the mode select drives which fields
 * show. Reads/writes the tenant secrets straight through the platform API with
 * the user's session — the platform enforces the user's rights natively. All
 * user-facing strings go through `t()` (src/lib/i18n.ts).
 */

const CONNECTOR_NAME = 'Salesforce Next'

type Props = AppProps & { appInstanceSlug?: string; connectorSlug?: string }
type Mode = 'jwt' | 'clientCredentials' | 'accessToken' | 'oauth'
interface AuthConfig {
  mode: Mode
  loginHost?: string
  jwtUsername?: string
  oauthClientId?: string
  oauthClientSecret?: string
  jwtPrivateKey?: string
  accessToken?: string
  instanceUrl?: string
  scopes?: string
}
interface Agent {
  id: string
  name?: string
}

const AUTH_SECRET = 'salesforceNextAuth'
const ALLOWLIST_SECRET = 'salesforceNextAuthorizedAgents'

// Available auth modes (labels localized via t('mode.<value>')).
const MODES: { value: Mode }[] = [
  { value: 'jwt' },
  { value: 'clientCredentials' },
  { value: 'oauth' },
  { value: 'accessToken' },
]

// Per-mode field set. `secret` fields render as password inputs. Labels are
// localized via t('field.<key>'); placeholders are technical examples (literal).
const FIELDS: Record<Mode, { key: keyof AuthConfig; secret?: boolean; area?: boolean; placeholder?: string }[]> = {
  jwt: [
    { key: 'loginHost', placeholder: 'https://login.salesforce.com' },
    { key: 'jwtUsername', placeholder: 'integration@org.com' },
    { key: 'oauthClientId', secret: true, placeholder: '3MVG9…' },
    { key: 'jwtPrivateKey', secret: true, area: true, placeholder: '-----BEGIN RSA PRIVATE KEY-----' },
  ],
  clientCredentials: [
    { key: 'loginHost', placeholder: 'https://login.salesforce.com' },
    { key: 'oauthClientId', secret: true, placeholder: '3MVG9…' },
    { key: 'oauthClientSecret', secret: true, placeholder: '••••••' },
  ],
  oauth: [
    { key: 'loginHost', placeholder: 'https://login.salesforce.com' },
    { key: 'oauthClientId', secret: true, placeholder: '3MVG9…' },
    { key: 'oauthClientSecret', secret: true, placeholder: '••••••' },
    { key: 'scopes', placeholder: 'api refresh_token offline_access' },
  ],
  accessToken: [
    { key: 'instanceUrl', placeholder: 'https://myorg.my.salesforce.com' },
    { key: 'accessToken', secret: true, placeholder: '00D…' },
  ],
}



function resolveHost(sdk: AppProps['sdk']): string {
  if (sdk?.host) return sdk.host
  const o = window.location.origin
  return o.replace('https://', 'https://api.').replace('http://', 'http://api.') + '/v2'
}
function readParam(name: string): string {
  return new URLSearchParams(window.location.search).get(name) || ''
}
function apiHeaders(sdk: AppProps['sdk']): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (sdk?.token) h['Authorization'] = 'Bearer ' + sdk.token
  const csrf = (sdk as { _csrfToken?: string })?._csrfToken
  if (csrf) h['x-prismeai-csrf-token'] = csrf
  return h
}

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false)
  return (
    <Button
      variant="outline"
      size="icon"
      className="shrink-0"
      title={ok ? t('copied') : t('copy')}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setOk(true)
          setTimeout(() => setOk(false), 1500)
        } catch {
          /* clipboard unavailable */
        }
      }}
    >
      {ok ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
    </Button>
  )
}

// Password input with an eye toggle to reveal/hide the value.
function SecretInput({ id, value, onChange, placeholder }: { id: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        className="pr-10"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide' : 'Show'}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

function ConfigApp(props: Props) {
  const { sdk, workspace } = props
  const host = resolveHost(sdk)
  const appInstanceSlug = props.appInstanceSlug || readParam('appInstance')
  // RAW workspace id — used ONLY for /security/secrets: that endpoint does NOT
  // resolve a `slug:<slug>` ref to the raw id, so a slug-addressed secret is
  // stored under "slug:<slug>" and the runtime (which reads by raw id) never
  // finds it. configAppUrl passes the raw id for exactly this.
  const tenantId = readParam('workspaceId') || workspace.id
  // Tenant slug for the third-party-facing URLs. Exposed endpoints use the
  // slug:<slug> form by DEFAULT — the slug survives a re-import (the workspace id
  // changes on every re-import while debugging an install; the slug stays stable),
  // so a slug-form callback stays valid across attempts. NEVER fall back to
  // `workspace.*`: in an installed-app config page that prop is the app's OWN
  // service workspace, not the tenant. Init from the configAppUrl `workspaceSlug`
  // param; if absent, resolve from the raw id in the effect below.
  const [tenantSlug, setTenantSlug] = useState(readParam('workspaceSlug') || '')
  const slugRef = tenantSlug ? `slug:${tenantSlug}` : tenantId
  const mcpEndpoint = `${host}/workspaces/${slugRef}/webhooks/${appInstanceSlug}.mcp`
  const secretsUrl = `${host}/workspaces/${tenantId}/security/secrets`
  const agentFactory = `${host}/workspaces/slug:agent-factory/webhooks/v1`
  // Our own webhooks (oauthConnect/Status/Disconnect, testAuth, …) use the
  // slug:<slug> form — the runtime resolves the slug on /webhooks/, and slug is
  // re-import stable.
  const wh = (slug: string) => `${host}/workspaces/${slugRef}/webhooks/${appInstanceSlug}.${slug}`
  // OAuth callback: slug:<slug> by default (re-import / rename stable). EXCEPTION
  // — for a MICROSOFT ENTRA connector use `tenantId` (raw id) instead: Entra
  // rejects the `:` of slug:<slug> in a redirect URI. See the powerbi connector.
  const oauthCallbackUrl = wh('oauthCallback')

  const [auth, setAuth] = useState<AuthConfig>({ mode: 'jwt' })
  const [agents, setAgents] = useState<Agent[]>([])
  const [authorized, setAuthorized] = useState<Set<string>>(new Set())
  const [allowAll, setAllowAll] = useState(false)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [agentSearch, setAgentSearch] = useState('')
  const [installingId, setInstallingId] = useState<string | null>(null)
  const [installed, setInstalled] = useState<Set<string>>(new Set())
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string; where: 'top' | 'auth' | 'agents' } | null>(null)
  const [loading, setLoading] = useState(true)
  const [sfConnected, setSfConnected] = useState<boolean | null>(null)
  const [sfInstance, setSfInstance] = useState<string>('')

  const banner = (where: 'top' | 'auth' | 'agents') =>
    msg && msg.where === where ? (
      <div
        className={
          'rounded-md px-3 py-2 text-sm ' +
          (msg.kind === 'ok' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-destructive/10 text-destructive')
        }
      >
        {msg.text}
      </div>
    ) : null

  const set = (k: keyof AuthConfig, v: string) => setAuth((a) => ({ ...a, [k]: v }))

  async function copyEndpoint() {
    try {
      await navigator.clipboard.writeText(mcpEndpoint)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(secretsUrl, { headers: apiHeaders(sdk), credentials: 'include' })
      if (r.status === 403 || r.status === 401) throw new Error(t('msg.notAllowed'))
      const secrets = (await r.json()) || {}
      const a = (secrets[AUTH_SECRET]?.value as AuthConfig) || {}
      setAuth({ ...a, mode: (a.mode as Mode) || 'jwt' })
      const csv = String(secrets[ALLOWLIST_SECRET]?.value || '')
      const ids = csv.split(',').map((s) => s.trim()).filter(Boolean)
      setAllowAll(ids.includes('*'))
      setAuthorized(new Set(ids.filter((s) => s !== '*')))
      const ar = await fetch(`${host}/workspaces/slug:agent-factory/webhooks/v1/agents?scope=own`, {
        headers: apiHeaders(sdk),
        credentials: 'include',
      })
      const data = await ar.json().catch(() => ({}))
      if (!ar.ok) {
        setMsg({ where: 'top', kind: 'err', text: t('msg.listAgentsFail', { status: ar.status, detail: data?.message || data?.error || '' }).trim() })
      }
      // agent-factory v1/agents returns { items, total, page, limit }
      const list: any[] = Array.isArray(data) ? data : data.items || data.agents || data.list || data.results || []
      setAgents(list.map((x: any) => ({ id: x.id, name: x.name })))
    } catch (e: any) {
      setMsg({ where: 'top', kind: 'err', text: e?.message || String(e) })
    } finally {
      setLoading(false)
    }
  }, [secretsUrl, host, sdk])

  useEffect(() => {
    if (!tenantId || !appInstanceSlug) {
      setLoading(false)
      return
    }
    void loadAll()
  }, [tenantId, appInstanceSlug, loadAll])

  // Resolve the tenant slug from its RAW id when the configAppUrl didn't carry
  // `workspaceSlug` (old links / forced URLs). Never derive it from the
  // `workspace` prop — that's the app's own service workspace, not the tenant.
  useEffect(() => {
    if (tenantSlug || !tenantId) return
    void (async () => {
      try {
        const r = await fetch(`${host}/workspaces/${tenantId}`, { headers: apiHeaders(sdk), credentials: 'include' })
        if (!r.ok) return
        const w = await r.json().catch(() => null)
        if (w?.slug) setTenantSlug(w.slug as string)
      } catch {
        /* keep the raw-id fallback */
      }
    })()
  }, [tenantId, tenantSlug, host, sdk])

  async function patchSecret(name: string, value: unknown) {
    const r = await fetch(secretsUrl, {
      method: 'PATCH',
      headers: apiHeaders(sdk),
      credentials: 'include',
      body: JSON.stringify({ [name]: { value } }),
    })
    if (!r.ok) throw new Error(r.status === 403 ? t('msg.forbidden') : t('msg.saveFailed', { status: r.status }))
  }

  async function persistAuth() {
    // Only keep the fields relevant to the selected mode (+ mode itself).
    const keep: (keyof AuthConfig)[] = ['mode', ...FIELDS[auth.mode].map((f) => f.key)]
    const payload: AuthConfig = { mode: auth.mode }
    for (const k of keep) if (auth[k]) (payload as any)[k] = auth[k]
    await patchSecret(AUTH_SECRET, payload)
  }

  async function saveAuth() {
    setBusy(true)
    setMsg(null)
    try {
      await persistAuth()
      setMsg({ where: 'auth', kind: 'ok', text: t('msg.authSaved') })
    } catch (e: any) {
      setMsg({ where: 'auth', kind: 'err', text: e?.message || String(e) })
    } finally {
      setBusy(false)
    }
  }

  // Save the OAuth creds, then open the connect endpoint in a popup so the user
  // completes the Salesforce login (per-user token stored by oauthCallback).
  async function connectOAuth() {
    setBusy(true)
    setMsg(null)
    try {
      await persistAuth()
      window.open(wh('oauthConnect'), 'sfn_oauth', 'width=620,height=760')
      setMsg({ where: 'auth', kind: 'ok', text: t('msg.oauthPopup') })
    } catch (e: any) {
      setMsg({ where: 'auth', kind: 'err', text: e?.message || String(e) })
    } finally {
      setBusy(false)
    }
  }

  // Read the current user's Salesforce OAuth connection status (oauth mode only).
  async function checkOAuth() {
    try {
      const r = await fetch(wh('oauthStatus'), { headers: apiHeaders(sdk), credentials: 'include' })
      const d = await r.json().catch(() => ({}))
      setSfConnected(!!d?.connected)
      setSfInstance(d?.instanceUrl || '')
    } catch {
      setSfConnected(null)
    }
  }

  // Open the disconnect popup (revokes + clears the token); status re-checks on return.
  function disconnectOAuth() {
    window.open(wh('oauthDisconnect'), 'sfn_oauth', 'width=620,height=520')
  }

  // Reflect connection state: check on entering oauth mode + when the popup
  // returns focus to this window.
  useEffect(() => {
    if (loading || auth.mode !== 'oauth') {
      setSfConnected(null)
      return
    }
    checkOAuth()
    const onFocus = () => checkOAuth()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, auth.mode])

  // Save the creds, then resolve auth + make a lightweight Salesforce call to
  // verify they work (non-OAuth modes).
  async function testConn() {
    setBusy(true)
    setMsg(null)
    try {
      await persistAuth()
      const r = await fetch(wh('testAuth'), { method: 'POST', headers: apiHeaders(sdk), credentials: 'include' })
      const d = await r.json().catch(() => ({}))
      if (d?.ok) setMsg({ where: 'auth', kind: 'ok', text: t('msg.testOk') })
      else setMsg({ where: 'auth', kind: 'err', text: d?.error || t('msg.testFail', { status: r.status }) })
    } catch (e: any) {
      setMsg({ where: 'auth', kind: 'err', text: e?.message || String(e) })
    } finally {
      setBusy(false)
    }
  }

  // Tick/untick an agent and persist the allowlist immediately — same live-save
  // UX as the "allow all" toggle (no separate save button). Optimistic update
  // with rollback if the PATCH fails.
  async function toggleAgent(id: string) {
    const prev = authorized
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setAuthorized(next)
    setBusy(true)
    setMsg(null)
    try {
      await patchSecret(ALLOWLIST_SECRET, Array.from(next).join(','))
      setMsg({ where: 'agents', kind: 'ok', text: t('msg.allowlistSaved', { n: next.size }) })
    } catch (e: any) {
      setAuthorized(prev)
      setMsg({ where: 'agents', kind: 'err', text: e?.message || String(e) })
    } finally {
      setBusy(false)
    }
  }

  // Toggle the allow-all sentinel: "*" in the allowlist disables the agent gate
  // entirely (any agent may call the MCP endpoint). Persisted immediately.
  async function toggleAllowAll(next: boolean) {
    setBusy(true)
    setMsg(null)
    setAllowAll(next)
    try {
      await patchSecret(ALLOWLIST_SECRET, next ? '*' : Array.from(authorized).join(','))
      setMsg({ where: 'agents', kind: 'ok', text: next ? t('msg.allowAllOn') : t('msg.allowAllOff') })
    } catch (e: any) {
      setAllowAll(!next)
      setMsg({ where: 'agents', kind: 'err', text: e?.message || String(e) })
    } finally {
      setBusy(false)
    }
  }

  // Install the MCP capability onto an agent: (1) ensure it's allowlisted,
  // (2) add an MCP tool pointing at this connector's endpoint. No key: the agent
  // identity is the scope-injected agent_id (agent-factory sets it server-side),
  // checked against the tenant allowlist by validateAgent.
  async function installCapability(a: Agent) {
    setInstallingId(a.id)
    setMsg(null)
    try {
      // 1. ensure allowlisted (so validateAgent passes for this agent) — unless
      //    "allow all" is on (the "*" sentinel already authorizes everyone; don't
      //    overwrite it with an explicit list).
      if (!allowAll) {
        const next = new Set(authorized)
        next.add(a.id)
        setAuthorized(next)
        await patchSecret(ALLOWLIST_SECRET, Array.from(next).join(','))
      }

      // 2. remove any existing instance of this capability (idempotent re-install:
      //    otherwise POST returns DUPLICATE_NAME and a stale tool would persist).
      const gr = await fetch(`${agentFactory}/agents/${a.id}/tools`, { headers: apiHeaders(sdk), credentials: 'include' })
      const gd = await gr.json().catch(() => ({}))
      const current: any[] = Array.isArray(gd) ? gd : gd.items || gd.tools || []
      const stale = current.filter((tool) => tool && (tool.name === 'salesforce_next' || tool.server === mcpEndpoint))
      for (const tool of stale) {
        if (tool.id) {
          await fetch(`${agentFactory}/agents/${a.id}/tools/${tool.id}`, {
            method: 'DELETE',
            headers: apiHeaders(sdk),
            credentials: 'include',
          })
        }
      }

      // 3. add the MCP tool to the agent (names + endpoint + scope; no key).
      //    For per-user OAuth, attach the capability `auth` block so agent-factory
      //    drives the per-user connect/status/disconnect flow against this connector.
      const toolBody: Record<string, unknown> = {
        type: 'mcp',
        name: 'salesforce_next',
        display_name: CONNECTOR_NAME,
        description: 'Salesforce CRM (REST API) via MCP.',
        server: mcpEndpoint,
        scope: 'context_id,agent_id,user_id',
      }
      if (auth.mode === 'oauth') {
        toolBody.auth = {
          type: 'oauth',
          status_url: wh('oauthStatus'),
          connect_url: wh('oauthConnect'),
          disconnect_url: wh('oauthDisconnect'),
          scopes: (auth.scopes || 'api refresh_token offline_access').split(/[\s,]+/).filter(Boolean),
        }
      }
      const tr = await fetch(`${agentFactory}/agents/${a.id}/tools`, {
        method: 'POST',
        headers: apiHeaders(sdk),
        credentials: 'include',
        body: JSON.stringify(toolBody),
      })
      const td = await tr.json().catch(() => ({}))
      if (!tr.ok) {
        throw new Error(t('msg.installFail', { status: tr.status, detail: td?.message || td?.error || '' }).trim())
      }
      setInstalled((prev) => new Set(prev).add(a.id))
      setMsg({ where: 'agents', kind: 'ok', text: t('msg.capInstalled', { name: a.name || a.id }) })
    } catch (e: any) {
      setMsg({ where: 'agents', kind: 'err', text: e?.message || String(e) })
    } finally {
      setInstallingId(null)
    }
  }

  if (!tenantId || !appInstanceSlug) {
    return (
      <div className="flex justify-center p-6">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>{CONNECTOR_NAME}</CardTitle>
            <CardDescription>{t('missingContext')}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const inputCls =
    'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

  const q = agentSearch.trim().toLowerCase()
  const filteredAgents = q
    ? agents.filter((a) => (a.name || '').toLowerCase().includes(q) || a.id.toLowerCase().includes(q))
    : agents

  // OAuth `auth` block to paste when creating the capability manually in
  // Governance > Org > Capabilities (enables the per-user connect with the right URLs).
  const oauthCapabilityJson = JSON.stringify(
    {
      type: 'oauth',
      status_url: wh('oauthStatus'),
      connect_url: wh('oauthConnect'),
      disconnect_url: wh('oauthDisconnect'),
      scopes: (auth.scopes || 'api refresh_token offline_access').split(/[\s,]+/).filter(Boolean),
    },
    null,
    2,
  )

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex justify-center p-6">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>
              {CONNECTOR_NAME} — {t('title.config')}
            </CardTitle>
            <CardDescription>
              {t('workspace')} {tenantId}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {banner('top')}

            {loading ? (
              <p className="text-sm text-muted-foreground">{t('loading')}</p>
            ) : (
              <>
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">{t('auth.title')}</h3>
                  <div className="space-y-1.5">
                    <Label htmlFor="mode">{t('auth.method')}</Label>
                    <select id="mode" className={inputCls} value={auth.mode} onChange={(e) => set('mode', e.target.value)}>
                      {MODES.map((m) => (
                        <option key={m.value} value={m.value}>
                          {t('mode.' + m.value)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-sm text-muted-foreground">{t('preamble.' + auth.mode)}</p>
                  {auth.mode === 'oauth' && (
                    <div className="space-y-1.5">
                      <Label>{t('auth.callbackLabel')}</Label>
                      <div className="flex items-start gap-2">
                        <code className="block flex-1 break-all rounded-md border bg-muted px-3 py-2 font-mono text-xs">{oauthCallbackUrl}</code>
                        <CopyBtn text={oauthCallbackUrl} />
                      </div>
                    </div>
                  )}
                  {FIELDS[auth.mode].map((f) => (
                    <div key={f.key} className="space-y-1.5">
                      <Label htmlFor={f.key}>{t('field.' + f.key)}</Label>
                      {f.area ? (
                        <Textarea
                          id={f.key}
                          className="h-28 font-mono text-xs"
                          value={(auth[f.key] as string) || ''}
                          onChange={(e) => set(f.key, e.target.value)}
                          placeholder={f.placeholder}
                        />
                      ) : f.secret ? (
                        <SecretInput
                          id={f.key}
                          value={(auth[f.key] as string) || ''}
                          onChange={(v) => set(f.key, v)}
                          placeholder={f.placeholder}
                        />
                      ) : (
                        <Input
                          id={f.key}
                          type="text"
                          value={(auth[f.key] as string) || ''}
                          onChange={(e) => set(f.key, e.target.value)}
                          placeholder={f.placeholder}
                        />
                      )}
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Button disabled={busy} onClick={saveAuth}>
                      {t('btn.saveAuth')}
                    </Button>
                    {auth.mode === 'oauth' ? (
                      sfConnected ? (
                        <Button variant="ghost" disabled={busy} onClick={disconnectOAuth}>
                          {t('btn.disconnect')}
                        </Button>
                      ) : (
                        <Button variant="outline" disabled={busy} onClick={connectOAuth}>
                          {t('btn.connect')}
                        </Button>
                      )
                    ) : (
                      <Button variant="outline" disabled={busy} onClick={testConn}>
                        {t('btn.testConn')}
                      </Button>
                    )}
                  </div>
                  {auth.mode === 'oauth' && sfConnected && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      {t('auth.connected', { instance: sfInstance ? ` — ${sfInstance}` : '' })}
                    </p>
                  )}
                  {banner('auth')}
                </section>

                <Separator />

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">{t('mcp.title')}</h3>
                  <p className="text-sm text-muted-foreground">{t('mcp.useUrl')}</p>
                  <div className="flex items-start gap-2">
                    <code className="block flex-1 break-all rounded-md border bg-muted px-3 py-2 font-mono text-xs">{mcpEndpoint}</code>
                    <Button variant="outline" size="icon" className="shrink-0" title={copied ? t('copied') : t('copy')} onClick={copyEndpoint}>
                      {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">{t('mcp.scopeHint')}</p>
                  {auth.mode === 'oauth' && (
                    <div className="space-y-1.5 pt-1">
                      <Label>{t('mcp.oauthCapTitle')}</Label>
                      <p className="text-sm text-muted-foreground">{t('mcp.oauthCapHint')}</p>
                      <div className="flex items-start gap-2">
                        <pre className="block flex-1 overflow-auto rounded-md border bg-muted px-3 py-2 font-mono text-xs whitespace-pre">{oauthCapabilityJson}</pre>
                        <CopyBtn text={oauthCapabilityJson} />
                      </div>
                    </div>
                  )}
                </section>

                <Separator />

                <section className="space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold">
                      {t('agents.title')}
                      {allowAll ? '' : ` (${authorized.size})`}
                    </h3>
                    <p className="text-sm text-muted-foreground">{t('agents.subtitle')}</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="accent-primary" checked={allowAll} disabled={busy} onChange={(e) => toggleAllowAll(e.target.checked)} />
                    <span>{t('agents.allowAll')}</span>
                  </label>
                  {allowAll && (
                    <div className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
                      {t('agents.allowAllWarning')}
                    </div>
                  )}
                  {!allowAll &&
                    (agents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t('agents.none')}</p>
                    ) : (
                      <>
                        <Input
                          type="search"
                          placeholder={t('agents.search')}
                          value={agentSearch}
                          onChange={(e) => setAgentSearch(e.target.value)}
                        />
                        <div className="max-h-56 overflow-auto rounded-md border divide-y divide-border">
                          {filteredAgents.length === 0 ? (
                            <p className="px-3 py-2 text-sm text-muted-foreground">{t('agents.noMatch', { q: agentSearch })}</p>
                          ) : (
                            filteredAgents.map((a) => (
                              <div key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent">
                                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                                  <input
                                    type="checkbox"
                                    className="shrink-0 accent-primary"
                                    checked={authorized.has(a.id)}
                                    disabled={busy}
                                    onChange={() => toggleAgent(a.id)}
                                  />
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="truncate">{a.name || a.id}</span>
                                    </TooltipTrigger>
                                    <TooltipContent className="font-mono">{a.id}</TooltipContent>
                                  </Tooltip>
                                </label>
                                {authorized.has(a.id) && (
                                  <Button
                                    size="sm"
                                    variant={installed.has(a.id) ? 'outline' : 'outline'}
                                    className="ml-auto shrink-0"
                                    disabled={installingId === a.id}
                                    onClick={() => installCapability(a)}
                                  >
                                    {installingId === a.id ? t('btn.installing') : installed.has(a.id) ? t('btn.reinstall') : t('btn.install')}
                                  </Button>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    ))}
                  {banner('agents')}
                </section>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}

// OAuth connect/disconnect result screen (popup). Auto-closes after 5s.
function OAuthCallbackView({ status, message }: { status: string; message: string }) {
  const [secs, setSecs] = useState(5)
  useEffect(() => {
    const timer = setInterval(() => setSecs((s) => (s > 0 ? s - 1 : 0)), 1000)
    const closer = setTimeout(() => window.close(), 5000)
    return () => {
      clearInterval(timer)
      clearTimeout(closer)
    }
  }, [])
  const ok = status === 'connected'
  const disconnected = status === 'disconnected'
  const icon = ok ? '✅' : disconnected ? '🔌' : '⛔'
  const title = ok ? t('cb.connected') : disconnected ? t('cb.disconnected') : t('cb.failed')
  return (
    <div className="flex justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <div className="text-4xl">{icon}</div>
          <CardTitle>{title}</CardTitle>
          {message && <CardDescription className="break-words">{message}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-3 text-center">
          <p className="text-sm text-muted-foreground">{t('cb.autoclose', { secs })}</p>
          <Button variant="outline" onClick={() => window.close()}>
            {t('btn.closeNow')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default function App(props: Props) {
  // OAuth connect/disconnect callbacks redirect here with ?view=oauthCallback&status=…
  if (readParam('view') === 'oauthCallback') {
    return <OAuthCallbackView status={readParam('status')} message={readParam('message')} />
  }
  return <ConfigApp {...props} />
}
