# AI Knowledge

RAG (Retrieval Augmented Generation) management platform for document ingestion, vector embedding, and intelligent retrieval.

**Users:** Knowledge managers, SMEs, Business, IT/Dev

---

## Architecture Overview

```
Document → Load → Parse → Chunk → Embed → Index
                                            ↓
User Query → Enhance → Tool Routing → Context Retrieval → Prompt Build → LLM → Response
                            ↓
                    [Tool Execution Loop]
```

Model-agnostic: supports various LLMs for embedding and generation.

### Pipeline Options (Home > AI)

| Component | Description |
|-----------|-------------|
| Text Splitter | Static or Dynamic chunking |
| Embeddings | Vectorization config |
| Self-Query | Autonomous KB queries |
| Enhance Query | Pre-process for clarity |
| Post Query | Suggested questions, source filter |
| Code Interpreter | Dynamic processing |

Custom pipelines: Webhooks + Python Custom Code.

---

## Internal Architecture

This section documents AI Knowledge's internal data flow and automation architecture.

### Query Data Flow

The query pipeline processes user questions through these stages:

```
User Question
      │
      ▼
┌─────────────┐     ┌───────────────┐     ┌──────────────┐
│ query.yml   │ ──▶ │ genericQuery  │ ──▶ │ Rate Limits  │
│ (API Entry) │     │     .yml      │     │ & Auth       │
└─────────────┘     └───────────────┘     └──────┬───────┘
                                                  │
                    ┌─────────────────────────────┘
                    ▼
┌────────────────────────────────────────────────────────┐
│ Optional Stages:                                        │
│  • Query Enhancement - reformulates user question       │
│  • Webhook (queries) - custom pre-processing            │
│  • Deep Research - multi-step research                  │
└────────────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│           callLLMWithTools.yml (Tool Loop)              │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 1. Get available tools (getToolsDefinitions)    │  │
│  │ 2. Format tools to OpenAI format                │  │
│  │ 3. Call LLM (LLMCompletion.yml)                 │  │
│  │ 4. If tool_calls in response:                   │  │
│  │    - Execute each tool (executeTool.yml)        │  │
│  │    - Add tool results to messages               │  │
│  │    - Loop back to step 3                        │  │
│  │ 5. Return final answer when no more tools       │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│ Post-Processing (if enabled):                           │
│  • Question suggestions                                 │
│  • Source filtering                                     │
│  • Save to conversation history                         │
└────────────────────────────────────────────────────────┘
                    │
                    ▼
               Response
```

#### Key Query Stages

| Stage | Automation | Description |
|-------|------------|-------------|
| API Entry | `query.yml` | Validates input, authorizes project API key, handles sync/async/SSE modes |
| Orchestration | `genericQuery.yml` | Main query logic: loads project, applies limits, coordinates all stages |
| Query Enhancement | `enhanceQuery` | Optional reformulation for clearer queries |
| Webhook | `fetchProjectWebhook` | Custom pre-processing, can override chunks/prompt/answer |
| Prompt Build | `buildPrompt.yml` | Constructs messages with history, context, attachments |
| LLM + Tools | `callLLMWithTools.yml` | Tool calling loop with LLM |
| LLM Call | `LLMCompletion.yml` | Actual LLM API call with rate limiting and failover |
| Post-Query | `postLLMQuery` | Question suggestions, source filtering |

---

### Tool Calling Architecture

AI Knowledge implements OpenAI-compatible tool calling with a loop-based execution model:

