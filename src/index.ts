#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  CreateMessageRequest,
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";
import { PrismeApiClient } from "./api-client.js";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "fs";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import AdmZip from "adm-zip";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Validate required environment variables
const PRISME_API_KEY = process.env.PRISME_API_KEY;
const PRISME_WORKSPACE_ID = process.env.PRISME_WORKSPACE_ID;
const PRISME_API_BASE_URL =
  process.env.PRISME_API_BASE_URL || "https://api.staging.prisme.ai/v2";
const PRISME_WORKSPACES = process.env.PRISME_WORKSPACES;
const PRISME_FORCE_READONLY = process.env.PRISME_FORCE_READONLY === "true";

if (!PRISME_API_KEY || !PRISME_WORKSPACE_ID) {
  console.error(
    "Error: PRISME_API_KEY and PRISME_WORKSPACE_ID must be set in environment variables"
  );
  process.exit(1);
}

// Parse and validate workspace mappings and environments
interface WorkspaceMapping {
  [name: string]: string;
}

interface EnvironmentConfig {
  apiUrl: string;
  apiKey?: string;
  workspaces: WorkspaceMapping;
}

interface EnvironmentsConfig {
  [environmentName: string]: EnvironmentConfig;
}

const PRISME_ENVIRONMENTS = process.env.PRISME_ENVIRONMENTS;
const PRISME_DEFAULT_ENVIRONMENT =
  process.env.PRISME_DEFAULT_ENVIRONMENT || "default";

let workspaceMappings: WorkspaceMapping = {};
let environmentsConfig: EnvironmentsConfig = {};

// Parse PRISME_ENVIRONMENTS (new nested structure)
if (PRISME_ENVIRONMENTS) {
  try {
    const parsed = JSON.parse(PRISME_ENVIRONMENTS);

    // Validate format: object with environment configs
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new Error("Must be a JSON object");
    }

    for (const [envName, envConfig] of Object.entries(parsed)) {
      const config = envConfig as any;

      // Validate environment config structure
      if (typeof config !== "object" || config === null) {
        throw new Error(`Environment "${envName}" must be an object`);
      }

      if (typeof config.apiUrl !== "string") {
        throw new Error(
          `Environment "${envName}" must have an "apiUrl" string`
        );
      }

      if (config.apiKey !== undefined && typeof config.apiKey !== "string") {
        throw new Error(
          `Environment "${envName}" apiKey must be a string if provided`
        );
      }

      if (
        typeof config.workspaces !== "object" ||
        config.workspaces === null ||
        Array.isArray(config.workspaces)
      ) {
        throw new Error(
          `Environment "${envName}" must have a "workspaces" object`
        );
      }

      // Validate workspace IDs are strings
      for (const [wsName, wsId] of Object.entries(config.workspaces)) {
        if (typeof wsId !== "string") {
          throw new Error(
            `Workspace ID for "${envName}.${wsName}" must be a string`
          );
        }
      }
    }

    environmentsConfig = parsed;
    console.error(
      `Loaded ${
        Object.keys(environmentsConfig).length
      } environments: ${Object.keys(environmentsConfig).join(", ")}`
    );

    // If default environment exists in config, use its workspaces as legacy workspace mappings
    if (environmentsConfig[PRISME_DEFAULT_ENVIRONMENT]) {
      workspaceMappings =
        environmentsConfig[PRISME_DEFAULT_ENVIRONMENT].workspaces;
    }
  } catch (error) {
    console.error(
      "Error: PRISME_ENVIRONMENTS must be valid JSON with environment configs"
    );
    console.error(
      'Example: {"sandbox":{"apiUrl":"https://api.sandbox.prisme.ai/v2","workspaces":{"aiKnowledge":"wks_123"}}}'
    );
    console.error(
      `Details: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    process.exit(1);
  }
}
// Parse legacy PRISME_WORKSPACES (flat structure for backward compatibility)
else if (PRISME_WORKSPACES) {
  try {
    const parsed = JSON.parse(PRISME_WORKSPACES);

    // Validate format: object with string keys and values
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new Error("Must be a JSON object");
    }

    for (const [name, id] of Object.entries(parsed)) {
      if (typeof name !== "string" || typeof id !== "string") {
        throw new Error("Keys and values must be strings");
      }
    }

    workspaceMappings = parsed;
    console.error(
      `Loaded ${
        Object.keys(workspaceMappings).length
      } workspace mappings: ${Object.keys(workspaceMappings).join(", ")}`
    );
  } catch (error) {
    console.error(
      "Error: PRISME_WORKSPACES must be valid JSON object mapping names to IDs"
    );
    console.error('Example: {"prod":"wks_123","staging":"wks_456"}');
    console.error(
      `Details: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    process.exit(1);
  }
}

