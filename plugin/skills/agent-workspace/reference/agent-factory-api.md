# Agent Factory — REST API Reference

Condensed index of `agent-factory.swagger.yml`, bundled next to this file. Read the spec itself for full request/response schemas, enums, and error codes.

- **Base URL**: `https://{host}/v2/workspaces/slug:agent-factory/webhooks`
- **Auth**: BearerAuth, WorkspaceApiKeyAuth
- **Operations**: 66
- **How to call it from a generated workspace**: through the `Agents` app import (`Agents.<method>`), never with `fetch:`. This spec tells you the payload shape the app forwards.

## `Agents` App Methods

| Method | REST operation | Purpose |
|---|---|---|
| `Agents.addTool` | `POST /v1/agents/{agent_id}/tools` | Add a tool to an agent. |
| `Agents.createAgent` | `POST /v1/agents` | Create a new agent in agent-factory. |
| `Agents.deleteAgent` | `DELETE /v1/agents/{agent_id}` | Delete an agent by ID. |
| `Agents.getAgent` | `GET /v1/agents/{agent_id}` | Get an agent by ID. |
| `Agents.getStreamConfig` | `POST /v1/agents/{agent_id}/messages/stream` (URL + headers only, no call) | Returns the URL and headers needed for direct SSE streaming to an agent. |
| `Agents.listAgents` | `GET /v1/agents` | List agents with optional scope filter. |
| `Agents.publishAgent` | `POST /v1/agents/{agent_id}/publish` | Publish an agent to the store. |
| `Agents.removeTool` | `DELETE /v1/agents/{agent_id}/tools/{tool_id}` | Remove a tool from an agent. |
| `Agents.sendMessage` | `POST /v1/agents/{agent_id}/messages/send` | Send a message to an agent and get a blocking response. |
| `Agents.streamMessage` | `POST /v1/agents/{agent_id}/messages/stream` | Send a message to an agent via the streaming endpoint. |
| `Agents.updateAgent` | `PATCH /v1/agents/{agent_id}` | Update an existing agent (partial update). |

A `—` means the app builds the path dynamically. Anything this table does not cover is not reachable through the app: report the missing method instead of falling back to `fetch:`.

## Endpoints

### Agents

Agent CRUD, discovery, AGENTS.md import/export.

| Verb | Path | Operation | Summary |
|---|---|---|---|
| GET | `/v1/agents` | `listAgents` | List agents |
| POST | `/v1/agents` | `createAgent` | Create a new agent |
| GET | `/v1/agents/{agentId}` | `getAgent` | Get a single agent by ID |
| PATCH | `/v1/agents/{agentId}` | `updateAgent` | Update an agent (partial update) |
| DELETE | `/v1/agents/{agentId}` | `deleteAgent` | Delete an agent and its associated data |
| GET | `/v1/agents/discovery` | `discoverAgents` | Get featured agents and categories |
| POST | `/v1/agents/import` | `importAgent` | Import an agent from AGENTS.md |
| GET | `/v1/agents/{agentId}/citations/source_url` | `resolveCitationSourceUrl` | Resolve a file_search citation link (302 redirect) |
| GET | `/v1/agents/{agentId}/export` | `exportAgent` | Export an agent as AGENTS.md |

### Access

Agent access bindings, sharing, and access requests.

| Verb | Path | Operation | Summary |
|---|---|---|---|
| GET | `/v1/agents/{agentId}/access` | `listAgentBindings` | List access bindings for an agent |
| POST | `/v1/agents/{agentId}/access` | `shareAgent` | Share an agent with a principal (create binding) |
| DELETE | `/v1/agents/{agentId}/access/{principalType}/{principalId}` | `revokeAgentAccess` | Revoke an agent access binding |
| POST | `/v1/agents/{agentId}/access/request` | `requestAgentAccess` | Request access to a published restricted agent |
| GET | `/v1/agents/{agentId}/access/requests` | `listAgentAccessRequests` | List access requests for an agent |
| POST | `/v1/agents/{agentId}/access/requests/{requestId}` | `respondToAccessRequest` | Approve or reject an access request |

### ApiKeys

Agent-scoped API key management (mint, revoke, rotate).

