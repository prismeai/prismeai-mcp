# Available Tools

All tools are prefixed with `mcp__prisme-ai-builder__` when used in Claude.

## Automation Management

| Tool | Description |
|------|-------------|
| `create_automation` | Create a new automation |
| `get_automation` | Get a specific automation by slug |
| `update_automation` | Update an existing automation |
| `delete_automation` | Delete an automation |
| `list_automations` | List all automations in a workspace |
| `execute_automation` | Execute/test an automation with payload |

## Workspace Management

| Tool | Description |
|------|-------------|
| `pull_workspace` | Download workspace to local directory |
| `push_workspace` | Upload local workspace to Prisme.ai |
| `search_workspaces` | Search workspaces by name/description |

## Events & Search

| Tool | Description |
|------|-------------|
| `search_events` | Query events using Elasticsearch DSL |

## App Store

| Tool | Description |
|------|-------------|
| `list_apps` | Browse Prisme.ai app store |
| `get_app` | Get app details and configuration schema |

## Documentation

| Tool | Description |
|------|-------------|
| `get_prisme_documentation` | Get Prisme.ai documentation by section |
| `lint_doc` | Get automation linting rules |

## AI Knowledge

| Tool | Description |
|------|-------------|
| `ai_knowledge_query` | Query an AI Knowledge agent (RAG or context only) |
| `ai_knowledge_completion` | Direct LLM completion without RAG |
| `ai_knowledge_document` | Document CRUD operations |
| `ai_knowledge_project` | Project/Agent management |

## Tool Parameters

All tools accept these optional parameters:

| Parameter | Description |
|-----------|-------------|
| `environment` | Environment name (`sandbox`, `staging`, `prod`) |
| `workspaceName` | Workspace name from environment config |
| `workspaceId` | Direct workspace ID (overrides name resolution) |

## Examples

### List Automations

```typescript
{
  "environment": "sandbox",
  "workspaceName": "ai-knowledge"
}
```

### Create Automation

```typescript
{
  "automation": {
    "name": "My Automation",
    "do": [
      { "log": "Hello World" }
    ],
    "when": {
      "endpoint": true
    }
  },
  "workspaceName": "ai-knowledge"
}
```

### Search Events

```typescript
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "type": "runtime.automations.executed" } },
        { "term": { "source.automationSlug": "my-automation" } }
      ]
    }
  },
  "limit": 10,
  "sort": [{ "@timestamp": { "order": "desc" } }],
  "workspaceName": "ai-knowledge"
}
```

### Execute Automation

```typescript
{
  "automationSlug": "my-automation",
  "payload": { "key": "value" },
  "environment": "sandbox",
  "workspaceName": "ai-knowledge"
}
```

---

**Next:** [Environment Configuration](./ENVIRONMENTS.md) | [Development Guide](./DEVELOPMENT.md)
