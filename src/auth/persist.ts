import { promises as fs, readFileSync, mkdirSync, writeFileSync, renameSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const MCP_SERVER_KEY = "prisme-ai-builder";

export const CONFIG_FILE = "config.json";
export const CREDENTIALS_FILE = "credentials.json";

export interface StoredEnvironment {
  apiUrl: string;
  studioUrl?: string;
  workspaces?: Record<string, string>;
  default?: boolean;
}

export interface StoredTopology {
  environments: Record<string, StoredEnvironment>;
  defaultEnvironment?: string;
}

export interface StoredCredential {
  token: string;
  updatedAt?: string;
}

export type StoredCredentials = Record<string, StoredCredential>;

/**
 * Resolve the directory where the MCP persists its config + credentials.
 *
 * Plugins set PRISME_CONFIG_DIR to ${CLAUDE_PLUGIN_DATA} (a per-plugin data
 * dir that survives updates). When the variable is unset — or was not
 * expanded by the host (still contains "${") — fall back to a stable
 * per-user directory so manual `node build/index.js` runs keep working.
 */
export function getConfigDir(): string {
  const fromEnv = process.env.PRISME_CONFIG_DIR;
  if (fromEnv && !fromEnv.includes("${")) {
    return fromEnv;
  }
  return join(homedir(), ".prisme-ai-mcp");
}

function readJsonSync<T>(path: string): T | undefined {
  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch (err: any) {
    if (err.code === "ENOENT") return undefined;
    throw err;
  }
  return JSON.parse(raw) as T;
}

/** Read the environment topology from <configDir>/config.json (sync, startup). */
export function loadTopologySync(): StoredTopology | undefined {
  const topology = readJsonSync<StoredTopology>(join(getConfigDir(), CONFIG_FILE));
  if (topology && (typeof topology.environments !== "object" || topology.environments === null)) {
    throw new Error(`${CONFIG_FILE} must contain an "environments" object`);
  }
  return topology;
}

/** Read stored tokens from <configDir>/credentials.json (sync, startup). */
export function loadCredentialsSync(): StoredCredentials {
  try {
    return readJsonSync<StoredCredentials>(join(getConfigDir(), CREDENTIALS_FILE)) ?? {};
  } catch (err) {
    console.error(
      `Warning: could not read ${CREDENTIALS_FILE}: ${err instanceof Error ? err.message : String(err)}`
    );
    return {};
  }
}

async function writeJsonAtomic(path: string, data: unknown): Promise<void> {
  await fs.mkdir(getConfigDir(), { recursive: true });
  const tmpPath = `${path}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
  await fs.rename(tmpPath, path);
}

/**
 * Persist (or rotate) the API token for one environment in credentials.json.
 * Returns the path written. File mode is 600.
 */
export async function persistToken(environment: string, token: string): Promise<string> {
  const path = join(getConfigDir(), CREDENTIALS_FILE);
  let creds: StoredCredentials = {};
  try {
    creds = readJsonSync<StoredCredentials>(path) ?? {};
  } catch {
    // Corrupt credentials file: rewrite it from scratch.
  }
  creds[environment] = { token, updatedAt: new Date().toISOString() };
  await writeJsonAtomic(path, creds);
  return path;
}

/**
 * Persist the environment topology (no tokens) to config.json.
 * Returns the path written.
 */
export async function persistTopology(topology: StoredTopology): Promise<string> {
  const path = join(getConfigDir(), CONFIG_FILE);
  await writeJsonAtomic(path, topology);
  return path;
}

/** Synchronous variant used during startup migration. */
export function persistTopologySync(topology: StoredTopology): string {
  const dir = getConfigDir();
  mkdirSync(dir, { recursive: true });
  const path = join(dir, CONFIG_FILE);
  const tmpPath = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmpPath, JSON.stringify(topology, null, 2) + "\n", { mode: 0o600 });
  renameSync(tmpPath, path);
  return path;
}

export interface LegacyEnvironment extends StoredEnvironment {
  apiKey?: string;
}

/**
 * One-time migration source: the PRISME_ENVIRONMENTS JSON blob, either from
 * the process environment (old `claude mcp add` registration) or from the
 * legacy ~/.claude.json registration written by setup.sh.
 * Returns environments including any embedded apiKeys so the caller can
 * split them into config.json + credentials.json.
 */
export function importLegacyEnvironments(): Record<string, LegacyEnvironment> | undefined {
  if (process.env.PRISME_ENVIRONMENTS) {
    try {
      return JSON.parse(process.env.PRISME_ENVIRONMENTS);
    } catch {
      console.error("Warning: PRISME_ENVIRONMENTS env var is not valid JSON; ignoring it");
    }
  }

  const claudeJsonPath =
    process.env.PRISME_CLAUDE_JSON_PATH || join(homedir(), ".claude.json");
  try {
    const data = readJsonSync<any>(claudeJsonPath);
    if (!data) return undefined;

    let serverConfig = data?.mcpServers?.[MCP_SERVER_KEY];
    if (!serverConfig && data?.projects && typeof data.projects === "object") {
      for (const proj of Object.values<any>(data.projects)) {
        if (proj?.mcpServers?.[MCP_SERVER_KEY]) {
          serverConfig = proj.mcpServers[MCP_SERVER_KEY];
          break;
        }
      }
    }

    const envsJson = serverConfig?.env?.PRISME_ENVIRONMENTS;
    if (typeof envsJson === "string") {
      return JSON.parse(envsJson);
    }
  } catch {
    // Best-effort migration only; a broken ~/.claude.json must not block startup.
  }
  return undefined;
}

/**
 * Derive the studio page where the user creates API tokens for an environment:
 * <studio-origin>/settings/tokens.
 *
 * Uses studioUrl when configured; otherwise derives the studio origin from the
 * apiUrl by stripping the trailing /vN path and the leading "api." (or "api-")
 * subdomain, e.g. https://api.sandbox.prisme.ai/v2 -> https://sandbox.prisme.ai.
 */
export function deriveTokenUrl(env: { apiUrl?: string; studioUrl?: string }): string | undefined {
  if (env.studioUrl) {
    return `${env.studioUrl.replace(/\/+$/, "")}/settings/tokens`;
  }
  if (!env.apiUrl) return undefined;
  try {
    const url = new URL(env.apiUrl);
    const host = url.host.replace(/^api[.-]/, "");
    return `${url.protocol}//${host}/settings/tokens`;
  } catch {
    return undefined;
  }
}
