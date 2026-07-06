import { Tool } from "@modelcontextprotocol/sdk/types.js";

export const tools: Tool[] = [
  {
    name: "create_automation",
    description: "Create a new automation in the Prisme.ai workspace",
    inputSchema: {
      type: "object",
      properties: {
        automation: {
          type: "object",
          description: "Automation object with name, do, when, arguments, etc.",
          properties: {
            slug: {
              type: "string",
              description: "Optional unique slug for the automation",
            },
            name: {
              description: "Automation name (string or localized object)",
              oneOf: [
                { type: "string" },
                { type: "object", additionalProperties: { type: "string" } },
              ],
            },
            description: {
              description:
                "Automation description (string or localized object)",
              oneOf: [
                { type: "string" },
                { type: "object", additionalProperties: { type: "string" } },
              ],
            },
            do: {
              type: "array",
              description: "List of instructions to execute",
              items: { type: "object", additionalProperties: true },
            },
            when: {
              type: "object",
              description:
                "Trigger conditions (events (listen to an event), schedules (cron string), endpoint (boolean, if true can be called as webhook))",
              properties: {
                events: { type: "array", items: { type: "string" } },
                schedules: { type: "array", items: { type: "string" } },
                endpoint: { type: "boolean" },
              },
            },
            arguments: {
              type: "object",
              description: "Automation arguments schema",
            },
            output: {
              description: "Automation result expression",
            },
            disabled: { type: "boolean" },
            private: { type: "boolean" },
          },
          required: ["name", "do"],
        },
        workspaceName: {
          type: "string",
          description:
            "Workspace name that resolves to ID via PRISME_WORKSPACES or PRISME_ENVIRONMENTS mapping",
        },
        environment: {
          type: "string",
          description:
            "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL and workspace",
        },
        workspaceId: {
          type: "string",
          description:
            "Alternative: direct workspace ID (use workspaceName instead when possible)",
        },
      },
      required: ["automation", "workspaceName"],
    },
  },
  {
    name: "get_automation",
    description:
      "Get a specific automation by its slug from the prisme.ai workspace",
    inputSchema: {
      type: "object",
      properties: {
        automationSlug: {
          type: "string",
          description: "The slug of the automation to retrieve",
        },
        workspaceName: {
          type: "string",
          description:
            "Workspace name that resolves to ID via PRISME_WORKSPACES or PRISME_ENVIRONMENTS mapping",
        },
        environment: {
          type: "string",
          description:
            "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL and workspace",
        },
        workspaceId: {
          type: "string",
          description:
            "Alternative: direct workspace ID (use workspaceName instead when possible)",
        },
      },
      required: ["automationSlug", "workspaceName"],
    },
    annotations: {
      readOnlyHint: true,
    },
  },
  {
    name: "update_automation",
    description: "Update an existing automation on the prisme.ai workspace",
    inputSchema: {
      type: "object",
      properties: {
        automationSlug: {
          type: "string",
          description: "The slug of the automation to update",
        },
        automation: {
          type: "object",
          description:
            "Automation object with fields to update. IMPORTANT: 'name' and 'do' are always required even for partial updates.",
          properties: {
            name: {
              description: "Automation name (REQUIRED even for updates)",
              oneOf: [
                { type: "string" },
                { type: "object", additionalProperties: { type: "string" } },
              ],
            },
            do: {
              type: "array",
              description: "List of instructions to execute (REQUIRED)",
              items: { type: "object", additionalProperties: true },
            },
            description: {
              description: "Automation description",
              oneOf: [
                { type: "string" },
                { type: "object", additionalProperties: { type: "string" } },
              ],
            },
            when: {
              type: "object",
              description: "Trigger conditions",
            },
            arguments: {
              type: "object",
              description: "Automation arguments schema",
            },
            output: {
              description: "Automation result expression",
            },
            disabled: { type: "boolean" },
            private: { type: "boolean" },
          },
          required: ["name", "do"],
        },
        workspaceName: {
          type: "string",
          description:
            "Workspace name that resolves to ID via PRISME_WORKSPACES or PRISME_ENVIRONMENTS mapping",
        },
        environment: {
          type: "string",
          description:
            "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL and workspace",
        },
        workspaceId: {
          type: "string",
          description:
            "Alternative: direct workspace ID (use workspaceName instead when possible)",
        },
      },
      required: ["automationSlug", "automation", "workspaceName"],
    },
    annotations: {
      destructiveHint: true,
    },
  },
  {
    name: "delete_automation",
    description: "Delete an automation from the prisme.ai workspace",
    inputSchema: {
      type: "object",
      properties: {
        automationSlug: {
          type: "string",
          description: "The slug of the automation to delete",
        },
        workspaceName: {
          type: "string",
          description:
            "Workspace name that resolves to ID via PRISME_WORKSPACES or PRISME_ENVIRONMENTS mapping",
        },
        environment: {
          type: "string",
          description:
            "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL and workspace",
        },
        workspaceId: {
          type: "string",
          description:
            "Alternative: direct workspace ID (use workspaceName instead when possible)",
        },
      },
      required: ["automationSlug", "workspaceName"],
    },
    annotations: {
      destructiveHint: true,
    },
  },
  {
    name: "list_automations",
    description: "List all automations in the Prisme.ai workspace",
    inputSchema: {
      type: "object",
      properties: {
        workspaceName: {
          type: "string",
          description:
            "Workspace name that resolves to ID via PRISME_WORKSPACES or PRISME_ENVIRONMENTS mapping",
        },
        environment: {
          type: "string",
          description:
            "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL and workspace",
        },
        workspaceId: {
          type: "string",
          description:
            "Alternative: direct workspace ID (use workspaceName instead when possible)",
        },
      },
      required: ["workspaceName"],
    },
    annotations: {
      readOnlyHint: true,
    },
  },
  {
    name: "list_apps",
    description: "Search apps from the Prisme.ai app store",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Search keywords",
        },
        workspaceId: {
          type: "string",
          description: "Filter apps published from this workspace",
        },
        workspaceName: {
          type: "string",
          description:
            "Optional workspace name that resolves to ID via PRISME_WORKSPACES mapping (for filtering apps)",
        },
        environment: {
          type: "string",
          description:
            "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL",
        },
        page: {
          type: "number",
          description: "Page number",
        },
        limit: {
          type: "number",
          description: "Page size",
        },
        labels: {
          type: "string",
          description: "Comma-separated labels list to filter on",
        },
      },
      required: [],
    },
    annotations: {
      readOnlyHint: true,
    },
  },
  {
    name: "get_app",
    description:
      "Get an app from the Prisme.ai app store with its configuration schema and automations. Use this to understand what config an app requires before installing it in the imports folder. The appSlug is case-sensitive.",
    inputSchema: {
      type: "object",
      properties: {
        appSlug: {
          type: "string",
          description:
            "The slug of the app to retrieve from the app store (case-sensitive)",
        },
        environment: {
          type: "string",
          description:
            "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL",
        },
      },
      required: ["appSlug"],
    },
    annotations: {
      readOnlyHint: true,
    },
  },
  // App Instance tools
  {
    name: "install_app_instance",
    description:
      "Install an app from the Prisme.ai app store into a workspace. Use get_app first to understand the app's configuration schema.",
    inputSchema: {
      type: "object",
      properties: {
        appInstance: {
          type: "object",
          description: "App instance configuration",
          properties: {
            appSlug: {
              type: "string",
              description: "The slug of the app from the app store to install (case-sensitive)",
            },
            slug: {
              type: "string",
              description: "Optional custom slug for this instance (defaults to appSlug)",
            },
            config: {
              type: "object",
              description: "App configuration matching the app's config schema",
            },
            disabled: {
              type: "boolean",
              description: "Whether the app instance should be disabled",
            },
            labels: {
              type: "array",
              items: { type: "string" },
              description: "Labels for the app instance",
            },
          },
          required: ["appSlug"],
        },
        workspaceName: {
          type: "string",
          description:
            "Workspace name that resolves to ID via PRISME_WORKSPACES or PRISME_ENVIRONMENTS mapping",
        },
        environment: {
          type: "string",
          description:
            "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL and workspace",
        },
        workspaceId: {
          type: "string",
          description:
            "Alternative: direct workspace ID (use workspaceName instead when possible)",
        },
      },
      required: ["appInstance", "workspaceName"],
    },
  },
  {
    name: "list_app_instances",
    description:
      "List all installed app instances in a Prisme.ai workspace. Returns summary info only (slug, appSlug, appName, disabled). Use get_app_instance for full details.",
    inputSchema: {
      type: "object",
      properties: {
        workspaceName: {
          type: "string",
          description:
            "Workspace name that resolves to ID via PRISME_WORKSPACES or PRISME_ENVIRONMENTS mapping",
        },
        environment: {
          type: "string",
          description:
            "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL and workspace",
        },
        workspaceId: {
          type: "string",
          description:
            "Alternative: direct workspace ID (use workspaceName instead when possible)",
        },
      },
      required: ["workspaceName"],
    },
    annotations: {
      readOnlyHint: true,
    },
  },
  {
    name: "get_app_instance",
    description:
      "Get details of an installed app instance by its slug",
    inputSchema: {
      type: "object",
      properties: {
        instanceSlug: {
          type: "string",
          description: "The slug of the installed app instance",
        },
        workspaceName: {
          type: "string",
          description:
            "Workspace name that resolves to ID via PRISME_WORKSPACES or PRISME_ENVIRONMENTS mapping",
        },
        environment: {
          type: "string",
          description:
            "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL and workspace",
        },
        workspaceId: {
          type: "string",
          description:
            "Alternative: direct workspace ID (use workspaceName instead when possible)",
        },
      },
      required: ["instanceSlug", "workspaceName"],
    },
    annotations: {
      readOnlyHint: true,
    },
  },
  {
    name: "update_app_instance",
    description:
      "Update an installed app instance (config, disabled status, labels)",
    inputSchema: {
      type: "object",
      properties: {
        instanceSlug: {
          type: "string",
          description: "The slug of the installed app instance to update",
        },
        appInstance: {
          type: "object",
          description: "Fields to update on the app instance",
          properties: {
            config: {
              type: "object",
              description: "Updated app configuration",
            },
            disabled: {
              type: "boolean",
              description: "Whether the app instance should be disabled",
            },
            labels: {
              type: "array",
              items: { type: "string" },
              description: "Labels for the app instance",
            },
          },
        },
        workspaceName: {
          type: "string",
          description:
            "Workspace name that resolves to ID via PRISME_WORKSPACES or PRISME_ENVIRONMENTS mapping",
        },
        environment: {
          type: "string",
          description:
            "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL and workspace",
        },
        workspaceId: {
          type: "string",
          description:
            "Alternative: direct workspace ID (use workspaceName instead when possible)",
        },
      },
      required: ["instanceSlug", "appInstance", "workspaceName"],
    },
  },
  {
    name: "uninstall_app_instance",
    description:
      "Uninstall an app instance from a workspace",
    inputSchema: {
      type: "object",
      properties: {
        instanceSlug: {
          type: "string",
          description: "The slug of the installed app instance to uninstall",
        },
        workspaceName: {
          type: "string",
          description:
            "Workspace name that resolves to ID via PRISME_WORKSPACES or PRISME_ENVIRONMENTS mapping",
        },
        environment: {
          type: "string",
          description:
            "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL and workspace",
        },
        workspaceId: {
          type: "string",
          description:
            "Alternative: direct workspace ID (use workspaceName instead when possible)",
        },
      },
      required: ["instanceSlug", "workspaceName"],
    },
    annotations: {
      destructiveHint: true,
    },
  },
  {
    name: "get_app_instance_config",
    description:
      "Get only the configuration of an installed app instance",
    inputSchema: {
      type: "object",
      properties: {
        instanceSlug: {
          type: "string",
          description: "The slug of the installed app instance",
        },
        workspaceName: {
          type: "string",
          description:
            "Workspace name that resolves to ID via PRISME_WORKSPACES or PRISME_ENVIRONMENTS mapping",
        },
        environment: {
          type: "string",
          description:
            "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL and workspace",
        },
        workspaceId: {
          type: "string",
          description:
            "Alternative: direct workspace ID (use workspaceName instead when possible)",
        },
      },
      required: ["instanceSlug", "workspaceName"],
    },
    annotations: {
      readOnlyHint: true,
    },
  },
  {
    name: "update_app_instance_config",
    description:
      "Update only the configuration of an installed app instance",
    inputSchema: {
      type: "object",
      properties: {
        instanceSlug: {
          type: "string",
          description: "The slug of the installed app instance",
        },
        config: {
          type: "object",
          description: "Configuration object to update (merged with existing config)",
        },
        workspaceName: {
          type: "string",
          description:
            "Workspace name that resolves to ID via PRISME_WORKSPACES or PRISME_ENVIRONMENTS mapping",
        },
        environment: {
          type: "string",
          description:
            "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL and workspace",
        },
        workspaceId: {
          type: "string",
          description:
            "Alternative: direct workspace ID (use workspaceName instead when possible)",
        },
      },
      required: ["instanceSlug", "config", "workspaceName"],
    },
  },
  {
    name: "publish_app",
    description:
      "Publish a workspace as a new app version in the Prisme.ai app store. On first publish, a slug is required to create the app. Subsequent publishes update the existing app.",
    inputSchema: {
      type: "object",
      properties: {
        workspaceName: {
          type: "string",
          description:
            "Workspace name that resolves to ID via PRISME_WORKSPACES or PRISME_ENVIRONMENTS mapping",
        },
        environment: {
          type: "string",
          description:
            "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL and workspace",
        },
        workspaceId: {
          type: "string",
          description:
            "Alternative: direct workspace ID (use workspaceName instead when possible)",
        },
        slug: {
          type: "string",
          description:
            "App slug: required on first publish to create the app in the store",
        },
        name: {
          type: "string",
          description: "An optional version name",
        },
        description: {
          description:
            "App description (string or localized object)",
          oneOf: [
            { type: "string" },
            { type: "object", additionalProperties: { type: "string" } },
          ],
        },
        workspaceVersion: {
          type: "string",
          description:
            "An optional workspace version to publish. If empty, publishes the latest workspace version",
        },
      },
      required: ["workspaceName"],
    },
  },
  {
    name: "unlock_workspace",
    description:
      "Remove the write lock from a Prisme.ai workspace. Use this when a workspace is stuck in a locked state.",
    inputSchema: {
      type: "object",
      properties: {
        workspaceName: {
          type: "string",
          description:
            "Workspace name (as configured in PRISME_ENVIRONMENTS or PRISME_WORKSPACES)",
        },
        environment: {
          type: "string",
          description:
            "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL and credentials",
        },
        workspaceId: {
          type: "string",
          description:
            "Optional workspace ID (overrides workspaceName resolution)",
        },
      },
    },
    annotations: {
      destructiveHint: true,
    },
  },
  {
    name: "create_workspace",
    description:
      "Create a new Prisme.ai workspace. Returns the created workspace with its ID.",
    inputSchema: {
      type: "object",
      properties: {
        workspace: {
          type: "object",
          description: "Workspace configuration",
          properties: {
            name: {
              type: "string",
              description: "Workspace name (required)",
            },
            description: {
              description: "Workspace description (string or localized object)",
              oneOf: [
                { type: "string" },
                { type: "object", additionalProperties: { type: "string" } },
              ],
            },
            photo: {
              type: "string",
              description: "Workspace photo URL",
            },
            slug: {
              type: "string",
              description: "Optional workspace slug",
            },
            labels: {
              type: "array",
              items: { type: "string" },
              description: "Labels for the workspace",
            },
          },
          required: ["name"],
        },
        environment: {
          type: "string",
          description:
            "Environment name (from PRISME_ENVIRONMENTS) to create the workspace in",
        },
      },
      required: ["workspace", "environment"],
    },
  },
  {
    name: "search_workspaces",
    description:
      "Search for workspaces by name, description, or slug. Returns workspace IDs and names. Use this to find a workspaceId from a text search.",
    inputSchema: {
      type: "object",
      properties: {
        search: {
          type: "string",
          description:
            "Search text to find workspaces by name, description, or slug",
        },
        name: {
          type: "string",
          description: "Filter by exact workspace name",
        },
        slug: {
          type: "string",
          description: "Filter by exact workspace slug",
        },
        page: {
          type: "number",
          description: "Page number for pagination. Starts at 0.",
        },
        limit: {
          type: "number",
          description: "Number of results per page",
        },
        labels: {
          type: "string",
          description: "Comma-separated labels list to filter on",
        },
        environment: {
          type: "string",
          description:
            "Environment name (from PRISME_ENVIRONMENTS) to search workspaces in",
        },
      },
      required: ["environment"],
    },
    annotations: {
      readOnlyHint: true,
    },
  },
  {
    name: "call_api",
    description:
      "Call any Prisme.ai REST API endpoint, authenticated server-side with the configured environment token (the token is NEVER exposed to the model). Use for endpoints not covered by a dedicated tool — e.g. list organizations ('/orgs'), the current IAM context ('/me'), org members, API keys, etc. `path` is relative to the environment apiUrl base, which already includes '/v2' (so pass '/orgs', not '/v2/orgs').",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "Endpoint path relative to the environment apiUrl base (which already ends in /v2). Examples: '/orgs', '/me', '/workspaces/<id>'. A leading slash is optional.",
        },
        method: {
          type: "string",
          description:
            "HTTP method (GET, POST, PATCH, PUT, DELETE). Default: GET.",
        },
        query: {
          type: "object",
          description: "Optional query-string parameters, e.g. { limit: 200 }.",
        },
        body: {
          type: "object",
          description: "Optional JSON request body for POST/PATCH/PUT.",
        },
        environment: {
          type: "string",
          description:
            "Environment name (from PRISME_ENVIRONMENTS), e.g. 'sandbox' or 'prod'. Defaults to the default environment.",
        },
        pick: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional field projection to keep responses small. Each named top-level key is kept; for list responses the projection is applied to every entry of `results`/`items` (or of a top-level array). E.g. ['slug','name'] on '/orgs'.",
        },
        asSession: {
          type: "boolean",
          description:
            "Send the token as the `access-token` cookie (browser-session auth) instead of a Bearer access token. Required for session-only endpoints like `PUT /user/active-org`; the active org set this way persists for subsequent asSession calls reusing the same token.",
        },
        apiKey: {
          type: "string",
          description:
            "Authenticate with this key as `x-prismeai-api-key` (by default NO Bearer). For an `iak_<org>_…` org key the gateway resolves the org from the key with NO membership check — use this to create/publish an agent in an org you are not a member of (e.g. POST /workspaces/slug:agent-factory/webhooks/v1/agents).",
        },
        withUserBearer: {
          type: "boolean",
          description:
            "Only with `apiKey`: ALSO send the configured user Bearer alongside the api key. Combines a real user identity (e.g. superadmin) with the org key's org context, so the gateway can take the admin/owner path while the key selects the org. Use to manage (read/update) an existing agent in another org.",
        },
      },
      required: ["path"],
    },
    annotations: {
      readOnlyHint: false,
    },
  },
  {
    name: "execute_automation",
    description:
      "Execute/test an automation already existing in the Prisme.ai workspace with optional payload",
    inputSchema: {
      type: "object",
      properties: {
        automationSlug: {
          type: "string",
          description: "The slug of the automation to execute",
        },
        payload: {
          type: "object",
          description: "Optional payload to pass to the automation",
        },
        workspaceName: {
          type: "string",
          description:
            "Workspace name that resolves to ID via PRISME_WORKSPACES or PRISME_ENVIRONMENTS mapping",
        },
        environment: {
          type: "string",
          description:
            "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL and workspace",
        },
        workspaceId: {
          type: "string",
          description:
            "Alternative: direct workspace ID (use workspaceName instead when possible)",
        },
      },
      required: ["automationSlug", "workspaceName"],
    },
    annotations: {
      openWorldHint: true,
    },
  },
  {
    name: "search_events",
    description: `Search for events in Prisme.ai workspace using Elasticsearch DSL.

    EVENT STRUCTURE:
    Events contain the following key fields:
    - @timestamp: Event timestamp (ISO 8601 format) - USE THIS FOR SORTING, NOT "timestamp"
    - id: Unique event ID
    - type: Event type (e.g., "runtime.automations.executed", "workspaces.pages.updated", "error")
    - source: Metadata object containing:
      - correlationId: Groups all events from a single API request/operation
      - userId: User who triggered the event
      - sessionId: User session identifier
      - workspaceId: Workspace identifier
      - automationSlug: Automation name (for automation-related events)
      - http: HTTP request details (method, path, hostname, ip)
      - host: Service information (replica, service name)
    - payload: Event-specific data (varies by event type)
    - createdAt: Creation timestamp

    COMMON QUERIES:
    - Find all events for a specific request: {"bool": {"filter": [{"term": {"source.correlationId": "uuid-here"}}]}}
    - Find automation executions: {"bool": {"filter": [{"term": {"type": "runtime.automations.executed"}}]}}
    - Find events for specific automation: {"bool": {"filter": [{"term": {"source.automationSlug": "automation-name"}}]}}
    - Find errors: {"bool": {"filter": [{"term": {"type": "error"}}]}}
    - Exclude specific correlationId: {"bool": {"must_not": [{"term": {"source.correlationId": "uuid-here"}}]}}

    SORTING:
    - Always use "@timestamp" field for time-based sorting: [{"@timestamp": {"order": "desc"}}]
    - DO NOT use "timestamp" as it's not mapped in the index

    COMMON EVENT TYPES:
    - runtime.automations.executed
    - runtime.interactions.triggered
    - runtime.dsul.updated
    - workspaces.automations.created/updated/deleted
    - workspaces.pages.created/updated/deleted
    - error

    ADDITIONAL INFO:
    - SearchError are probably caused by your own previous failed attempt to create filters. This is usually not the event the user ask for. Keep searching for the events before the SearchError ones.
    - Always use "source" to filter only the necessary fields. Only include the informations that are relevant to the user's request. Ignore durations, timestamps, IP adress if not asked for.

    Supports full Elasticsearch DSL query syntax including aggregations, sorting, and pagination.`,
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "object",
          description:
            'Elasticsearch DSL query object (e.g., {"match_all": {}} or {"bool": {"filter": [{"term": {"type": "event_name"}}]}})',
        },
        limit: {
          type: "number",
          description:
            "Page size (number of documents to return, default varies by API)",
        },
        page: {
          type: "number",
          description: "Page number (1-indexed)",
        },
        aggs: {
          type: "object",
          description:
            "Elasticsearch aggregations to execute on the results (e.g., count by type, group by correlationId)",
        },
        sort: {
          type: "array",
          description:
            'Elasticsearch sort criteria. IMPORTANT: Use "@timestamp" not "timestamp" for time-based sorting. Example: [{"@timestamp": {"order": "desc"}}]',
          items: { type: "object" },
        },
        source: {
          type: "array",
          description:
            'Fields to include in the response. Omit to get all fields. Example: ["correlationId", "@timestamp", "type", "source.automationSlug", "payload"]',
          items: { type: "string" },
        },
        track_total_hits: {
          type: "boolean",
          description:
            "Get real total count instead of capped at 10000 (may impact performance)",
        },
        workspaceName: {
          type: "string",
          description:
            "Workspace name that resolves to ID via PRISME_WORKSPACES or PRISME_ENVIRONMENTS mapping",
        },
        environment: {
          type: "string",
          description:
            "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL and workspace",
        },
        workspaceId: {
          type: "string",
          description:
            "Alternative: direct workspace ID (use workspaceName instead when possible)",
        },
      },
      required: ["query", "workspaceName"],
    },
    annotations: {
      readOnlyHint: true,
    },
  },
  {
    name: "get_prisme_documentation",
    description: `Returns Prisme.ai documentation by section. Call with 'index' first to see available sections.

SECTIONS:
- index: Table of contents and quick reference guide
- automations: Backend logic - triggers, instructions, expressions, memory scopes
- pages-blocks: UI components - Form, DataTable, RichText, Action, Chat, Charts, Carousel, Tabs, etc.
- workspace-config: Secrets management, workspace RBAC, one-product IAM notes, native events, versioning with Git
- advanced-features: Crawler, Custom Code, Agent Factory capabilities, Storage RAG, LLM Gateway, events
- products-overview: Current one-product platform architecture and integration patterns
- agent-creation: Agent Factory creation, prompt engineering, RAG, capabilities, evaluations
- api-selfhosting: REST/webhook API reference, one-product endpoint families, self-hosting deployment
- product-agent-factory: Agent Factory - agents, publishing, conversations, A2A, tools
- product-storage: Knowledge (Storage) - files, vector stores, indexing, RAG search
- product-llm-gateway: LLM Gateway - completions, embeddings, model catalog, routing
- product-capabilities: Capabilities catalog - MCP, file search, functions, skills, guardrails
- product-agent-evaluations: Agent Evaluations - test cases, runs, LLM-as-judge
- product-governance-v2: AI Governance v2 - IAM, API keys, service accounts, observability
- product-insights-v2: AI Insights v2 - Agent Factory analytics, criteria, feedback, GDPR
- product-collection-v3: AI Collection v3 - structured data MCP tools for agents
- product-prompt-library: Prompt Library - MCP prompts and showcases
- product-builder: Builder - DSUL workspaces, automations, pages, apps
- capability-workspaces: Backing guardrail, memory, search, vector provider, and connector workspaces
- legacy-products-overview: Legacy product architecture overview
- legacy-product-securechat: Legacy SecureChat product details
- legacy-product-store: Legacy AI Store product details
- legacy-product-knowledge: Legacy AI Knowledge and Knowledge Client details
- legacy-product-governance: Legacy AI Governance details
- legacy-product-insights: Legacy AI Insights details
- legacy-product-collection: Legacy AI Collection details`,
    inputSchema: {
      type: "object",
      properties: {
        section: {
          type: "string",
          enum: [
            "index",
            "automations",
            "pages-blocks",
            "workspace-config",
            "advanced-features",
            "products-overview",
            "agent-creation",
            "api-selfhosting",
            "product-agent-factory",
            "product-storage",
            "product-llm-gateway",
            "product-capabilities",
            "product-agent-evaluations",
            "product-governance-v2",
            "product-insights-v2",
            "product-collection-v3",
            "product-prompt-library",
            "product-builder",
            "capability-workspaces",
            "legacy-products-overview",
            "legacy-product-securechat",
            "legacy-product-store",
            "legacy-product-knowledge",
            "legacy-product-governance",
            "legacy-product-insights",
            "legacy-product-collection",
          ],
          description:
            "Documentation section to retrieve. Use 'index' to see all available sections.",
        },
      },
      required: [],
    },
    annotations: {
      readOnlyHint: true,
    },
  },
  {
    name: "validate_automation",
    description:
      "Validate Prisme.ai automation(s). Checks schema compliance, expression syntax ({{variables}} and {% code %}), unknown functions, naming conventions, and optionally strict mode. Accepts a file path, folder path (validates all .yml/.yaml/.json files), or automation object. Returns warnings (e.g., missing arguments declaration or naming convention issues) alongside errors even when the automation is valid.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to a YAML/JSON file or folder containing automations. Preferred over 'automation' when files exist on disk.",
        },
        automation: {
          type: "object",
          description: "The automation object to validate directly (use 'path' instead when possible).",
        },
        strict: {
          type: "boolean",
          description: "Enable strict mode: validates that instruction arguments match their specs. Default: false",
        },
        validateExpressions: {
          type: "boolean",
          description: "Enable expression validation ({{}} and {% %}). Default: true",
        },
      },
      required: [],
    },
    annotations: {
      readOnlyHint: true,
    },
  },
  {
    name: "report_issue_or_feedback",
    description: `Report bugs or feedback about the Prisme.ai MCP tools.

Use PROACTIVELY when you encounter issues - even mid-task. Don't wait for task completion.

Trigger on: tool errors, misleading documentation, or missing constraint information.

IMPORTANT: Report how to improve MCP tool guidance, NOT requests to change API behavior.
- GOOD: "Document that 'message' field is limited to 15 characters"
- BAD: "Increase the message limit to 50 characters"`,
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["bug", "feedback"],
          description:
            "Type of report: 'bug' for errors/issues, 'feedback' for suggestions/improvements",
        },
        message: {
          type: "string",
          description:
            "Detailed description of the issue or feedback. Include what you were trying to do, what happened, and what you expected.",
        },
        context: {
          type: "object",
          description:
            "Optional context about the failed operation (tool name, input parameters, error message)",
          properties: {
            tool: {
              type: "string",
              description: "Name of the tool that failed",
            },
            input: {
              type: "object",
              description: "Input parameters that were passed to the tool",
            },
            error: {
              type: "string",
              description: "Error message received",
            },
          },
        },
      },
      required: ["type", "message"],
    },
    annotations: {
      readOnlyHint: true,
    },
  },
  {
    name: "update_report",
    description: `Update an existing bug report or feedback.

Use this to cancel a report, edit its message, or change its type.`,
    inputSchema: {
      type: "object",
      properties: {
        reportId: {
          type: "string",
          description: "The ID of the report to update",
        },
        status: {
          type: "string",
          enum: ["cancelled", "acknowledged"],
          description: "New status for the report (e.g., 'cancelled' to cancel it)",
        },
        message: {
          type: "string",
          description: "Updated description for the report",
        },
        type: {
          type: "string",
          enum: ["bug", "feedback"],
          description: "Change the report type",
        },
      },
      required: ["reportId"],
    },
  },
  {
    name: "get_reports",
    description: "Retrieve bug reports and feedback submitted about the Prisme.ai MCP tools.",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["bug", "feedback"],
          description: "Filter by report type",
        },
        status: {
          type: "string",
          enum: ["new", "acknowledged", "resolved", "wontfix", "cancelled"],
          description: "Filter by status",
        },
        completed: {
          type: "boolean",
          description: "true = resolved/wontfix, false = new/acknowledged",
        },
        limit: {
          type: "number",
          description: "Results per page (default 20, max 100)",
        },
        page: {
          type: "number",
          description: "Page number (default 1)",
        },
      },
      required: [],
    },
    annotations: {
      readOnlyHint: true,
    },
  },
  {
    name: "pull_workspace",
    description:
      "Download the current workspace from Prisme.ai and extract it to a local directory. This will overwrite existing files.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            'Local directory path to extract workspace to (e.g., "." for current directory)',
        },
        workspaceName: {
          type: "string",
          description:
            "Workspace name that resolves to ID via PRISME_WORKSPACES or PRISME_ENVIRONMENTS mapping",
        },
        environment: {
          type: "string",
          description:
            "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL and workspace",
        },
        workspaceId: {
          type: "string",
          description:
            "Alternative: direct workspace ID (use workspaceName instead when possible)",
        },
      },
      required: ["path", "workspaceName"],
    },
  },
  {
    name: "push_workspace",
    description:
      "Upload the local workspace directory to Prisme.ai. Creates a backup version before importing. Version name (message) must not exceed 15 characters and only allows letters, numbers, hyphens, and underscores (no spaces).",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            'Local directory path containing the workspace (e.g., "." for current directory)',
        },
        message: {
          type: "string",
          description:
            "Version name for the backup (max 15 characters, only letters, numbers, hyphens, and underscores allowed - no spaces)",
          pattern: "^[a-zA-Z0-9_-]+$",
          maxLength: 15,
        },
        prune: {
          type: "boolean",
          description:
            "Delete remote files not present locally (default: true)",
        },
        workspaceName: {
          type: "string",
          description:
            "Workspace name that resolves to ID via PRISME_WORKSPACES or PRISME_ENVIRONMENTS mapping",
        },
        environment: {
          type: "string",
          description:
            "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL and workspace",
        },
        workspaceId: {
          type: "string",
          description:
            "Alternative: direct workspace ID (use workspaceName instead when possible)",
        },
      },
      required: ["path", "message", "workspaceName"],
    },
    annotations: {
      destructiveHint: true,
    },
  },
  {
    name: "push_workspace_version",
    description:
      "Push a workspace to a git repository by creating a new version.\n\n" +
      "**If the user asks to push to git, you MUST pass `gitPlatform` (or `repositoryId`) — do not call this tool without one of these selectors.** Omitting both is only valid when the caller explicitly wants a non-git local snapshot.\n\n" +
      "Selector choice:\n" +
      "- `gitPlatform` — the default for pushing to git on Prisme.ai. Pass the platform repository id (key under the workspace's `platformRepositories`). If you don't know the id, pass any plausible value; the tool will reject it and return the list of available platform repos so you can retry. Prefer this selector unless the user specifically names a workspace-level repo.\n" +
      "- `repositoryId` — only when the user explicitly references a repo declared on the workspace itself (under `repositories:` with mode `read-write`).\n\n" +
      "Response includes `pushedToGit: true|false` — if `false` after a \"push to git\" request, the call was wrong; retry with `gitPlatform`.\n\n" +
      "Common errors:\n" +
      "- 400 \"not up-to-date\": the remote has newer commits — pull the workspace and retry.\n" +
      "- A successful push holds a ~30 min write lock on the workspace; use `unlock_workspace` to release it early.",
    inputSchema: {
      type: "object",
      properties: {
        description: {
          description:
            "Version description — used as the git commit message when pushing to a repository. Provide a plain string (preferred for git pushes, as the localized object form is stringified to \"[object Object]\" in the commit message) or a localized object like `{ en: \"...\", fr: \"...\" }`.",
          oneOf: [
            { type: "string" },
            {
              type: "object",
              additionalProperties: { type: "string" },
            },
          ],
        },
        name: {
          type: "string",
          description:
            "Optional version name (e.g. \"v1.2.0\"). Auto-generated server-side if omitted.",
        },
        repositoryId: {
          type: "string",
          description:
            "Workspace-level repository id (key under `repositories:` in the workspace config). Mutually exclusive with `gitPlatform`. Omit if the workspace has a single repository.",
        },
        gitPlatform: {
          type: "string",
          description:
            "Platform-wide git repository id (key under `platformRepositories` on the workspace). **Pass this whenever the user asks to push to git on Prisme.ai** — it is the primary selector for git pushes. If you don't know the exact id, pass your best guess; the tool validates it and returns the list of available platform repos so you can retry. Mutually exclusive with `repositoryId`.",
        },
        workspaceName: {
          type: "string",
          description:
            "Workspace name that resolves to ID via PRISME_WORKSPACES or PRISME_ENVIRONMENTS mapping",
        },
        environment: {
          type: "string",
          description:
            "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL and workspace",
        },
        workspaceId: {
          type: "string",
          description:
            "Alternative: direct workspace ID (use workspaceName instead when possible)",
        },
      },
      required: ["description", "workspaceName"],
    },
    annotations: {
      destructiveHint: true,
    },
  },
  {
    name: "pull_workspace_version",
    description:
      "Pull a workspace version from a git repository, or roll back/import an existing workspace version.\n\n" +
      "**If the user asks to pull from git, you MUST pass `gitPlatform` (or `repositoryId`) — do not call this tool without one of these selectors.** Omitting both is only valid when the caller explicitly wants to roll back/import an existing workspace version.\n\n" +
      "Selector choice:\n" +
      "- `gitPlatform` — the default for pulling from git on Prisme.ai. Pass the platform repository id (key under the workspace's `platformRepositories`). If you don't know the id, pass any plausible value; the tool will reject it and return the list of available platform repos so you can retry. Prefer this selector unless the user specifically names a workspace-level repo.\n" +
      "- `repositoryId` — only when the user explicitly references a repo declared on the workspace itself.\n\n" +
      "Response includes `pulledFromGit: true|false` — if `false` after a \"pull from git\" request, the call was wrong; retry with `gitPlatform`.",
    inputSchema: {
      type: "object",
      properties: {
        versionId: {
          type: "string",
          description:
            "Workspace version id/name to pull, such as a version name or branch/ref understood by the Prisme.ai API.",
        },
        repositoryId: {
          type: "string",
          description:
            "Workspace-level repository id. Mutually exclusive with `gitPlatform`. Omit when rolling back/importing an existing workspace version.",
        },
        gitPlatform: {
          type: "string",
          description:
            "Platform-wide git repository id (key under `platformRepositories` on the workspace). **Pass this whenever the user asks to pull from git on Prisme.ai** — it is the primary selector for git pulls. If you don't know the exact id, pass your best guess; the tool validates it and returns the list of available platform repos so you can retry. Mutually exclusive with `repositoryId`.",
        },
        workspaceName: {
          type: "string",
          description:
            "Workspace name that resolves to ID via PRISME_WORKSPACES or PRISME_ENVIRONMENTS mapping",
        },
        environment: {
          type: "string",
          description:
            "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL and workspace",
        },
        workspaceId: {
          type: "string",
          description:
            "Alternative: direct workspace ID (use workspaceName instead when possible)",
        },
      },
      required: ["versionId", "workspaceName"],
    },
    annotations: {
      destructiveHint: true,
    },
  },
  // File management tools
  {
    name: "upload_file",
    description:
      "Upload a file to the Prisme.ai workspace's file storage. Returns the uploaded File object(s) with `url`, `id`, `name`, `mimetype`, `size`. The file source can be provided in one of three ways: `path` (local filesystem), `url` (remote URL fetched by the MCP), or `dataUri` (data:mime;base64,... string). Exactly one of these must be set.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "Local filesystem path to the file to upload. Mutually exclusive with `url` and `dataUri`.",
        },
        url: {
          type: "string",
          description:
            "Remote URL to fetch and re-upload to Prisme. Mutually exclusive with `path` and `dataUri`.",
        },
        dataUri: {
          type: "string",
          description:
            "Data URI string (e.g. `data:image/png;base64,iVBORw0...`). Mutually exclusive with `path` and `url`.",
        },
        fileName: {
          type: "string",
          description:
            "Override the file name stored on Prisme. Defaults to the basename of `path`/`url`, or `upload` for dataUri.",
        },
        contentType: {
          type: "string",
          description:
            "Override the MIME type. Defaults to value detected from extension/dataUri, or `application/octet-stream`.",
        },
        expiresAfter: {
          type: "number",
          description:
            "Best-effort expiration delay in seconds. The file will be deleted on the next API restart after this delay.",
        },
        public: {
          type: "boolean",
          description:
            "Set to true to grant public-read ACL. Default is true on the API side.",
        },
        shareToken: {
          type: "boolean",
          description:
            "If true, the response includes a `shareToken` that can be appended as `?token=...` to bypass auth.",
        },
        metadata: {
          type: "object",
          additionalProperties: true,
          description: "Arbitrary metadata to attach to the file.",
        },
        workspaceName: {
          type: "string",
          description:
            "Workspace name that resolves to ID via PRISME_WORKSPACES or PRISME_ENVIRONMENTS mapping",
        },
        environment: {
          type: "string",
          description:
            "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL and workspace",
        },
        workspaceId: {
          type: "string",
          description:
            "Alternative: direct workspace ID (use workspaceName instead when possible)",
        },
      },
      required: ["workspaceName"],
    },
  },
  {
    name: "list_files",
    description:
      "List files in the Prisme.ai workspace. Supports pagination, sorting and Elasticsearch-style filtering via the `query` parameter.",
    inputSchema: {
      type: "object",
      properties: {
        page: {
          type: "number",
          description: "Page number (1-based).",
        },
        limit: {
          type: "number",
          description: "Page size.",
        },
        query: {
          type: "object",
          additionalProperties: true,
          description:
            "Optional filter object serialized as query string by the API (e.g. `{ name: 'invoice.pdf' }`).",
        },
        sort: {
          type: "string",
          description: "Sort field, prefix with `-` for descending (e.g. `-createdAt`).",
        },
        workspaceName: {
          type: "string",
          description:
            "Workspace name that resolves to ID via PRISME_WORKSPACES or PRISME_ENVIRONMENTS mapping",
        },
        environment: {
          type: "string",
          description:
            "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL and workspace",
        },
        workspaceId: {
          type: "string",
          description:
            "Alternative: direct workspace ID (use workspaceName instead when possible)",
        },
      },
      required: ["workspaceName"],
    },
  },
  {
    name: "get_file",
    description:
      "Get metadata for a single file by id. Returns the File object including `url`, `name`, `mimetype`, `size`, `metadata`.",
    inputSchema: {
      type: "object",
      properties: {
        fileId: {
          type: "string",
          description: "File id (as returned by upload_file or list_files).",
        },
        workspaceName: {
          type: "string",
          description:
            "Workspace name that resolves to ID via PRISME_WORKSPACES or PRISME_ENVIRONMENTS mapping",
        },
        environment: {
          type: "string",
          description:
            "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL and workspace",
        },
        workspaceId: {
          type: "string",
          description:
            "Alternative: direct workspace ID (use workspaceName instead when possible)",
        },
      },
      required: ["fileId", "workspaceName"],
    },
  },
  {
    name: "delete_file",
    description: "Delete a file from the Prisme.ai workspace storage by id.",
    inputSchema: {
      type: "object",
      properties: {
        fileId: {
          type: "string",
          description: "File id to delete.",
        },
        workspaceName: {
          type: "string",
          description:
            "Workspace name that resolves to ID via PRISME_WORKSPACES or PRISME_ENVIRONMENTS mapping",
        },
        environment: {
          type: "string",
          description:
            "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL and workspace",
        },
        workspaceId: {
          type: "string",
          description:
            "Alternative: direct workspace ID (use workspaceName instead when possible)",
        },
      },
      required: ["fileId", "workspaceName"],
    },
    annotations: {
      destructiveHint: true,
    },
  },
  // Legacy AI Knowledge tools
  {
    name: "ai_knowledge_query",
    description: `Legacy AI Knowledge API: query an AI Knowledge project with RAG or retrieve context only. For new one-product agents, use Agent Factory messages/send or messages/stream with Storage-backed file_search.

Use method='query' (default) for full RAG response with LLM answer.
Use method='context' to retrieve document chunks only without LLM response.

Requires a legacy AI Knowledge project API key (from AI Knowledge > API & Webhooks).`,
    inputSchema: {
      type: "object",
      properties: {
        method: {
          type: "string",
          enum: ["query", "context"],
          description: "query=RAG with LLM response, context=chunks only",
        },
        projectId: {
          type: "string",
          description: "Legacy AI Knowledge project ID",
        },
        text: {
          type: "string",
          description: "User question or query text",
        },
        apiKey: {
          type: "string",
          description: "Legacy AI Knowledge project API key (from AI Knowledge > API & Webhooks)",
        },
        filters: {
          type: "array",
          description: "Document filters for RAG context",
          items: {
            type: "object",
            properties: {
              field: { type: "string" },
              type: { type: "string", enum: ["textSearch", "match", "in", "not in"] },
              value: { oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }] },
            },
          },
        },
        numberOfSearchResults: {
          type: "number",
          description: "Number of chunks to retrieve (for context method)",
        },
        history: {
          type: "object",
          description: "Conversation history for context",
          properties: {
            id: { type: "string", description: "Conversation ID" },
            messages: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  role: { type: "string", enum: ["system", "user", "assistant"] },
                  content: { type: "string" },
                },
              },
            },
          },
        },
        tool_choice: {
          type: "array",
          items: { type: "string" },
          description: "Force specific tools to be used",
        },
        environment: {
          type: "string",
          description: "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL",
        },
      },
      required: ["projectId", "text", "apiKey"],
    },
  },
  {
    name: "ai_knowledge_completion",
    description: `Legacy AI Knowledge API: direct LLM completion without RAG. For new direct model calls, use LLM Gateway v1/chat/completions or v1/embeddings.

Methods:
- chat: Simple completion using project's configured prompt/model
- openai: OpenAI-compatible chat completions endpoint
- embeddings: Generate embeddings for text
- models: List available models configured in the project

IMPORTANT: Before changing a model in a legacy AI Knowledge project, always call this tool with method='models' first to retrieve the list of available models and verify the model name exists.

Requires a legacy AI Knowledge project API key.`,
    inputSchema: {
      type: "object",
      properties: {
        method: {
          type: "string",
          enum: ["chat", "openai", "embeddings", "models"],
          description: "Completion method to use",
        },
        projectId: {
          type: "string",
          description: "Legacy AI Knowledge project ID",
        },
        apiKey: {
          type: "string",
          description: "Legacy AI Knowledge project API key",
        },
        // chat method
        prompt: {
          type: "string",
          description: "User prompt (for chat method)",
        },
        // openai method
        messages: {
          type: "array",
          description: "Messages array (for openai method)",
          items: {
            type: "object",
            properties: {
              role: { type: "string", enum: ["system", "user", "assistant", "tool"] },
              content: {
                oneOf: [
                  { type: "string" },
                  {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["text", "image_url"] },
                        text: { type: "string" },
                        image_url: {
                          type: "object",
                          properties: {
                            url: { type: "string" },
                          },
                        },
                      },
                    },
                  },
                ],
              },
            },
            required: ["role", "content"],
          },
        },
        model: {
          type: "string",
          description: "Model name to use",
        },
        temperature: {
          type: "number",
          description: "Temperature for generation (0-2)",
        },
        max_tokens: {
          type: "number",
          description: "Maximum tokens to generate",
        },
        stream: {
          type: "boolean",
          description: "Enable streaming (not recommended for MCP)",
        },
        // embeddings method
        input: {
          oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
          description: "Text input for embeddings",
        },
        dimensions: {
          type: "number",
          description: "Embedding dimensions",
        },
        environment: {
          type: "string",
          description: "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL",
        },
      },
      required: ["method", "apiKey"],
    },
  },
  {
    name: "ai_knowledge_document",
    description: `Legacy AI Knowledge API: document CRUD operations. For new RAG data, use Storage files/vector_stores APIs.

Methods:
- get: Get a document by ID
- list: List documents in a project
- create: Create a new document (text or URL)
- update: Update document metadata/content
- delete: Delete a document
- reindex: Reprocess a document
- download: Download original document file

Requires a legacy AI Knowledge project API key.`,
    inputSchema: {
      type: "object",
      properties: {
        method: {
          type: "string",
          enum: ["get", "list", "create", "update", "delete", "reindex", "download"],
          description: "Document operation to perform",
        },
        projectId: {
          type: "string",
          description: "Legacy AI Knowledge project ID",
        },
        apiKey: {
          type: "string",
          description: "Legacy AI Knowledge project API key",
        },
        // get, update, delete, reindex, download
        id: {
          type: "string",
          description: "Document ID",
        },
        externalId: {
          type: "string",
          description: "External ID for the document",
        },
        // list
        page: {
          type: "number",
          description: "Page number (for list)",
        },
        limit: {
          type: "number",
          description: "Page size (for list)",
        },
        filters: {
          type: "array",
          description: "Document filters (for list)",
          items: {
            type: "object",
            properties: {
              field: { type: "string" },
              type: { type: "string" },
              value: { oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }] },
            },
          },
        },
        includeContent: {
          type: "boolean",
          description: "Include document content in response (for list)",
        },
        includeMetadata: {
          type: "boolean",
          description: "Include metadata in response (for list)",
        },
        // create, update
        name: {
          type: "string",
          description: "Document name/title",
        },
        content: {
          type: "object",
          description: "Document content (text or URL)",
          properties: {
            text: { type: "string", description: "Text content" },
            url: { type: "string", description: "URL to crawl or source URL" },
          },
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Document tags",
        },
        parser: {
          type: "string",
          enum: ["project", "tika", "unstructured", "llm"],
          description: "Document parser to use",
        },
        // update
        status: {
          type: "string",
          enum: ["pending", "published", "inactive"],
          description: "Document status (for update)",
        },
        // reindex
        recrawl: {
          type: "boolean",
          description: "Also recrawl source URL (for reindex)",
        },
        // create
        replace: {
          type: "boolean",
          description: "Replace if document with same name exists",
        },
        flags: {
          type: "array",
          items: { type: "string", enum: ["withImages", "useOcr"] },
          description: "Processing flags (for create)",
        },
        environment: {
          type: "string",
          description: "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL",
        },
      },
      required: ["method", "projectId", "apiKey"],
    },
  },
  {
    name: "ai_knowledge_project",
    description: `Legacy AI Knowledge API: project/agent management. For new agents, use Agent Factory /v1/agents APIs.

Methods requiring project apiKey (existing project):
- get: Get a project by ID
- update: Update project configuration
- delete: Delete a project
- tools: Get available tools for a project
- datasources: Get available datasources for a project

Methods using user's Bearer token (no apiKey needed):
- list: List accessible projects
- create: Create a new project (returns new project with apiKey)
- categories: List project categories

For methods using Bearer token, use workspaceName/environment to resolve credentials.`,
    inputSchema: {
      type: "object",
      properties: {
        method: {
          type: "string",
          enum: ["get", "list", "create", "update", "delete", "tools", "datasources", "categories"],
          description: "Project operation to perform",
        },
        apiKey: {
          type: "string",
          description: "Legacy AI Knowledge project API key (required for: get, update, delete, tools, datasources)",
        },
        // get, update, delete, tools, datasources
        id: {
          type: "string",
          description: "Project ID",
        },
        // list
        page: {
          type: "number",
          description: "Page number",
        },
        perPage: {
          type: "number",
          description: "Results per page",
        },
        search: {
          type: "string",
          description: "Search by name/description",
        },
        category: {
          type: "string",
          description: "Filter by category",
        },
        owned: {
          type: "boolean",
          description: "Only return owned projects",
        },
        public: {
          type: "boolean",
          description: "Only return public projects",
        },
        withTools: {
          type: "boolean",
          description: "Include tools in response",
        },
        withDatasources: {
          type: "boolean",
          description: "Include datasources in response",
        },
        // create, update
        name: {
          type: "string",
          description: "Project name",
        },
        description: {
          type: "string",
          description: "Project description",
        },
        ai: {
          type: "object",
          description: "AI configuration",
          properties: {
            model: { type: "string", description: "Model name" },
            prompt: { type: "string", description: "System prompt" },
            temperature: { type: "number", description: "Temperature (0-2)" },
          },
        },
        // categories
        all: {
          type: "boolean",
          description: "Return all categories",
        },
        workspaceName: {
          type: "string",
          description: "Workspace name for Bearer token auth (required for: list, create, categories)",
        },
        environment: {
          type: "string",
          description: "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL",
        },
      },
      required: ["method"],
    },
  },
  {
    name: "set_token",
    description:
      "Register (or rotate) a user-created Prisme.ai API token for an environment. PRIVACY: calling this tool means the token travels through the conversation and is sent to the LLM provider. PREFER the out-of-band CLI instead — tell the user to run `node <plugin>/build/index.js set-token <environment> --config-dir <dir>` in their own terminal (the exact command is included in the 'no credentials' error); it prompts for the token with hidden input and never exposes it to the chat. Only use this tool if the user explicitly chooses to paste the token here despite that. The token is validated with a probe call to the API before being persisted to the MCP config dir (credentials.json, mode 600); an invalid token persists nothing. Pass apiUrl (and optionally studioUrl) to register an environment that is not configured yet.",
    inputSchema: {
      type: "object",
      properties: {
        environment: {
          type: "string",
          description:
            "Name of the environment the token belongs to (e.g. sandbox, prod).",
        },
        token: {
          type: "string",
          description:
            "API token created by the user in the studio (Settings > Access Tokens).",
        },
        apiUrl: {
          type: "string",
          description:
            "API base URL for the environment (e.g. https://api.sandbox.prisme.ai/v2). Required when registering a new environment; otherwise updates the stored value.",
        },
        studioUrl: {
          type: "string",
          description:
            "Studio origin for the environment (e.g. https://sandbox.prisme.ai). Optional; used to build token-creation links.",
        },
      },
      required: ["environment", "token"],
    },
  },
];
