# Knowledge (Storage)

Storage is the RAG infrastructure workspace for files, vector stores, document indexing, crawler callbacks, search, and reusable agent skills.

**Workspace:** `storage` (`hl2Xm8u`)

## Core Concepts

- **Files:** uploaded or URL-backed file records. Use `v1/files` to list/upload files and `v1/files/:file_id/content` to retrieve content.
- **Vector stores:** named RAG indexes. A vector store has one physical provider index; `knowledge` and `conversation` scopes are separated by vector metadata.
- **Vector store files:** join records linking files or URLs to a vector store. They track indexing status, source type, tags, chunks, vectors, scope, conversation ID, TTL, parser, and crawler document ID.
- **Skills:** reusable agent instructions plus tool definitions stored in Storage. Agent Factory resolves skill references from Storage.

## Document Indexing Flow

1. Create a vector store with `POST /v1/vector_stores`.
2. Add a file or URL with `POST /v1/vector_stores/:vector_store_id/files`.
3. Storage emits `file.index_requested`.
4. `index-file` chooses the parser. Documents go through Crawler; image/audio/video can use LLM parsing.
5. Crawler sends `crawler.notifications` to `webhook`.
6. `webhook` handles `item.scraped`, failures, dropped items, and crawler health events.
7. `_process-parsed-content` chunks text, calls LLM Gateway `v1/embeddings`, upserts vectors through `_vector-router`, updates statuses, emits `file.indexed`, and notifies Agent Factory.

## Search And RAG

Use `POST /v1/vector_stores/:vector_store_id/search` for semantic retrieval. The request supports `query`, `max_num_results`, `conversation_id`, `rewrite_query`, `ranking_options.score_threshold`, and metadata filters.

Agent Factory exposes Storage search to agents as `file_search`. Conversation attachments create or reuse an agent-owned vector store and a `conversation_file_search` tool, then index attachments into `scope: conversation` with a TTL.

## Main APIs

| Area | Endpoints |
|------|-----------|
| Files | `GET/POST /v1/files`, `GET/DELETE /v1/files/:file_id`, `GET /v1/files/:file_id/content` |
| Vector stores | `GET/POST /v1/vector_stores`, `GET/PATCH/DELETE /v1/vector_stores/:vector_store_id` |
| Vector store files | `GET/POST /v1/vector_stores/:vector_store_id/files`, `PATCH/DELETE /files/:file_id`, `POST /reindex`, `GET /chunks` |
| Search | `POST /v1/vector_stores/:vector_store_id/search` |
| Web crawling | `GET /crawl_status`, `POST /recrawl` |
| Skills | `GET/POST /v1/skills`, `GET/PATCH/DELETE /v1/skills/:skill_id` |

## Integrations

- Agent Factory builds and executes `file_search`, creates conversation vector stores, calls Storage search, and receives indexing callbacks.
- LLM Gateway owns embeddings, model defaults, model access, and optional query rewrite.
- Vector provider workspaces such as `vector-elasticsearch` and `vector-opensearch` perform provider-specific vector operations.
- Crawler parses files and web pages asynchronously.
- SharePoint Connector syncs SharePoint files into Storage vector stores.

## Wording To Use

| Avoid | Use |
|-------|-----|
| AI Knowledge project | Storage vector store or Agent Factory agent, depending on context |
| Knowledge Client for RAG | Storage APIs and Agent Factory `file_search` |
| AI Knowledge Vector Store app | Storage vector store and provider workspace |
| `documents_rag` current tool | Agent Factory `file_search` |
| AI Knowledge manages LLM routing | LLM Gateway manages model routing |
