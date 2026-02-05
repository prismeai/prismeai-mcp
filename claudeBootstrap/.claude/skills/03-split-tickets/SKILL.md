---
name: 03-split-tickets
description: Use this skill to split a main ticket into well-scoped sub-tickets that maximize code reuse and prevent duplication. Creates sequentially numbered tickets and generates README.md with implementation order.
argument-hint: "[path to main ticket or feature folder]"
allowed-tools: Read, Write, Glob, Grep, AskUserQuestion
---

# Ticket Splitting Process

You are a ticket splitting assistant. Your role is to take a main ticket and break it into **well-scoped sub-tickets** that:
1. **Maximize code reuse** - Extract shared utilities before they're needed
2. **Prevent duplication** - Each piece of logic lives in exactly one place
3. **Have clear boundaries** - Each ticket has a single, focused responsibility

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
- What logic will be reused across multiple places
- What shared utilities should be extracted

---

## Phase 3: Identify Reusable Components (Critical Step)

**Before creating any tickets, identify ALL potentially reusable code.**

### 3.1 Scan for Duplication Patterns

Look for logic that would appear in multiple places:

| Pattern Type | Example | Extract To |
|--------------|---------|------------|
| API Call Patterns | Same headers, auth, error handling | `utils/httpClient.yml` |
| Data Transformations | Similar mapping/filtering logic | `utils/transformers.yml` |
| Validation Logic | Input validation rules | `utils/validators.yml` |
| Error Handling | Repeated error response structures | `utils/errorHandler.yml` |
| Type Definitions | Shared data shapes | `utils/types.yml` |
| Constants/Config | Repeated magic values, URLs | `utils/constants.yml` |
| Business Rules | Domain logic used in multiple flows | `utils/businessRules.yml` |

### DSUL Naming for Shared Components

**IMPORTANT**: The `/` namespace scoping goes in the `name` field, NOT the `slug`:
- **Slug**: Pure camelCase (e.g., `httpClient`, `validateEntity`, `createUser`)
- **Name**: Folder-scoped with `/` (e.g., `utils/api/httpClient`, `entities/user/create`)

| Component Type | Slug (camelCase) | Name (folder-scoped) |
|----------------|------------------|----------------------|
| HTTP Client | `httpClient` | `utils/{api}/httpClient` |
| Validator | `validateEntity` | `utils/validators/validateEntity` |
| CRUD Create | `createUser` | `entities/user/create` |
| CRUD Get | `getUser` | `entities/user/get` |
| CRUD Update | `updateUser` | `entities/user/update` |
| CRUD Delete | `deleteUser` | `entities/user/delete` |
| CRUD List | `listUsers` | `entities/user/list` |
| Event Handler | `onUserCreated` | `handlers/user/onCreated` |

### 3.2 Reuse Rules

| # of Usages | Complexity | Action |
|-------------|------------|--------|
| 1 | Any | Inline (no extraction needed) |
| 2 | Simple (< 5 lines) | Consider extracting |
| 2 | Complex (> 5 lines) | **Must extract** |
| 3+ | Any | **Must extract** |

### 3.3 Document Reuse Opportunities

List all identified shared components:
```
Shared Components:
- HTTP client with standard auth headers (used by: endpoint A, endpoint B, endpoint C)
- User validation logic (used by: create user, update user)
- Response formatter (used by: all API responses)
```

---

## Phase 4: Create Sub-Tickets

### 4.1 Naming Convention

Use simple sequential numbering:
- `01-*.md` - First ticket (often shared utilities)
- `02-*.md` - Second ticket (depends on 01)
- `03-*.md` - Third ticket (depends on 02)
- etc.

**Key principle**: Each ticket builds on the previous ones. Later tickets can **reuse** code from earlier tickets.

### 4.2 Ticket Ordering Strategy

Order tickets to maximize reuse:

1. **Shared utilities first** - Extract reusable components before anything needs them
2. **Foundation second** - Core data structures, types, schemas
3. **Business logic third** - Core automations that use the utilities
4. **UI/Integration last** - Pages and wiring that use everything above

### 4.3 Example Structure

```
./tickets/my-feature/
├── base-ticket.md            (original from /design or /gitlab-ticket)
├── README.md                 (implementation plan)
├── 01-shared-utilities.md    (reusable HTTP client, validators, etc.)
├── 02-data-schema.md         (types, events, data structures)
├── 03-core-automation.md     (main business logic, reuses 01)
├── 04-secondary-automation.md (additional logic, reuses 01 + 03)
├── 05-ui-page.md             (frontend, reuses all above)
└── 06-integration-tests.md   (end-to-end verification)
```

### 4.4 Shared Utilities Ticket Template

The first ticket should extract all shared components:

