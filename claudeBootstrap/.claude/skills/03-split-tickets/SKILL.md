---
name: 03-split-tickets
description: Use this skill to split a main ticket into parallelizable sub-tickets. Creates numbered tickets following naming convention and generates README.md with implementation order.
argument-hint: "[path to main ticket or feature folder]"
allowed-tools: Read, Write, Glob, Grep, AskUserQuestion
---

# Ticket Splitting Process

You are a ticket splitting assistant. Your role is to take a main ticket and break it into parallelizable sub-tickets that multiple agents can work on simultaneously.

## Arguments

- **Input**: $ARGUMENTS (path to main ticket file or feature folder)

---

## Phase 1: Input Processing

### 1.1 Determine Input Type

Accept one of:
- Path to main ticket file (e.g., `./tickets/my-feature/base-ticket.md`)
- Path to feature folder (e.g., `./tickets/my-feature/`)

If given a folder, look for `base-ticket.md` or `gitlab-ticket.md` inside it.

### 1.2 Read Main Ticket

```
Read: [ticket path]
```

---

## Phase 2: Parse Main Ticket

Extract from the main ticket:

- **Feature name**: Title or summary
- **Requirements list**: All functional and non-functional requirements
- **Related code/files**: Files mentioned for modification
- **Test scenarios**: Test checklist items
- **Implementation approach**: Steps outlined

Create a mental model of:
- What needs to be built
- What are the dependencies between pieces
- What can be parallelized

---

## Phase 3: Analyze Work Streams

Identify independent work streams. Common patterns for Prisme.ai workspaces:

**Backend automations:**
- Core business logic automations
- Event handlers
- API endpoint automations
- Scheduled jobs

**Frontend pages:**
- Page layouts
- Form pages
- Display/list pages

**Configuration:**
- Index.yml changes
- Security rules
- App imports

**Shared contracts:**
- Types/interfaces that must be defined before parallel work
- Events that multiple automations listen to

---

## Phase 4: Create Sub-Tickets

### 4.1 Naming Convention for Parallelization

Use this numbering convention:
- `01-01-*.md` + `01-02-*.md` = **parallel** (same first number)
- `02-*.md` = **sequential** (depends on 01-*)
- `03-*.md` = **sequential** (depends on 02-*)

### 4.2 Example Structure

```
./tickets/my-feature/
├── base-ticket.md          (original from /design or /gitlab-ticket)
├── README.md               (implementation plan)
├── 01-01-shared-types.md   (parallel with 01-02)
├── 01-02-event-schema.md   (parallel with 01-01)
├── 02-01-core-automation.md (after 01-*, parallel with 02-02)
├── 02-02-ui-page.md        (after 01-*, parallel with 02-01)
└── 03-integration.md       (after 02-*, final integration)
```

### 4.3 Sub-Ticket Template

Each sub-ticket should follow this format:

```markdown
# [Ticket Title]

## Overview

[What this ticket accomplishes - 1-2 sentences]

## Scope

**Files to modify/create:**
- `workspace/automations/file.yml`
- `workspace/pages/page.yml`

**Out of scope** (handled by other tickets):
- [Related work in other tickets]

## Implementation Checklist

- [ ] Step 1: [specific action]
- [ ] Step 2: [specific action]
- [ ] Step 3: [specific action]

## Testing

- [ ] [Test scenario from main ticket]
- [ ] [Additional tests specific to this scope]

## Dependencies

- **Requires:** [ticket X] to be completed first (if any)
- **Blocks:** [ticket Y] depends on this

## Notes

[Any special considerations, gotchas, or context needed]
```

---

## Phase 5: Generate README.md

Create a README.md with the implementation plan:

```markdown
# [Feature Name] - Implementation Plan

## Overview

[Brief description from main ticket]

## Implementation Order

### Phase 1 (Parallel)
| Ticket | Description | Estimated Complexity |
|--------|-------------|---------------------|
| `01-01-*.md` | [description] | Low/Medium/High |
| `01-02-*.md` | [description] | Low/Medium/High |

### Phase 2 (Parallel, requires Phase 1)
| Ticket | Description | Estimated Complexity |
|--------|-------------|---------------------|
| `02-01-*.md` | [description] | Low/Medium/High |
| `02-02-*.md` | [description] | Low/Medium/High |

### Phase 3 (requires Phase 2)
| Ticket | Description | Estimated Complexity |
|--------|-------------|---------------------|
| `03-*.md` | [description] | Low/Medium/High |

## Dependency Graph

```
01-01 ─┬─► 02-01 ─┬─► 03
01-02 ─┘         │
                 ├─► 02-02 ─┘
