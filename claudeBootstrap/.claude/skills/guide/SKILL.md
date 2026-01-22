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
│      /01-design                                                 │
│           │                                                     │
│           ▼                                                     │
│   2. TICKET          ──▶   Create GitLab ticket with tests      │
│      /02-gitlab-ticket                                          │
│           │                                                     │
│           ▼                                                     │
│   3. REVIEW          ──▶   Human reviews conception             │
│      (manual)              Approve / Request changes            │
│           │                                                     │
│           ▼                                                     │
│  3b. SPLIT (optional)──▶   Split into parallel sub-tickets      │
│      /03-split-tickets     For complex features only            │
│           │                                                     │
│           ▼                                                     │
│   4. IMPLEMENT       ──▶   Edit workspace, run validations      │
│      /04-workspace-edit    (run per sub-ticket if split)        │
│           │                                                     │
│           ▼                                                     │
│   5. DONE            ──▶   Push changes, close ticket           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Design (`/01-design`)

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
/01-design [workspace-name] [feature description]
```

**Example**:
```
/01-design ai-governance add bulk user import with CSV upload
```

**Output**: Specification document with requirements, technical design, events, dependencies.

**Exit criteria**: Clear spec approved by user before proceeding.

---

## Phase 2: GitLab Ticket (`/02-gitlab-ticket`)

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
/02-gitlab-ticket [feature description or spec file path]
```

**Example**:
```
/02-gitlab-ticket specs/bulk-user-import.md
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
| **Major concerns** | Return to Phase 1 (/01-design) |
| **Rejected** | Archive, document why |

**Exit criteria**: Explicit approval from reviewer to proceed.

---

## Phase 3b: Split Tickets (`/03-split-tickets`) - Optional

**Purpose**: Break a large ticket into parallelizable sub-tickets.

**When to use**: For complex features that would benefit from parallel work streams.

**What it does**:
1. Reads the main ticket (from /01-design or /02-gitlab-ticket)
2. Analyzes work streams (automations, pages, config, etc.)
3. Identifies dependencies and parallelization opportunities
4. Creates numbered sub-tickets (01-01, 01-02, 02-01, etc.)
5. Generates README.md with implementation order

**Command**:
```
/03-split-tickets [path to main ticket or feature folder]
```

**Example**:
```
/03-split-tickets ./tickets/bulk-user-import/
```

**Output**:
- Numbered sub-ticket files (01-01-*.md, 02-01-*.md, etc.)
- README.md with dependency graph and implementation order

**Naming convention**:
- `01-01-*.md` + `01-02-*.md` = parallel (same first number)
- `02-*.md` = sequential (depends on 01-*)
- `03-*.md` = sequential (depends on 02-*)

**Exit criteria**: Sub-tickets created and reviewed, ready for parallel implementation.

**When to skip**:
- Simple features (single automation or page change)
- Bug fixes
- Configuration changes

---

## Phase 4: Implementation (`/04-workspace-edit`)

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
/04-workspace-edit [workspace-name] [what to implement]
```

**Example**:
```
/04-workspace-edit ai-governance implement bulk user import per ticket #123
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
| "I have a vague idea for a feature" | `/01-design` |
| "I have clear requirements, need a ticket" | `/02-gitlab-ticket` |
| "I have a complex ticket, need to parallelize" | `/03-split-tickets` |
| "I have an approved ticket, ready to code" | `/04-workspace-edit` |
| "I don't know where to start" | `/guide` (this) |
| "I need to understand the workflow" | `/guide` (this) |

---

## Common Workflows

### New Feature (Full Process)
```
/01-design ai-knowledge add document versioning
  ↓ (spec created)
/02-gitlab-ticket specs/document-versioning.md
  ↓ (ticket created, reviewed)
/04-workspace-edit ai-knowledge implement document versioning
  ↓ (code complete)
push → test → close ticket
```

### Complex Feature (With Parallelization)
```
/01-design ai-governance add bulk user import with CSV
  ↓ (spec created)
/02-gitlab-ticket specs/bulk-user-import.md
  ↓ (ticket created, reviewed)
/03-split-tickets ./tickets/bulk-user-import/
  ↓ (sub-tickets created)
# Phase 1 - parallel:
/04-workspace-edit ai-governance implement 01-01-csv-parser.md
/04-workspace-edit ai-governance implement 01-02-user-types.md
  ↓ (Phase 1 complete)
# Phase 2 - parallel:
/04-workspace-edit ai-governance implement 02-01-import-automation.md
/04-workspace-edit ai-governance implement 02-02-import-page.md
  ↓ (Phase 2 complete)
# Phase 3:
/04-workspace-edit ai-governance implement 03-integration.md
  ↓ (all phases complete)
push → test → close ticket
```

### Bug Fix (Abbreviated)
```
/02-gitlab-ticket fix pagination bug in user list
  ↓ (ticket created)
/04-workspace-edit ai-governance fix pagination offset calculation
  ↓ (fix applied)
push → verify → close ticket
```

### Quick Change (Minimal)
```
/04-workspace-edit ai-store update agent card styling
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
