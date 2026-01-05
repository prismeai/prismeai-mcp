# Prisme.ai Products Overview

## Architecture

```
+----------------------------------+
|      Gen.AI Platform Layer       |
|  (Products, Agents, Interfaces)  |
+----------------------------------+
|      Language Models Layer       |
|  (OpenAI, Bedrock, Vertex, etc.) |
+----------------------------------+
|   Cloud & Infrastructure Layer   |
|    (GCP, AWS, Azure, On-Prem)    |
+----------------------------------+
```

---

## Products

| Product | Purpose | Level |
|---------|---------|-------|
| SecureChat | Enterprise chat | None |
| Store | Agent marketplace | None/Low-Med |
| Knowledge | RAG management | Low-Med |
| Builder | Workflow orchestration | Med-High |
| Collection | Tabular data + AI | Low-Med |
| Governance | Platform admin | Medium |
| Insights | Conversation analytics | Low-Med |

---

## SecureChat

Secure enterprise conversational interface.

**Features:** Multi-LLM, Document processing (PDF/Word/Excel/PPT/OCR), Canvas collaboration, Multimodal, Conversation history, E2E encryption, Agent integration

**Users:** All employees

**Integrations:** Store (agents), Knowledge (KBs), Governance (policies), Insights (monitoring)

---

## Store

Agent marketplace for discovering, deploying, sharing agents.

**Features:** Agent catalog, No-code creation, Customization, Multi-deployment (Web/Widget/Mobile/API), Version control

### Agent Types
| Type | Complexity | Use |
|------|------------|-----|
| Simple Prompting | Low | Q&A, content |
| RAG | Medium | Document-grounded |
| Tool-Using | Med-High | External integrations |
| Multi-Agent | High | Complex workflows |

**Users:** All (consumers), Business (creators), Developers, IT

**Integrations:** SecureChat (access), Knowledge (power), Builder (advanced), Governance (manage), Insights (monitor)

---

## Knowledge

RAG (Retrieval Augmented Generation) management.

**Features:** KB creation, Multi-format ingestion, Semantic chunking, Vector embedding, RAG config, Agent testing (Manual/AI/Human/Webhook), Tool integration, Analytics

**Document Types:** PDF, DOCX, PPTX, XLSX, HTML, Images (OCR), Markdown, Code

**Users:** Knowledge managers, SMEs, Business, IT/Dev

**Integrations:** Store (deploy), SecureChat (query), Builder (webhooks), Collection (structured data), Insights (quality), Crawler (web content)

---

## Builder

Orchestration engine for custom AI apps.

### Components
| Component | Description |
|-----------|-------------|
| Workspaces | Event-driven environments |
| Blocks | Reusable UI components |
| Pages | Complete interfaces |
| Automations | Backend logic |
| Apps | Marketplace packages |

### Development
| Approach | Level | Use |
|----------|-------|-----|
| No-code | Low | Simple workflows |
| Low-code | Medium | Complex UIs |
| Full-code | High | Custom logic |

### Memory
| Scope | Persistence |
|-------|-------------|
| run | 60s |
| user | Persistent |
| session | 1mo/1h |
| global | Workspace-wide |
| socket | 6h |

**Integrations:** REST/GraphQL/SOAP, Databases, Webhooks, Cloud storage, Auth systems, Marketplace apps

**Users:** Developers, Technical business, IT

---

## Collection

Tabular data + natural language querying.

**Features:** Data upload (manual/Builder), AI enrichment (row-by-row), NL querying, Custom views, Builder integration, Token optimization, Collaboration

**Users:** Data analysts, BI, Product, Business

**Status:** Beta

---

## Governance

Platform monitoring, management, security.

**Features:** Centralized analytics, User/permission management, Workspace management, Observability (interactions/performance/cost), Templates, Branding, Languages, API monitoring

### Capabilities
| Category | Features |
|----------|----------|
| Analytics | Usage, trending, ranking |
| Security | RBAC, groups, audit |
| Operations | Lifecycle, templates, scaling |
| Customization | Branding, languages, defaults |

**Users:** IT admins, Compliance, AI ops, Leaders

---

## Insights

Conversation analysis and quality monitoring.

**Features:** Conversation analysis, LLM-as-judge evaluation, AI monitoring, Human review, Custom criteria, Compliance, Reporting, Token optimization

### Evaluation
| Dimension | Scale |
|-----------|-------|
| Response Quality | 0-2 |
| Context Quality | 0-2 |
| Hallucination | 0-2 |

**Users:** AI governance, CX, Compliance, Product

---

## Integration Patterns

### Knowledge-Powered Agents
```
Knowledge → Store → SecureChat → Insights → Governance
(create)   (deploy) (access)   (monitor)  (manage)
```

### Data-Driven Solutions
```
Collection → Builder → Store → Insights
(data)      (interface)(deploy)(track)
```

### Enterprise Deployment
```
Builder ↔ Knowledge ↔ Collection
    ↓          ↓          ↓
 Governance ← manages → Insights
```

### Custom RAG Pipeline
```
Crawler → Knowledge ←(webhook)→ Builder
              ↓
          Store → SecureChat
```

---

## Agent Comparison

| Feature | Simple | RAG | Tool | Multi-Agent |
|---------|--------|-----|------|-------------|
| Complexity | Low | Med | Med-High | High |
| Knowledge | None | Docs | APIs | Both |
| Actions | No | No | Yes | Yes |
| Created In | Store | Knowledge | Knowledge/Builder | Builder |

---

## Maturity Model

| Level | Products | Capability |
|-------|----------|------------|
| Deploy | SecureChat | Multi-LLM access |
| Transform | +Store +Knowledge | Specialized agents |
| Innovate | All | Multi-agent, DB, custom apps |

---

## Quick Reference

| Goal | Product |
|------|---------|
| Chat with AI | SecureChat |
| Find/share agents | Store |
| Connect docs to AI | Knowledge |
| Build workflows | Builder |
| Query tables with AI | Collection |
| Manage platform | Governance |
| Monitor quality | Insights |
| Extract web content | Crawler (Apps) |
| Custom logic | Custom Code (Apps) |
| Connect APIs | API Integration (Apps) |
