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

Read at least one existing MCP workspace to understand concrete patterns (prefer `confluence-mcp` or `sharepoint-mcp` if available).

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
    ├── mcp.yml
    ├── ensureAuthentication.yml
    ├── configure{Service}.yml
    ├── {tool1}.yml
    ├── {tool2}.yml
    ├── ...
    ├── test-configure{Service}.yml
    ├── test-{tool1}.yml
    ├── test-{tool2}.yml
    └── ...
```

---

## Phase 3: Create Core Files

### 3.1 index.yml

The workspace config with ALL mcpTools schemas.

**Rules:**
- Each tool has `name`, `description`, `inputSchema`
- `inputSchema` is standard JSON Schema (`type: object`, `properties`, `required`)
- Every tool MUST include an `outputFormat` property (enum: structured, verbose, both; default: verbose)
- Descriptions must be precise — they serve as documentation for the LLM client
- Include `mcpResources` only if user requested resources

**Template:**
```yaml
name: {Service} MCP
slug: {service}-mcp
description: MCP JSON-RPC 2.0 server for {Service}
labels: []
repositories: {}
config:
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

      # ... one block per tool

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
- Must handle the auth type(s) chosen in Phase 1
- Must return a clear error message pointing to `configure{Service}` when not configured
- `validateArguments: true` and `output: '{{output}}'`

### 3.5 automations/configure{Service}.yml

Follow the MCP recipe Section 6 pattern:
1. Validate required parameters
2. Clean the base URL via Custom Code
3. Store credentials in `user.{service}.credentials` scope
4. Emit a `{service}.configuration.updated` event
5. Return output in the requested format (structured/verbose/both)

**Key rules:**
- `slug: configure{Service}` (camelCase, e.g., `configureJira`)
- `name: /02_Tools/configure{Service}`
- Arguments follow the `body.arguments.*` pattern
- `validateArguments: true` and `output: '{{output}}'`

### 3.6 automations/mcp.yml

Follow the MCP recipe Section 7 pattern. This is the central JSON-RPC router.

**Structure:**
1. Auth check (`!{{user.email}}` → 401)
2. Optional: auto-configuration from HTTP headers
3. Routing by `body.method`:
   - `initialize` → return server info with protocol version `2025-06-18`
   - `notifications/initialized` → return empty 200
   - `tools/list` → return `{{config.mcpTools}}`
   - `tools/call` → route to the correct automation by `body.params.name`
   - `resources/list` → return `{{config.mcpResources}}` (if applicable)
   - `resources/read` → route to resource handler (if applicable)
   - `default` → error -32601 Method not found

**Key rules:**
- `slug: mcp`
- `name: 00_MCP/endpoint`
- `when: endpoint: true`
- Every tool declared in `mcpTools` MUST have a corresponding entry in the `tools/call` conditions
- Server name: `prisme-ai-{service}-mcp-server`

### 3.7 automations/{tool}.yml (one per tool)

Follow the MCP recipe Section 8 pattern for each tool:

1. **Validate parameters** — check required params, return `isError: true` if missing
2. **Authenticate** — call `ensureAuthentication`, check result
3. **API call** — `fetch` to the service API with auth header
4. **Error handling** — check HTTP status, return error with status code
5. **Transform results** — map API response to `structuredData`
6. **Output formatting** — return based on `outputFormat` (structured/verbose/both)

**Key rules:**
- `slug: {toolName}`
- `name: /02_Tools/{toolName}`
- Use `outputMode: body` for GET (read) operations
- Use `outputMode: detailed_response` for POST/PUT/DELETE (write) operations
- Always include `emitErrors: true` on fetch
- `validateArguments: true` and `output: '{{output}}'`

**outputMode selection:**

| Operation | outputMode | Error Check |
|-----------|-----------|-------------|
| GET (read) | `body` | `try/catch` or check for error fields |
| POST/PUT/DELETE (write) | `detailed_response` | `{{result.status}} >= 400` |

### 3.8 automations/test-{tool}.yml (one per tool)

Follow the MCP recipe Section 11 pattern:

**For standard tools:**
1. Inject credentials directly into `user.{service}.credentials` scope
2. Call the tool with `outputFormat: both`
3. Return raw result

**For configure{Service}:**
1. Call `configure{Service}` directly with credentials as arguments
2. Return raw result

**Key rules:**
- `slug: test-{toolName}`
- `name: /04_Tests/test-{toolName}`
- `when: endpoint: true`
- Credentials are flat in `body` (not nested in `arguments`)
- Always use `outputFormat: both`
- No `validateArguments` needed

---

## Phase 4: Cloud vs Server/DC Handling

If the service has multiple deployment variants (answered in Phase 1):

- Add a `type` field to `configure{Service}` arguments (enum: cloud, datacenter)
- In `ensureAuthentication`, branch on `credentials.type` to build the correct auth header
- In each tool, branch on `auth.type` to use the correct API URL/version:

```yaml
- conditions:
    '{{auth.type}} == "cloud"':
      - set:
          name: apiUrl
          value: '{{auth.baseUrl}}/api/v2/resource'
    default:
      - set:
          name: apiUrl
          value: '{{auth.baseUrl}}/rest/api/resource'
```

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
- [ ] Every tool in `mcpTools` (index.yml) has a matching entry in `mcp.yml` (`tools/call`)
- [ ] Every tool has an automation `.yml` file with the correct `slug`
- [ ] Every tool has a `test-{tool}.yml` file
- [ ] All automations have `validateArguments: true` and `output: '{{output}}'`
- [ ] All tools handle the 3 output formats (structured/verbose/both)
- [ ] `ensureAuthentication` is called in every tool before API calls

### 5.3 Code Review

Launch the code-review agent:

```
Task(subagent_type: "code-review", prompt: "Review all YAML files in ./{service}-mcp/ for:
- YAML syntax correctness
- Prisme.ai expression syntax ({{}} vs {% %})
- Missing error handling
- Consistency between index.yml mcpTools and mcp.yml routing
- Security issues (exposed secrets, missing auth checks)
- Pattern adherence to MCP recipe

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

1. **Summary**: List all files created with their purpose
2. **Tool list**: Table of all MCP tools with descriptions
3. **Testing instructions**: How to test via `execute_automation` or webhook
4. **Deployment command**: The `push_workspace` command to run (but don't execute unless asked)

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