// Workspace and environment resolution helper
interface WorkspaceResolutionParams {
  workspaceId?: string;
  workspaceName?: string;
  environment?: string;
}

interface WorkspaceResolutionResult {
  workspaceId: string;
  apiUrl: string;
  environment?: string;
  source: "parameter" | "environment" | "named" | "default";
}

function resolveWorkspaceAndEnvironment(
  params: WorkspaceResolutionParams
): WorkspaceResolutionResult {
  // Priority: workspaceId parameter > environment+workspaceName > workspaceName > default

  // 1. Direct workspaceId parameter (use environment's API URL if available, else default)
  if (params.workspaceId) {
    let apiUrl = PRISME_API_BASE_URL;

    if (params.environment && environmentsConfig[params.environment]) {
      apiUrl = environmentsConfig[params.environment].apiUrl;
    }

    return {
      workspaceId: params.workspaceId,
      apiUrl,
      environment: params.environment,
      source: "parameter",
    };
  }

  // 2. Environment + workspaceName (from PRISME_ENVIRONMENTS)
  if (params.environment && params.workspaceName) {
    const envConfig = environmentsConfig[params.environment];
    if (!envConfig) {
      const availableEnvs = Object.keys(environmentsConfig);
      throw new Error(
        `Unknown environment: "${params.environment}". ` +
          `Available: ${
            availableEnvs.length > 0
              ? availableEnvs.join(", ")
              : "none configured"
          }`
      );
    }

    const workspaceId = envConfig.workspaces[params.workspaceName];
    if (!workspaceId) {
      const availableWorkspaces = Object.keys(envConfig.workspaces);
      throw new Error(
        `Unknown workspace name: "${params.workspaceName}" in environment "${params.environment}". ` +
          `Available: ${
            availableWorkspaces.length > 0
              ? availableWorkspaces.join(", ")
              : "none configured"
          }`
      );
    }

    return {
      workspaceId,
      apiUrl: envConfig.apiUrl,
      environment: params.environment,
      source: "environment",
    };
  }

  // 3. Just workspaceName (use default environment or legacy mappings)
  if (params.workspaceName) {
    // Try default environment first if it exists
    if (environmentsConfig[PRISME_DEFAULT_ENVIRONMENT]) {
      const envConfig = environmentsConfig[PRISME_DEFAULT_ENVIRONMENT];
      const workspaceId = envConfig.workspaces[params.workspaceName];
      if (workspaceId) {
        return {
          workspaceId,
          apiUrl: envConfig.apiUrl,
          environment: PRISME_DEFAULT_ENVIRONMENT,
          source: "environment",
        };
      }
    }

    // Fall back to legacy workspace mappings
    const resolvedId = workspaceMappings[params.workspaceName];
    if (!resolvedId) {
      const available = Object.keys(workspaceMappings);
      throw new Error(
        `Unknown workspace name: "${params.workspaceName}". ` +
          `Available: ${
            available.length > 0 ? available.join(", ") : "none configured"
          }`
      );
    }
    return {
      workspaceId: resolvedId,
      apiUrl: PRISME_API_BASE_URL,
      environment: undefined,
      source: "named",
    };
  }

  // 4. Just environment (use default workspace ID from that environment)
  if (params.environment) {
    const envConfig = environmentsConfig[params.environment];
    if (!envConfig) {
      const availableEnvs = Object.keys(environmentsConfig);
      throw new Error(
        `Unknown environment: "${params.environment}". ` +
          `Available: ${
            availableEnvs.length > 0
              ? availableEnvs.join(", ")
              : "none configured"
          }`
      );
    }

    return {
      workspaceId: PRISME_WORKSPACE_ID!,
      apiUrl: envConfig.apiUrl,
      environment: params.environment,
      source: "environment",
    };
  }

  // 5. Default: use configured defaults
  return {
    workspaceId: PRISME_WORKSPACE_ID!, // Non-null assertion: validated at startup
    apiUrl: PRISME_API_BASE_URL,
    environment: undefined,
    source: "default",
  };
}

