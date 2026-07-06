import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';

export interface EnvironmentConfig {
    apiUrl: string;
    apiKey?: string;
    workspaces?: Record<string, string>;
    default?: boolean;
    studioUrl?: string;
}

export interface EnvironmentsConfig {
    [environmentName: string]: EnvironmentConfig;
}

export interface PrismeConfig {
    apiKey: string;
    workspaceId: string;
    baseUrl: string;
    environments?: EnvironmentsConfig;
    defaultEnvironment?: string;
    // Absolute path to the running server script (process.argv[1]); used to
    // print a copy-pasteable `set-token` CLI command in auth-failure errors.
    serverScriptPath?: string;
    // Config dir where credentials.json lives; surfaced in the CLI hint.
    configDir?: string;
    // Lazily re-read a token from credentials.json (set by the out-of-band CLI
    // `set-token` command) so a freshly-registered token is picked up without
    // restarting the session. Returns the token if found.
    reloadTokens?: (environment: string) => string | undefined;
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

export interface AppInstance {
    appSlug: string;
    appName?: string | Record<string, string>;
    appVersion?: string;
    slug?: string;
    disabled?: boolean;
    labels?: string[];
    config?: Record<string, any>;
}

export interface DetailedAppInstance extends AppInstance {
    photo?: string;
    automations?: any[];
    events?: { emit?: string[]; listen?: string[]; };
    blocks?: any[];
}

export interface PrismeFile {
    id?: string;
    name: string;
    url: string;
    mimetype: string;
    size: number;
    workspaceId: string;
    path: string;
    expiresAt?: string;
    expiresAfter?: number;
    metadata?: Record<string, any>;
    public?: boolean;
    shareToken?: string;
}

export interface UploadFileOptions {
    fileName?: string;
    contentType?: string;
    expiresAfter?: string | number;
    public?: boolean;
    shareToken?: boolean;
    metadata?: Record<string, any>;
}

export interface ListFilesParams {
    page?: number;
    limit?: number;
    query?: Record<string, any>;
    sort?: string;
}

/**
 * Derive the studio token-creation page for an environment:
 * <studio-origin>/settings/tokens. Falls back to deriving the studio origin
 * from the apiUrl (strip trailing /vN, strip leading "api." subdomain).
 */
function tokenCreationUrl(env?: { apiUrl?: string; studioUrl?: string }): string | undefined {
    if (!env) return undefined;
    if (env.studioUrl) {
        return `${env.studioUrl.replace(/\/+$/, '')}/settings/tokens`;
    }
    if (!env.apiUrl) return undefined;
    try {
        const url = new URL(env.apiUrl);
        const host = url.host.replace(/^api[.-]/, '');
        return `${url.protocol}//${host}/settings/tokens`;
    } catch {
        return undefined;
    }
}

export class PrismeApiClient {
    private client: AxiosInstance;
    private workspaceId: string;
    private baseUrl: string;
    private apiKey: string;
    private environments: EnvironmentsConfig;
    private defaultEnvironment?: string;
    private serverScriptPath?: string;
    private configDir?: string;
    private reloadTokens?: (environment: string) => string | undefined;

    constructor(config: PrismeConfig) {
        this.workspaceId = config.workspaceId;
        this.baseUrl = config.baseUrl;
        this.apiKey = config.apiKey;
        this.environments = config.environments || {};
        this.defaultEnvironment = config.defaultEnvironment;
        this.serverScriptPath = config.serverScriptPath;
        this.configDir = config.configDir;
        this.reloadTokens = config.reloadTokens;
        this.client = axios.create({
            baseURL: config.baseUrl,
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json',
            },
        });
    }