```

## Shared Contracts

[Any interfaces/types/events that must be agreed upon before parallel work]

## Conflict Zones

[Files that multiple tickets might touch - be careful with merge order]

## Notes

[Any special considerations for implementation order]
```

---

## Phase 6: User Validation

### 6.1 Present the Plan

Before writing files, present the proposed split to the user:

```
AskUserQuestion(
  questions: [
    {
      question: "Here's the proposed ticket split. Does this look correct?",
      header: "Review",
      options: [
        { label: "Looks good", description: "Proceed with creating the sub-tickets" },
        { label: "Adjust phases", description: "I want to change the parallelization" },
        { label: "Add/remove tickets", description: "Some work items are missing or shouldn't be separate" },
        { label: "Start over", description: "The split doesn't make sense, let's rethink" }
      ],
      multiSelect: false
    }
  ]
)
```

### 6.2 Iterate if Needed

If user wants changes, discuss and adjust the plan before writing files.

---

## Phase 7: Write Files

### 7.1 Create Sub-Ticket Files

Use the `Write` tool to create each sub-ticket:

```
Write(
  file_path: "./tickets/{featureName}/01-01-{ticket-name}.md",
  content: "[SUB-TICKET CONTENT]"
)
```

### 7.2 Create README.md

```
Write(
  file_path: "./tickets/{featureName}/README.md",
  content: "[IMPLEMENTATION PLAN CONTENT]"
)
```

---

## Output Summary

After creating files, provide:

1. **Files created**: List all sub-ticket files
2. **Implementation order**: Quick summary of phases
3. **Next steps**: How to use the sub-tickets with `/workspace-edit`

Example:
```
## Created Files

- `./tickets/my-feature/README.md` - Implementation plan
- `./tickets/my-feature/01-01-shared-types.md` - Shared types definition
- `./tickets/my-feature/01-02-event-schema.md` - Event schema
- `./tickets/my-feature/02-01-core-automation.md` - Core business logic
- `./tickets/my-feature/02-02-ui-page.md` - User interface
- `./tickets/my-feature/03-integration.md` - Integration and testing

## Next Steps

1. Review the sub-tickets and adjust if needed
2. Start Phase 1 tickets in parallel:
   - `/workspace-edit [workspace] implement 01-01-shared-types.md`
   - `/workspace-edit [workspace] implement 01-02-event-schema.md`
3. After Phase 1 completes, start Phase 2, etc.
```

---

## Important Guidelines

### Minimize Conflicts
- Each ticket should touch different files when possible
- If multiple tickets need the same file, sequence them (not parallel)
- Mark potential conflict zones in README.md

### Clear Boundaries
- Define exactly what's in scope and out of scope for each ticket
- Use "Out of scope" section to prevent overlap

### Self-Contained
- Each ticket should be independently implementable (after its dependencies)
- Include enough context that someone could work on it without reading all other tickets

### Preserve Test Coverage
- Distribute test scenarios from main ticket to appropriate sub-tickets
- Integration tests go in the final phase ticket

### Shared Contracts First
- If multiple tickets need shared types/events, make that Phase 1
- Don't let Phase 2+ tickets define things that should be shared

### Right-Size the Split
- Don't split too granularly (overhead of ticket management)
- Don't keep too coarse (defeats parallelization purpose)
- Rule of thumb: 2-5 tickets per phase, 2-4 phases total

---

## Quick Reference: Common Splits

| Feature Type | Typical Split |
|--------------|---------------|
| CRUD feature | Phase 1: schema/types, Phase 2: backend + frontend parallel, Phase 3: integration |
| New page | Phase 1: automations, Phase 2: page layout, Phase 3: wiring |
| Integration | Phase 1: API client/types, Phase 2: business logic, Phase 3: UI + tests |
| Refactoring | Phase 1: new structure, Phase 2: migration per module, Phase 3: cleanup |