| Verb | Path | Operation | Summary |
|---|---|---|---|
| GET | `/v1/agents/{agentId}/api-keys` | `listAgentApiKeys` | List agent-scoped API keys |
| POST | `/v1/agents/{agentId}/api-keys` | `createAgentApiKey` | Mint a new agent-scoped API key |
| DELETE | `/v1/agents/{agentId}/api-keys/{keyId}` | `revokeAgentApiKey` | Revoke an agent API key |
| POST | `/v1/agents/{agentId}/api-keys/{keyId}/rotate` | `rotateAgentApiKey` | Rotate (regenerate) an agent API key secret |

### Publishing

Publish or discard draft changes on an agent.

| Verb | Path | Operation | Summary |
|---|---|---|---|
| POST | `/v1/agents/{agentId}/publish` | `publishAgent` | Publish an agent |
| POST | `/v1/agents/{agentId}/discard-draft` | `discardAgentDraft` | Discard draft changes and revert to the published snapshot |

### Ratings

User ratings on published agents.

| Verb | Path | Operation | Summary |
|---|---|---|---|
| POST | `/v1/agents/{agentId}/ratings` | `rateAgent` | Rate an agent (1-5) |

### Profiles

Agent profiles/presets catalog (simple, workflow, agent_light, agent_full, orchestrator).

| Verb | Path | Operation | Summary |
|---|---|---|---|
| GET | `/v1/profiles` | `listProfiles` | List available agent profiles (presets) |

### Activity

Activity feed for agents (events, errors, lifecycle changes).

| Verb | Path | Operation | Summary |
|---|---|---|---|
| GET | `/v1/activity` | `getActivity` | Get the activity feed for an agent |

### Analytics

Agent usage analytics (series + summary).

| Verb | Path | Operation | Summary |
|---|---|---|---|
| GET | `/v1/agents/{agentId}/analytics` | `getAgentAnalytics` | Get analytics (series + summary) for an agent |
| POST | `/v1/agents/{agentId}/refresh-metrics` | `refreshAgentAnalytics` | On-demand metrics refresh for an agent |

### Conversations

Conversations on an agent (CRUD, archive, star).

| Verb | Path | Operation | Summary |
|---|---|---|---|
| GET | `/v1/agents/{agentId}/conversations` | `listConversations` | List conversations for an agent |
| POST | `/v1/agents/{agentId}/conversations` | `createConversation` | Create a new conversation |
| DELETE | `/v1/agents/{agentId}/conversations` | `deleteAllConversations` | Delete all conversations for the caller on this agent |
| GET | `/v1/agents/{agentId}/conversations/{contextId}` | `getConversation` | Get a single conversation with its message history |
| PATCH | `/v1/agents/{agentId}/conversations/{contextId}` | `updateConversation` | Update conversation metadata (title, archive, star) |
| DELETE | `/v1/agents/{agentId}/conversations/{contextId}` | `deleteConversation` | Delete a single conversation (cascades to tasks + artifacts) |

### Messages

Send messages to an agent (synchronous send + SSE stream).

| Verb | Path | Operation | Summary |
|---|---|---|---|
| POST | `/v1/agents/{agentId}/messages/send` | `sendMessage` | Send a message to an agent (A2A, non-streaming) |
| POST | `/v1/agents/{agentId}/messages/stream` | `streamMessage` | Stream an agent reply via SSE (A2A) |

### Tasks

Async task lifecycle (list, fetch, cancel, resolve, subscribe).

| Verb | Path | Operation | Summary |
|---|---|---|---|
| GET | `/v1/agents/{agentId}/tasks` | `listTasks` | List tasks for an agent |
| GET | `/v1/agents/{agentId}/tasks/{taskId}` | `getTask` | Get a single task by ID |
| POST | `/v1/agents/{agentId}/tasks/{taskId}/cancel` | `cancelTask` | Cancel a running task (A2A) |
| POST | `/v1/agents/{agentId}/tasks/{taskId}/resolve` | `resolveTask` | Resolve a pending HITL approval (external approver) |
| GET | `/v1/agents/{agentId}/tasks/{taskId}/subscribe` | `getTaskSnapshot` | Get a task snapshot (A2A subscribe - non-streaming) |

