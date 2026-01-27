# AI Builder

Orchestration engine for custom AI applications using DSUL (no-code, low-code, full-code).

**Users:** Developers, Technical business, IT

---

## Components

| Component | Description |
|-----------|-------------|
| Workspaces | Event-driven environments |
| Pages | UI containers |
| Blocks | Reusable components |
| Automations | Backend logic |
| Apps | Marketplace packages |
| Integrations | External connectors |

---

## Development

| Approach | Level | Use |
|----------|-------|-----|
| No-Code | Low | Simple workflows |
| Low-Code | Medium | Complex UIs |
| Full-Code | High | Custom logic |

---

## Automations

```yaml
slug: example
name: Example
when:
  # Trigger
do:
  # Instructions
output: "{{result}}"
```

### Triggers

**Webhook:**
```yaml
when:
  endpoint: true
```
Variables: `body`, `headers`, `method`, `query`

**Events:**
```yaml
when:
  events:
    - user-login
```

**Schedule:**
```yaml
when:
  schedules:
    - '0 9 * * 1-5'  # 9 AM weekdays UTC
```

---

## Memory

| Scope | Persistence |
|-------|-------------|
| run | 60s |
| user | Persistent |
| session | 1mo/1h |
| global | Workspace-wide |
| socket | 6h |
| config | Workspace config |

---

## Instructions

### Conditions
```yaml
- conditions:
    '{{age}} >= 18':
      - set:
          name: status
          value: adult
    default:
      - set:
          name: status
          value: unknown
```

### Repeat
```yaml
- repeat:
    on: '{{users}}'
    do:
      - set:
          name: names[]
          value: '{{item.name}}'
```

### All (Parallel)
```yaml
- all:
    - automation1: {}
    - automation2: {}
```

### Try/Catch
```yaml
- try:
    do:
      - riskyOp: {}
    catch:
      - set:
          name: error
          value: "{{$error}}"
```

### Fetch
```yaml
- fetch:
    url: https://api.example.com
    method: POST
    headers:
      Authorization: Bearer {{secret.token}}
    body:
      data: "{{payload}}"
    output: response
    outputMode: detailed_response
```

### Emit
```yaml
- emit:
    event: user-registered
    payload:
      userId: "{{user.id}}"
    target:
      userId: 'user-id'
```

### Wait
```yaml
- wait:
    oneOf:
      - event: complete
        filters:
          payload.id: "{{id}}"
    timeout: 30
    output: result
```

### Rate Limit
```yaml
- rateLimit:
    name: API
    window: 60
    limit: 5
    consumer: "{{user.id}}"
    output: limits
```

---

## Pages

URL: `https://[workspace].pages.prisme.ai/[lang]/[slug]`

```yaml
slug: dashboard
name: Dashboard
accessControl: public|private
language: en
seoSettings:
  title: Dashboard
```

Access: Public, Private, Role-Based, Email-Based, SSO

---

## Blocks

```yaml
slug: MyBlock
onInit: initEvent
updateOn: updateEvent
automation: myAutomation
className: custom
css: ':block { display: flex; }'
if: '{{condition}}'
repeat: '{{array}}'
```

### Form
```yaml
- slug: Form
  schema:
    type: object
    properties:
      email:
        type: string
        format: email
  onSubmit: submit
  submitLabel: Send
```

### RichText
```yaml
- slug: RichText
  content:
    en: <p>Hello</p>
  markdown: true
```

### Action
```yaml
- slug: Action
  text:
    en: Click
  type: event
  value: clicked
  payload:
    id: "{{id}}"
```

### DataTable
```yaml
- slug: DataTable
  data: "{{items}}"
  columns:
    - title: Name
      dataIndex: name
      sorter: true
  pagination:
    pageSize: 10
```

### Dialog Box
```yaml
- slug: Dialog Box.Dialog Box
  setup:
    input:
      enabled: true
      event: sendMessage
  history: "{{messages}}"
```

---

## Integrations

### OAuth 2.0
```yaml
auth:
  oauth2:
    grantType: client_credentials
    tokenUrl: https://auth.example.com/token
    clientId: "{{secrets.ID}}"
    clientSecret: "{{secrets.SECRET}}"
```

### Databases
| Type | Examples |
|------|----------|
| Relational | MySQL, PostgreSQL, SQL Server |
| NoSQL | MongoDB, Redis |
| Vector | Pinecone, Weaviate, Milvus |

### Cloud Storage
```yaml
- s3:
    operation: getObject|putObject|listObjects
    bucket: "{{bucket}}"
    key: "{{path}}"
```

---

## Events

| Category | Examples |
|----------|----------|
| Workspace | workspaces.configured, deleted |
| App | apps.installed, uninstalled |
| Automation | runtime.automations.executed |
| Runtime | runtime.fetch.failed |

### Event Mapping
```yaml
events:
  types:
    usage:
      schema:
        usage:
          type: object
          properties:
            total_tokens:
              type: number
```

---

## Expressions

```yaml
# CRITICAL: Math operators OUTSIDE {{}}
value: '{% {{counter}} + 1 %}'

# Functions
date({{mydate}}).year
now()
lower({{str}})
split('a,b', ',')
rand(1, 100)
isArray({{var}})
json({{obj}})
deepmerge({{a}}, {{b}})
```

---

## Custom Apps

```yaml
name: My App
slug: my-app
version: 1.0.0
config:
  apiKey:
    type: string
    secret: true
    required: true
automations:
  - slug: fetchData
    when:
      events:
        - my-app.fetch
    do:
      - fetch:
          url: "{{config.endpoint}}"
```

### Workflow
1. Planning - Define scope
2. Setup - Create workspace
3. Implementation - Build
4. Documentation - Guides
5. Testing - Validate
6. Publication - Marketplace

---

## Best Practices

| Practice | Description |
|----------|-------------|
| Modular | Break into automations |
| Error Handling | try/catch |
| State | Appropriate scopes |
| Security | Secrets for sensitive data |
| Performance | Parallel with `all` |
| Testing | Various inputs |

---

## Integrations

- Knowledge: Webhook RAG
- Store: Deploy as agents
- Collection: Data integration
- Governance: Policies
- Insights: Metrics
