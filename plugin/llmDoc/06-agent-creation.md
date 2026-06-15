# Agent Creation & Prompt Engineering

Use Agent Factory as the baseline for agent creation, runtime configuration, publishing, tools, conversations, and evaluations.

## Agent Types

| Type | Complexity | Created In | Main integrations |
|------|------------|------------|-------------------|
| Simple prompting | Low | Agent Factory | LLM Gateway |
| RAG | Medium | Agent Factory | Storage vector store + `file_search` |
| Tool-using | Med-High | Agent Factory | Capabilities: MCP, function, skill, guardrail, memory |
| Multi-agent | High | Agent Factory | `sub_agent` capabilities and A2A |

## Prompt Anatomy

### 1. Role Definition

```text
You are a Customer Support Specialist for Acme Financial, with expertise in retirement accounts.
```

Use specific domain expertise, voice, authority, and user relationship.

### 2. Task Instructions

```text
Help users understand retirement products, troubleshoot accounts, and guide users on next steps.
```

Define actions, scope boundaries, priorities, and success criteria.

### 3. Response Guidelines

```text
When responding:
1. Keep answers concise and jargon-free.
2. Include required disclaimers.
3. Give a simple overview first, then details.
4. Summarize next steps at the end.
```

### 4. Constraints

```text
Limitations:
- No investment recommendations.
- No private pricing.
- No unpublished customer names.
- Escalate tax/legal advice to professionals.
```

### 5. Knowledge Context

For static facts, put stable context in instructions. For document-grounded answers, attach a Storage vector store as an Agent Factory `file_search` capability.

## RAG Agents

RAG agents use Storage vector stores and Agent Factory `file_search`.

Recommended flow:

1. Create a Storage vector store.
2. Add files or URLs with Storage APIs.
3. Wait for indexing status to complete.
4. Attach the vector store to the Agent Factory agent as `file_search`.
5. In the prompt, require citations and explicit uncertainty when no relevant source is found.

Example guidance:

```text
When answering with retrieved sources:
1. Use retrieved content as the source of truth.
2. Cite the source title or file name when available.
3. State clearly when the answer is not in the available sources.
4. Do not invent facts outside retrieved context.
```

## Tool-Using Agents

Tools are Agent Factory capabilities:

| Capability | Use |
|------------|-----|
| `file_search` | Query Storage vector stores |
| `mcp` | Call MCP servers through `tools/list` and `tools/call` |
| `function` | Call an HTTP endpoint with structured arguments |
| `skill` | Activate reusable instructions and tool hints |
| `guardrail` | Run input/output/action safety checks |
| `sub_agent` | Delegate to another Agent Factory agent |
| system memory | Remember, recall, and forget long-term user facts |

When using tools, define clear tool descriptions, narrow JSON schemas, failure behavior, and user-facing summaries.

## Prompt Library

Prompt Library exposes reusable prompt templates through MCP:

- `prompts/list` to browse templates.
- `prompts/get` to retrieve a template.
- `tools/call` with `prompt_library` to search by query, category, or name.

Prompt Library stores reusable prompt templates. Agent Factory owns agent runtime behavior.

## Testing

Use Agent Evaluations for reusable regression suites:

- Create test cases with input, expected output, criteria, and optional tags.
- Start evaluation runs against Agent Factory agents.
- Use LLM-as-judge scoring, tool assertions, and multi-turn cases when needed.
- Track regressions over time.

## Best Practices

| Practice | Description |
|----------|-------------|
| Version prompts | Export/import Agent Factory agents and keep prompt changes reviewable |
| Keep RAG scoped | Use Storage vector stores and metadata filters instead of broad generic retrieval |
| Use Capabilities | Register MCP, functions, skills, guardrails, and memory as explicit capabilities |
| Add guardrails | Use input, output, and action guardrails for risky workflows |
| Evaluate regularly | Use Agent Evaluations before publishing or changing production agents |
| Monitor quality | Use AI Insights v2 for conversation analytics and feedback trends |
| Govern access | Use AI Governance v2 for org IAM, API keys, and service accounts |

## Temperature Settings

| Purpose | Temperature | Rationale |
|---------|-------------|-----------|
| Factual | 0.0-0.3 | Deterministic |
| General | 0.3-0.7 | Balanced |
| Creative | 0.7-1.0 | Varied |
