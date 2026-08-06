#!/usr/bin/env python3
"""Second migration step: make the tools BE automations, and delete the registry.

Step 1 (mcptools-to-registry.py) collapsed 5–6 hand-synced copies of the tool
surface into a single `REGISTRY` const inside a Custom Code function. That fixed
the duplication but not the nature of the thing: the tool list was still written
by hand, just stored elsewhere.

This step removes the stored form entirely.

    A tool IS an automation labelled `mcp:tool`.
      description  -> the tool description served by tools/list
      arguments    -> the tool inputSchema
      do           -> dispatches the action to the operation automations

`listTools` then builds the manifest by iterating `{{$workspace.automations}}` —
which resolves to the DSUL of the workspace OWNING the automation, so it behaves
identically standalone and inside a tenant. Adding, editing or deleting such an
automation changes tools/list on the spot, with nothing else to edit.

What it does, per connector:
  * one facade automation per tool, from the CURRENTLY SERVED manifest (fidelity);
  * each App-mode wrapper carries its own REST spec instead of a table lookup;
  * `mcpRegistry` (data + logic) -> `buildRequest` (logic only, no data);
  * `listTools` rewritten to introspect; `mcp.yml` dispatches to the facade;
  * `routeToolCall` deleted.

Usage
-----
  registry-to-automations.py plan  <workspace-dir> [--manifest live.json]
  registry-to-automations.py apply <workspace-dir> [--manifest live.json]

`--manifest` takes a live `tools/list` capture; without it the manifest is
rebuilt from the registry (identical, verified by mcptools-to-registry.py).
"""

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile

try:
    import yaml
except ImportError:
    sys.exit("PyYAML required: pip3 install pyyaml")

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import importlib.util
_spec = importlib.util.spec_from_file_location("step1", os.path.join(HERE, "mcptools-to-registry.py"))
step1 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(step1)

dump_yaml = step1.dump_yaml
load_yaml = step1.load_yaml
parse_js_const = step1.parse_js_const


# --------------------------------------------------------------- introspection

def read_registry(ws):
    """The registry left behind by step 1, plus the request-builder logic."""
    path = os.path.join(ws, "imports", "Custom Code.yml")
    cc = load_yaml(path)
    fns = (cc.get("config") or {}).get("functions") or {}
    if "mcpRegistry" not in fns:
        sys.exit("OUT-OF-SCOPE: %s has no `mcpRegistry` — run mcptools-to-registry.py first "
                 "(or it is not an entity-grouped connector)." % ws)
    code = fns["mcpRegistry"]["code"]
    return cc, path, fns, {
        "entities": parse_js_const(code, "REGISTRY") or {},
        "orphans": parse_js_const(code, "ORPHAN_OPERATIONS") or {},
        "aliases": parse_js_const(code, "QUERY_ALIASES") or {},
        "code": code,
    }


def build_manifest(ws, reg, override=None):
    """The manifest the connector serves today — the fidelity reference."""
    if override:
        return override
    js = step1.emit_js({"registry": reg["entities"], "orphanOperations": reg["orphans"],
                        "outputFormat": None}, reg["aliases"])
    # Reuse the connector's own emitted function instead of re-deriving: it is the
    # code that actually produced the live manifest.
    return step1.run_js(reg["code"], {"mode": "tools"})["tools"]


def has_rest_spec(o):
    """A REST op needs both a method and a path; anything else is dispatched to a
    dedicated automation (content download, collections-backed ops, GraphQL...)."""
    return not o.get("virtual") and o.get("method") and o.get("path")


def op_spec(o):
    """REST spec carried by the caller — everything buildRequest needs, nothing else."""
    s = {"method": o["method"], "path": o["path"]}
    for k in ("pathParams", "queryParams", "bodyParams", "rawPathParams",
              "bodyPassthrough", "rawBodyParam", "contentType", "base", "baseUrl", "host"):
        if o.get(k):
            s[k] = o[k]
    return s


# ------------------------------------------------------------------- emitters