```markdown
# 01 - Shared Utilities

## Overview

Extract reusable utilities that will be used by multiple subsequent tickets.

## Scope

**Files to create:**
- `workspace/automations/utils/httpClient.yml` - Standard HTTP client with auth
- `workspace/automations/utils/validators.yml` - Input validation functions
- `workspace/automations/utils/responseFormatter.yml` - Standard API responses

## Reuse Contract

### HTTP Client
```yaml
- emit:
    event: workspace.utils.httpClient
    payload:
      url: "{{url}}"
      method: "{{method}}"
      body: "{{body}}"
    output: response
```

### Validator
```yaml
- emit:
    event: workspace.utils.validate
    payload:
      type: "user"
      data: "{{userData}}"
    output: validationResult
```

## Used By

- `03-core-automation.md` - HTTP calls, validation
- `04-secondary-automation.md` - HTTP calls
- `05-ui-page.md` - Validation

## Implementation Checklist

- [ ] Create HTTP client with standard headers and error handling
- [ ] Create validators with reusable validation rules
- [ ] Create response formatter for consistent API responses
- [ ] Document interface contract for each utility

## Testing

- [ ] HTTP client handles success responses
- [ ] HTTP client handles error responses
- [ ] Validators correctly validate/reject data

## Notes

All subsequent tickets should use these utilities instead of duplicating logic.
```

### 4.5 Standard Sub-Ticket Template

Each sub-ticket should follow this format:

```markdown
# [Ticket Number] - [Ticket Title]

## Overview

[What this ticket accomplishes - 1-2 sentences]

## Scope

**Files to modify/create:**
- `workspace/automations/file.yml`

**Reuses from previous tickets:**
- `utils/httpClient.yml` from ticket 01
- `utils/validators.yml` from ticket 01

**Out of scope** (handled by other tickets):
- [Related work in other tickets]

## Implementation Checklist

- [ ] Step 1: [specific action]
- [ ] Step 2: [specific action]
- [ ] Step 3: [specific action]

## Code Reuse Notes

- Use `emit: workspace.utils.httpClient` for all HTTP calls
- Use `emit: workspace.utils.validate` for input validation
- Do NOT duplicate validation logic - call the shared validator

## Testing

- [ ] [Test scenario from main ticket]
- [ ] [Additional tests specific to this scope]

## Dependencies

- **Requires:** [ticket X] to be completed first
- **Provides:** [what this ticket makes available for later tickets]

## DSUL Compliance

- [ ] Slugs are pure camelCase (no `/` in slugs)
- [ ] Names use `/` for folder scoping
- [ ] Public automations have localized FR + EN names
- [ ] Errors use `{error, message, details}` format
- [ ] Automations under 200 lines
- [ ] Arguments typed, entry points have `validateArguments: true`

## Notes

[Any special considerations, gotchas, or context needed]
```

---

## Phase 5: Validate No Duplication

**Before finalizing tickets, verify no code duplication exists.**

### 5.1 Duplication Checklist

For each ticket, check:
- [ ] Does this ticket duplicate any logic from a previous ticket?
- [ ] If yes, should that logic be extracted to a shared utility?
- [ ] Does the ticket clearly reference which utilities to reuse?

### 5.2 Common Duplication Anti-Patterns

| Anti-Pattern | Fix |
|--------------|-----|
| Same HTTP headers in multiple automations | Extract to shared HTTP client |
| Same validation rules copied | Extract to shared validator |
| Same error handling code | Extract to shared error handler |
| Same data transformation | Extract to shared transformer |
| Same constants/URLs | Extract to shared config |

### 5.3 Refactor if Needed

If duplication is found:
1. Add a new shared utility ticket (or expand ticket 01)
2. Update dependent tickets to reference the utility
3. Add "Code Reuse Notes" section to each affected ticket

---

## Phase 6: Generate README.md

Create a README.md with the implementation plan:

```markdown
# [Feature Name] - Implementation Plan

## Overview

[Brief description from main ticket]

## Design Principles

1. **Code Reuse**: Shared utilities extracted first, reused everywhere
2. **Single Responsibility**: Each ticket has one focused purpose
3. **No Duplication**: Logic lives in exactly one place

## Implementation Order

| # | Ticket | Description | Reuses | Provides |
|---|--------|-------------|--------|----------|
| 01 | `01-shared-utilities.md` | HTTP client, validators | - | httpClient, validators |
| 02 | `02-data-schema.md` | Types and events | - | types, events |
| 03 | `03-core-automation.md` | Main business logic | 01 | coreProcess |
| 04 | `04-secondary-automation.md` | Secondary flows | 01, 03 | secondaryProcess |
| 05 | `05-ui-page.md` | User interface | 01, 02, 03 | - |
| 06 | `06-integration-tests.md` | End-to-end tests | all | - |

## Shared Utilities Map

| Utility | File | Interface | Used By |
|---------|------|-----------|---------|
| HTTP Client | `utils/httpClient.yml` | `emit: workspace.utils.httpClient` | 03, 04, 05 |
| Validator | `utils/validators.yml` | `emit: workspace.utils.validate` | 03, 04, 05 |
| Response Formatter | `utils/responseFormatter.yml` | `emit: workspace.utils.formatResponse` | 03, 04 |

## Code Reuse Guidelines

When implementing tickets:

1. **Check shared utilities first** - Before writing new code, check if a utility exists
2. **Never duplicate** - If you need logic that exists elsewhere, call the utility
3. **Extend, don't copy** - If a utility doesn't quite fit, extend it rather than copying

## File Ownership

| File | Owner Ticket |
|------|--------------|
| `utils/httpClient.yml` | 01 |
| `utils/validators.yml` | 01 |
| `automations/core.yml` | 03 |
| `automations/secondary.yml` | 04 |
| `pages/main.yml` | 05 |

## Notes

[Any special considerations for implementation]
```

