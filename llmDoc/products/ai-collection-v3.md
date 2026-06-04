# AI Collection v3

AI Collection v3 is the one-product structured data MCP server for agents. It lets agents create named collections and perform CRUD, query, counting, distinct-value, and aggregation operations over structured records.

**Workspace:** `ai-collection-v3` (`zMk01ho`)
**MCP endpoint:** `/workspaces/slug:ai-collection-v3/webhooks/ai-collection/mcp`

## What It Replaces

Legacy AI Collection was documented as a tabular UI and natural-language querying product. AI Collection v3 is agent-facing structured data exposed through MCP. Natural-language querying happens when an Agent Factory agent decides to call structured tools.

## MCP Tools

| Tool | Purpose |
|------|---------|
| `data_insert` | Insert one record or an array of records |
| `data_query` | Search records with filters, sort, pagination, projection |
| `data_get` | Get one record by ID |
| `data_update` | Update one or many records by filter |
| `data_upsert` | Insert or update using `match_fields` |
| `data_delete` | Delete one or many records by filter |
| `data_count` | Count records matching a filter |
| `data_distinct` | Return unique values for a field |
| `data_aggregate` | Sum, average, or count, optionally grouped |
| `data_create_collection` | Create a named collection and return `collection_id` |

## Scoping And Storage

Named collection mode uses `collection_id` and checks collection metadata. Partition mode omits `collection_id` and isolates records by `agent_id` and `tool_id`. Storage uses Collection app imports for shared data and collection metadata.

## REST Wrappers

| Endpoint | Purpose |
|----------|---------|
| `/v1/collections` | List metadata or create a named collection |
| `/v1/collections/:collection_id` | Get/update/delete metadata |
| `/v1/collections/:collection_id/data` | Query or insert records |
| `/v1/collections/:collection_id/data/:record_id` | Get/update/delete one record |
| `/v1/collections/:collection_id/data/count` | Count records |
| `/v1/collections/:collection_id/data/distinct` | Distinct values |
| `/v1/collections/:collection_id/data/upsert` | Upsert records |
| `/v1/collections/:collection_id/data/aggregate` | Aggregations |

## Integration

Register AI Collection v3 as an MCP server capability, then Agent Factory discovers `tools/list` and calls the selected tool through JSON-RPC `tools/call`. No built-in Capabilities catalog entry is evidenced yet, so use the custom MCP path unless one is added.
