# Ticket: Distribute the Prisme.ai MCP as a Claude Code + Codex Plugin (Marketplace)

## Context

Today the MCP is installed via `claudeBootstrap/setup.sh` — a ~1165-line bash installer that:

- Registers the server with `claude mcp add prisme-ai-builder ... -- node $BUILD_PATH` (user scope)
- Captures JWTs two ways: paste, or browser auto-capture via `capture-token.mjs` → `src/auth/browser.ts` (Playwright)
- Packs multiple environments + workspaces into one `PRISME_ENVIRONMENTS` JSON blob, plus `PRISME_DEFAULT_ENVIRONMENT`, `PRISME_DISABLE_FEEDBACK_TOOLS`
- Mirrors the install into Codex's `~/.codex/config.toml`
- Sets `apiKeyHelper` in `~/.claude/settings.json`
- Copies the `prisme-assistant` agent into `~/.claude/agents/`
- Tells the user to manually `cp -r claudeBootstrap/.claude` into each project (skills, agents, `allow-workspace.sh` hook, CLAUDE.md)
- The linter/validator ships *inside* the MCP build (invoked by the `validate_automation` tool)

Both Claude Code (`.claude-plugin/`) and Codex (`.codex-plugin/`) now support a **plugin + marketplace** standard: a git-hosted directory with a manifest + `.mcp.json`, `skills/`, `hooks/`, distributed via `marketplace.json` and installed with `/plugin marketplace add` (Claude) / `codex plugin marketplace add` (Codex).

This ticket ports the entire distribution model to a single plugin consumable by **both** tools, retiring `setup.sh` **and removing Playwright entirely**.

### Key existing assets (reuse, do not rebuild)
- `src/auth/persist.ts` — multi-environment credential model (`PRISME_ENVIRONMENTS` topology + per-env JWT/token). The persistence *target* changes (see below); the model is kept.
- The API client already sends the credential as a Bearer header — user-created API tokens slot into the same code path as the current JWTs.
- `build/` is ~456K of pure JS. Removing the `playwright` dependency (~15M in node_modules) leaves nothing runtime-heavy.

### Decisions already made (do not revisit)
1. `apiKeyHelper` is **legacy → remove entirely**. Anthropic auth is the user's own `claude` login; nothing to ship.
2. **Playwright is removed entirely** — no browser automation, no `src/auth/browser.ts`, no `capture-token.mjs`, no `playwright` dependency. Authentication uses **user-created API tokens**: the user creates a token in the studio at `https://<studio-domain>/settings/tokens` (e.g. `https://sandbox.prisme.ai/settings/tokens`) and provides it to the MCP, which persists it. Works identically on Claude and Codex, no `userConfig` prompt required (keeps the rich multi-env model and works on Codex, which has no secret-prompt).
3. The `prisme-assistant` (and `ticket-validator`) **subagents become skills** — skills are the portable common denominator across both tools.

---

## Objective

Ship one git repo that is simultaneously a Claude Code plugin and a Codex plugin, installable from a marketplace, with:
- Zero `npm install` / build / SessionStart cost at runtime (node-only)
- Credentials = user-created API tokens, registered on first use via an MCP tool, persisted in `${CLAUDE_PLUGIN_DATA}`
- All skills, hooks, and (Claude-only) agents bundled
- `setup.sh` retired, Playwright removed

---

## Architecture

### 1. MCP core — prebuilt single-file bundle (committed artifact)

Bundle the server into one self-contained `build/index.js` at **release time** (CI), with deps inlined and the `linter/` sub-package inlined. With Playwright gone there are **no externals** — the bundle is fully self-contained.

- Runtime requirement: `node` only (already required by Claude Code/Codex).
- No install, no `tsc`, no SessionStart hook. Offline, deterministic, instant start.
- `.mcp.json`:
  ```json
  {
    "mcpServers": {
      "prisme-ai-builder": {
        "command": "node",
        "args": ["${CLAUDE_PLUGIN_ROOT}/build/index.js"],
        "env": {
          "PRISME_CONFIG_DIR": "${CLAUDE_PLUGIN_DATA}"
        }
      }
    }
  }
  ```
