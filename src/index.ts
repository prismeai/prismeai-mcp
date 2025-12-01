#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    Tool,
    CreateMessageRequest,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { PrismeApiClient } from './api-client.js';
import { readFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import AdmZip from 'adm-zip';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Validate required environment variables
const PRISME_API_KEY = process.env.PRISME_API_KEY;
const PRISME_WORKSPACE_ID = process.env.PRISME_WORKSPACE_ID;
const PRISME_API_BASE_URL = process.env.PRISME_API_BASE_URL || 'https://api.staging.prisme.ai/v2';

if (!PRISME_API_KEY || !PRISME_WORKSPACE_ID) {
    console.error('Error: PRISME_API_KEY and PRISME_WORKSPACE_ID must be set in environment variables');
    process.exit(1);
}

// Initialize API client
const apiClient = new PrismeApiClient({
    apiKey: PRISME_API_KEY,
    workspaceId: PRISME_WORKSPACE_ID,
    baseUrl: PRISME_API_BASE_URL,
});

// Define available tools
const tools: Tool[] = [
    {
        name: 'create_automation',
        description: 'Create a new automation in the Prisme.ai workspace',
        inputSchema: {
            type: 'object',
            properties: {
                automation: {
                    type: 'object',
                    description: 'Automation object with name, do, when, arguments, etc.',
                    properties: {
                        slug: { type: 'string', description: 'Optional unique slug for the automation' },
                        name: {
                            description: 'Automation name (string or localized object)',
                            oneOf: [
                                { type: 'string' },
                                { type: 'object', additionalProperties: { type: 'string' } }
                            ]
                        },
                        description: {
                            description: 'Automation description (string or localized object)',
                            oneOf: [
                                { type: 'string' },
                                { type: 'object', additionalProperties: { type: 'string' } }
                            ]
                        },
                        do: {
                            type: 'array',
                            description: 'List of instructions to execute',
                        },
                        when: {
                            type: 'object',
                            description: 'Trigger conditions (events (listen to an event), schedules (cron string), endpoint (boolean, if true can be called as webhook))',
                            properties: {
                                events: { type: 'array', items: { type: 'string' } },
                                schedules: { type: 'array', items: { type: 'string' } },
                                endpoint: { type: 'boolean' }
                            }
                        },
                        arguments: {
                            type: 'object',
                            description: 'Automation arguments schema'
                        },
                        output: {
                            description: 'Automation result expression'
                        },
                        disabled: { type: 'boolean' },
                        private: { type: 'boolean' }
                    },
                    required: ['name', 'do']
                }
            },
            required: ['automation']
        }
    },
    {
        name: 'get_automation',
        description: 'Get a specific automation by its slug from the prisme.ai workspace',
        inputSchema: {
            type: 'object',
            properties: {
                automationSlug: {
                    type: 'string',
                    description: 'The slug of the automation to retrieve'
                }
            },
            required: ['automationSlug']
        }
    },
    {
        name: 'update_automation',
        description: 'Update an existing automation on the prisme.ai workspace',
        inputSchema: {
            type: 'object',
            properties: {
                automationSlug: {
                    type: 'string',
                    description: 'The slug of the automation to update'
                },
                automation: {
                    type: 'object',
                    description: 'Partial automation object with fields to update'
                }
            },
            required: ['automationSlug', 'automation']
        }
    },
    {
        name: 'delete_automation',
        description: 'Delete an automation from the prisme.ai workspace',
        inputSchema: {
            type: 'object',
            properties: {
                automationSlug: {
                    type: 'string',
                    description: 'The slug of the automation to delete'
                }
            },
            required: ['automationSlug']
        }
    },
    {
        name: 'list_automations',
        description: 'List all automations in the Prisme.ai workspace',
        inputSchema: {
            type: 'object',
            properties: {},
            required: []
        }
    },
    {
        name: 'execute_automation',
        description: 'Execute/test an automation already existing in the Prisme.ai workspace with optional payload',
        inputSchema: {
            type: 'object',
            properties: {
                automationSlug: {
                    type: 'string',
                    description: 'The slug of the automation to execute'
                },
                payload: {
                    type: 'object',
                    description: 'Optional payload to pass to the automation'
                }
            },
            required: ['automationSlug']
        }
    },
    {
        name: 'search_events',
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
            type: 'object',
            properties: {
                query: {
                    type: 'object',
                    description: 'Elasticsearch DSL query object (e.g., {"match_all": {}} or {"bool": {"filter": [{"term": {"type": "event_name"}}]}})'
                },
                limit: {
                    type: 'number',
                    description: 'Page size (number of documents to return, default varies by API)'
                },
                page: {
                    type: 'number',
                    description: 'Page number (1-indexed)'
                },
                aggs: {
                    type: 'object',
                    description: 'Elasticsearch aggregations to execute on the results (e.g., count by type, group by correlationId)'
                },
                sort: {
                    type: 'array',
                    description: 'Elasticsearch sort criteria. IMPORTANT: Use "@timestamp" not "timestamp" for time-based sorting. Example: [{"@timestamp": {"order": "desc"}}]',
                    items: { type: 'object' }
                },
                source: {
                    type: 'array',
                    description: 'Fields to include in the response. Omit to get all fields. Example: ["correlationId", "@timestamp", "type", "source.automationSlug", "payload"]',
                    items: { type: 'string' }
                },
                track_total_hits: {
                    type: 'boolean',
                    description: 'Get real total count instead of capped at 10000 (may impact performance)'
                }
            },
            required: ['query']
        }
    },
    {
        name: 'get_prisme_documentation',
        description: 'Returns the complete Prisme.ai documentation covering automation syntax, event handling, and API usage. Always call this before updating/editing local automations.',
        inputSchema: {
            type: 'object',
            properties: {},
            required: []
        }
    },
    {
        name: 'lint_automation',
        description: `Lint a Prisme.ai automation YAML to check for common mistakes.
        
This tool performs LLM-based linting via MCP sampling to analyze the automation without cluttering the main conversation context.

Returns a structured list of violations with:
- Line references
- Error descriptions  
- Suggested fixes
- Severity levels (error/warning)`,
        inputSchema: {
            type: 'object',
            properties: {
                automationYaml: {
                    type: 'string',
                    description: 'The automation YAML content to lint'
                }
            },
            required: ['automationYaml']
        }
    },
    {
        name: 'pull_workspace',
        description: 'Download the current workspace from Prisme.ai and extract it to a local directory. This will overwrite existing files.',
        inputSchema: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'Local directory path to extract workspace to (e.g., "." for current directory)'
                }
            },
            required: ['path']
        }
    },
    {
        name: 'push_workspace',
        description: 'Upload the local workspace directory to Prisme.ai. Creates a backup version "MCP backup" before importing.',
        inputSchema: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'Local directory path containing the workspace (e.g., "." for current directory)'
                },
                prune: {
                    type: 'boolean',
                    description: 'Delete remote files not present locally (default: true)'
                }
            },
            required: ['path']
        }
    }
];

