# Prisme.ai Advanced Features

This page describes advanced features for Agent Factory, Storage-backed RAG, LLM Gateway calls, and app/MCP integrations.

## 1. Crawler / Web Scraping

Crawler extracts website and document content for Storage vector stores.

### Capabilities

- Website and document extraction: HTML, PDF, Office files, Markdown, text.
- CSS selector or XPath filtering where supported.
- Sitemap-based crawling.
- Configurable parsing pipeline.
- Async callbacks into Storage through `crawler.notifications`.

### Configuration Pattern

```yaml
websiteURL: https://example.com
blacklisted_patterns:
  - "/admin/*"
xpath_filter: "//article//p"
periodicity: 86400
parsers: docling|xpath|unstructured
```

## 2. Custom Code

Use `Custom Code.run function` to call configured JavaScript, TypeScript, or Python functions.

```yaml
- Custom Code.run function:
    function: processData
    parameters:
      data: '{{payload.items}}'
    output: processedData
```

Do not call functions as `Custom Code.myFunction`; use the `run function` form.

## 3. API Integrations

Automations can call REST, GraphQL, SOAP, or webhook endpoints with `fetch`.

| Auth method | Pattern |
|-------------|---------|
| API key | Header from `{{secret.KEY}}` |
| Bearer | `Authorization: Bearer {{secret.TOKEN}}` |
| Basic | `auth.basic` |
| OAuth 2.0 | `auth.oauth2` authorization code or client credentials |
| AWS Sig V4 | `auth.awsv4` |

```yaml
- try:
    do:
      - fetch:
          url: https://api.example.com/data
          headers:
            Authorization: 'Bearer {{secret.TOKEN}}'
          output: response
    catch:
      - emit:
          event: api.error
          payload:
            error: '{{$error}}'
```

## 4. Agent Factory Capabilities

Current tool-using agents are configured in Agent Factory and backed by Capabilities.

| Capability | Description | Runtime owner |
|------------|-------------|---------------|
| `file_search` | Search Storage vector stores | Storage + Agent Factory |
| `mcp` | Call MCP servers with JSON-RPC `tools/list` and `tools/call` | Agent Factory |
| `function` | Call an HTTP endpoint as an LLM tool | Agent Factory |
| `skill` | Activate reusable instructions and tool hints | Agent Factory / Storage |
| `guardrail` | Validate input, output, or actions | `tools-guardrails` |
| `sub_agent` | Delegate to another Agent Factory agent | Agent Factory |
| memory | Remember, recall, forget long-term facts | `tools-memories` |

MCP tools are discovered through `tools/list`, converted into LLM-callable schemas, and executed through `tools/call`. Function tools post structured arguments to an HTTP endpoint. Guardrails run from `agent_config.guardrails`, not as ordinary LLM tools.

## 5. Storage RAG

Current RAG uses Storage vector stores plus Agent Factory `file_search`.

```yaml
# Conceptual flow
1. POST /v1/vector_stores
2. POST /v1/vector_stores/:vector_store_id/files
3. Wait for indexing completion
4. Attach vector store to Agent Factory as file_search
5. Agent Factory calls POST /v1/vector_stores/:vector_store_id/search
```

Search supports semantic retrieval, optional query rewrite, score thresholds, metadata filters, and conversation-scoped vectors when `conversation_id` is provided.

### Implementable Patterns

- Query rewrite: ask LLM Gateway to rewrite a user query, then call Storage search.
- Metadata filtering: restrict file search by tags or source fields.
- Conversation file search: index user-uploaded attachments into conversation-scoped vectors.
- Connector-backed RAG: sync external content, such as SharePoint, into Storage vector stores.

## 6. LLM Gateway

LLM Gateway is the current model execution layer.

| API | Use |
|-----|-----|
| `POST /v1/chat/completions` | OpenAI-compatible chat completions, streaming or non-streaming |
| `POST /v1/embeddings` | Embeddings for Storage indexing and retrieval |
| `GET /v1/models` | Model catalog and capability lookup |
| `GET /v1/defaults` | Effective platform/org defaults |

Use LLM Gateway for direct model calls, embeddings, model routing, model metadata, and usage/cost/carbon analytics. Use Agent Factory for agent orchestration and Storage for RAG data.

## 7. Event-Driven Architecture

Common event categories:

| Category | Examples |
|----------|----------|
| System | `workspaces.configured`, `runtime.fetch.failed` |
| Automation | `runtime.automations.executed` |
| Analytics | `analytics.llm.completion`, `analytics.agent.rated` |
| Custom | User-defined domain events |

Use `@timestamp` for event sorting and `source.correlationId` for tracing one execution flow.

## 8. Collection App And Structured Data

The Collection app remains the low-level database primitive for DSUL imports and workspace data. AI Collection v3 is the agent-facing structured data MCP server built on that primitive.

```yaml
- Messages.find:
    query:
      conversationId: '{{conversationId}}'
    options:
      limit: 50
    output: messages
```

For agents that need structured records through tools, use AI Collection v3 MCP tools such as `data_insert`, `data_query`, `data_update`, `data_count`, and `data_aggregate`.

## 9. Custom Apps

A custom app packages config, imports, automations, pages, and optional MCP-compatible endpoints.

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
          url: '{{config.endpoint}}/data'
          headers:
            Authorization: '{{config.apiKey}}'
          output: data
```

## 10. Common Pitfalls

### Expression Syntax

```yaml
# Correct
value: '{% {{counter}} + 1 %}'

# Wrong: string concatenation, not arithmetic
value: '{{counter}} + 1'
```

### App Calls

```yaml
# Correct
- Custom Code.run function:
    function: myFunction
    parameters:
      data: '{{payload}}'
    output: result
```

### Collection Empty Query

```yaml
- Collection.deleteMany:
    query: {}
    overrideSecurity: true
```

## 11. Self-Hosting Config

Common function and crawler settings:

```yaml
PYTHON_FUNCTIONS_RUN_TIMEOUT: 20000
FUNCTIONS_RUN_TIMEOUT: 20000
KERNEL_POOL_SIZE: 4
CRAWLER_TIMEOUT: 30000
CRAWLER_MAX_PAGES: 1000
```
