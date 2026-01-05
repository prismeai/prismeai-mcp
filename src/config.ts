import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Environment variable exports
export const PRISME_API_KEY = process.env.PRISME_API_KEY;
export const PRISME_WORKSPACE_ID = process.env.PRISME_WORKSPACE_ID;
export const PRISME_API_BASE_URL =
  process.env.PRISME_API_BASE_URL || "https://api.staging.prisme.ai/v2";
export const PRISME_FORCE_READONLY = process.env.PRISME_FORCE_READONLY === "true";
const PRISME_WORKSPACES = process.env.PRISME_WORKSPACES;
const PRISME_ENVIRONMENTS = process.env.PRISME_ENVIRONMENTS;
const PRISME_DEFAULT_ENVIRONMENT =
  process.env.PRISME_DEFAULT_ENVIRONMENT || "default";

// Validate required environment variables
if (!PRISME_API_KEY || !PRISME_WORKSPACE_ID) {
  console.error(
    "Error: PRISME_API_KEY and PRISME_WORKSPACE_ID must be set in environment variables"
  );
  process.exit(1);
}

// Type definitions
export interface WorkspaceMapping {
  [name: string]: string;
}

export interface EnvironmentConfig {
  apiUrl: string;
  apiKey?: string;
  workspaces: WorkspaceMapping;
}

export interface EnvironmentsConfig {
  [environmentName: string]: EnvironmentConfig;
}

export interface WorkspaceResolutionParams {
  workspaceId?: string;
  workspaceName?: string;
  environment?: string;
}

export interface WorkspaceResolutionResult {
  workspaceId: string;
  apiUrl: string;
  environment?: string;
  source: "parameter" | "environment" | "named" | "default";
}

// Parse and validate workspace mappings and environments
let workspaceMappings: WorkspaceMapping = {};
export let environmentsConfig: EnvironmentsConfig = {};

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
export function resolveWorkspaceAndEnvironment(
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
