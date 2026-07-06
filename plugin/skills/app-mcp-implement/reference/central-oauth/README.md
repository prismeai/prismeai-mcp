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
  **Fail-closed role gate** (`user.role` ∈ owner/editor/admin **OR
  `user.platformRole = "superadmin"`**, absent = 403): the PATCH below runs with a
  privileged `auth: workspace: true` JWT, so the caller's RBAC is NOT re-checked by
  the platform. `user.role` is only the *workspace-direct* role, so the
  `platformRole` clause lets platform SuperAdmins (and org-inherited owners are a
  separate gap) operate the view without a direct per-workspace grant.
- `maintainerStatus` — read webhook the SPA calls FIRST to decide whether to
  show the maintainer form. Returns `{allowed}` from the SAME `user.role` gate as
  `setOAuthClient`, plus the public `clientId`/`scopes` for prefill (NEVER the
  secret). **Do NOT gate the SPA on `GET /security/secrets`** — that returns an
  empty `200 {}` for non-privileged users (not 403), so the form would render to
  everyone (SKILL.md Gotcha 28).
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
2. Copy the 7 automations; swap the Google token/authorize URLs for the provider's.
3. Custom Code: add `packOAuthState`/`unpackOAuthState` (see
   `customcode-packOAuthState.yml.snippet`).
4. `buildAppAuth`: alias `oauthCentral` → `oauth` early; `resolveOAuthClient`
   at the top of the oauth branch; both refresh fetches use
   `url: '{% {{oc.tokenUrl}} || {{tokenUri}} %}'` + `oc.oauthClientId/Secret`.
5. `oauthStatus`: exclude BOTH `oauth` and `oauthCentral` from the non-oauth
   fast path.
6. SPA: `oauthCentral` mode (first + default, FIELDS = scopes only),
   `isOAuthMode()` gating, MaintainerSetup view on `!readParam('workspaceId')`
   (see `MaintainerSetup-excerpt.tsx`) — **gated on `maintainerStatus` (Gotcha 28):
   non-maintainers get an "Access restricted" card, never the form** — i18n keys
   (en+fr, incl. `maint.noAccessTitle`/`maint.noAccessBody`).
7. `validateAgent`: first step short-circuits to `{valid:true, reason:'global_endpoint'}`
   when `{{config.centralAuth.oauthClientId}}` is set, so the CORE/global MCP
   endpoint accepts every agent (the allowlist is a tenant-only concern; per-user
   OAuth is the global gate). No-op in tenants — `centralAuth` is a literal there
   (Gotcha 26/29).
8. Re-`publish_app` after any core config/automation change — instances run the
   published snapshot (Gotcha 26 / 18-cache).

## One-click publish to the Capabilities catalog (`CatalogPublish`)

The maintainer view also exposes an **"Add to catalog"** button
(`src/CatalogPublish.tsx`, copied from the salesforce-next reference) that
registers the connector in the org-wide **Capabilities catalog** (workspace
`capabilities`, `3ueUyns`) — the registry Agent Factory reads when a builder adds
a catalog-backed tool. The platform's own central-OAuth connectors (Figma, Gitlab,
Google Search) ARE exactly such entries.

- **API**: `GET|POST /workspaces/slug:capabilities/webhooks/v1/servers` (+ `PATCH
  /…/:id`). An `mcp` entry's `config_schema.properties.server.default` IS the MCP
  endpoint; OAuth connectors add an `auth` block `{type:'oauth2', status_url,
  connect_url, disconnect_url, scopes}`. **Note `oauth2`** (catalog convention) vs
  the `oauth` type used for the per-agent `POST /agents/:id/tools` install.
- **Endpoint**: the maintainer view publishes the **CORE** endpoint
  `slug:<slug>/webhooks/mcp` (no per-tenant key) + central OAuth webhooks
  (`checkAuthStatus`/`initiateOAuth`/`disconnectOAuth`) — per-user OAuth is the
  access gate (`validateAgent` global short-circuit, point 7). One entry covers the
  whole org. (A static-token / per-tenant connector mounts the SAME component in
  its tenant ConfigApp on the per-tenant `mcpEndpoint` instead.)
- **Gating ("only if it doesn't exist yet")**: on mount it `GET`s
  `?type=mcp&built_in=false` and matches an entry whose `server` default === our
  endpoint. Present → "✓ Already in the catalog" + an "Update" (PATCH) action;
  absent → an enabled "Add to catalog" (POST). The maintainer button stays
  `disabled` until the central client is saved (`cat.disabledNeedsClient`).
- **Auth/permissions**: runs with the maintainer's Studio session (Bearer + CSRF,
  `credentials:'include'`); the entry is org-scoped to their active org
  server-side. A 403 surfaces as `cat.forbidden`. The entry is **org-wide** — flag
  this in the helper text (`cat.hint`); it is NOT the per-agent install.
- **Role gate (UI stopgap)**: the catalog write API has **NO server-side role
  check** today (any authenticated org member can POST — `capabilities/_auth.yml`
  only resolves `owner_id` + `session.org.slug`). So `CatalogPublish` self-hides
  unless the user is an org **owner/admin**: it `GET`s `/me` on mount and tests
  `me.org.role.slug ∈ {org:owner, org:admin}` (`PRIVILEGED_CATALOG_ROLES`), on the
  ACTIVE org. UI-only (not a security boundary); the real fix is a role gate in the
  `capabilities` workspace DSUL. The component renders its own `cat.title` heading
  and returns `null` when hidden.
- **i18n**: `cat.*` keys (en+fr) in `src/lib/i18n.ts`.

Known accepted trade-offs: `centralTokenExchange` is unauthenticated (it can't
mint tokens without a valid code+verifier or an already-stolen refresh token,
but it is a low-severity quota amplifier on the central client); the central
client secret is readable by core workspace editors via the maintainer view
(by design, gmail-reply-agent parity).
