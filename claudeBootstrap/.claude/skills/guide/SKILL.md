---
name: guide
description: Explains the full Prisme.ai development workflow from idea to implementation. Use this when starting a new feature or when unsure which skill to use.
argument-hint: "[optional: workspace-name]"
allowed-tools: Read, AskUserQuestion
---

# Prisme.ai Development Guide

This guide explains the full development workflow for Prisme.ai workspaces. Follow these phases in order for best results.

## Arguments

- **Workspace** (optional): $ARGUMENTS

---

## Development Workflow Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     DEVELOPMENT WORKFLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   1. DESIGN          ──▶   Gather context, create spec          │
│      /design                                                    │
│           │                                                     │
│           ▼                                                     │
│   2. TICKET          ──▶   Create GitLab ticket with tests      │
│      /gitlab-ticket                                             │
│           │                                                     │
│           ▼                                                     │
│   3. REVIEW          ──▶   Human reviews conception             │
│      (manual)              Approve / Request changes            │
│           │                                                     │
│           ▼                                                     │
│   4. IMPLEMENT       ──▶   Edit workspace, run validations      │
│      /workspace-edit                                            │
│           │                                                     │
│           ▼                                                     │
│   5. DONE            ──▶   Push changes, close ticket           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Design (`/design`)

**Purpose**: Understand requirements, explore codebase, clarify with user.

**When to use**: Starting a new feature or significant change.

**What it does**:
1. Reads all relevant Prisme.ai documentation in parallel
2. Explores local workspace (or remote via MCP if no local)
3. Generates questions about requirements
4. Self-answers questions from docs/code
5. Asks user remaining questions
6. Produces a specification document

**Command**:
```
/design [workspace-name] [feature description]
```

**Example**:
```
/design ai-governance add bulk user import with CSV upload
```

**Output**: Specification document with requirements, technical design, events, dependencies.

**Exit criteria**: Clear spec approved by user before proceeding.

---

## Phase 2: GitLab Ticket (`/gitlab-ticket`)

**Purpose**: Create a trackable, testable ticket for the work.

**When to use**: After design is approved, before implementation.

**What it does**:
1. Takes spec from Phase 1 (or description)
2. Asks about UI flow (always)
3. Drafts implementation steps
4. Drafts test checklist
5. Presents checklist to user for validation
6. Generates GitLab-ready markdown

**Command**:
```
/gitlab-ticket [feature description or spec file path]
```

**Example**:
```
/gitlab-ticket specs/bulk-user-import.md
```

**Output**: GitLab ticket markdown with:
- Summary & Context
- Implementation steps (checkbox list)
- Test checklist (API + UI tests)
- Acceptance criteria

**Exit criteria**: Ticket created in GitLab, assigned, ready for implementation.

---

## Phase 3: Conception Review (Manual)

**Purpose**: Human validation before coding begins.

**When to use**: After ticket is created, before implementation.

**What to review**:

### Checklist for Reviewer

- [ ] **Requirements complete?** - All user needs captured?
- [ ] **Technical approach sound?** - Right tools/patterns chosen?
- [ ] **Scope appropriate?** - Not over/under-engineered?
- [ ] **Tests sufficient?** - Happy path + edge cases covered?
- [ ] **Dependencies identified?** - All integrations listed?
- [ ] **Security considered?** - RBAC, data exposure, input validation?
- [ ] **Timeline realistic?** - Complexity matches expectations?

### Possible Outcomes

| Outcome | Action |
|---------|--------|
| **Approved** | Proceed to Phase 4 |
| **Minor changes** | Update ticket, proceed |
| **Major concerns** | Return to Phase 1 (/design) |
| **Rejected** | Archive, document why |

**Exit criteria**: Explicit approval from reviewer to proceed.

---

## Phase 4: Implementation (`/workspace-edit`)

**Purpose**: Make the actual code changes.

**When to use**: After conception is approved.

**What it does**:
1. Reads relevant Prisme.ai documentation
2. Reads product-specific docs (Knowledge, Store, etc.)
3. Analyzes local workspace structure
4. Makes changes to automations/pages/config
5. Runs lint check
6. Runs code review (identifies MAJOR/NEED_HUMAN/MINOR issues)
7. Runs ticket validation

**Command**:
```
/workspace-edit [workspace-name] [what to implement]
```

**Example**:
```
/workspace-edit ai-governance implement bulk user import per ticket #123
```

**Process**:
1. Read documentation relevant to the feature
2. Edit local YAML files
3. Validate with `lint_doc`
4. Code review agent identifies issues:
   - 🔴 **MAJOR**: Must fix immediately
   - 🟠 **NEED_HUMAN**: Ask user for decision
   - 🟡 **MINOR**: Note but don't block
5. Ticket validator checks all requirements met

**Exit criteria**: All tests pass, code reviewed, ready to push.

---

## Phase 5: Completion

**Purpose**: Finalize and ship the work.

**Actions**:

### 5.1 Push Changes
```
mcp__prisme-ai-builder__push_workspace(
  workspaceName: "workspace-name",
  path: "./workspace-folder",
  message: "feature-name"  # max 15 chars
)
```

### 5.2 Update Ticket
- Check off completed implementation steps
- Add any notes about deviations from plan
- Request review if needed

### 5.3 Test in Environment
- Run through test checklist manually or via automation
- Document any issues found

### 5.4 Close Ticket
- Mark as done when all acceptance criteria met
- Link to any follow-up tickets if needed

---

## Quick Reference: Which Skill When?

| Situation | Skill |
|-----------|-------|
| "I have a vague idea for a feature" | `/design` |
| "I have clear requirements, need a ticket" | `/gitlab-ticket` |
| "I have an approved ticket, ready to code" | `/workspace-edit` |
| "I don't know where to start" | `/guide` (this) |
| "I need to understand the workflow" | `/guide` (this) |

---

## Common Workflows

### New Feature (Full Process)
```
/design ai-knowledge add document versioning
  ↓ (spec created)
/gitlab-ticket specs/document-versioning.md
  ↓ (ticket created, reviewed)
/workspace-edit ai-knowledge implement document versioning
  ↓ (code complete)
push → test → close ticket
```

### Bug Fix (Abbreviated)
```
/gitlab-ticket fix pagination bug in user list
  ↓ (ticket created)
/workspace-edit ai-governance fix pagination offset calculation
  ↓ (fix applied)
push → verify → close ticket
```

### Quick Change (Minimal)
```
/workspace-edit ai-store update agent card styling
  ↓ (change made, validated)
push → done
```

---

## Tips for Success

1. **Don't skip design for complex features** - Saves time in the long run
2. **Keep tickets atomic** - One feature per ticket, easier to test
3. **Test locally first** - Use `execute_automation` before pushing
4. **Read the lint doc** - Most errors are caught there
5. **Trust the code review** - Fix 🔴 issues, ask about 🟠

---

## Getting Help

| Need | Resource |
|------|----------|
| Prisme.ai syntax | `mcp__prisme-ai-builder__get_prisme_documentation` |
| Common mistakes | `mcp__prisme-ai-builder__lint_doc` |
| Debug execution | `mcp__prisme-ai-builder__search_events` |
| Test automation | `mcp__prisme-ai-builder__execute_automation` |