```
┌─────────────────────────────────────────────────────────┐
│               getToolsDefinitions.yml                    │
│  Determines available tools based on:                    │
│   • Project config (webSearch, codeInterpreter, etc.)   │
│   • Uploaded attachments (enables file_search)          │
│   • Document count (enables documents_rag)              │
│   • Custom tool definitions (automations, agents, MCP)  │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│               callLLMWithTools.yml                       │
│  ┌───────────────────────────────────────────────────┐  │
│  │                  TOOL LOOP                        │  │
│  │  (max iterations = maxPerRequest + tool_choice)   │  │
│  │                                                    │  │
│  │  1. Format tools to OpenAI schema                 │  │
│  │     { type: "function", function: { name, desc,   │  │
│  │       parameters } }                              │  │
│  │                    │                              │  │
│  │                    ▼                              │  │
│  │  2. LLMCompletion (with tools parameter)          │  │
│  │                    │                              │  │
│  │        ┌───────────┴───────────┐                  │  │
│  │        ▼                       ▼                  │  │
│  │   [tool_calls]          [text response]           │  │
│  │        │                       │                  │  │
│  │        ▼                       ▼                  │  │
│  │  Execute tools           Return final             │  │
│  │  (executeTool)           answer                   │  │
│  │        │                                          │  │
│  │        ▼                                          │  │
│  │  3. Add to messages:                              │  │
│  │     { role: "assistant", tool_calls: [...] }     │  │
│  │     { role: "tool", tool_call_id, content }      │  │
│  │        │                                          │  │
│  │        └──────── Loop back to step 1 ─────────────┘  │
│  │                                                    │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

#### Tool Execution (executeTool.yml)

Routes to specific handlers based on tool ID:

| Tool ID | Handler | Description |
|---------|---------|-------------|
| `documents_rag` | `tool_documentsRag_getChunks` | Vector search in project documents |
| `file_search` | `tool_files_getChunks` | Search in uploaded conversation files |
| `file_summary` | `tool_files_getChunks` | Summarize uploaded files |
| `web_search` | `tool_webSearch_getChunks` | Web search via Serper/Brave/Google |
| `code_interpreter` | `tool_code_interpreter` | Python execution with pandas/numpy |
| `image_generation` | `tool_image_generation` | DALL-E image generation |
| Custom automation | `tool_automation_fetch` | Call external webhook/API |
| Custom agent | `tool_agents_query` | Delegate to another AI Knowledge project |
| MCP tool | `tool_mcp_query` | Model Context Protocol server |

#### Tool Configuration Example

```yaml
# Automation tool
my_api_tool:
  type: automation
  description: "Calls external API"
  automation:
    url: "https://api.example.com/endpoint"
  arguments:
    type: object
    properties:
      query:
        type: string

# Agent tool
support_agent:
  type: agent
  description: "Handles support queries"
  agent:
    id: "project-id"
    name: "Support Agent"

# MCP tool
mcp_server:
  type: mcp
  mcp:
    url: "https://mcp-server.example.com"
    tools:
      - name: "get_weather"
        description: "Get weather data"
        inputSchema:
          type: object
          properties:
            location:
              type: string
```

---

### Document Ingestion Flow

```
Upload Source (UI / API / Connector)
              │
              ▼
┌────────────────────────────────────────────────────────┐
│               on add document.yml                       │
│  (UI event handler - triggered by "add document")       │
│   • Validates project access                            │
│   • Handles file uploads (adds share token)             │
│   • Routes to createOneFile for each file               │
└────────────────────────────────────────────────────────┘
              │
              ▼
┌────────────────────────────────────────────────────────┐
│               createOneFile.yml                         │
│   • Sanitizes document name                             │
│   • Checks file count limits                            │
│   • Generates document ID (or uses externalId)          │
│   • Calls documents_created webhook (if configured)     │
│   • Determines parser type (crawler vs model-based)     │
│   • Creates document record in Collection               │
│   • Emits parsing event                                 │
└────────────────────────────────────────────────────────┘
              │
    ┌─────────┴─────────┐
    ▼                   ▼
┌──────────────┐  ┌──────────────────┐
│ Crawler      │  │ Model-based      │
│ (PDFs, etc.) │  │ (text, simple)   │
└──────┬───────┘  └────────┬─────────┘
       │                   │
       └─────────┬─────────┘
                 ▼
┌────────────────────────────────────────────────────────┐
│               vectorizeDocument.yml                     │
│   • Loads project text splitter config                  │
│   • Splits text into chunks (splitText function)        │
│     - chunkSize (respects model max context)            │
│     - chunkOverlap                                      │
│     - separators                                        │
│   • Calls embeddings API                                │
│   • Returns embedded documents with vectors             │
└────────────────────────────────────────────────────────┘
              │
              ▼