def facade(tool, entity, ws_automations, tool_dispatcher="toolRestOp"):
    """One automation per tool. It IS the tool."""
    schema = tool["inputSchema"]
    required = set(schema.get("required") or [])
    args = {}
    for k, v in (schema.get("properties") or {}).items():
        a = dict(v)
        if k in required:
            a["required"] = True          # DSUL convention, lifted back by listTools
        args[k] = a

    branches, unresolved = {}, []
    for action, o in entity["ops"].items():
        op = o["op"]
        call_body = {"arguments": "{{args}}",
                     "accessToken": "{{auth.accessToken}}",
                     "baseUrl": "{{auth.baseUrl}}"}
        if not has_rest_spec(o):
            if op not in ws_automations:
                # No REST spec AND no automation to dispatch to: the action was already
                # unroutable before the migration. Say so explicitly instead of calling a
                # ghost automation (which would raise ObjectNotFoundError at runtime).
                unresolved.append((action, op))
                branches['{{act}} == "%s"' % action] = [{"set": {"name": "result", "value": {
                    "content": [{"type": "text", "text":
                                 "Action `%s` of `%s` is not implemented by this connector "
                                 "(no `%s` automation)." % (action, tool["name"], op)}],
                    "isError": True}}}]
            else:
                branches['{{act}} == "%s"' % action] = [
                    {op: {"body": call_body, "output": "result"}}]
        else:
            branches['{{act}} == "%s"' % action] = [
                {tool_dispatcher: {"toolName": op, "spec": op_spec(o),
                                   "body": call_body, "output": "result"}}]
    branches["default"] = [{"set": {"name": "result", "value": {
        "content": [{"type": "text", "text": "Unknown action `{{act}}` for `%s`. Available: %s"
                     % (tool["name"], ", ".join(sorted(entity["ops"])))}],
        "isError": True}}}]

    labels = ["mcp:tool"]
    # `arguments` only expresses `properties`; a root-level additionalProperties has
    # nowhere to live, so carry it as a label that listTools translates back.
    if schema.get("additionalProperties") is True:
        labels.append("mcp:additionalProperties")

    return {
        "slug": tool["name"],
        "name": "MCP/tools/%s" % tool["name"],
        # The marker that makes the tool discoverable. Matches the label pattern
        # ^[0-9A-Za-z._:-]{2,60}$ — no slash, no space.
        "labels": labels,
        "private": True,
        "description": tool["description"],
        # REQUIRED: the dispatch reaches this tool through its endpoint URL, because
        # an instruction name is never interpolated.
        "when": {"endpoint": True},
        "arguments": args,
        "do": [
            {"comment": "Facade for the MCP tool `%s`: it IS the tool. Its description and "
                        "arguments are what tools/list serves, read straight from this file, "
                        "and the action -> operation mapping lives here explicitly rather than "
                        "in a central table." % tool["name"]},
            {"comment": "Endpoint reachable ONLY through the MCP dispatch. `when.endpoint` makes "
                        "it a public webhook and `private` does NOT close that (the trigger "
                        "registry ignores it), so require a marker header: the runtime strips "
                        "incoming x-* headers, so an external caller cannot forge it, while the "
                        "internal dispatch fetch forwards it. Without this, tools/call could be "
                        "reached anonymously, bypassing validateAgent entirely."},
            {"conditions": {'!{{headers["x-mcp-dispatch"]}}': [
                {"set": {"name": "$http", "value": {"status": 403}}},
                {"set": {"name": "result", "value": {
                    "content": [{"type": "text",
                                 "text": "Direct calls are not allowed — use the MCP endpoint."}],
                    "isError": True}}},
                {"break": {}}]}},
            {"comment": "A webhook delivers its payload in the body WITHOUT mapping it onto the "
                        "declared arguments. The facade is MCP-only (see the guard above), so the "
                        "body is the source of truth."},
            {"set": {"name": "act", "value": "{{body.action}}"}},
            {"set": {"name": "args", "value": "{{body}}"}},
            {"comment": "Reject invalid input BEFORE any network call."},
            {"conditions": {"!{{act}}": [
                {"set": {"name": "result", "value": {
                    "content": [{"type": "text",
                                 "text": "Missing required argument `action` for `%s`. Available: %s"
                                         % (tool["name"], ", ".join(sorted(entity["ops"])))}],
                    "isError": True}}},
                {"break": {}}]}},
            {"comment": "Self-contained: the facade resolves its own auth, so the tool works "
                        "from MCP, from a webhook or in App-mode alike."},
            {"buildAppAuth": {"output": "auth"}},
            {"conditions": {"{{auth.error}}": [
                {"set": {"name": "result", "value": {
                    "content": [{"type": "text", "text": "{{auth.error}}"}], "isError": True}}},
                {"break": {}}]}},
            {"conditions": branches},
        ],
        "output": "{{result}}",
    }, unresolved


