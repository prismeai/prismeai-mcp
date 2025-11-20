import axios, { AxiosInstance } from 'axios';

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
    async createAutomation(automation: Automation): Promise<Automation> {
        const response = await this.client.post(
            `/workspaces/${this.workspaceId}/automations`,
            automation
        );
        return response.data;
    }

    async getAutomation(automationSlug: string): Promise<Automation> {
        const response = await this.client.get(
            `/workspaces/${this.workspaceId}/automations/${automationSlug}`
        );
        return response.data;
    }

    async updateAutomation(automationSlug: string, automation: Partial<Automation>): Promise<Automation> {
        const response = await this.client.patch(
            `/workspaces/${this.workspaceId}/automations/${automationSlug}`,
            automation
        );
        return response.data;
    }

    async deleteAutomation(automationSlug: string): Promise<{ slug: string }> {
        const response = await this.client.delete(
            `/workspaces/${this.workspaceId}/automations/${automationSlug}`
        );
        return response.data;
    }

    async listAutomations(): Promise<Record<string, any>> {
        const response = await this.client.get(
            `/workspaces/${this.workspaceId}`
        );
        return response.data.automations || {};
    }

    // Automation execution
    async testAutomation(automationSlug: string, payload?: any): Promise<any> {
        const response = await this.client.post(
            `/workspaces/${this.workspaceId}/test/${automationSlug}`,
            { payload }
        );
        return response.data;
    }

    // Search events
    async search(query: SearchQuery): Promise<SearchResponse> {
        const response = await this.client.post(
            `/workspaces/${this.workspaceId}/search`,
            query
        );
        return response.data;
    }
}
