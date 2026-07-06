// SPA excerpts (pages/<slug>/src/App.tsx) — MaintainerSetup view + router.
// Also add: Mode 'oauthCentral' (first+default, FIELDS=[scopes]), isOAuthMode() gating,
// i18n keys mode.oauthCentral / preamble.oauthCentral / maint.* (en+fr,
// incl. maint.noAccessTitle / maint.noAccessBody), and the centralSlugOf/centralRefOf helpers.
//
// IMPORT: `import { CatalogPublish, type CatalogAuth } from './CatalogPublish'`
// (src/CatalogPublish.tsx — copied from the salesforce-next reference). The
// maintainer view publishes the connector to the org Capabilities catalog using
// the CORE endpoint (slug:<slug>/webhooks/mcp, NOT a per-tenant key) — the same
// shape the platform's own central-OAuth connectors (Figma, Gitlab) use, where
// per-user OAuth is the access gate (validateAgent short-circuits to global —
// README point 7). One catalog entry covers the whole org. See cat.* i18n keys.
//
// ACCESS GATE (Gotcha 28): the maintainer view must NEVER show the editable form to a
// non-maintainer. Do NOT infer the role from GET /security/secrets — accessManager.findAll
// returns an empty 200 {} for non-privileged users (NOT 403), indistinguishable from a
// not-yet-configured maintainer. Gate on the authoritative `maintainerStatus` webhook
// (returns { allowed } from user.role, mirroring setOAuthClient). See
// reference/central-oauth/maintainerStatus.yml.

const CENTRAL_OAUTH_SECRET = 'googleWorkspacesCentralOAuth'
// Machine name for the catalog entry (snake_case, matches the connector's MCP tool name).
const CONNECTOR_TOOL_NAME = 'google_workspaces'
// The connector's OWN (core) workspace slug — STABLE across environments. Used to
// tell apart "hosted in the connector's own Builder" (maintainer view) from "hosted
// in a consumer tenant's Builder" (per-tenant config), now that the SPA can also be
// mounted inline via `config.block` (no ?workspaceId= query param). All central /
// maintainer URLs are built from this constant — never from centralSlugOf(workspace),
// which returns the TENANT slug under a config.block mount.
const CENTRAL_SLUG = 'google-workspaces'

