---
name: mcp-workspace
description: Scaffold and build a complete Prisme.ai MCP (Model Context Protocol) workspace with JSON-RPC 2.0 endpoint, tools, auth, and tests. Use when creating a new MCP server for an external service.
argument-hint: "[service-name] [description of tools needed]"
allowed-tools: Read, Write, Edit, Grep, Glob, Task, AskUserQuestion, mcp__prisme-ai-builder__get_prisme_documentation, mcp__prisme-ai-builder__lint_doc, mcp__prisme-ai-builder__push_workspace
---

# Prisme.ai MCP Workspace Builder

You are building a new Prisme.ai workspace that exposes a JSON-RPC 2.0 MCP server for an external service. Follow this structured process based on the MCP recipe.

## Arguments

- **Input**: $ARGUMENTS (first word is service name in kebab-case, rest describes the tools/integrations needed)

---

## Architecture: 3-Layer Pattern

Every MCP workspace uses a **3-layer architecture** that separates concerns:

```
┌─ MCP flow (tool-* wrappers, private) ──────────────────────┐
│ mcp.yml → tool-listFiles (02_Tools)                        │
│           → ensureAuthentication → user session auth        │
│           → method-listFiles (01_Helpers)                   │
│           → output formatting (structured/verbose/both)     │
└────────────────────────────────────────────────────────────-┘

┌─ App instruction flow (flat, public) ──────────────────────┐
│ importing workspace → WebDAV.listFiles                     │
│                       → buildAuthHeader → app config auth  │
│                       → method-listFiles (01_Helpers)      │
└────────────────────────────────────────────────────────────-┘
```

### Layer Details

| Layer | File pattern | Slug pattern | Name pattern | Private | Purpose |
|-------|-------------|-------------|-------------|---------|---------|
| **Method** | `method-{tool}.yml` | `method-{tool}` | `/01_Helpers/{tool}` | true | Core logic: API calls, data transform. Flat args: tool params + `baseUrl` + `authHeader`. No auth logic, no output formatting. |
| **Tool wrapper** | `tool-{tool}.yml` | `tool-{tool}` | `/02_Tools/{tool}` | true | MCP interface: `body.arguments.*` → calls `ensureAuthentication` → delegates to `method-{tool}` → output formatting (structured/verbose/both) |
| **Flat app instruction** | `{tool}.yml` | `{tool}` | `{tool}` | **false** | Public app API: flat args → calls `buildAuthHeader` (reads `config.*`) → delegates to `method-{tool}` → returns raw structured result |
| **Helper** | `buildAuthHeader.yml` | `buildAuthHeader` | `/01_Helpers/buildAuthHeader` | true | Reads `config.*` (app config), builds `{baseUrl, authHeader}` or `{error}` |
| **Helper** | `ensureAuthentication.yml` | `ensureAuthentication` | `/01_Helpers/ensureAuthentication` | true | Reads `user.{service}.credentials` (session), builds auth header |

**Why 3 layers?**
- **Methods** are reusable core logic with no coupling to auth strategy or output format
- **Tool wrappers** serve the MCP JSON-RPC endpoint (session-based auth via `configureService`)
- **Flat app instructions** serve other workspaces that import this app (config-based auth)

---

## Phase 1: Requirements Gathering

### 1.1 Parse Input

Extract from $ARGUMENTS:
- **Service name** (first word): used as `{service}` throughout (e.g., `jira`, `github`, `notion`)
- **Description**: what tools/operations are needed

### 1.2 Read Reference Documentation

Read Prisme.ai documentation in parallel:

```
mcp__prisme-ai-builder__get_prisme_documentation(section: "automations")
mcp__prisme-ai-builder__get_prisme_documentation(section: "advanced-features")
mcp__prisme-ai-builder__get_prisme_documentation(section: "workspace-config")
```

### 1.3 Read the MCP Recipe

