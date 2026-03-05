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
│           → buildMcpAuth → headers / session / config │
│           → method-listFiles (01_Helpers)                   │
│           → output formatting (structured/verbose/both)     │
└────────────────────────────────────────────────────────────-┘

┌─ App instruction flow (flat, public) ──────────────────────┐
│ importing workspace → WebDAV.listFiles                     │
│                       → buildAppAuth → app config auth  │
│                       → method-listFiles (01_Helpers)      │
└────────────────────────────────────────────────────────────-┘
```

### Layer Details

| Layer | File pattern | Slug pattern | Name pattern | Private | Purpose |
|-------|-------------|-------------|-------------|---------|---------|
| **Method** | `method-{tool}.yml` | `method-{tool}` | `/02_Methods/{scope}/method-{tool}` | true | Core logic: API calls, data transform. Flat args: tool params + `baseUrl` + `authHeader`. No auth logic, no output formatting. |
| **Tool wrapper** | `tool-{tool}.yml` | `tool-{tool}` | `/03_Tools/{scope}/{tool}` | true | MCP interface: `body.arguments.*` → calls `buildMcpAuth` → delegates to `method-{tool}` → output formatting (structured/verbose/both) |
| **Flat app instruction** | `{tool}.yml` | `{tool}` | `{tool}` | **false** | Public app API: flat args → calls `buildAppAuth` (reads `config.*`) → delegates to `method-{tool}` → returns raw structured result |
| **Helper** | `buildAppAuth.yml` | `buildAppAuth` | `/01_Helpers/buildAppAuth` | true | Reads `config.*` ONLY (app config), builds `{baseUrl, authHeader}` or `{error}`. **MUST NOT** read `user.*` or request headers. Used by flat app instructions (app-to-app calls). |
| **Helper** | `buildMcpAuth.yml` | `buildMcpAuth` | `/01_Helpers/buildMcpAuth` | true | Multi-tier auth: request headers → `user.{service}.credentials` (session) → `config.*` (fallback). Builds auth header from first available source. Used by tool-* wrappers (MCP calls). |

**Why 3 layers?**
- **Methods** are reusable core logic with no coupling to auth strategy or output format
- **Tool wrappers** serve the MCP JSON-RPC endpoint — `buildMcpAuth` tries request headers first, then user session, then falls back to `config.*`
- **Flat app instructions** serve other workspaces that import this app — `buildAppAuth` reads `config.*` only (no user context available in app-to-app calls)

**Why two auth helpers?**
- `buildMcpAuth` supports **interactive MCP usage** where credentials can come from multiple sources (per-request headers, user-configured session, or workspace defaults)
- `buildAppAuth` supports **app-to-app usage** where only the installing workspace's config is available — no user session, no request headers

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

### 1.3 Check for Existing MCP Workspaces Locally

Look for reference implementations to follow established patterns:

```
Glob: ./*-mcp/index.yml
Glob: ./*_mcp/index.yml
```

Read at least one existing MCP workspace to understand concrete patterns (prefer `webdav` or `confluence-mcp` if available). Pay attention to the 3-layer pattern (method-*, tool-*, flat app instructions).

### 1.4 Ask User for Service Details

Use `AskUserQuestion` to clarify:

1. **Authentication type**: What auth does the service API use?
   - Options: Basic Auth (email + API token), Bearer/PAT token, OAuth Client Credentials, API Key
2. **Deployment variants**: Does the service have Cloud vs Server/DC variants?
   - Options: Single variant only, Cloud + Server/DC (like Confluence/Jira)
3. **Tools needed**: Confirm the list of MCP tools to implement
   - Ask user to list operations (e.g., "list items, get item, create item, search, delete item")
4. **MCP Resources**: Does it need navigable resources?
   - Options: No resources needed, Yes (describe hierarchy)
5. **Auth strategy**: Where should authentication happen?
   - Per-tool (default): Each tool-* calls `buildMcpAuth` independently. Simpler, modular.
   - Centralized: `mcp.yml` authenticates once before `routeToolCall`, passes credentials in `toolArgs`. Better for services needing pre-processing (URL building, token refresh, header enrichment).

If centralized auth is chosen:
- `mcp.yml` calls `buildMcpAuth` before `routeToolCall`, adds auth result to `toolArgs`
- `tool-*.yml` wrappers skip `buildMcpAuth` call, receive auth from `toolArgs`
- `routeToolCall` passes enriched `toolArgs` through
- `configure{Service}` is always exempted from auth (it sets up auth)

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
├── pages/
│   └── _doc.yml                         # Documentation page (Instructions + MCP tabs)
└── automations/
    ├── mcp.yml                          # MCP JSON-RPC router (private)
    ├── initDocMcp.yml                   # Doc page init automation (private)
    ├── buildMcpAuth.yml              # MCP auth: headers → session → config fallback (private)
    ├── buildAppAuth.yml              # App auth: config.* only (private)
    ├── configure{Service}.yml           # MCP configure tool (private)
    │
    ├── routeToolCall.yml                # Centralized tool dispatch (private)
    ├── formatToolOutput.yml             # Centralized output formatting (private)
    ├── validateRequiredParams.yml       # Centralized param validation (private)
    ├── executeApiCall.yml               # Shared fetch + error handling (private)
    ├── handleApiError.yml               # HTTP error mapping (private)
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

### 3.4 automations/buildMcpAuth.yml (MCP path auth)

Follow the MCP recipe Section 5 pattern:
1. Read credentials from user scope (fallback to config/secret)
2. Validate required credentials are present
3. Build the Authorization header based on auth type
4. Return `{ authenticated, authHeader, baseUrl, type }`

**Key rules:**
- `slug: buildMcpAuth`
- `name: /01_Helpers/buildMcpAuth`
- `private: true`
- Must handle the auth type(s) chosen in Phase 1
- Must return a clear error message pointing to `configure{Service}` when not configured
- `validateArguments: true` and `output: '{{output}}'`

### 3.5 automations/buildAppAuth.yml (app install path auth)

Build the Authorization header from **app config** (`config.*`) instead of user session.

**Key rules:**
- `slug: buildAppAuth`
- `name: /01_Helpers/buildAppAuth`
- `private: true`
- Reads `config.baseUrl`, `config.type`, `config.username`, `config.password`, `config.token` (matching `config.schema` fields)
- Returns `{baseUrl, authHeader}` or `{error: "..."}` — no `authenticated` field
- Uses same Custom Code functions as `buildMcpAuth` for header building
- `output: '{{output}}'`

**Template:**
```yaml
slug: buildAppAuth
name: /01_Helpers/buildAppAuth
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
- **Delegate tool routing to `routeToolCall`** — no inline tool conditions in `mcp.yml`
- `configure{Service}` is routed through `routeToolCall` like all other tools (but called directly, no `tool-` prefix)
- Every tool declared in `mcpTools` MUST have a corresponding entry in `routeToolCall.yml`
- Server name: `prisme-ai-{service}-mcp-server`
- After `routeToolCall` returns, `mcp.yml` calls `formatToolOutput` if the tool returns operation metadata

**Important — tools/call routing pattern (delegated):**
```yaml
'{{body.method}} == "tools/call"':
  - set:
      name: toolArgs
      value:
        arguments: '{{body.params.arguments}}'
        headers: '{{headers}}'
  - try:
      do:
        - routeToolCall:
            toolName: '{{body.params.name}}'
            toolArgs: '{{toolArgs}}'
            output: toolResult
        - comment: >-
            If tool returns operation metadata (operation, structuredData),
            format the output centrally. Otherwise use raw result.
        - conditions:
            '{{toolResult.error}}':
              - set:
                  name: formattedResult
                  value: '{{toolResult.error}}'
            '{{toolResult.operation}}':
              - formatToolOutput:
                  operation: '{{toolResult.operation}}'
                  structuredData: '{{toolResult.structuredData}}'
                  outputFormat: '{{body.params.arguments.outputFormat}}'
                  itemType: '{{toolResult.itemType}}'
                  itemName: '{{toolResult.itemName}}'
                  identifier: '{{toolResult.identifier}}'
                  properties: '{{toolResult.properties}}'
                  items: '{{toolResult.items}}'
                  location: '{{toolResult.location}}'
                  hint: '{{toolResult.hint}}'
                  jsonData: '{{toolResult.jsonData}}'
                  additionalInfo: '{{toolResult.additionalInfo}}'
                  output: formattedResult
            default:
              - set:
                  name: formattedResult
                  value: '{{toolResult}}'
        - set:
            name: output
            value:
              jsonrpc: '2.0'
              id: '{{body.id}}'
              result: '{{formattedResult}}'
      catch:
        - set:
            name: output
            value:
              jsonrpc: '2.0'
              id: '{{body.id}}'
              error:
                code: -32603
                message: 'Internal error: {{$error.message}}'
```

### 3.8 automations/method-{tool}.yml (one per tool — core logic)

The method contains the **core logic** extracted from the tool: API calls, data transformation, error handling. No auth, no output formatting.

**Key rules:**
- `slug: method-{toolName}`
- `name: /02_Methods/{scope}/method-{toolName}`
- `private: true`
- **Flat arguments**: tool-specific params + `baseUrl` + `authHeader` (not nested in `body.arguments`)
- No call to `buildMcpAuth` or `buildAppAuth`
- **Use `validateRequiredParams`** for parameter validation (no inline `!{{param}}` checks)
- **Use `executeApiCall`** for API calls with error handling (no raw `fetch` + status checks)
- Returns structured data directly (e.g., `{success, path, status}`) or `{error: "..."}` on failure
- `validateArguments: true` and `output: '{{output}}'`

**Template (simple tool — e.g., deleteFile):**
```yaml
slug: method-deleteFile
name: /02_Methods/Files/method-deleteFile
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
  - validateRequiredParams:
      params:
        - name: path
          value: '{{path}}'
          message: 'path is required'
      output: validationError
  - conditions:
      '{{validationError}}':
        - set:
            name: output
            value: '{{validationError}}'
        - break: {}
  - Custom Code.run function:
      function: encodePath
      parameters:
        path: '{{path}}'
      output: encodedPath
  - executeApiCall:
      url: '{{baseUrl}}{{encodedPath}}'
      method: DELETE
      authHeader: '{{authHeader}}'
      operation: deleting file
      notFoundMessage: 'File not found at {{path}}'
      output: apiResult
  - conditions:
      '!{{apiResult.success}}':
        - set:
            name: output
            value:
              error: '{{apiResult.error}}'
        - break: {}
  - set:
      name: output
      value:
        success: true
        path: '{{path}}'
        status: '{{apiResult.status}}'
validateArguments: true
output: '{{output}}'
```

**Note:** For tools with no required params, skip `validateRequiredParams` and go straight to `executeApiCall`. For non-REST services (WebSocket, gRPC), use custom logic instead of `executeApiCall`.

### 3.9 automations/tool-{tool}.yml (one per tool — MCP wrapper)

Thin wrapper for MCP: unwraps `body.arguments.*`, calls auth, delegates to method, formats output.

**Key rules:**
- `slug: tool-{toolName}`
- `name: /03_Tools/{scope}/{toolName}`
- `private: true`
- Arguments follow the `body.arguments.*` pattern
- Calls `buildMcpAuth` → checks `auth.authenticated` → calls `method-{tool}` → checks `methodResult.error`
- **Returns operation metadata** — `mcp.yml` handles output formatting centrally via `formatToolOutput`
- `validateArguments: true` and `output: '{{output}}'`

**Template:**
```yaml
slug: tool-deleteFile
name: /03_Tools/Files/deleteFile
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
  - buildMcpAuth:
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
  - comment: >-
      Return operation metadata. mcp.yml calls formatToolOutput centrally.
  - set:
      name: output
      value:
        operation: delete
        structuredData: '{{methodResult}}'
        itemType: File
        identifier: '{{methodResult.path}}'
        outputFormat: '{{body.arguments.outputFormat}}'
validateArguments: true
output: '{{output}}'
```

**Note:** Tool wrappers no longer contain inline output formatting logic. They return a standard envelope with `operation`, `structuredData`, and context fields. `mcp.yml` delegates to `formatToolOutput` for the actual formatting.

### 3.10 automations/{tool}.yml (one per tool — flat public app instruction)

Clean public API for workspaces that import this app. No `body.arguments` wrapping, no output formatting.

**Key rules:**
- `slug: {toolName}` (clean, no prefix)
- `name: {toolName}` (flat, no folder)
- **NOT private** (this is the public-facing automation)
- Flat arguments at top level (tool-specific params only, no `outputFormat`)
- Calls `buildAppAuth` → checks `auth.error` → calls `method-{tool}` → returns raw result
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
  - buildAppAuth:
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
name: /03_Tools/Config/test-configure{Service}
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
name: /03_Tools/{scope}/test-{toolName}
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
- `name: /03_Tools/{scope}/test-{toolName}`
- `private: true`
- `when: {}` (playground automation, NOT endpoint)
- Calls **`tool-{toolName}:`** (the MCP wrapper, with `body.arguments` interface)
- Arguments are **flat** at top level (not nested under `body`), referenced as `{{paramName}}`
- **No credential injection** in standard tool tests — configuration is done once via `test-configure{Service}`
- Always use `outputFormat: both`
- No `validateArguments` needed
- Use `oneOf` in configure test for deployment variant conditional fields
- Use `ui:widget: textarea` for secret/token fields

### 3.12 automations/initDocMcp.yml

Automation triggered by the doc page to compute the dynamic MCP endpoint URL.

**Key rules:**
- `slug: initDocMcp`
- `name: initDocMcp`
- `private: true`
- Triggered by event `initDocMcp` (emitted by the doc page `onInit`)
- Uses `{{global.endpoints.mcp}}` to get the full endpoint URL (adapts to any environment)
- Emits `updateDocMcp` event with the URL, targeted to the user's session

**Template:**
```yaml
slug: initDocMcp
name: initDocMcp
description: Initialize the MCP doc page with the dynamic endpoint URL
when:
  events:
    - initDocMcp
do:
  - emit:
      event: updateDocMcp
      payload:
        mcpEndpointUrl: '{{global.endpoints.mcp}}'
      target:
        sessionId: '{{source.sessionId}}'
private: true
```

### 3.13 pages/_doc.yml

Documentation page with two tabs: **Instructions** and **MCP**.

**Structure:**
- Top-level `RichText` block with `<h1>{Service} MCP</h1>` header
- `TabsView` with `direction: horizontal`, `selected: 0`, two tabs

**Tab 1 — Instructions:**
- Introduction: what the app does (1-2 paragraphs)
- Configuration table: all fields from `config.schema` in index.yml (field name, type, description)
- One section per public app instruction (flat `{tool}.yml`), each with:
  - Instruction name as `### {toolName}`
  - Short description
  - Parameter table with columns: Parameter, Type, Required/Default, Description
- Content must be localized (fr + en keys)
- Use `markdown: true` on the RichText block

**Tab 2 — MCP:**
- The RichText block MUST have `onInit: initDocMcp` and `updateOn: updateDocMcp`
- Endpoint section: display `{{mcpEndpointUrl}}` inside a code block (dynamically resolved by the init automation)
- Headers configuration: show example JSON for each auth type (Basic Auth, Token, etc.) ready to copy-paste into AI Knowledge MCP tool headers
- MCP tools table: list all tools from `mcpTools` in index.yml with name + description
- MCP resources table (if applicable): list resources with URI + description
- Content must be localized (fr + en keys)
- Use `markdown: true` on the RichText block

**Template (abbreviated):**
```yaml
slug: _doc
name:
  fr: Documentation
  en: Documentation
blocks:
  - slug: RichText
    content:
      fr: <h1>{Service} MCP</h1>
      en: <h1>{Service} MCP</h1>
  - slug: TabsView
    direction: horizontal
    selected: 0
    tabs:
      - text:
          fr: Instructions
          en: Instructions
        content:
          blocks:
            - slug: RichText
              markdown: true
              content:
                fr: |
                  ## Introduction
                  ...
                  ## Configuration
                  | Champ | Type | Description |
                  ...
                  ## Instructions
                  ### {toolName}
                  ...
                en: |
                  ## Introduction
                  ...
                  ## Configuration
                  | Field | Type | Description |
                  ...
                  ## Instructions
                  ### {toolName}
                  ...
      - text:
          fr: MCP
          en: MCP
        content:
          blocks:
            - slug: RichText
              onInit: initDocMcp
              updateOn: updateDocMcp
              markdown: true
              content:
                fr: |
                  ## Utilisation en tant que serveur MCP
                  ### Endpoint
                  ```
                  {{mcpEndpointUrl}}
                  ```
                  ### Configuration des headers
                  **Basic Auth :**
                  ```json
                  {
                    "baseurl": "https://example.com/...",
                    "username": "votre-utilisateur",
                    "password": "votre-mot-de-passe"
                  }
                  ```
                  ### Outils MCP
                  | Outil | Description |
                  ...
                en: |
                  ## Usage as MCP Server
                  ### Endpoint
                  ```
                  {{mcpEndpointUrl}}
                  ```
                  ### Headers configuration
                  **Basic Auth:**
                  ```json
                  {
                    "baseurl": "https://example.com/...",
                    "username": "your-username",
                    "password": "your-password"
                  }
                  ```
                  ### MCP Tools
                  | Tool | Description |
                  ...
```

**Important notes:**
- The `{{mcpEndpointUrl}}` variable is populated by the `initDocMcp` automation via the `updateDocMcp` event
- Header field names in the JSON examples must be **lowercase** (e.g., `baseurl` not `baseUrl`) since HTTP headers are lowercased by Prisme.ai
- Adapt the auth header examples to match the service's auth types (Basic Auth, Token, API Key, etc.)

### 3.14 Scalability Helpers (recommended for 5+ tools)

These helpers prevent code duplication as the workspace grows. They are recommended for workspaces with 5+ tools and mandatory for 10+. For small workspaces (< 5 tools), the inline approach from earlier templates also works.

#### 3.14.1 automations/routeToolCall.yml

Centralized tool dispatch — replaces inline tool conditions in `mcp.yml`.

```yaml
slug: routeToolCall
name: /01_Helpers/routeToolCall
description: Route MCP tool call to appropriate tool automation by name
private: true
arguments:
  toolName:
    type: string
  toolArgs:
    type: object
do:
  - conditions:
      '{{toolName}} == "configure{Service}"':
        - configure{Service}:
            body: '{{toolArgs}}'
            output: result
      '{{toolName}} == "{tool1}"':
        - tool-{tool1}:
            body: '{{toolArgs}}'
            output: result
      '{{toolName}} == "{tool2}"':
        - tool-{tool2}:
            body: '{{toolArgs}}'
            output: result
      # ... one entry per tool
      default:
        - break:
            payload:
              error: ToolNotFound
              message: 'Tool not found: {{toolName}}'
output: '{{result}}'
```

**Key design:**
- `configure{Service}` is called directly (no `tool-` prefix) — it has no method layer
- All other tools route to `tool-{toolName}:` (the MCP wrapper)
- Every tool in `mcpTools` (index.yml) MUST have a corresponding entry here
- Default case uses `break` with error payload for unknown tools

#### 3.14.2 automations/formatToolOutput.yml

Centralized output formatting — replaces inline structured/verbose/both switches in tool wrappers.

```yaml
slug: formatToolOutput
name: /01_Helpers/formatToolOutput
description: Format MCP tool output based on outputFormat and operation type
private: true
arguments:
  operation:
    type: string
    description: 'Operation type: create, list, read, update, delete'
  structuredData:
    type: object
    description: The structured result data from the method
  outputFormat:
    type: string
    description: 'Output format: structured, verbose, both'
  itemType:
    type: string
    description: 'Type of item (e.g., File, Workbook, Page)'
  itemName:
    type: string
    description: Display name of the item
  identifier:
    type: string
    description: 'Unique identifier (e.g., path, id)'
  properties:
    type: array
    description: 'Array of {label, value} pairs for verbose output'
  items:
    type: array
    description: Array of items for list operations
  location:
    type: string
    description: 'Location context (e.g., parent folder)'
  hint:
    type: string
    description: Usage hint for the user
  jsonData:
    type: object
    description: Additional JSON data to include in verbose output
  additionalInfo:
    type: string
    description: Extra text to append to verbose message
do:
  - comment: Build verbose message based on operation type
  - conditions:
      '{{operation}} == "create"':
        - set:
            name: verboseMessage
            value: '{{itemType}} created successfully!'
        - conditions:
            '{{properties}}':
              - repeat:
                  'on': '{{properties}}'
                  do:
                    - set:
                        name: verboseMessage
                        value: "{{verboseMessage}}\n**{{item.label}}:** {{item.value}}"
      '{{operation}} == "list"':
        - conditions:
            '{{items.length}} == 0':
              - set:
                  name: verboseMessage
                  value: 'No {{itemType}} found.'
            default:
              - set:
                  name: verboseMessage
                  value: 'Found {{items.length}} {{itemType}}(s).'
        - conditions:
            '{{hint}}':
              - set:
                  name: verboseMessage
                  value: "{{verboseMessage}}\n\n{{hint}}"
      '{{operation}} == "read"':
        - set:
            name: verboseMessage
            value: '{{itemType}} details:'
        - conditions:
            '{{properties}}':
              - repeat:
                  'on': '{{properties}}'
                  do:
                    - set:
                        name: verboseMessage
                        value: "{{verboseMessage}}\n**{{item.label}}:** {{item.value}}"
      '{{operation}} == "update"':
        - set:
            name: verboseMessage
            value: '{{itemType}} updated successfully!'
        - conditions:
            '{{properties}}':
              - repeat:
                  'on': '{{properties}}'
                  do:
                    - set:
                        name: verboseMessage
                        value: "{{verboseMessage}}\n**{{item.label}}:** {{item.value}}"
      '{{operation}} == "delete"':
        - set:
            name: verboseMessage
            value: '{{itemType}} deleted successfully!'
        - conditions:
            '{{identifier}}':
              - set:
                  name: verboseMessage
                  value: "{{verboseMessage}}\n**Identifier:** {{identifier}}"
      default:
        - set:
            name: verboseMessage
            value: 'Operation completed.'
  - conditions:
      '{{additionalInfo}}':
        - set:
            name: verboseMessage
            value: "{{verboseMessage}}\n\n{{additionalInfo}}"
  - comment: Apply outputFormat switch
  - conditions:
      '{{outputFormat}} == "structured"':
        - set:
            name: output
            value:
              content:
                - type: text
                  text: '{% json({{structuredData}}) %}'
              structuredContent: '{{structuredData}}'
      '{{outputFormat}} == "both"':
        - set:
            name: output
            value:
              content:
                - type: text
                  text: '{% json({{structuredData}}) %}'
              structuredContent: '{{structuredData}}'
      default:
        - set:
            name: output
            value:
              content:
                - type: text
                  text: '{{verboseMessage}}'
output: '{{output}}'
```

**Note:** The `operation` enum drives the verbose message template. Add custom operation types as needed for service-specific operations.

#### 3.14.3 automations/validateRequiredParams.yml

Centralized parameter validation — replaces inline `'!{{param}}'` checks in methods.

```yaml
slug: validateRequiredParams
name: /01_Helpers/validateRequiredParams
description: Validate required parameters. Returns MCP error or null.
private: true
arguments:
  params:
    type: array
    description: 'Array of {name, value, message?}'
do:
  - set:
      name: result
      value: null
  - repeat:
      'on': '{{params}}'
      do:
        - conditions:
            '!{{item.value}}':
              - set:
                  name: result
                  value:
                    isError: true
                    content:
                      - type: text
                        text: >-
                          Error: {% {{item.message}} ? {{item.message}} :
                          concat({{item.name}}, " is required") %}
              - break: {}
output: '{{result}}'
```

**Caller pattern:**
```yaml
- validateRequiredParams:
    params:
      - name: path
        value: '{{path}}'
        message: 'path is required'
      - name: format
        value: '{{format}}'
        message: 'format must be specified'
    output: validationError
- conditions:
    '{{validationError}}':
      - set:
          name: output
          value: '{{validationError}}'
      - break: {}
```

Returns `null` if all params are valid (fast-fail on first invalid param).

#### 3.14.4 automations/executeApiCall.yml

Shared fetch + error handling wrapper — replaces raw `fetch` + status checks in methods.

```yaml
slug: executeApiCall
name: /01_Helpers/executeApiCall
description: Execute API call with standardized error handling
private: true
arguments:
  url:
    type: string
  method:
    type: string
  authHeader:
    type: string
  body:
    type: object
  contentType:
    type: string
  operation:
    type: string
    description: 'Description for error messages (e.g., "deleting file")'
  notFoundMessage:
    type: string
  badRequestMessage:
    type: string
do:
  - set:
      name: fetchHeaders
      value:
        Authorization: '{{authHeader}}'
  - conditions:
      '{{body}} && {{contentType}}':
        - set:
            name: fetchHeaders.Content-Type
            value: '{{contentType}}'
      '{{body}} && !{{contentType}}':
        - set:
            name: fetchHeaders.Content-Type
            value: application/json
  - fetch:
      url: '{{url}}'
      method: '{{method}}'
      headers: '{{fetchHeaders}}'
      body: '{{body}}'
      output: response
      outputMode: detailed_response
      emitErrors: true
  - handleApiError:
      response: '{{response}}'
      operation: '{{operation}}'
      notFoundMessage: '{{notFoundMessage}}'
      badRequestMessage: '{{badRequestMessage}}'
      output: errorResult
  - conditions:
      '{{errorResult}}':
        - set:
            name: result
            value:
              success: false
              error: '{{errorResult}}'
              status: '{{response.status}}'
        - break: {}
  - set:
      name: result
      value:
        success: true
        data: '{{response.body}}'
        status: '{{response.status}}'
output: '{{result}}'
```

**Return structure:**
- `{success: true, data: <response body>, status: <HTTP status>}` on success
- `{success: false, error: <MCP error object>, status: <HTTP status>}` on failure

#### 3.14.5 automations/handleApiError.yml

HTTP status code + service-specific error mapping — replaces generic `>= 400` checks.

```yaml
slug: handleApiError
name: /01_Helpers/handleApiError
description: Map HTTP errors to user-friendly MCP messages. Returns null if no error.
private: true
arguments:
  response:
    type: object
  operation:
    type: string
  notFoundMessage:
    type: string
  badRequestMessage:
    type: string
do:
  - set:
      name: result
      value: null
  - conditions:
      '{{response.status}} == 429':
        - set:
            name: result
            value:
              isError: true
              content:
                - type: text
                  text: 'Rate limited. Please wait and retry.'
        - break: {}
  - conditions:
      '{{response.status}} == 401':
        - set:
            name: result
            value:
              isError: true
              content:
                - type: text
                  text: 'Authentication failed. Please reconfigure credentials.'
        - break: {}
  - conditions:
      '{{response.status}} == 403':
        - set:
            name: result
            value:
              isError: true
              content:
                - type: text
                  text: 'Access denied. Check permissions.'
        - break: {}
  - conditions:
      '{{response.status}} == 404':
        - conditions:
            '{{notFoundMessage}}':
              - set:
                  name: result
                  value:
                    isError: true
                    content:
                      - type: text
                        text: '{{notFoundMessage}}'
            default:
              - set:
                  name: result
                  value:
                    isError: true
                    content:
                      - type: text
                        text: 'Resource not found. Check identifiers.'
        - break: {}
  - conditions:
      '{{response.status}} == 400':
        - conditions:
            '{{badRequestMessage}}':
              - set:
                  name: result
                  value:
                    isError: true
                    content:
                      - type: text
                        text: '{{badRequestMessage}}'
            default:
              - set:
                  name: result
                  value:
                    isError: true
                    content:
                      - type: text
                        text: 'Invalid request. Check parameters.'
        - break: {}
  - conditions:
      '{{response.status}} >= 400':
        - set:
            name: result
            value:
              isError: true
              content:
                - type: text
                  text: 'Error {{operation}}: HTTP {{response.status}}'
        - break: {}
output: '{{result}}'
```

**Note:** This is a generic base template. For services with specific error codes (e.g., Graph API's `itemNotFound`, `InvalidAuthenticationToken`), add additional conditions **before** the generic `>= 400` check to extract service-specific error messages from `response.body`.

---

## Phase 4: Cloud vs Server/DC Handling

If the service has multiple deployment variants (answered in Phase 1):

- Add a `type` field to `configure{Service}` arguments (enum: cloud, datacenter)
- In `buildMcpAuth` AND `buildAppAuth`, branch on type to build the correct auth header
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
- [ ] Every tool in `mcpTools` (index.yml) has a matching entry in `routeToolCall.yml`
- [ ] Every tool has THREE automation files: `method-{tool}.yml`, `tool-{tool}.yml`, `{tool}.yml`
- [ ] Every tool has a `test-{tool}.yml` file calling `tool-{tool}:`
- [ ] `mcp.yml` delegates to `routeToolCall` (no inline tool conditions)
- [ ] All **method** files have flat args (`path`, `baseUrl`, `authHeader`) — no `body.arguments`
- [ ] All **method** files use `validateRequiredParams` (no inline `!{{param}}` checks)
- [ ] All **method** files use `executeApiCall` (no raw `fetch` + status checks)
- [ ] All **tool wrappers** have `body.arguments.*` interface and call `buildMcpAuth`
- [ ] All **tool wrappers** return operation metadata (not inline formatted output)
- [ ] All **flat app instructions** call `buildAppAuth` then `method-{tool}`
- [ ] Only flat app instructions (`{tool}.yml`) are public — all others have `private: true`
- [ ] `config.schema` in index.yml has fields matching what `buildAppAuth` reads
- [ ] All automations with `do:` blocks have `output: '{{output}}'`
- [ ] `routeToolCall.yml` exists and has entries for all tools in `mcpTools`
- [ ] `formatToolOutput.yml` exists and handles create/list/read/update/delete operations
- [ ] `validateRequiredParams.yml` exists
- [ ] `executeApiCall.yml` exists and calls `handleApiError`
- [ ] `handleApiError.yml` exists and handles 429/401/403/404/400/>=400
- [ ] `pages/_doc.yml` exists with two tabs (Instructions + MCP)
- [ ] `automations/initDocMcp.yml` exists and emits `updateDocMcp` with `{{global.endpoints.mcp}}`
- [ ] MCP tab RichText has `onInit: initDocMcp` and `updateOn: updateDocMcp`
- [ ] All public app instructions are documented in the Instructions tab with their parameters

### 5.3 Code Review

Launch the verify-correctness agent:

```
Task(subagent_type: "verify-correctness", prompt: "Review all YAML files in ./{service}-mcp/ for:
- YAML syntax correctness
- Prisme.ai expression syntax ({{}} vs {% %})
- 3-layer consistency: method-* ← tool-* ← mcp.yml, method-* ← {tool}.yml ← buildAppAuth
- Missing error handling
- Consistency between index.yml mcpTools and mcp.yml routing (must use tool-* slugs)
- Private flags: only flat app instructions should be public
- config.schema matches buildAppAuth expectations
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
5. **Documentation page**: Confirm the `_doc` page was created with Instructions + MCP tabs
6. **Testing instructions**: How to test via `execute_automation` or webhook
7. **Deployment command**: The `push_workspace` command to run (but don't execute unless asked)

```
push_workspace(
  path: "./{service}-mcp",
  workspaceName: "{service}-mcp",
  message: "v1-initial",
  environment: "sandbox"
)
```

---

## Compliance Audit Mode

When invoked with `/mcp-workspace` pointing to an **existing** workspace (not an empty scaffold), the skill detects that automations already exist and switches to **audit mode** — a read-only analysis that produces a disparity report.

### How It Works

1. **Read the workspace** — scan `automations/`, `index.yml`, identify all tools, helpers, methods
2. **Run the compliance checklist** against what it finds (see table below)
3. **Produce a disparity report** — written to `./tickets/{workspace}-disparities.md`
4. **Do NOT modify the workspace** — audit is read-only

### Compliance Checklist

| # | Check | What to look for |
|---|-------|------------------|
| 1 | Centralized tool routing | Does a `routeToolCall` helper exist? Does `mcp.yml` delegate to it, or does it have inline tool conditions? Count inline conditions if any. |
| 2 | Centralized output formatting | Does a `formatToolOutput` helper exist? Do tool wrappers delegate to it, or build output inline? Count tools with inline formatting. |
| 3 | Centralized parameter validation | Does a `validateRequiredParams` helper exist? Do methods use it, or have inline `'!{{param}}'` checks? Count methods with inline validation. |
| 4 | Factored fetch logic | Is there a shared API call helper (e.g., `executeApiCall`, `executeGraphCall`)? Or do methods duplicate URL building, header assembly, error handling, response normalization inline? Count methods with duplicated fetch patterns. |
| 5 | Granular error handling | Does the error handler cover 429/401/403/404/400/>=400 and service-specific error codes? Or just a generic `>= 400` check? List missing status codes. |
| 6 | Duplicated logic detection | Beyond the 5 helpers above — scan for any repeated DSUL pattern appearing in 3+ automations (e.g., same conditions block, same set sequence, same fetch+check pattern). List candidates for extraction. |
| 7 | Auth pattern | Centralized in `mcp.yml` before routing, or per-tool, or mixed? Is there token caching? |
| 8 | Naming conventions | Do slugs follow camelCase? Do names use `/NN_Category/` folder convention? Are helpers marked `private: true`? List violations. |
| 9 | `mcpTools` vs `routeToolCall` sync | Are all tools in `index.yml` `mcpTools` also present in `routeToolCall`? List any mismatches. |
| 10 | Test coverage | Does a test suite exist? Does it cover all tools? List untested tools. |

### Report Output Format

The audit produces a file at `./tickets/{workspace}-disparities.md` with this structure:

```markdown
# {Workspace} — Compliance Report

## Summary
- **Compliance**: X/10 checks passing
- **Migration effort**: Small / Medium / Large
- **Top disparities**: (1-3 most impactful gaps)

## Checklist Results

| # | Check | Status | Details |
|---|-------|--------|---------|
| 1 | Centralized routing | PASS | routeToolCall routes N tools |
| 2 | Centralized formatting | PASS | formatToolOutput used by all tools |
| 3 | Centralized validation | PARTIAL | 3/N methods still validate inline |
| 4 | Factored fetch logic | FAIL | N methods duplicate URL+headers+error handling |
| ... | ... | ... | ... |

## Suggested Migration Steps

1. (Ordered steps to reach full compliance)
2. ...

## Duplicated Patterns Found

| Pattern | Occurrences | Files | Suggested helper |
|---------|-------------|-------|------------------|
| OData query building | 4 | listMessages, searchMessages, ... | buildODataQuery |
| ... | ... | ... | ... |
```

### Why Audit Is Built Into the Skill

- **Reusable** — run against any workspace, any time
- **Living standard** — as the checklist evolves, audits automatically check newer patterns
- **Migration input** — each report becomes input for a `/01-design` migration ticket
- **Regression check** — re-run after migration to verify compliance

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
| Tool in index.yml but missing in `routeToolCall` | Every mcpTool MUST have an entry in `routeToolCall.yml` |
| `mcp.yml` has inline tool conditions | Use `routeToolCall` helper — `mcp.yml` should only call `routeToolCall` |
| Output formatting duplicated in every tool-* | Use `formatToolOutput` helper — tool wrappers return operation metadata |
| `mcp.yml` has 50+ inline tool conditions | Use `routeToolCall` helper to keep `mcp.yml` maintainable |
| Every method has its own fetch+error block | Use `executeApiCall` + `handleApiError` helpers |
| Param validation duplicated across methods | Use `validateRequiredParams` helper (no inline `!{{param}}` checks) |
| Generic `>= 400` error check only | Use `handleApiError` with 429/401/403/404/400 specific handling |
| mcp.yml calls `{tool}:` instead of `tool-{tool}:` | Always use `tool-` prefix in `routeToolCall` routing |
| Flat app instruction has `private: true` | Only flat instructions are public — remove `private` |
| Test calls `{tool}:` instead of `tool-{tool}:` | Tests must call the MCP wrapper (`tool-{tool}:`) |
| Method has `body.arguments` wrapping | Methods use flat args: `path`, `baseUrl`, `authHeader` |
| `buildAppAuth` reads `user.*` | `buildAppAuth` must read `config.*` only — `user.*` and request headers belong to `buildMcpAuth` |
| Missing `config.schema` in index.yml | Required for app configuration form when importing |
