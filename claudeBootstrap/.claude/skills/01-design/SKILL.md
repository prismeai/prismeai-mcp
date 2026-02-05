---
name: 01-design
description: Use this skill to create detailed specifications for a Prisme.ai feature or change. Gathers context from documentation and codebase, then clarifies requirements with the user.
argument-hint: "[workspace-name] [feature description]"
allowed-tools: Read, Write, Grep, Glob, Task, AskUserQuestion, WebSearch, WebFetch, mcp__prisme-ai-builder__get_prisme_documentation, mcp__prisme-ai-builder__get_automation, mcp__prisme-ai-builder__list_automations, mcp__prisme-ai-builder__search_events, mcp__prisme-ai-builder__get_app, mcp__prisme-ai-builder__list_apps
---

# Prisme.ai Specification Design Process

You are designing specifications for a Prisme.ai feature. Follow this structured process to gather context, understand constraints, and clarify requirements before implementation.

## Arguments

- **Input**: $ARGUMENTS (first word is workspace name, rest is feature description)

---

## Phase 1: Documentation Gathering (Parallel)

Read ALL potentially relevant Prisme.ai documentation sections **in parallel** to understand platform capabilities and constraints.

### 1.1 Launch Parallel Documentation Reads

Execute these tool calls in a **single message** to read in parallel:

```
mcp__prisme-ai-builder__get_prisme_documentation(section: "automations")
mcp__prisme-ai-builder__get_prisme_documentation(section: "pages-blocks")
mcp__prisme-ai-builder__get_prisme_documentation(section: "workspace-config")
mcp__prisme-ai-builder__get_prisme_documentation(section: "advanced-features")
mcp__prisme-ai-builder__get_prisme_documentation(section: "products-overview")
mcp__prisme-ai-builder__get_prisme_documentation(section: "agent-creation")
```

### 1.2 Read Product-Specific Docs (Based on Context)

If the feature involves specific products, also read in parallel:

| Keyword in Request | Documentation to Read |
|--------------------|----------------------|
| chat, conversation, message | `product-securechat`, `product-store` |
| knowledge, RAG, documents, search | `product-knowledge` |
| agent, marketplace, store | `product-store` |
| admin, users, permissions, RBAC | `product-governance` |
| analytics, insights, quality | `product-insights` |
| data, table, collection | `product-collection` |
| app, import, build | `product-builder` |

---

## Phase 2: Workspace Exploration

### 2.1 Check for Local Workspace

First, determine if the workspace exists locally:

```
Glob: ./$WORKSPACE_NAME/index.yml
```

### 2.2a If Local Workspace EXISTS

Launch an **Explore agent** to understand the local codebase:

```
Task(
  subagent_type: "Explore",
  prompt: "Explore the Prisme.ai workspace at ./$WORKSPACE_NAME/ to understand:

  1. **Workspace structure**: Read index.yml to understand config and imports
  2. **Existing automations**: List and summarize automations in ./automations/
  3. **Pages**: List and summarize pages in ./pages/
  4. **Imports/Apps**: Check ./imports/ for installed apps and their configuration
  5. **Security rules**: Read security.yml if exists

  For the feature: [FEATURE DESCRIPTION]

  Identify:
  - Existing automations that might be affected or reused
  - Patterns and conventions used in this workspace
  - Installed apps that could be leveraged
  - Potential integration points

  Return a structured summary of findings relevant to the feature."
)
```

### 2.2b If NO Local Workspace

Launch an **Explore agent** with MCP tools to inspect remote workspace:

```
Task(
  subagent_type: "Explore",
  prompt: "Explore the remote Prisme.ai workspace to understand its structure.

  **Environment**: sandbox (or as specified)
  **Workspace**: $WORKSPACE_NAME

  Use these MCP tools:
  - mcp__prisme-ai-builder__list_automations(workspaceName: '$WORKSPACE_NAME', environment: 'sandbox')
  - mcp__prisme-ai-builder__get_automation(workspaceName: '$WORKSPACE_NAME', automationSlug: '...', environment: 'sandbox')

  For the feature: [FEATURE DESCRIPTION]

  Identify:
  - Existing automations that might be affected or reused
  - Patterns in automation naming and structure
  - Potential integration points

  Return a structured summary of findings relevant to the feature."
)
```

---

## Phase 3: External Research (Web Search)

Research design patterns, existing solutions, and real-world examples from the web and GitHub to inform the specification.

### 3.1 Identify Research Topics

Based on the feature description, identify 3-5 key research topics:
- Core technical challenge (e.g., "real-time sync", "RAG pipeline", "user authentication")
- Industry patterns for similar features
- Open-source implementations