┌────────────────────────────────────────────────────────┐
│               Vector Store                              │
│   • Stores embeddings with metadata                     │
│   • Enables semantic search                             │
│   • Supports filtering by tags/metadata                 │
└────────────────────────────────────────────────────────┘
```

#### Document States

| Status | Description |
|--------|-------------|
| `pending` | Created, awaiting parsing/vectorization |
| `published` | Fully processed and searchable |
| `error` | Processing failed |
| `inactive` | Excluded from search results |

---

### Key Automations Reference

#### Query Flow

| Automation | Slug | Purpose |
|------------|------|---------|
| Channel API/Query | `query` | API entry point (endpoint) |
| Query/Generic Query Knowledge | `genericQuery` | Main query orchestration |
| Channel API/API retrieve context | `retrieve-context` | Direct context retrieval API |
| Query/Build Prompt | `buildPrompt` | Constructs LLM messages |
| Query/LLM Completion | `LLMCompletion` | LLM API call with rate limiting |

#### Tool Calling

| Automation | Slug | Purpose |
|------------|------|---------|
| Query/tool/callLLMWithTools | `callLLMWithTools` | Main tool calling loop |
| Query/tool/Tool execution | `executeTool` | Routes/executes individual tools |
| Query/tool/Get tools definition | `getToolsDefinitions` | Determines available tools |

#### Document Processing

| Automation | Slug | Purpose |
|------------|------|---------|
| /UI/documents/on add document | `on add document` | UI event handler |
| Files/Create one file | `createOneFile` | Creates document record |
| FilesVectorize | `vectorizeDocument` | Chunks and embeds text |

---

### External Integrations

| Integration | App | Purpose |
|-------------|-----|---------|
| LLM Providers | OpenAI, Azure | Completions, embeddings |
| Vector Database | Vector Store | Semantic search |
| Document Parsing | Crawler | PDF extraction, OCR |
| Web Search | Serper, Brave, GoogleSearch | Real-time queries |
| Data Storage | Collection Projects | Project/document records |
| Conversations | Conversations Service App | History persistence |
| Code Execution | Custom Code | Python/JS |
| File Storage | Prismeai API | File uploads |

---

## Glossary

| Term | Description |
|------|-------------|
| Agent | AI on dataset, queryable via channels |
| Document | File/URL/text. Status: active/inactive/pending |
| Chunk | Segment after splitting |
| Context | Retrieved chunks for LLM |
| Prompt | Instructions with `${context}` |
| Chunk Size | Characters per segment |
| Chunk Overlap | Shared between chunks |
| Override | Per-doc custom settings + parser |

---

## Documents

### Formats
| Category | Formats |
|----------|---------|
| Text | PDF, DOCX, DOC, RTF, TXT |
| Presentations | PPTX, PPT, KEY |
| Spreadsheets | XLSX, XLS, CSV, TSV |
| Web | HTML, MHT, XML |
| Images | PNG, JPG, TIFF, GIF (OCR) |
| Markdown | MD |
| Code | Various |

### Upload Methods
| Method | Use |
|--------|-----|
| Direct | Individual files, drag-drop |
| Bulk | Zip, S3, GCS, Azure |
| Connectors | SharePoint, Drive, Confluence |
| API | REST, automated workflows |

### Processing Pipeline
```
Upload → Validation → Extraction → Enrichment → Chunking → Embedding → Indexing
```

**Extraction:** PDF text, OCR, tables, structure
**Enrichment:** Metadata, language, entities, topics, summary
**Chunking:** Semantic, fixed-size, structure-based, sliding window, hierarchical
**Embedding:** Model selection, dimensions, multilingual
**Indexing:** Vector DB, metadata, full-text

---

## Tagging

Three modes:
- **Automatic:** AI selects per query (Self Query > Enabled)
- **User-defined:** User selects in Store (Self Query > Enabled by user)
- **Mandatory:** Required per user/group (User sharing)

**Logic:** User tags OR'd, Store tags OR'd, both AND'd

---

## RAG Config

### UI Options
| Setting | Description |
|---------|-------------|
| Instructions | Prompt with `${context}` `${date}` |
| Chunk Size | Segment size |
| Chunk Overlap | Overlap |
| Chunks to Retrieve | Result count |
| Self-Query | Tag filtering |
| Query Enhancement | Reformulation |
| Post-Processing | Suggestions, source filter |

### YAML Tools
```yaml
slug: query-reformulator
name: AIK/Tools/QueryReformulator
do:
  - Knowledge Client.chat-completion:
      messages:
        - role: assistant
          content: 'Generate 3 alternative phrasings. Return JSON with "reformulations" key.'
        - role: user
          content: 'Question: "{{user_question}}"'
      output: reformulations
  - set:
      name: output
      value:
        value: '{{reformulations}}'
