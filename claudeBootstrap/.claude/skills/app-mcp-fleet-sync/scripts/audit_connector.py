#!/usr/bin/env python3
"""Audit ONE app-mcp connector workspace against the current app-mcp-implement templates.

Two outputs, both on stdout as a compact markdown report:

  1. RULE AUDIT   — grep/parse checks derived from the app-mcp-implement skill's
                    "Common traps" + "MCP endpoint security checklist".
                    Each finding is tagged MAJOR (mechanical, safe to fix) or
                    NEED_HUMAN (judgment call).

  2. TEMPLATE DIFF — for every template file that maps onto the connector,
                    a YAML-NORMALIZED comparison (keys sorted, block-scalars
                    re-folded, `description:` prose dropped, the 4 standard
                    <<PLACEHOLDER>>s substituted). Raw textual noise — key
                    reordering, fold width — is therefore neutralised, so a
                    reported DRIFT is a real structural difference.

The script never writes anything. The orchestrating skill reads the report,
classifies each diff hunk as template-ahead (apply) vs workspace-ahead
(preserve), and decides what to push.

Usage:
  audit_connector.py --connector <path/to/workspace> --templates <path/to/app-mcp-implement/templates>
"""
import argparse
import difflib
import io
import os
import re
import sys

try:
    import yaml
except ImportError:
    sys.exit("PyYAML required: pip install pyyaml")

# template-relative path -> (connector-relative path, class)
#   A = verbatim: post-substitution it should be byte-identical; any DRIFT is
#       either a template-ahead fix to apply OR an intentional local addition
#       (e.g. webdav adds a `viewer` role to security.yml) — classify per hunk.
#   B = structural but customised per auth-model / REST-vs-GraphQL / OAuth;
#       diff is ADVISORY, route through the rule audit + human review.
#   O = OAuth-only; compared only when the connector has oauthCallback.yml.
FILE_MAP = {
    "security.yml":                 ("security.yml", "A"),
    "helpers/formatToolOutput.yml": ("automations/formatToolOutput.yml", "A"),
    "helpers/generateKey.yml":      ("automations/generateKey.yml", "A"),
    "helpers/getConfig.yml":        ("automations/getConfig.yml", "B"),
    "helpers/handleApiError.yml":   ("automations/handleApiError.yml", "B"),
    "helpers/routeToolCall.yml":    ("automations/routeToolCall.yml", "B"),
    "helpers/buildAppAuth.yml":     ("automations/buildAppAuth.yml", "B"),
    "helpers/executeApiCall.yml":   ("automations/executeApiCall.yml", "B"),
    "helpers/mcp.yml":              ("automations/mcp.yml", "B"),
    "helpers/onInstall.yml":        ("automations/onInstall.yml", "B"),
    "imports/Custom-Code.yml":      ("imports/Custom Code.yml", "B"),
    # OAuth-only
    "oauth/automations/ensureAuthentication.yml": ("automations/ensureAuthentication.yml", "O"),
    "oauth/automations/oauthCallback.yml":        ("automations/oauthCallback.yml", "O"),
    "oauth/automations/refreshOAuthToken.yml":    ("automations/refreshOAuthToken.yml", "O"),
    "oauth/automations/initiateOAuth.yml":        ("automations/initiateOAuth.yml", "O"),
    "oauth/automations/checkAuthStatus.yml":      ("automations/checkAuthStatus.yml", "O"),
    "oauth/automations/disconnectOAuth.yml":      ("automations/disconnectOAuth.yml", "O"),
    "oauth/automations/method-connect.yml":       ("automations/method-connect.yml", "O"),
    "oauth/automations/method-disconnect.yml":    ("automations/method-disconnect.yml", "O"),
    "oauth/automations/tool-connect.yml":         ("automations/tool-connect.yml", "O"),
    "oauth/automations/tool-disconnect.yml":      ("automations/tool-disconnect.yml", "O"),
    "oauth/automations/connect.yml":              ("automations/connect.yml", "O"),
    "oauth/automations/disconnect.yml":           ("automations/disconnect.yml", "O"),
}

DIFF_CAP = 60  # max normalized-diff lines printed per file


def load_yaml(text):
    try:
        return yaml.safe_load(text), None
    except Exception as e:  # noqa: BLE001
        return None, str(e)


