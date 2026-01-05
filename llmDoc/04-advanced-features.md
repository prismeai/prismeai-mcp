# Prisme.ai Advanced Features

## 1. Crawler / Web Scraping

Automated web content extraction for knowledge bases.

### Capabilities
- Website/document extraction (HTML, PDF, Office)
- CSS selector, XPath filtering
- Sitemap-based crawling
- Configurable periodicity
- Multiple parsers

### Configuration
```yaml
websiteURL: https://example.com
blacklisted_patterns:
  - "/admin/*"
  - "*.pdf"
xpath_filter: "//article//p"
periodicity: 86400  # seconds
parsers: docling|xpath|unstructured
```

### Parsers
| Parser | Use |
|--------|-----|
| docling | General documents |
| xpath | Precise HTML extraction |
| unstructured | Complex structures |

### XPath Examples
```yaml
xpath_filter: "//article//p"           # Paragraphs from articles
xpath_filter: "//div[@class='content']//text()"
xpath_filter: "//h1 | //h2 | //p"      # Multiple selectors
```

---

## 2. Custom Code

### CRITICAL: Calling Functions

**MUST use `Custom Code.run function:` with function parameter:**
```yaml
# CORRECT
- Custom Code.run function:
    function: processData
    parameters:
      data: '{{payload.items}}'
    output: processedData

# WRONG
- Custom Code.processData:     # WILL NOT WORK
    data: '{{payload.items}}'
```

### JavaScript/TypeScript

**Libraries:** lodash, moment, dayjs, axios, uuid, crypto

```javascript
async function processData(input) {
  const _ = require('lodash');
  const grouped = _.groupBy(input.items, 'category');
  return {
    categories: Object.keys(grouped),
    counts: _.mapValues(grouped, arr => arr.length)
  };
}
return processData(data);
```

### Python

**Libraries:** pandas, numpy, sklearn, nltk, requests

```python
import pandas as pd
from sklearn.cluster import KMeans

def cluster_data(data, n_clusters=3):
    df = pd.DataFrame(data)
    kmeans = KMeans(n_clusters=n_clusters)
    df['cluster'] = kmeans.fit_predict(df[['x', 'y']])
    return df.to_dict('records')

result = cluster_data(data, n_clusters)
```

### Function Config
```yaml
functions:
  myFunction:
    code: |
      async function main(params) {
        return { result: params.value * 2 };
      }
    parameters:
      value:
        type: number
        default: 1
```

### Resource Limits (Self-Hosting)
| Variable | Default |
|----------|---------|
| PYTHON_FUNCTIONS_RUN_TIMEOUT | 20000ms |
| FUNCTIONS_RUN_TIMEOUT | 20000ms |
| KERNEL_POOL_SIZE | CPU cores |
| NODE_WORKER_MAX_OLD_GENERATION_SIZE_MB | 100MB |

---

## 3. API Integrations

### Authentication

| Method | Config |
|--------|--------|
| API Keys | `headers: { X-API-Key: "{{secrets.KEY}}" }` |
| Bearer | `headers: { Authorization: "Bearer {{secrets.TOKEN}}" }` |
| Basic | `auth: { basic: { username: "...", password: "..." } }` |
| OAuth 2.0 | Multiple flows |
| AWS Sig V4 | `auth: { awsv4: { ... } }` |

### OAuth 2.0
```yaml
# Authorization Code
auth:
  oauth2:
    grantType: authorization_code
    authorizationUrl: https://provider.com/oauth/authorize
    tokenUrl: https://provider.com/oauth/token
    clientId: "{{secrets.CLIENT_ID}}"
    clientSecret: "{{secrets.CLIENT_SECRET}}"
    scope: "read write"

# Client Credentials
auth:
  oauth2:
    grantType: client_credentials
    tokenUrl: https://provider.com/oauth/token
    clientId: "{{secrets.CLIENT_ID}}"
    clientSecret: "{{secrets.CLIENT_SECRET}}"
```

### Error Handling
```yaml
- try:
    do:
      - fetch:
          url: https://api.example.com
          output: response
    catch:
      - conditions:
          '{{$error}} matches "timeout"':
            - emit:
                event: api-timeout
          '{{$error}} matches "401"':
            - emit:
                event: auth-failed
          default:
            - emit:
                event: api-error
                payload:
                  error: "{{$error}}"
```

---