- **Rejected alternative:** `npx @prisme-ai/mcp` — adds cold-start latency + first-launch network + version-pin quirks. (May be offered later as a secondary `npm` plugin source.)
- **Rejected alternative:** SessionStart `npm install && tsc` — taxes every/first session, needs network, fragile.

### 2. Authentication — user-created API tokens (no browser automation)

When a tool call targets an environment with no stored token, the server returns an **actionable error** instead of failing opaquely:

> No credentials for environment `sandbox`. Create a token at **https://sandbox.prisme.ai/settings/tokens**, then register it with the `set_token` tool.

- The token-creation URL is **derived per environment** from its configured studio/API domain: `<studio-origin>/settings/tokens`.
- A `set_token` MCP tool (repurposed from `refresh_auth_token`) takes `environment` + `token`, **validates the token with a probe call** (e.g. a cheap authenticated endpoint), and persists it.
- One-time cost per environment; re-run `set_token` to rotate or replace an expired token.

### 3. Credentials — persisted in plugin data dir

- Persistence target moves from `~/.claude.json` env → `${CLAUDE_PLUGIN_DATA}/credentials.json` (mode 600).
- Server reads config from `PRISME_CONFIG_DIR` (= `${CLAUDE_PLUGIN_DATA}`) at startup; if no creds for the requested environment, surfaces the token instructions + `set_token` tool (see §2).
- Environment/workspace topology (`PRISME_ENVIRONMENTS`) ships as a default config file in the plugin and/or is created on first registration; per-env tokens live only in the data dir.
- Survives plugin updates (data dir is version-independent) and works identically on Claude + Codex.

---

## Deliverables

### A. Plugin manifests + marketplace
- [ ] `.claude-plugin/plugin.json` — `name` (`prisme-ai`), `description`, `version`, `author`, `homepage`, `repository`, `license`. **No** `apiKeyHelper`. (Plugin agents must NOT declare `hooks`/`mcpServers`/`permissionMode` — unsupported.)
- [ ] `.claude-plugin/marketplace.json` — lists the plugin, `source: "./"` (repo root is the plugin). Installable via `/plugin marketplace add prismeai/prismeai-mcp` → `/plugin install prisme-ai@prismeai-mcp`.
- [ ] `.codex-plugin/plugin.json` — Codex manifest with `name`, `version`, `description`, component pointers (`skills`, `mcpServers`, `hooks`).
- [ ] `.codex-plugin/marketplace.json` — Codex catalog. Installable via `codex plugin marketplace add prismeai/prismeai-mcp`.
- [ ] Verify the two manifests coexist in one repo and resolve the same `.mcp.json`, `skills/`, `hooks/`.

### B. MCP wiring
- [ ] `.mcp.json` at repo root (shared by both manifests), as above.
- [ ] Confirm `${CLAUDE_PLUGIN_ROOT}` / Codex `${PLUGIN_ROOT}` resolve the bundle path on both tools.

### C. Bundling + release pipeline
- [ ] Add esbuild (or ncc) bundling: `npm run build:bundle` → single `build/index.js`, deps inlined, `linter/` inlined, **no externals**.
- [ ] Remove `playwright` from `dependencies` in `package.json`.
- [ ] GitHub Action on tag: `npm ci → build linter → build:bundle → commit build/index.js → bump plugin.json version`.
- [ ] Decide artifact strategy: commit `build/index.js` to the git source (primary). Document `version` bump → users get `/plugin marketplace update`.

### D. Credentials / token flow port
- [ ] Introduce `PRISME_CONFIG_DIR` env (defaults to `${CLAUDE_PLUGIN_DATA}`); read/write creds + env topology there instead of `~/.claude.json`.
- [ ] Replace `refresh_auth_token` with `set_token` (`environment`, `token`): probe-validate the token, persist to `${CLAUDE_PLUGIN_DATA}/credentials.json` (mode 600). Update the tool description — no more browser, no more "edit ~/.claude.json".
- [ ] "No creds" error path: include the exact per-environment token-creation URL (`<studio-origin>/settings/tokens`, e.g. `https://sandbox.prisme.ai/settings/tokens`) in the error message.
- [ ] **Delete** `src/auth/browser.ts` and all Playwright imports/handling.
- [ ] Migration note: optional one-time import of existing `~/.claude.json` `PRISME_ENVIRONMENTS` into the new data-dir config (`persist.ts` already honors `PRISME_CLAUDE_JSON_PATH`, which eases this).

