---
name: app-mcp-update-all
description: Find every Prisme.ai App+MCP connector workspace (by the `app-mcp` label) and check each one against the current `app-mcp` skill templates + best-practice rules, reporting drift and applying approved fixes. The connectors are the workspaces scaffolded by `/app-mcp`; this skill keeps the whole fleet in sync when a template or trap-fix lands. Use when the user says "update all app-mcp connectors", "vérifie que les connecteurs sont à jour", "propage le fix de template à tous les connecteurs", "/app-mcp-update-all", or similar.
argument-hint: "[?connector-slug] [?sandbox|prod]"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, Agent, mcp__prisme-ai-builder__search_workspaces, mcp__prisme-ai-builder__pull_workspace, mcp__prisme-ai-builder__push_workspace, mcp__prisme-ai-builder__validate_automation, mcp__prisme-ai-builder__update_app_instance_config, mcp__prisme-ai-builder__get_prisme_documentation
---

# App + MCP fleet updater

You maintain the **fleet of App+MCP connector workspaces** scaffolded by the `/app-mcp` skill. When a template gets a new trap-fix or security hardening, the deployed connectors drift out of date one by one. This skill finds them all, diffs each against the current templates **and** a rule checklist, and applies the approved fixes.

The **source of truth** is `.claude/skills/app-mcp/templates/` plus that skill's *Common traps* + *MCP endpoint security checklist*. Read `app-mcp/SKILL.md` if you are unsure why a given fix exists — every rule in the audit script traces back to a trap documented there.

Default operating mode (confirmed conventions):
- **Discovery** is by the `app-mcp` label, with a structural-fingerprint fallback for bootstrap (see Phase 1).
- **Detection** is hybrid: a YAML-normalized verbatim diff of the shared template files **plus** a rule audit that survives per-connector customization.
- **Action** is report-first: produce a per-connector drift report, then apply only the approved mechanical fixes and push per connector after human validation.

This skill never blind-overwrites a connector file. A "verbatim" template can still carry an intentional local addition (e.g. `webdav` adds a `viewer` role to `security.yml`) — every diff hunk is classified before anything is written.

---

## The 18+ connectors (current fleet)

These carry the app-mcp fingerprint (`automations/generateKey.yml` + `imports/MCP Core.yml`): data-galaxy, figma, gitlab, gitlab-oauth, google-docs, google-drive, google-mail, gryzzly, hubspot, monday, sage-x3, salesforce, service-now, sonarqube, storage-client, tableau, webdav (+ any new one since). **None carry the `app-mcp` label yet** — Phase 6 retro-tags them, and the `app-mcp` skill now stamps the label on creation.

---

## File classes (what the diff means)

`scripts/audit_connector.py` maps each template file onto the connector and tags it:

| Class | Files | Diff semantics |
|-------|-------|----------------|
| **A — verbatim** | `security.yml`, `automations/formatToolOutput.yml`, `automations/generateKey.yml` | Post-substitution they should be byte-identical. A `DRIFT` is **either** a template-ahead fix to apply **or** an intentional local addition to preserve — classify per hunk. |
| **B — customized** | `getConfig`, `handleApiError`, `routeToolCall`, `buildAppAuth`, `executeApiCall`, `mcp`, `onInstall`, `imports/Custom Code.yml` | Genuinely per-(auth-model / REST-vs-GraphQL / OAuth). Diff is **advisory** — never auto-apply; cross-check against the rule audit and the relevant trap before touching. |
| **O — OAuth-only** | `ensureAuthentication`, `oauthCallback`, `refreshOAuthToken`, `initiateOAuth`, `checkAuthStatus`, `disconnectOAuth`, `method/tool-connect`, `method/tool-disconnect`, `connect`, `disconnect` | Compared only when the connector has `automations/oauthCallback.yml`. Customized per provider — advisory. |
| **C — per-workspace** | `index.yml`, `swagger.yml`, `automations/<op>.yml`, `imports/MCP Core.yml`, `pages/*` | Never diffed against a template. Covered by the rule audit instead. |

