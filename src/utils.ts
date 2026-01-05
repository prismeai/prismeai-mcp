import { PRISME_FORCE_READONLY } from "./config.js";

// Readonly mode tool sets
export const READONLY_TOOLS = new Set([
  "get_automation",
  "list_automations",
  "list_apps",
  "get_app",
  "search_events",
  "get_prisme_documentation",
  "lint_doc",
  "search_workspaces",
  "report_issue_or_feedback",
]);

export const WRITE_TOOLS = new Set([
  "create_automation",
  "update_automation",
  "delete_automation",
  "execute_automation",
  "push_workspace",
  "pull_workspace",
]);

export function enforceReadonlyMode(toolName: string): void {
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
export function truncateJsonOutput(
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
