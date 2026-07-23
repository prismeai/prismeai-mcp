import dotenv from "dotenv";
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  getConfigDir,
  loadTopologySync,
  loadCredentialsSync,
  type StoredTopology,
} from "./auth/persist.js";

// Load environment variables
dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

// Environment variable exports
export const PRISME_FORCE_READONLY = process.env.PRISME_FORCE_READONLY === "true";
// Disable feedback/reporting tools (these communicate with Prisme.ai servers)
export const PRISME_DISABLE_FEEDBACK_TOOLS = process.env.PRISME_DISABLE_FEEDBACK_TOOLS === "true";
const PRISME_WORKSPACES = process.env.PRISME_WORKSPACES;
const PRISME_DEFAULT_ENVIRONMENT = process.env.PRISME_DEFAULT_ENVIRONMENT;

// Static environment variables for direct, single-environment runs.
const ENV_PRISME_API_KEY = process.env.PRISME_API_KEY;
const ENV_PRISME_WORKSPACE_ID = process.env.PRISME_WORKSPACE_ID;
const ENV_PRISME_API_BASE_URL = process.env.PRISME_API_BASE_URL;

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
  // Studio origin, used to derive the token-creation URL (<studio>/settings/tokens).
  studioUrl?: string;
  // Absolute path to a PEM CA bundle, equivalent to NODE_EXTRA_CA_CERTS for this environment.
  nodeExtraCaCerts?: string;
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

function validateEnvironments(parsed: any): EnvironmentsConfig {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Environments config must be a JSON object");
  }

  for (const [envName, envConfig] of Object.entries(parsed)) {
    const config = envConfig as any;

    if (typeof config !== "object" || config === null) {
      throw new Error(`Environment "${envName}" must be an object`);
    }

    if (typeof config.apiUrl !== "string") {
      throw new Error(`Environment "${envName}" must have an "apiUrl" string`);
    }

    if (config.apiKey !== undefined && typeof config.apiKey !== "string") {
      throw new Error(`Environment "${envName}" apiKey must be a string if provided`);
    }

    if (config.studioUrl !== undefined && typeof config.studioUrl !== "string") {
      throw new Error(`Environment "${envName}" studioUrl must be a string if provided`);
    }

    if (
      config.nodeExtraCaCerts !== undefined &&
      typeof config.nodeExtraCaCerts !== "string"
    ) {
      throw new Error(
        `Environment "${envName}" nodeExtraCaCerts must be a string if provided`
      );
    }

    // workspaces is optional
    if (config.workspaces !== undefined) {
      if (
        typeof config.workspaces !== "object" ||
        config.workspaces === null ||
        Array.isArray(config.workspaces)
      ) {
        throw new Error(`Environment "${envName}" workspaces must be an object if provided`);
      }

      for (const [wsName, wsId] of Object.entries(config.workspaces)) {
        if (typeof wsId !== "string") {
          throw new Error(`Workspace ID for "${envName}.${wsName}" must be a string`);
        }
      }
    }
  }

  return parsed as EnvironmentsConfig;
}

/**
 * Load the environment topology, in priority order:
 *   1. <PRISME_CONFIG_DIR>/config.json (the plugin data dir)
 *   2. The default topology shipped with the plugin (config/default-environments.json)
 */
