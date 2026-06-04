# AI Governance v2

AI Governance v2 is the one-product control plane for organization IAM, org-scoped permissions, API credentials, service accounts, audit search, platform/workspace observability, and targeted announcements.

**Workspace:** `ai-governance-v2` (`KOGm-LL`)

## Endpoint Model

| Native API Gateway `/v2` | Governance workspace webhooks |
|--------------------------|--------------------------------|
| `GET /v2/me`, `PUT /v2/user/active-org` | Cross-workspace helpers: `v1/internal/check-membership`, `v1/internal/check-group`, `v1/orgs/active` |
| Orgs, members, roles, groups, invites, SSO, subscriptions | Audit: `v1/orgs/:orgSlug/audit` |
| API keys: list/create/update/revoke/rotate/validate | Observability: dashboard, feed, issues, traces, platform summary, top workspaces |
| Service accounts: list/create/update/delete/rotate/token | `search-events` wrapper around native events search |
| Platform users and contacts | Announcements and notifications |

## IAM And Access

`GET /v2/me` returns active org context, membership, role/permissions, ACL, branding/navigation, LLM settings, and subscription context. Org admins manage organizations, members, roles, groups, invites, SSO, subscriptions, branding, navigation, and audit access through native org-scoped endpoints.

API keys are org-scoped credentials with permission arrays, optional scopes, owner metadata, expiration, revoke, rotate, and validation flows. Service accounts are org-scoped machine identities that can exchange a client secret for a short-lived JWT.

## Audit And Observability

Audit logs remain a workspace endpoint backed by event search. Observability remains workspace-backed and returns health, metrics, errors, costs, usage, and metadata from cached/on-demand aggregation. `search-events` accepts Elasticsearch query DSL with safeguards and is used by one-product workspaces for aggregation and diagnostics.

## Replaces Legacy Governance Wording

Use: "AI Governance v2 manages org IAM and operational governance for Agent Factory, Storage, LLM Gateway, and AI Insights."
