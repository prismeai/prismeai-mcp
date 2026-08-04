#!/usr/bin/env python3
"""Migrate an App+MCP connector from a static `mcpTools` config to a runtime registry.

Before
------
  index.yml            config.value.mcpTools  (hand-written, ~90% of the file)
  imports/MCP Core.yml config.mcpTools        (identical copy — the one tools/list serves)
  imports/Custom Code.yml
      resolveToolAction   ENTITY_OPS
      getOperation        OPERATIONS
      build<X>Request     OPERATIONS  (a second, verbatim copy)

After
-----
  imports/Custom Code.yml
      mcpRegistry         ONE `REGISTRY` const + modes tools|resolve|operation|request
  (both mcpTools blocks deleted)

The tools manifest is no longer stored: `listTools` computes it from REGISTRY at
each tools/list and hands it to `MCP Core.handleMcpMethod` via its `tools` argument.

Fidelity is not assumed — `verify` RUNS the generated JS under node and diffs its
output against the original manifest, so what ships is what was checked.

Usage
-----
  mcptools-to-registry.py extract <workspace-dir> [--out build/registry.json]
  mcptools-to-registry.py verify  <workspace-dir>      # round-trip, exit 1 on drift
  mcptools-to-registry.py apply   <workspace-dir>      # rewrite the YAML in place
  mcptools-to-registry.py swagger <workspace-dir> [--out swagger.generated.yml]

`apply` refuses to run unless `verify` passes.
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


# ---------------------------------------------------------------- YAML helpers

class _Dumper(yaml.SafeDumper):
    """Block-style dumper that keeps long strings readable."""

    def increase_indent(self, flow=False, indentless=False):
        return super().increase_indent(flow, False)


def _str_presenter(dumper, data):
    if "\n" in data:
        return dumper.represent_scalar("tag:yaml.org,2002:str", data, style="|")
    return dumper.represent_scalar("tag:yaml.org,2002:str", data)


_Dumper.add_representer(str, _str_presenter)


def load_yaml(path):
    with open(path) as fh:
        return yaml.safe_load(fh)


def dump_yaml(data, path):
    with open(path, "w") as fh:
        yaml.dump(data, fh, Dumper=_Dumper, sort_keys=False,
                  allow_unicode=True, width=10**6)


# ------------------------------------------------------------ JS const parsing

def parse_js_const(code, name):
    """Extract `const <name> = {...};` from a Custom Code body as a Python dict.

    Brace-matching scan to isolate the literal, then node to evaluate it — these
    are JS object literals, not JSON (unquoted keys, single quotes), so a JSON
    parser is not enough.
    """
    marker = "const %s = " % name
    start = code.find(marker)
    if start == -1:
        return None
    i = code.index("{", start)
    depth, in_str, esc = 0, None, False
    for j in range(i, len(code)):
        ch = code[j]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == in_str:
                in_str = None
            continue
        if ch in "\"'":
            in_str = ch
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                # Evaluate everything up to and including this declaration, not the
                # literal alone: multi-API connectors reference constants declared
                # above it (e.g. `base: DRIVE`).
                return eval_js_prefix(code[:j + 1], name)
    raise ValueError("unterminated object literal for %s" % name)


def eval_js_prefix(prefix, name):
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as fh:
        fh.write("const __v = (function () {\n%s;\nreturn %s;\n})();\n"
                 "console.log(JSON.stringify(__v));\n" % (prefix, name))
        tmp = fh.name
    try:
        out = subprocess.run(["node", tmp], capture_output=True, text=True)
        if out.returncode != 0:
            raise ValueError("cannot evaluate JS declaration:\n%s" % out.stderr)
        return json.loads(out.stdout)
    finally:
        os.unlink(tmp)


# ------------------------------------------------------------- description I/O

ACTION_LINE = re.compile(r"^- \*\*(?P<action>[^*]+)\*\* \((?P<op>[^)]+)\):\s?(?P<summary>.*)$")
ACTIONS_HEADER = "Available actions:"


def parse_description(desc):
    """Split a tool description into (blurb, {action: summary}, trailer, ok).

    Canonical shape:
        <blurb>

        Available actions:
        - **<action>** (<op>): <summary>
        ...
        [blank line]
        <trailer>            # optional closing note (jira-next uses these)

    A non-blank line right after an action line continues that summary; a blank
    line ends the list, so everything past it is the trailer. `ok` is False when
    the text does not follow the shape — the caller then keeps it verbatim.
    """
    if ACTIONS_HEADER not in desc:
        return desc, {}, "", False
    blurb, _, rest = desc.partition(ACTIONS_HEADER)
    blurb = blurb.rstrip("\n")
    summaries, current, trailer, ended = {}, None, [], False
    for line in rest.strip("\n").split("\n"):
        if ended:
            trailer.append(line)
            continue
        m = ACTION_LINE.match(line)
        if m:
            current = m.group("action")
            summaries[current] = m.group("summary")
        elif not line.strip():
            # Blank line closes the action list; anything after it is a trailer.
            if current is not None:
                ended = True
        elif current is not None:
            summaries[current] += "\n" + line
        else:
            return desc, {}, "", False
    return blurb, summaries, "\n".join(trailer).strip("\n"), bool(summaries)


# ------------------------------------------------------------------- extractor

def find_custom_code(ws):
    path = os.path.join(ws, "imports", "Custom Code.yml")
    if not os.path.exists(path):
        sys.exit("no imports/Custom Code.yml in %s" % ws)
    return path, load_yaml(path)


def find_request_builder(functions):
    """The per-service request builder — build<Service>Request, name varies."""
    for name in functions:
        if re.fullmatch(r"build[A-Z]\w*Request", name):
            return name
    return None


def read_manifests(ws):
    """Both stored copies of the manifest, authoritative one first.

    `imports/MCP Core.yml` config.mcpTools is what MCP Core actually serves;
    `index.yml` config.value.mcpTools is a courtesy copy kept in sync by hand — and
    routinely stale (sharepoint-next's index.yml was missing two whole actions plus a
    routing preamble that production had been serving for weeks).
    """
    idx = load_yaml(os.path.join(ws, "index.yml")) or {}
    from_index = ((idx.get("config", {}) or {}).get("value", {}) or {}).get("mcpTools")
    imp_path = os.path.join(ws, "imports", "MCP Core.yml")
    from_import = None
    if os.path.exists(imp_path):
        from_import = ((load_yaml(imp_path) or {}).get("config") or {}).get("mcpTools")
    return from_import, from_index


def extract(ws, manifest_override=None):
    from_import, from_index = read_manifests(ws)
    tools = manifest_override or from_import or from_index
    if not tools:
        sys.exit("no mcpTools found in %s (neither imports/MCP Core.yml nor index.yml)" % ws)

    drift_note = None
    if from_import and from_index and json.dumps(from_import, sort_keys=True) != json.dumps(from_index, sort_keys=True):
        only_imp = {t["name"] for t in from_import} - {t["name"] for t in from_index}
        only_idx = {t["name"] for t in from_index} - {t["name"] for t in from_import}
        drift_note = ("the two stored copies DISAGREE — using imports/MCP Core.yml (the one served). "
                      "Tools only in MCP Core.yml: %s; only in index.yml: %s; "
                      "remaining differences are in descriptions/schemas."
                      % (sorted(only_imp) or "none", sorted(only_idx) or "none"))

    cc_path, cc = find_custom_code(ws)
    fns = cc["config"].get("functions") or {}
    if "resolveToolAction" not in fns:
        sys.exit("OUT-OF-SCOPE: %s has no resolveToolAction in imports/Custom Code.yml — this is "
                 "not an entity-grouped app-mcp connector (likely the older one-automation-per-tool "
                 "model, which keeps its static mcpTools)." % ws)
    entity_ops = parse_js_const(fns["resolveToolAction"]["code"], "ENTITY_OPS")
    if entity_ops is None:
        sys.exit("could not parse ENTITY_OPS from %s" % cc_path)
    builder = find_request_builder(fns)

    # The operations table is not consistently named or placed across the fleet:
    # `OPERATIONS` or `REGISTRY` (sometimes `OPS`), living in `getOperation`, in the
    # request builder, or in both. Look everywhere and reconcile.
    TABLE_NAMES = ("OPERATIONS", "REGISTRY", "OPS")

    def find_table(fn_name):
        if fn_name not in fns:
            return None, None
        for const in TABLE_NAMES:
            t = parse_js_const(fns[fn_name]["code"], const)
            # A bare list of operation names (powerbi's NAMES) is not a spec table.
            if isinstance(t, dict) and t and all(isinstance(v, dict) for v in t.values()):
                return t, const
        return None, None

    operations, from_getop = find_table("getOperation")
    dup, from_builder = find_table(builder) if builder else (None, None)
    reconciled_note = None

    if operations is None and dup is None:
        # No REST spec table at all: every action is dispatched by a dedicated
        # automation (azure-ocr, webdav). Legitimate — treat all ops as virtual.
        operations = {}
        warn_no_table = True
    else:
        warn_no_table = False
        if operations is None:
            operations, from_getop = dup, from_builder
        elif dup is not None and dup != operations:
            # The two copies drifted. Reconcile ONLY when one is a strict superset of
            # the other and no shared operation contradicts itself — typically the
            # builder holds REST ops only, while getOperation also carries the GraphQL
            # ones plus an extra `graphql` flag (sap-leanix). Anything else is a real
            # conflict: refuse rather than silently pick a side.
            conflicts = []
            for k in set(dup) & set(operations):
                a, b = operations[k], dup[k]
                shared = set(a) & set(b)
                if any(json.dumps(a[x], sort_keys=True) != json.dumps(b[x], sort_keys=True)
                       for x in shared):
                    conflicts.append(k)
            if conflicts:
                sys.exit("the operations table CONFLICTS between getOperation (%s) and %s (%s)\n"
                         "  operations whose shared keys disagree: %s\n"
                         "  Reconcile by hand before migrating — the codemod will not pick a "
                         "side (this divergence is exactly what the single registry removes)."
                         % (from_getop, builder, from_builder, sorted(conflicts)))
            merged = dict(dup)
            for k, v in operations.items():
                merged[k] = dict(dup.get(k) or {}, **v)
            only_getop = sorted(set(operations) - set(dup))
            only_builder = sorted(set(dup) - set(operations))
            reconciled_note = ("the two operations copies differed but were compatible — merged. "
                               "Only in %s: %s. Only in %s: %s."
                               % (from_getop, only_getop or "none", builder, only_builder or "none"))
            operations = merged

    # Most common outputFormat shape across the tools — the one worth hoisting.
    seen_of = {}
    for tool in tools:
        of = tool["inputSchema"].get("properties", {}).get("outputFormat")
        if of is not None:
            seen_of[json.dumps(of, sort_keys=True)] = of
    shared_output_format = None
    if seen_of:
        counts = {}
        for tool in tools:
            of = tool["inputSchema"].get("properties", {}).get("outputFormat")
            if of is not None:
                k = json.dumps(of, sort_keys=True)
                counts[k] = counts.get(k, 0) + 1
        shared_output_format = seen_of[max(counts, key=counts.get)]

    registry, warnings = {}, []
    if reconciled_note:
        warnings.append(reconciled_note)
    if warn_no_table:
        warnings.append("no REST operations table found — every action is dispatched by a "
                        "dedicated automation, so all ops are emitted as virtual")
    if drift_note:
        warnings.append(drift_note)
    for tool in tools:
        name = tool["name"]
        if "action" not in (tool["inputSchema"].get("properties") or {}):
            # A plain tool, not an entity (OAuth connect/disconnect, one-shot helpers).
            # Kept verbatim so mixed connectors keep serving exactly what they served.
            registry[name] = {"plain": True, "tool": tool}
            continue
        ops_map = entity_ops.get(name)
        if ops_map is None:
            # Entity handled entirely by a short-circuit in routeToolCall (no REST
            # mapping). Keep it in the manifest — dropping it would remove a tool.
            warnings.append("tool %r has no ENTITY_OPS entry — kept as a virtual entity" % name)
            ops_map = {}
        schema = tool["inputSchema"]
        props = dict(schema.get("properties", {}))
        action_prop = props.pop("action", {})
        props.pop("outputFormat", None)

        blurb, summaries, trailer, parsed = parse_description(tool["description"])
        entry = {
            "blurb": blurb,
            # Everything about the `action` property except its enum, which is derived.
            "actionProp": {k: v for k, v in action_prop.items() if k != "enum"},
            "required": [r for r in schema.get("required", []) if r != "action"],
            "params": props,
            "ops": {},
        }
        # Root-level inputSchema keys beyond the canonical trio (e.g. additionalProperties).
        extra = {k: v for k, v in schema.items() if k not in ("type", "required", "properties")}
        if extra:
            entry["schemaExtra"] = extra
        # `outputFormat` is boilerplate repeated in every tool — hoisted to the shared
        # OUTPUT_FORMAT const. `true` means "use the shared one"; an object is a
        # per-entity override; absent means this tool genuinely has no outputFormat.
        of = tool["inputSchema"].get("properties", {}).get("outputFormat")
        if of is not None:
            entry["outputFormat"] = True if of == shared_output_format else of
        if trailer:
            entry["trailer"] = trailer
        if not parsed:
            # Non-canonical prose: keep it byte-for-byte instead of rebuilding.
            entry["descOverride"] = tool["description"]
            warnings.append("tool %r: description not in canonical form, kept verbatim" % name)

        enum = action_prop.get("enum") or list(ops_map)
        for action in enum:
            # A virtual entity's actions are named by the action itself: they are
            # dispatched by a short-circuit, not through the REST registry.
            op_name = ops_map.get(action, action)
            op = {"op": op_name}
            spec = operations.get(op_name)
            if spec is None:
                # Short-circuited in routeToolCall (custom automation, not a REST op).
                op["virtual"] = True
            else:
                # Copied verbatim — no key dropped, not even empty lists: connectors
                # carry their own extra keys (bodyKeys, queryKeys, aliases, itemType…)
                # and `operation` must round-trip byte-for-byte.
                for k, v in spec.items():
                    op[k] = v
            if action in summaries:
                op["summary"] = summaries[action]
            entry["ops"][action] = op

        for action in ops_map:
            if action not in entry["ops"]:
                warnings.append("tool %r: action %r in ENTITY_OPS but absent from the enum" % (name, action))
        registry[name] = entry

    # Operations reachable by direct operationId (routeToolCall fallback) that no
    # entity exposes still need their spec at runtime.
    used = {op["op"] for e in registry.values() if not e.get("plain")
            for op in e["ops"].values()}
    orphans = {k: v for k, v in operations.items() if k not in used}

    overrides = sum(1 for e in registry.values() if isinstance(e.get("outputFormat"), dict))
    if overrides:
        warnings.append("%d tool(s) carry a non-standard outputFormat — kept as per-entity overrides" % overrides)

    return {
        "registry": registry,
        "orphanOperations": orphans,
        "outputFormat": shared_output_format,
        "warnings": warnings,
        "_original": tools,
        # Only a builder that actually HELD the operations table is superseded by
        # mcpRegistry. A same-named helper that builds something else (google-search's
        # buildGroundingRequest) must survive — deleting it silently breaks its callers.
        "_builder": builder if from_builder else None,
        "_operations": operations,
    }


# ------------------------------------------------------------- JS code emitter

JS_RUNTIME = r"""
// <<GENERATED>> single source of truth — entity/action surface, REST specs and the
// tools/list manifest all derive from REGISTRY below. Regenerate with
// scripts/mcptools-to-registry.py; never hand-edit one of the derived forms.
//
// modes:
//   tools     -> { tools: [...] }        manifest served by tools/list (via listTools)
//   resolve   -> { operationName }       entity + action -> operationName
//   operation -> { method, path, ... }   operationName -> REST spec
//   request   -> { method, path, query, body? }  built call for executeApiCall
const REGISTRY = __REGISTRY__;
const ORPHAN_OPERATIONS = __ORPHANS__;
const OUTPUT_FORMAT = __OUTPUTFORMAT__;
const QUERY_ALIASES = __QUERY_ALIASES__;

