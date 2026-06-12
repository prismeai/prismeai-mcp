# Central platform OAuth client — token-service pattern

Lifted verbatim from the validated `google-workspaces` connector (xjROdh7, sandbox;
E2E-verified on tenant w6UiyHw, 2026-06-12). Gives every OAuth connector a
zero-config tenant mode (`oauthCentral`, default): the platform maintainer
provisions ONE provider OAuth client from the core workspace Builder, tenants
just click Connect.

## Why a token service (read first)

App instances inherit the source workspace's `config.value` as defaults, BUT
`{{secret.X}}` refs interpolate **against the RUNNING workspace's secret store**
(SKILL.md Gotcha 26). A core secret binding therefore stays a literal string in
every tenant — the central client secret can never reach tenants through config.
So the core serves it **operationally**:

- `getOAuthClientPublic` — public webhook: `{configured, clientId, scopes}`. Never the secret.
- `centralTokenExchange` — proxies the provider token endpoint, injecting the
  central `client_id`/`client_secret` server-side (grants: `authorization_code`+PKCE,
  `refresh_token`). The secret never leaves the core. `emitErrors: false` on its
  fetch is MANDATORY (else the secret leaks into `runtime.fetch.failed` events).
- `setOAuthClient` — maintainer webhook writing the core declared secret
  `<camel>CentralOAuth = {oauthClientId, oauthClientSecret, scopes}`.
  **Fail-closed role gate** (`user.role` ∈ owner/editor/admin, absent = 403):
  the PATCH below runs with a privileged `auth: workspace: true` JWT, so the
  caller's RBAC is NOT re-checked by the platform.
- `resolveOAuthClient` — called from tenant context: tenant `config.auth` client
  (full override) → else central via the public webhook. Returns
  `{oauthClientId, oauthClientSecret?, scopes, redirectUri, tokenUrl, central}`.
  `tokenUrl` = provider token URL (tenant client / core fast-path) or the
  `centralTokenExchange` webhook (tenant on central client).

## Single redirect URI + callback proxy

With the central client, the authorize `redirect_uri` is ALWAYS the **core**
callback (`{{global.apiUrl}}/workspaces/slug:<slug>/webhooks/oauthCallback`) —
the only URI to register at the provider. `oauthConnect` packs the tenant
instance's callback into the OAuth `state` (`packOAuthState`:
`<random>.<b64url(url)>`); the core `oauthCallback` PROXY role 302s code+state
to that callback (`unpackOAuthState` validates the target is an
`*oauthCallback` webhook on OUR api host — anti open-redirect). The PKCE
`code_verifier` lives in the tenant user-scope `oauthPending` and the exchange
happens tenant-side via `tokenUrl` — a malicious workspace receiving a stray
code cannot exchange it (no verifier).

## Wiring checklist (placeholders: `google-workspaces` → `<slug>`, `googleWorkspaces` → `<camel>`, `gws` → `<pfx>`)

1. `index.yml config.value`: `centralAuth: '{{secret.<camel>CentralOAuth}}'`.
2. Copy the 6 automations; swap the Google token/authorize URLs for the provider's.
3. Custom Code: add `packOAuthState`/`unpackOAuthState` (see
   `customcode-packOAuthState.yml.snippet`).
4. `buildAppAuth`: alias `oauthCentral` → `oauth` early; `resolveOAuthClient`
   at the top of the oauth branch; both refresh fetches use
   `url: '{% {{oc.tokenUrl}} || {{tokenUri}} %}'` + `oc.oauthClientId/Secret`.
5. `oauthStatus`: exclude BOTH `oauth` and `oauthCentral` from the non-oauth
   fast path.
6. SPA: `oauthCentral` mode (first + default, FIELDS = scopes only),
   `isOAuthMode()` gating, MaintainerSetup view on `!readParam('workspaceId')`
   (see `MaintainerSetup-excerpt.tsx`), i18n keys (en+fr).
7. Re-`publish_app` after any core config/automation change — instances run the
   published snapshot (Gotcha 26 / 18-cache).

Known accepted trade-offs: `centralTokenExchange` is unauthenticated (it can't
mint tokens without a valid code+verifier or an already-stolen refresh token,
but it is a low-severity quota amplifier on the central client); the central
client secret is readable by core workspace editors via the maintainer view
(by design, gmail-reply-agent parity).