    /**
     * Build the actionable "no credentials" error. It recommends the out-of-band
     * CLI command (which keeps the token out of the chat / off the wire to the
     * LLM provider) and mentions the `set_token` tool as a fallback with the
     * network-exposure caveat.
     */
    private missingTokenError(environment?: string): Error {
        const envName = environment || this.defaultEnvironment;
        const envConfig = envName ? this.environments[envName] : undefined;
        const tokenUrl = tokenCreationUrl(envConfig ?? { apiUrl: this.baseUrl });
        const createLine = tokenUrl
            ? `Create a token at ${tokenUrl}`
            : `Create a token in the Prisme.ai studio (Settings > Access Tokens)`;

        const envArg = envName ?? '<environment>';
        const scriptPath = this.serverScriptPath ?? '<plugin>/build/index.js';
        const dirFlag = this.configDir ? ` --config-dir "${this.configDir}"` : '';
        const cliCommand = `node "${scriptPath}" set-token ${envArg}${dirFlag}`;

        return new Error(
            `No credentials for environment \`${envName ?? 'default'}\`.\n\n` +
                `Recommended (keeps your token private — it never enters this chat or reaches the LLM provider):\n` +
                `1. ${createLine}\n` +
                `2. Run this in your OWN terminal (it prompts for the token with hidden input, validates it, then saves it):\n\n` +
                `   ${cliCommand}\n\n` +
                `3. Re-run your request.\n\n` +
                `Alternative: paste the token to me and I will call the \`set_token\` tool — but be aware the token would then be sent over the network to the LLM provider as part of this conversation.`
        );
    }

    // Get API key for a specific environment; throws an actionable error when
    // no token is stored for it. Before failing, attempt a lazy reload from
    // credentials.json so a token just registered via the CLI is picked up
    // without restarting the session.
    private getApiKeyForEnvironment(environment?: string): string {
        if (environment && this.environments[environment]) {
            let key = this.environments[environment].apiKey;
            if (!key) {
                const reloaded = this.reloadTokens?.(environment);
                if (reloaded) {
                    this.environments[environment].apiKey = reloaded;
                    key = reloaded;
                }
            }
            if (key) return key;
            throw this.missingTokenError(environment);
        }
        if (this.apiKey) return this.apiKey;
        if (this.defaultEnvironment) {
            const reloaded = this.reloadTokens?.(this.defaultEnvironment);
            if (reloaded) {
                this.apiKey = reloaded;
                return reloaded;
            }
        }
        throw this.missingTokenError(environment);
    }

    /**
     * Live-update the in-memory apiKey for one environment.
     * Subsequent calls to getApiKeyForEnvironment() will pick up the new value.
     * If the env matches the default baseUrl, also rebuild the default axios client
     * so calls without an explicit `environment` param use the fresh token.
     */
    updateEnvironmentApiKey(environment: string, apiKey: string): void {
        if (!this.environments[environment]) {
            throw new Error(
                `Cannot update apiKey for unknown environment "${environment}"`
            );
        }
        this.environments[environment] = {
            ...this.environments[environment],
            apiKey,
        };

        if (this.environments[environment].apiUrl === this.baseUrl) {
            this.apiKey = apiKey;
            this.client = axios.create({
                baseURL: this.baseUrl,
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
            });
        }
    }