function operationsOf() {
  const all = Object.assign({}, ORPHAN_OPERATIONS);
  for (const ent of Object.keys(REGISTRY)) {
    const ops = REGISTRY[ent].ops;
    if (!ops) continue;  // plain tool, no REST operations
    for (const act of Object.keys(ops)) {
      const o = ops[act];
      if (o.virtual) continue;
      const spec = {};
      for (const k of Object.keys(o)) {
        if (k === 'op' || k === 'summary' || k === 'virtual') continue;
        spec[k] = o[k];
      }
      all[o.op] = spec;
    }
  }
  return all;
}

function buildTools(ctx) {
  const hidden = (ctx && ctx.hideTools) || [];
  const tools = [];
  for (const name of Object.keys(REGISTRY)) {
    if (hidden.indexOf(name) !== -1) continue;
    const e = REGISTRY[name];
    // Plain (non entity-grouped) tool — e.g. OAuth connect/disconnect. Served as-is;
    // hide it per-tenant with ctx.hideTools rather than post-filtering the response.
    if (e.plain) { tools.push(e.tool); continue; }
    const actions = Object.keys(e.ops).filter(function (a) {
      const skip = (ctx && ctx.hideActions && ctx.hideActions[name]) || [];
      return skip.indexOf(a) === -1;
    });
    if (!actions.length) continue;

    let description;
    if (e.descOverride) {
      description = e.descOverride;
    } else {
      const lines = [e.blurb, '', 'Available actions:'];
      for (const a of actions) {
        const o = e.ops[a];
        lines.push('- **' + a + '** (' + o.op + ')' + (o.summary ? ': ' + o.summary : ''));
      }
      if (e.trailer) lines.push('', e.trailer);
      description = lines.join('\n');
    }
    // Providers reject descriptions over 1024 chars (Gotcha 21). NOT truncated here:
    // cutting mid-sentence corrupts the action list the LLM relies on. The generator
    // (scripts/mcptools-to-registry.py) and the Phase 8 live audit both flag overruns
    // so a human shortens the summaries at the source.

    const actionProp = { type: 'string' };
    for (const k of Object.keys(e.actionProp || {})) actionProp[k] = e.actionProp[k];
    actionProp.enum = actions;

    const properties = { action: actionProp };
    for (const p of Object.keys(e.params || {})) properties[p] = e.params[p];
    if (e.outputFormat === true) properties.outputFormat = OUTPUT_FORMAT;
    else if (e.outputFormat) properties.outputFormat = e.outputFormat;

    const inputSchema = { type: 'object', required: ['action'].concat(e.required || []), properties: properties };
    for (const k of Object.keys(e.schemaExtra || {})) inputSchema[k] = e.schemaExtra[k];

    tools.push({ name: name, description: description, inputSchema: inputSchema });
  }
  return { tools: tools };
}