LIST_TOOLS = """slug: listTools
name: /MCP/listTools
description: >-
  Build the MCP tools manifest by INTROSPECTING this connector's own automations —
  nothing is stored, neither in config.value.mcpTools, nor in the MCP Core instance
  config, nor in a Custom Code constant. A tool IS an automation labelled
  `mcp:tool`: its description is the tool description and its arguments are the
  inputSchema. Adding, editing or deleting such an automation changes tools/list on
  the spot, with nothing else to edit.
private: true
do:
  - set:
      name: tools
      value: []
  - repeat:
      'on': '{{$workspace.automations}}'
      do:
        - comment: >-
            Capture the outer item FIRST: the inner repeat over arguments rebinds
            `item`, so the tool slug would be lost afterwards.
        - set:
            name: toolSlug
            value: '{{item.key}}'
        - set:
            name: toolAuto
            value: '{{item.value}}'
        - comment: >-
            `matches` does NOT work against a raw array, so join the labels first.
            Two runtime constraints, both hit for real: an expression cannot START
            with a string-literal concatenation, and join on an undefined value
            throws — hence the plain join, guarded by a length check. NB: never write
            expression delimiters inside a comment, the runtime parses them.
        - set:
            name: labelStr
            value: ''
        - conditions:
            '{{toolAuto.labels.length}}':
              - set:
                  name: labelStr
                  value: '{% join({{toolAuto.labels}}, ",") %}'
        - conditions:
            '{{labelStr}} matches "mcp:tool"':
              - comment: >-
                  The map is raw — it contains disabled automations too. And a tool is only
                  usable if it is actually reachable: tools/call resolves it through
                  global.endpoints, so an automation without `when.endpoint` would be
                  announced and then answer "Unknown tool".
              - conditions:
                  '!{{toolAuto.disabled}} && {{toolAuto.when.endpoint}}':
                    - comment: >-
                        `required` is carried per-argument (the DSUL convention); MCP
                        expects it as a list at the schema root, so lift it out and
                        strip it from the property itself.
                    - set:
                        name: required
                        value: []
                    - set:
                        name: properties
                        value: {}
                    - repeat:
                        'on': '{{toolAuto.arguments}}'
                        do:
                          - set:
                              name: prop
                              value: '{{item.value}}'
                          - delete:
                              name: prop.required
                          - set:
                              name: properties[{{item.key}}]
                              value: '{{prop}}'
                          - conditions:
                              '{{item.value.required}}':
                                - set:
                                    name: required
                                    type: push
                                    value: '{{item.key}}'
                    - set:
                        name: schema
                        value:
                          type: object
                          required: '{{required}}'
                          properties: '{{properties}}'
                    - comment: >-
                        A root-level additionalProperties cannot be expressed through
                        `arguments`, so it travels as a label.
                    - conditions:
                        '{{labelStr}} matches "mcp:additionalProperties"':
                          - set:
                              name: schema.additionalProperties
                              value: true
                    - set:
                        name: tools
                        type: push
                        value:
                          name: '{{toolSlug}}'
                          description: '{{toolAuto.description}}'
                          inputSchema: '{{schema}}'
  - comment: >-
      Refuse to serve an empty list: agent-factory and ai-knowledge PERSIST the
      tools/list response into the agent's config, so an empty array would silently
      strip every tool from every agent using this connector.
  - conditions:
      '!{{tools.length}}':
        - set:
            name: output
            value:
              error: >-
                No automation labelled `mcp:tool` found in this connector. Refusing to
                serve an empty tools/list — consumers persist it and would drop every
                tool from their agents.
        - break: {}
  - set:
      name: output
      value:
        tools: '{{tools}}'
output: '{{output}}'
"""