    /**
     * Register or update an environment at runtime (used by set_token when the
     * environment is not yet known), then store its token in memory.
     */
    upsertEnvironment(environment: string, config: EnvironmentConfig): void {
        this.environments[environment] = { ...config };
        if (config.apiKey && config.apiUrl === this.baseUrl) {
            this.apiKey = config.apiKey;
            this.client = axios.create({
                baseURL: this.baseUrl,
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                },
            });
        }
    }

    /**
     * Validate a token against an environment with a cheap authenticated call
     * (GET /me). Returns the authenticated user on success; throws on 401/403
     * or network failure. Nothing is persisted here.
     */
    async probeToken(apiUrl: string, token: string): Promise<any> {
        const probeClient = axios.create({
            baseURL: apiUrl,
            timeout: 15000,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
        const response = await probeClient.get('/me');
        return response.data;
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

    /**
     * Generic authenticated call to any Prisme.ai REST endpoint.
     * The Bearer token is injected server-side per environment and is NEVER
     * exposed to the caller. `path` is relative to the environment's apiUrl base
     * (which already includes /v2), e.g. "/orgs", "/me", "/workspaces/<id>".
     */
    async callApi(params: {
        method?: string;
        path: string;
        query?: Record<string, any>;
        body?: any;
        environment?: string;
        pick?: string[];
        asSession?: boolean;
        apiKey?: string;
        withUserBearer?: boolean;
    }): Promise<{ status: number; data: any }> {
        // Resolve the environment's base URL so the token and URL stay consistent.
        const apiUrl =
            params.environment && this.environments[params.environment]?.apiUrl
                ? this.environments[params.environment].apiUrl
                : undefined;
        const method = (params.method || 'GET').toUpperCase();
        const url = params.path.startsWith('/') ? params.path : `/${params.path}`;
        let response;
        if (params.apiKey) {
            // Org/app key mode: authenticate with x-prismeai-api-key. By default NO
            // Bearer is sent, so the gateway resolves the org from the key without a
            // membership check (acting for an org you are not a member of).
            // With `withUserBearer`, ALSO send the user Bearer: combines a real user
            // identity (e.g. superadmin) with the org key's org context, so the
            // gateway can take the admin/owner path while the key selects the org.
            const headers: Record<string, string> = {
                'x-prismeai-api-key': params.apiKey,
                'Content-Type': 'application/json',
            };
            if (params.withUserBearer) {
                headers['Authorization'] = `Bearer ${this.getApiKeyForEnvironment(params.environment)}`;
            }
            response = await axios.request({
                baseURL: apiUrl || this.baseUrl,
                url,
                method: method as any,
                params: params.query,
                data: params.body,
                headers,
            });
        } else if (params.asSession) {
            // Session mode: send the token as the `access-token` cookie (NOT as a
            // Bearer access token). Some endpoints (e.g. PUT /user/active-org) are
            // session-only and reject access tokens; cookie auth makes the call be
            // treated as a browser session, and the session (incl. active org) is
            // preserved across calls that reuse the same token.
            const effectiveApiKey = this.getApiKeyForEnvironment(params.environment);
            response = await axios.request({
                baseURL: apiUrl || this.baseUrl,
                url,
                method: method as any,
                params: params.query,
                data: params.body,
                headers: {
                    Cookie: `access-token=${effectiveApiKey}`,
                    'Content-Type': 'application/json',
                },
            });
        } else {
            const client = this.getClient(apiUrl, params.environment);
            response = await client.request({
                url,
                method: method as any,
                params: params.query,
                data: params.body,
            });
        }
        let data = response.data;
        // Optional field projection — keeps large list endpoints usable by trimming
        // each item (or each entry of a `results`/`items` array) to the picked keys.
        if (params.pick && params.pick.length) {
            const proj = (o: any) =>
                o && typeof o === 'object' && !Array.isArray(o)
                    ? Object.fromEntries(
                          params.pick!.filter((k) => k in o).map((k) => [k, o[k]])
                      )
                    : o;
            if (Array.isArray(data)) {
                data = data.map(proj);
            } else if (data && Array.isArray(data.results)) {
                data = { ...data, results: data.results.map(proj) };
            } else if (data && Array.isArray(data.items)) {
                data = { ...data, items: data.items.map(proj) };
            } else {
                data = proj(data);
            }
        }
        return { status: response.status, data };
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

    // App Instance CRUD operations
    async installAppInstance(appInstance: AppInstance, workspaceId?: string, apiUrl?: string, environment?: string): Promise<DetailedAppInstance> {
        const wsId = workspaceId || this.workspaceId;
        const client = this.getClient(apiUrl, environment);
        const response = await client.post(
            `/workspaces/${wsId}/apps`,
            appInstance
        );
        return response.data;
    }

    async listAppInstances(workspaceId?: string, apiUrl?: string, environment?: string): Promise<DetailedAppInstance[]> {
        const wsId = workspaceId || this.workspaceId;
        const client = this.getClient(apiUrl, environment);
        const response = await client.get(
            `/workspaces/${wsId}/apps`
        );
        return response.data;
    }

    async getAppInstance(instanceSlug: string, workspaceId?: string, apiUrl?: string, environment?: string): Promise<DetailedAppInstance> {
        const wsId = workspaceId || this.workspaceId;
        const client = this.getClient(apiUrl, environment);
        const response = await client.get(
            `/workspaces/${wsId}/apps/${instanceSlug}`
        );
        return response.data;
    }

    async updateAppInstance(instanceSlug: string, appInstance: Partial<AppInstance>, workspaceId?: string, apiUrl?: string, environment?: string): Promise<DetailedAppInstance> {
        const wsId = workspaceId || this.workspaceId;
        const client = this.getClient(apiUrl, environment);
        const response = await client.patch(
            `/workspaces/${wsId}/apps/${instanceSlug}`,
            appInstance
        );
        return response.data;
    }

    async uninstallAppInstance(instanceSlug: string, workspaceId?: string, apiUrl?: string, environment?: string): Promise<{ slug: string }> {
        const wsId = workspaceId || this.workspaceId;
        const client = this.getClient(apiUrl, environment);
        const response = await client.delete(
            `/workspaces/${wsId}/apps/${instanceSlug}`
        );
        return response.data;
    }

    async getAppInstanceConfig(instanceSlug: string, workspaceId?: string, apiUrl?: string, environment?: string): Promise<Record<string, any>> {
        const wsId = workspaceId || this.workspaceId;
        const client = this.getClient(apiUrl, environment);
        const response = await client.get(
            `/workspaces/${wsId}/apps/${instanceSlug}/config`
        );
        return response.data;
    }

    async updateAppInstanceConfig(instanceSlug: string, config: Record<string, any>, workspaceId?: string, apiUrl?: string, environment?: string): Promise<Record<string, any>> {
        const wsId = workspaceId || this.workspaceId;
        const client = this.getClient(apiUrl, environment);
        const response = await client.patch(
            `/workspaces/${wsId}/apps/${instanceSlug}/config`,
            config
        );
        return response.data;
    }

    async publishApp(body: { workspaceId: string; slug?: string; name?: string; description?: string | Record<string, string>; workspaceVersion?: string }, apiUrl?: string, environment?: string): Promise<any> {
        const client = this.getClient(apiUrl, environment);
        const response = await client.post('/apps', body);
        return response.data;
    }

    async unlockWorkspace(workspaceId?: string, apiUrl?: string, environment?: string): Promise<any> {
        const wsId = workspaceId || this.workspaceId;
        const client = this.getClient(apiUrl, environment);
        const response = await client.delete(`/workspaces/${wsId}/writeLock`);
        return response.data;
    }

    async createWorkspace(workspace: { name: string; description?: string | Record<string, string>; photo?: string; slug?: string; labels?: string[] }, apiUrl?: string, environment?: string): Promise<any> {
        const client = this.getClient(apiUrl, environment);
        const response = await client.post('/workspaces', workspace);
        return response.data;
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

    async getWorkspace(workspaceId?: string, apiUrl?: string, environment?: string): Promise<any> {
        const wsId = workspaceId || this.workspaceId;
        const client = this.getClient(apiUrl, environment);
        const response = await client.get(`/workspaces/${wsId}`);
        return response.data;
    }

    async pushWorkspaceVersion(
        body: {
            description: string | Record<string, string>;
            name?: string;
            repository?: { id: string };
        },
        workspaceId?: string,
        apiUrl?: string,
        environment?: string
    ): Promise<any> {
        const wsId = workspaceId || this.workspaceId;
        const client = this.getClient(apiUrl, environment);
        const response = await client.post(`/workspaces/${wsId}/versions`, body);
        return response.data;
    }

    async pullWorkspaceVersion(
        versionId: string,
        body?: {
            repository?: { id: string };
        },
        workspaceId?: string,
        apiUrl?: string,
        environment?: string
    ): Promise<any> {
        const wsId = workspaceId || this.workspaceId;
        const client = this.getClient(apiUrl, environment);
        const encodedVersionId = encodeURIComponent(versionId);
        const response = await client.post(
            `/workspaces/${wsId}/versions/${encodedVersionId}/pull`,
            body || {}
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
        const effectiveApiKey = this.getApiKeyForEnvironment(environment);
        const client = this.getClient(apiUrl, environment);
        const formData = new FormData();
        formData.append('archive', archive, { filename: 'workspace.zip', contentType: 'application/zip' });

        const response = await client.post(
            `/workspaces/${wsId}/import?prune=${prune}`,
            formData,
            {
                headers: {
                    ...formData.getHeaders(),
                    Authorization: `Bearer ${effectiveApiKey}`,
                },
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
            }
        );
        return response.data;
    }

    // File CRUD operations
    async uploadFile(
        fileContent: Buffer,
        options: UploadFileOptions,
        workspaceId?: string,
        apiUrl?: string,
        environment?: string
    ): Promise<PrismeFile[]> {
        const wsId = workspaceId || this.workspaceId;
        const effectiveApiKey = this.getApiKeyForEnvironment(environment);
        const client = this.getClient(apiUrl, environment);
        const formData = new FormData();
        formData.append('file', fileContent, {
            filename: options.fileName || 'upload',
            contentType: options.contentType || 'application/octet-stream',
        });
        if (options.expiresAfter !== undefined) {
            formData.append('expiresAfter', String(options.expiresAfter));
        }
        if (options.public !== undefined) {
            formData.append('public', String(options.public));
        }
        if (options.shareToken) {
            formData.append('shareToken', 'true');
        }
        if (options.metadata && Object.keys(options.metadata).length > 0) {
            formData.append('metadata', JSON.stringify(options.metadata));
        }

        const response = await client.post(
            `/workspaces/${wsId}/files`,
            formData,
            {
                headers: {
                    ...formData.getHeaders(),
                    Authorization: `Bearer ${effectiveApiKey}`,
                },
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
            }
        );
        return response.data;
    }

    async listFiles(
        params?: ListFilesParams,
        workspaceId?: string,
        apiUrl?: string,
        environment?: string
    ): Promise<PrismeFile[]> {
        const wsId = workspaceId || this.workspaceId;
        const client = this.getClient(apiUrl, environment);
        const queryParams: Record<string, any> = {};
        if (params?.page !== undefined) queryParams.page = params.page;
        if (params?.limit !== undefined) queryParams.limit = params.limit;
        if (params?.sort) queryParams.sort = params.sort;
        if (params?.query && Object.keys(params.query).length > 0) {
            queryParams.query = JSON.stringify(params.query);
        }
        const response = await client.get(
            `/workspaces/${wsId}/files`,
            { params: queryParams }
        );
        return response.data;
    }

    async getFile(
        fileId: string,
        workspaceId?: string,
        apiUrl?: string,
        environment?: string
    ): Promise<PrismeFile> {
        const wsId = workspaceId || this.workspaceId;
        const client = this.getClient(apiUrl, environment);
        const response = await client.get(
            `/workspaces/${wsId}/files/${encodeURIComponent(fileId)}`
        );
        return response.data;
    }

    async deleteFile(
        fileId: string,
        workspaceId?: string,
        apiUrl?: string,
        environment?: string
    ): Promise<{ id: string }> {
        const wsId = workspaceId || this.workspaceId;
        const client = this.getClient(apiUrl, environment);
        const response = await client.delete(
            `/workspaces/${wsId}/files/${encodeURIComponent(fileId)}`
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