function resolve(entity, action) {
  const e = REGISTRY[entity];
  if (!e) return { error: 'Unknown entity: ' + entity + '. Available: ' + Object.keys(REGISTRY).sort().join(', ') };
  const avail = Object.keys(e.ops).sort().join(', ');
  if (!action) return { error: 'Missing required argument `action` for ' + entity + '. Available actions: ' + avail };
  const o = e.ops[action];
  if (!o) return { error: 'Unknown action `' + action + '` for entity `' + entity + '`. Available actions: ' + avail };
  return { operationName: o.op };
}

function getOperation(operationName) {
  const op = operationsOf()[operationName];
  if (!op) return { error: 'Unknown operation: ' + operationName };
  return op;
}

function buildRequest(operationName, args) {
  const op = operationsOf()[operationName];
  if (!op) return { error: 'Unknown operation: ' + operationName };
  const a = Object.assign({}, args || {});
  let path = op.path.startsWith('/') ? op.path.substring(1) : op.path;
  for (const placeholder of (op.pathParams || [])) {
    const value = a[placeholder];
    if (value === undefined || value === null || value === '') {
      return { error: 'Missing required path param: ' + placeholder };
    }
    const enc = (op.rawPathParams && op.rawPathParams.indexOf(placeholder) !== -1)
      ? String(value).split('/').map(function (s) { return encodeURIComponent(s); }).join('/')
      : encodeURIComponent(String(value));
    path = path.replace('{' + placeholder + '}', enc);
    delete a[placeholder];
  }
  const query = {};
  for (const k of (op.queryParams || [])) {
    if (a[k] !== undefined && a[k] !== null && a[k] !== '') {
      query[QUERY_ALIASES[k] || k] = a[k];
    }
  }
  const result = { method: op.method, path: path, query: query };
  if (op.baseUrl) result.baseUrl = op.baseUrl;
  if (op.host) result.host = op.host;
  if (op.rawBodyParam && a[op.rawBodyParam] !== undefined && a[op.rawBodyParam] !== null && a[op.rawBodyParam] !== '') {
    result.rawBody = a[op.rawBodyParam];
    result.contentType = op.contentType || 'application/octet-stream';
    return result;
  }
  if (op.bodyPassthrough) {
    if (a.body && typeof a.body === 'object' && Object.keys(a.body).length) {
      result.body = a.body;
      return result;
    }
    // Fallback: caller passed body fields at the top level instead of nesting them in `body`.
    const reserved = new Set(['action', 'outputFormat', 'body']);
    if (op.rawBodyParam) reserved.add(op.rawBodyParam);
    for (const k of (op.pathParams || [])) reserved.add(k);
    for (const k of (op.queryParams || [])) reserved.add(k);
    const fallback = {};
    for (const k of Object.keys(a)) {
      if (!reserved.has(k) && a[k] !== undefined && a[k] !== null && a[k] !== '') fallback[k] = a[k];
    }
    if (Object.keys(fallback).length) result.body = fallback;
    return result;
  }
  if ((op.bodyParams || []).length) {
    const body = {};
    for (const k of (op.bodyParams || [])) {
      if (a[k] !== undefined && a[k] !== null && a[k] !== '') body[k] = a[k];
    }
    if (Object.keys(body).length) result.body = body;
  }
  return result;
}

