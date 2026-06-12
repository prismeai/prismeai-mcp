// SPA excerpts (pages/<slug>/src/App.tsx) — MaintainerSetup view + router.
// Also add: Mode 'oauthCentral' (first+default, FIELDS=[scopes]), isOAuthMode() gating,
// i18n keys mode.oauthCentral / preamble.oauthCentral / maint.* (en+fr), and the
// centralSlugOf/centralRefOf helpers.

const CENTRAL_OAUTH_SECRET = 'googleWorkspacesCentralOAuth'

// Maintainer setup — shown when the SPA is loaded from the CORE workspace itself
// (no ?workspaceId= tenant param, which the consumer configAppUrl always carries).
// Lets the maintainer store the central platform Google OAuth client, used as
// fallback by every tenant that does not provide its own client. The whole client
// object lives in the core declared secret `googleWorkspacesCentralOAuth`,
// resolved by resolveOAuthClient through the config.value.centralAuth binding.
function MaintainerSetup(props: Props) {
  const { sdk, workspace } = props
  const host = resolveHost(sdk)
  const coreId = workspace?.id || ''
  const secretsUrl = `${host}/workspaces/${coreId}/security/secrets`
  // MUST match resolveOAuthClient's central redirectUri exactly (registered at Google).
  const redirectUri = `${host}/workspaces/slug:${centralSlugOf(workspace) || 'google-workspaces'}/webhooks/oauthCallback`
  const setClientUrl = `${host}/workspaces/${centralRefOf(workspace)}/webhooks/setOAuthClient`

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [hasClient, setHasClient] = useState(false)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [scopes, setScopes] = useState('')
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch(secretsUrl, { headers: apiHeaders(sdk), credentials: 'include' })
        if (!r.ok) throw new Error(r.status === 403 || r.status === 401 ? t('msg.notAllowed') : t('msg.saveFailed', { status: r.status }))
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
  }, [secretsUrl, sdk])

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
  // Maintainer mode: loaded from the core workspace itself (Builder) — i.e. without
  // the tenant ?workspaceId= param, which the consumer configAppUrl always carries.
  if (!readParam('workspaceId')) {
    return <MaintainerSetup {...props} />
  }
  return <ConfigApp {...props} />
}