Read the MCP recipe for reference patterns:

```
Read: ./mcp_receipe.md
```

### 1.4 Check for Existing MCP Workspaces Locally

Look for reference implementations to follow established patterns:

```
Glob: ./*-mcp/index.yml
Glob: ./*_mcp/index.yml
```

Read at least one existing MCP workspace to understand concrete patterns (prefer `webdav` or `confluence-mcp` if available). Pay attention to the 3-layer pattern (method-*, tool-*, flat app instructions).

### 1.5 Ask User for Service Details

Use `AskUserQuestion` to clarify:

1. **Authentication type**: What auth does the service API use?
   - Options: Basic Auth (email + API token), Bearer/PAT token, OAuth Client Credentials, API Key
2. **Deployment variants**: Does the service have Cloud vs Server/DC variants?
   - Options: Single variant only, Cloud + Server/DC (like Confluence/Jira)
3. **Tools needed**: Confirm the list of MCP tools to implement
   - Ask user to list operations (e.g., "list items, get item, create item, search, delete item")
4. **MCP Resources**: Does it need navigable resources?
   - Options: No resources needed, Yes (describe hierarchy)

---

## Phase 2: Scaffold File Structure

Create the workspace directory with all files. The folder name must be `{service}-mcp/`.

### 2.1 Files to Create (in order)

```
{service}-mcp/
├── index.yml
├── security.yml
├── imports/
│   └── Custom Code.yml
└── automations/
    ├── mcp.yml                          # MCP JSON-RPC router (private)
    ├── ensureAuthentication.yml          # Session auth helper (private)
    ├── buildAuthHeader.yml              # App config auth helper (private)
    ├── configure{Service}.yml           # MCP configure tool (private)
    │
    ├── method-{tool1}.yml               # Core logic (private)
    ├── method-{tool2}.yml
    ├── ...
    │
    ├── tool-{tool1}.yml                 # MCP tool wrappers (private)
    ├── tool-{tool2}.yml
    ├── ...
    │
    ├── {tool1}.yml                      # Flat app instructions (PUBLIC)
    ├── {tool2}.yml
    ├── ...
    │
    ├── test-configure{Service}.yml      # Tests (private)
    ├── test-{tool1}.yml
    ├── test-{tool2}.yml
    └── ...
```

**Visibility rules:**
- Only the flat app instructions (`{tool}.yml`) are **public** (no `private:` field)
- Everything else MUST have `private: true`

---

## Phase 3: Create Core Files

### 3.1 index.yml

The workspace config with ALL mcpTools schemas AND a `config.schema` for app configuration.

**Rules:**
- Each tool has `name`, `description`, `inputSchema`
- `inputSchema` is standard JSON Schema (`type: object`, `properties`, `required`)
- Every tool MUST include an `outputFormat` property (enum: structured, verbose, both; default: verbose)
- Descriptions must be precise — they serve as documentation for the LLM client
- Include `mcpResources` only if user requested resources
- **`config.schema`** defines the app configuration form (for importing workspaces). If configuration has conditional options, use oneOf pattern of Schema Form

**Template:**
```yaml
name: {Service} MCP
slug: {service}-mcp
description: MCP JSON-RPC 2.0 server for {Service}
labels: []
repositories: {}
config:
  schema:
    baseUrl:
      type: string
      title: '{Service} Base URL'
      description: '{Service} server base URL'
    type:
      type: string
      title: Authentication Type
      enum:
        - basic
        - token
      description: '''basic'' for username/password, ''token'' for Bearer token'
    # ... auth-specific config fields (username, password, token, etc.)
  value:
    mcpTools:
      - name: configure{Service}
        description: >-
          Configure {Service} credentials. Must be called before using any other tool.
        inputSchema:
          type: object
          required:
            - baseUrl
          properties:
            baseUrl:
              type: string
              description: '{Service} base URL'
            # ... auth-specific properties based on Phase 1 answers
            outputFormat:
              type: string
              enum:
                - structured
                - verbose
                - both
              default: verbose
              description: >-
                Response format - 'structured' for machine processing, 'verbose'
                for LLM consumption, 'both' for MCP spec compliance

      # ... one block per tool (names match the flat app instruction slugs)

customDomains: []
registerWorkspace: true
```

