---
name: 02-gitlab-ticket
description: Create a GitLab-ready ticket with implementation steps and test checklist. Use after /01-design or when you have clear requirements for a feature/bugfix.
argument-hint: "[feature description or spec file path]"
allowed-tools: Read, Grep, Glob, AskUserQuestion, Write
---

# GitLab Ticket Creation Process

You are creating a GitLab ticket with clear implementation steps and a test checklist. The output should be copy-paste ready for GitLab.

## Arguments

- **Input**: $ARGUMENTS (feature description or path to spec file)

---

## Phase 1: Gather Context

### 1.1 Read Specification (if provided)

If a spec file path is provided, read it:
```
Read: [spec file path]
```

### 1.2 Ask About UI Flow

**ALWAYS** ask the user about the UI flow:

```
AskUserQuestion(
  questions: [
    {
      question: "Does this feature include a UI flow that users will interact with?",
      header: "UI Flow",
      options: [
        { label: "Yes - User-facing UI", description: "Feature has pages, forms, or visual components users interact with" },
        { label: "Yes - Admin UI only", description: "Feature has admin/back-office interface only" },
        { label: "No - API/Backend only", description: "Feature is purely backend, tested via API calls" },
        { label: "Both", description: "Has both UI and API that need separate testing" }
      ],
      multiSelect: false
    }
  ]
)
```

---

## Phase 2: Draft Ticket Structure

### 2.1 Generate Ticket Name

Suggest a concise, descriptive ticket name following this format:
- `[Component] Action description`
- Examples:
  - `[AIK] Add document expiration feature`
  - `[Governance] Fix user pagination on admin panel`
  - `[Store] Implement agent rating system`

### 2.2 Draft Implementation Steps

Create a numbered list of implementation steps. Be specific:
- Which files to create/modify
- Which automations to add/update
- Which pages to create/modify
- Which events to emit/listen

### 2.3 Draft Test Checklist

Create a checkbox list for testing. Structure depends on UI flow answer:

**If API/Backend only:**
```markdown
### Test Checklist

#### API Tests
- [ ] `POST /endpoint` - Create resource with valid data → returns 201
- [ ] `POST /endpoint` - Create with invalid data → returns 400 with error message
- [ ] `GET /endpoint/:id` - Retrieve existing resource → returns 200
- [ ] `GET /endpoint/:id` - Retrieve non-existent → returns 404
- [ ] `PUT /endpoint/:id` - Update with valid data → returns 200
- [ ] `DELETE /endpoint/:id` - Delete resource → returns 204

#### Edge Cases
- [ ] Test with empty payload
- [ ] Test with maximum allowed values
- [ ] Test concurrent requests
```

**If UI flow exists:**
```markdown
### Test Checklist

#### UI Flow Tests
- [ ] Navigate to [page] → Page loads without errors
- [ ] Fill form with valid data → Submit succeeds, shows success message
- [ ] Fill form with invalid data → Shows validation errors inline
- [ ] Click [button] → Expected action occurs
- [ ] Check responsive layout on mobile
- [ ] Verify loading states are shown during async operations

#### API Tests (if applicable)
- [ ] [API test items]

#### Edge Cases
- [ ] Test with slow network (throttle in devtools)
- [ ] Test with session expired mid-flow
- [ ] Test browser back/forward navigation
```

---

## Phase 3: User Validation

### 3.1 Present Draft Checklist

Before generating the final ticket, present the draft checklist to the user for validation:

```
AskUserQuestion(
  questions: [
    {
      question: "Here's the proposed test checklist. Should I add, remove, or modify any items?",
      header: "Checklist",
      options: [
        { label: "Looks good", description: "Proceed with this checklist as-is" },
        { label: "Add more tests", description: "I'll specify additional test cases to include" },
        { label: "Remove some tests", description: "Some tests are not relevant, I'll specify which" },
        { label: "Modify tests", description: "I'll provide corrections to some test cases" }
      ],
      multiSelect: false
    }
  ]
)
```

Show the draft checklist in your message BEFORE asking this question so the user can review it.

### 3.2 Iterate if Needed

If user wants changes, incorporate feedback and present updated checklist again.

---

## Phase 4: Generate Final Ticket

### 4.1 GitLab Ticket Template

Generate the final ticket in this format:

```markdown
## Summary

[1-2 sentence description of what this ticket accomplishes]

## Context

[Why this is needed, background information, link to related tickets/specs]

## Requirements

- [Requirement 1]
- [Requirement 2]
- [Requirement 3]

## Implementation Steps

1. **[Component/File]**: [What to do]
   - Detail 1
   - Detail 2

2. **[Component/File]**: [What to do]
   - Detail 1
   - Detail 2

3. **[Component/File]**: [What to do]
   - Detail 1

## Test Checklist

### Setup
- [ ] Ensure test environment is configured
- [ ] [Any prerequisite data or state]

### Functional Tests
- [ ] [Test case 1]
- [ ] [Test case 2]
- [ ] [Test case 3]

### UI Tests (if applicable)
- [ ] [UI test case 1]
- [ ] [UI test case 2]

### Edge Cases
- [ ] [Edge case 1]
- [ ] [Edge case 2]

### Regression
- [ ] Existing [related feature] still works
- [ ] No console errors in browser

### Code Quality (DSUL)
- [ ] All slugs are camelCase (no `/` in slugs)
- [ ] Names use `/` for folder scoping
- [ ] Automations under 200 lines
- [ ] Errors use `{error, message, details}` format
- [ ] Arguments typed, entry points have `validateArguments: true`
- [ ] Lint validation passes (`validate_automation`)

## Acceptance Criteria

- [ ] All test checklist items pass
- [ ] Code reviewed and approved
- [ ] Documentation updated (if applicable)

## Implementation Notes

### DSUL Conventions
- **Slugs**: camelCase only (no `/` in slugs) - e.g., `createUser`, `onInit`
- **Names**: Folder-scoped with `/` for organization - e.g., `entities/user/create`
- **Max lines**: 200 lines per automation (excluding arguments)
- **CRUD**: Centralize per entity, never inline in API/form automations
- **Error format**: `{error: "PascalCase", message: "Human readable", details: {}}`
- **Auth**: Check on all entry points (event/endpoint-triggered automations)

## Notes

[Any additional context, warnings, or considerations]

---
/label ~"type::feature" ~"priority::medium"
/milestone %current
```

### 4.2 Generate Postman Collection (if APIs exist)

**If the feature includes API endpoints**, generate a Postman collection file alongside the ticket.

#### 4.2.1 Collection Structure

```json
{
  "info": {
    "name": "[Feature Name] - API Tests",
    "description": "API test collection for [feature description]",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [],
  "item": [
    {
      "name": "Success Cases",
      "item": [
        // Success test requests
      ]
    },
    {
      "name": "Error Cases",
      "item": [
        // Error test requests
      ]
    }
  ]
}
```

#### 4.2.2 Environment Variables

All requests MUST use these environment variables:
- `{{base_url}}` - Base API URL (e.g., `https://api.prisme.ai`)
- `{{jwt_token}}` - Authentication token

**Request template:**
```json
{
  "name": "[Test Case Name]",
  "request": {
    "method": "POST",
    "header": [
      {
        "key": "Authorization",
        "value": "Bearer {{jwt_token}}"
      },
      {
        "key": "Content-Type",
        "value": "application/json"
      }
    ],
    "url": {
      "raw": "{{base_url}}/v2/workspaces/{{workspace_id}}/endpoint",
      "host": ["{{base_url}}"],
      "path": ["v2", "workspaces", "{{workspace_id}}", "endpoint"]
    },
    "body": {
      "mode": "raw",
      "raw": "{\"field\": \"value\"}"
    }
  },
  "response": []
}
```

#### 4.2.3 Required Test Cases

**Success Cases folder must include:**
- Create/POST with valid payload → Expected 200/201
- Read/GET existing resource → Expected 200
- Update/PUT with valid changes → Expected 200
- Delete/DELETE resource → Expected 200/204
- List/GET collection → Expected 200

**Error Cases folder must include:**
- Invalid/missing authentication → Expected 401
- Missing required fields → Expected 400
- Invalid field format/type → Expected 400
- Resource not found → Expected 404
- Forbidden access (wrong permissions) → Expected 403

#### 4.2.4 Test Scripts

Add basic test scripts to validate responses:

```json
{
  "event": [
    {
      "listen": "test",
      "script": {
        "exec": [
          "pm.test('Status code is 200', function () {",
          "    pm.response.to.have.status(200);",
          "});",
          "",
          "pm.test('Response has expected structure', function () {",
          "    const jsonData = pm.response.json();",
          "    pm.expect(jsonData).to.have.property('id');",
          "});"
        ],
        "type": "text/javascript"
      }
    }
  ]
}
```

#### 4.2.5 Save Postman Collection

Save the collection to the same ticket directory:
```
./tickets/{featureName}/postman-collection.json
```

Also generate an environment template file:
```
./tickets/{featureName}/postman-environment.json
```

**Environment template:**
```json
{
  "name": "[Feature] - Environment",
  "values": [
    {
      "key": "base_url",
      "value": "https://api.studio.prisme.ai",
      "enabled": true
    },
    {
      "key": "jwt_token",
      "value": "",
      "enabled": true
    },
    {
      "key": "workspace_id",
      "value": "",
      "enabled": true
    }
  ]
}
```

---

### 4.3 Output Options

Ask user where to save:

```
AskUserQuestion(
  questions: [
    {
      question: "Where should I save the ticket?",
      header: "Output",
      options: [
        { label: "Display only", description: "Show the ticket in chat for copy-paste" },
        { label: "Save to file", description: "Write to ticket directory with Postman collection (if APIs)" },
        { label: "Both", description: "Display and save to file" }
      ],
      multiSelect: false
    }
  ]
)
```