// Maintainer setup — shown when the SPA is loaded from the CORE workspace itself
// (no ?workspaceId= tenant param, which the consumer configAppUrl always carries).
// Lets the maintainer store the central platform Google OAuth client, used as
// fallback by every tenant that does not provide its own client. The whole client
// object lives in the core declared secret `googleWorkspacesCentralOAuth`,
// resolved by resolveOAuthClient through the config.value.centralAuth binding.
function MaintainerSetup(props: Props) {
  const { sdk, workspace } = props
  const host = resolveHost(sdk)
  // The maintainer view only renders when hosted in the connector's OWN Builder
  // (router gate below), so workspace.id IS the core raw id here. /security/secrets
  // does NOT resolve slug:<slug> (it needs the raw id), so keep workspace.id.
  const coreId = workspace?.id || ''
  const secretsUrl = `${host}/workspaces/${coreId}/security/secrets`
  // MUST match resolveOAuthClient's central redirectUri exactly (registered at Google).
  const redirectUri = `${host}/workspaces/slug:${CENTRAL_SLUG}/webhooks/oauthCallback`
  const setClientUrl = `${host}/workspaces/slug:${CENTRAL_SLUG}/webhooks/setOAuthClient`
  const statusUrl = `${host}/workspaces/slug:${CENTRAL_SLUG}/webhooks/maintainerStatus`
  // CORE MCP endpoint (no per-tenant key) + central OAuth webhooks for the catalog
  // entry. Same slug used in resolveOAuthClient's central redirectUri.
  const centralSlug = CENTRAL_SLUG
  const coreMcpEndpoint = `${host}/workspaces/slug:${centralSlug}/webhooks/mcp`
  const centralWh = (s: string) => `${host}/workspaces/slug:${centralSlug}/webhooks/${s}`
  const catalogAuth: CatalogAuth = {
    type: 'oauth2',
    // MUST match the connector's actual webhook slugs (oauthConnect/oauthStatus/
    // oauthDisconnect) — NOT the legacy initiateOAuth/checkAuthStatus/disconnectOAuth
    // names. A mismatch makes the catalog entry's connect_url 404 ("no matching
    // trigger for endpoint initiateOAuth") so agents can't initiate OAuth, even though
    // the per-agent Install button (which uses wh('oauthConnect')) works. See Gotcha 33.
    status_url: centralWh('oauthStatus'),
    connect_url: centralWh('oauthConnect'),
    disconnect_url: centralWh('oauthDisconnect'),
    scopes: (scopes || GOOGLE_SCOPES).split(/[\s,]+/).filter(Boolean),
  }

  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [busy, setBusy] = useState(false)
  const [hasClient, setHasClient] = useState(false)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [scopes, setScopes] = useState('')
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        // Authoritative maintainer gate (mirrors setOAuthClient): the server checks
        // user.role (owner/editor/admin) OR user.platformRole === "superadmin" and
        // returns { allowed }. We CANNOT infer this
        // from GET /security/secrets — accessManager.findAll returns an empty 200 {}
        // for non-privileged users (not a 403), indistinguishable from a not-yet-set
        // maintainer. A non-maintainer gets the access-denied screen, never the form.
        const sr = await fetch(statusUrl, { method: 'POST', headers: apiHeaders(sdk), credentials: 'include' })
        const status = (await sr.json().catch(() => ({}))) || {}
        if (!sr.ok || !status.allowed) {
          setForbidden(true)
          return
        }
        // Prefill from the secrets store (works for maintainers; returns the secret value).
        const r = await fetch(secretsUrl, { headers: apiHeaders(sdk), credentials: 'include' })
        if (r.status === 401 || r.status === 403) {
          setForbidden(true)
          return
        }
        if (!r.ok) throw new Error(t('msg.saveFailed', { status: r.status }))
        const secrets = (await r.json().catch(() => ({}))) || {}
        const c = (secrets[CENTRAL_OAUTH_SECRET]?.value as { oauthClientId?: string; oauthClientSecret?: string; scopes?: string }) || {}
        setClientId(c.oauthClientId || '')
        setClientSecret(c.oauthClientSecret || '')
        setScopes(c.scopes || '')
        setHasClient(!!(c.oauthClientId && c.oauthClientSecret))
      } catch (e: any) {
        setMsg({ kind: 'err', text: e?.message || String(e) })
      } finally {
        setLoading(false)
      }
    })()
  }, [statusUrl, secretsUrl, sdk])

  async function save() {
    setBusy(true)
    setMsg(null)
    try {
      if (!clientId.trim()) throw new Error(t('maint.clientIdRequired'))
      if (!clientSecret.trim()) throw new Error(t('maint.clientSecretRequired'))
      const r = await fetch(setClientUrl, {
        method: 'POST',
        headers: apiHeaders(sdk),
        credentials: 'include',
        body: JSON.stringify({ clientId: clientId.trim(), clientSecret: clientSecret.trim(), scopes: scopes.trim() || GOOGLE_SCOPES }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d?.ok) throw new Error(d?.error || (r.status === 403 ? t('msg.forbidden') : t('msg.saveFailed', { status: r.status })))
      setHasClient(true)
      setMsg({ kind: 'ok', text: t('maint.saved') })
    } catch (e: any) {
      setMsg({ kind: 'err', text: e?.message || String(e) })
    } finally {
      setBusy(false)
    }
  }

  if (forbidden) {
    return (
      <div className="flex justify-center p-6">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>
              {CONNECTOR_NAME} — {t('maint.noAccessTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <span className="text-lg leading-none">⛔</span>
              <p>{t('maint.noAccessBody')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex justify-center p-6">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>
            {CONNECTOR_NAME} — {t('maint.title')}
          </CardTitle>
          <CardDescription>{t('maint.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {loading ? (
            <p className="text-sm text-muted-foreground">{t('loading')}</p>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>{t('maint.redirectLabel')}</Label>
                <div className="flex items-start gap-2">
                  <code className="block flex-1 break-all rounded-md border bg-muted px-3 py-2 font-mono text-xs">{redirectUri}</code>
                  <CopyBtn text={redirectUri} />
                </div>
                <p className="text-xs text-muted-foreground">{t('maint.redirectHint')}</p>
              </div>
              {hasClient && (
                <div className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">{t('maint.clientSet')}</div>
              )}
              {/* Publish the connector to the org Capabilities catalog (core endpoint,
                  per-user OAuth gate). Self-hides unless the user is an org owner/admin;
                  also disabled until the central client is saved. Renders its own heading. */}
              <CatalogPublish
                sdk={sdk}
                host={host}
                serverUrl={coreMcpEndpoint}
                scope="context_id,agent_id,user_id"
                auth={catalogAuth}
                disabled={!hasClient}
                disabledHint={t('cat.disabledNeedsClient')}
                identity={{ toolName: CONNECTOR_TOOL_NAME, displayName: CONNECTOR_NAME, category: 'productivity' }}
              />
              <div className="space-y-1.5">
                <Label htmlFor="m-cid">{t('field.oauthClientId')}</Label>
                <Input id="m-cid" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="…apps.googleusercontent.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-csec">{t('field.oauthClientSecret')}</Label>
                <SecretInput id="m-csec" value={clientSecret} onChange={setClientSecret} placeholder="GOCSPX-…" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-csco">{t('field.scopes')}</Label>
                <Input id="m-csco" value={scopes} onChange={(e) => setScopes(e.target.value)} placeholder={GOOGLE_SCOPES} />
                <p className="text-xs text-muted-foreground">{t('maint.scopesHint')}</p>
              </div>
              <Button disabled={busy} onClick={save}>
                {t('maint.save')}
              </Button>
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
            </>
          )}
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
  // Maintainer mode = the SPA is hosted in the connector's OWN (core) workspace
  // Builder (central OAuth client setup). Detect it by HOST IDENTITY
  // (workspace.slug === CENTRAL_SLUG), NOT by the absence of ?workspaceId=: when
  // mounted inline via `config.block` inside a consumer tenant's Builder there is no
  // query param, yet the view must be the per-tenant ConfigApp (which resolves the
  // tenant from workspace.id and the instance from props.appInstanceSlug). Gating on
  // the missing param alone would wrongly show MaintainerSetup, whose maintainerStatus
  // call then 404s on the tenant → "Access restricted". See SKILL.md Gotcha 31.
  const hostSlug = props.workspace?.slug
  const isConnectorHost = hostSlug === CENTRAL_SLUG || hostSlug === props.connectorSlug
  if (!readParam('workspaceId') && isConnectorHost) {
    return <MaintainerSetup {...props} />
  }
  return <ConfigApp {...props} />
}
