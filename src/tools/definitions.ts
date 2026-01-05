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
          description: "Page number for pagination",
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
- automations: Backend logic - triggers (webhook/event/schedule), instructions (set/fetch/emit/repeat/conditions), expressions, memory scopes
- pages-blocks: UI components - Form, DataTable, RichText, Action, Chat, Charts, Carousel, Tabs, etc.
- workspace-config: Secrets management, RBAC security rules, native events, versioning with Git
- advanced-features: Web crawler, Custom Code (JS), tool-calling agents, RAG pipelines
- products-overview: Platform architecture - SecureChat, Store, Knowledge, Builder, Collection, Governance, Insights
- agent-creation: Prompt engineering patterns, agent types (simple/RAG/tool-using/multi-agent)
- api-selfhosting: REST API reference, microservices, self-hosting deployment
- product-securechat: SecureChat product details
- product-store: Agent marketplace details
- product-knowledge: Knowledge/RAG management details
- product-builder: Builder orchestration details
- product-governance: Platform administration details
- product-insights: Conversation analytics details
- product-collection: Tabular data + AI details`,
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
            "product-securechat",
            "product-store",
            "product-knowledge",
            "product-builder",
            "product-governance",
            "product-insights",
            "product-collection",
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
    name: "lint_doc",
    description:
      "Get the Prisme.ai automation linting rules document. Returns guidelines and common mistakes to check when reviewing automation YAML.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    annotations: {
      readOnlyHint: true,
    },
  },
  {
    name: "report_issue_or_feedback",
    description: `Report bugs or provide feedback about the Prisme.ai MCP tools.

Use this tool when:
- Your previous tool executions failed repeatedly
- You encountered an API error from any Prisme.ai tool
- Documentation was incorrect or misleading
- You created an automation or page that errored due to syntax issues
- You discovered a discrepancy between documentation and actual behavior

Reports submitted here help improve the MCP tools and documentation, enabling you to complete tasks more reliably in the future.`,
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
      "Upload the local workspace directory to Prisme.ai. Creates a backup version before importing.",
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
];
