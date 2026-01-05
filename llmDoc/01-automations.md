# Prisme.ai Automations Reference

Server-side processes: **what to do** and **when**.

---

## Basic Structure

```yaml
slug: example-automation
name: Example Automation
when:
  # Trigger
do:
  # Instructions
output: "{{result}}"
```

---

## Triggers

### URL/Webhook
```yaml
when:
  endpoint: true
```

**Variables:** `body`, `headers`, `method`, `query`
**File uploads:** `body.<fileKey>` with `originalname`, `encoding`, `mimetype`, `size`, `base64`

**Response Control ($http):**
```yaml
- set:
    name: $http
    value:
      headers:
        content-type: application/json
      status: 200

# SSE chunks
- set:
    name: $http
    value:
      chunk:
        partial: "First part"
      sseKeepAlive: 5000  # min 5000ms
```

**Notes:** `$http` only in URL-triggered automation (not children). Headers fixed after first chunk.

### Events
```yaml
when:
  events:
    - user-login
    - document-uploaded
```

**Variables:** `payload`, `source` (IP, correlationId, userId, automation, serviceTopic)

### Schedule (Cron, UTC)
```yaml
when:
  schedules:
    - '0 9 * * 1-5'  # 9 AM weekdays
```

Min frequency: 15 minutes. Emits `runtime.automations.scheduled`.

---

## Memory Scopes

| Scope | Persistence | Use |
|-------|-------------|-----|
| `run` | 60s | Execution context |
| `user` | Persistent | User preferences |
| `session` | 1mo auth/1h unauth | Browser state |
| `global` | Workspace-wide | Shared config |
| `socket` | 6h | WebSocket state |
| `config` | Workspace config | Settings |
| `$workspace` | Read-only | Workspace definition |

### Run Variables
```yaml
{{run.date}}              # Timestamp
{{run.ip}}                # Client IP
{{run.automationSlug}}    # Current automation
{{run.correlationId}}     # Event trace
{{run.depth}}             # Stacktrace depth
{{run.trigger.type}}      # event, endpoint, automation
{{run.trigger.value}}     # Event name or path
{{run.socketId}}          # WebSocket ID
{{run.appSlug}}           # Current app
{{run.appInstanceSlug}}   # Current appInstance
{{run.parentAppSlug}}     # Parent app
{{run.authenticatedWorkspaceId}}  # Workspace auth token (read-only)
```

### User Variables
```yaml
{{user.id}}          {{user.email}}
{{user.role}}        {{user.authData}}
```

### Global Variables
```yaml
{{global.workspaceId}}     {{global.workspaceName}}
{{global.apiUrl}}          {{global.studioUrl}}
{{global.pagesUrl}}        {{global.pagesHost}}
{{global.endpoints}}       {{global.workspacesRegistry}}
```

### $workspace
```yaml
{{$workspace.imports.myApp.config}}
```

**Note:** All scopes except `$workspace` writable with `set`. Session/user from unauthenticated webhooks NOT persisted.

---

## Instructions

### Conditions
```yaml
- conditions:
    '{{user.age}} >= 18':
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
# Array
- repeat:
    on: '{{users}}'
    do:
      - set:
          name: processedUsers[]
          value: '{{item.name}}'

# Count
- repeat:
    until: 5
    do:
      - set:
          name: counter
          value: '{% {{$index}} + 1 %}'

# Batch parallel
- repeat:
    on: '{{workQueue}}'
    batch:
      size: 3
      interval: 500
    do:
      - process:
          item: '{{item}}'
```

**Variables:** `{{item}}`, `{{$index}}` (0-based)

### Break
```yaml
- break:
    scope: repeat      # Exit loop
- break:
    scope: automation  # Stop automation
- break:
    scope: all         # Stop all (for parent try/catch)
    payload:
      reason: "Cancelled"
- break: {}            # Default: automation
```

### All (Parallel)
```yaml
- all:
    - automation1: {}
    - automation2: {}
    - fetch:
        url: https://api.example.com/data
```

### Try/Catch
```yaml
- try:
    do:
      - riskyOperation: {}
    catch:
      - set:
          name: errorInfo
          value: "{{$error}}"
```