### Artifacts

Generated artifacts (files, code, content) attached to a task.

| Verb | Path | Operation | Summary |
|---|---|---|---|
| GET | `/v1/artifacts` | `listArtifacts` | List artifacts owned by the caller |
| GET | `/v1/artifacts/{artifactId}` | `getArtifact` | Get an artifact (with current version content) |
| PATCH | `/v1/artifacts/{artifactId}` | `updateArtifact` | Update artifact content (full replace OR line patches) |
| DELETE | `/v1/artifacts/{artifactId}` | `deleteArtifact` | Delete an artifact and all of its versions |

### Shares

Conversation, message, and artifact share-link snapshots.

| Verb | Path | Operation | Summary |
|---|---|---|---|
| POST | `/v1/agents/{agentId}/conversations/{contextId}/share` | `createConversationShare` | Create a share snapshot of a conversation or single message |
| POST | `/v1/artifacts/{artifactId}/shares` | `createArtifactShare` | Create (or refresh) a share for an artifact |
| GET | `/v1/shares` | `listShares` | List shares created by the caller |
| GET | `/v1/shares/{shareId}` | `getShare` | Get a share owned by the caller |
| DELETE | `/v1/shares/{shareId}` | `deleteShare` | Delete a share owned by the caller |
| GET | `/v1/shared/{shareId}` | `getSharedConversation` | Public-facing share viewer (auth-required) |

### A2A

Agent-to-agent JSON-RPC 2.0 gateway (well-known agent.json + RPC).

| Verb | Path | Operation | Summary |
|---|---|---|---|
| GET | `/v1/a2a` | `legacyA2aTaskSnapshot` | Legacy A2A gateway - task snapshot dispatch (GET) |
| POST | `/v1/a2a` | `legacyAgentToAgentCall` | Legacy A2A gateway - JSON-RPC 2.0 dispatch (POST) |
| GET | `/v1/agents/{agentId}/a2a` | `agentTaskSnapshotA2a` | A2A task snapshot (per-agent, GET) |
| POST | `/v1/agents/{agentId}/a2a` | `agentToAgentCall` | A2A JSON-RPC 2.0 dispatch (per-agent) |
| GET | `/v1/agents/{agentId}/.well-known/agent.json` | `getAgentCard` | A2A discovery card (.well-known/agent.json) |
| GET | `/v1/agents/{agentId}/extendedAgentCard` | `getExtendedAgentCard` | A2A extended card (full agent config) |

### Tools

Per-agent tool catalogue (system tools, MCP servers, function tools).

| Verb | Path | Operation | Summary |
|---|---|---|---|
| GET | `/v1/agents/{agentId}/tools` | `listAgentTools` | List the tools attached to an agent |
| POST | `/v1/agents/{agentId}/tools` | `addAgentTool` | Attach a tool to an agent |
| GET | `/v1/agents/{agentId}/tools/{toolId}` | `getAgentTool` | Get a single tool from an agent |
| DELETE | `/v1/agents/{agentId}/tools/{toolId}` | `removeAgentTool` | Remove a tool from an agent |

### Retention

Per-agent and org-wide conversation retention policies.

| Verb | Path | Operation | Summary |
|---|---|---|---|
| GET | `/v1/agents/{agentId}/retention` | `getAgentRetention` | Get an agent's retention policy |
| PUT | `/v1/agents/{agentId}/retention` | `updateAgentRetention` | Upsert an agent retention policy |
| DELETE | `/v1/agents/{agentId}/retention` | `deleteAgentRetention` | Delete the agent-level retention policy (revert to org/defaults) |
| GET | `/v1/orgs/{orgSlug}/retention` | `getOrgRetention` | Get the org-level retention policy |
| PUT | `/v1/orgs/{orgSlug}/retention` | `updateOrgRetention` | Upsert the org-level retention policy |

### Evaluations

Agent evaluation runs and results.

| Verb | Path | Operation | Summary |
|---|---|---|---|
| GET | `/v1/agents/{agentId}/evaluations` | `listEvaluations` | List or fetch an evaluation |
| POST | `/v1/agents/{agentId}/evaluations` | `runEvaluation` | Start a new evaluation run |
