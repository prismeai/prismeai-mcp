---
name: agent-implement-a2ui
description: Add A2UI (Agent-to-UI) surfaces to a Prisme.ai MCP workspace so that LLM agents can render interactive UI through MCP tool calls. Scaffolds an MCP endpoint (or extends an existing one) with tools whose outputs include a __surface payload (components, data_model, actions) that the host UI renders using the prisme://blocks/v1 catalog. Use when the user says "ajoute des surfaces A2UI", "expose une UI via MCP", "/agent-implement-a2ui <workspace> <surfaces>", or wants the agent to draw cards/forms/tables/buttons inside a chat.
argument-hint: "[workspace-id-or-folder] [surfaces: card, form, table, action-card, feedback, confirmation, custom...]"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, Agent, mcp__prisme-ai-builder__pull_workspace, mcp__prisme-ai-builder__push_workspace, mcp__prisme-ai-builder__validate_automation, mcp__prisme-ai-builder__get_prisme_documentation, mcp__prisme-ai-builder__search_workspaces, mcp__prisme-ai-builder__list_automations
---

# A2UI — Agent-to-UI surfaces over MCP

You are wiring **A2UI** into a Prisme.ai workspace. A2UI lets an LLM agent display interactive UI (cards, forms, tables, approval flows…) by calling MCP tools whose responses carry a `__surface` block. The host UI (AI Store, embedded chat, custom client) reads `__surface` and renders components from the `prisme://blocks/v1` catalog.

**Reference implementation**: workspace `rTFdCox` (slug `perfect-wolverine-5`, name `a2ui-test-mcp`) in sandbox. Pull it locally if you need to inspect:
```
mcp__prisme-ai-builder__pull_workspace(workspaceId: "rTFdCox", environment: "sandbox", path: "./rTFdCox-workspace")
```

---

## Mental model

```
LLM agent ──tools/call──► MCP endpoint ──► tool automation
                              ▲                  │
                              │                  ▼
                              │            output = {
                              │              content: [{type:text, text:"…"}],   ← LLM reads this
                              │              __surface: {                         ← UI renders this
                              │                catalog_id: prisme://blocks/v1,
                              │                components: [...],
                              │                data_model: {...},
                              │                wait_for_action: bool,
                              │                send_data_model: bool
                              │              }
                              │            }
                              │
        user clicks Button ───┘  (returns { action.name, data_model } back to agent)
```

Key idea: **one tool = one surface**. The `content.text` is the LLM's narration ("Form displayed, waiting…"); the `__surface` is what the human sees. Both ship in the same MCP response.

---

## Arguments

