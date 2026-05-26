#!/usr/bin/env python3
"""One-off migration: propagate the appSecret HMAC auto-generation fix to an
App+MCP connector. Idempotent. Edits in place:

  1. automations/generateKey.yml — replace the OLD `!{{config.appSecret}}` -> 500
     guard with the self-heal block (isUsableSecret detect + generateRandomSecret
     + PATCH /security/secrets + effectiveSecret), and switch the signing call to
     {{effectiveSecret}}.
  2. imports/Custom Code.yml — add generateRandomSecret + isUsableSecret functions
     after verifyAndDecodeKey (text insertion; no YAML round-trip — CC is fragile).

Usage: migrate_appsecret.py --connector <dir> --name <ServiceName> --slug <serviceSlugCamel>
Exits non-zero (and changes nothing) if an expected anchor is missing.
"""
import argparse, re, sys, os

def fail(msg):
    print("FAIL: " + msg); sys.exit(2)

def migrate_generatekey(path, name, slug):
    with open(path) as f:
        txt = f.read()
    if "isUsableSecret" in txt or "secretCheck.usable" in txt:
        return "skip (already fixed)"
    # Match the OLD guard block (flexible on the error message wording).
    old = re.compile(
        r"  - conditions:\n"
        r"      '!\{\{config\.appSecret\}\}':\n"
        r"        - set:\n            name: \$http\n            value:\n              status: 500\n"
        r"        - set:\n            name: response\n            value:\n              error:[^\n]*\n"
        r"        - break: \{\}\n"
    )
    if not old.search(txt):
        fail(f"{path}: OLD appSecret guard block not found (needs manual handling)")
    block = NEW_BLOCK.replace("<<NAME>>", name).replace("<<SLUG>>", slug)
    txt2 = old.sub(block, txt, count=1)
    # Switch the signing secret reference.
    if "secret: '{{config.appSecret}}'" not in txt2:
        fail(f"{path}: signing call \"secret: '{{{{config.appSecret}}}}'\" not found")
    txt2 = txt2.replace("secret: '{{config.appSecret}}'", "secret: '{{effectiveSecret}}'", 1)
    with open(path, "w") as f:
        f.write(txt2)
    return "patched"

def ensure_label(path):
    """Ensure index.yml labels: contains 'app-mcp' (inserted right after `labels:`)."""
    with open(path) as f:
        lines = f.readlines()
    joined = "".join(lines)
    # Already present as a list item?
    if re.search(r"^\s*-\s*app-mcp\s*$", joined, re.M):
        return "skip (label present)"
    for i, ln in enumerate(lines):
        if re.match(r"^labels:\s*$", ln):
            # mirror the indentation of the next list item if any, else 2 spaces
            indent = "  "
            m = re.match(r"^(\s*)-\s", lines[i + 1]) if i + 1 < len(lines) else None
            if m:
                indent = m.group(1)
            lines.insert(i + 1, f"{indent}- app-mcp\n")
            with open(path, "w") as f:
                f.writelines(lines)
            return "label added"
    fail(f"{path}: no `labels:` block found")

def migrate_customcode(path):
    with open(path) as f:
        lines = f.readlines()
    joined = "".join(lines)
    if "isUsableSecret:" in joined:
        return "skip (already has isUsableSecret)"
    if "generateRandomSecret:" in joined and "isUsableSecret:" not in joined:
        # generateRandomSecret somehow present without isUsableSecret: insert only the missing one after it.
        pass
    # Find verifyAndDecodeKey and the next 4-space top-level key/comment after it.
    vidx = None
    for i, ln in enumerate(lines):
        if re.match(r"^    verifyAndDecodeKey:\s*$", ln):
            vidx = i; break
    if vidx is None:
        fail(f"{path}: verifyAndDecodeKey not found")
    ins = None
    for j in range(vidx + 1, len(lines)):
        if re.match(r"^    \S", lines[j]) or re.match(r"^  \S", lines[j]) or re.match(r"^\S", lines[j]):
            ins = j; break
    if ins is None:
        ins = len(lines)
    block = CC_FUNCS if "generateRandomSecret:" not in joined else CC_ISUSABLE_ONLY
    lines[ins:ins] = [block]
    with open(path, "w") as f:
        f.writelines(lines)
    return "patched"

