# Agent Creation & Prompt Engineering

## Agent Types

| Type | Complexity | Created In |
|------|------------|------------|
| Simple Prompting | Low | Store |
| RAG | Medium | Knowledge |
| Tool-Using | Med-High | Knowledge/Builder |
| Multi-Agent | High | Builder |

---

## Prompt Anatomy

### 1. Role Definition
```
You are a Customer Support Specialist for Acme Financial, with expertise in retirement accounts.
```
- Specific domain expertise
- Brand voice alignment
- Authority level
- User relationship

### 2. Task Instructions
```
Help users understand retirement products, troubleshoot accounts, guide on investment options.
```
- Specific actions
- Scope boundaries
- Task priorities
- Success criteria

### 3. Response Guidelines
```
When responding:
1. Keep concise, jargon-free
2. Include regulatory disclaimers for investments
3. Simple overview first, then details
4. Summarize next steps at end
```

### 4. Constraints
```
Limitations:
- No investment recommendations
- No competitor mentions
- No specific fees unless asked
- Defer tax to professionals
```

### 5. Knowledge Context
```
Key info:
- 401(k) offers 12 investment options
- 2023 contribution limit: $22,500
- Early withdrawal penalties before 59½
```

---

## Principles

### Be Specific

**Instead of:**
```
Help with product questions.
```

**Use:**
```
Respond to enterprise software questions by:
1. Identify specific product
2. Provide accurate features from docs
3. Explain business value/ROI
4. Address implementation concerns
5. Suggest relevant case studies
```

### Explicit Formatting
```
Product comparison format:

PRODUCT COMPARISON: [A] vs [B]

FEATURES:
- [Category]:
  * [A]: [desc]
  * [B]: [desc]

USE CASES:
- [A]: [cases]
- [B]: [cases]
```

### Provide Examples
```
Security features response:

"Our platform includes:
1. Auth: MFA, SSO (Okta, Azure AD), RBAC
2. Data: E2E encryption (TLS 1.3, AES-256), customer-managed keys
3. Compliance: SOC 2 Type II, GDPR, regular pentests

Elaborate on any aspect?"
```

### Guardrails
```
Guidelines:
1. No competitor comparisons by name
2. No private pricing
3. No future feature promises
4. No absolute security claims
5. No unpublished customer names
6. Include compliance disclaimers
```

### Contextual
```
For technical questions: detailed, IT terminology
For business value: high-level, ROI focus
For confused users: clarity first, offer human support
```

---

## Advanced Techniques

### Chain-of-Thought
```
For complex questions:
1. Acknowledge question
2. Break into components
3. Address each with reasoning
4. Synthesize answer
5. Verify logic
```

### Few-Shot Learning
```
Classification examples:

"Reset password?" → ACCOUNT_ACCESS, MEDIUM
"Data deleted!" → DATA_ISSUE, HIGH
"Non-profit discounts?" → PRICING, LOW
```

### Decision Tree
```
1. Issue type:
   - Technical → step 2
   - Billing → step 3
   - Feature request → step 4

2. Technical:
   - Login → check account
   - Performance → check system
   - Data → verify backups
```

---

## Agent-Specific Prompting

### Simple Agents
- Comprehensive instructions essential
- Detailed examples improve consistency
- Clear boundaries prevent drift
- Response templates ensure format

### RAG Agents
```
When answering:
1. Use retrieved info as truth
2. Cite specific document/section
3. State gaps clearly
4. Don't speculate beyond docs

Citation format:
"According to [Doc] (Section: [X]), [info]."

If no info:
"Not in current docs. Recommend [alternative]."
```

### Tool-Using Agents
```
Tool usage:
• Account Lookup: verify account status
• Knowledge Base: get documentation
• Ticket Creation: unresolved issues

When using tools:
1. Tell user you're checking
2. Interpret results clearly
3. On error: retry once, then alternative
4. Summarize key info
```

---

## Testing

### Criteria
- Accuracy
- Format adherence
- Policy compliance
- Tone appropriateness
- Edge case handling

### Test Categories
- Common scenarios
- Edge cases
- Problematic queries
- Different personas

### Iteration
1. Change one aspect
2. Test impact
3. Build on success
4. Document versions

---

## Best Practices

| Practice | Description |
|----------|-------------|
| Prompt Library | Centralized successful prompts |
| Governance | Review for production |
| Customization | Org voice/values |
| Version Control | Track changes |
| Regular Reviews | Update from feedback |

---

## Temperature Settings

| Purpose | Temp | Rationale |
|---------|------|-----------|
| Factual | 0.0-0.3 | Deterministic |
| General | 0.3-0.7 | Balanced |
| Creative | 0.7-1.0 | Varied |

---

## Implementation

| Interface | Use |
|-----------|-----|
| Store | No-code, visual editor |
| Knowledge | RAG prompts, knowledge integration |
| Builder | Programmatic, dynamic generation |
