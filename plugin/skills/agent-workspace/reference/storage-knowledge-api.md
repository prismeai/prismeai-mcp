# Knowledges (Storage) — REST API Reference

Condensed index of `storage-knowledge.swagger.yml`, bundled next to this file. Read the spec itself for full request/response schemas, enums, and error codes.

- **Base URL**: `https://{host}/v2/workspaces/slug:storage/webhooks`
- **Auth**: BearerAuth, WorkspaceApiKeyAuth
- **Operations**: 35
- **How to call it from a generated workspace**: through the `Storage` app import (`Storage.<method>`), never with `fetch:`. This spec tells you the payload shape the app forwards.

## `Storage` App Methods

| Method | REST operation | Purpose |
|---|---|---|
| `Storage.addFileToVectorStore` | `POST /v1/knowledge_bases/{id}/documents` | Add a document to a knowledge base. |
| `Storage.createAPIKey` | `POST /v1/knowledge_bases/{id}/api-keys` | Mint a per-knowledge-base API key. |
| `Storage.createSkill` | `POST /v1/skills` | createSkill |
| `Storage.createVectorStore` | `POST /v1/knowledge_bases` | Create a knowledge base. |
| `Storage.deleteFile` | `DELETE /v1/files/{file_id}` | DEPRECATED — the legacy storage files registry has no new-surface equivalent and will be removed with the legacy API. |
| `Storage.deleteSkill` | `DELETE /v1/skills/{skill_id}` | deleteSkill |
| `Storage.deleteVectorStore` | `DELETE /v1/knowledge_bases/{id}` | Delete a knowledge base. |
| `Storage.deleteVectorStoreFile` | `DELETE /v1/knowledge_bases/{id}/documents/{document_id}` | Delete a document. |
| `Storage.downloadFileContent` | `GET /v1/files/{file_id}/content` | DEPRECATED — still calls the LEGACY /v1/files/{id}/content route (stream / 302), which will be removed with the legacy API. |
| `Storage.getCrawlStatus` | `GET /v1/knowledge_bases/{vector_store_id}` | Crawl/indexing status of a knowledge base. |
| `Storage.getFile` | `GET /v1/files/{file_id}` | DEPRECATED — the legacy storage files registry has no new-surface equivalent and will be removed with the legacy API. |
| `Storage.getFileChunks` | `GET /v1/knowledge_bases/{vector_store_id}/documents/{file_id}/chunks` | List a document's chunks (GET .../documents/{document_id}/chunks). |
| `Storage.getSkill` | `GET /v1/skills/{skill_id}` | getSkill |
| `Storage.getStorageStats` | `GET /v1/stats` | getStorageStats |
| `Storage.getVectorStore` | `GET /v1/knowledge_bases/{id}` | Get a knowledge base. |
| `Storage.getVectorStoreAdminUrl` | — | Build the Prisme.ai admin URL for a vector store from its id (no HTTP call). |
| `Storage.getVectorStoreFile` | `GET /v1/knowledge_bases/{id}/documents/{document_id}` | Get a document. |
| `Storage.getVectorStoreFileSourceUrl` | `GET /v1/knowledge_bases/{vector_store_id}/documents/{file_id}/source_url` | Resolve a browser-usable source URL for a document (A11): a short-lived download URL for uploaded files, the original source_url otherwise. |
| `Storage.getWebSourceCounts` | `GET /v1/knowledge_bases/{vector_store_id}/web_sources` | Per-seed web source metrics for a knowledge base. |
| `Storage.grantVectorStoreAccess` | `POST /v1/knowledge_bases/{vector_store_id}/access` | grantVectorStoreAccess |
| `Storage.healthCheck` | `GET /v1/test` | End-to-end smoke test of the storage backend (platform admin only). |
| `Storage.listAPIKeys` | `GET /v1/knowledge_bases/{id}/api-keys` | List a knowledge base's API keys. |
| `Storage.listFiles` | `GET /v1/files` | DEPRECATED — the legacy storage files registry has no new-surface equivalent and will be removed with the legacy API. |
| `Storage.listSkills` | `GET /v1/skills` | listSkills |
| `Storage.listVectorStoreAccess` | `GET /v1/knowledge_bases/{vector_store_id}/access` | listVectorStoreAccess |
| `Storage.listVectorStoreFiles` | `GET /v1/knowledge_bases/{id}/documents` | List a knowledge base's documents. |
| `Storage.listVectorStores` | `GET /v1/knowledge_bases` | List knowledge bases. |
| `Storage.recrawlWebSources` | `POST /v1/knowledge_bases/{id}/web_sources/{seed_id}/recrawl` (client-side fan-out over seeds) | Trigger a re-crawl of a knowledge base's web sources. |
| `Storage.reindexAllFiles` | `POST /v1/vector_stores/{vector_store_id}/reindex` | DEPRECATED — still calls the LEGACY bulk reindex route, which the new surface does not replace (no KB-level reindex as-built) and which will be remove… |
| `Storage.reindexFile` | `POST /v1/knowledge_bases/{vector_store_id}/documents/{file_id}/reindex` | Re-index a document (POST .../documents/{document_id}/reindex). |
| `Storage.revokeAPIKey` | `DELETE /v1/knowledge_bases/{id}/api-keys/{key_id}` | Revoke an API key. |
| `Storage.revokeVectorStoreAccess` | `DELETE /v1/knowledge_bases/{vector_store_id}/access/{principal_type}/{principal_id}` | revokeVectorStoreAccess |
| `Storage.rotateAPIKey` | `POST /v1/knowledge_bases/{id}/api-keys/{key_id}/rotate` | Rotate an API key. |
| `Storage.searchVectorStore` | `POST /v1/knowledge_bases/{id}/search` | Semantic search in a knowledge base. |
| `Storage.updateSkill` | `PATCH /v1/skills/{skill_id}` | updateSkill |
| `Storage.updateVectorStore` | `PATCH /v1/knowledge_bases/{id}` | Update a knowledge base. |
| `Storage.updateVectorStoreAccess` | `PATCH /v1/knowledge_bases/{vector_store_id}/access/{principal_type}/{principal_id}` | updateVectorStoreAccess |
| `Storage.updateVectorStoreFile` | `PATCH /v1/knowledge_bases/{id}/documents/{document_id}` | Update a document. |
| `Storage.uploadFile` | `POST /v1/files` | DEPRECATED — the legacy storage files registry has no new-surface equivalent and will be removed with the legacy API. |