---

## Phase 7: User Validation

### 7.1 Present the Plan

Before writing files, present the proposed split to the user:

```
AskUserQuestion(
  questions: [
    {
      question: "Here's the proposed ticket split focused on code reuse. Does this look correct?",
      header: "Review",
      options: [
        { label: "Looks good", description: "Proceed with creating the sub-tickets" },
        { label: "More reuse needed", description: "I see duplication that should be extracted" },
        { label: "Adjust scope", description: "Some tickets are too big or too small" },
        { label: "Start over", description: "The split doesn't make sense, let's rethink" }
      ],
      multiSelect: false
    }
  ]
)
```

### 7.2 Iterate if Needed

If user wants changes, discuss and adjust the plan before writing files.

---

## Phase 8: Write Files

### 8.1 Create Sub-Ticket Files

Use the `Write` tool to create each sub-ticket:

```
Write(
  file_path: "./tickets/{featureName}/01-{ticket-name}.md",
  content: "[SUB-TICKET CONTENT]"
)
```

### 8.2 Create README.md

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
2. **Reuse summary**: What shared utilities were identified
3. **Next steps**: How to implement maintaining code reuse

Example:
```
## Created Files

- `./tickets/my-feature/README.md` - Implementation plan with reuse map
- `./tickets/my-feature/01-shared-utilities.md` - Reusable HTTP client & validators
- `./tickets/my-feature/02-data-schema.md` - Types and events
- `./tickets/my-feature/03-core-automation.md` - Main business logic
- `./tickets/my-feature/04-ui-page.md` - User interface
- `./tickets/my-feature/05-integration-tests.md` - End-to-end tests

## Code Reuse Summary

Extracted 3 shared utilities that prevent duplication across 4 tickets:
- HTTP client (used by tickets 03, 04, 05)
- Validators (used by tickets 03, 04)
- Response formatter (used by tickets 03, 04)

## Next Steps

1. Start with ticket 01 (shared utilities) - this enables all other tickets
2. Implement tickets in order (each builds on previous)
3. When implementing, always check if a utility exists before writing new code
4. Run tests after each ticket to verify nothing broke
```

---

## Important Guidelines

### Code Reuse (Primary Goal)
- **Extract shared utilities FIRST** - before any ticket needs them
- **Document reuse contracts** - how to call each shared utility
- **Reference utilities explicitly** - each ticket should list what it reuses
- **Never duplicate logic** - if code exists elsewhere, call it

### Well-Scoped Tickets
- **Single responsibility** - each ticket does one thing well
- **Clear boundaries** - obvious what's in scope and out of scope
- **Right-sized** - not too granular (overhead) or too coarse (unwieldy)
- Rule of thumb: 3-6 tickets total for most features

### Sequential, Not Parallel
- Tickets are ordered by dependency, not for parallel work
- Each ticket can assume all previous tickets are complete
- Later tickets build on and reuse earlier work

### Self-Contained
- Each ticket should be independently implementable (after its dependencies)
- Include enough context that someone could work on it without reading all other tickets
- Explicitly list what utilities/code from previous tickets to reuse

---

## Quick Reference: Common Splits

| Feature Type | Typical Split |
|--------------|---------------|
| CRUD feature | 01: shared utils, 02: schema/types, 03: backend logic (reuses 01), 04: UI (reuses 01,03), 05: tests |
| New page | 01: shared utils, 02: API automation (reuses 01), 03: page (reuses 01,02), 04: tests |
| Integration | 01: API client, 02: data transformers, 03: business logic (reuses 01,02), 04: tests |
| Refactoring | 01: new shared utils, 02: migrate module A (reuses 01), 03: migrate module B (reuses 01), 04: cleanup |

**Remember**:
- **Extract shared code first** - ticket 01 should always contain reusable utilities
- **Each ticket builds on previous** - explicitly reference what to reuse
- **No duplication** - if you're copying code, you're doing it wrong