### 3.2 security.yml

Copy the standard RBAC template exactly as defined in the MCP recipe (Section 3).

### 3.3 imports/Custom Code.yml

Create with at least these functions:
- `cleanBaseUrl`: Strip trailing slashes from URL
- Auth encoding function appropriate to the service (e.g., `buildBasicAuthHeader` for Basic Auth)
- Any URL building / encoding functions needed by the tools

**Template:**
```yaml
appSlug: Custom Code
slug: Custom Code
config:
  functions:
    cleanBaseUrl:
      parameters:
        url:
          type: string
      code: >
        return url.replace(/\/+$/, '');
```

Add `buildBasicAuthHeader` if using Basic Auth, or other helpers as needed.

### 3.4 automations/ensureAuthentication.yml

Follow the MCP recipe Section 5 pattern:
1. Read credentials from user scope (fallback to config/secret)
2. Validate required credentials are present
3. Build the Authorization header based on auth type
4. Return `{ authenticated, authHeader, baseUrl, type }`

**Key rules:**
- `slug: ensureAuthentication`
- `name: /01_Helpers/ensureAuthentication`
- `private: true`
- Must handle the auth type(s) chosen in Phase 1
- Must return a clear error message pointing to `configure{Service}` when not configured
- `validateArguments: true` and `output: '{{output}}'`

### 3.5 automations/buildAuthHeader.yml

Build the Authorization header from **app config** (`config.*`) instead of user session.

**Key rules:**
- `slug: buildAuthHeader`
- `name: /01_Helpers/buildAuthHeader`
- `private: true`
- Reads `config.baseUrl`, `config.type`, `config.username`, `config.password`, `config.token` (matching `config.schema` fields)
- Returns `{baseUrl, authHeader}` or `{error: "..."}` — no `authenticated` field
- Uses same Custom Code functions as `ensureAuthentication` for header building
- `output: '{{output}}'`

**Template:**
```yaml
slug: buildAuthHeader
name: /01_Helpers/buildAuthHeader
description: >-
  Build Authorization header from app config. Returns {baseUrl, authHeader} or
  {error}.
private: true
do:
  - conditions:
      '!{{config.baseUrl}}':
        - set:
            name: output
            value:
              error: >-
                {Service} not configured. Please set baseUrl, type, and
                credentials in the app configuration.
        - break: {}
  - conditions:
      '{{config.type}} == "basic"':
        - conditions:
            '!{{config.username}}':
              - set:
                  name: output
                  value:
                    error: Basic Auth requires username in app configuration.
              - break: {}
        - conditions:
            '!{{config.password}}':
              - set:
                  name: output
                  value:
                    error: Basic Auth requires password in app configuration.
              - break: {}
        - Custom Code.run function:
            function: buildBasicAuthHeader
            parameters:
              username: '{{config.username}}'
              password: '{{config.password}}'
            output: authHeader
      '{{config.type}} == "token"':
        - conditions:
            '!{{config.token}}':
              - set:
                  name: output
                  value:
                    error: Token auth requires a Bearer token in app configuration.
              - break: {}
        - set:
            name: authHeader
            value: Bearer {{config.token}}
      default:
        - set:
            name: output
            value:
              error: >-
                Authentication type must be 'basic' or 'token' in app
                configuration.
        - break: {}
  - set:
      name: output
      value:
        baseUrl: '{{config.baseUrl}}'
        authHeader: '{{authHeader}}'
output: '{{output}}'
```

### 3.6 automations/configure{Service}.yml

