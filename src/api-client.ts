import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';

export interface EnvironmentConfig {
    apiUrl: string;
    apiKey?: string;
    workspaces?: Record<string, string>;
    default?: boolean;
}

export interface EnvironmentsConfig {
    [environmentName: string]: EnvironmentConfig;
}

export interface PrismeConfig {
    apiKey: string;
    workspaceId: string;
    baseUrl: string;
    environments?: EnvironmentsConfig;
}

export interface Automation {
    slug?: string;
    name: string | Record<string, string>;
    description?: string | Record<string, string>;
    do: any[];
    when?: {
        events?: string[];
        schedules?: string[];
        endpoint?: boolean | string;
    };
    arguments?: Record<string, any>;
    output?: any;
    disabled?: boolean;
    private?: boolean;
    [key: string]: any;
}

export interface SearchQuery {
    scope?: 'events';
    query: Record<string, any>;
    limit?: number;
    page?: number;
    aggs?: Record<string, any>;
    sort?: Record<string, any>[];
    source?: string[];
    track_total_hits?: boolean;
}

export interface SearchResponse {
    size: number;
    documents: any[];
    aggs?: Record<string, any>;
}

export interface ListAppsParams {
    text?: string;
    workspaceId?: string;
    page?: number;
    limit?: number;
    labels?: string;
}

export interface SearchWorkspacesParams {
    search?: string;
    name?: string;
    slug?: string;
    page?: number;
    limit?: number;
    labels?: string;
    ids?: string;
    email?: string;
    sort?: string;
}

// AI Knowledge API types
export interface AIKnowledgeQueryParams {
    method?: 'query' | 'context';
    projectId: string;
    text: string;
    filters?: Array<{ field: string; type: string; value: string | string[] }>;
    numberOfSearchResults?: number;
    history?: { id?: string; messages?: Array<{ role: string; content: string }> };
    tool_choice?: string[];
}

export interface AIKnowledgeCompletionParams {
    method: 'chat' | 'openai' | 'embeddings' | 'models';
    projectId?: string;
    // chat method
    prompt?: string;
    // openai method
    messages?: Array<{ role: string; content: string | any[] }>;
    model?: string;
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
    // embeddings method
    input?: string | string[];
    dimensions?: number;
}

export interface AIKnowledgeDocumentParams {
    method: 'get' | 'list' | 'create' | 'update' | 'delete' | 'reindex' | 'download';
    projectId: string;
    // get, update, delete, reindex, download
    id?: string;
    externalId?: string;
    // list
    page?: number;
    limit?: number;
    filters?: Array<{ field: string; type: string; value: string | string[] }>;
    includeContent?: boolean;
    includeMetadata?: boolean;
    // create, update
    name?: string;
    content?: { text?: string; url?: string };
    tags?: string[];
    parser?: 'project' | 'tika' | 'unstructured' | 'llm';
    // update
    status?: 'pending' | 'published' | 'inactive';
    // reindex
    recrawl?: boolean;
    // create
    replace?: boolean;
    flags?: string[];
}

export interface AIKnowledgeProjectParams {
    method: 'get' | 'list' | 'create' | 'update' | 'delete' | 'tools' | 'datasources' | 'categories';
    // get, update, delete, tools, datasources
    id?: string;
    // list
    page?: number;
    perPage?: number;
    search?: string;
    category?: string;
    owned?: boolean;
    public?: boolean;
    withTools?: boolean;
    withDatasources?: boolean;
    // create, update
    name?: string;
    description?: string;
    ai?: { model?: string; prompt?: string; temperature?: number };
    // categories
    all?: boolean;
}

// Auth type for AI Knowledge API
export type AIKnowledgeAuth =
    | { type: 'apiKey'; apiKey: string }
    | { type: 'bearer'; /* uses client's default auth */ };

export interface WorkspaceSearchResult {
    id: string;
    name: string;
    slug?: string;
    description?: string;
}

export interface App {
    slug: string;
    name: string | Record<string, string>;
    description?: string | Record<string, string>;
    [key: string]: any;
}

export class PrismeApiClient {
    private client: AxiosInstance;
    private workspaceId: string;
    private baseUrl: string;
    private apiKey: string;
    private environments: EnvironmentsConfig;