switch (mode) {
  case 'tools': return buildTools(ctx);
  case 'resolve': return resolve(entity, action);
  case 'operation': return getOperation(operationName);
  case 'request': return buildRequest(operationName, args);
  default: return { error: 'Unknown mode: ' + mode + '. Expected tools | resolve | operation | request.' };
}
""".lstrip()

DEFAULT_QUERY_ALIASES = {
    "top": "$top", "select": "$select", "filter": "$filter", "expand": "$expand",
    "orderby": "$orderby", "skiptoken": "$skiptoken", "count": "$count",
}


def extract_query_aliases(ws):
    _, cc = find_custom_code(ws)
    fns = cc["config"]["functions"]
    builder = find_request_builder(fns)
    if builder:
        aliases = parse_js_const(fns[builder]["code"], "QUERY_ALIASES")
        if aliases is not None:
            return aliases
    return {}


def emit_js(data, query_aliases):
    return (JS_RUNTIME
            .replace("__REGISTRY__", json.dumps(data["registry"], ensure_ascii=False, indent=2))
            .replace("__ORPHANS__", json.dumps(data["orphanOperations"], ensure_ascii=False))
            .replace("__OUTPUTFORMAT__", json.dumps(data["outputFormat"], ensure_ascii=False))
            .replace("__QUERY_ALIASES__", json.dumps(query_aliases, ensure_ascii=False)))


# ------------------------------------------------------------------- verifier

def run_js(js, params):
    """Execute the generated body the way Custom Code does: parameters in scope."""
    harness = (
        "const __p = %s;\n"
        "const mode = __p.mode, entity = __p.entity, action = __p.action,\n"
        "      operationName = __p.operationName, args = __p.args, ctx = __p.ctx;\n"
        "const __run = () => {\n%s\n};\n"
        "console.log(JSON.stringify(__run()));\n"
    ) % (json.dumps(params), js)
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as fh:
        fh.write(harness)
        tmp = fh.name
    try:
        out = subprocess.run(["node", tmp], capture_output=True, text=True)
        if out.returncode != 0:
            raise RuntimeError("node failed:\n%s" % out.stderr)
        return json.loads(out.stdout)
    finally:
        os.unlink(tmp)


def verify(ws, quiet=False, manifest_override=None):
    data = extract(ws, manifest_override)
    js = emit_js(data, extract_query_aliases(ws))
    produced = run_js(js, {"mode": "tools"})["tools"]
    original = data["_original"]

    problems = []
    if [t["name"] for t in produced] != [t["name"] for t in original]:
        problems.append("tool NAMES differ (blocking — consumers key their enabled flags on names)\n  before: %s\n  after:  %s"
                        % ([t["name"] for t in original], [t["name"] for t in produced]))
    by_name = {t["name"]: t for t in produced}
    for t in original:
        got = by_name.get(t["name"])
        if got is None:
            continue
        if got["description"] != t["description"]:
            problems.append("tool %r: description drift\n--- before\n%s\n--- after\n%s"
                            % (t["name"], t["description"], got["description"]))
        if json.dumps(got["inputSchema"], sort_keys=True) != json.dumps(t["inputSchema"], sort_keys=True):
            problems.append("tool %r: inputSchema drift\n--- before\n%s\n--- after\n%s"
                            % (t["name"],
                               json.dumps(t["inputSchema"], indent=1, sort_keys=True),
                               json.dumps(got["inputSchema"], indent=1, sort_keys=True)))

    # Routing must be preserved too, not just the manifest.
    for ent, e in data["registry"].items():
        if e.get("plain"):
            continue
        for act, o in e["ops"].items():
            r = run_js(js, {"mode": "resolve", "entity": ent, "action": act})
            if r.get("operationName") != o["op"]:
                problems.append("resolve(%s, %s) -> %r, expected %r" % (ent, act, r, o["op"]))

    old_ops = data.get("_operations") or {}
    for op_name, spec in old_ops.items():
        got = run_js(js, {"mode": "operation", "operationName": op_name})
        if json.dumps(got, sort_keys=True) != json.dumps(spec, sort_keys=True):
            problems.append("operation %r drift\n  before %s\n  after  %s"
                            % (op_name, json.dumps(spec, sort_keys=True), json.dumps(got, sort_keys=True)))

    # LLM-safe audit (Gotcha 21). Reported, never silently fixed: these are
    # pre-existing defects of the hand-written manifest, not migration drift.
    lint = []
    for t in produced:
        if len(t["description"]) > 1024:
            lint.append("tool %r: description is %d chars (> 1024 — providers reject it)"
                        % (t["name"], len(t["description"])))
        blob = json.dumps(t["inputSchema"])
        if '"$ref"' in blob:
            lint.append("tool %r: inputSchema contains a $ref (dangling in tools/list)" % t["name"])

        def walk(node, path):
            if isinstance(node, dict):
                if node.get("type") == "array" and "items" not in node:
                    lint.append("tool %r: array at %s has no `items`" % (t["name"], path))
                for k, v in node.items():
                    walk(v, "%s.%s" % (path, k))
            elif isinstance(node, list):
                for i, v in enumerate(node):
                    walk(v, "%s[%d]" % (path, i))

        walk(t["inputSchema"], "inputSchema")

    if not quiet:
        for w in data["warnings"]:
            print("  warning: %s" % w)
        print("  %d tools, %d operations, %d orphan operations"
              % (len(produced), sum(len(e["ops"]) for e in data["registry"].values() if not e.get("plain")),
                 len(data["orphanOperations"])))
        if lint:
            print("  LLM-safe lint (pre-existing, carried over unchanged):")
            for problem in lint:
                print("    ! %s" % problem)
    if problems:
        print("\nDRIFT (%d):" % len(problems))
        for p in problems:
            print("- %s" % p)
        return False, data, js
    if not quiet:
        print("  round-trip OK — manifest, resolve and operation specs all identical")
    return True, data, js


# --------------------------------------------------------------------- applier

def strip_mcptools_from_index(ws):
    path = os.path.join(ws, "index.yml")
    idx = load_yaml(path)
    if "mcpTools" in idx.get("config", {}).get("value", {}):
        del idx["config"]["value"]["mcpTools"]
        dump_yaml(idx, path)
        return True
    return False


def strip_mcptools_from_import(ws):
    path = os.path.join(ws, "imports", "MCP Core.yml")
    if not os.path.exists(path):
        return False
    imp = load_yaml(path)
    if "mcpTools" in (imp.get("config") or {}):
        del imp["config"]["mcpTools"]
        dump_yaml(imp, path)
        return True
    return False


def apply(ws, manifest_override=None):
    ok, data, js = verify(ws, manifest_override=manifest_override)
    if not ok:
        sys.exit("\nrefusing to apply: round-trip drift (see above)")

    cc_path, cc = find_custom_code(ws)
    fns = cc["config"]["functions"]
    fns["mcpRegistry"] = {
        "parameters": {
            # Custom Code accepts only string|number|boolean|object — never array,
            # never oneOf: either kills the whole module at load time.
            "mode": {"type": "string"},
            "entity": {"type": "string"},
            "action": {"type": "string"},
            "operationName": {"type": "string"},
            "args": {"type": "object"},
            "ctx": {"type": "object"},
        },
        "code": js,
    }
    removed = [n for n in ("resolveToolAction", "getOperation", data["_builder"]) if n and n in fns]
    for n in removed:
        del fns[n]
    dump_yaml(cc, cc_path)

    print("\napplied:")
    print("  + imports/Custom Code.yml: mcpRegistry (%d chars)" % len(js))
    print("  - imports/Custom Code.yml: %s" % ", ".join(removed))
    print("  - index.yml config.value.mcpTools: %s" % ("removed" if strip_mcptools_from_index(ws) else "absent"))
    print("  - imports/MCP Core.yml config.mcpTools: %s" % ("removed" if strip_mcptools_from_import(ws) else "absent"))
    done, todo = wire(ws, data["_builder"])
    for line in done:
        print("  %s" % line)
    if todo:
        print("\nneeds a human (not applied):")
        for line in todo:
            print("  ! %s" % line)
    print("\nnext: validate_automation on the touched files, push, then diff the LIVE tools/list "
          "against the manifest captured before the migration.")


# ----------------------------------------------------------------- DSUL wiring

LIST_TOOLS_YML = '''slug: listTools
name: /MCP/listTools
description: >-
  Build the MCP tools manifest at request time from the `mcpRegistry` Custom Code
  registry — the connector's single source of truth for entities, actions and REST
  specs. Nothing is stored in config.value.mcpTools nor in the MCP Core instance
  config any more, so the manifest can never drift from the routing table. `ctx`
  lets a tenant hide entities/actions it must not see (auth mode, disabled
  features) instead of post-filtering the tools/list response.
private: true
arguments:
  ctx:
    type: object
    description: >-
      Optional visibility context — {hideTools: [entity], hideActions: {entity: [action]}}.
do:
  - Custom Code.run:
      function: mcpRegistry
      parameters:
        mode: tools
        ctx: '{{ctx}}'
      output: registryResult
  - comment: >-
      Custom Code returns an error OBJECT when the module fails to load (the
      "Function not found" negative cache). Serving an empty list here would be far
      worse than failing: agent-factory and ai-knowledge PERSIST the tools/list
      response into the agent's config, so an empty array silently strips every tool
      from every agent using this connector. Fail loudly instead.
  - conditions:
      '{{registryResult.error}}':
        - set:
            name: output
            value:
              error: >-
                Tool registry unavailable: {{registryResult.error}}. The `mcpRegistry`
                Custom Code function did not run — check the Custom Code module loaded
                (a single invalid parameter type breaks every function in the instance).
        - break: {}
  - conditions:
      '!{{registryResult.tools.length}}':
        - set:
            name: output
            value:
              error: >-
                Tool registry returned no tools. Refusing to serve an empty tools/list —
                consumers persist it and would drop every tool from their agents.
        - break: {}
  - set:
      name: output
      value:
        tools: '{{registryResult.tools}}'
output: '{{output}}'
'''

TOOLS_LIST_BRANCH = """      '{{body.method}} == "tools/list"':
        - comment: >-
            The manifest is COMPUTED from the mcpRegistry registry, never stored. MCP
            Core still builds the JSON-RPC envelope — it just takes the list as its
            `tools` argument instead of reading its own config.mcpTools.
        - listTools:
            output: manifest
        - comment: >-
            Error envelope built inline rather than via MCP Core.buildJsonRpcError —
            that helper is `private: true` in the MCP Core app, so it is NOT callable
            as an App-mode instruction from a consumer workspace.
        - conditions:
            '{{manifest.error}}':
              - set:
                  name: response
                  value:
                    jsonrpc: '2.0'
                    id: '{{body.id}}'
                    error:
                      code: -32603
                      message: '{{manifest.error}}'
              - break: {}
        - MCP Core.handleMcpMethod:
            body: '{{body}}'
            serverName: __SERVERNAME__
            serverVersion: 1.0.0
            headers: '{{headers}}'
            tools: '{{manifest.tools}}'
            output: mcpResult
        - set:
            name: response
            value: '{{mcpResult.response}}'