Follow the MCP recipe Section 6 pattern:
1. Validate required parameters
2. Clean the base URL via Custom Code
3. Store credentials in `user.{service}.credentials` scope
4. Emit a `{service}.configuration.updated` event
5. Return output in the requested format (structured/verbose/both)

**Key rules:**
- `slug: configure{Service}` (camelCase, e.g., `configureJira`)
- `name: /02_Tools/configure{Service}`
- `private: true`
- Arguments follow the `body.arguments.*` pattern
- `validateArguments: true` and `output: '{{output}}'`

### 3.7 automations/mcp.yml

Follow the MCP recipe Section 7 pattern. This is the central JSON-RPC router.

**Structure:**
1. Auth check (`!{{user.email}}` → 401)
2. Optional: auto-configuration from HTTP headers
3. Routing by `body.method`:
   - `initialize` → return server info with protocol version `2025-06-18`
   - `notifications/initialized` → return empty 200
   - `tools/list` → return `{{config.mcpTools}}`
   - `tools/call` → route to the correct **tool-*** automation by `body.params.name`
   - `resources/list` → return `{{config.mcpResources}}` (if applicable)
   - `resources/read` → route to resource handler (if applicable)
   - `default` → error -32601 Method not found

**Key rules:**
- `slug: mcp`
- `name: 00_MCP/endpoint`
- `private: true`
- `when: endpoint: true`
- **Route to `tool-{toolName}:` slugs** (not the flat app instruction slugs)
- `configureService` is the exception — called directly (no `tool-` prefix) since it has no method layer
- Every tool declared in `mcpTools` MUST have a corresponding entry in the `tools/call` conditions
- Server name: `prisme-ai-{service}-mcp-server`

**Important — tools/call routing pattern:**
```yaml
'{{body.params.name}} == "listFiles"':
  - tool-listFiles:
      body: '{{toolArgs}}'
      output: toolResult
'{{body.params.name}} == "configureWebdav"':
  - configureWebdav:
      body: '{{toolArgs}}'
      output: toolResult
```

### 3.8 automations/method-{tool}.yml (one per tool — core logic)

The method contains the **core logic** extracted from the tool: API calls, data transformation, error handling. No auth, no output formatting.

**Key rules:**
- `slug: method-{toolName}`
- `name: /01_Helpers/{toolName}`
- `private: true`
- **Flat arguments**: tool-specific params + `baseUrl` + `authHeader` (not nested in `body.arguments`)
- No call to `ensureAuthentication` or `buildAuthHeader`
- Returns structured data directly (e.g., `{success, path, status}`) or `{error: "..."}` on failure
- `validateArguments: true` and `output: '{{output}}'`

**Template (simple tool — e.g., deleteFile):**
```yaml
slug: method-deleteFile
name: /01_Helpers/deleteFile
description: Core logic to delete a file or directory
private: true
arguments:
  path:
    type: string
  baseUrl:
    type: string
  authHeader:
    type: string
do:
  - conditions:
      '!{{path}}':
        - set:
            name: output
            value:
              error: 'path is required'
        - break: {}
  - Custom Code.run function:
      function: encodePath
      parameters:
        path: '{{path}}'
      output: encodedPath
  - fetch:
      url: '{{baseUrl}}{{encodedPath}}'
      method: DELETE
      headers:
        Authorization: '{{authHeader}}'
      output: result
      outputMode: detailed_response
      emitErrors: true
  - conditions:
      '{{result.status}} >= 400':
        - set:
            name: output
            value:
              error: >-
                Error deleting file (HTTP {{result.status}}): {{result.body}}
        - break: {}
  - set:
      name: output
      value:
        success: true
        path: '{{path}}'
        status: '{{result.status}}'
validateArguments: true
output: '{{output}}'
```

### 3.9 automations/tool-{tool}.yml (one per tool — MCP wrapper)

Thin wrapper for MCP: unwraps `body.arguments.*`, calls auth, delegates to method, formats output.