### E. Skills / agents / hooks migration
- [ ] Move `claudeBootstrap/.claude/skills/*` → `skills/` (names become namespaced, e.g. `/prisme-ai:guide`, `/prisme-ai:app-mcp-implement`). Update any cross-references / `/guide` onboarding text.
- [ ] Convert `prisme-assistant` agent → `skills/prisme-assistant/SKILL.md`.
- [ ] Convert `ticket-validator` agent → `skills/ticket-validator/SKILL.md`.
- [ ] Keep `code-review` (+ optionally `prisme-assistant`) as Claude `agents/` too if subagent behavior is still wanted on Claude; ensure no unsupported frontmatter.
- [ ] Move `allow-workspace.sh` hook → `hooks/hooks.json` (same hook object format; use `${CLAUDE_PLUGIN_ROOT}` for the script path).
- [ ] Decide fate of `CLAUDE.md` context (plugins don't inject a project CLAUDE.md; fold essential context into a skill or the `/guide` skill).

### F. Retire `setup.sh`
- [ ] Remove `claudeBootstrap/setup.sh`, `capture-token.mjs` (browser capture is gone), `prisme-assistant.md` (now a skill).
- [ ] Rewrite `claudeBootstrap/README.md` → plugin install instructions for both Claude and Codex, including the token-creation step (`https://<domain>/settings/tokens`).
- [ ] Update root `README.md`.

---

## Acceptance criteria

- [ ] Fresh machine, Claude: `/plugin marketplace add <repo>` → `/plugin install prisme-ai@<mkt>` → MCP tools appear (`mcp__prisme-ai-builder__*`) with **no** `npm install`/build.
- [ ] Fresh machine, Codex: `codex plugin marketplace add <repo>` → install → MCP tools available.
- [ ] First tool call with no creds → error message contains the exact token URL for that environment (e.g. `https://sandbox.prisme.ai/settings/tokens`); user creates a token, calls `set_token`, it is validated and persisted to `${CLAUDE_PLUGIN_DATA}/credentials.json`; subsequent calls reuse it.
- [ ] `set_token` with an invalid token fails the probe and persists nothing.
- [ ] `validate_automation` (linter) works from the bundled artifact.
- [ ] Skills invokable as `/prisme-ai:<name>` on Claude; equivalent on Codex. `prisme-assistant` + `ticket-validator` work as skills.
- [ ] `allow-workspace.sh` hook fires from the plugin.
- [ ] Plugin update flow works: bump `version`, `/plugin marketplace update` pulls new bundle.
- [ ] No `apiKeyHelper`, no `~/.claude.json` mutation, no `setup.sh`, **no `playwright` dependency** remaining.

---

## Caveats / known limitations

- **Verify token semantics**: confirm tokens created at `/settings/tokens` are accepted by the API as Bearer credentials on all target environments, and document their lifetime/expiry. `set_token` re-registration is the rotation path.
- **Codex subagent support varies** → agent workflows are shipped as skills so they exist on both tools regardless (decision #3).
- **Plugin `settings.json`** only honors `agent` / `subagentStatusLine` — permissions/allowlists must be enforced via the `hooks/` (e.g. `allow-workspace.sh`), not shipped settings.
- **Plugin agents** cannot declare `hooks`, `mcpServers`, or `permissionMode`.
- **Anthropic API key** is out of scope — the user's own `claude` login handles it.
- Keychain `userConfig` route is intentionally **not** used (2KB limit + can't model dynamic multi-env + unsupported on Codex).

---

## Out of scope
- Publishing to the public `claude-community` / Codex public marketplaces (private/team marketplace first).
- npm-published secondary install path (optional follow-up).

## References
- Create plugins: https://code.claude.com/docs/en/plugins
- Plugins reference (`.mcp.json`, `${CLAUDE_PLUGIN_ROOT}`/`${CLAUDE_PLUGIN_DATA}`, userConfig): https://code.claude.com/docs/en/plugins-reference
- Marketplaces: https://code.claude.com/docs/en/plugin-marketplaces
- Codex plugins: https://developers.openai.com/codex/plugins · build: https://developers.openai.com/codex/plugins/build