### 3.2 Search for Design Patterns

Use `WebSearch` to find established design patterns:

```
WebSearch(query: "[CORE TECHNICAL CHALLENGE] design pattern best practices 2026")
WebSearch(query: "[FEATURE TYPE] architecture pattern")
```

**Examples:**
- "event-driven automation design pattern best practices 2026"
- "RAG pipeline architecture pattern"
- "human-in-the-loop workflow design pattern"

### 3.3 Search for Existing Frameworks & Solutions

Research existing tools and libraries that solve similar problems:

```
WebSearch(query: "[FEATURE DESCRIPTION] library framework comparison 2026")
WebSearch(query: "[TECHNOLOGY AREA] open source tools")
```

**Examples:**
- "workflow automation library framework comparison 2026"
- "document processing RAG open source tools"
- "conversational AI framework comparison"

### 3.4 Search GitHub for Examples

Search GitHub for real-world implementations:

```
WebSearch(query: "site:github.com [FEATURE KEYWORDS] implementation")
WebSearch(query: "github [TECHNOLOGY] [PATTERN] example repository")
```

**Examples:**
- "site:github.com webhook retry mechanism implementation"
- "github langchain RAG pipeline example repository"
- "site:github.com human approval workflow automation"

### 3.5 Search for Reference Files

Search for key technical files that inform the specification. Based on the feature context, search for relevant file types:

#### A. API Specifications (REST/HTTP)

**When:** Feature involves REST APIs, webhooks, or HTTP integrations

```
WebSearch(query: "[SERVICE NAME] API swagger openapi specification")
WebSearch(query: "site:github.com [SERVICE NAME] openapi.yaml OR swagger.json")
```

**File types:** `openapi.yaml`, `openapi.json`, `swagger.json`, `swagger.yaml`

#### B. GraphQL Schemas

**When:** Feature involves GraphQL APIs

```
WebSearch(query: "[SERVICE NAME] GraphQL schema SDL")
WebSearch(query: "site:github.com [SERVICE NAME] schema.graphql")
```

**File types:** `schema.graphql`, `*.graphqls`, `schema.gql`

#### C. Event/Message Schemas (AsyncAPI)

**When:** Feature involves event-driven architecture, message queues, webhooks

```
WebSearch(query: "[SERVICE NAME] AsyncAPI specification")
WebSearch(query: "site:github.com [SERVICE NAME] asyncapi.yaml webhook schema")
```

**File types:** `asyncapi.yaml`, `asyncapi.json`

#### D. Data Schemas & Types

**When:** Feature involves data models, validation, or type definitions

```
WebSearch(query: "[SERVICE NAME] JSON schema validation")
WebSearch(query: "site:github.com [SERVICE NAME] types.ts OR interfaces.ts")
WebSearch(query: "[SERVICE NAME] data model schema")
```

**File types:** `schema.json` (JSON Schema), `types.ts`, `interfaces.ts`, `*.prisma`, `*.proto` (Protocol Buffers)

#### E. Database Schemas & Migrations

**When:** Feature involves data persistence or database design

```
WebSearch(query: "[TECHNOLOGY] [FEATURE] database schema design")
WebSearch(query: "site:github.com [PROJECT] migrations OR schema.sql")
```

**File types:** `schema.sql`, `schema.prisma`, `migrations/*.sql`, `*.entity.ts`

#### F. Configuration Templates

**When:** Feature requires environment setup or configuration

```
WebSearch(query: "[SERVICE NAME] configuration example")
WebSearch(query: "site:github.com [SERVICE NAME] .env.example OR config.yaml")
```

**File types:** `.env.example`, `config.example.yaml`, `docker-compose.yml`, `values.yaml` (Helm)

#### G. SDK Examples & Code Samples

**When:** Feature integrates with external services that provide SDKs

```
WebSearch(query: "[SERVICE NAME] SDK [LANGUAGE] example")
WebSearch(query: "site:github.com [SERVICE NAME] examples OR samples")
```

**File types:** Code samples in target language, `examples/` directories

#### H. API Collection Files

**When:** Feature involves API testing or complex API workflows

```
WebSearch(query: "[SERVICE NAME] Postman collection")
WebSearch(query: "site:github.com [SERVICE NAME] postman_collection.json")
```

**File types:** `*.postman_collection.json`, `insomnia.json`, `bruno/`

#### I. Architecture Diagrams

**When:** Feature involves complex system design

```
WebSearch(query: "[PATTERN/TECHNOLOGY] architecture diagram")
WebSearch(query: "site:github.com [PROJECT] architecture.md OR diagrams")
```

