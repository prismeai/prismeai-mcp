# Prisme.ai Documentation

This MCP documentation uses the one-product architecture as the baseline. Product-specific legacy references are grouped under the dedicated legacy section.

## Core Documentation

| File | Content |
|------|---------|
| [01-automations.md](./01-automations.md) | Automations: triggers, instructions, expressions, patterns |
| [02-pages-blocks.md](./02-pages-blocks.md) | Pages & Blocks: UI components reference |
| [03-workspace-config.md](./03-workspace-config.md) | Workspace config, secrets, RBAC, one-product IAM notes |
| [04-advanced-features.md](./04-advanced-features.md) | Crawler, Custom Code, capabilities, RAG, LLM Gateway, events |
| [05-products-overview.md](./05-products-overview.md) | One-product architecture and integration patterns |
| [06-agent-creation.md](./06-agent-creation.md) | Agent Factory agent creation and prompt engineering |
| [07-api-selfhosting.md](./07-api-selfhosting.md) | REST/webhook API reference and self-hosting |

## One-Product Documentation

| File | Product |
|------|---------|
| [products/agent-factory.md](./products/agent-factory.md) | Agent Factory - agents, publishing, conversations, A2A runtime |
| [products/storage.md](./products/storage.md) | Knowledge (Storage) - files, vector stores, indexing, RAG search |
| [products/llm-gateway.md](./products/llm-gateway.md) | LLM Gateway - completions, embeddings, models, routing |
| [products/capabilities.md](./products/capabilities.md) | Capabilities - catalog for MCP, file search, functions, skills, guardrails |
| [products/agent-evaluations.md](./products/agent-evaluations.md) | Agent Evaluations - test cases, runs, LLM-as-judge |
| [products/ai-governance-v2.md](./products/ai-governance-v2.md) | AI Governance v2 - IAM, API keys, service accounts, observability |
| [products/ai-insights-v2.md](./products/ai-insights-v2.md) | AI Insights v2 - Agent Factory analytics, criteria, feedback, GDPR |
| [products/ai-collection-v3.md](./products/ai-collection-v3.md) | AI Collection v3 - structured data MCP tools for agents |
| [products/prompt-library.md](./products/prompt-library.md) | Prompt Library - MCP prompts and showcase catalog |
| [products/capability-workspaces.md](./products/capability-workspaces.md) | Capability workspaces - guardrails, memory, search, vector providers, connectors |
| [products/ai-builder.md](./products/ai-builder.md) | Builder - DSUL workspaces, automations, pages, apps |

## Legacy Documentation

Use legacy sections for work explicitly scoped to legacy product references.

| File | Legacy product |
|------|----------------|
| [legacy/products-overview.md](./legacy/products-overview.md) | Legacy product overview |
| [legacy/products/ai-securechat.md](./legacy/products/ai-securechat.md) | Legacy SecureChat page |
| [legacy/products/ai-store.md](./legacy/products/ai-store.md) | Legacy AI Store page |
| [legacy/products/ai-knowledge.md](./legacy/products/ai-knowledge.md) | Legacy AI Knowledge page |
| [legacy/products/ai-governance.md](./legacy/products/ai-governance.md) | Legacy AI Governance page |
| [legacy/products/ai-insights.md](./legacy/products/ai-insights.md) | Legacy AI Insights page |
| [legacy/products/ai-collection.md](./legacy/products/ai-collection.md) | Legacy AI Collection page |

## Quick Reference

### Documentation Sections

| Section | Use When |
|---------|----------|
| `products-overview` | Understanding the product architecture |
| `product-agent-factory` | Creating, publishing, running, and sharing agents |
| `product-storage` | Files, vector stores, document indexing, RAG search |
| `product-llm-gateway` | Direct model completions, embeddings, model catalog, routing |
| `product-capabilities` | Registering and attaching MCP, file search, functions, skills, guardrails |
| `product-agent-evaluations` | Regression suites, LLM-as-judge, test case runs |
| `product-governance-v2` | Org IAM, API keys, service accounts, observability |
| `product-insights-v2` | Agent Factory analytics, criteria, feedback, compliance |
| `product-collection-v3` | Structured data MCP tools for agents |
| `capability-workspaces` | Backing guardrail, memory, search, vector, and connector workspaces |
| `legacy-product-knowledge` | AI Knowledge project reference |
| `legacy-product-store` | AI Store flow reference |

### Current Product Map

| Goal | Current product / workspace |
|------|-----------------------------|
| Build, publish, and run agents | Agent Factory |
| Add documents and RAG | Knowledge (Storage) vector stores + Agent Factory `file_search` |
| Call models or embeddings directly | LLM Gateway |
| Attach tools and guardrails | Capabilities + backing capability workspaces |
| Test agents | Agent Evaluations |
| Manage org IAM and API access | AI Governance v2 |
| Analyze conversations and feedback | AI Insights v2 |
| Store/query structured agent data | AI Collection v3 |
| Reuse prompts | Prompt Library |
| Build custom DSUL apps | Builder |