// Readonly mode enforcement
const READONLY_TOOLS = new Set([
  "get_automation",
  "list_automations",
  "list_apps",
  "get_app",
  "search_events",
  "get_prisme_documentation",
  "lint_automation",
  "search_workspaces",
]);

const WRITE_TOOLS = new Set([
  "create_automation",
  "update_automation",
  "delete_automation",
  "execute_automation",
  "push_workspace",
  "pull_workspace",
]);

function enforceReadonlyMode(toolName: string): void {
  if (PRISME_FORCE_READONLY && WRITE_TOOLS.has(toolName)) {
    throw new Error(
      `Tool "${toolName}" is not available in readonly mode. ` +
        `This MCP server is configured with PRISME_FORCE_READONLY=true. ` +
        `Readonly tools available: ${Array.from(READONLY_TOOLS).join(", ")}`
    );
  }
}

/**
 * Truncates JSON output if it exceeds 10,000 characters.
 * Returns an error response with the truncated content.
 */
function truncateJsonOutput(
  data: any,
  context: string
): {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
} {
  const fullOutput = JSON.stringify(data, null, 2);
  const MAX_CHARS = 10000;

  // If output is within limits, return it normally
  if (fullOutput.length <= MAX_CHARS) {
    return {
      content: [{ type: "text", text: fullOutput }],
    };
  }

  // Output exceeds limits - truncate to MAX_CHARS
  const truncatedOutput = fullOutput.substring(0, MAX_CHARS);

  const errorMessage = `Output Size Limit Exceeded

The ${context} response is too large to display (${fullOutput.length.toLocaleString()} characters, limit: ${MAX_CHARS.toLocaleString()}).

To retrieve all results, please use pagination:
- Reduce the 'limit' parameter to fetch fewer documents per request
- Use 'page' parameter to retrieve results in chunks (e.g., page: 1, 2, 3...)
- Use 'source' parameter to include only necessary fields
- Consider adding aggregations ('aggs') instead of retrieving all documents

TRUNCATED OUTPUT (First ${MAX_CHARS.toLocaleString()} characters):
${"-".repeat(70)}
${truncatedOutput}`;

  return {
    content: [{ type: "text", text: errorMessage }],
    isError: true,
  };
}

// Initialize API client
const apiClient = new PrismeApiClient({
  apiKey: PRISME_API_KEY,
  workspaceId: PRISME_WORKSPACE_ID,
  baseUrl: PRISME_API_BASE_URL,
  environments: environmentsConfig,
});

