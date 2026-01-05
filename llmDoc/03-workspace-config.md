# Prisme.ai Workspace Configuration

Workspace settings, security, events, and versioning.

---

## Secrets

AES-256 encrypted. Access via `{{secret.apiKey}}`. Cannot be read from automations, only used. `prismeai_*` reserved for super admins.

```yaml
# Workspace config
config:
  value:
    headers:
      apiKey: '{{secret.apiKey}}'

# Repository config
repositories:
  github:
    config:
      auth:
        password: '{{secret.gitPassword}}'

# Automations
- fetch:
    url: https://api.example.com
    headers:
      Authorization: Bearer {{secret.apiToken}}
```

---

## RBAC (Role-Based Access Control)

```yaml
authorizations:
  roles:
    editor: {}
    user:
      auth:
        prismeai: {}
    admin:
      auth:
        prismeai:
          conditions:
            authData.email:
              $regex: ^.*@mycompany.com$
    workspace:
      auth:
        apiKey: {}

  rules:
    # Public (no role = everyone)
    - action: read
      subject: pages
      conditions:
        labels:
          $in:
            - public

    # Role-based
    - role: user
      action: read
      subject: pages

    - role: editor
      action:
        - read
        - update
      subject: pages

    - role: editor
      action: manage
      subject: files

    # Deny (inverted)
    - role: editor
      inverted: true
      action: read
      subject: events
      conditions:
        type:
          $regex: ^apikeys\.*$

    # Event permissions
    - action: create
      subject: events
      conditions:
        source.serviceTopic: topic:runtime:emit

    # API key
    - role: workspace
      action:
        - read
        - aggregate_search
      subject:
        - workspaces
        - events
```

### Subjects & Actions

| Subject | Actions |
|---------|---------|
| workspaces | read, update, delete, manage_security, manage_permissions, aggregate_search, get_usage, manage_repositories, manage |
| pages | create, read, update, delete, manage |
| files | create, read, update, delete, manage |
| events | create, read, manage |
| automations | create, read, update, delete, execute, manage |
| secrets | create, read, update, delete, manage |
| apps | create, read, update, delete, manage |

### Securing Automations
```yaml
slug: adminOnly
authorizations:
  action: admin
when:
  events:
    - initAdmin

# In RBAC rules
- role: admin
  action: execute
  subject: automations
  conditions:
    authorizations.action:
      $in:
        - admin
```

### Workspace API Keys
```yaml
- fetch:
    url: '...'
    prismeaiApiKey:
      name: workspace
```

---

## Native Events

### Workspace
| Event | Payload |
|-------|---------|
| workspaces.configured | {config} |
| workspaces.deleted | {workspaceId} |
| workspaces.imported | {files, deleted, version, errors} |
| workspaces.versions.published | {version: {name, createdAt, description}} |
| workspaces.versions.rollback | {version} |
| workspaces.pages.permissions.shared | {subjectId, permissions} |
| workspaces.pages.permissions.deleted | {subjectId, userId, email} |

### App
| Event | Payload |
|-------|---------|
| workspaces.apps.configured | {appInstance, slug} |
| workspaces.apps.installed | {appInstance, slug} |
| workspaces.apps.uninstalled | {appInstance, slug} |
| apps.published | {app} |
| apps.deleted | {appSlug} |

### Automation
| Event | Payload |
|-------|---------|
| workspaces.automations.created | {automation, slug} |
| workspaces.automations.updated | {automation, slug, oldSlug} |
| workspaces.automations.deleted | {automationSlug} |
| runtime.automations.executed | {automation, workspace, duration, throttled, status, output} |
| runtime.automations.scheduled | {slug, schedules} |

### Runtime
| Event | Payload |
|-------|---------|
| runtime.fetch.failed | {request, response: {status, body, headers}} |
| runtime.webhooks.triggered | {workspaceId, automationSlug, method} |
| runtime.schedules.triggered | {workspaceId, automationSlug, schedule} |

---

## Event Mapping (aggPayload)

```yaml
events:
  types:
    usage:
      schema:
        usage:
          type: object
          properties:
            total_tokens:
              type: number
            cost:
              type: number
              format: double
```

Query with `aggPayload.*` for aggregations.

---

## Versioning

### Git Config
```yaml
repositories:
  github:
    name: My Repo
    type: git
    mode: read-write
    config:
      url: https://github.com/User/repo.git
      branch: main
      auth:
        user: 'git user'
        password: '{{secret.gitPassword}}'
    pull:
      exclude:
        - path: 'index'
        - path: 'security'

# SSH
repositories:
  github:
    config:
      url: git@github.com:User/repo.git
      auth:
        sshkey: |-
          YOUR SSH KEY
```

**Versioned:** Pages, Blocks, Automations, Security, Apps, Settings
**Not versioned:** Events, Collection data, Files, User settings, Runtime state

---

## Debugging

### Activity Log
Filtering: Event types, time, source, search, advanced filters
Analysis: Correlation IDs, timeline, parent-child, duration

### Debug Logging
```yaml
- emit:
    event: error
    payload:
      level: "info"
      message: "Done"
      duration: "{{time}}"
```