```

### Webhooks

External API integration for document lifecycle and query processing. Configure in Home > API & Webhooks.

#### Webhook Envelope

All webhooks receive this structure:
```json
{
  "type": "queries|documents_created|documents_updated|documents_deleted|tests_results",
  "projectId": "project-id",
  "createdAt": "2024-01-15T10:30:00Z",
  "sessionId": "session-id",
  "payload": { /* type-specific data */ },
  "project": { /* full project config */ }
}
```

Auth header: `knowledge-project-apiKey: <apiKey>`

#### Subscription Types

| Type | Trigger | Payload Fields |
|------|---------|----------------|
| `queries` | Each user question | `input`, `messageId`, `history`, `interface`, `filters`, `metadata`, `webhookPayload`, `allConversationAttachments`, `newAttachments` |
| `documents_created` | Document creation | Document object |
| `documents_updated` | Document update | Document object |
| `documents_deleted` | Document deletion | Document ID |
| `tests_results` | Tests completion | Test results array |

#### Queries Webhook Response Options

The `queries` webhook can return any combination of these fields:

```json
// Custom chunks - bypass RAG, provide your own context
{"chunks": [{"value": {"content": "...", "knowledgeId": "doc-id"}}]}

// Custom prompt - override entire LLM prompt
{"prompt": [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}]}

// Direct answer - skip LLM call entirely
{"answer": "Complete response..."}

// Search results - override displayed sources
{"searchResults": [{"title": "...", "url": "...", "snippet": "..."}]}

// UI blocks - add custom blocks to response
{"blocks": [{"slug": "RichText", "content": "..."}]}

// Override AI parameters
{"aiParameters": {"model": "gpt-4", "temperature": 0.9}}

