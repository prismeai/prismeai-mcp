# API Reference & Self-Hosting

## API Overview

RESTful API, JSON requests/responses.

| Setting | Value |
|---------|-------|
| Base URL | `https://api.studio.prisme.ai` |
| Version | `v2` |
| Content-Type | `application/json` |
| Auth | `Authorization: Bearer TOKEN` |

### Examples
```bash
# Status check
curl -X GET "https://api.studio.prisme.ai/"

# Authenticated
curl -X GET "https://api.studio.prisme.ai/v2/workspaces" \
     -H "Authorization: Bearer TOKEN"
```

---

## Microservices

| Service | Description |
|---------|-------------|
| API Gateway | Auth, sessions, routing |
| Workspaces | Workspace management |
| Runtime | Automation execution |
| Events | Event management |
| Console | Platform console |
| Pages | End-user rendering |

---

## Endpoints

### Workspaces
```
GET    /v2/workspaces              # List
POST   /v2/workspaces              # Create
GET    /v2/workspaces/:id          # Get
PUT    /v2/workspaces/:id          # Update
DELETE /v2/workspaces/:id          # Delete
```

### Webhooks/Automations
```
POST   /v2/workspaces/:id/webhooks/:slug   # Trigger
```

### Secrets
```
GET    /v2/workspaces/:id/security/secrets
POST   /v2/workspaces/:id/security/secrets
DELETE /v2/workspaces/:id/security/secrets/:key
```

---

# Self-Hosting

## Deployment Options

| Option | Description |
|--------|-------------|
| SaaS Managed | Shared/dedicated, Prisme.ai hosted |
| Self-Hosted | AWS, GCP, Azure, OVH |
| Co-Managed | Joint management |

**Benefits:** Data sovereignty, Security compliance, Customization, Cost efficiency

## Environments

| Environment | Support |
|-------------|---------|
| Kubernetes | Helm, operators |
| Docker | Docker-compose |
| Cloud | EKS, AKS, GKE, OpenShift |
| Providers | AWS, Azure, GCP, OVH |

## Components

| Component | Description |
|-----------|-------------|
| Workspace | Core AI environment |
| Event | Event-driven interactions |
| Runtime | Agent execution |
| API Gateway | Secure endpoints |
| Data Stores | MongoDB/PostgreSQL, Redis, ES/OpenSearch |
| Auth | OIDC, SAML |

---

## Workspace Config

### Basic
```yaml
name: MyWorkspace
slug: test
config:
  value:
    API_URL: https://api.mycompany.com
    LOGIN_URL: "{{config.API_URL}}/login"
    headers:
      apiKey: someAPIKey
```

### Secrets
```yaml
config:
  value:
    headers:
      apiKey: "{{secret.apiKey}}"
```

### Environment Variables
```
WORKSPACE_CONFIG_test_API_URL=https://api.mycompany.com
```

### Schema
```yaml
config:
  schema:
    type: object
    properties:
      API_URL:
        type: string
        title: API URL
      maxRetries:
        type: number
        default: 3
  value:
    API_URL: https://api.mycompany.com
    maxRetries: 5
```

---

## Secrets

```yaml
# Config
config:
  value:
    headers:
      apiKey: '{{secret.apiKey}}'

# Repository
repositories:
  github:
    config:
      auth:
        password: '{{secret.gitPassword}}'
```

`prismeai_*` reserved for super admins.

---

## Version Control

### Git Config
```yaml
repositories:
  github:
    name: My Repo
    type: git
    mode: read-write  # read-only, write-only
    config:
      url: https://github.com/User/repo.git
      branch: main
      auth:
        user: 'git user'
        password: '{{secret.gitPassword}}'
```

### SSH
```yaml
repositories:
  github:
    config:
      url: git@github.com:User/repo.git
      auth:
        sshkey: |-
          YOUR SSH KEY
```

### Exclude Files
```yaml
repositories:
  github:
    pull:
      exclude:
        - path: 'index'
        - path: 'security'
```

---

## Custom Domains

1. Add CNAME to `pages.prisme.ai`
2. Configure:
```yaml
customDomains:
  - www.example.com
```
3. Contact support for activation

---

## JSON Schema Forms

```yaml
type: object
properties:
  firstName:
    type: string
    title: Firstname
  birthdate:
    type: string
    ui:widget: date
  genre:
    type: string
    enum: ['1', '2', '3']
    enumNames: ['Man', 'Woman', 'Other']
  address:
    type: string
    ui:widget: textarea
```

### Types
- `string`, `localized:string`, `number`, `boolean`, `object`, `array`

### Widgets
- `textarea`, `date`, `color`, `password`

### Validators
```yaml
properties:
  email:
    type: string
    validators:
      required: true
      email: true
  password:
    type: string
    ui:widget: password
    validators:
      required: true
      minLength:
        value: 8
        message: Min 8 chars
```

---

## Events

### Structure
```json
{
  "type": "event-name",
  "payload": { ... },
  "source": {
    "userId": "...",
    "sessionId": "...",
    "correlationId": "...",
    "automationSlug": "..."
  }
}
```

### Types
- **Native:** Platform-generated
- **Custom:** Automation/app emitted

### Retention
- Up to 3 years
- Inactive (>15 days, <100 events): regularly deleted
- Deleted workspace: 6 months

---

## Deployment Steps

1. Evaluate requirements
2. Choose model (Docker/K8s/Cloud)
3. Configure and customize
4. Deploy and scale

## Cloud Guides

| Provider | Options |
|----------|---------|
| AWS | EKS, EC2, managed services |
| Azure | AKS, Azure services |
| GCP | GKE, Google Cloud |
| OpenShift | Red Hat deployment |

## Operations

| Area | Topics |
|------|--------|
| Testing | Deployment validation |
| Updates | Versions, migrations |
| Backup | Data strategies |
| Scaling | Horizontal/vertical |
| Monitoring | Prometheus, Grafana |