**File types:** `*.mermaid`, `*.puml` (PlantUML), `*.drawio`, `architecture.md`

---

**Retrieve spec files from official docs:**
```
WebFetch(
  url: "[API DOCS URL]",
  prompt: "Find links to specification files: OpenAPI/Swagger, GraphQL schema, AsyncAPI, JSON Schema, Postman collections, or SDK downloads. Return the direct URLs to these files."
)
```

### 3.6 Deep Dive with WebFetch

For promising results, use `WebFetch` to extract detailed information:

```
WebFetch(
  url: "[URL FROM SEARCH RESULTS]",
  prompt: "Extract the key design decisions, architecture patterns, and implementation details relevant to [FEATURE DESCRIPTION]. Focus on:
  - Architecture choices and rationale
  - Error handling approaches
  - Edge cases addressed
  - Trade-offs mentioned"
)
```

### 3.7 Synthesize Research Findings

After completing web research, create a summary:

| Topic | Finding | Source | Relevance to Feature |
|-------|---------|--------|---------------------|
| Design Pattern | [key insight] | [URL] | [how it applies] |
| Framework | [capability] | [URL] | [potential use] |
| GitHub Example | [implementation detail] | [URL] | [what to adopt] |

**Important considerations:**
- Note any licensing constraints from open-source projects
- Identify patterns that align with Prisme.ai's architecture
- Flag approaches that conflict with platform limitations

---

## Phase 4: Question Generation

Based on the documentation, codebase exploration, and external research, generate a comprehensive list of questions organized by category:

### 4.1 Question Categories

**A. Functional Requirements**
- What exactly should this feature do?
- What are the inputs and expected outputs?
- What are the success criteria?

**B. Technical Constraints**
- Which Prisme.ai capabilities apply? (automations, pages, custom code, etc.)
- Are there platform limitations to consider?
- Which existing automations/pages need modification?

**C. Integration Points**
- Does this integrate with other products? (AIK, AIS, etc.)
- Are external APIs involved?
- What events should be emitted/listened to?

**D. User Experience**
- Who is the target user?
- What should the UI look like? (if applicable)
- What error messages should be shown?

**E. Edge Cases & Error Handling**
- What happens when things go wrong?
- What are the boundary conditions?
- How should invalid input be handled?

**F. Security & Permissions**
- Who should have access?
- Are there RBAC rules needed?
- Is sensitive data involved?

**G. Ambiguous Requirements**
- What aspects are open to interpretation?
- What design decisions need human input?

---

## Phase 5: Self-Answer Questions

### 5.1 Launch Parallel Research Agents by Topic

Group your questions by topic and launch **multiple Explore agents in parallel** (in a single message) to research answers concurrently:

```
// Launch ALL these agents in a SINGLE message for parallel execution:

Task(
  subagent_type: "Explore",
  prompt: "Research FUNCTIONAL REQUIREMENTS for: [FEATURE DESCRIPTION]

  Questions:
  - [Functional question 1]
  - [Functional question 2]
  ...

  Use Prisme.ai docs, local workspace files, and existing automation patterns.

  For each question, return:
  - ANSWERED: [answer with source]
  - NEEDS_HUMAN: [reason]
  - UNCLEAR: [what's missing]"
)

Task(
  subagent_type: "Explore",
  prompt: "Research TECHNICAL CONSTRAINTS for: [FEATURE DESCRIPTION]

  Questions:
  - [Technical question 1]
  - [Technical question 2]
  ...

  Focus on Prisme.ai platform capabilities, limitations, and existing patterns.

  For each question, return:
  - ANSWERED: [answer with source]
  - NEEDS_HUMAN: [reason]
  - UNCLEAR: [what's missing]"
)

Task(
  subagent_type: "Explore",
  prompt: "Research INTEGRATION POINTS for: [FEATURE DESCRIPTION]

  Questions:
  - [Integration question 1]
  - [Integration question 2]
  ...

  Check existing automations, events, apps, and external API patterns.

  For each question, return:
  - ANSWERED: [answer with source]
  - NEEDS_HUMAN: [reason]
  - UNCLEAR: [what's missing]"
)

Task(
  subagent_type: "Explore",
  prompt: "Research UX & ERROR HANDLING for: [FEATURE DESCRIPTION]

  Questions:
  - [UX question 1]
  - [Error handling question 1]
  ...

  Look at existing pages, error patterns, and user-facing conventions.

  For each question, return:
  - ANSWERED: [answer with source]
  - NEEDS_HUMAN: [reason]
  - UNCLEAR: [what's missing]"
)

Task(
  subagent_type: "Explore",
  prompt: "Research SECURITY & PERMISSIONS for: [FEATURE DESCRIPTION]

  Questions:
  - [Security question 1]
  - [Permission question 1]
  ...

  Check security.yml patterns, RBAC rules, and sensitive data handling.

  For each question, return:
  - ANSWERED: [answer with source]
  - NEEDS_HUMAN: [reason]
  - UNCLEAR: [what's missing]"
)
```

