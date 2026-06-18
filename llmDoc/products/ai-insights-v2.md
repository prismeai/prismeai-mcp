# AI Insights v2

AI Insights v2 is the analytics and intelligence layer for Agent Factory agents. It analyzes conversations, scores them against configurable criteria, stores insights, and rolls results into organization, agent, feedback, memory, graph, queue, and compliance views.

**Workspace:** `ai-insights-v2` (`lpqdxlN`)

## Core Concepts

- **Conversation analysis:** `_analyze-conversation` fetches a conversation from Agent Factory, formats messages and tool activity, calls LLM Gateway, parses JSON output, computes a weighted 0-100 score, upserts `insights`, and updates `conversation_status`.
- **Insights:** per-conversation summaries, topics, sentiment, resolution, key moments, custom evaluations, score, model usage, anonymization, and retention metadata.
- **Evaluation criteria:** defaults include resolution, clarity, accuracy, and sentiment; custom per-agent criteria are stored in evaluation templates.
- **Feedback:** `POST /v1/feedback` upserts a like/dislike record for a task/message with optional category and comment.
- **Compliance:** retention policies, GDPR request tracking, export/cleanup hooks, scheduled purge, PII detection/anonymization, and audit events.

## API Surface

| Area | APIs / automations |
|------|--------------------|
| Insights | `GET /v1/insights`, `GET /v1/insights/status?conversation_ids=...` |
| Analysis | `POST /v1/agents/:agent_id/analyze`, `_process-queue`, `_batch-analyze-inactive`, `_analyze-conversation` |
| Criteria | `GET/PUT /v1/agents/:agent_id/evaluation-criteria` |
| Feedback | `POST /v1/feedback`, `GET /v1/analytics/feedback` |
| Org analytics | `GET /v1/analytics/summary`, `/agents`, `/capacity`, `/queue-stats`, `/adoption` |
| Memory analytics | `GET /v1/analytics/memories`, `/memories/trends`, `/memories/topics`, `/memories/gaps` |
| Graph | `GET /v1/graph/agents`, `/clusters`, `/similar/:agent_id`, `/tools`, `/relationships` |
| Admin/private | `v1/admin/refresh-org-analytics`, `v1/export/by-user`, `v1/cleanup/by-user` |

## Relationships

Agent Factory is the source of agents and conversations. AI Governance v2 supplies active orgs and `search-events` for aggregation. LLM Gateway is used for analysis calls and token/cost event aggregation. `tools-memories` supplies memory counts, topics, gaps, and adoption signals.

## Current Scope

Document AI Insights v2 with evidence for Agent Factory conversation analytics, criteria, feedback, memory intelligence, graph views, queue views, and GDPR/retention controls.