**Key rules:**
- `slug: tool-{toolName}`
- `name: /02_Tools/{toolName}`
- `private: true`
- Arguments follow the `body.arguments.*` pattern
- Calls `ensureAuthentication` → checks `auth.authenticated` → calls `method-{tool}` → checks `methodResult.error` → formats output (structured/verbose/both)
- `validateArguments: true` and `output: '{{output}}'`

**Template:**
```yaml
slug: tool-deleteFile
name: /02_Tools/deleteFile
description: Delete a file or directory from the WebDAV server
private: true
arguments:
  body:
    type: object
    properties:
      arguments:
        type: object
        properties:
          path:
            type: string
          outputFormat:
            type: string
            enum:
              - structured
              - verbose
              - both
            default: verbose
do:
  - ensureAuthentication:
      required: true
      output: auth
  - conditions:
      '!{{auth.authenticated}}':
        - set:
            name: output
            value:
              content:
                - type: text
                  text: |
                    Error: {{auth.error}}
                    {{auth.message}}
              isError: true
        - break: {}
  - method-deleteFile:
      path: '{{body.arguments.path}}'
      baseUrl: '{{auth.baseUrl}}'
      authHeader: '{{auth.authHeader}}'
      output: methodResult
  - conditions:
      '{{methodResult.error}}':
        - set:
            name: output
            value:
              content:
                - type: text
                  text: '{{methodResult.error}}'
              isError: true
        - break: {}
  - conditions:
      '{{body.arguments.outputFormat}} == "structured"':
        - set:
            name: output
            value:
              structuredContent: '{{methodResult}}'
      '{{body.arguments.outputFormat}} == "both"':
        - set:
            name: output
            value:
              content:
                - type: text
                  text: '{% json({{methodResult}}) %}'
              structuredContent: '{{methodResult}}'
      default:
        - set:
            name: output
            value:
              content:
                - type: text
                  text: |
                    File deleted successfully!

                    **Path:** {{methodResult.path}}
                    **Status:** {{methodResult.status}}
validateArguments: true
output: '{{output}}'
```

### 3.10 automations/{tool}.yml (one per tool — flat public app instruction)

Clean public API for workspaces that import this app. No `body.arguments` wrapping, no output formatting.

**Key rules:**
- `slug: {toolName}` (clean, no prefix)
- `name: {toolName}` (flat, no folder)
- **NOT private** (this is the public-facing automation)
- Flat arguments at top level (tool-specific params only, no `outputFormat`)
- Calls `buildAuthHeader` → checks `auth.error` → calls `method-{tool}` → returns raw result
- `validateArguments: true` and `output: '{{output}}'`

**Template:**
```yaml
slug: deleteFile
name: deleteFile
description: Delete a file or directory from the server
arguments:
  path:
    type: string
    description: Path to the file or directory to delete
do:
  - buildAuthHeader:
      output: auth
  - conditions:
      '{{auth.error}}':
        - set:
            name: output
            value:
              error: '{{auth.error}}'
        - break: {}
  - method-deleteFile:
      path: '{{path}}'
      baseUrl: '{{auth.baseUrl}}'
      authHeader: '{{auth.authHeader}}'
      output: methodResult
  - set:
      name: output
      value: '{{methodResult}}'
validateArguments: true
output: '{{output}}'
```

### 3.11 automations/test-{tool}.yml (one per tool)

Tests are **playground automations** (not endpoints). Configuration is done once via `test-configure{Service}`, and other tests assume credentials are already set.

**Tests call `tool-{toolName}:` (the MCP wrapper), NOT the flat app instruction.**

**For configure{Service} test:**
1. Declare auth arguments as flat `arguments:` with `oneOf` for deployment variants
2. Call `configure{Service}` directly with credentials as arguments
3. Return raw result

