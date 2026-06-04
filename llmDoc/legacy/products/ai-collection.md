# AI Collection

Tabular data management with natural language querying.

**Users:** Data analysts, BI, Product, Business

**Status:** Beta

---

## Features

| Feature | Description |
|---------|-------------|
| Upload | Manual or Builder connected |
| AI Enrichment | Row-by-row processing |
| NL Query | Conversational data queries |
| Views | Custom and shared |
| Builder | Seamless integration |
| Token Optimization | Efficient processing |
| Collaboration | Team sharing |

---

## Data Management

### Upload Methods
| Method | Description |
|--------|-------------|
| Manual | CSV, Excel, copy/paste, forms |
| Connected | Builder, API, DB, scheduled |

### Types
Text, Numeric, Dates, Boolean, URLs, File refs

---

## AI Enrichment

### Processing
- Text classification
- Sentiment analysis
- Entity extraction
- Summarization
- Translation
- Normalization

### Config
```yaml
enrichment:
  column: description
  operation: sentiment
  output: sentiment_score
  model: gpt-4
```

### Batch
- Multiple rows
- Scheduled
- Rate limiting
- Error handling

---

## NL Querying

### Examples
```
Show customers from France
Average order value by month?
Orders over $1000 last quarter
Compare sales between regions
```

### Capabilities
- Filtering, sorting
- Aggregations
- Grouping
- Calculations
- Comparisons

### Results
- Tabular display
- Charts
- Export
- Save as view

---

## Views

### Custom
- Saved filters
- Column selections
- Sort orders
- Shared views

### Visualization
- Tables
- Charts (bar, line, pie)
- Summary cards
- Pivots

### Sharing
- Team members
- Public/private
- Permissions
- Embedded

---

## Builder Integration

```yaml
- collection:
    operation: insert
    collection: customers
    data:
      name: "{{customer.name}}"
      email: "{{customer.email}}"
      created: "{{run.date}}"
```

### Operations
insert, update, delete, query, bulk

### Triggers
- Row created
- Row updated
- Row deleted
- Query executed

---

## Token Optimization

### Efficient
- Selective columns
- Batch size
- Caching
- Query optimization

### Cost
- Per-operation usage
- Per-enrichment cost
- Trends
- Budget alerts

---

## Security

### Access
- Collection-level
- Row-level
- Column-level
- View permissions

### Privacy
- PII handling
- Masking
- Encryption at rest
- Audit logging

---

## Collaboration

### Team
- Shared collections
- Collaborative editing
- Comments
- Activity history

### Sharing
- Team access
- Read-only
- Edit permissions
- Public links

---

## Use Cases

### Data Classification
- Categorization
- Auto-tagging
- Priority scoring
- Risk assessment

### Lead Enrichment
- Contact data
- Company info
- Social profiles
- Intent scoring

### Content Management
- Doc categorization
- Metadata extraction
- Tagging
- Archive management

### Analytics
- Data prep
- Feature engineering
- Trends
- Reporting

---

## Best Practices

| Practice | Description |
|----------|-------------|
| Schema Design | Plan columns upfront |
| Data Quality | Validate on import |
| Efficient Enrichment | Only needed fields |
| View Organization | Logical hierarchy |
| Access Control | Least privilege |
| Documentation | Collection purposes |

---

## Integrations

- Builder: Automations
- Knowledge: Structured data for agents
- Insights: Export data
- SecureChat: Query via chat
- Governance: Managed access