A `—` means the app builds the path dynamically. Anything this table does not cover is not reachable through the app: report the missing method instead of falling back to `fetch:`.

## Endpoints

### Knowledge Bases

Create, list, read, update, and delete knowledge bases (vector-backed document stores).

| Verb | Path | Operation | Summary |
|---|---|---|---|
| POST | `/v1/knowledge_bases` | `createKnowledgeBase` | Create a knowledge base |
| GET | `/v1/knowledge_bases` | `listKnowledgeBases` | List knowledge bases visible to the caller |
| GET | `/v1/knowledge_bases/{knowledgeBaseId}` | `getKnowledgeBase` | Retrieve a knowledge base |
| PATCH | `/v1/knowledge_bases/{knowledgeBaseId}` | `updateKnowledgeBase` | Update knowledge base metadata and crawl settings |
| DELETE | `/v1/knowledge_bases/{knowledgeBaseId}` | `deleteKnowledgeBase` | Delete a knowledge base |
| POST | `/v1/knowledge_bases/{knowledgeBaseId}/reindex` | `reindexKnowledgeBase` | Bulk reindex DISPATCHER - queue re-processing of every document |

### Documents

Ingest and manage documents (uploaded files, web pages, remote files, connector documents) and their indexing.

| Verb | Path | Operation | Summary |
|---|---|---|---|
| POST | `/v1/knowledge_bases/{knowledgeBaseId}/documents` | `createDocument` | Attach a source (idempotent upsert) |
| GET | `/v1/knowledge_bases/{knowledgeBaseId}/documents` | `listDocuments` | List documents |
| GET | `/v1/knowledge_bases/{knowledgeBaseId}/documents/{documentId}` | `getDocument` | Retrieve a document |
| PATCH | `/v1/knowledge_bases/{knowledgeBaseId}/documents/{documentId}` | `updateDocument` | Update document metadata |
| DELETE | `/v1/knowledge_bases/{knowledgeBaseId}/documents/{documentId}` | `deleteDocument` | Detach a source |
| POST | `/v1/knowledge_bases/{knowledgeBaseId}/documents/{documentId}/reindex` | `reindexDocument` | Force a re-run of the indexing pipeline (re-fetch, re-parse, re-chunk, re-embed) |
| GET | `/v1/knowledge_bases/{knowledgeBaseId}/documents/{documentId}/chunks` | `listDocumentChunks` | List the document's chunks |
| GET | `/v1/knowledge_bases/{knowledgeBaseId}/documents/{documentId}/source_url` | `resolveDocumentSourceUrl` | Resolve a citation link (lazy) |
| POST | `/v1/knowledge_bases/{knowledgeBaseId}/source_urls` | `resolveDocumentSourceUrlsBatch` | Resolve citation links in a batch |