// Define available tools
const tools: Tool[] = [
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
        workspaceId: {
          type: "string",
          description:
            "Optional workspace ID to use (overrides default workspace)",
        },
        workspaceName: {
          type: "string",
          description:
            "Optional workspace name that resolves to ID via PRISME_WORKSPACES or PRISME_ENVIRONMENTS mapping",
        },
        environment: {
          type: "string",
          description:
            "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL and workspace",
        },
      },
      required: ["automation"],
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
        workspaceId: {
          type: "string",
          description:
            "Optional workspace ID to retrieve the automation from (defaults to configured workspace)",
        },
        workspaceName: {
          type: "string",
          description:
            "Optional workspace name that resolves to ID via PRISME_WORKSPACES or PRISME_ENVIRONMENTS mapping",
        },
        environment: {
          type: "string",
          description:
            "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL and workspace",
        },
      },
      required: ["automationSlug"],
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
          description: "Partial automation object with fields to update",
        },
        workspaceId: {
          type: "string",
          description:
            "Optional workspace ID to use (overrides default workspace)",
        },
        workspaceName: {
          type: "string",
          description:
            "Optional workspace name that resolves to ID via PRISME_WORKSPACES mapping",
        },
        environment: {
          type: "string",
          description:
            "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL and workspace",
        },
      },
      required: ["automationSlug", "automation"],
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
        workspaceId: {
          type: "string",
          description:
            "Optional workspace ID to use (overrides default workspace)",
        },
        workspaceName: {
          type: "string",
          description:
            "Optional workspace name that resolves to ID via PRISME_WORKSPACES mapping",
        },
        environment: {
          type: "string",
          description:
            "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL and workspace",
        },
      },
      required: ["automationSlug"],
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
        workspaceId: {
          type: "string",
          description:
            "Optional workspace ID to list automations from (defaults to configured workspace)",
        },
        workspaceName: {
          type: "string",
          description:
            "Optional workspace name that resolves to ID via PRISME_WORKSPACES mapping",
        },
        environment: {
          type: "string",
          description:
            "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL and workspace",
        },
      },
      required: [],
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
      "Get an app from the Prisme.ai app store with its configuration schema and automations. Use this to understand what config an app requires before installing it in the imports folder.",
    inputSchema: {
      type: "object",
      properties: {
        appSlug: {
          type: "string",
          description: "The slug of the app to retrieve from the app store",
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
        workspaceId: {
          type: "string",
          description:
            "Optional workspace ID to use (overrides default workspace)",
        },
        workspaceName: {
          type: "string",
          description:
            "Optional workspace name that resolves to ID via PRISME_WORKSPACES mapping",
        },
        environment: {
          type: "string",
          description:
            "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL and workspace",
        },
      },
      required: ["automationSlug"],
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
        workspaceId: {
          type: "string",
          description:
            "Optional workspace ID to use (overrides default workspace)",
        },
        workspaceName: {
          type: "string",
          description:
            "Optional workspace name that resolves to ID via PRISME_WORKSPACES mapping",
        },
        environment: {
          type: "string",
          description:
            "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL and workspace",
        },
      },
      required: ["query"],
    },
    annotations: {
      readOnlyHint: true,
    },
  },
  {
    name: "get_prisme_documentation",
    description:
      "Returns the complete Prisme.ai documentation covering automation syntax, event handling, and API usage. Always call this before updating/editing local automations.",
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
    name: "lint_automation",
    description: `Lint a Prisme.ai automation YAML to check for common mistakes.
        
This tool performs LLM-based linting via MCP sampling to analyze the automation without cluttering the main conversation context.

Returns a structured list of violations with:
- Line references
- Error descriptions  
- Suggested fixes
- Severity levels (error/warning)`,
    inputSchema: {
      type: "object",
      properties: {
        automationYaml: {
          type: "string",
          description: "The automation YAML content to lint",
        },
      },
      required: ["automationYaml"],
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
        workspaceId: {
          type: "string",
          description:
            "Optional workspace ID to use (overrides default workspace)",
        },
        workspaceName: {
          type: "string",
          description:
            "Optional workspace name that resolves to ID via PRISME_WORKSPACES mapping",
        },
        environment: {
          type: "string",
          description:
            "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL and workspace",
        },
      },
      required: ["path"],
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
        workspaceId: {
          type: "string",
          description:
            "Optional workspace ID to use (overrides default workspace)",
        },
        workspaceName: {
          type: "string",
          description:
            "Optional workspace name that resolves to ID via PRISME_WORKSPACES mapping",
        },
        environment: {
          type: "string",
          description:
            "Optional environment name (from PRISME_ENVIRONMENTS) to use specific API URL and workspace",
        },
      },
      required: ["path", "message"],
    },
    annotations: {
      destructiveHint: true,
    },
  },
];