> ⚠️ Do **not** use shell `diff` to compare files in this repo — it is rtk-proxied into a custom format without `<`/`>` markers, which silently produces false negatives. **Always use the audit script's YAML-normalized diff.**

---

## The audit script

`scripts/audit_connector.py` runs on **one** connector and prints a compact markdown report (two sections: rule audit + template diff). It is read-only.

```bash
python3 .claude/skills/app-mcp-update-all/scripts/audit_connector.py \
  --connector prismeai-workspaces/workspaces/<slug> \
  --templates .claude/skills/app-mcp/templates
```

The rule audit codes (all trace to `app-mcp/SKILL.md`):

| Code | Severity | Checks |
|------|----------|--------|
| `R1-label` | MAJOR | `index.yml labels` contains `app-mcp` |
| `R2-mcpApiKey` | MAJOR | `config.value.mcpApiKey` absent (else it defeats onInstall's guard) |
| `R3-array-items` | MAJOR | no `type: array` without `items:` in `index.yml` mcpTools |
| `R4-mcpcore-mirror` | MAJOR | `imports/MCP Core.yml` mcpTools mirror `index.yml` (runtime source of truth) |
| `R5-triggerSync` | MAJOR | no `automations/triggerSync.yml` (incompatible with dispatcher pattern) |
| `R6-cc-array` | MAJOR | no `type: array` in any Custom Code function `parameters` |
| `R7-cc-hash` | MAJOR | no `#` comment inside any Custom Code `code: |` block |
| `R8-ternary` | NEED_HUMAN | no ternary `? :` inside a DSUL `{% %}`/`{{ }}` expression |
| `R9-raw-body` | NEED_HUMAN | `handleApiError` does not echo raw `json(response.body)` |
| `R10-secret` | NEED_HUMAN | credential-bearing `config.schema` fields are `secret: true` |
| `R11/R12-oauth` | NEED_HUMAN | (OAuth only) getConfig `{{`-guard + onInstall populates `oauthCallbackUrl` |
| `R13-secret-provision` | NEED_HUMAN | onInstall auto-wires the per-tenant **Secrets-section ↔ app-instance** binding for any connection credential — **PAT / token / apiKey / password / clientSecret / OAuth client secret**, not just OAuth (`makeSecretRef`/`makeConfigRef` + PATCH `/security/secrets` + PATCH `/config` binding B + binding A in the terminal merge). Absent = relies on direct config-form entry (value visible in the form, no redaction). Canonical: `google-docs`. See memory `feedback_oninstall_secret_provisioning`. |
| `R14-literal-braces` | MAJOR | No literal `{{` inside a DSUL expression/condition (the `matches "{{"` binding-literal guard). It crashes `InvalidVariableNameError` (`..`) on the unconfigured path when the tested value is itself an unresolved `{{…}}` literal. Detect the brace in Custom Code instead (`cleanCredential` helper). Latent in every OAuth getConfig from the old template. See memory `feedback-dsul-literal-braces-in-expr`. |
| `R15-public-page` | MAJOR | A page in `pages/` using `accessControl: public` (a silently-ignored field) without `labels:\n  - public`. The `security.yml` rule grants anonymous read via `conditions.labels.$in:[public]`, so the page needs the **label** — otherwise it stays members-only and any non-owner (e.g. a colleague completing OAuth on `connector-callback`) hits the `pages` service **401**. Mechanical fix: replace `accessControl: public` → `labels: [public]`. See memory `feedback_prisme_public_page_label`. |
| `R16-arg-descriptions` | NEED_HUMAN | A public App-mode op (`<op>.yml`) has `arguments:` entries without a `description:`. The Builder renders the instruction form from these `arguments`, so an undescribed arg shows a blank-hint field (the classic bare `id` complaint). Fix is connector-specific content (API-sourced; `id`/`iid` described by their specific resource — project/user/group), so NOT mechanical — surface per connector. Canonical pass: `gitlab` (script `scripts/doc_gitlab_args.py`). See memory `feedback_app_mcp_arg_descriptions`. |
| `R17-private-endpoints` | MAJOR | An internal automation (`mcp`, `generateKey`, `getConfig`, `onInstall`, the helpers, the `method-*`/`tool-*` dispatchers, OAuth flow webhooks) is missing `private: true`, so it surfaces in the App's instructions list (a bare `<App>.generateKey` etc. callable by tenants). Mechanical fix: add `private: true` (it hides from instructions but does NOT block the `endpoint:` webhook nor event triggers). The public per-op instructions + `connect`/`disconnect` stay non-private. |

🔴 MAJOR = mechanical, safe to fix and push. 🟠 NEED_HUMAN = surface to the user before touching.

If the rule checklist grows (a new trap lands in `app-mcp`), add the rule to the script — keep it the single executable definition of "up to date".

---

## Workflow — 6 phases

### Phase 1 — Discover the connectors

1. Ask the environment if `$ARGUMENTS` doesn't specify it (default **prod** here — the connectors are `production:app`; this skill audits the live fleet, unlike most workspace work which defaults to sandbox).
2. **Label-first**: `search_workspaces({environment, labels: "app-mcp"})`.
3. **Bootstrap fallback** — if that returns 0 (the label convention isn't seeded yet), discover by structural fingerprint instead: list `prismeai-workspaces/workspaces/*/automations/generateKey.yml` locally, and/or `search_workspaces({environment, labels: "MCP"})` then keep only those whose pulled tree has both `automations/generateKey.yml` and `imports/MCP Core.yml`. Report which discovery path was used.
4. If `$ARGUMENTS` names a single connector slug, scope the whole run to it (still useful for one-off propagation).
5. List the resolved connector set to the user before proceeding.

### Phase 2 — Refresh local copies

The audit compares against the **deployed** state, so refresh from the env first (don't trust a possibly-stale local checkout). For each connector, `pull_workspace` into its **canonical** path `prismeai-workspaces/workspaces/<slug>/` (never an orphan dir — see memory `feedback_pull_workspace_canonical_path`). If the user explicitly wants to audit the local working copy as-is, skip the pull and say so.

### Phase 3 — Audit each connector

Run `scripts/audit_connector.py` on every connector (parallelize with one `Bash` call per connector, or a small loop). For a large fleet, dispatch the runs across `Agent` (Explore) sub-agents to keep the main context lean — each returns only its connector's report.

Collect the raw reports. Do **not** act yet.

### Phase 4 — Classify drift → per-connector report

For each connector, turn the script output into a decision list:

- **Rule audit** — MAJOR findings become 🔴 fixes; NEED_HUMAN become 🟠 questions.
- **Class A diff** — read each hunk and label it:
  - **template-ahead** (the connector lacks something the template now has, e.g. the `json("")`/HTTP-204 guard, the `action` op branch) → 🔴 apply.
  - **workspace-ahead** (the connector has an intentional local addition the template lacks, e.g. webdav's extra `viewer` role, a service-specific verbose message) → preserve; never delete it. If a single file mixes both (gryzzly's `formatToolOutput` is missing the guard *and* has a custom create message), apply only the template-ahead hunks by hand.
- **Class B / O diff** — advisory only. Raise as 🟠 *"`<file>` differs from the template — likely a customization, confirm whether a template-ahead fix is buried in it"* unless a rule-audit finding pins a concrete bug, in which case fix that specific bug, not the whole file.
- **Class C** — already covered by the rule audit.

Produce one consolidated report: a table (connector × number of 🔴 / 🟠 / clean) plus, per non-clean connector, the bulleted 🔴/🟠 list. Reference files by path; never dump full files.

### Phase 5 — Apply approved fixes + push

Only after the user approves the report:

1. Apply the 🔴 mechanical fixes per connector (label add, `mcpApiKey` removal, `items:` addition, `type:object` swap, `#`→`//`, MCP Core re-mirror, template-ahead hunk transplant). Edit in the canonical workspace folder.
2. For Class A *full* replacements (truly identical, no workspace-ahead hunk), copy the template content with the 4 placeholders substituted (`<<SERVICE_NAME>>`, `<<SERVICE_SLUG>>`, `<<WORKSPACE_ID>>`, `<<BASE_URL>>`).
3. If you touched `index.yml` mcpTools, re-mirror `imports/MCP Core.yml` (Phase 4 step 10 of `app-mcp`).
4. `validate_automation` on the changed automations. Must be clean (webhook "no arguments" warnings are fine).
5. **Per-connector review sub-task** (CLAUDE.md convention): launch a code-review agent on the diff, get MAJOR / NEED_HUMAN issues. 🔴 fix them, 🟠 ask.
6. `push_workspace` per connector to its env (the one discovered in Phase 1). Use a short message (`tmpl-sync`, `add-204-guard`, …, ≤15 chars). Re-run the script on that connector to confirm the drift is gone.

**Push caution**: `push_workspace` re-imports the whole tree and re-runs the App-publish (expect the benign `Missing photo` only if `photo` is empty). Any connector carrying a React/bundle artifact in `config.value` must keep it (none of the current connectors do, but verify — see memory `feedback_app_dev_patch_replaces_config` / `feedback_ui_deploy_resets_bundle`). Push connectors **one at a time**, confirming each before the next — never bulk-push the fleet blind.

### Phase 6 — Seed the `app-mcp` label (bootstrap, once)

The discovery convention only works once the label exists. As part of the first run:
1. For each discovered connector missing the label (rule `R1-label`), add `app-mcp` to `index.yml` `labels:` (keep the existing labels — `MCP`, `production:app`, the service name, etc.), then `push_workspace`. This is itself one of the 🔴 fixes from Phase 5, so fold it into that push rather than a separate one.
2. The `app-mcp` skill has been patched to stamp `app-mcp` into the `labels` of every `create_workspace` call, so new connectors are tagged automatically — no future bootstrap needed.

After this run, Phase 1's label-first discovery returns the full fleet on its own.

---

## Guardrails

- **Never blind-overwrite.** Verbatim ≠ identical — `security.yml` (webdav adds roles), `formatToolOutput.yml` (per-service messages) carry intentional local content. Transplant template-ahead hunks; preserve workspace-ahead ones.
- **The audit script is the executable spec.** When a new trap lands in `app-mcp`, add the rule to `scripts/audit_connector.py` rather than carrying it only in prose — that's how the fleet stays checkable.
- **`imports/MCP Core.yml` is the runtime source for `tools/list`,** not `index.yml`. Any mcpTools change must update both, then push (push = sync). Never add `triggerSync.yml` (see memory `feedback_mcp_core_dispatcher_incompatible`).
- **Custom Code is fragile**: a single `type: array` parameter or one `#` in a `code:` block breaks the *entire* module silently (every function "not found"). These are R6/R7 MAJORs — fix on sight.
- **OAuth files are provider-specific.** A Class-O diff is almost always legitimate customization; only act on a concrete R11/R12 finding.
- **Push one connector at a time**, validate + smoke-confirm each, and prefer **report-first** even when the user says "update all" — confirm the consolidated report before the first write.

---

## Output format

- After Phase 4, post the consolidated table (connector × 🔴/🟠/clean) + per-connector bullets. Ask for approval before Phase 5.
- After Phase 5, per connector: files changed (by path), fixes applied, push message, and the post-push re-audit result (should be clean or only-NEED_HUMAN).
- Final summary: connectors updated, fixes propagated (grouped by rule/template), connectors left untouched and why, and confirmation the `app-mcp` label is now seeded across the fleet.
