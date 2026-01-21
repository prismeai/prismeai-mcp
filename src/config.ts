import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Environment variable exports
export const PRISME_FORCE_READONLY = process.env.PRISME_FORCE_READONLY === "true";
// Disable feedback/reporting tools (these communicate with Prisme.ai servers)
export const PRISME_DISABLE_FEEDBACK_TOOLS = process.env.PRISME_DISABLE_FEEDBACK_TOOLS === "true";
const PRISME_WORKSPACES = process.env.PRISME_WORKSPACES;
const PRISME_ENVIRONMENTS = process.env.PRISME_ENVIRONMENTS;
const PRISME_DEFAULT_ENVIRONMENT = process.env.PRISME_DEFAULT_ENVIRONMENT;

// Legacy environment variables (deprecated, use PRISME_ENVIRONMENTS instead)
const LEGACY_PRISME_API_KEY = process.env.PRISME_API_KEY;
const LEGACY_PRISME_WORKSPACE_ID = process.env.PRISME_WORKSPACE_ID;
const LEGACY_PRISME_API_BASE_URL = process.env.PRISME_API_BASE_URL;

// Default values derived from environments config (set during parsing)
export let PRISME_API_KEY: string | undefined;
export let PRISME_WORKSPACE_ID: string | undefined;
export let PRISME_API_BASE_URL: string = "https://api.staging.prisme.ai/v2";

// Type definitions
export interface WorkspaceMapping {
  [name: string]: string;
}

export interface EnvironmentConfig {
  apiUrl: string;
  apiKey?: string;
  workspaces?: WorkspaceMapping;
  default?: boolean;
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

// Track the resolved default environment name
let defaultEnvironmentName: string | undefined;

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

      // workspaces is optional
      if (config.workspaces !== undefined) {
        if (
          typeof config.workspaces !== "object" ||
          config.workspaces === null ||
          Array.isArray(config.workspaces)
        ) {
          throw new Error(
            `Environment "${envName}" workspaces must be an object if provided`
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

      // Track environment with default: true
      if (config.default === true) {
        if (defaultEnvironmentName) {
          console.error(
            `Warning: Multiple environments marked as default. Using "${envName}" instead of "${defaultEnvironmentName}"`
          );
        }
        defaultEnvironmentName = envName;
      }
    }

    environmentsConfig = parsed;

    // Determine default environment: explicit default field > PRISME_DEFAULT_ENVIRONMENT > first environment
    if (!defaultEnvironmentName && PRISME_DEFAULT_ENVIRONMENT) {
      if (environmentsConfig[PRISME_DEFAULT_ENVIRONMENT]) {
        defaultEnvironmentName = PRISME_DEFAULT_ENVIRONMENT;
      }
    }
    if (!defaultEnvironmentName && Object.keys(environmentsConfig).length > 0) {
      defaultEnvironmentName = Object.keys(environmentsConfig)[0];
    }

    // Set exports from default environment
    if (defaultEnvironmentName && environmentsConfig[defaultEnvironmentName]) {
      const defaultEnv = environmentsConfig[defaultEnvironmentName];
      PRISME_API_KEY = defaultEnv.apiKey;
      PRISME_API_BASE_URL = defaultEnv.apiUrl;
      if (defaultEnv.workspaces) {
        workspaceMappings = defaultEnv.workspaces;
        // Use first workspace as default if available
        const firstWorkspace = Object.values(defaultEnv.workspaces)[0];
        if (firstWorkspace) {
          PRISME_WORKSPACE_ID = firstWorkspace;
        }
      }
    }

    console.error(
      `Loaded ${Object.keys(environmentsConfig).length} environments: ${Object.keys(environmentsConfig).join(", ")}` +
        (defaultEnvironmentName ? ` (default: ${defaultEnvironmentName})` : "")
    );
  } catch (error) {
    console.error(
      "Error: PRISME_ENVIRONMENTS must be valid JSON with environment configs"
    );
    console.error(
      'Example: {"sandbox":{"apiUrl":"https://api.sandbox.prisme.ai/v2","apiKey":"ey...","default":true}}'
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

// Fallback to legacy environment variables if not set from PRISME_ENVIRONMENTS
if (!PRISME_API_KEY && LEGACY_PRISME_API_KEY) {
  PRISME_API_KEY = LEGACY_PRISME_API_KEY;
}
if (!PRISME_WORKSPACE_ID && LEGACY_PRISME_WORKSPACE_ID) {
  PRISME_WORKSPACE_ID = LEGACY_PRISME_WORKSPACE_ID;
}
if (LEGACY_PRISME_API_BASE_URL && PRISME_API_BASE_URL === "https://api.staging.prisme.ai/v2") {
  PRISME_API_BASE_URL = LEGACY_PRISME_API_BASE_URL;
}

// Validate that we have at least environments configured or legacy fallback
if (Object.keys(environmentsConfig).length === 0 && !PRISME_API_KEY) {
  console.error(
    "Error: PRISME_ENVIRONMENTS must be configured with at least one environment"
  );
  console.error(
    'Example: {"sandbox":{"apiUrl":"https://api.sandbox.prisme.ai/v2","apiKey":"ey...","default":true}}'
  );
  process.exit(1);
}

// Export the resolved default environment name
export { defaultEnvironmentName };

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

    if (!envConfig.workspaces) {
      throw new Error(
        `Environment "${params.environment}" has no workspace mappings configured. ` +
          `Provide workspaceId directly instead of workspaceName.`
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
    // Try default environment first if it exists and has workspaces
    if (defaultEnvironmentName && environmentsConfig[defaultEnvironmentName]?.workspaces) {
      const envConfig = environmentsConfig[defaultEnvironmentName];
      const workspaceId = envConfig.workspaces![params.workspaceName];
      if (workspaceId) {
        return {
          workspaceId,
          apiUrl: envConfig.apiUrl,
          environment: defaultEnvironmentName,
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

  // 4. Just environment (use environment's API URL, but workspaceId must be provided or available)
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

    // Try to get a default workspace from this environment
    const envWorkspaceId = envConfig.workspaces
      ? Object.values(envConfig.workspaces)[0]
      : undefined;
    const workspaceId = envWorkspaceId || PRISME_WORKSPACE_ID;

    if (!workspaceId) {
      throw new Error(
        `Environment "${params.environment}" has no default workspace. ` +
          `Please provide workspaceId or workspaceName parameter.`
      );
    }

    return {
      workspaceId,
      apiUrl: envConfig.apiUrl,
      environment: params.environment,
      source: "environment",
    };
  }

  // 5. Default: use configured defaults from default environment
  if (!PRISME_WORKSPACE_ID) {
    throw new Error(
      `No default workspace configured. ` +
        `Please provide workspaceId, workspaceName, or environment parameter.`
    );
  }

  return {
    workspaceId: PRISME_WORKSPACE_ID,
    apiUrl: PRISME_API_BASE_URL,
    environment: defaultEnvironmentName,
    source: "default",
  };
}