def can_rewrite_mcp(ws):
    """The tenant-context dispatch is `routeToolCall(toolName, toolArgs)` at the top of
    the tools/call branch. Connectors still on the older HMAC/central model nest it
    deeper AND feed it service-specific credentials (siteId, serverUrl...) that a
    generic facade cannot supply — refuse rather than half-migrate them."""
    p = os.path.join(ws, "automations", "mcp.yml")
    if not os.path.exists(p):
        return False, "no automations/mcp.yml"
    d = load_yaml(p)
    for cond in d.get("do", []):
        if "conditions" not in cond:
            continue
        for key, block in cond["conditions"].items():
            if "tools/call" in key and any("routeToolCall" in i for i in block):
                return True, None
    return False, ("tools/call does not dispatch through a top-level routeToolCall — "
                   "central HMAC model. Do NOT migrate by hand either: there the tenant "
                   "credentials are decoded from the mcp-api-key in mcp.yml and passed to "
                   "the tool, while a facade calls buildAppAuth and would resolve the "
                   "CENTRAL workspace's own config instead. tools/list would look fine and "
                   "tools/call would break. Leave the connector on the static model.")


def drop_redundant_auth(block):
    """The facade resolves its own auth and returns the same MCP error, so the
    pre-check in mcp.yml only doubles the token exchange — on clientCredentials
    buildAppAuth has no cache, so every tools/call hit AAD /token twice."""
    out, skip_next_err = [], False
    for instr in block:
        if "buildAppAuth" in instr:
            skip_next_err = True
            continue
        if skip_next_err and "conditions" in instr and any(
                "auth.error" in k for k in instr["conditions"]):
            skip_next_err = False
            continue
        skip_next_err = False
        out.append(instr)
    return out


def rewrite_mcp(ws):
    """tools/call reaches the tool through its endpoint (instruction names are never
    interpolated); the runtime short-circuits that fetch into a direct call."""
    p = os.path.join(ws, "automations", "mcp.yml")
    d = load_yaml(p)
    done = False
    for cond in d.get("do", []):
        if "conditions" not in cond:
            continue
        for key, block in list(cond["conditions"].items()):
            # Step 1 left a comment describing the Custom Code registry; that registry
            # is gone, so refresh it rather than leave the file lying about itself.
            if "tools/list" in key:
                for instr in block:
                    c = instr.get("comment")
                    if c and "mcpRegistry registry" in c:
                        instr["comment"] = c.replace(
                            "The manifest is COMPUTED from the mcpRegistry registry, never stored.",
                            "The manifest is DERIVED from this workspace's own automations (those "
                            "labelled mcp:tool), never stored anywhere.")
                        done = True
            if "tools/call" not in key:
                continue
            out = []
            for instr in block:
                if "routeToolCall" in instr:
                    out += [
                        {"comment": "Dispatch to the tool's own automation. An instruction name is "
                                    "never interpolated, so the tool is reached through its endpoint "
                                    "URL — the runtime short-circuits this into a direct in-process "
                                    "call. global.endpoints already carries the appInstance prefix "
                                    "when installed in a tenant."},
                        {"set": {"name": "toolUrl", "value": "{{global.endpoints[{{toolName}}]}}"}},
                        {"conditions": {"!{{toolUrl}}": [
                            {"set": {"name": "response", "value": {
                                "jsonrpc": "2.0", "id": "{{body.id}}", "result": {
                                    "content": [{"type": "text",
                                                 "text": "Unknown tool `{{toolName}}`."}],
                                    "isError": True}}}},
                            {"break": {}}]}},
                        {"fetch": {"url": "{{toolUrl}}", "method": "post",
                                   "headers": {"x-mcp-dispatch": "1"},
                                   "body": "{{body.params.arguments}}",
                                   "outputMode": "detailed_response",
                                   "output": "toolResp"}},
                        {"comment": "The short-circuited call does NOT rethrow: on failure the body "
                                    "carries the error and the status is >= 400. Without this check "
                                    "the client would get a result with neither content[] nor "
                                    "isError, and the agent would loop or hallucinate."},
                        {"conditions": {"{{toolResp.status}} >= 400": [
                            {"set": {"name": "response", "value": {
                                "jsonrpc": "2.0", "id": "{{body.id}}", "result": {
                                    "content": [{"type": "text", "text":
                                                 "Tool `{{toolName}}` failed ({{toolResp.status}}): "
                                                 "{{toolResp.body.message}}"}],
                                    "isError": True}}}},
                            {"break": {}}]}},
                        {"set": {"name": "toolResult", "value": "{{toolResp.body}}"}},
                    ]
                    done = True
                else:
                    out.append(instr)
            cond["conditions"][key] = drop_redundant_auth(out)
    if done:
        dump_yaml(d, p)
    return done