## 4. Tool-Using Agents

### Architecture
1. Language Model - Reasoning
2. Tool Registry - Capabilities
3. Tool Selection - Decision
4. Parameter Formation - Input structuring
5. Execution Engine - Running
6. Result Interpretation - Output

### Tool Types
| Type | Description |
|------|-------------|
| Native | Web browsing, image gen, code interpreter |
| Custom APIs | REST, GraphQL, SOAP via fetch |
| Collection | Built-in database (MongoDB/PostgreSQL) |
| Custom Functions | Business logic via Custom Code |
| MCP | Model Context Protocol |

### Implementation

**No-Code:**
```yaml
tools:
  - name: searchWeb
    type: native
    config:
      searchType: search
      resultCount: 5
```

**Full-Code:**
```yaml
slug: tool-calling-agent
do:
  - set:
      name: tools
      value:
        - name: searchDatabase
          description: Search customer database
          parameters:
            query:
              type: string
              description: Search query
  - llm:
      model: gpt-4
      tools: "{{tools}}"
      messages: "{{conversation}}"
      output: response
  - conditions:
      '{{response.tool_calls}}':
        - executeTools:
            calls: "{{response.tool_calls}}"
```

### Tool Parameter Schema
```yaml
arguments:
  body:
    type: object
    properties:
      query:
        type: string
        title: Search query
        description: Information to search
      resultCount:
        type: integer
        minimum: 1
        maximum: 20
        default: 5
validateArguments: true
```

---

## 5. AI Knowledge Tools

AI Knowledge provides built-in tools that agents can invoke via LLM tool-calling. These are **not** native YAML instructions—they are configured per-project in the UI (Home > AI > Tools) and executed automatically when the LLM decides to use them.

### How Tools Work

1. **Configuration:** Enable tools in project settings (Home > AI > Tools section)
2. **Invocation:** The LLM decides when to call tools based on user queries
3. **Execution:** AI Knowledge executes the tool and returns results to the LLM
4. **Response:** The LLM incorporates tool results into its answer

### Available Tools

| Tool | Description | Configuration |
|------|-------------|---------------|
| Web Search | Real-time web search | Provider, result count |
| Code Interpreter | Python code execution | Enabled/disabled, visibility |
| Image Generation | Text-to-image generation | Model selection |
| Document Search (RAG) | Knowledge base queries | Chunk count, filters |
| File Search | Search uploaded attachments | Allowed file types |
| Deep Research | Multi-step web research | Max depth, timeout |

### Web Search

Searches the web in real-time. Supports multiple providers:

| Provider | Description |
|----------|-------------|
| Serper | Google Search API (default) |
| Brave | Brave Search API |
| Google | Google Custom Search |

**Search Types:** `search`, `news`, `images`, `videos`, `places`, `scholar`, `patents`, `shopping`

**Date Filters:** `qdr:h` (hour), `qdr:d` (day), `qdr:w` (week), `qdr:m` (month), `qdr:y` (year)

### Code Interpreter

Executes Python code for computations, data analysis, and file processing.

**Available Libraries:** pandas, numpy, geopandas, PyPDF2, pdfminer, pdfplumber, matplotlib, requests, dateparser

**Features:**
- Auto-retry on errors (up to 3 attempts)
- Access to RAG results via `rag_results` parameter
- File attachment processing

### Image Generation

Generates images from text prompts using configured model (default: DALL-E 3).

### Document Search (RAG)

Queries the project's knowledge base using semantic search.

**Features:**
- Self-query filtering (automatic tag selection)
- Query enhancement
- Contextual compression
- Re-ranking

### Custom Tools

Projects can also define custom tools:

| Type | Description |
|------|-------------|
| Automation | Call external webhooks/APIs |
| Agent | Delegate to another AI Knowledge agent |
| MCP | Model Context Protocol servers |

Custom tools are configured in the project's `tools.definitions` with:
- `name`: Display name
- `description`: LLM prompt hint
- `arguments`: JSON Schema for parameters
- `automation.url` / `agent.id` / `mcp.url`: Execution endpoint

---

## 6. Advanced RAG

### Built-in RAG Features

The AI Knowledge app provides built-in RAG capabilities:

**Self-Query Retrieval:** Automatically extracts filters from user queries using LLM to match document tags.
```yaml
- selfQueryRetrieval:
    query: "{{userQuery}}"
    projectId: "{{projectId}}"
    output: structuredQuery  # Returns { query, tags: { include, exclude }, title }
```