def strip_descriptions(obj):
    """Drop `description:` keys recursively — prose carries placeholders and
    is not behaviour. `comment:` instructions are kept (they are list items)."""
    if isinstance(obj, dict):
        return {k: strip_descriptions(v) for k, v in obj.items() if k != "description"}
    if isinstance(obj, list):
        return [strip_descriptions(x) for x in obj]
    return obj


def normalize(text, subs):
    for ph, val in subs.items():
        text = text.replace(ph, val)
    data, err = load_yaml(text)
    if err is not None:
        return None, err
    norm = strip_descriptions(data)
    return yaml.safe_dump(norm, sort_keys=True, default_flow_style=False,
                          allow_unicode=True), None


def derive_subs(conn_dir):
    """Best-effort placeholder values from the connector's index.yml."""
    idx_path = os.path.join(conn_dir, "index.yml")
    name = slug = wsid = ""
    base_url = ""
    if os.path.isfile(idx_path):
        with open(idx_path) as f:
            idx, _ = load_yaml(f.read())
        if isinstance(idx, dict):
            name = idx.get("name", "") or ""
            slug = idx.get("slug", "") or os.path.basename(conn_dir.rstrip("/"))
            wsid = idx.get("id", "") or ""
            cfgv = (idx.get("config") or {}).get("value") or {}
            base_url = cfgv.get("baseUrl", "") or cfgv.get("apiUrl", "") or ""
    if not slug:
        slug = os.path.basename(conn_dir.rstrip("/"))
    # camelCase service slug used in event names
    parts = re.split(r"[-_ ]", slug)
    service_slug = parts[0] + "".join(p.capitalize() for p in parts[1:]) if parts else slug
    service_name = name or "".join(p.capitalize() for p in parts)
    return {
        "<<SERVICE_NAME>>": service_name,
        "<<SERVICE_SLUG>>": service_slug,
        "<<WORKSPACE_ID>>": wsid,
        "<<BASE_URL>>": base_url,
    }


def iter_code_blocks(text):
    """Yield (line_no, body_lines) for every `code: |` block in a YAML file."""
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        m = re.search(r"\bcode:\s*\|", lines[i])
        if m:
            base = len(lines[i]) - len(lines[i].lstrip())
            start = i + 1
            body = []
            j = start
            while j < len(lines):
                ln = lines[j]
                if ln.strip() == "":
                    body.append((j + 1, ln))
                    j += 1
                    continue
                indent = len(ln) - len(ln.lstrip())
                if indent <= base:
                    break
                body.append((j + 1, ln))
                j += 1
            yield start, body
            i = j
        else:
            i += 1


