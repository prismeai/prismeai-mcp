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
    name: "validate_automation",
    description:
      "Validate Prisme.ai automation(s). Checks schema compliance, expression syntax ({{variables}} and {% code %}), unknown functions, and optionally strict mode. Accepts a file path, folder path (validates all .yml/.yaml/.json files), or automation object.",
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
        validateNaming: {
          type: "boolean",
          description: "Enable naming convention validation: checks automation names (camelCase with verb/on prefix), slugs (camelCase only), descriptions (required), arguments (required), variable names in set (camelCase), and event names in emit (Namespace.entity.action format). Default: false",
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
  // AI Knowledge tools
  {
    name: "ai_knowledge_query",
    description: `Query an AI Knowledge agent with RAG or retrieve context only.

Use method='query' (default) for full RAG response with LLM answer.
Use method='context' to retrieve document chunks only without LLM response.

Requires an AI Knowledge project API key (from AI Knowledge > API & Webhooks).`,
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
          description: "AI Knowledge project ID",
        },
        text: {
          type: "string",
          description: "User question or query text",
        },
        apiKey: {
          type: "string",
          description: "AI Knowledge project API key (from AI Knowledge > API & Webhooks)",
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
    description: `Direct LLM completion without RAG.

Methods:
- chat: Simple completion using project's configured prompt/model
- openai: OpenAI-compatible chat completions endpoint
- embeddings: Generate embeddings for text
- models: List available models configured in the project

IMPORTANT: Before changing a model in an AI Knowledge project, always call this tool with method='models' first to retrieve the list of available models and verify the model name exists.

Requires an AI Knowledge project API key.`,
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
          description: "AI Knowledge project ID",
        },
        apiKey: {
          type: "string",
          description: "AI Knowledge project API key",
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
    description: `Document CRUD operations for AI Knowledge.

Methods:
- get: Get a document by ID
- list: List documents in a project
- create: Create a new document (text or URL)
- update: Update document metadata/content
- delete: Delete a document
- reindex: Reprocess a document
- download: Download original document file

Requires an AI Knowledge project API key.`,
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
          description: "AI Knowledge project ID",
        },
        apiKey: {
          type: "string",
          description: "AI Knowledge project API key",
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
    description: `Project/Agent management for AI Knowledge.

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
          description: "AI Knowledge project API key (required for: get, update, delete, tools, datasources)",
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
];