// Create MCP server
const server = new Server(
  {
    name: "prisme-ai-builder",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tool list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Register tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "create_automation": {
        enforceReadonlyMode("create_automation");
        const { automation, workspaceId, workspaceName, environment } =
          args as {
            automation: any;
            workspaceId?: string;
            workspaceName?: string;
            environment?: string;
          };
        const resolved = resolveWorkspaceAndEnvironment({
          workspaceId,
          workspaceName,
          environment,
        });
        const result = await apiClient.createAutomation(
          automation,
          resolved.workspaceId,
          resolved.apiUrl,
          resolved.environment
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_automation": {
        const { automationSlug, workspaceId, workspaceName, environment } =
          args as {
            automationSlug: string;
            workspaceId?: string;
            workspaceName?: string;
            environment?: string;
          };
        const resolved = resolveWorkspaceAndEnvironment({
          workspaceId,
          workspaceName,
          environment,
        });
        const result = await apiClient.getAutomation(
          automationSlug,
          resolved.workspaceId,
          resolved.apiUrl,
          resolved.environment
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "update_automation": {
        enforceReadonlyMode("update_automation");
        const {
          automationSlug,
          automation,
          workspaceId,
          workspaceName,
          environment,
        } = args as {
          automationSlug: string;
          automation: any;
          workspaceId?: string;
          workspaceName?: string;
          environment?: string;
        };
        const resolved = resolveWorkspaceAndEnvironment({
          workspaceId,
          workspaceName,
          environment,
        });
        const result = await apiClient.updateAutomation(
          automationSlug,
          automation,
          resolved.workspaceId,
          resolved.apiUrl,
          resolved.environment
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "delete_automation": {
        enforceReadonlyMode("delete_automation");
        const { automationSlug, workspaceId, workspaceName, environment } =
          args as {
            automationSlug: string;
            workspaceId?: string;
            workspaceName?: string;
            environment?: string;
          };
        const resolved = resolveWorkspaceAndEnvironment({
          workspaceId,
          workspaceName,
          environment,
        });
        const result = await apiClient.deleteAutomation(
          automationSlug,
          resolved.workspaceId,
          resolved.apiUrl,
          resolved.environment
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "list_automations": {
        const { workspaceId, workspaceName, environment } = args as {
          workspaceId?: string;
          workspaceName?: string;
          environment?: string;
        };
        const resolved = resolveWorkspaceAndEnvironment({
          workspaceId,
          workspaceName,
          environment,
        });
        const result = await apiClient.listAutomations(
          resolved.workspaceId,
          resolved.apiUrl,
          resolved.environment
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "list_apps": {
        const {
          text,
          workspaceId,
          workspaceName,
          environment,
          page,
          limit,
          labels,
        } = args as {
          text?: string;
          workspaceId?: string;
          workspaceName?: string;
          environment?: string;
          page?: number;
          limit?: number;
          labels?: string;
        };
        // Resolve environment to get the correct API URL
        const { workspaceId: resolvedWorkspaceId, apiUrl } =
          resolveWorkspaceAndEnvironment({ workspaceName, environment });
        // For list_apps, workspaceId is used for filtering
        const filterWorkspaceId =
          workspaceId || (workspaceName ? resolvedWorkspaceId : undefined);
        const result = await apiClient.listApps(
          { text, workspaceId: filterWorkspaceId, page, limit, labels },
          apiUrl,
          environment
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_app": {
        const { appSlug, environment } = args as {
          appSlug: string;
          environment?: string;
        };
        const { apiUrl } = resolveWorkspaceAndEnvironment({ environment });
        const app = await apiClient.getApp(appSlug, apiUrl, environment);
        const automations: Record<
          string,
          { description?: string; arguments?: Record<string, any> }
        > = {};
        if (app.automations) {
          for (const [slug, automation] of Object.entries(
            app.automations as Record<string, any>
          )) {
            automations[slug] = {
              description: automation.description,
              arguments: automation.arguments,
            };
          }
        }
        const result = {
          slug: app.slug,
          name: app.name,
          description: app.description,
          configSchema: app.config?.schema || {},
          automations,
        };
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "search_workspaces": {
        const { search, name, slug, page, limit, labels, environment } =
          args as {
            search?: string;
            name?: string;
            slug?: string;
            page?: number;
            limit?: number;
            labels?: string;
            environment: string;
          };
        const { apiUrl } = resolveWorkspaceAndEnvironment({ environment });
        const result = await apiClient.searchWorkspaces(
          { search, name, slug, page, limit, labels },
          apiUrl,
          environment
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "execute_automation": {
        enforceReadonlyMode("execute_automation");
        const {
          automationSlug,
          payload,
          workspaceId,
          workspaceName,
          environment,
        } = args as {
          automationSlug: string;
          payload?: any;
          workspaceId?: string;
          workspaceName?: string;
          environment?: string;
        };
        const resolved = resolveWorkspaceAndEnvironment({
          workspaceId,
          workspaceName,
          environment,
        });
        const result = await apiClient.testAutomation(
          automationSlug,
          payload,
          resolved.workspaceId,
          resolved.apiUrl,
          resolved.environment
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "search_events": {
        const { workspaceId, workspaceName, environment, ...searchQuery } =
          args as any;
        const resolved = resolveWorkspaceAndEnvironment({
          workspaceId,
          workspaceName,
          environment,
        });
        const result = await apiClient.search(
          searchQuery,
          resolved.workspaceId,
          resolved.apiUrl,
          resolved.environment
        );
        return truncateJsonOutput(result, "search_events");
      }

      case "get_prisme_documentation": {
        try {
          // Read documentation file from project root
          const docPath = join(__dirname, "..", "ai-optimized-doc.mdx");
          const documentation = readFileSync(docPath, "utf-8");
          return {
            content: [
              {
                type: "text",
                text: documentation,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error reading documentation: ${
                  error instanceof Error ? error.message : "Unknown error"
                }`,
              },
            ],
            isError: true,
          };
        }
      }

      case "lint_automation": {
        try {
          const { automationYaml } = args as { automationYaml: string };
          const lintingPath = join(__dirname, "..", "linting.mdx");
          const lintingRules = readFileSync(lintingPath, "utf-8");

          const systemPrompt = `You are a Prisme.ai automation linter. Analyze YAML automations against the provided linting rules and return ONLY a valid JSON response.

${lintingRules}`;

          const userPrompt = `Analyze this automation YAML and return a JSON object with linting results:

\`\`\`yaml
${automationYaml}
\`\`\`

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "violations": [
    {
      "line": <line_number or null if unknown>,
      "severity": "error" | "warning",
      "rule": "<rule_id>",
      "message": "<description of the issue>",
      "original": "<the problematic code snippet>",
      "fix": "<the corrected code snippet>"
    }
  ],
  "summary": {
    "errors": <count>,
    "warnings": <count>,
    "passed": <boolean>
  }
}

If no violations are found, return:
{"violations": [], "summary": {"errors": 0, "warnings": 0, "passed": true}}`;

          const samplingParams: CreateMessageRequest["params"] = {
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text: userPrompt,
                },
              },
            ],
            systemPrompt,
            maxTokens: 10000,
            includeContext: "none",
          };

          const result = await server.createMessage(samplingParams);

          let responseText = "";
          if (result.content.type === "text") {
            responseText = result.content.text;
          }

          try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const lintResult = JSON.parse(jsonMatch[0]);
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(lintResult, null, 2),
                  },
                ],
              };
            }
          } catch {
            // If JSON parsing fails, return raw response
          }

          return {
            content: [
              {
                type: "text",
                text: responseText,
              },
            ],
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          const isSamplingNotSupported =
            errorMessage.includes("sampling") ||
            errorMessage.includes("createMessage") ||
            errorMessage.includes("Method not found") ||
            errorMessage.includes("-32601");

          if (isSamplingNotSupported) {
            return {
              content: [
                {
                  type: "text",
                  text: `Sampling not supported by client. Falling back to returning linting rules.\n\nThe client (e.g., Cursor) may not support MCP sampling yet. Please analyze the automation manually using these rules:\n\n${readFileSync(
                    join(__dirname, "..", "linting.mdx"),
                    "utf-8"
                  )}`,
                },
              ],
            };
          }
          return {
            content: [
              {
                type: "text",
                text: `Error during linting: ${errorMessage}`,
              },
            ],
            isError: true,
          };
        }
      }

      case "pull_workspace": {
        enforceReadonlyMode("pull_workspace");
        const {
          path: targetPath,
          workspaceId,
          workspaceName,
          environment,
        } = args as {
          path: string;
          workspaceId?: string;
          workspaceName?: string;
          environment?: string;
        };
        const resolvedPath = resolve(targetPath);
        const resolved = resolveWorkspaceAndEnvironment({
          workspaceId,
          workspaceName,
          environment,
        });

        const zipBuffer = await apiClient.exportWorkspace(
          resolved.workspaceId,
          resolved.apiUrl,
          resolved.environment
        );
        const zip = new AdmZip(zipBuffer);

        if (!existsSync(resolvedPath)) {
          mkdirSync(resolvedPath, { recursive: true });
        }

        const extractedFiles: string[] = [];
        const currentPrefix = "current/";

        zip.getEntries().forEach((entry) => {
          if (entry.entryName.startsWith(currentPrefix)) {
            const relativePath = entry.entryName.slice(currentPrefix.length);
            if (relativePath) {
              const targetFilePath = join(resolvedPath, relativePath);
              if (entry.isDirectory) {
                if (!existsSync(targetFilePath)) {
                  mkdirSync(targetFilePath, { recursive: true });
                }
              } else {
                const fileDir = dirname(targetFilePath);
                if (!existsSync(fileDir)) {
                  mkdirSync(fileDir, { recursive: true });
                }
                writeFileSync(targetFilePath, entry.getData());
                extractedFiles.push(relativePath);
              }
            }
          }
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  path: resolvedPath,
                  filesExtracted: extractedFiles.length,
                  files: extractedFiles,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "push_workspace": {
        enforceReadonlyMode("push_workspace");
        const {
          path: sourcePath,
          message,
          prune = true,
          workspaceId,
          workspaceName,
          environment,
        } = args as {
          path: string;
          message: string;
          prune?: boolean;
          workspaceId?: string;
          workspaceName?: string;
          environment?: string;
        };
        const resolvedPath = resolve(sourcePath);
        const resolved = resolveWorkspaceAndEnvironment({
          workspaceId,
          workspaceName,
          environment,
        });

        if (!existsSync(resolvedPath)) {
          return {
            content: [
              {
                type: "text",
                text: `Error: Directory not found: ${resolvedPath}`,
              },
            ],
            isError: true,
          };
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(message)) {
          return {
            content: [
              {
                type: "text",
                text: `Error: Invalid message format. Only letters, numbers, hyphens, and underscores are allowed (no spaces).`,
              },
            ],
            isError: true,
          };
        }

        if (message.length > 15) {
          return {
            content: [
              {
                type: "text",
                text: `Error: Version name must be 15 characters or less (got ${message.length} characters).`,
              },
            ],
            isError: true,
          };
        }

        const backupResult = await apiClient.publishVersion(
          message,
          `Backup before MCP push: ${message}`,
          resolved.workspaceId,
          resolved.apiUrl,
          resolved.environment
        );

        const zip = new AdmZip();

        const addDirectoryToZip = (dirPath: string, zipPath: string = "") => {
          const entries = readdirSync(dirPath);
          for (const entry of entries) {
            const fullPath = join(dirPath, entry);
            const entryZipPath = zipPath ? `${zipPath}/${entry}` : entry;
            const stat = statSync(fullPath);

            if (stat.isDirectory()) {
              addDirectoryToZip(fullPath, entryZipPath);
            } else {
              zip.addLocalFile(fullPath, zipPath || undefined);
            }
          }
        };

        addDirectoryToZip(resolvedPath);

        const zipBuffer = zip.toBuffer();
        const importResult = await apiClient.importWorkspace(
          zipBuffer,
          prune,
          resolved.workspaceId,
          resolved.apiUrl,
          resolved.environment
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  backup: backupResult,
                  import: importResult,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const axiosError = error as any;

    // Check for workspace/environment resolution errors
    if (
      errorMessage.includes("Unknown workspace name") ||
      errorMessage.includes("Unknown environment")
    ) {
      return {
        content: [
          {
            type: "text",
            text: `Resolution Error: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }

    // Check for readonly mode violations
    if (errorMessage.includes("readonly mode")) {
      return {
        content: [
          {
            type: "text",
            text: `Access Denied: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }

    // Include API error details if available
    if (axiosError.response) {
      return {
        content: [
          {
            type: "text",
            text: `API Error: ${axiosError.response.status} - ${JSON.stringify(
              axiosError.response.data,
              null,
              2
            )}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Prisme.ai Builder MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