def rule_audit(conn_dir, subs, is_oauth):
    """Return list of (severity, code, message)."""
    out = []
    A = lambda c, m: out.append(("MAJOR", c, m))       # noqa: E731
    H = lambda c, m: out.append(("NEED_HUMAN", c, m))  # noqa: E731

    idx_path = os.path.join(conn_dir, "index.yml")
    idx = {}
    if os.path.isfile(idx_path):
        with open(idx_path) as f:
            idx, _ = load_yaml(f.read())
            idx = idx or {}

    # R1 — app-mcp label present (the discovery convention)
    labels = idx.get("labels") or []
    if "app-mcp" not in labels:
        A("R1-label", "index.yml `labels` is missing `app-mcp` (discovery convention).")

    cfg = (idx.get("config") or {})
    cfgv = cfg.get("value") or {}

    # R2 — mcpApiKey must NOT be in config.value (defeats onInstall guard)
    if "mcpApiKey" in cfgv:
        A("R2-mcpApiKey", "`config.value.mcpApiKey` is set — defeats onInstall's "
                          "'key already generated' guard. Remove it.")

    # R3 — type:array without items in mcpTools inputSchema
    def check_array_items(tools, where):
        for t in tools or []:
            props = ((t.get("inputSchema") or {}).get("properties") or {})
            for pn, ps in props.items():
                if isinstance(ps, dict) and ps.get("type") == "array" and "items" not in ps:
                    A("R3-array-items", f"{where}: tool `{t.get('name')}` prop `{pn}` is "
                                        "`type: array` without `items:` (OpenAI/Azure reject).")
    check_array_items(cfgv.get("mcpTools"), "index.yml")

    # R4 — index.yml mcpTools must mirror imports/MCP Core.yml (runtime source of truth)
    mcp_core_path = os.path.join(conn_dir, "imports", "MCP Core.yml")
    if os.path.isfile(mcp_core_path):
        with open(mcp_core_path) as f:
            core, _ = load_yaml(f.read())
        core_tools = (((core or {}).get("config") or {}).get("mcpTools")) or []
        idx_tools = cfgv.get("mcpTools") or []
        idx_names = sorted(t.get("name") for t in idx_tools)
        core_names = sorted(t.get("name") for t in core_tools)
        if idx_names != core_names:
            A("R4-mcpcore-mirror", "`imports/MCP Core.yml` mcpTools differ from index.yml "
                                   f"(index={len(idx_names)} vs core={len(core_names)} tools). "
                                   "MCP Core is the runtime source — re-mirror.")
        check_array_items(core_tools, "imports/MCP Core.yml")
    else:
        H("R4-mcpcore-missing", "No `imports/MCP Core.yml` — MCP `tools/list` has no source.")

    # R5 — triggerSync.yml incompatible with dispatcher pattern
    if os.path.isfile(os.path.join(conn_dir, "automations", "triggerSync.yml")):
        A("R5-triggerSync", "`automations/triggerSync.yml` present — overwrites entity-grouped "
                            "mcpTools with 2 dispatcher entries. Delete it.")

    # Custom Code checks
    cc_path = os.path.join(conn_dir, "imports", "Custom Code.yml")
    if os.path.isfile(cc_path):
        with open(cc_path) as f:
            cc_text = f.read()
        cc, cc_err = load_yaml(cc_text)
        if cc_err is None and isinstance(cc, dict):
            fns = ((cc.get("config") or {}).get("functions")) or {}
            # R6 — type:array in CC parameters silently breaks the whole module
            for fname, fdef in fns.items():
                for pname, pspec in ((fdef or {}).get("parameters") or {}).items():
                    if isinstance(pspec, dict) and pspec.get("type") == "array":
                        A("R6-cc-array", f"Custom Code `{fname}.{pname}` is `type: array` — "
                                         "breaks the ENTIRE CC module. Use `type: object`.")
        # R7 — `#` comments inside code: | blocks (JS syntax error)
        for _, body in iter_code_blocks(cc_text):
            for lineno, ln in body:
                if ln.lstrip().startswith("#"):
                    A("R7-cc-hash", f"`#` comment in Custom Code code block at "
                                    f"Custom Code.yml:{lineno} — JS-invalid, breaks the module.")
    else:
        H("R7-cc-missing", "No `imports/Custom Code.yml`.")

    # Per-automation scans
    autos_dir = os.path.join(conn_dir, "automations")
    if os.path.isdir(autos_dir):
        for fn in sorted(os.listdir(autos_dir)):
            if not fn.endswith(".yml"):
                continue
            fpath = os.path.join(autos_dir, fn)
            with open(fpath) as f:
                txt = f.read()
            # R8 — ternary inside DSUL {% %} / {{ }} (NOT inside code:| blocks)
            code_line_set = set()
            for _, body in iter_code_blocks(txt):
                for lineno, _ in body:
                    code_line_set.add(lineno)
            for i, ln in enumerate(txt.splitlines(), 1):
                if i in code_line_set:
                    continue
                if re.search(r"\{[%{].*\?.*:.*[%}]\}", ln):
                    H("R8-ternary", f"Possible ternary in DSUL expr at {fn}:{i} — "
                                    "InvalidExpressionSyntax at runtime. Verify.")
                # R14 — literal "{{" inside a DSUL expression (the `matches "{{"`
                # binding-literal guard). Crashes InvalidVariableNameError (`..`)
                # when the tested value is itself an unresolved {{...}} literal
                # (unconfigured tenant). Detect the brace in Custom Code instead
                # (cleanCredential helper). See feedback-dsul-literal-braces-in-expr.
                if 'matches "{{' in ln or "matches '{{" in ln:
                    A("R14-literal-braces", f"Literal `{{{{` in a DSUL expression at {fn}:{i} "
                      "(`matches \"{{\"` guard) — crashes `..` on the unconfigured path. "
                      "Detect the binding literal in Custom Code (cleanCredential) instead.")
            # R9 — raw provider body echoed in handleApiError
            if fn == "handleApiError.yml" and re.search(r"json\(\s*\{\{\s*response\.body", txt):
                H("R9-raw-body", "handleApiError may return raw `json(response.body)` — "
                                 "can leak credential echoes. Bound the extracted fields.")

    # Collect per-tenant credential fields in config.schema. Exclude readOnly
    # auto-populated fields (mcpApiKey/mcpEndpoint/oauthCallbackUrl), the CENTRAL
    # HMAC `appSecret` (not per-tenant), and obvious non-secrets (URLs/TTLs/scopes).
    schema = (cfg.get("schema") or {})
    # NB: no bare `pat` — it substring-matches groupPath/allowedPath/patName.
    # The real secret field `patSecret` is still caught via `secret`.
    cred_re = re.compile(r"(token|secret|password|apikey|api_key|clientid|client_id|"
                         r"clientsecret|client_secret|refreshtoken)", re.I)
    nonsecret_re = re.compile(r"(url|uri|ttl|endpoint|scopes?)$", re.I)
    cred_fields = []
    for field, spec in schema.items():
        if not isinstance(spec, dict):
            continue
        if not cred_re.search(field) or nonsecret_re.search(field):
            continue
        if field in ("mcpApiKey", "mcpEndpoint", "oauthCallbackUrl", "appSecret") \
                or spec.get("readOnly"):
            continue
        cred_fields.append(field)
        # R10 — credential fields should be secret:true (redacted in events)
        if not spec.get("secret"):
            H("R10-secret", f"config.schema `{field}` looks credential-bearing but is not "
                            "`secret: true` (unredacted in events). Confirm intent.")

    # R13 — per-tenant connection secrets (PAT / token / apiKey / password /
    # clientSecret / OAuth client secret) auto-wired from the workspace Secrets
    # section to the app-instance config by onInstall (makeSecretRef/makeConfigRef
    # + PATCH /security/secrets = provision + PATCH /config = binding B + binding A
    # in the terminal merge). NOT OAuth-specific — any token-auth connector with a
    # per-tenant credential benefits. Absent = relies on the admin typing the
    # secret straight into the app-instance config form (no Secrets-section UX,
    # value visible in the form). Canonical pattern: google-docs.
    if cred_fields:
        oi_text = ""
        oi_path = os.path.join(conn_dir, "automations", "onInstall.yml")
        if os.path.isfile(oi_path):
            with open(oi_path) as f:
                oi_text = f.read()
        cc_prov = ""
        if os.path.isfile(cc_path):
            with open(cc_path) as f:
                cc_prov = f.read()
        has_provision = (
            "makeSecretRef" in cc_prov and "makeConfigRef" in cc_prov
            and "security/secrets" in oi_text and re.search(r"/config['\"]", oi_text)
        )
        if not has_provision:
            H("R13-secret-provision", "onInstall does NOT auto-provision the workspace "
              f"Secrets-section ↔ app-instance binding for per-tenant credential(s) "
              f"{cred_fields} (makeSecretRef/makeConfigRef + PATCH /security/secrets + PATCH "
              "/config). The connector relies on direct app-instance config-form entry. "
              "Consider the auto-wiring UX (canonical: google-docs) — applies to PAT/token/"
              "apiKey/password, not just OAuth.")

    # R15 — public pages must be labeled `public`, NOT `accessControl: public`.
    # `accessControl` is not a recognized Page field and is silently ignored; the
    # security.yml rule grants anonymous read via conditions.labels.$in:[public].
    # A page with only `accessControl: public` stays members-only → non-owner
    # users (e.g. a colleague completing OAuth on connector-callback) hit the
    # pages-service 401. See memory feedback_prisme_public_page_label.
    pages_dir = os.path.join(conn_dir, "pages")
    if os.path.isdir(pages_dir):
        for fn in sorted(os.listdir(pages_dir)):
            if not fn.endswith(".yml"):
                continue
            with open(os.path.join(pages_dir, fn)) as f:
                pdata, _ = load_yaml(f.read())
            if not isinstance(pdata, dict):
                continue
            plabels = pdata.get("labels") or []
            if str(pdata.get("accessControl", "")).lower() == "public" and "public" not in plabels:
                A("R15-public-page", f"pages/{fn} uses `accessControl: public` (a silently-ignored "
                  "field) without `labels:\n  - public` — the page stays members-only and non-owner "
                  "users hit the pages-service 401. Replace with `labels: [public]`.")

    # OAuth-specific
    if is_oauth:
        gc_path = os.path.join(conn_dir, "automations", "getConfig.yml")
        if os.path.isfile(gc_path):
            with open(gc_path) as f:
                gc = f.read()
            # R11 — unresolved {{secret}} guard
            if 'matches' not in gc or '{{' not in gc:
                H("R11-oauth-guard", "OAuth getConfig.yml may lack the `matches \"{{\"` guard "
                                     "that wipes unresolved secret templates. Verify.")
        oi_path = os.path.join(conn_dir, "automations", "onInstall.yml")
        if os.path.isfile(oi_path):
            with open(oi_path) as f:
                oi = f.read()
            if "oauthCallbackUrl" not in oi:
                H("R12-oauth-callback", "OAuth onInstall.yml does not populate `oauthCallbackUrl` "
                                        "readOnly config — tenant can't find the redirect URI.")

    # R15 — every App-mode op argument must carry a `description:`. The Builder
    # renders the instruction form from `arguments`, so an undescribed arg shows
    # a blank-hint field (the classic bare `id` complaint). Fix is connector-
    # specific content (API-sourced; id/iid by specific resource) → NEED_HUMAN.
    _HELP = {"mcp", "onInstall", "generateKey", "getConfig", "buildAppAuth", "executeApiCall",
             "handleApiError", "formatToolOutput", "routeToolCall", "ensureAuthentication",
             "connect", "disconnect", "initiateOAuth", "oauthCallback", "checkAuthStatus",
             "refreshOAuthToken", "disconnectOAuth"}
    autos_dir = os.path.join(conn_dir, "automations")
    undoc = []
    if os.path.isdir(autos_dir):
        for fn in sorted(os.listdir(autos_dir)):
            if not fn.endswith(".yml"):
                continue
            op = fn[:-4]
            if op in _HELP or op.startswith("method-") or op.startswith("tool-"):
                continue
            with open(os.path.join(autos_dir, fn)) as f:
                doc, _ = load_yaml(f.read())
            args = (doc or {}).get("arguments") or {}
            if not isinstance(args, dict):
                continue
            missing = [a for a, v in args.items()
                       if not (isinstance(v, dict) and str(v.get("description") or "").strip())]
            if missing:
                undoc.append((op, len(missing)))
    if undoc:
        n_args = sum(c for _, c in undoc)
        sample = ", ".join(f"{op}({c})" for op, c in undoc[:5])
        H("R16-arg-descriptions", f"{n_args} App-mode op argument(s) across {len(undoc)} op file(s) "
                                  f"lack a `description:` — the Builder instruction form renders "
                                  f"blank-hint fields (e.g. a bare `id`). Add API-sourced descriptions; "
                                  f"for id/iid use the specific resource (project/user/group). "
                                  f"e.g. {sample}.")

    # R17 — internal automations (helpers, dispatchers, 00_MCP webhooks) must be
    # `private: true`, else they surface in the App's instructions list (a bare
    # `<App>.generateKey`/`.mcp`/`.getConfig`). private:true does NOT block the
    # endpoint webhook nor event triggers — it only hides from instructions.
    PRIV = {"mcp", "generateKey", "getConfig", "onInstall", "buildAppAuth", "executeApiCall",
            "handleApiError", "formatToolOutput", "routeToolCall", "ensureAuthentication",
            "refreshOAuthToken", "oauthCallback", "initiateOAuth", "checkAuthStatus",
            "disconnectOAuth", "method-connect", "method-disconnect"}
    notpriv = []
    if os.path.isdir(autos_dir):
        for fn in sorted(os.listdir(autos_dir)):
            if not fn.endswith(".yml"):
                continue
            op = fn[:-4]
            if not (op in PRIV or op.startswith("method-") or op.startswith("tool-")):
                continue
            with open(os.path.join(autos_dir, fn)) as f:
                txt = f.read()
            if not re.search(r"^private:\s*true", txt, re.M):
                notpriv.append(op)
    if notpriv:
        more = "..." if len(notpriv) > 8 else ""
        A("R17-private-endpoints", f"{len(notpriv)} internal automation(s) missing `private: true` — "
                                   f"they leak into the App's instructions list (e.g. a bare "
                                   f"`<App>.generateKey`): {', '.join(notpriv[:8])}{more}. "
                                   f"Add `private: true` (does not block endpoint webhooks).")
    return out


