# Prisme.ai Environment

## Environment Configuration

| Environment | Aliases | Default Workspace |
|-------------|---------|-------------------|
| `sandbox` | sb | ai-knowledge |
| `prod` | production | - |

**Default behavior**: Search on `ai-knowledge` workspace in `sandbox` environment unless specified otherwise.

### Workspace Parameter Rules

Use the correct parameter based on user input:

| User provides | Use parameter | Example |
|---------------|---------------|---------|
| Raw ID (e.g., `e-sdfwe`) | `workspaceId` | `workspaceId: "e-sdfwe"` |
| Named alias (e.g., `ai-knowledge`) | `workspaceName` | `workspaceName: "ai-knowledge"` |

Known workspace aliases: `ai-knowledge` (AIK), `ai-store` (AIS)

### Local Workspace Priority

**IMPORTANT**: The local codebase contains Prisme.ai workspace folders. **ALWAYS search locally first** using `Read`, `Glob`, `Grep` tools before calling any remote APIs.

1. Each folder in `./` is a Prisme.ai workspace with automations, pages, and config
2. Read local YAML files directly - they represent the current working state
3. Check local folders before using `search_workspaces` - if the workspace exists locally, use its `index.yml` to get the ID
4. Only call `list_automations`, `get_automation`, `search_workspaces`, or other remote APIs if explicitly needed for remote-only data (e.g., events, execution) or if the workspace is not found locally

This avoids unnecessary API calls and ensures you work with the latest local changes.

**Workspace ID from local files**: The `index.yml` file in each local workspace folder contains the `id` field with the workspace ID. Use this ID with the `workspaceId` parameter when calling Prisme.ai MCP tools (e.g., `search_events`, `execute_automation`).

## Tool Usage Guide

### When to Use Each Tool

| Tool | Use When |
|------|----------|
| `search_events` | User mentions: correlationId, activity feed, events, execution history, logs, tracing, debugging, errors/failures |
| `get_automation` | Need to inspect a specific automation's YAML |
| `list_automations` | Need to see all automations in a workspace |
| `get_prisme_documentation` | Need Prisme.ai syntax, patterns, or feature reference |
| `lint_doc` | Need to validate automation YAML for common mistakes |
| `get_app` / `list_apps` | Working with apps from the marketplace |
| `pull_workspace` / `push_workspace` | Syncing workspace files locally |
| `execute_automation` | Testing an automation with a payload |

### Event Search Patterns

Common Elasticsearch DSL patterns for `search_events`:

```json
{"bool": {"filter": [{"term": {"source.correlationId": "uuid-here"}}]}}
```

```json
{"bool": {"filter": [{"term": {"type": "runtime.automations.executed"}}]}}
```

```json
{"bool": {"filter": [{"term": {"source.automationSlug": "automation-name"}}]}}
```

```json
{"bool": {"filter": [{"term": {"type": "error"}}]}}
```

**Sorting**: Always use `@timestamp` (not `timestamp`) for time-based sorting.

## Products Quick Reference

| Product | Nickname | Purpose |
|---------|----------|---------|
| AI Knowledge | AIK | RAG, knowledge bases, LLM middleware |
| AI Store | AIS | Chat interface, agent marketplace |
| Builder | - | Custom workflows, automations, pages |
| SecureChat | - | Enterprise conversational interface |
| Collection | - | Tabular data with AI querying |
| Governance | - | Platform admin, RBAC |
| Insights | - | Conversation analytics |

### AI Knowledge Query Flow

Entry point is `genericQuery`, which orchestrates:
1. Config phase: rate limits, model specs, attachments
2. Prompt building: system prompt, history, context
3. Tool loop: `callLLMWithTools` handles tool calling
4. Post-processing: suggestions, source filtering

Key automations: `query`, `genericQuery`, `buildPrompt`, `LLMCompletion`, `callLLMWithTools`, `executeTool`

### AI Store Architecture

- Each "agent" in AI Store = AI Knowledge project
- Uses `Knowledge Client` app to interface with AIK
- Conversations stored via `Conversations Service App`
- SSE streaming for real-time responses

## Event Schema Quick Reference

| Field | Description |
|-------|-------------|
| `type` | Event category (e.g., `runtime.automations.executed`, `error`) |
| `source.correlationId` | Groups related events from same operation |
| `source.automationSlug` | Automation name |
| `source.workspaceId` | Workspace identifier |
| `source.userId` | User who triggered event |
| `payload` | Event-specific data |
| `@timestamp` | Event timestamp (use for sorting) |

Common event types:
- `runtime.automations.executed` - Automation completed
- `runtime.fetch.failed` - HTTP request failed
- `error` - Generic error
- `workspaces.automations.updated` - Automation changed

## Automation Validation

Before creating or updating automations, check for common mistakes using `lint_doc`. Key rules:

1. **No JavaScript in `{{}}`** - Only variable substitution allowed
2. **Use `{% %}` for expressions** - Math, functions go here
3. **Use `comment:` instruction** - Not YAML `#` comments between instructions
4. **Allowed functions only** - `lower()`, `upper()`, `json()`, `date()`, `rand()`, `round()`, etc.

## Response Guidelines

- Keep answers concise and relevant
- Use available tools iteratively until you find the answer
- When debugging, trace events using `correlationId`
- Reference specific automation slugs and line numbers when helpful
- If blocked, explain what information would help resolve the issue

## Development steps to edit workspace

- Check if there is a local version of the workspace in ./
- Read the documentation of the relevant products, automations, before anything
- Edit the automations in local
- Once completed read the lint_doc to check for common mistakes
- Execute a sub-task to review the code changed and give a list of eventual issues rated MAJOR | NEED_HUMAN.
  - Solve the MAJOR issues
  - Ask the human for the NEED_HUMAN issues

If you encounter any issue, prisme.ai api give you an error, use the report feedback tool so we can enhance you.