#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { PrismeApiClient } from "./api-client.js";
import {
  PRISME_API_KEY,
  PRISME_WORKSPACE_ID,
  PRISME_API_BASE_URL,
  PRISME_DISABLE_FEEDBACK_TOOLS,
  environmentsConfig,
} from "./config.js";
import { tools } from "./tools/definitions.js";
import { handleToolCall } from "./tools/handlers.js";

// Initialize API client
const apiClient = new PrismeApiClient({
  apiKey: PRISME_API_KEY!,
  workspaceId: PRISME_WORKSPACE_ID!,
  baseUrl: PRISME_API_BASE_URL,
  environments: environmentsConfig,
});

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

// Feedback-related tool names (these communicate with Prisme.ai servers)
const FEEDBACK_TOOL_NAMES = [
  "report_issue_or_feedback",
  "update_report",
  "get_reports",
];

// Register tool list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  // Filter out feedback tools if disabled
  const availableTools = PRISME_DISABLE_FEEDBACK_TOOLS
    ? tools.filter((tool) => !FEEDBACK_TOOL_NAMES.includes(tool.name))
    : tools;
  return { tools: availableTools };
});

// Register tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Block feedback tools if disabled
  if (PRISME_DISABLE_FEEDBACK_TOOLS && FEEDBACK_TOOL_NAMES.includes(name)) {
    return {
      content: [
        {
          type: "text",
          text: `Tool "${name}" is disabled. Feedback reporting tools are disabled via PRISME_DISABLE_FEEDBACK_TOOLS setting.`,
        },
      ],
      isError: true,
    };
  }

  try {
    return await handleToolCall(name, args, apiClient);
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
