# AI Insights

Conversation analysis and quality monitoring for continuous improvement.

**Users:** AI governance, CX, Compliance, Product

---

## Features

| Feature | Description |
|---------|-------------|
| Analysis | Comprehensive interaction analysis |
| AI Eval | LLM-as-judge scoring |
| Human Review | Sampling for manual review |
| Custom Criteria | Define dimensions |
| Compliance | Audits, reporting |
| Recommendations | Improvement actions |
| Token Optimization | Cost efficiency |
| Export | To AI Collection |

---

## Evaluation

### Dimensions
| Dimension | Field | Scale | Description |
|-----------|-------|-------|-------------|
| Answer Score | `score` | 0, 1.5, 2 | How close the answer was to reference guidelines |
| Context Score | `context` | 0, 1.5, 2 | Whether required information was in the context |

### Scoring Criteria
| Score | Meaning |
|-------|---------|
| 0 | Answer is false/wrong (only if AI was plainly incorrect) |
| 1.5 | Partially correct, AI understood the subject and provided a response |
| 2 | Answer covered many guidelines, may need follow-up for completeness |

*Note: The LLM evaluator provides scores of 0, 1, or 2. A score of 1 is internally converted to 1.5 for finer granularity.*

---

## AI Evaluation

### Automated
- Every conversation evaluated
- LLM-as-judge methodology
- Multi-dimensional scoring
- Pattern detection

### Criteria
- Accuracy
- Relevance
- Completeness
- Source attribution
- Factual grounding
- Tone

### Custom Rules
- Custom dimensions
- Weighted criteria
- Domain-specific
- Business rules

---

## Human Review

### Sampling
- Statistical sampling
- Edge case focus
- Flagged conversations
- Random sampling

### Workflow
1. Select conversation
2. Examine interaction
3. Score dimensions
4. Add notes/feedback
5. Create action items

### Categories
- Quality issues
- Policy violations
- Improvements
- Best practices
- Training examples

---

## Analytics

### Quality
- Overall scores
- Dimension breakdowns
- Trends
- Comparisons

### Performance
- Agent performance
- KB effectiveness
- Model performance
- User satisfaction

### Issues
- Failure patterns
- Recurring problems
- Quality degradation
- Anomalies

---

## Conversation Analysis

### Interaction
- Full history
- Sources used
- Tools invoked
- Timing

### Context
- Retrieved docs
- Relevance scores
- Utilization
- Gap identification

### Response
- Answer quality
- Accuracy
- Source attribution
- Completeness

---

## Compliance

### Audits
- Evaluations logged
- Actions tracked
- Justifications
- Timestamps

### Reporting
- Quality compliance
- Policy adherence
- Issue resolution
- Trends

### Retention
- Configurable
- Archival policies
- Export
- Legal hold

---

## Token Optimization

### Analysis
- Per-conversation consumption
- Cost per interaction
- Efficiency metrics
- Opportunities

### Recommendations
- Prompt efficiency
- Context optimization
- Model selection
- Caching

---

## Export

- AI Collection
- CSV/JSON
- Scheduled
- API access

---

## Config

### Evaluation
- Enable/disable dimensions
- Custom criteria
- Thresholds
- Eval model selection

### Sampling
- Rate
- Criteria
- Priority rules
- Exclusions

### Notifications
- Alert thresholds
- Channels
- Escalation
- Report scheduling

---

## Dashboards

### Overview
- Key metrics
- Quality trends
- Alerts
- Action items

### Agent Performance
- Per-agent scores
- Comparisons
- Trends
- Improvements

### KB Performance
- Retrieval quality
- Source effectiveness
- Gaps
- Coverage

### Review Queue
- Pending
- Flagged
- Priority
- Completed

---

## Best Practices

| Practice | Description |
|----------|-------------|
| Regular Review | Consistent human reviews |
| Custom Criteria | Domain-specific eval |
| Trend Monitoring | Track over time |
| Action Follow-up | Close loop on issues |
| Feedback Integration | Update KBs |

---

## Integrations

- Knowledge: Quality feedback
- SecureChat: Conversation source
- Store: Agent performance
- Governance: Policy compliance
- Collection: Data export