Parse `$ARGUMENTS`:
- **First token** — target workspace: a workspace ID (e.g. `rTFdCox`), a local folder name (e.g. `my-workspace`), or `new <slug>` to scaffold a fresh A2UI-only workspace.
- **Rest** — comma- or space-separated list of surface types to generate. Built-in keywords map to ready templates; anything else is treated as a custom surface (you'll design it).

Built-in surface keywords:

| Keyword | Template | Interactive |
|---|---|---|
| `card` | `templates/show_card.yml` | no |
| `table` | `templates/show_table.yml` | no |
| `form` | `templates/show_form.yml` | yes (submit/cancel) |
| `action-card` | `templates/show_action_card.yml` | yes (approve/reject) |
| `feedback` | `templates/show_feedback.yml` | yes (submit/skip) |
| `confirmation` | `templates/show_confirmation.yml` | yes (yes/no) |
| `demo` | `templates/show_component_demo.yml` | yes (showcase) |

If $ARGUMENTS is empty, ask the user with `AskUserQuestion`:
1. **Target** — Existing workspace ID / Existing local folder / New workspace
2. **Surfaces** — multiSelect: card, table, form, action-card, feedback, confirmation, demo, custom

---

## Phase 1 — Resolve target

1. **Pull or detect the workspace**.
   - If user gave a workspace ID, run `pull_workspace` to `./<id>-workspace`.
   - If user gave a local folder, `ls` it; verify it has `index.yml`.
   - If `new <slug>`, scaffold the minimal layout described in [Phase 5 — Fresh workspace scaffold](#phase-5--fresh-workspace-scaffold).

2. **Detect the existing MCP endpoint** if any:
   - Look for `automations/mcp.yml` with `when.endpoint: */mcp`.
   - If present, you will *extend* it (add tool branches to its dispatch).
   - If absent, you will create one (see [Phase 4 — MCP endpoint](#phase-4--mcp-endpoint)).

3. **Detect mcpTools list location**:
   - Most workspaces declare tools in `index.yml > config.value.mcpTools` (canonical: same place the host's `tools/list` reads from).
   - `imports/MCP Core.yml > config.mcpTools` if the workspace uses the MCP Core app — in that case BOTH places matter for some tenants. See feedback `[[feedback-mcp-core-config-is-source]]` in memory.

---

## Phase 2 — Plan surfaces

For each surface keyword:

1. **Pick a slug** — `show_<name>` (e.g. `show_card`, `show_invoice`). Snake_case, no `-`.
2. **Decide arguments** — what the LLM will pass in `tools/call.arguments`. Keep it minimal: title, description, rows, items, defaults. Heavy structure (component tree) lives in the automation, not in arguments.
3. **Decide interactivity**:
   - `wait_for_action: true` + `send_data_model: true` → agent pauses, gets `{action, data_model}` back when user clicks.
   - `wait_for_action: false` → read-only display; agent continues immediately.
4. **Plan the data_model shape** — what the UI binds to via `{ path: /xxx }`.

For custom surfaces, sketch the component tree before coding. The mental tool is: *list of components, each with an id, referenced by parent's `children: []`*. No imbricated tree.

---

## Phase 3 — Generate tool automations

For each built-in surface: copy `templates/show_<keyword>.yml` into `automations/` of the target workspace, then customize (defaults, fields, etc.) to fit the requested use case.

For custom surfaces: hand-write the automation following the rules in [§ A2UI cheat sheet](#a2ui-cheat-sheet) below. The shape is always:

```yaml
slug: show_xxx
name: show_xxx
description: <what this surface displays — written for the LLM>
private: true                         # NEVER public; only the MCP endpoint calls it
arguments:
  arguments:                          # nested by convention — matches body.params.arguments
    type: object
    description: Tool arguments from MCP call
do:
  - set: { name: _args, value: '{{arguments}}' }
  # …unpack, defaults, build _components & _data_model…
output:
  content:
    - type: text
      text: "<one-line narration for the LLM>"
  isError: false
  __surface:
    surface_id: <stable-id-or-slug>
    catalog_id: prisme://blocks/v1
    wait_for_action: <bool>
    send_data_model: <bool>           # omit if wait_for_action is false
    text: "<same one-line narration>"
    components: [ ... ]               # flat list, each with id + component + props
    data_model: { ... }               # initial values keyed by /paths used in components
```

### Rules of thumb

- **Flat components list**. No nesting. Parents reference children by `id` in `children: [...]`.
- **Bindings**: any prop that should be data-driven becomes `prop: { path: /a/b/c }` instead of a literal. `path` is a JSON pointer into `data_model`.
- **Actions** (`Button.action`): `{ name: <event>, context?: { ... } }`. The client returns `name` + filled `data_model` + `context` to the agent.
- **`surface_id`** is for client-side reconciliation — keep it stable per tool name; vary the suffix if multiple instances coexist.
- **Don't pre-fill data_model with computed strings inside `content`**. If the value comes from arguments, bind via path so the UI re-renders on data changes.

---

## A2UI cheat sheet

### `__surface` shape

| Field | Type | Required | Notes |
|---|---|---|---|
| `surface_id` | string | yes | stable per tool; suffix when multiple instances |
| `catalog_id` | string | yes | always `prisme://blocks/v1` for now |
| `wait_for_action` | bool | yes | pauses the agent when true |
| `send_data_model` | bool | no | when true + wait_for_action, returns filled data_model |
| `text` | string | yes | mirrors `content[0].text` |
| `components` | array | yes | flat list of `{id, component, ...props, children?}` |
| `data_model` | object | yes-ish | required when any prop uses `{path}` bindings |

### Component catalog `prisme://blocks/v1`

**Layout**: `Column`, `Row`, `Card`, `Tabs`, `Modal`, `Divider`
- `Column` / `Row`: `gap`, `justify` (start/center/end/between), `align` (start/center/end), `children`
- `Card`: `title?`, `className?` (Tailwind-ish: `p-4`, `flex-1`…), `children`
- `Tabs`: `tabs: [{id, label, children}]`
- `Modal`: `title?`, `children`
- `Divider`: no props

**Display**: `Text`, `Badge`, `Alert`, `Progress`, `Avatar`, `Image`, `List`
- `Text`: `content` (string or `{path}`), `variant` (heading/body/caption/code), `weight?` (semibold…)
- `Badge`: `label` (string or `{path}`), `variant` (default/secondary/outline/destructive/warning)
- `Alert`: `title`, `description` (string or `{path}`), `variant` (default/destructive/warning)
- `Progress`: `value` (number or `{path}`), `max`
- `Avatar`: `src?`, `alt`, `fallback?`
- `Image`: `src`, `alt`, `width?`, `height?`
- `List`: `variant` (bullet/number/plain), `items: string[]`

**Inputs**: `TextField`, `TextArea`, `Select`, `CheckBox`, `Switch`, `Slider`
- `TextField`: `placeholder`, `type?` (text/email/password), `text: {path}` (binding)
- `TextArea`: `placeholder`, `rows`, `text: {path}`
- `Select`: `placeholder`, `options: [{value, label}]`, `value: {path}`
- `CheckBox` / `Switch`: `label`, `value: {path}`
- `Slider`: `min`, `max`, `step`, `value: {path}` (or literal for read-only demo)

**Actions**: `Button`
- `label`, `variant` (primary/outline/ghost/destructive), `disabled?`, `action: {name, context?}`

**Data**: `DataTable`
- `columns: [{key, header}]`, `data: {path}` (binding to array)

### Bindings

Whenever a prop reads from the data model:
```yaml
value: { path: /form/email }    # → reads/writes data_model.form.email
content: { path: /project/name }
```

Initial values live in `data_model`:
```yaml
data_model:
  form: { email: "", priority: "" }
  project: { name: "Alpha", progress: 73 }
```

JSON pointer rules: `/foo/bar` for nested, `/list/0/key` for array index (rarely needed since `DataTable.data` takes the array root).

### Action result contract

When the user triggers a Button with `action.name: submit`:
- If `send_data_model: true` → agent receives `{ action: "submit", data_model: { …filled… }, context?: {…} }`
- If `send_data_model: false` → agent receives `{ action: "submit", context?: {…} }`

The agent decides next steps from this payload. Design tool descriptions accordingly ("Pauses until user submits — returns the filled form").

---

## Phase 4 — MCP endpoint

If the workspace has no `automations/mcp.yml`, create one. Choose an endpoint slug that fits the workspace (e.g. `a2ui-test/mcp`, `<service>/mcp`):

```yaml
slug: mcp
name: MCP/endpoint
description: MCP JSON-RPC 2.0 endpoint for A2UI tool discovery and execution
when:
  endpoint: <endpoint-slug>/mcp
do:
  - conditions:
      '{{body.method}} == "initialize"':
        - set:
            name: output
            value:
              jsonrpc: '2.0'
              id: '{{body.id}}'
              result:
                protocolVersion: '2025-06-18'
                capabilities: { tools: {} }
                serverInfo: { name: <workspace-name>, version: 1.0.0 }
      '{{body.method}} == "notifications/initialized"':
        - set: { name: $http, value: { status: 200 } }
        - set: { name: output, value: '' }
      '{{body.method}} == "tools/list"':
        - set:
            name: output
            value:
              jsonrpc: '2.0'
              id: '{{body.id}}'
              result:
                tools: '{{config.mcpTools}}'
      '{{body.method}} == "tools/call"':
        - conditions:
            '{{body.params.name}} == "show_<surface1>"':
              - show_<surface1>: { arguments: '{{body.params.arguments}}', output: toolResult }
            # …one branch per surface…
            default:
              - set:
                  name: output
                  value:
                    jsonrpc: '2.0'
                    id: '{{body.id}}'
                    error:
                      code: -32601
                      message: 'Tool not found: {{body.params.name}}'
              - break: {}
        - set:
            name: output
            value:
              jsonrpc: '2.0'
              id: '{{body.id}}'
              result: '{{toolResult}}'
      default:
        - set:
            name: output
            value:
              jsonrpc: '2.0'
              id: '{{body.id}}'
              error:
                code: -32601
                message: 'Method not found: {{body.method}}'
output: '{{output}}'
```

If the endpoint exists, ADD one branch per new surface under the `tools/call` conditions block. Do not duplicate the surrounding scaffolding.

---

## Phase 5 — mcpTools declaration

In `index.yml`, under `config.value.mcpTools`, append an entry per surface:

```yaml
- name: show_<surface>
  description: <LLM-facing description — say WHAT it displays + whether it pauses>
  inputSchema:
    type: object
    properties:
      <arg1>:
        type: string
        description: <…>
    required: []
```

**Description rules** (the LLM reads these to decide when to call):
- Lead with the visible outcome ("Display a project status card…").
- For interactive surfaces, mention pause: "The conversation pauses until user submits."
- For arrays, give shape hint: `'Custom field definitions. Each: { id, component, placeholder, type? }. Components: TextField, TextArea, Select, CheckBox.'`
- Per memory [[feedback-mcp-tool-array-items]], any `type: array` MUST have `items: { type: object | string }` — OpenAI rejects otherwise.

---

## Phase 6 — Fresh workspace scaffold (only if `new <slug>`)

Minimal file layout:

```
<slug>-workspace/
├── .import.yml
├── index.yml          # config.value.mcpTools list
├── security.yml       # standard (copy from rTFdCox)
└── automations/
    ├── mcp.yml        # endpoint
    └── show_<…>.yml   # one per surface
```

- `id` in `index.yml` is assigned by Prisme.ai on push — leave it as a placeholder name or let `push_workspace` resolve it.
- Add labels: `[app-builder, one-product, mcp]`.
- `security.yml`: copy verbatim from `rTFdCox-workspace/security.yml`.

---

## Phase 7 — Validate and push

For each generated/edited automation, run:
```
mcp__prisme-ai-builder__validate_automation(path: "<workspace>/automations/show_xxx.yml")
```
Trust this over example patterns — see project CLAUDE.md.

Then push:
```
mcp__prisme-ai-builder__push_workspace(path: "<workspace>", workspaceId: "<id>", environment: "sandbox")
```

After push, give the user:
- The MCP endpoint URL: `https://api.<env>.prisme.ai/v2/workspaces/<id>/webhooks/<endpoint-slug>/mcp`
- A list of tool names exposed
- Suggested test prompt for the LLM (e.g. "Show me a project status card for Project Beta at 45%")

---

## Phase 8 — Review

Spawn a sub-task with `Agent` (subagent_type: code-review or general-purpose) to review the generated automations. Format issues as 🔴 MAJOR | 🟠 NEED_HUMAN bullets, per project CLAUDE.md. Fix MAJORs immediately; ask for the rest.

---

## Common pitfalls

- **Forgetting `private: true`** on `show_*` automations → they become callable as public endpoints, bypassing the MCP envelope. Per [[feedback-private-does-not-block-webhook]], `private: true` does NOT block webhooks but it hides them from App instructions — still set it.
- **Putting JS in `{{}}`** — DSUL refuses. Use `{% %}` for math; otherwise unpack into intermediate `set:` steps. See memory.
- **Naming a var `output`** inside a `do:` step — collides with the call-site capture variable; rename to `_output` or similar. Memory: [[feedback-dsul-output-variable]].
- **`type: array` without `items:`** in inputSchema → silent break at LLM call time.
- **Editing `imports/MCP Core.yml > config.mcpTools` only** — the canonical source for THIS pattern is `index.yml > config.value.mcpTools` (the endpoint reads `{{config.mcpTools}}`). Memory: [[feedback-mcp-core-config-is-source]].
- **Using `{path}` without initial value in `data_model`** → the host may render empty/`null`. Always seed bound props in `data_model`, even with `""` or `false`.
- **Forgetting the `text` field inside `__surface`** — host UIs that fall back to text-only mode (no catalog) display this. Mirror `content[0].text`.

---

## After running

End-of-turn summary: list surfaces added, endpoint URL, and the next test step. Do not write planning docs unless the user asks.