**Context Retrieval:** Vector search with filtering.
```yaml
- retrieve-context:
    projectId: "{{projectId}}"
    userQuery: "{{query}}"
    filters:
      - field: tags
        type: in
        value: ["tag1", "tag2"]
    numberOfSearchResults: 10
    output: chunks
```

### Vector Store Integration

AI Knowledge uses the **Vector Store** app internally for vector operations. Vector Store supports:
- **RedisSearch** - Redis-based vector storage
- **OpenSearch** - OpenSearch-based vector storage

These are configured at the app level, not through individual instructions.

### RAG Patterns (Implementable)

These are conceptual patterns you can implement using standard instructions. They are NOT built-in instructions.

**HyDE (Hypothetical Document Embeddings):**
```yaml
# Pattern: Generate hypothetical answer, then search with it
- llm:
    prompt: "Write a hypothetical answer to: {{query}}"
    output: hypotheticalAnswer
- AI Knowledge.retrieve-context:
    userQuery: "{{hypotheticalAnswer}}"
    projectId: "{{projectId}}"
    output: documents
```

**Self-Reflective RAG:**
```yaml
# Pattern: Evaluate relevance, re-query if needed
- AI Knowledge.retrieve-context:
    userQuery: "{{query}}"
    projectId: "{{projectId}}"
    output: initialContext
- llm:
    prompt: "Rate relevance 0-1. Query: {{query}} Context: {{initialContext}}"
    output: relevanceCheck
- conditions:
    '{{relevanceCheck.score}} < 0.7':
      - set:
          name: query
          value: "{{relevanceCheck.reformulatedQuery}}"
      - AI Knowledge.retrieve-context:
          userQuery: "{{query}}"
          projectId: "{{projectId}}"
          output: initialContext
```

### Webhook Integration

AI Knowledge can call external webhooks during document lifecycle and query processing.

**Subscription Types:** `queries`, `documents_created`, `documents_updated`, `documents_deleted`, `tests_results`

**Webhook Endpoint Example:**
```yaml
# Create an automation endpoint to receive AI Knowledge webhooks
slug: my-aik-webhook
when:
  endpoint: true
do:
  # Webhook receives: type, projectId, sessionId, payload, project
  - conditions:
      '{{body.type}} == "queries"':
        # Return custom chunks, answer, aiParameters, filters, searchResults, or blocks
        - set:
            name: output
            value:
              filters:
                - field: tags
                  type: in
                  value: ["priority"]
```

See **AI Knowledge > Webhooks** for full payload and response documentation.

### Context Processing
| Technique | Description |
|-----------|-------------|
| Compression | LLM summarization |
| Fusion | Multi-source combination |
| Routing | Query-based selection |
| Enrichment | Entity linking |

---

## 7. Event-Driven Architecture

### Event Types
| Category | Examples |
|----------|----------|
| System | `workspaces.configured`, `runtime.fetch.failed` |
| User | `user.login`, `user.action` |
| Automation | `runtime.automations.executed` |
| Custom | User-defined |

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
            cost:
              type: number
              format: double
```

### Patterns

**Saga (Long-running):**
```yaml
- emit:
    event: saga-started
    payload:
      sagaId: "{{sagaId}}"
      step: 1
- wait:
    oneOf:
      - event: step-1-complete
        filters:
          payload.sagaId: "{{sagaId}}"
    timeout: 300
- conditions:
    '{{result.success}}':
      - emit:
          event: step-2-start
    default:
      - emit:
          event: saga-compensate
```

**Fan-out/Fan-in:**
```yaml
# Fan-out
- repeat:
    on: "{{tasks}}"
    do:
      - emit:
          event: task-started
          payload:
            taskId: "{{item.id}}"
            batchId: "{{batchId}}"

# Fan-in (separate automation)
when:
  events:
    - task-completed
do:
  - incrementCounter:
      batch: "{{payload.batchId}}"
  - conditions:
      '{{allTasksComplete}}':
        - emit:
            event: batch-complete
