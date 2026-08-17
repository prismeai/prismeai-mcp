#!/usr/bin/env python3
"""Fail-closed audit for App+MCP secret-backed configuration."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import yaml


SECRET_REF = re.compile(r"^\{\{secret\.[A-Za-z0-9_.-]+\}\}$")
UUID = re.compile(r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\b")
URL = re.compile(r"https?://[^\s'\"<>`)]+")
SCOPE_LITERAL = re.compile(r"(?:api\s+refresh_token\s+offline_access|https://[^\s'\"<>`]+/auth/[^\s'\"<>`,]+)")
SHORT_RESOURCE_ID = re.compile(
    r"(?i)(?:workspaceId\s*:\s*|/workspaces/)([A-Za-z0-9]{7,16})(?=[/\s'\"`]|$)"
)
SUSPICIOUS_KEY = re.compile(
    r"(?i)\b(tenant|subscription|resource.?group|resource.?id|connection.?id|"
    r"client.?id|client.?secret|api.?key|token|certificate|audience|scopes?|"
    r"api.?version|base.?url|endpoint|deployment|project.?id|account.?id)\b"
)
SUSPICIOUS_VALUE = re.compile(
    r"(?i)(oauth|openid|offline_access|refresh_token|/subscriptions/|"
    r"\b(?:sandbox|staging|production|prod|dev|qa)\b|^v\d+(?:\.\d+)+$)"
)
ASSIGNMENT = re.compile(
    r"^\s*(?:-\s*)?(?P<key>[A-Za-z0-9_.-]+)\s*[:=]\s*(?P<value>.+?)\s*$"
)
TEXT_SUFFIXES = {
    ".yml", ".yaml", ".json", ".md", ".mdx", ".ts", ".tsx", ".js", ".mjs",
    ".cjs", ".py", ".sh", ".html", ".txt", ".env", ".example",
    ".snippet",
}
SKIP_DIRS = {".git", "node_modules", "dist", ".vite", "coverage"}


def flatten(value, prefix="config.value"):
    if isinstance(value, dict):
        for key, child in value.items():
            yield from flatten(child, f"{prefix}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from flatten(child, f"{prefix}[{index}]")
    else:
        yield prefix, value


def load_allowlist(path: Path):
    if not path.exists():
        return []
    data = yaml.safe_load(path.read_text()) or {}
    entries = data.get("exceptions", [])
    for entry in entries:
        if not entry.get("path") or not entry.get("pattern") or not entry.get("justification"):
            raise ValueError(f"Invalid allowlist entry: {entry!r}")
    return entries


def allowed(entries, rel_path, text):
    for entry in entries:
        if Path(rel_path).match(entry["path"]) and re.search(entry["pattern"], text):
            return entry["justification"]
    return None


def iter_text_files(roots):
    seen = set()
    for root in roots:
        for path in root.rglob("*"):
            if not path.is_file() or path.name == "package-lock.json" or any(part in SKIP_DIRS for part in path.parts):
                continue
            if path.suffix.lower() not in TEXT_SUFFIXES and path.name not in {".env.example", ".import.yml"}:
                continue
            resolved = path.resolve()
            if resolved in seen:
                continue
            seen.add(resolved)
            yield root, path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("roots", nargs="+", type=Path)
    parser.add_argument("--allowlist", type=Path)
    parser.add_argument("--json-report", type=Path)
    args = parser.parse_args()

    roots = [root.resolve() for root in args.roots]
    workspace = roots[0]
    index_path = workspace / "index.yml"
    if not index_path.exists():
        raise SystemExit(f"Missing canonical index.yml: {index_path}")
    allowlist_path = args.allowlist or workspace / "secret-backed-audit-allowlist.yml"
    entries = load_allowlist(allowlist_path)

    index = yaml.safe_load(index_path.read_text()) or {}
    config_value = ((index.get("config") or {}).get("value") or {})
    secret_schema = ((index.get("secrets") or {}).get("schema") or {})
    inventory = []
    failures = []
    exceptions_used = []

    print("CONFIG.VALUE INVENTORY")
    for path, value in flatten(config_value):
        rendered = json.dumps(value, ensure_ascii=False)
        if isinstance(value, str) and SECRET_REF.fullmatch(value):
            classification = "secret-binding"
        elif path.startswith("config.value.bundles.") or path.startswith("config.value.mcpTools["):
            classification = "structural"
        else:
            why = allowed(entries, "index.yml", f"{path}={rendered}")
            classification = "justified-constant" if why else "FORBIDDEN"
            if why:
                exceptions_used.append({"path": "index.yml", "literal": f"{path}={rendered}", "justification": why})
            else:
                failures.append(f"index.yml: {path} has non-secret literal {rendered}")
        inventory.append({"path": path, "value": value, "classification": classification})
        print(f"- {path}: {classification} = {rendered}")

    print("\nVERSIONED LITERAL SCAN")
    findings = []
    for root, path in iter_text_files(roots):
        rel = path.relative_to(root).as_posix()
        if rel == allowlist_path.name or path.resolve() == Path(__file__).resolve():
            continue
        for lineno, line in enumerate(path.read_text(errors="replace").splitlines(), 1):
            candidates = list(URL.findall(line)) + list(UUID.findall(line)) + list(SCOPE_LITERAL.findall(line))
            candidates += [match.group(1) for match in SHORT_RESOURCE_ID.finditer(line)]
            stripped = line.strip()
            assignment = ASSIGNMENT.match(stripped)
            if assignment and SUSPICIOUS_KEY.search(assignment.group("key")):
                rhs = assignment.group("value").strip().rstrip(",")
                is_runtime_expression = (
                    "{{" in rhs
                    or rhs in {"{}", "[]", "true", "false", "null"}
                    or rhs.startswith(("t(", "centralWh(", "useState(", "clean(", "String(", "scope.", "(auth."))
                )
                if not candidates and not is_runtime_expression and SUSPICIOUS_VALUE.search(rhs):
                    candidates.append(stripped)
            for candidate in dict.fromkeys(candidates):
                why = allowed(entries, rel, candidate)
                item = {"path": rel, "line": lineno, "literal": candidate}
                if why:
                    item["justification"] = why
                    exceptions_used.append(item)
                else:
                    failures.append(f"{rel}:{lineno}: variable-looking literal: {candidate}")
                findings.append(item)

    required_markers = {
        "secret schema": bool(secret_schema),
        "secret store write": "security/secrets" in (workspace / "automations/onInstall.yml").read_text(),
        "binding B": "makeSecretRef" in (workspace / "automations/onInstall.yml").read_text(),
        "binding A": "makeConfigRef" in (workspace / "automations/onInstall.yml").read_text(),
        "SPA secret write": "/security/secrets" in "\n".join(
            p.read_text(errors="replace") for r in roots[1:] for p in r.rglob("*.tsx")
        ) if len(roots) > 1 else True,
        "context-bound token cache key": all(
            marker in (workspace / "imports/Custom Code.yml").read_text()
            for marker in ("makeTokenCacheKey", "tenantId", "clientId", "scopes")
        ),
        "cache mismatch invalidation": "cacheKey" in (workspace / "automations/buildAppAuth.yml").read_text(),
    }
    # Per-field secret model: every auth field is its own secret holding one plain
    # value, surfaced to automations through a binding-A alias written by onInstall.
    oninstall = (workspace / "automations/onInstall.yml").read_text()
    binding_to_secret = {
        b: k for k, b in re.findall(
            r"makeConfigRef, parameters: \{key: (\w+)\}, output: (\w+)", oninstall)
    }
    alias_to_secret = {
        alias: binding_to_secret[bvar]
        for alias, bvar in re.findall(r"^\s+(\w+): '\{\{(\w+)\}\}'", oninstall, re.M)
        if bvar in binding_to_secret
    }
    missing_schema_fields = sorted(
        sec for sec in alias_to_secret.values() if sec not in secret_schema
    )
    if missing_schema_fields:
        failures.append("Auth secrets missing from secrets.schema: " + ", ".join(missing_schema_fields))

    # Aggregate secrets are forbidden: one secret key = one plain value.
    aggregate_secrets = sorted(
        k for k, v in secret_schema.items()
        if isinstance(v, dict) and v.get("type") in {"object", "array"}
    )
    if aggregate_secrets:
        failures.append("Secrets must hold one plain value (type: string): " + ", ".join(aggregate_secrets))
    required_markers["no aggregate secrets"] = not aggregate_secrets

    # buildAppAuth assembles a transient auth object from the field-level values;
    # every {{auth.X}} it reads must actually be set on that object.
    build_text = (workspace / "automations/buildAppAuth.yml").read_text()
    obj = re.search(r"name: auth\n\s+value:\n((?:\s{8}\w+:.*\n)+)", build_text)
    defined = set(re.findall(r"^\s+(\w+):", obj.group(1), re.M)) if obj else set()
    referenced = set(re.findall(r"\{\{auth\.(\w+)", build_text))
    dangling = sorted(referenced - defined)
    if dangling:
        failures.append("buildAppAuth reads undefined auth fields: " + ", ".join(dangling))
    required_markers["transient auth object complete"] = not dangling

    configurable_fields = {
        alias for alias in alias_to_secret
        if SUSPICIOUS_KEY.search(alias) or alias in {"loginHost", "instanceUrl", "jwtUsername"}
    }
    spa_text = "\n".join(
        p.read_text(errors="replace") for r in roots[1:] for p in r.rglob("*.tsx")
    ) if len(roots) > 1 else ""
    missing_spa_fields = sorted(
        a for a in configurable_fields
        if a not in spa_text and alias_to_secret[a] not in spa_text
    )
    if missing_spa_fields:
        failures.append("Secret-backed fields missing from SPA/install controls: " + ", ".join(missing_spa_fields))
    required_markers["auth secrets declared in schema"] = not missing_schema_fields
    required_markers["secret-backed fields exposed in SPA"] = not missing_spa_fields
    for label, ok in required_markers.items():
        if not ok:
            failures.append(f"Missing required control: {label}")

    report = {
        "configValueInventory": inventory,
        "literalFindings": findings,
        "remainingJustifiedLiterals": exceptions_used,
        "controls": required_markers,
        "failures": failures,
    }
    if args.json_report:
        args.json_report.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")

    print("\nREMAINING JUSTIFIED LITERALS")
    for item in exceptions_used:
        print(f"- {item['path']}:{item.get('line', '-')}: {item['literal']} — {item['justification']}")
    print("\nCONTROLS")
    for label, ok in required_markers.items():
        print(f"- {'OK' if ok else 'FAIL'} {label}")
    if failures:
        print("\nAUDIT FAILED", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        return 1
    print("\nAUDIT PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
