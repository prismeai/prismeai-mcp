# Agent Factory

Agent Factory is the one-product baseline for creating, configuring, publishing, running, and evaluating AI agents. It owns the agent lifecycle, A2A runtime, publishing/discovery, conversations, tasks, tools, artifacts, access bindings, and agent-level analytics.

**Workspace:** `agent-factory` (`6t5T1iC`)

## Replaces Legacy Concepts

| Legacy wording | Current wording |
|----------------|-----------------|
| AI Store agent marketplace | Agent Factory publishing/discovery plus SecureChat consumption |
| Agent equals AI Knowledge project | Agent Factory `agents` record with runtime config |
| AI Knowledge project runtime | Agent Factory `_agentic-loop` runtime |
| AI Knowledge RAG project | Storage vector store attached as `file_search` |
| Knowledge Client query / `genericQuery` | `POST /v1/agents/:agent_id/messages/send` or `/stream` |
| AI Knowledge tool loop | Agent Factory ReAct loop with system, `file_search`, MCP, and function tools |

## Core APIs

Base webhook path: `/workspaces/slug:agent-factory/webhooks`.

| Area | Endpoints |
|------|-----------|
| Agents | `GET/POST /v1/agents`, `GET/PATCH/DELETE /v1/agents/:agent_id`, `GET /v1/profiles` |
| Publishing | `POST /v1/agents/:agent_id/publish`, `/unpublish`, `/discard-draft`, `GET /v1/agents/discovery`, `POST /ratings` |
| Chat runtime | `POST /v1/agents/:agent_id/messages/send`, `POST /v1/agents/:agent_id/messages/stream` |
| A2A | `POST /v1/agents/:agent_id/a2a`, `GET /v1/agents/:agent_id/.well-known/agent.json`, `GET /.well-known/agent.json` |
| Tasks | `GET /tasks`, `GET /tasks/:task_id`, `POST /cancel`, `POST /resolve`, `GET /subscribe` |
| Tools | `GET/POST /v1/agents/:agent_id/tools`, `GET/DELETE /tools/:tool_id` |
| Access | `GET/POST /access`, `DELETE /access/revoke`, access request endpoints |
| Operations | Analytics, activity, retention, artifacts, shares, GDPR admin endpoints |

Important internal automations include `_agentic-loop`, `_agentic-init`, `_agentic-build-context`, `_agentic-react-loop`, `_llm-chat-completions`, `_route-tool`, `_execute-rag-tool`, `_guardrails`, `_load-long-term-memories`, `_stream-event`, and `_finalize-response`.

## Agent Profiles

Agent Factory profiles progress from simple assistants to orchestrators:

| Profile | Typical use |
|---------|-------------|
| `simple` | Single-turn or low-tooling assistant |
| `workflow` | Guided task execution |
| `agent_light` | Lightweight ReAct with limited tools |
| `agent_full` | ReAct with tools, memory, guardrails, HITL |
| `orchestrator` | Multi-agent delegation and planning |

## Product Relationships

| Workspace | Relationship |
|-----------|--------------|
| `storage` | Files, vector stores, crawler/indexing, `file_search`, file-status callbacks |
| `llm-gateway` | Chat completions, embeddings, model defaults/capabilities, LLM usage events |
| `capabilities` | Catalog for MCP/tools/capabilities used when attaching catalog-backed tools |
| `tools-memories` | Long-term memory recall/remember/forget |
| `tools-guardrails` | Input, output, and action guardrails |
| `ai-governance-v2` | API keys, membership checks, service accounts, permissions, event search |
| `ai-insights-v2` | Org and agent analytics fed by Agent Factory and LLM Gateway events |
| `agent-evaluations` | Test cases and LLM-as-judge runs against Agent Factory agents |

## Current Guidance

Use Agent Factory for agent runtime work.