```

---

## 8. Collection App (Database)

### Schema
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

**Types:** `string, text, date, time, datetime, number, double, float, integer, decimal, boolean, uint8array, array (text), enum, enumArray, json, blob`

### MongoDB vs PostgreSQL

| Issue | MongoDB | PostgreSQL |
|-------|---------|------------|
| `$in: []` | Nothing | Everything |
| `$ne` NULL | Considers | Ignores |
| Array queries | `{"col": "val"}` | `{"col": {$in: ["val"]}}` |
| Nested arrays | Direct | `$elemMatch` |
| Array order on `$push` | Preserved | May lose |
| Upserts | Flexible | Unique index required |

### Operations
```yaml
# Insert
- Collection.insert:
    data:
      name: "{{name}}"
      createdAt: '{% now() %}'
    output: result

# Find
- Collection.find:
    query:
      status: active
      age: { $gt: 25 }
    sort:
      createdAt: -1
    options:
      limit: 50
      page: 1
      fields:
        - name
    output: results

# Update
- Collection.updateOne:
    query:
      _id: "{{docId}}"
    data:
      $set:
        status: "done"
      $inc:
        viewCount: 1
    output: result

# Upsert
- Collection.upsert:
    data:
      uniqueKey: "{{key}}"
      value: "{{val}}"
    options:
      onConflictFields:
        - uniqueKey
      onInsertValues:
        createdAt: '{% now() %}'

# Delete
- Collection.deleteMany:
    query:
      active: false
      lastLogin: { $lt: '{% dateAdd("now", -90, "days") %}' }
# Empty query = error. Use overrideSecurity: true for all.

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
    output: agg
```

**Update operators:** `$push, $set, $inc, $addToSet, $pull`

---

## 9. Custom Apps

### Structure
```yaml
name: My App
slug: my-app
version: 1.0.0
config:
  apiKey:
    type: string
    secret: true
    required: true
  endpoint:
    type: string
    default: https://api.example.com

automations:
  - slug: fetchData
    when:
      events:
        - my-app.fetch
    do:
      - fetch:
          url: "{{config.endpoint}}/data"
          headers:
            Authorization: "{{config.apiKey}}"
          output: data
      - emit:
          event: my-app.data-fetched
          payload: "{{data}}"
```

### Workflow
1. Planning - Define scope
2. Setup - Create workspace
3. Implementation - Build automations/UI
4. Documentation - Write guides
5. Testing - Validate
6. Publication - Submit to marketplace

---

## 10. Common Pitfalls

### Expression Syntax
```yaml
# WRONG
value: '{% {{value / 2}} + 3 %}'
value: '{{counter}} + 1'  # String concat only

# CORRECT
value: '{% {{value}} / 2 + 3 %}'
value: '{% {{counter}} + 1 %}'
```

### App Calls
```yaml
# WRONG
- Custom Code.myFunction:
    data: '{{payload}}'

# CORRECT
- Custom Code.run function:
    function: myFunction
    parameters:
      data: '{{payload}}'
    output: result
```

### Collection Empty Query
```yaml
# WRONG - throws error
- Collection.deleteMany:
    query: {}

# CORRECT
- Collection.deleteMany:
    query: {}
    overrideSecurity: true
```

### Variable Scoping
```yaml
# Variables in conditions NOT available outside
- conditions:
    '{{flag}}':
      - set:
          name: innerVar
          value: "hello"
# innerVar NOT accessible here
```

### Arrays
```yaml
# Append (creates if needed)
- set:
    name: users[]
    value: '{{newUser}}'

# WRONG - replaces array
- set:
    name: users
    value:
      - '{{newUser}}'
```

---

## 11. Self-Hosting Config

### Functions
```yaml
PYTHON_API_URL: http://localhost:8000
PYTHON_FUNCTIONS_RUN_TIMEOUT: 20000
FUNCTIONS_RUN_TIMEOUT: 20000
KERNEL_POOL_SIZE: 4
NODE_BUILTIN_MODULES: "http,https,url,util,zlib,dns,stream,buffer,crypto"
NODE_WORKER_MAX_OLD_GENERATION_SIZE_MB: 100
```

### Resources
| Component | Min | Prod |
|-----------|-----|------|
| Memory | 1GB | 2GB+ |
| CPU | 0.5 vCPU | 1+ vCPU |
| Disk | 1GB | 5GB+ |

### Crawler
```yaml
CRAWLER_TIMEOUT: 30000
CRAWLER_MAX_PAGES: 1000
CRAWLER_USER_AGENT: "PrismeBot/1.0"
CRAWLER_RATE_LIMIT: 1
```