### Web Sources

Recurring web crawl seeds that discover and index pages into a knowledge base.

| Verb | Path | Operation | Summary |
|---|---|---|---|
| POST | `/v1/knowledge_bases/{knowledgeBaseId}/web_sources` | `createWebSource` | Create a recurring crawl seed |
| GET | `/v1/knowledge_bases/{knowledgeBaseId}/web_sources` | `listWebSources` | List crawl seeds |
| GET | `/v1/knowledge_bases/{knowledgeBaseId}/web_sources/{seedId}` | `getWebSource` | Retrieve a crawl seed (config + metrics + last/next run) |
| PATCH | `/v1/knowledge_bases/{knowledgeBaseId}/web_sources/{seedId}` | `updateWebSource` | Update seed configuration |
| DELETE | `/v1/knowledge_bases/{knowledgeBaseId}/web_sources/{seedId}` | `deleteWebSource` | Delete a crawl seed |

### Search

Semantic search over a knowledge base.

| Verb | Path | Operation | Summary |
|---|---|---|---|
| POST | `/v1/knowledge_bases/{knowledgeBaseId}/search` | `searchKnowledgeBase` | Semantic search |

### Access

Per-knowledge-base access bindings (user, group, org, agent principals).

| Verb | Path | Operation | Summary |
|---|---|---|---|
| GET | `/v1/knowledge_bases/{knowledgeBaseId}/access` | `listAccessBindings` | List access bindings |
| POST | `/v1/knowledge_bases/{knowledgeBaseId}/access` | `createAccessBinding` | Grant access |
| PATCH | `/v1/knowledge_bases/{knowledgeBaseId}/access/{principalType}/{principalId}` | `updateAccessBinding` | Change a principal's role |
| DELETE | `/v1/knowledge_bases/{knowledgeBaseId}/access/{principalType}/{principalId}` | `deleteAccessBinding` | Revoke access |

### API Keys

Per-knowledge-base API keys for connector authentication.

| Verb | Path | Operation | Summary |
|---|---|---|---|
| POST | `/v1/knowledge_bases/{knowledgeBaseId}/api-keys` | `createKnowledgeBaseApiKey` | Mint an API key |
| GET | `/v1/knowledge_bases/{knowledgeBaseId}/api-keys` | `listKnowledgeBaseApiKeys` | List API keys |
| DELETE | `/v1/knowledge_bases/{knowledgeBaseId}/api-keys/{apiKeyId}` | `deleteKnowledgeBaseApiKey` | Revoke an API key |
| POST | `/v1/knowledge_bases/{knowledgeBaseId}/api-keys/{apiKeyId}/rotate` | `rotateKnowledgeBaseApiKey` | Rotate an API key |

### Stats

Aggregate dashboard statistics.

| Verb | Path | Operation | Summary |
|---|---|---|---|
| GET | `/v1/stats` | `getStats` | Dashboard stats |

### Skills

Prompt/instruction registry entries.

| Verb | Path | Operation | Summary |
|---|---|---|---|
| POST | `/v1/skills` | `createSkill` | Create a skill |
| GET | `/v1/skills` | `listSkills` | List skills |
| GET | `/v1/skills/{skillId}` | `getSkill` | Retrieve a skill |
| PATCH | `/v1/skills/{skillId}` | `updateSkill` | Update a skill |
| DELETE | `/v1/skills/{skillId}` | `deleteSkill` | Delete a skill |