def diff_files(conn_dir, templates_dir, subs, is_oauth):
    """Return list of (status, class, tmpl_rel, conn_rel, diff_text)."""
    rows = []
    for tmpl_rel, (conn_rel, cls) in FILE_MAP.items():
        if cls == "O" and not is_oauth:
            continue
        tpath = os.path.join(templates_dir, tmpl_rel)
        cpath = os.path.join(conn_dir, conn_rel)
        if not os.path.isfile(tpath):
            continue
        if not os.path.isfile(cpath):
            rows.append(("MISSING-IN-CONNECTOR", cls, tmpl_rel, conn_rel, ""))
            continue
        with open(tpath) as f:
            tnorm, terr = normalize(f.read(), subs)
        with open(cpath) as f:
            craw = f.read()
        cnorm, cerr = normalize(craw, {})
        if terr or cerr:
            # fall back to raw textual diff
            with open(tpath) as f:
                traw = f.read()
            for ph, val in subs.items():
                traw = traw.replace(ph, val)
            d = list(difflib.unified_diff(traw.splitlines(), craw.splitlines(),
                                          "template", "connector", lineterm=""))
            rows.append(("DRIFT(raw)" if d else "IDENTICAL", cls, tmpl_rel, conn_rel,
                         "\n".join(d[:DIFF_CAP])))
            continue
        if tnorm == cnorm:
            rows.append(("IDENTICAL", cls, tmpl_rel, conn_rel, ""))
        else:
            d = list(difflib.unified_diff(tnorm.splitlines(), cnorm.splitlines(),
                                          "template", "connector", lineterm=""))
            rows.append(("DRIFT", cls, tmpl_rel, conn_rel, "\n".join(d[:DIFF_CAP])))
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--connector", required=True)
    ap.add_argument("--templates", required=True)
    args = ap.parse_args()

    conn = args.connector.rstrip("/")
    slug = os.path.basename(conn)
    is_oauth = os.path.isfile(os.path.join(conn, "automations", "oauthCallback.yml"))
    subs = derive_subs(conn)

    buf = io.StringIO()
    p = buf.write
    p(f"# Audit — {slug}\n")
    p(f"auth: {'OAuth (authorization-code)' if is_oauth else 'token/basic/client-creds'}  ")
    p(f"| subs: SERVICE_NAME={subs['<<SERVICE_NAME>>']!r} "
      f"SERVICE_SLUG={subs['<<SERVICE_SLUG>>']!r}\n\n")

    findings = rule_audit(conn, subs, is_oauth)
    p("## Rule audit\n")
    if not findings:
        p("✅ no rule findings\n")
    else:
        for sev, code, msg in findings:
            icon = "🔴" if sev == "MAJOR" else "🟠"
            p(f"- {icon} **{sev}** `{code}` — {msg}\n")
    p("\n")

    rows = diff_files(conn, args.templates, subs, is_oauth)
    p("## Template diff\n")
    drift = [r for r in rows if r[0].startswith("DRIFT") or r[0] == "MISSING-IN-CONNECTOR"]
    ident = [r for r in rows if r[0] == "IDENTICAL"]
    p(f"identical: {len(ident)} | drift/missing: {len(drift)}\n\n")
    for status, cls, tmpl_rel, conn_rel, dtext in rows:
        if status == "IDENTICAL":
            continue
        p(f"### [{cls}] {conn_rel} — {status}\n")
        if cls == "A":
            p("> class A (verbatim): classify each hunk template-ahead (apply) "
              "vs workspace-ahead (preserve).\n")
        elif cls == "B":
            p("> class B (customised): ADVISORY — confirm against the rule audit before touching.\n")
        elif cls == "O":
            p("> class O (OAuth): customised per provider — ADVISORY.\n")
        if dtext:
            p("```diff\n" + dtext + "\n```\n")
        p("\n")

    sys.stdout.write(buf.getvalue())


if __name__ == "__main__":
    main()