def find_dispatcher(ws, kind):
    """Fleet naming is inconsistent: `methodRestOp` on some connectors, `method-restOp`
    on others. Resolve the real filename instead of assuming one."""
    auto = os.path.join(ws, "automations")
    for cand in ("%sRestOp.yml" % kind, "%s-restOp.yml" % kind):
        p = os.path.join(auto, cand)
        if os.path.exists(p):
            return p
    return None


def rewrite_dispatchers(ws, reg):
    """toolRestOp / methodRestOp become spec-driven; wrappers carry their own spec."""
    touched = []
    p = find_dispatcher(ws, "tool")
    if p:
        d = load_yaml(p)
        d.setdefault("arguments", {})["spec"] = {
            "type": "object",
            "description": "REST spec supplied by the caller (method, path, params) — no registry lookup."}
        for i in d.get("do", []):
            for key in ("methodRestOp", "method-restOp"):
                if key in i:
                    i[key] = {"spec": "{{spec}}", **i[key]}
        dump_yaml(d, p); touched.append(os.path.basename(p)[:-4])

    p = find_dispatcher(ws, "method")
    if p:
        d = load_yaml(p)
        d["description"] = ("Generic REST dispatcher. The operation spec is supplied by the CALLER "
                            "(tool facade or App-mode wrapper); this automation only builds the "
                            "request from it via the pure `buildRequest` helper — no registry.")
        d.setdefault("arguments", {})["spec"] = {
            "type": "object",
            "description": "REST spec: {method, path, pathParams, queryParams, bodyPassthrough...}"}
        for i in d.get("do", []):
            cc = i.get("Custom Code.run")
            if cc and cc.get("function") == "mcpRegistry":
                i["Custom Code.run"] = {"function": "buildRequest",
                                        "parameters": {"spec": "{{spec}}", "args": "{{args}}"},
                                        "output": cc.get("output", "req")}
        dump_yaml(d, p); touched.append(os.path.basename(p)[:-4])

    patched = missing = 0
    for ent in reg["entities"].values():
        for o in ent["ops"].values():
            if not has_rest_spec(o):
                continue
            wp = os.path.join(ws, "automations", "%s.yml" % o["op"])
            if not os.path.exists(wp):
                missing += 1
                continue
            d = load_yaml(wp); changed = False
            for i in d.get("do", []):
                for key in ("methodRestOp", "method-restOp"):
                    if key in i and "spec" not in i[key]:
                        i[key] = {"spec": op_spec(o), **i[key]}
                        changed = True
            if changed:
                dump_yaml(d, wp); patched += 1
    return touched, patched, missing