**Example test-configure{Service}.yml:**
```yaml
slug: test-configure{Service}
name: /04_Tests/test-configure{Service}
description: Playground test for configure{Service} tool
private: true
when: {}
arguments:
  baseUrl:
    type: string
    description: '{Service} base URL'
  type:
    description: Deployment type
    oneOf:
      - value: cloud
        title: Cloud
        properties:
          email:
            type: string
            description: Email (Cloud only)
          apiToken:
            type: string
            ui:widget: textarea
            description: API token (Cloud only)
      - value: datacenter
        title: Datacenter
        properties:
          personalAccessToken:
            type: string
            ui:widget: textarea
            description: Personal Access Token (DC only)
do:
  - configureWebdav:
      body:
        arguments:
          baseUrl: '{{baseUrl}}'
          type: '{{type}}'
          email: '{{email}}'
          apiToken: '{{apiToken}}'
          personalAccessToken: '{{personalAccessToken}}'
          outputFormat: both
      output: result
  - set:
      name: output
      value: '{{result}}'
output: '{{output}}'
```

**For standard tool tests (all other tools):**
```yaml
slug: test-{toolName}
name: /04_Tests/test-{toolName}
description: Playground test for {toolName} tool
private: true
when: {}
arguments:
  someParam:
    type: string
    description: Description of param
do:
  - tool-{toolName}:
      body:
        arguments:
          someParam: '{{someParam}}'
          outputFormat: both
      output: result
  - set:
      name: output
      value: '{{result}}'
output: '{{output}}'
```

**Key rules:**
- `slug: test-{toolName}`
- `name: /04_Tests/test-{toolName}`
- `private: true`
- `when: {}` (playground automation, NOT endpoint)
- Calls **`tool-{toolName}:`** (the MCP wrapper, with `body.arguments` interface)
- Arguments are **flat** at top level (not nested under `body`), referenced as `{{paramName}}`
- **No credential injection** in standard tool tests — configuration is done once via `test-configure{Service}`
- Always use `outputFormat: both`
- No `validateArguments` needed
- Use `oneOf` in configure test for deployment variant conditional fields
- Use `ui:widget: textarea` for secret/token fields

---

## Phase 4: Cloud vs Server/DC Handling

If the service has multiple deployment variants (answered in Phase 1):

- Add a `type` field to `configure{Service}` arguments (enum: cloud, datacenter)
- In `ensureAuthentication` AND `buildAuthHeader`, branch on type to build the correct auth header
- In each **method** file, branch on auth type if API URLs differ:

```yaml
- conditions:
    '{{authType}} == "cloud"':
      - set:
          name: apiUrl
          value: '{{baseUrl}}/api/v2/resource'
    default:
      - set:
          name: apiUrl
          value: '{{baseUrl}}/rest/api/resource'
```

Note: if API URLs differ by variant, the method should accept an `authType` argument in addition to `baseUrl` and `authHeader`.

---

## Phase 5: Validation

### 5.1 Lint Check

Read the lint documentation and verify all automations against it:

```
mcp__prisme-ai-builder__lint_doc()
```

**Critical checks:**
- No JavaScript in `{{ }}` — only variable substitution
- No unsupported functions in `{% %}` — use Custom Code for complex logic
- No `#` comments between `do:` instructions — use `- comment:` instruction
- `{% round({{version}}) + 1 %}` for arithmetic (not direct addition)
- Headers in lowercase: `{{headers.baseurl}}` not `{{headers.baseUrl}}`

### 5.2 Consistency Check

