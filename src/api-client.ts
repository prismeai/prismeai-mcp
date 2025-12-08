import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';

export interface PrismeConfig {
    apiKey: string;
    workspaceId: string;
    baseUrl: string;
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

    constructor(config: PrismeConfig) {
        this.workspaceId = config.workspaceId;
        this.client = axios.create({
            baseURL: config.baseUrl,
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json',
            },
        });
    }

    // Automation CRUD operations
    async createAutomation(automation: Automation, workspaceId?: string): Promise<Automation> {
        const wsId = workspaceId || this.workspaceId;
        const response = await this.client.post(
            `/workspaces/${wsId}/automations`,
            automation
        );
        return response.data;
    }

    async getAutomation(automationSlug: string, workspaceId?: string): Promise<Automation> {
        const wsId = workspaceId || this.workspaceId;
        const response = await this.client.get(
            `/workspaces/${wsId}/automations/${automationSlug}`
        );
        return response.data;
    }

    async updateAutomation(automationSlug: string, automation: Partial<Automation>, workspaceId?: string): Promise<Automation> {
        const wsId = workspaceId || this.workspaceId;
        const response = await this.client.patch(
            `/workspaces/${wsId}/automations/${automationSlug}`,
            automation
        );
        return response.data;
    }

    async deleteAutomation(automationSlug: string, workspaceId?: string): Promise<{ slug: string }> {
        const wsId = workspaceId || this.workspaceId;
        const response = await this.client.delete(
            `/workspaces/${wsId}/automations/${automationSlug}`
        );
        return response.data;
    }

    async listAutomations(workspaceId?: string): Promise<Record<string, any>> {
        const wsId = workspaceId || this.workspaceId;
        const response = await this.client.get(
            `/workspaces/${wsId}`
        );
        return response.data.automations || {};
    }

    // Automation execution
    async testAutomation(automationSlug: string, payload?: any, workspaceId?: string): Promise<any> {
        const wsId = workspaceId || this.workspaceId;
        const response = await this.client.post(
            `/workspaces/${wsId}/test/${automationSlug}`,
            { payload }
        );
        return response.data;
    }

    // Search events
    async search(query: SearchQuery, workspaceId?: string): Promise<SearchResponse> {
        const wsId = workspaceId || this.workspaceId;
        const response = await this.client.post(
            `/workspaces/${wsId}/search`,
            query
        );
        return response.data;
    }

    async listApps(params?: ListAppsParams): Promise<App[]> {
        const response = await this.client.get('/apps', { params });
        return response.data;
    }

    async getApp(appSlug: string): Promise<any> {
        const appResponse = await this.client.get(`/apps/${appSlug}`);
        const app = appResponse.data;
        
        if (app.workspaceId) {
            const workspaceResponse = await this.client.get(`/workspaces/${app.workspaceId}`);
            app.automations = workspaceResponse.data.automations || {};
        }
        
        return app;
    }

    async publishVersion(name: string, description: string, workspaceId?: string): Promise<any> {
        const wsId = workspaceId || this.workspaceId;
        const response = await this.client.post(
            `/workspaces/${wsId}/versions`,
            { name, description }
        );
        return response.data;
    }

    async exportWorkspace(workspaceId?: string): Promise<Buffer> {
        const wsId = workspaceId || this.workspaceId;
        const response = await this.client.post(
            `/workspaces/${wsId}/versions/current/export`,
            {},
            { responseType: 'arraybuffer' }
        );
        return Buffer.from(response.data);
    }

    async importWorkspace(archive: Buffer, prune: boolean = true, workspaceId?: string): Promise<any> {
        const wsId = workspaceId || this.workspaceId;
        const formData = new FormData();
        formData.append('archive', archive, { filename: 'workspace.zip' });

        const response = await this.client.post(
            `/workspaces/${wsId}/import?prune=${prune}`,
            formData,
            { headers: formData.getHeaders() }
        );
        return response.data;
    }
}