NEW_BLOCK = """  - set:
      name: effectiveSecret
      value: '{{config.appSecret}}'
  - comment: >-
      Detect whether config.appSecret holds a REAL secret. On the central
      workspace an UNSET secret resolves config.appSecret to the literal binding
      string (truthy!), so a plain negation check wrongly skips generation and
      signs with that literal. Detect in Custom Code — a regex DSUL condition on
      the brace-prefix crashes on a literal binding value.
  - Custom Code.run:
      function: isUsableSecret
      parameters:
        value: '{{config.appSecret}}'
      output: secretCheck
  - conditions:
      '!{{secretCheck.usable}}':
        - comment: >-
            Generate a 256-bit random hex secret. No parameters needed. On CC
            module-load failure this returns an error object (not a string),
            guarded immediately after.
        - Custom Code.run:
            function: generateRandomSecret
            output: generatedSecret
        - conditions:
            '{{generatedSecret.error}}':
              - set:
                  name: $http
                  value:
                    status: 500
              - set:
                  name: response
                  value:
                    error: 'appSecret generation failed: {{generatedSecret.error.message}}'
              - break: {}
        - comment: >-
            Persist the generated secret to this workspace's secrets via a
            self-scoped workspace JWT. PATCH /security/secrets is NOT terminal
            (unlike `set: config type: merge`), so the run continues and can
            still return a response. Body is a flat map { name: { value, description } }.
        - auth:
            workspace: true
            output: wsJwt
        - set:
            name: secretsUrl
            value: '{{global.apiUrl}}/workspaces/{{global.workspaceId}}/security/secrets'
        - fetch:
            url: '{{secretsUrl}}'
            method: PATCH
            headers:
              Authorization: Bearer {{wsJwt.jwt}}
              Content-Type: application/json
            body:
              appSecret:
                value: '{{generatedSecret}}'
                description: >-
                  HMAC secret used by the central <<NAME>> workspace to
                  sign MCP API keys. Auto-generated on first key request.
            output: persistResp
            outputMode: detailed_response
            emitErrors: false
        - comment: >-
            If persistence failed, do NOT sign with a secret that was never
            stored — the key could never be verified by mcp.yml. Return 500.
        - conditions:
            '{{persistResp.status}} < 200 || {{persistResp.status}} > 299':
              - set:
                  name: $http
                  value:
                    status: 500
              - set:
                  name: response
                  value:
                    error: 'appSecret persistence failed (HTTP {{persistResp.status}})'
              - break: {}
        - set:
            name: effectiveSecret
            value: '{{generatedSecret}}'
        - emit:
            event: <<SLUG>>.generateKey.appSecretProvisioned
            payload:
              status: '{{persistResp.status}}'
"""

CC_FUNCS = """    generateRandomSecret:
      code: >
        const crypto = require('crypto');

        return crypto.randomBytes(32).toString('hex');

    isUsableSecret:
      parameters:
        value:
          type: string
      code: |
        const v = (value === null || value === undefined) ? '' : String(value);
        return { usable: v.length > 0 && v.indexOf('{{') === -1 };

"""

CC_ISUSABLE_ONLY = """    isUsableSecret:
      parameters:
        value:
          type: string
      code: |
        const v = (value === null || value === undefined) ? '' : String(value);
        return { usable: v.length > 0 && v.indexOf('{{') === -1 };

"""

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--connector", required=True)
    ap.add_argument("--name", required=True)
    ap.add_argument("--slug", required=True)
    a = ap.parse_args()
    gk = os.path.join(a.connector, "automations", "generateKey.yml")
    cc = os.path.join(a.connector, "imports", "Custom Code.yml")
    idx = os.path.join(a.connector, "index.yml")
    if not os.path.isfile(gk): fail(f"missing {gk}")
    if not os.path.isfile(cc): fail(f"missing {cc}")
    if not os.path.isfile(idx): fail(f"missing {idx}")
    print(f"generateKey.yml: {migrate_generatekey(gk, a.name, a.slug)}")
    print(f"Custom Code.yml: {migrate_customcode(cc)}")
    print(f"index.yml label: {ensure_label(idx)}")
