import { promises as fs } from "fs";
import { homedir } from "os";
import { join } from "path";

const MCP_SERVER_KEY = "prisme-ai-builder";

export interface PersistResult {
  scope: "user" | "project";
  projectKey?: string;
  path: string;
}

function getClaudeJsonPath(): string {
  return process.env.PRISME_CLAUDE_JSON_PATH || join(homedir(), ".claude.json");
}

/**
 * Update the JWT for the given environment in the user's ~/.claude.json.
 * Writes atomically (tmp + rename) and preserves all other keys.
 *
 * Resolution order matches setup.sh:
 *   1. data.mcpServers["prisme-ai-builder"] (user scope)
 *   2. data.projects[projectDir].mcpServers["prisme-ai-builder"] (project scope, if provided)
 *   3. Any data.projects[*].mcpServers["prisme-ai-builder"] (first match, fallback)
 */
export async function persistApiKey(
  environment: string,
  apiKey: string,
  projectDir?: string
): Promise<PersistResult> {
  const claudeJsonPath = getClaudeJsonPath();

  let raw: string;
  try {
    raw = await fs.readFile(claudeJsonPath, "utf-8");
  } catch (err: any) {
    if (err.code === "ENOENT") {
      throw new Error(
        `No ${claudeJsonPath} found. The MCP must be registered via \`claude mcp add\` or setup.sh first.`
      );
    }
    throw err;
  }

  let data: any;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Failed to parse ${claudeJsonPath}: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  let serverConfig: any | undefined;
  let scope: "user" | "project" = "user";
  let projectKey: string | undefined;

  if (data?.mcpServers?.[MCP_SERVER_KEY]) {
    serverConfig = data.mcpServers[MCP_SERVER_KEY];
    scope = "user";
  } else if (
    projectDir &&
    data?.projects?.[projectDir]?.mcpServers?.[MCP_SERVER_KEY]
  ) {
    serverConfig = data.projects[projectDir].mcpServers[MCP_SERVER_KEY];
    scope = "project";
    projectKey = projectDir;
  } else if (data?.projects && typeof data.projects === "object") {
    for (const [key, proj] of Object.entries<any>(data.projects)) {
      if (proj?.mcpServers?.[MCP_SERVER_KEY]) {
        serverConfig = proj.mcpServers[MCP_SERVER_KEY];
        scope = "project";
        projectKey = key;
        break;
      }
    }
  }

  if (!serverConfig) {
    throw new Error(
      `No existing "${MCP_SERVER_KEY}" MCP server found in ${claudeJsonPath}. Register it via setup.sh first.`
    );
  }

  if (!serverConfig.env) serverConfig.env = {};

  let envsJson: string | undefined = serverConfig.env.PRISME_ENVIRONMENTS;
  let envs: Record<string, any> = {};

  if (envsJson) {
    try {
      envs = JSON.parse(envsJson);
    } catch (err) {
      throw new Error(
        `Existing PRISME_ENVIRONMENTS in ${claudeJsonPath} is not valid JSON.`
      );
    }
  }

  if (!envs[environment]) {
    throw new Error(
      `Environment "${environment}" not found in PRISME_ENVIRONMENTS. Add it via setup.sh first.`
    );
  }

  envs[environment].apiKey = apiKey;
  serverConfig.env.PRISME_ENVIRONMENTS = JSON.stringify(envs);

  // Atomic write: temp file + rename
  const tmpPath = `${claudeJsonPath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), { mode: 0o600 });
  await fs.rename(tmpPath, claudeJsonPath);

  return { scope, projectKey, path: claudeJsonPath };
}