**Note:** `$error` accessible inside and outside catch.

### Set
```yaml
- set:
    name: greeting
    value: "Hello"

- set:
    name: user.profile.firstName
    value: "Jane"

# Merge objects
- set:
    name: settings
    type: merge
    value:
      theme: "dark"

# Array append
- set:
    name: users[]
    value:
      id: 123
      name: "Jane"

# Array merge
- set:
    name: users
    type: merge
    value:
      - id: 124
        name: "Alice"

# Expression
- set:
    name: counter
    value: '{% {{counter}} + 1 %}'
```

### Delete
```yaml
- delete:
    name: temporaryData
```

### Fetch
```yaml
- fetch:
    url: https://api.example.com/users
    method: POST
    headers:
      Authorization: Bearer {{secret.apiToken}}
    body:
      name: "New User"
    output: response
    outputMode: detailed_response  # base64, data_url, detailed_response
    emitErrors: true  # Emit runtime.fetch.failed on 4xx/5xx

# Access detailed: {{response.body}}, {{response.headers}}, {{response.status}}

# Multipart
- fetch:
    url: https://api.example.com/upload
    method: POST
    multipart:
      - fieldname: file
        value: "{{fileContent}}"
        filename: report.pdf
        contentType: application/pdf

# Form-urlencoded
- fetch:
    url: '...'
    headers:
      Content-Type: application/x-www-form-urlencoded
    body:
      foo: bar

# SSE stream sync
- fetch:
    url: "some SSE endpoint"
    output: output
- repeat:
    'on': '{{output.body}}'
    do:
      - set:
          name: chunks[]
          value: '{{item}}'

# SSE stream async
- fetch:
    url: '...'
    stream:
      event: chunk
      payload:
        foo: bar
      endChunk:
        done: true
      target:
        userId: '{{user.id}}'
      options:
        persist: false

# AWS Signature V4
- fetch:
    url: https://bedrock-runtime.eu-west-3.amazonaws.com/model/{{model}}/invoke
    auth:
      awsv4:
        accessKeyId: ''
        secretAccessKey: ''
        service: bedrock
        region: 'eu-west-3'
    method: POST
    body:
      inputText: Hello

# Forward workspace auth
- fetch:
    url: https://api.studio.prisme.ai/v2/workspaces/123/webhooks/someAutomation
    auth:
      prismeai:
        forwardWorkspaceAuth: true
```

### Emit
```yaml
- emit:
    event: user-registered
    payload:
      userId: "{{user.id}}"
    target:
      userTopic: 'target-topic'
      sessionId: 'session-id'
      userId: 'user-id'
    options:
      persist: false
```

### Wait
```yaml
- wait:
    oneOf:
      - event: processing-complete
        filters:
          payload.documentId: "{{documentId}}"
    timeout: 30  # Default 20s
    output: processingResult
```

### Rate Limit
```yaml
- rateLimit:
    name: ExternalAPICall
    window: 60    # seconds
    limit: 5
    consumer: "{{user.id}}"
    output: limits

- conditions:
    "{{limits.ok}}":
      - fetch:
          url: https://api.example.com/data
    default:
      - emit:
          event: rate-limit-exceeded
          payload:
            retryAfter: "{{limits.retryAfter}}"
```

**Output:** `ok`, `retryAfter`, `remaining`, `limit`, `window`, `consumer`

### Auth
```yaml
- auth:
    workspace: true
    output: jwt
- fetch:
    url: https://api.studio.prisme.ai/v2/workspaces/123/webhooks/someAutomation
    headers:
      Authorization: Bearer {{jwt.jwt}}
```

**Note:** `{{run.authenticatedWorkspaceId}}` available when using workspace token.

---

## App Automations

**Pattern:** `AppName.automationSlug:`

### Custom Code
```yaml
- Custom Code.run function:
    function: myFunctionName
    parameters:
      data: '{{payload.items}}'
    output: processedData
```

### Collection

**Schema:**
```yaml
slug: Messages
config:
  collectionName: Messages
  indexes:
    - properties: children
    - properties:
        - conversationId
        - from.id
  uniques:
    - properties: conversationId
  properties:
    conversationId:
      type: text
      nullable: false
    content:
      type: text
    from:
      type: json
      nullable: false
    tags:
      type: array
    messagesCount:
      type: number
```