**Important**: Only launch agents for topics that have questions. Skip empty categories.

### 5.2 Aggregate and Categorize Answers

After all parallel agents complete, merge their results into:
- **Resolved**: Questions answered from documentation/codebase (include source)
- **Needs Human Input**: Questions requiring user decision (subjective, business logic, preferences)
- **Needs More Context**: Questions that need additional information

---

## Phase 6: User Clarification

### 6.1 Ask Remaining Questions

Use `AskUserQuestion` to clarify questions that:
- Require subjective decisions
- Involve business logic choices
- Have multiple valid approaches
- Cannot be answered from documentation

**Group questions by priority:**
1. **Blocking**: Must answer before any design work
2. **Important**: Affects major design decisions
3. **Nice-to-have**: Can assume defaults if not answered

### 6.2 Question Format

When asking the user, structure questions as:

```
AskUserQuestion(
  questions: [
    {
      question: "What should happen when [scenario]?",
      header: "Error handling",
      options: [
        { label: "Option A", description: "Description of approach A" },
        { label: "Option B", description: "Description of approach B" },
        { label: "Option C", description: "Description of approach C" }
      ],
      multiSelect: false
    }
  ]
)
```

**Best practices:**
- Provide concrete options when possible (not just open-ended)
- Include a recommended option with "(Recommended)" suffix
- Group related questions together
- Limit to 4 questions per AskUserQuestion call

---

## Phase 7: Specification Output

After gathering all information, produce a specification document and save it as a ticket.

### 7.1 Feature Name Derivation

Derive a kebab-case feature name from the feature description:
- Remove common words (the, a, an, for, to, etc.)
- Convert to lowercase
- Replace spaces with hyphens
- Keep it concise (3-5 words max)

**Examples:**
- "Add user authentication flow" → `user-authentication-flow`
- "Fix the broken chat widget" → `fix-chat-widget`
- "Implement RAG search for documents" → `rag-document-search`

### 7.2 Create Ticket Directory

Create the specification file at:
```
./tickets/{featureName}/base-ticket.md
```

Use the `Write` tool to create the file with the specification content.

### 7.3 Import Reference Files (If Relevant)

Import useful reference files found during research to the ticket folder. This provides implementation context and ensures specs are versioned with the ticket.

#### Folder Structure

```
./tickets/{featureName}/
├── base-ticket.md
└── refs/
    ├── api/           # API specifications
    ├── schemas/       # Data schemas & types
    ├── config/        # Configuration templates
    ├── examples/      # Code samples & SDK examples
    └── docs/          # Architecture docs & diagrams
```

#### Download & Save Process

1. **Download the file** using WebFetch:
```
WebFetch(
  url: "[FILE URL]",
  prompt: "Return the complete raw content of this file. Do not summarize or modify it. Preserve exact formatting."
)
```

2. **Save to appropriate subfolder:**
```
Write(
  file_path: "./tickets/{featureName}/refs/{category}/{filename}",
  content: "[RAW CONTENT]"
)
```

#### File Type Reference

| Category | File Types | Folder | Naming Convention |
|----------|-----------|--------|-------------------|
| REST API | OpenAPI, Swagger | `refs/api/` | `{service}-openapi.yaml`, `{service}-swagger.json` |
| GraphQL | Schema SDL | `refs/api/` | `{service}-schema.graphql` |
| AsyncAPI | Event specs | `refs/api/` | `{service}-asyncapi.yaml` |
| JSON Schema | Validation schemas | `refs/schemas/` | `{entity}-schema.json` |
| TypeScript | Type definitions | `refs/schemas/` | `{service}-types.ts` |
| Protobuf | gRPC definitions | `refs/schemas/` | `{service}.proto` |
| Database | SQL schemas | `refs/schemas/` | `{service}-schema.sql`, `schema.prisma` |
| Config | Env templates | `refs/config/` | `.env.example`, `config.example.yaml` |
| Docker | Compose files | `refs/config/` | `docker-compose.yml` |
| Postman | Collections | `refs/examples/` | `{service}.postman_collection.json` |
| Code | SDK samples | `refs/examples/` | `{language}-example.{ext}` |
| Diagrams | Architecture | `refs/docs/` | `architecture.md`, `flow.mermaid` |

