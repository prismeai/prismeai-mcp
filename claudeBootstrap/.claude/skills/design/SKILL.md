---
name: design
description: Use this skill to create detailed specifications for a Prisme.ai feature or change. Gathers context from documentation and codebase, then clarifies requirements with the user.
argument-hint: "[workspace-name] [feature description]"
allowed-tools: Read, Write, Grep, Glob, Task, AskUserQuestion, mcp__prisme-ai-builder__get_prisme_documentation, mcp__prisme-ai-builder__get_automation, mcp__prisme-ai-builder__list_automations, mcp__prisme-ai-builder__search_events, mcp__prisme-ai-builder__get_app, mcp__prisme-ai-builder__list_apps
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

## Phase 3: Question Generation

Based on the documentation and codebase exploration, generate a comprehensive list of questions organized by category:

### 3.1 Question Categories

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

## Phase 4: Self-Answer Questions

### 4.1 Launch Parallel Research Agents by Topic

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

### 4.2 Aggregate and Categorize Answers

After all parallel agents complete, merge their results into:
- **Resolved**: Questions answered from documentation/codebase (include source)
- **Needs Human Input**: Questions requiring user decision (subjective, business logic, preferences)
- **Needs More Context**: Questions that need additional information

---

## Phase 5: User Clarification

### 5.1 Ask Remaining Questions

Use `AskUserQuestion` to clarify questions that:
- Require subjective decisions
- Involve business logic choices
- Have multiple valid approaches
- Cannot be answered from documentation

**Group questions by priority:**
1. **Blocking**: Must answer before any design work
2. **Important**: Affects major design decisions
3. **Nice-to-have**: Can assume defaults if not answered

### 5.2 Question Format

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

## Phase 6: Specification Output

After gathering all information, produce a specification document and save it as a ticket.

### 6.1 Feature Name Derivation

Derive a kebab-case feature name from the feature description:
- Remove common words (the, a, an, for, to, etc.)
- Convert to lowercase
- Replace spaces with hyphens
- Keep it concise (3-5 words max)

**Examples:**
- "Add user authentication flow" → `user-authentication-flow`
- "Fix the broken chat widget" → `fix-chat-widget`
- "Implement RAG search for documents" → `rag-document-search`

### 6.2 Create Ticket Directory

Create the specification file at:
```
./tickets/{featureName}/base-ticket.md
```

Use the `Write` tool to create the file with the specification content.

### 6.3 Specification Template

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

### 6.4 Save the Ticket

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