**Types:** `string, text, date, time, datetime, number, double, float, integer, decimal, boolean, uint8array, array (text only), enum, enumArray, json, blob`

**Update operators:** `$push, $set, $inc, $addToSet, $pull`

```yaml
# Insert
- Collection.insert:
    data:
      name: "{{payload.name}}"
      createdAt: '{% now() %}'
    output: result

# InsertMany
- Collection.insertMany:
    data:
      - name: "Jane"
      - name: "Bob"
    output: result

# Find
- Collection.find:
    query:
      status: active
    sort:
      createdAt: -1
    options:
      limit: 10
      page: 1
      fields:
        - projectId
        - createdAt
    output: results

# FindOne
- Collection.findOne:
    query:
      _id: "{{documentId}}"
    output: document

# UpdateOne
- Collection.updateOne:
    query:
      _id: "{{documentId}}"
    data:
      $set:
        status: "completed"
      $inc:
        loginCount: 1
      $push:
        history:
          date: "{{run.date}}"
    output: updateResult

# UpdateMany
- Collection.updateMany:
    query:
      active: false
    data:
      $set:
        status: "inactive"
    output: updateResult

# DeleteOne/DeleteMany
- Collection.deleteOne:
    query:
      _id: "{{documentId}}"
- Collection.deleteMany:
    query:
      active: false
      lastLogin: { $lt: "{% dateAdd('now', -90, 'days') %}" }
# Empty query raises error. Use overrideSecurity: true for all.

# Upsert
- Collection.upsert:
    data:
      type: city
      name: Toulouse
    options:
      onConflictFields:
        - name
      onInsertValues:
        createdAt: '{% now() %}'

# Distinct
- Collection.distinct:
    query:
      projectId: '{{projectId}}'
    field: 'tags'
    opts:
      count: true
      sort:
        count: -1
    output: res

# Aggregate
- Collection.aggregate:
    query:
      projectId: '{{projectId}}'
    opts:
      groupBy: department
      sort:
        count: -1
    steps:
      - inputField: amount
        type: sum
        outputField: totalAmount
      - inputField: _id
        type: count
        outputField: count
    output: aggregation
```

**MongoDB vs PostgreSQL:**
- `$in: []` - matches nothing (Mongo), matches everything (Postgres)
- `$ne` with NULL - considers NULL (Mongo), ignores NULL (Postgres)
- Array queries - `{ "col": "value" }` (Mongo), `{ "col": { $in: ["value"] } }` (Postgres)
- Nested arrays - direct access (Mongo), requires `$elemMatch` (Postgres)
- Upserts - flexible (Mongo), requires unique index on `onConflictFields` (Postgres)

### User Topics
```yaml
- createUserTopic:
    topic: project-updates
    userIds:
      - "{{user1Id}}"

- joinUserTopic:
    topic: project-updates
    userIds:
      - "{{newUserId}}"

- emit:
    event: project-update
    target:
      userTopic: project-updates
```

---

## Expression Syntax

### Delimiters
- `{{variable}}` - Variable interpolation
- `{% expression %}` - Expression evaluation

**CRITICAL: Math operators OUTSIDE `{{}}`:**
```yaml
value: '{% {{value}} / 2 + 3 %}'      # CORRECT
value: '{% {{value / 2}} + 3 %}'      # WRONG
```

### Dynamic Property
```yaml
{{session.myObject[{{item.field}}]}}
```

### Comparison
```yaml
{{age}} > 18    {{age}} >= 18    {{age}} < 18
{{age}} == 18   {{age}} = 18     {{age}} != 18
{{city}} = "Toulouse"
"hello" matches "hel"
"hello" matches {{someArray}}
```

### Logical
```yaml
{{a}} >= 18 and {{b}} == "Paris"
{{a}} >= 18 && {{b}} == "Paris"
{{a}} >= 18 or {{b}} == "Paris"
{{a}} >= 18 || {{b}} == "Paris"
!({{a}} >= 18)
not ({{a}} >= 18)
```

### Variable Checking
```yaml
{{var}}       # Defined?
!{{var}}      # Empty?
```