"""


def wire(ws, builder_name):
    """Apply the DSUL side of the migration: listTools + mcp.yml + registry callers.

    Reported precisely — anything not matched is listed so it gets done by hand
    rather than silently skipped.
    """
    auto = os.path.join(ws, "automations")
    done, todo = [], []

    lt = os.path.join(auto, "listTools.yml")
    if os.path.exists(lt):
        todo.append("automations/listTools.yml already exists — left untouched")
    else:
        open(lt, "w").write(LIST_TOOLS_YML)
        done.append("+ automations/listTools.yml")

    mcp_path = os.path.join(auto, "mcp.yml")
    src = open(mcp_path).read()
    if 'tools/list"' in src and "listTools:" in src:
        todo.append("automations/mcp.yml already has a tools/list branch")
    else:
        m = re.search(r"^      default:\n(?:.*\n)*?"
                      r"(        - MCP Core\.handleMcpMethod:\n"
                      r"(?:            .*\n)+)", src, re.M)
        name_m = re.search(r"^            serverName: (.+)$", src, re.M)
        if not m or not name_m:
            todo.append("automations/mcp.yml: could not locate the MCP Core delegation — add the "
                        "tools/list branch by hand")
        else:
            branch = TOOLS_LIST_BRANCH.replace("__SERVERNAME__", name_m.group(1).strip())
            src = src[:m.start()] + branch + src[m.start():]
            src = src.replace("        - comment: tools/list, initialize, notifications/* — delegate to MCP Core.",
                              "        - comment: initialize, notifications/* — delegate to MCP Core.")
            open(mcp_path, "w").write(src)
            done.append("~ automations/mcp.yml: tools/list branch added")

    # Registry callers: the three deleted functions become mcpRegistry modes.
    repl = [
        (r"function: resolveToolAction\n(?P<i>\s+)parameters:\n\s+toolName: '\{\{(?P<t>[^}]+)\}\}'\n(?P<j>\s+)action:",
         lambda mo: "function: mcpRegistry\n%sparameters:\n%s  mode: resolve\n%s  entity: '{{%s}}'\n%saction:"
                    % (mo.group("i"), mo.group("i"), mo.group("i"), mo.group("t"), mo.group("j"))),
        (r"function: getOperation\n(?P<i>\s+)parameters:\n(?P<j>\s+)operationName:",
         lambda mo: "function: mcpRegistry\n%sparameters:\n%smode: operation\n%soperationName:"
                    % (mo.group("i"), mo.group("j"), mo.group("j"))),
        (r"function: %s\n(?P<i>\s+)parameters:\n(?P<j>\s+)operationName:" % re.escape(builder_name or "\0"),
         lambda mo: "function: mcpRegistry\n%sparameters:\n%smode: request\n%soperationName:"
                    % (mo.group("i"), mo.group("j"), mo.group("j"))),
    ]
    for fname in sorted(os.listdir(auto)):
        if not fname.endswith(".yml"):
            continue
        p = os.path.join(auto, fname)
        s0 = open(p).read()
        s = s0
        for pat, fn in repl:
            s = re.sub(pat, fn, s)
        if s != s0:
            open(p, "w").write(s)
            done.append("~ automations/%s: repointed to mcpRegistry" % fname)

    leftovers = []
    for fname in sorted(os.listdir(auto)):
        if not fname.endswith(".yml"):
            continue
        s = open(os.path.join(auto, fname)).read()
        for gone in ("resolveToolAction", "getOperation", builder_name):
            if gone and ("function: %s" % gone) in s:
                leftovers.append("automations/%s still calls %s" % (fname, gone))
    todo.extend(leftovers)
    return done, todo


# --------------------------------------------------------------------- swagger

def to_swagger(ws):
    data = extract(ws)
    idx = load_yaml(os.path.join(ws, "index.yml"))
    paths = {}
    for ent, e in data["registry"].items():
        if e.get("plain"):
            continue
        for act, o in e["ops"].items():
            if o.get("virtual"):
                continue
            item = paths.setdefault(o["path"], {})
            params = []
            for p in o.get("pathParams", []):
                params.append({"name": p, "in": "path", "required": True,
                               "schema": {"type": "string"},
                               "description": (e["params"].get(p) or {}).get("description", "")})
            for p in o.get("queryParams", []):
                spec = e["params"].get(p) or {}
                params.append({"name": p, "in": "query", "required": False,
                               "schema": {"type": spec.get("type", "string")},
                               "description": spec.get("description", "")})
            item[o["method"].lower()] = {
                "operationId": o["op"],
                "summary": o.get("summary", ""),
                "tags": [ent],
                "parameters": params,
                "responses": {"200": {"description": "OK"}},
            }
    return {
        "openapi": "3.0.3",
        "info": {"title": idx.get("name", "connector"),
                 "description": "Generated from the mcpRegistry REGISTRY — do not hand-edit.",
                 "version": "1.0.0"},
        "tags": [{"name": ent, "description": e["blurb"]}
                 for ent, e in data["registry"].items() if not e.get("plain")],
        "paths": paths,
    }


# ------------------------------------------------------------------------ main

def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", choices=["extract", "verify", "apply", "swagger"])
    ap.add_argument("workspace", help="path to workspaces/<slug>")
    ap.add_argument("--out", help="output file (extract / swagger)")
    ap.add_argument("--manifest", help="JSON file holding the tools array to migrate from "
                                       "(e.g. a LIVE tools/list capture). Overrides the stored "
                                       "copies — use it when the deployed manifest is ahead of git.")
    args = ap.parse_args()
    ws = args.workspace.rstrip("/")
    override = None
    if getattr(args, "manifest", None):
        override = json.load(open(args.manifest))
        if isinstance(override, dict):
            override = override.get("result", override).get("tools", override)

    if args.command == "extract":
        data = extract(ws, override)
        for w in data["warnings"]:
            print("warning: %s" % w, file=sys.stderr)
        payload = {k: v for k, v in data.items() if not k.startswith("_") and k != "warnings"}
        out = json.dumps(payload, indent=2, ensure_ascii=False)
        if args.out:
            os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
            open(args.out, "w").write(out)
            print("wrote %s" % args.out)
        else:
            print(out)

    elif args.command == "verify":
        print("verifying %s" % ws)
        ok, _, _ = verify(ws, manifest_override=override)
        sys.exit(0 if ok else 1)

    elif args.command == "apply":
        print("migrating %s" % ws)
        apply(ws, override)

    elif args.command == "swagger":
        out = args.out or os.path.join(ws, "swagger.generated.yml")
        dump_yaml(to_swagger(ws), out)
        print("wrote %s" % out)


if __name__ == "__main__":
    main()
