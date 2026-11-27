import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import type { StoredEnvironment, StoredTopology } from "./auth/persist.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Prisme.ai environments known in advance, shipped in
 * config/default-environments.json. They are a catalog, not a configuration:
 * they only suggest the API and Studio URLs when an environment of the same
 * name is registered. An environment exists once it is in config.json, so a
 * customer install never inherits sandbox/staging/prod, nor a default flag.
 */
export function loadEnvironmentCatalog(): Record<string, StoredEnvironment> {
  // From the bundled layout (plugin/build/index.js) the file is at ../config;
  // from the tsc/tsx layouts (build/*.js, src/*.ts) it is at <repo>/plugin/config.
  const candidates = [
    join(__dirname, "..", "config", "default-environments.json"),
    join(__dirname, "..", "plugin", "config", "default-environments.json"),
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      const parsed = JSON.parse(readFileSync(path, "utf-8")) as StoredTopology;
      const catalog: Record<string, StoredEnvironment> = {};
      for (const [name, env] of Object.entries(parsed.environments ?? {})) {
        if (typeof env?.apiUrl !== "string") continue;
        const { default: _default, workspaces: _workspaces, ...urls } = env;
        catalog[name] = urls;
      }
      return catalog;
    } catch {
      // An unreadable catalog only loses the URL suggestions.
    }
  }
  return {};
}

export interface SetupCommandContext {
  /** Absolute path of the server script, to print a runnable command. */
  scriptPath?: string;
  /** Config dir the running server reads, passed as --config-dir. */
  configDir?: string;
}

/** The out-of-band `set-token` command, as one copyable shell line. */
export function setTokenCommand(
  environment: string,
  context: SetupCommandContext,
  apiUrl?: string
): string {
  const script = context.scriptPath ?? "<plugin>/build/index.js";
  return (
    `node "${script}" set-token ${environment}` +
    (apiUrl ? ` --api-url ${apiUrl}` : "") +
    (context.configDir ? ` --config-dir "${context.configDir}"` : "")
  );
}

/**
 * Error for a call naming an environment that is not configured. It lists the
 * configured names and the exact command that registers the requested one.
 */
export function unknownEnvironmentError(
  environment: string,
  available: string[],
  context: SetupCommandContext
): Error {
  const known = loadEnvironmentCatalog()[environment];
  const guidance = known
    ? `"${environment}" is a known Prisme.ai environment (${known.apiUrl}) but it is not configured here. ` +
      `Create an API token in its studio, then run this as one shell command ` +
      `(copy it exactly; do not insert line breaks inside quoted paths):`
    : `If you meant "${environment}", configure it before retrying. ` +
      `Create an API token in the target Prisme.ai studio, find the environment API URL ` +
      `(for example https://studio.prisme.ai uses https://api.studio.prisme.ai/v2, ` +
      `and https://sandbox.prisme.ai uses https://api.sandbox.prisme.ai/v2). Then run this as one shell command ` +
      `(copy it exactly; do not insert line breaks inside quoted paths). ` +
      `You may also omit --api-url and enter the API URL when the CLI prompts:`;
  return new Error(
    `Unknown environment: "${environment}". ` +
      `Available: ${available.length > 0 ? available.join(", ") : "none configured"}. ` +
      `${guidance}\n\n` +
      `   ${setTokenCommand(environment, context, known?.apiUrl ?? "<api-url>")}\n\n` +
      `Agents should use the /prisme-ai:setup skill for the setup workflow.`
  );
}

/**
 * Error for a call with no `environment` when no default can be chosen:
 * nothing is configured yet, or several environments are and none is marked
 * as the default. Guessing one would send the call to the wrong instance.
 */
export function noEnvironmentSelectedError(
  available: string[],
  context: SetupCommandContext
): Error {
  if (available.length === 0) {
    return new Error(
      `No Prisme.ai environment is configured yet. Ask the user which environment to use and its API URL, ` +
        `then have them create an API token in its studio and run this in their own terminal as one shell command ` +
        `(copy it exactly; do not insert line breaks inside quoted paths):\n\n` +
        `   ${setTokenCommand("<environment>", context, "<api-url>")}\n\n` +
        `Agents should use the /prisme-ai:setup skill for the setup workflow.`
    );
  }
  return new Error(
    `No environment given, and no default environment is configured. ` +
      `Pass \`environment\` with one of: ${available.join(", ")}. ` +
      `If the request does not say which one, ask the user.`
  );
}