#### Priority Rules

**Always import (high value):**
- OpenAPI/Swagger specs for APIs you'll integrate with
- AsyncAPI specs for webhook/event payloads
- JSON Schema for data validation requirements
- Type definitions (TypeScript interfaces)

**Import if useful:**
- Configuration templates (understand required setup)
- Postman collections (test cases and examples)
- Database schemas (data model reference)
- Architecture diagrams (system context)

**Skip (link instead):**
- Files larger than 500KB
- Entire SDK repositories (link to specific files)
- Files already in the local codebase
- Redundant specs (e.g., both OpenAPI 2 and 3 for same API)

#### Create a refs/index.md

After importing files, create an index:

```
Write(
  file_path: "./tickets/{featureName}/refs/index.md",
  content: "# Reference Files\n\n| File | Type | Source | Purpose |\n|------|------|--------|---------|..."
)
```

### 7.4 Specification Template

```markdown
# Specification: [Feature Name]

## Overview
[1-2 sentence summary]

## Workspace
- **Name**: [workspace name]
- **Environment**: [sandbox/prod]
- **Local path**: [path or "remote only"]

## Requirements

### Functional Requirements
- [ ] [Requirement 1]
- [ ] [Requirement 2]

### Non-Functional Requirements
- [ ] [Performance, security, etc.]

## Technical Design

### Automation Naming (DSUL)

**Convention**: Slug is camelCase only, Name uses `/` for folder scoping.

| Automation | Slug (camelCase) | Name (folder-scoped) | Description |
|------------|------------------|----------------------|-------------|
| [description] | `exampleSlug` | `folder/path/exampleSlug` | [what it does] |

### Automations to Create/Modify
| Automation | Action | Description |
|------------|--------|-------------|
| [name] | CREATE/MODIFY | [what it does] |

### Pages to Create/Modify
| Page | Action | Description |
|------|--------|-------------|
| [name] | CREATE/MODIFY | [what it shows] |

### Events
| Event | Emitted By | Listened By |
|-------|------------|-------------|
| [event.name] | [automation] | [automation] |

### Dependencies
- Apps: [list of apps to import]
- External APIs: [list]

## Reference Files

See `./refs/index.md` for full listing.

### API Specifications
| API | File | Type | Key Endpoints |
|-----|------|------|---------------|
| [service] | `refs/api/{file}` | OpenAPI 3.x | [relevant endpoints] |

### Data Schemas
| Schema | File | Purpose |
|--------|------|---------|
| [entity] | `refs/schemas/{file}` | [validation/types for what] |

### Configuration
| Config | File | Purpose |
|--------|------|---------|
| [service] | `refs/config/{file}` | [what it configures] |

### Code Examples
| Example | File | Language | Demonstrates |
|---------|------|----------|--------------|
| [name] | `refs/examples/{file}` | [lang] | [what it shows] |

## External Research

### Design Patterns
| Pattern | Source | Application |
|---------|--------|-------------|
| [pattern name] | [URL] | [how it applies] |

### Reference Implementations
| Project/Framework | Source | Key Insights |
|-------------------|--------|--------------|
| [name] | [URL] | [relevant learnings] |

## User Decisions
| Question | Decision | Rationale |
|----------|----------|-----------|
| [question] | [user's answer] | [why] |

## Edge Cases
| Scenario | Handling |
|----------|----------|
| [case] | [how to handle] |

## Out of Scope
- [What this feature does NOT include]

## Open Questions
- [Any remaining uncertainties]
```

### 7.5 Save the Ticket

After generating the specification, save it using the Write tool:

```
Write(
  file_path: "./tickets/{featureName}/base-ticket.md",
  content: "[FULL SPECIFICATION CONTENT]"
)
```

**Output to user:**
- Confirm the ticket was created
- Show the file path: `./tickets/{featureName}/base-ticket.md`
- Provide a brief summary of next steps (e.g., "Use /gitlab-ticket to create implementation tasks")

---

## Quick Reference: Documentation Sections

| Section | When to Read |
|---------|-------------|
| `automations` | Always - core building block |
| `pages-blocks` | UI work, forms, data display |
| `workspace-config` | Security, RBAC, secrets |
| `advanced-features` | Custom code, crawlers, RAG |
| `products-overview` | Multi-product integration |
| `agent-creation` | AI agent features |
| `product-securechat` | Chat interfaces |
| `product-store` | Agent marketplace |
| `product-knowledge` | RAG, knowledge bases |
| `product-builder` | Apps, orchestration |
| `product-governance` | Admin, permissions |
| `product-insights` | Analytics |
| `product-collection` | Tabular data |