def rewrite_custom_code(cc, path, fns, reg):
    """mcpRegistry (data + logic) -> buildRequest (logic only)."""
    code = reg["code"]
    i = code.find("function buildRequest(operationName, args) {")
    if i == -1:
        sys.exit("could not locate buildRequest inside mcpRegistry — aborting")
    body = code[i:]
    body = body[:body.find("\nswitch (mode)")] if "\nswitch (mode)" in body else body
    body = body.replace("function buildRequest(operationName, args) {", "", 1).rstrip()
    if body.endswith("}"):
        body = body[:-1]
    body = body.replace("const op = operationsOf()[operationName];\n"
                        "  if (!op) return { error: 'Unknown operation: ' + operationName };\n", "")
    body = "\n".join(l[2:] if l.startswith("  ") else l for l in body.split("\n"))
    new = ("// Pure request builder — NO data, NO registry. The operation spec (method, path,\n"
           "// pathParams, queryParams, bodyPassthrough...) is supplied by the CALLER: every\n"
           "// App-mode wrapper and every tool facade carries its own. Nothing about the API\n"
           "// surface is stored here, so this helper is identical for every connector.\n"
           "const QUERY_ALIASES = %s;\n"
           "if (!spec || !spec.method || !spec.path) {\n"
           "  return { error: 'buildRequest requires a spec {method, path} from the caller.' };\n"
           "}\n"
           "const op = spec;\n" % json.dumps(reg["aliases"], ensure_ascii=False)) + body.strip() + "\n"
    fns["buildRequest"] = {"parameters": {"spec": {"type": "object"}, "args": {"type": "object"}},
                           "code": new}
    del fns["mcpRegistry"]
    dump_yaml(cc, path)
    return len(code), len(new)


# ----------------------------------------------------------------------- main

def run(ws, apply_changes, manifest_override=None):
    cc, cc_path, fns, reg = read_registry(ws)
    manifest = build_manifest(ws, reg, manifest_override)
    auto_dir = os.path.join(ws, "automations")
    existing = {f[:-4] for f in os.listdir(auto_dir) if f.endswith(".yml")}

    by_name = {t["name"]: t for t in manifest}
    problems, plan = [], []
    for name, ent in reg["entities"].items():
        if ent.get("plain"):
            problems.append("tool %r is a plain tool (no action enum) — migrate it by hand" % name)
            continue
        if name not in by_name:
            problems.append("tool %r missing from the served manifest" % name)
            continue
        if name in existing:
            problems.append("slug collision: an automation %r already exists" % name)
            continue
        plan.append(name)

    ok_mcp, why = can_rewrite_mcp(ws)
    if not ok_mcp:
        problems.append("mcp.yml: %s" % why)

    print("  %d tools -> %d facades to create" % (len(manifest), len(plan)))
    if problems:
        print("  blockers:")
        for p in problems:
            print("    ! %s" % p)
    if not apply_changes:
        return not problems
    if problems:
        sys.exit("\nrefusing to apply while blockers remain")

    unresolved_all = []
    for name in plan:
        td = find_dispatcher(ws, "tool")
        td = os.path.basename(td)[:-4] if td else "toolRestOp"
        doc, unresolved = facade(by_name[name], reg["entities"][name], existing, td)
        unresolved_all += [(name, a, o) for a, o in unresolved]
        dump_yaml(doc, os.path.join(auto_dir, "%s.yml" % name))

    open(os.path.join(auto_dir, "listTools.yml"), "w").write(LIST_TOOLS)
    mcp_ok = rewrite_mcp(ws)
    touched, patched, missing = rewrite_dispatchers(ws, reg)
    before, after = rewrite_custom_code(cc, cc_path, fns, reg)

    rt = os.path.join(auto_dir, "routeToolCall.yml")
    if os.path.exists(rt):
        os.remove(rt)

    print("  + %d facades, listTools rewritten" % len(plan))
    print("  ~ mcp.yml dispatch: %s | %s | %d wrappers carry their spec (%d without a wrapper)"
          % ("ok" if mcp_ok else "NOT PATCHED", ", ".join(touched), patched, missing))
    print("  - routeToolCall removed | Custom Code: mcpRegistry %d -> buildRequest %d chars"
          % (before, after))
    if unresolved_all:
        print("  ! virtual ops with no automation (dispatch would fail):")
        for t, a, o in unresolved_all:
            print("      %s.%s -> %s" % (t, a, o))
    return True


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", choices=["plan", "apply"])
    ap.add_argument("workspace")
    ap.add_argument("--manifest", help="live tools/list capture to use as the fidelity reference")
    a = ap.parse_args()
    override = None
    if a.manifest:
        raw = json.load(open(a.manifest))
        override = raw.get("result", raw).get("tools", raw) if isinstance(raw, dict) else raw
    print("%s %s" % (a.command, a.workspace))
    ok = run(a.workspace.rstrip("/"), a.command == "apply", override)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
