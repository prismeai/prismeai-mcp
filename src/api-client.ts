import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';

export interface EnvironmentConfig {
    apiUrl: string;
    apiKey?: string;
    workspaces: Record<string, string>;
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
}