**If saving to file, create these files:**

| File | Content |
|------|---------|
| `./tickets/{featureName}/gitlab-ticket.md` | The GitLab ticket markdown |
| `./tickets/{featureName}/postman-collection.json` | API test collection (if APIs exist) |
| `./tickets/{featureName}/postman-environment.json` | Environment template (if APIs exist) |

**Note:** If a `base-ticket.md` exists in the directory (from /design), read it for context.

---

## Quick Reference: Test Types by Feature

| Feature Type | Key Tests |
|--------------|-----------|
| CRUD API | Create, Read, Update, Delete, List, Pagination |
| Form/Input | Validation, Required fields, Max length, Format |
| Authentication | Login, Logout, Session expiry, Invalid credentials |
| Authorization | Forbidden access, Role-based visibility |
| File Upload | Size limit, Type validation, Progress, Cancel |
| Search | Empty results, Partial match, Special characters |
| Pagination | First/Last page, Page size, Total count |
| Real-time | Connection loss, Reconnection, Concurrent updates |

---

## Example Tickets

### Example 1: Backend Feature

**Ticket name**: `[AIK] Add document TTL and auto-expiration`

```markdown
## Summary

Add time-to-live (TTL) support for documents in AI Knowledge, allowing automatic expiration and cleanup.

## Context

Users need documents to auto-expire for compliance and storage management. Related to GDPR requirements.

## Requirements

- Documents can have an optional `expiresAt` field
- Expired documents are excluded from search results
- Background job cleans up expired documents daily

## Implementation Steps

1. **Schema**: Add `expiresAt` field to document model
   - Optional ISO 8601 datetime
   - Index for efficient querying

2. **API**: Update document creation/update endpoints
   - Accept `ttl` parameter (duration) or `expiresAt` (absolute)
   - Validate date is in the future

3. **Search**: Filter expired documents
   - Add filter to search query: `expiresAt > now OR expiresAt IS NULL`

4. **Background job**: Create cleanup automation
   - Schedule: daily at 02:00 UTC
   - Delete documents where `expiresAt < now`
   - Log deleted count

## Test Checklist

### API Tests
- [ ] Create document with `ttl: "7d"` → `expiresAt` set to 7 days from now
- [ ] Create document with `expiresAt: "2024-12-31"` → Exact date stored
- [ ] Create document with past `expiresAt` → Returns 400 error
- [ ] Update document TTL → `expiresAt` updated correctly

### Search Tests
- [ ] Search excludes expired documents
- [ ] Search includes documents with no expiration
- [ ] Search includes documents expiring in the future

### Cleanup Tests
- [ ] Manually trigger cleanup → Expired docs deleted
- [ ] Non-expired docs remain untouched
- [ ] Cleanup logs document count

## Acceptance Criteria

- [ ] All test checklist items pass
- [ ] Performance: Search latency unchanged (<100ms p95)
- [ ] Cleanup job completes in <5 minutes for 10k documents
```

### Example 2: UI Feature

**Ticket name**: `[Governance] Add bulk user import from CSV`

```markdown
## Summary

Allow administrators to import multiple users at once via CSV file upload.

## Context

Onboarding large teams manually is time-consuming. Admins need bulk import capability.

## Requirements

- Upload CSV with columns: email, name, role
- Validate all rows before import
- Show preview of users to be created
- Display import progress and results

## Implementation Steps

1. **Page**: Create `/admin/users/import` page
   - File upload component
   - Preview table
   - Import button with confirmation

2. **Automation**: `parseUserCSV`
   - Parse CSV content
   - Validate email format, required fields
   - Return preview data or validation errors

3. **Automation**: `bulkCreateUsers`
   - Accept array of user objects
   - Create users in transaction
   - Return success/failure per row

4. **UI Components**
   - Progress bar during import
   - Results summary (created, failed, skipped)

## Test Checklist

### UI Flow Tests
- [ ] Navigate to Users → Click "Import" button → Import page opens
- [ ] Upload valid CSV → Preview table shows users correctly
- [ ] Upload invalid CSV (wrong columns) → Error message shown
- [ ] Click "Import" → Confirmation modal appears
- [ ] Confirm import → Progress bar shows during import
- [ ] Import completes → Results summary displayed
- [ ] Click "Done" → Returns to user list with new users visible

### Validation Tests
- [ ] CSV with invalid email → Row marked as error in preview
- [ ] CSV with missing required field → Row marked as error
- [ ] CSV with duplicate email (existing user) → Row marked as "skip"
- [ ] Empty CSV → "No users to import" message

### Edge Cases
- [ ] Large CSV (1000 rows) → Handles without timeout
- [ ] Network error mid-import → Partial results shown, can retry failed
- [ ] Cancel during upload → Returns to clean state

## Acceptance Criteria

- [ ] All test checklist items pass
- [ ] Works on Chrome, Firefox, Safari
- [ ] Responsive on tablet (admin common use case)
```
