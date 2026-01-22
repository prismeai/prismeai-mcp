---
name: 04-workspace-edit
description: Use this skill when editing a Prisme.ai workspace (automations, pages, config). Guides through documentation reading, local editing, linting, and code review.
argument-hint: "[workspace-name] [description of changes]"
allowed-tools: Read, Grep, Glob, Edit, Write, Task, mcp__prisme-ai-builder__get_prisme_documentation, mcp__prisme-ai-builder__lint_doc, mcp__prisme-ai-builder__get_automation, mcp__prisme-ai-builder__search_events
---

# Prisme.ai Workspace Edit Process

You are editing a Prisme.ai workspace. Follow this structured process to ensure quality changes.

## Arguments

- **Workspace**: $ARGUMENTS (first word is workspace name, rest is change description)

---

## Phase 1: Documentation & Context Gathering

### 1.1 Read Core Documentation

Always start by reading relevant Prisme.ai documentation:

```
mcp__prisme-ai-builder__get_prisme_documentation(section: "automations")
```

### 1.2 Read Product-Specific Documentation (if applicable)

If the workspace or automation interacts with a specific product, read that product's documentation:

| Product | Section | Read When |
|---------|---------|-----------|
| SecureChat | `product-securechat` | Working with conversational interfaces |
| Store | `product-store` | Agent marketplace, AI Store integrations |
| Knowledge | `product-knowledge` | RAG, knowledge bases, `Knowledge Client` app |
| Builder | `product-builder` | Custom apps, orchestration, workspace imports |
| Governance | `product-governance` | Platform admin, RBAC, user management |
| Insights | `product-insights` | Conversation analytics, quality monitoring |
| Collection | `product-collection` | Tabular data, AI querying |

**Detection rules:**
- If automation imports `Knowledge Client` app → read `product-knowledge`
- If workspace is `ai-store` or imports Store app → read `product-store`
- If workspace is `ai-governance` → read `product-governance`
- If automation uses `fetch` to AIK endpoints → read `product-knowledge`
- If automation handles conversations → read `product-securechat`

### 1.3 Read Workspace-Config Documentation (if needed)

Read `workspace-config` section when working on:
- `security.yml` (RBAC rules)
- `index.yml` (workspace config)
- Secrets management
- Native events

### 1.4 Read Pages Documentation (if needed)

Read `pages-blocks` section when working on:
- Any file in `pages/` directory
- UI blocks configuration
- Form blocks, DataTable, Charts, etc.

### 1.5 Read Advanced Features (if needed)

Read `advanced-features` section when working on:
- Custom Code blocks (JavaScript)
- Web crawler configuration
- Tool-calling agents
- RAG pipeline configuration

---

## Phase 2: Local Workspace Analysis

### 2.1 Verify Local Workspace Exists

```
Glob: ./$WORKSPACE_NAME/index.yml
```

If found, read `index.yml` to get workspace ID and understand structure.

### 2.2 Read Relevant Automation Files

Before editing, read the files you plan to modify:

```
Read: ./$WORKSPACE_NAME/automations/*.yml
```

### 2.3 Check Imports

Read `imports/` folder to understand installed apps:

```
Glob: ./$WORKSPACE_NAME/imports/*.yml
```

If you see apps like:
- `Knowledge Client.yml` → The workspace communicates with AI Knowledge
- `Conversations Service.yml` → The workspace manages conversations
- `Custom Code.yml` → The workspace uses JavaScript execution

---

## Phase 3: Make Changes

### 3.1 Edit Automations Locally

Use the `Edit` or `Write` tools to modify YAML files in the local workspace folder.

**Key reminders:**
- Use `{{variable}}` only for simple variable substitution
- Use `{% expression %}` for math, functions, conditions
- Use `comment:` instruction, NOT YAML `#` comments between instructions
- Available functions: `lower()`, `upper()`, `json()`, `date()`, `rand()`, `round()`, `split()`, `join()`, `replace()`, `length()`, `keys()`, `values()`

### 3.2 Edit Pages Locally (if applicable)

Modify files in `./$WORKSPACE_NAME/pages/` directory.

---

## Phase 4: Validation

### 4.1 Run Lint Check

After editing, read the lint documentation to check for common mistakes:

```
mcp__prisme-ai-builder__lint_doc()
```

Review your changes against these rules.

### 4.2 Code Review

Launch the code-review agent to analyze changes:

```
Task(subagent_type: "general-purpose", prompt: "Review the changes made to the Prisme.ai workspace. Check for:
- YAML syntax errors
- Prisme.ai expression syntax ({{}} vs {% %})
- Missing error handling
- Security issues (exposed secrets, missing auth checks)
- Logic errors

Provide issues in format:
- 🔴 MAJOR: [issue] - Must fix before pushing
- 🟠 NEED_HUMAN: [issue] - Requires human decision
- 🟡 MINOR: [suggestion] - Nice to have")
```

### 4.3 Ticket Validation (if ticket provided)

If implementing from a ticket, run ticket-validator:

```
Task(subagent_type: "general-purpose", agent: "ticket-validator", prompt: "Validate implementation against ticket: [ticket path or content]")
```

---

## Phase 5: Resolution

### 5.1 Handle Review Results

- **🔴 MAJOR issues**: Fix immediately before proceeding
- **🟠 NEED_HUMAN issues**: Ask the user for guidance
- **🟡 MINOR issues**: Note them but don't block on them

### 5.2 Push Changes (when requested)

Only push when explicitly asked:

```
mcp__prisme-ai-builder__push_workspace(
  workspaceName: "workspace-name",
  path: "./workspace-folder",
  message: "short-msg"  # max 15 chars, no spaces
)
```

---

## Quick Reference: Documentation Sections

| Section | Content |
|---------|---------|
| `automations` | Triggers, instructions, expressions, patterns |
| `pages-blocks` | UI components reference |
| `workspace-config` | Secrets, RBAC, events, versioning |
| `advanced-features` | Crawler, custom code, tool agents, RAG |
| `products-overview` | Platform architecture summary |
| `agent-creation` | Prompt engineering, agent types |
| `api-selfhosting` | REST API, self-hosting |
| `product-securechat` | SecureChat product |
| `product-store` | Store/marketplace product |
| `product-knowledge` | Knowledge/RAG product |
| `product-builder` | Builder/orchestration product |
| `product-governance` | Governance/admin product |
| `product-insights` | Insights/analytics product |
| `product-collection` | Collection/tabular data product |