Verify:
- [ ] Every tool in `mcpTools` (index.yml) has a matching `tool-{tool}:` entry in `mcp.yml` (`tools/call`)
- [ ] Every tool has THREE automation files: `method-{tool}.yml`, `tool-{tool}.yml`, `{tool}.yml`
- [ ] Every tool has a `test-{tool}.yml` file calling `tool-{tool}:`
- [ ] `mcp.yml` routes to `tool-{tool}:` (not `{tool}:`)
- [ ] All **method** files have flat args (`path`, `baseUrl`, `authHeader`) — no `body.arguments`
- [ ] All **tool wrappers** have `body.arguments.*` interface and call `ensureAuthentication`
- [ ] All **flat app instructions** call `buildAuthHeader` then `method-{tool}`
- [ ] Only flat app instructions (`{tool}.yml`) are public — all others have `private: true`
- [ ] `config.schema` in index.yml has fields matching what `buildAuthHeader` reads
- [ ] All automations with `do:` blocks have `output: '{{output}}'`
- [ ] All tools handle the 3 output formats (structured/verbose/both) in tool wrappers

### 5.3 Code Review

Launch the code-review agent:

```
Task(subagent_type: "code-review", prompt: "Review all YAML files in ./{service}-mcp/ for:
- YAML syntax correctness
- Prisme.ai expression syntax ({{}} vs {% %})
- 3-layer consistency: method-* ← tool-* ← mcp.yml, method-* ← {tool}.yml ← buildAuthHeader
- Missing error handling
- Consistency between index.yml mcpTools and mcp.yml routing (must use tool-* slugs)
- Private flags: only flat app instructions should be public
- config.schema matches buildAuthHeader expectations
- Security issues (exposed secrets, missing auth checks)

Provide issues as:
- 🔴 MAJOR: Must fix before deploying
- 🟠 NEED_HUMAN: Requires human decision
- 🟡 MINOR: Suggestion")
```

### 5.4 Handle Review Results

- **🔴 MAJOR**: Fix immediately
- **🟠 NEED_HUMAN**: Ask the user via `AskUserQuestion`
- **🟡 MINOR**: Note but don't block

---

## Phase 6: Summary & Next Steps

After all files are created and validated, provide:

1. **Summary**: List all files created with their purpose, organized by layer
2. **Architecture diagram**: Show the 3-layer flow
3. **Tool list**: Table of all MCP tools with descriptions
4. **Visibility**: Confirm which automations are public vs private
5. **Testing instructions**: How to test via `execute_automation` or webhook
6. **Deployment command**: The `push_workspace` command to run (but don't execute unless asked)

```
push_workspace(
  path: "./{service}-mcp",
  workspaceName: "{service}-mcp",
  message: "v1-initial",
  environment: "sandbox"
)
```

---

## Common Pitfalls Reference

| Pitfall | Solution |
|---------|---------|
| `base64()` doesn't exist in `{% %}` | Use `Custom Code.run` with `Buffer.from().toString('base64')` |
| `trim()` doesn't exist in `{% %}` | Do trim in Custom Code |
| `.replace()` on `{% %}` result | Move logic to Custom Code |
| `{% {{version}} + 1 %}` → string concat | Use `{% round({{version}}) + 1 %}` |
| `outputMode: body` has no `statusCode` | Use `try/catch` or `detailed_response` |
| Boolean `false` → string `"false"` in Custom Code | Test `=== true || === 'true'` in JS |
| HTTP headers always lowercase in Prisme | `{{headers.baseurl}}` not `{{headers.baseUrl}}` |
| Tool in index.yml but missing in mcp.yml | Every mcpTool MUST be routed in tools/call |
| mcp.yml calls `{tool}:` instead of `tool-{tool}:` | Always use `tool-` prefix in mcp.yml routing |
| Flat app instruction has `private: true` | Only flat instructions are public — remove `private` |
| Test calls `{tool}:` instead of `tool-{tool}:` | Tests must call the MCP wrapper (`tool-{tool}:`) |
| Method has `body.arguments` wrapping | Methods use flat args: `path`, `baseUrl`, `authHeader` |
| `buildAuthHeader` reads `user.*` | It must read `config.*` (app config), not user session |
| Missing `config.schema` in index.yml | Required for app configuration form when importing |