    constructor(config: PrismeConfig) {
        this.workspaceId = config.workspaceId;
        this.baseUrl = config.baseUrl;
        this.apiKey = config.apiKey;
        this.environments = config.environments || {};
        this.client = axios.create({
            baseURL: config.baseUrl,
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json',
            },
        });
    }

    // Get API key for a specific environment
    private getApiKeyForEnvironment(environment?: string): string {
        if (environment && this.environments[environment]?.apiKey) {
            return this.environments[environment].apiKey!;
        }
        return this.apiKey;
    }

    // Helper to get client with potentially different base URL and environment
    private getClient(apiUrl?: string, environment?: string): AxiosInstance {
        const effectiveApiKey = this.getApiKeyForEnvironment(environment);

        if ((!apiUrl || apiUrl === this.baseUrl) && effectiveApiKey === this.apiKey) {
            return this.client;
        }

        // Create a new client instance for this specific request
        return axios.create({
            baseURL: apiUrl || this.baseUrl,
            headers: {
                'Authorization': `Bearer ${effectiveApiKey}`,
                'Content-Type': 'application/json',
            },
        });
    }

    // Automation CRUD operations
    async createAutomation(automation: Automation, workspaceId?: string, apiUrl?: string, environment?: string): Promise<Automation> {
        const wsId = workspaceId || this.workspaceId;
        const client = this.getClient(apiUrl, environment);
        const response = await client.post(
            `/workspaces/${wsId}/automations`,
            automation
        );
        return response.data;
    }

    async getAutomation(automationSlug: string, workspaceId?: string, apiUrl?: string, environment?: string): Promise<Automation> {
        const wsId = workspaceId || this.workspaceId;
        const client = this.getClient(apiUrl, environment);
        const response = await client.get(
            `/workspaces/${wsId}/automations/${automationSlug}`
        );
        return response.data;
    }

    async updateAutomation(automationSlug: string, automation: Partial<Automation>, workspaceId?: string, apiUrl?: string, environment?: string): Promise<Automation> {
        const wsId = workspaceId || this.workspaceId;
        const client = this.getClient(apiUrl, environment);
        const response = await client.patch(
            `/workspaces/${wsId}/automations/${automationSlug}`,
            automation
        );
        return response.data;
    }

    async deleteAutomation(automationSlug: string, workspaceId?: string, apiUrl?: string, environment?: string): Promise<{ slug: string }> {
        const wsId = workspaceId || this.workspaceId;
        const client = this.getClient(apiUrl, environment);
        const response = await client.delete(
            `/workspaces/${wsId}/automations/${automationSlug}`
        );
        return response.data;
    }

    async listAutomations(workspaceId?: string, apiUrl?: string, environment?: string): Promise<Record<string, any>> {
        const wsId = workspaceId || this.workspaceId;
        const client = this.getClient(apiUrl, environment);
        const response = await client.get(
            `/workspaces/${wsId}`
        );
        return response.data.automations || {};
    }

    // Automation execution
    async testAutomation(automationSlug: string, payload?: any, workspaceId?: string, apiUrl?: string, environment?: string): Promise<any> {
        const wsId = workspaceId || this.workspaceId;
        const client = this.getClient(apiUrl, environment);
        const response = await client.post(
            `/workspaces/${wsId}/test/${automationSlug}`,
            { payload }
        );
        return response.data;
    }

    // Search events
    async search(query: SearchQuery, workspaceId?: string, apiUrl?: string, environment?: string): Promise<SearchResponse> {
        const wsId = workspaceId || this.workspaceId;
        const client = this.getClient(apiUrl, environment);
        const response = await client.post(
            `/workspaces/${wsId}/search`,
            query
        );
        return response.data;
    }

    async listApps(params?: ListAppsParams, apiUrl?: string, environment?: string): Promise<App[]> {
        const client = this.getClient(apiUrl, environment);
        const response = await client.get('/apps', { params });
        return response.data;
    }

    async getApp(appSlug: string, apiUrl?: string, environment?: string): Promise<any> {
        const client = this.getClient(apiUrl, environment);
        const appResponse = await client.get(`/apps/${appSlug}`);
        const app = appResponse.data;

        if (app.workspaceId) {
            const workspaceResponse = await client.get(`/workspaces/${app.workspaceId}`);
            app.automations = workspaceResponse.data.automations || {};
        }

        return app;
    }

    async searchWorkspaces(params?: SearchWorkspacesParams, apiUrl?: string, environment?: string): Promise<WorkspaceSearchResult[]> {
        const client = this.getClient(apiUrl, environment);
        const response = await client.get('/workspaces', { params });
        return response.data;
    }

    async publishVersion(name: string, description: string, workspaceId?: string, apiUrl?: string, environment?: string): Promise<any> {
        const wsId = workspaceId || this.workspaceId;
        const client = this.getClient(apiUrl, environment);
        const response = await client.post(
            `/workspaces/${wsId}/versions`,
            { name, description }
        );
        return response.data;
    }

    async exportWorkspace(workspaceId?: string, apiUrl?: string, environment?: string): Promise<Buffer> {
        const wsId = workspaceId || this.workspaceId;
        const client = this.getClient(apiUrl, environment);
        const response = await client.post(
            `/workspaces/${wsId}/versions/current/export`,
            {},
            { responseType: 'arraybuffer' }
        );
        return Buffer.from(response.data);
    }

    async importWorkspace(archive: Buffer, prune: boolean = true, workspaceId?: string, apiUrl?: string, environment?: string): Promise<any> {
        const wsId = workspaceId || this.workspaceId;
        const client = this.getClient(apiUrl, environment);
        const formData = new FormData();
        formData.append('archive', archive, { filename: 'workspace.zip' });

        const response = await client.post(
            `/workspaces/${wsId}/import?prune=${prune}`,
            formData,
            { headers: formData.getHeaders() }
        );
        return response.data;
    }

    // AI Knowledge API methods
    // AI Knowledge workspace IDs per environment
    private static readonly AIK_WORKSPACE_IDS: Record<string, string> = {
        'sandbox': 'gQxyd2S',
        'staging': '2AZ1OCD',
        'prod': 'wW3UZla',
    };

    // Helper to detect environment from API URL and get AI Knowledge workspace ID
    private getAIKnowledgeWorkspaceId(apiUrl?: string): string {
        const url = apiUrl || this.baseUrl;
        if (url.includes('sandbox.prisme.ai')) {
            return PrismeApiClient.AIK_WORKSPACE_IDS['sandbox'];
        }
        if (url.includes('staging.prisme.ai')) {
            return PrismeApiClient.AIK_WORKSPACE_IDS['staging'];
        }
        // Default to prod for studio.prisme.ai or any other
        return PrismeApiClient.AIK_WORKSPACE_IDS['prod'];
    }

    // Helper to build AI Knowledge API URL
    private getAIKnowledgeBaseUrl(apiUrl?: string): string {
        // URL format: https://api.studio.prisme.ai/v2/workspaces/{aikWorkspaceId}/webhooks
        const baseApiUrl = apiUrl || this.baseUrl;
        const wsId = this.getAIKnowledgeWorkspaceId(apiUrl);
        return `${baseApiUrl}/workspaces/${wsId}/webhooks`;
    }

    // Get client for AI Knowledge API (uses api key header instead of Bearer token)
    private getAIKnowledgeClient(apiKey: string, apiUrl?: string): AxiosInstance {
        const baseUrl = this.getAIKnowledgeBaseUrl(apiUrl);
        return axios.create({
            baseURL: baseUrl,
            headers: {
                'knowledge-project-apikey': apiKey,
                'Content-Type': 'application/json',
            },
        });
    }

    async aiKnowledgeQuery(params: AIKnowledgeQueryParams, apiKey: string, apiUrl?: string): Promise<any> {
        const client = this.getAIKnowledgeClient(apiKey, apiUrl);
        const { method = 'query', ...rest } = params;

        if (method === 'context') {
            // For context method, rename text to userQuery
            const { text, ...contextRest } = rest;
            const response = await client.post('/retrieve-context', {
                userQuery: text,
                ...contextRest,
            });
            return response.data;
        } else {
            const response = await client.post('/query', rest);
            return response.data;
        }
    }

    async aiKnowledgeCompletion(params: AIKnowledgeCompletionParams, apiKey: string, apiUrl?: string): Promise<any> {
        const client = this.getAIKnowledgeClient(apiKey, apiUrl);
        const { method, ...rest } = params;

        switch (method) {
            case 'chat':
                const chatResponse = await client.post('/chat-completion', rest);
                return chatResponse.data;
            case 'openai':
                const openaiResponse = await client.post('/v1/chat/completions', rest);
                return openaiResponse.data;
            case 'embeddings':
                const embeddingsResponse = await client.post('/v1/embeddings', rest);
                return embeddingsResponse.data;
            case 'models':
                const modelsResponse = await client.get('/v1/models');
                return modelsResponse.data;
            default:
                throw new Error(`Unknown completion method: ${method}`);
        }
    }

    async aiKnowledgeDocument(params: AIKnowledgeDocumentParams, apiKey: string, apiUrl?: string): Promise<any> {
        const client = this.getAIKnowledgeClient(apiKey, apiUrl);
        const { method, projectId, id, externalId, page, limit, filters, includeContent, includeMetadata,
                name, content, tags, parser, status, recrawl, replace, flags } = params;

        switch (method) {
            case 'get':
                const getResponse = await client.get('/document', {
                    params: { projectId, id, externalId }
                });
                return getResponse.data;
            case 'list':
                const listResponse = await client.get('/documents', {
                    params: { projectId, page, limit, includeContent, includeMetadata,
                             filters: filters ? JSON.stringify(filters) : undefined }
                });
                return listResponse.data;
            case 'create':
                const createResponse = await client.post('/document', {
                    projectId, name, content, tags, parser, replace, flags, externalId
                });
                return createResponse.data;
            case 'update':
                const updateResponse = await client.patch('/document', {
                    name, content, tags, status
                }, {
                    params: { projectId, id, externalId }
                });
                return updateResponse.data;
            case 'delete':
                const deleteResponse = await client.delete('/document', {
                    params: { projectId, id, externalId }
                });
                return deleteResponse.data;
            case 'reindex':
                const reindexResponse = await client.post('/reindexFile', {
                    id, recrawl
                });
                return reindexResponse.data;
            case 'download':
                const downloadResponse = await client.get('/download', {
                    params: { id }
                });
                return downloadResponse.data;
            default:
                throw new Error(`Unknown document method: ${method}`);
        }
    }

    async aiKnowledgeProject(params: AIKnowledgeProjectParams, auth: AIKnowledgeAuth, apiUrl?: string, environment?: string): Promise<any> {
        const { method, id, page, perPage, search, category, owned, public: isPublic,
                withTools, withDatasources, name, description, ai, all } = params;

        // Methods that use Bearer token (user auth) vs apiKey (project auth)
        const usesBearerToken = ['list', 'create', 'categories'].includes(method);

        let client: AxiosInstance;
        if (usesBearerToken) {
            if (auth.type !== 'bearer') {
                throw new Error(`Method "${method}" requires Bearer token auth (use workspaceName), not apiKey`);
            }
            // Use the regular client with Bearer token for these endpoints
            client = this.getClient(apiUrl, environment);
            // But we need to hit the ai-knowledge webhooks URL
            const baseUrl = this.getAIKnowledgeBaseUrl(apiUrl);
            client = axios.create({
                baseURL: baseUrl,
                headers: {
                    'Authorization': `Bearer ${this.getApiKeyForEnvironment(environment)}`,
                    'Content-Type': 'application/json',
                },
            });
        } else {
            if (auth.type !== 'apiKey') {
                throw new Error(`Method "${method}" requires project apiKey, not Bearer token`);
            }
            client = this.getAIKnowledgeClient(auth.apiKey, apiUrl);
        }

        switch (method) {
            case 'get':
                const getResponse = await client.get('/projects', { params: { id } });
                return getResponse.data;
            case 'list':
                const listResponse = await client.get('/projects', {
                    params: { page, perPage, search, category, owned, public: isPublic, withTools, withDatasources }
                });
                return listResponse.data;
            case 'create':
                const createResponse = await client.post('/projects', {
                    name, description, ai
                });
                return createResponse.data;
            case 'update':
                const updateResponse = await client.patch('/projects', {
                    id, name, description, ai
                });
                return updateResponse.data;
            case 'delete':
                const deleteResponse = await client.delete('/projects', { params: { id } });
                return deleteResponse.data;
            case 'tools':
                const toolsResponse = await client.get('/getProjectTools', { params: { projectId: id } });
                return toolsResponse.data;
            case 'datasources':
                const datasourcesResponse = await client.get('/getProjectDatasources', { params: { projectId: id } });
                return datasourcesResponse.data;
            case 'categories':
                const categoriesResponse = await client.get('/categories', { params: { all, owned, public: isPublic, search } });
                return categoriesResponse.data;
            default:
                throw new Error(`Unknown project method: ${method}`);
        }
    }
}