// Create MCP server
const server = new Server(
    {
        name: 'prisme-ai-builder',
        version: '1.0.0',
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
            case 'create_automation': {
                const { automation } = args as { automation: any };
                const result = await apiClient.createAutomation(automation);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                };
            }

            case 'get_automation': {
                const { automationSlug } = args as { automationSlug: string };
                const result = await apiClient.getAutomation(automationSlug);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                };
            }

            case 'update_automation': {
                const { automationSlug, automation } = args as { automationSlug: string; automation: any };
                const result = await apiClient.updateAutomation(automationSlug, automation);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                };
            }

            case 'delete_automation': {
                const { automationSlug } = args as { automationSlug: string };
                const result = await apiClient.deleteAutomation(automationSlug);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                };
            }

            case 'list_automations': {
                const result = await apiClient.listAutomations();
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                };
            }

            case 'execute_automation': {
                const { automationSlug, payload } = args as { automationSlug: string; payload?: any };
                const result = await apiClient.testAutomation(automationSlug, payload);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                };
            }

            case 'search_events': {
                const searchQuery = args as any;
                const result = await apiClient.search(searchQuery);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                };
            }

            case 'get_prisme_documentation': {
                try {
                    // Read documentation file from project root
                    const docPath = join(__dirname, '..', 'ai-optimized-doc.mdx');
                    const documentation = readFileSync(docPath, 'utf-8');
                    return {
                        content: [
                            {
                                type: 'text',
                                text: documentation
                            }
                        ]
                    };
                } catch (error) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Error reading documentation: ${error instanceof Error ? error.message : 'Unknown error'}`
                            }
                        ],
                        isError: true
                    };
                }
            }

            case 'lint_automation': {
                try {
                    const { automationYaml } = args as { automationYaml: string };
                    const lintingPath = join(__dirname, '..', 'linting.mdx');
                    const lintingRules = readFileSync(lintingPath, 'utf-8');
                    
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

                    const samplingParams: CreateMessageRequest['params'] = {
                        messages: [
                            {
                                role: 'user',
                                content: {
                                    type: 'text',
                                    text: userPrompt
                                }
                            }
                        ],
                        systemPrompt,
                        maxTokens: 10000,
                        includeContext: 'none'
                    };

                    const result = await server.createMessage(samplingParams);
                    
                    let responseText = '';
                    if (result.content.type === 'text') {
                        responseText = result.content.text;
                    }
                    
                    try {
                        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                        if (jsonMatch) {
                            const lintResult = JSON.parse(jsonMatch[0]);
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: JSON.stringify(lintResult, null, 2)
                                    }
                                ]
                            };
                        }
                    } catch {
                        // If JSON parsing fails, return raw response
                    }
                    
                    return {
                        content: [
                            {
                                type: 'text',
                                text: responseText
                            }
                        ]
                    };
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    if (errorMessage.includes('sampling') || errorMessage.includes('createMessage')) {
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `Sampling not supported by client. Falling back to returning linting rules.\n\nThe client (e.g., Cursor) may not support MCP sampling yet. Please analyze the automation manually using these rules:\n\n${readFileSync(join(__dirname, '..', 'linting.mdx'), 'utf-8')}`
                                }
                            ]
                        };
                    }
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Error during linting: ${errorMessage}`
                            }
                        ],
                        isError: true
                    };
                }
            }

            case 'pull_workspace': {
                const { path: targetPath } = args as { path: string };
                const resolvedPath = resolve(targetPath);

                const zipBuffer = await apiClient.exportWorkspace();
                const zip = new AdmZip(zipBuffer);

                if (!existsSync(resolvedPath)) {
                    mkdirSync(resolvedPath, { recursive: true });
                }

                zip.extractAllTo(resolvedPath, true);

                const extractedFiles: string[] = [];
                zip.getEntries().forEach(entry => {
                    if (!entry.isDirectory) {
                        extractedFiles.push(entry.entryName);
                    }
                });

                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                path: resolvedPath,
                                filesExtracted: extractedFiles.length,
                                files: extractedFiles
                            }, null, 2)
                        }
                    ]
                };
            }

            case 'push_workspace': {
                const { path: sourcePath, prune = true } = args as { path: string; prune?: boolean };
                const resolvedPath = resolve(sourcePath);

                if (!existsSync(resolvedPath)) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Error: Directory not found: ${resolvedPath}`
                            }
                        ],
                        isError: true
                    };
                }

                const backupResult = await apiClient.publishVersion('MCP backup', 'Backup before MCP push');

                const zip = new AdmZip();

                const addDirectoryToZip = (dirPath: string, zipPath: string = '') => {
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
                const importResult = await apiClient.importWorkspace(zipBuffer, prune);

                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                backup: backupResult,
                                import: importResult
                            }, null, 2)
                        }
                    ]
                };
            }

            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const axiosError = error as any;

        // Include API error details if available
        if (axiosError.response) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `API Error: ${axiosError.response.status} - ${JSON.stringify(axiosError.response.data, null, 2)}`
                    }
                ],
                isError: true
            };
        }

        return {
            content: [
                {
                    type: 'text',
                    text: `Error: ${errorMessage}`
                }
            ],
            isError: true
        };
    }
});

// Start the server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Prisme.ai Builder MCP server running on stdio');
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