// Override filters for RAG search
{"filters": [{"field": "tags", "type": "in", "value": ["tag"]}]}
```

**Streaming:** If your webhook returns a streaming response, AI Knowledge will forward chunks to the client in real-time.

#### Document Webhooks Response

Document webhooks (`documents_created`, `documents_updated`, `documents_deleted`) can return:
```json
{"status": "success|error", "error": {"message": "..."}}
```

#### AI Knowledge Client App

For complex webhook implementations, install the **AI Knowledge Client** app in your workspace. It provides:
- Query and chat-completion automations
- Document CRUD operations
- Context retrieval helpers
- SSE streaming support

Configure it with your agent's `projectId` and `apiKey`, then call its automations from your webhook handler.

---

## Tools

Tools are configured per-project via the UI (Home > AI > Tools). The LLM invokes them automatically via tool-calling.

### Built-in Tools
| Tool | Description | Providers/Config |
|------|-------------|------------------|
| Web Search | Real-time web search | Serper (default), Brave, Google |
| Code Interpreter | Python execution | pandas, numpy, matplotlib |
| Image Generation | Text-to-image | DALL-E 3 (default) |
| Document Search (RAG) | Knowledge base queries | Vector search + filters |
| File Search | Search uploaded files | Per-conversation attachments |
| Deep Research | Multi-step research | Configurable depth/timeout |

### Web Search Options
- **Types:** search, news, images, videos, places, scholar, patents, shopping
- **Date filters:** qdr:h (hour), qdr:d (day), qdr:w (week), qdr:m (month), qdr:y (year)

### Custom Tools
| Type | Description |
|------|-------------|
| Automation | Call external webhooks/APIs |
| Agent | Delegate to another AI Knowledge project |
| MCP | Model Context Protocol servers |

---

## Testing

| Type | Description |
|------|-------------|
| Manual | Direct interaction |
| Automated | AI-powered eval |
| Human-in-Loop | Sampling review |
| Webhook | External eval |

### Dimensions
| Dimension | Field | Scale | Description |
|-----------|-------|-------|-------------|
| Answer Score | `score` | 0, 1.5, 2 | How close the answer was to reference guidelines |
| Context Score | `context` | 0, 1.5, 2 | Whether required information was in the context |

### Scoring Criteria
| Score | Meaning |
|-------|---------|
| 0 | Answer is false/wrong (only if AI was plainly incorrect) |
| 1.5 | Partially correct, AI understood the subject and provided a response |
| 2 | Answer covered many guidelines, may need follow-up for completeness |

*Note: The LLM evaluator provides scores of 0, 1, or 2. A score of 1 is internally converted to 1.5 for finer granularity.*

---

## Advanced RAG

### Multi-Stage
```
BM25 → Semantic Filter → Re-ranking → Context Selection
```

### Recursive
Query decomposition → Sub-queries → Merge results

### HyDE
Generate hypothetical answer → Search using it

### Context Processing
| Technique | Description |
|-----------|-------------|
| Compression | LLM summarization |
| Fusion | Multi-source |
| Routing | Query-based selection |
| Enrichment | Entity linking |

---

## API

Auth: `knowledge-project-apikey` header (Home > API & Webhook)

### /query
```bash
curl -X POST '/workspaces/{workspaceId}/webhooks/query' \
  -H 'knowledge-project-apikey: KEY' \
  -d '{
    "text": "Question?",
    "projectId": "id",
    "stream": true,
    "sse": true,
    "filters": [{"field": "tags", "type": "in", "value": ["doc"]}]
  }'
```

**Options:** `callback.url` (async), `stream`, `sse`, `userId`, `projectConfigOverride`, `filters`

### /document (Create)
```bash
curl -X POST '/workspaces/{id}/webhooks/document?projectId={id}' \
  -H 'knowledge-project-apikey: KEY' \
  -d '{"name": "Doc", "content": {"text": "..."}}'
```

### /document (Delete)
```bash
curl -X DELETE '/workspaces/{id}/webhooks/document?projectId={id}&id={docId}'
```

### /documents (List)
```bash
curl '/workspaces/{id}/webhooks/documents?projectId={id}&page=0&limit=500'
```

### /projects (Create/Update)
```bash
curl -X POST '/workspaces/{id}/webhooks/projects' \
  -H 'Authorization: Bearer JWT' \
  -d '{"name": "Agent", "ai": {"prompt": "...", "model": "gpt-4"}}'
```

### OpenAI-Compatible
```bash
# Chat completions (no RAG)
curl '/workspaces/{id}/webhooks/v1/chat/completions' \
  -H 'Authorization: Bearer KEY' \
  -d '{"messages": [...], "model": "gpt-4"}'

# Embeddings
curl '/workspaces/{id}/webhooks/v1/embeddings' \
  -d '{"input": "text", "model": "model"}'

# Models
curl '/workspaces/{id}/webhooks/v1/models'
```

---

## WebSocket Events

After `/query` with `stream: true`:
- `apiMessageChunk` - Streaming (concatenated.value, chunk.data)
- `completedMessage` - Full answer
- `sendSourcesMessage` - Sources

---

## Security

### Access
- Document-level permissions
- Role-based, Group
- Temporary grants

### Privacy
- PII detection
- Auto redaction
- Data classification
- Consent

### Compliance
- Retention policies
- Legal hold
- Audit trails

---

## Integrations

- Store: Deploy as agents
- SecureChat: Query via chat
- Builder: Custom pipelines
- Collection: Structured data
- Insights: Quality monitoring
- Crawler: Web extraction