function loadEnvironments(): { environments: EnvironmentsConfig; defaultName?: string } {
  // 1. Config dir
  try {
    const topology = loadTopologySync();
    if (topology) {
      return {
        environments: validateEnvironments(topology.environments),
        defaultName: topology.defaultEnvironment,
      };
    }
  } catch (error) {
    console.error(
      `Warning: invalid config.json in ${getConfigDir()}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }

  // 2. Default topology shipped with the plugin. From the bundled layout
  // (plugin/build/index.js) it is at ../config; from the tsc/tsx layouts
  // (build/config.js, src/config.ts) it is at <repo>/plugin/config.
  const shippedDefault =
    [
      join(__dirname, "..", "config", "default-environments.json"),
      join(__dirname, "..", "plugin", "config", "default-environments.json"),
    ].find((p) => existsSync(p)) ?? "";
  try {
    if (shippedDefault && existsSync(shippedDefault)) {
      const parsed = JSON.parse(readFileSync(shippedDefault, "utf-8")) as StoredTopology;
      return {
        environments: validateEnvironments(parsed.environments),
        defaultName: parsed.defaultEnvironment,
      };
    }
  } catch (error) {
    console.error(
      `Warning: invalid default-environments.json: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }

  return { environments: {} };
}

const loaded = loadEnvironments();
environmentsConfig = loaded.environments;

// Merge stored tokens (credentials.json) into the in-memory environments
const storedCredentials = loadCredentialsSync();
for (const [envName, cred] of Object.entries(storedCredentials)) {
  if (environmentsConfig[envName] && cred?.token) {
    environmentsConfig[envName].apiKey = cred.token;
  }
}

// Determine default environment:
// explicit default field > config.json defaultEnvironment > PRISME_DEFAULT_ENVIRONMENT > first
for (const [envName, env] of Object.entries(environmentsConfig)) {
  if (env.default === true) {
    if (defaultEnvironmentName) {
      console.error(
        `Warning: Multiple environments marked as default. Using "${envName}" instead of "${defaultEnvironmentName}"`
      );
    }
    defaultEnvironmentName = envName;
  }
}
if (!defaultEnvironmentName && loaded.defaultName && environmentsConfig[loaded.defaultName]) {
  defaultEnvironmentName = loaded.defaultName;
}
if (
  !defaultEnvironmentName &&
  PRISME_DEFAULT_ENVIRONMENT &&
  environmentsConfig[PRISME_DEFAULT_ENVIRONMENT]
) {
  defaultEnvironmentName = PRISME_DEFAULT_ENVIRONMENT;
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

if (Object.keys(environmentsConfig).length > 0) {
  console.error(
    `Loaded ${Object.keys(environmentsConfig).length} environments: ${Object.keys(environmentsConfig).join(", ")}` +
      (defaultEnvironmentName ? ` (default: ${defaultEnvironmentName})` : "")
  );
}

// Parse PRISME_WORKSPACES flat workspace-name mappings.
if (Object.keys(environmentsConfig).length === 0 && PRISME_WORKSPACES) {
  try {
    const parsed = JSON.parse(PRISME_WORKSPACES);

    // Validate format: object with string keys and values
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
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
  }
}

// Fallback to static environment variables if not set from environments config.
if (!PRISME_API_KEY && ENV_PRISME_API_KEY) {
  PRISME_API_KEY = ENV_PRISME_API_KEY;
}
if (!PRISME_WORKSPACE_ID && ENV_PRISME_WORKSPACE_ID) {
  PRISME_WORKSPACE_ID = ENV_PRISME_WORKSPACE_ID;
}
if (ENV_PRISME_API_BASE_URL && PRISME_API_BASE_URL === "https://api.staging.prisme.ai/v2") {
  PRISME_API_BASE_URL = ENV_PRISME_API_BASE_URL;
}

// The server intentionally starts even with no environments/tokens configured:
// the `set_token` tool is the supported way to register credentials at runtime.
if (Object.keys(environmentsConfig).length === 0 && !PRISME_API_KEY) {
  console.error(
    `Warning: no environments configured. Register one with the set_token tool ` +
      `(config dir: ${getConfigDir()}).`
  );
}

// Export the resolved default environment name
export { defaultEnvironmentName };

// Workspace and environment resolution helper
export function resolveWorkspaceAndEnvironment(
  params: WorkspaceResolutionParams
): WorkspaceResolutionResult {
  // Priority: workspaceId parameter > environment+workspaceName > workspaceName > default
  const explicitEnvConfig = params.environment
    ? environmentsConfig[params.environment]
    : undefined;
  if (params.environment && !explicitEnvConfig) {
    const availableEnvs = Object.keys(environmentsConfig);
    throw new Error(
      `Unknown environment: "${params.environment}". ` +
        `Available: ${
          availableEnvs.length > 0
            ? availableEnvs.join(", ")
            : "none configured"
        }. ` +
        `If you meant "${params.environment}", configure it before retrying.`
    );
  }

  // 1. Direct workspaceId parameter (use environment's API URL if available, else default)
  if (params.workspaceId) {
    return {
      workspaceId: params.workspaceId,
      apiUrl: explicitEnvConfig?.apiUrl ?? PRISME_API_BASE_URL,
      environment: params.environment,
      source: "parameter",
    };
  }

  // 2. Environment + workspaceName (from environments config)
  if (params.environment && params.workspaceName) {
    const envConfig = explicitEnvConfig!;

    if (!envConfig.workspaces) {
      throw new Error(
        `Environment "${params.environment}" has no workspace mappings configured. ` +
          `Provide workspaceId directly instead of workspaceName.`
      );
    }

    const workspaceId = envConfig.workspaces[params.workspaceName];
    if (!workspaceId) {
      throw new Error(
        `Unknown workspace name: "${params.workspaceName}" in environment "${params.environment}". ` +
          `Provide a valid workspaceName or use workspaceId directly.`
      );
    }

    return {
      workspaceId,
      apiUrl: envConfig.apiUrl,
      environment: params.environment,
      source: "environment",
    };
  }

  // 3. Just workspaceName (use default environment or flat workspace mappings)
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

    // Fall back to flat workspace mappings.
    const resolvedId = workspaceMappings[params.workspaceName];
    if (!resolvedId) {
      throw new Error(
        `Unknown workspace name: "${params.workspaceName}". ` +
          `Provide a valid workspaceName or use workspaceId directly.`
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
    const envConfig = explicitEnvConfig!;

    // Try to get a default workspace from this environment.
    // It's OK if none is configured — some tools (get_app, searchWorkspaces,
    // createWorkspace, list_apps without workspaceName) only need the apiUrl.
    const envWorkspaceId = envConfig.workspaces
      ? Object.values(envConfig.workspaces)[0]
      : undefined;
    const workspaceId = envWorkspaceId || PRISME_WORKSPACE_ID || "";

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