### Membership & Type
```yaml
{{val}} in {{list}}
{{key}} in {{obj}}
{{key}} not in {{obj}}
isArray({{var}})
isObject({{var}})
isString({{var}})
isNumber({{var}})
```

### Regex
```yaml
"luke.skywalker@gmail.com" matches regex("luke|skywalker")
```

### MongoDB Match
```yaml
jsonmatch({{object}}, {{condition}})
# {"$or": [{"test": "unknown"}, {"one": {"$eq": "three"}}]}
```

### Functions

#### Date
```yaml
now()
date("2022-04-13T08:00:05.493Z").hour  # 8
date({{mydate}}).minute / .second / .date / .month / .year / .day / .ts / .iso
date("2023-03-31", "DD/MM/YYYY")
date("2023-03-31", "LT", "fr")
date("2023-03-31", "LT", "fr", "America/New_York")
dateAdd('now', -90, 'days')
dateAdd("2023-01-15", 7, "days")
```

#### Math
```yaml
rand(50, 150)   rand()
round(10.2)     round(10.26, 1)
ceil(10.1)      floor(10.9)
{{a}} * {{b}}   ({{a}} * {{b}} + 10) / 2
```

#### String
```yaml
lower({{foo}})   upper({{foo}})
truncate({{str}}, 42, ' etc')
split('a,b,c', ',')
join(['a', 'b'], ',')
replace('hello world', 'world', 'there')
sanitize('<b>Hi</b>')  # HTML escape
sanitize('Hi ! ')      # Remove complex unicode
```

#### JSON
```yaml
json('{"foo": "bar"}')         # Parse
json({{payload.data}})         # Stringify
unsafejson('Text: ["un"] !')   # Extract JSON from text
```

#### Deep Merge
```yaml
deepmerge({{obj1}}, {{obj2}})
deepmerge({{obj1}}, {{obj2}}, {concatStrings: true})
```

#### URL
```yaml
URLSearchParams("key1=value1").asJSON
URLSearchParams({foo: "bar"}).asString
URL("https://www.google.fr/path/?foo=bar").hostname
URL("https://www.google.fr/path/?foo=bar").searchParams
```

---

## Argument Validation

```yaml
slug: testArguments
do: []
when:
  endpoint: true
arguments:
  someString:
    type: string
  someNumber:
    type: number
  someObject:
    type: object
    required:
      - field
    properties:
      field:
        type: string
        pattern: '^[a-z]+$'
  someUri:
    type: string
    format: uri  # uri, email, date, time, password
  someRawJSON:
    type: object
    additionalProperties: true
  someToken:
    type: string
    secret: true  # Auto-redacted from events
validateArguments: true
output: '{{body}}'
```

Validation errors stop current and parent automations.

---

## Common Patterns

### Webhook Handler
```yaml
slug: hubspot-webhook
when:
  endpoint: true
do:
  - conditions:
      '!{{headers["x-hubspot-signature"]}}':
        - set:
            name: $http
            value:
              status: 401
        - break:
            scope: automation
  - set:
      name: newDeal
      value: "{{body.deal}}"
  - fetch:
      url: "{{config.slackWebhookUrl}}"
      method: POST
      body:
        text: "New deal: {{newDeal.name}}"
```

### Event Chain
```yaml
# Step 1
- emit:
    event: doc-started
    payload:
      docId: "{{doc.id}}"

# Step 2 (separate automation)
when:
  events:
    - doc-started
do:
  - emit:
      event: doc-completed
      payload:
        docId: "{{payload.docId}}"
```

### Multi-LLM
```yaml
# Categorize
- fetch:
    url: "{{config.llmApiUrl}}/chat-completions"
    method: POST
    body:
      model: "gpt-3.5-turbo"
      messages:
        - role: system
          content: "Categorize: Bug, Feature, UX, Praise, Other"
        - role: user
          content: "{{payload.text}}"
    output: category

# Analyze with different model
- fetch:
    url: "{{config.llmApiUrl}}/chat-completions"
    method: POST
    body:
      model: "mistral"
      messages:
        - role: system
          content: "Extract sentiment and key points"
        - role: user
          content: "{{payload.text}}"
    output: analysis
```
