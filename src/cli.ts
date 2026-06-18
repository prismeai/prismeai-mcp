import axios from "axios";
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createInterface } from "readline";
import {
  getConfigDir,
  loadTopologySync,
  persistToken,
  persistTopology,
  deriveTokenUrl,
  type StoredTopology,
  type StoredEnvironment,
} from "./auth/persist.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface ParsedArgs {
  positional: string[];
  flags: Record<string, string | true>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i++;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function flagString(flags: Record<string, string | true>, key: string): string | undefined {
  const value = flags[key];
  return typeof value === "string" ? value : undefined;
}

/** Read the default topology shipped with the plugin (bundled or tsc layout). */
function loadShippedDefaults(): StoredTopology | undefined {
  const candidates = [
    join(__dirname, "..", "config", "default-environments.json"),
    join(__dirname, "..", "plugin", "config", "default-environments.json"),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      try {
        return JSON.parse(readFileSync(path, "utf-8")) as StoredTopology;
      } catch {
        // ignore and fall through
      }
    }
  }
  return undefined;
}

/**
 * Prompt for the token without echoing it to the terminal. Falls back to
 * reading the first line of piped stdin when there is no TTY.
 */
function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const input = process.stdin;
    const output = process.stdout;

    if (!input.isTTY) {
      let data = "";
      input.setEncoding("utf8");
      input.on("data", (chunk) => (data += chunk));
      input.on("end", () => resolve(data.split(/\r?\n/)[0]?.trim() ?? ""));
      return;
    }

    const rl = createInterface({ input, output });
    let muted = false;
    const rlInternal = rl as unknown as { _writeToOutput: (s: string) => void };
    const original = rlInternal._writeToOutput.bind(rl);
    rlInternal._writeToOutput = (stringToWrite: string) => {
      if (!muted) original(stringToWrite);
    };

    output.write(question);
    muted = true;
    rl.question("", (answer) => {
      rl.close();
      output.write("\n");
      resolve(answer.trim());
    });
  });
}

function printUsage(): void {
  console.log(
    [
      "Prisme.ai MCP — token registration CLI",
      "",
      "Usage:",
      "  node <plugin>/build/index.js set-token <environment> [options]",
      "",
      "Registers (or rotates) an API token for an environment WITHOUT sending it",
      "through the chat / to the LLM provider. The token is validated against the",
      "API before being saved to the config dir (credentials.json, mode 600).",
      "",
      "Options:",
      "  --api-url <url>      API base URL (required only for a brand-new environment)",
      "  --studio-url <url>   Studio origin (optional; used for token-creation links)",
      "  --config-dir <dir>   Config dir to write to (defaults to PRISME_CONFIG_DIR or ~/.prisme-ai-mcp)",
      "",
      "The token is read from an interactive hidden prompt, or from the PRISME_TOKEN",
      "env var if set. Avoid passing it as a plain argument (shell history leak).",
      "",
      "After it succeeds, re-run your request in Claude Code / Codex (no restart needed).",
    ].join("\n")
  );
}

export async function runCli(argv: string[]): Promise<number> {
  const { positional, flags } = parseArgs(argv);
  const command = positional[0];

  if (command === "help" || flags.help || command === undefined) {
    printUsage();
    return command === undefined ? 1 : 0;
  }

  if (command !== "set-token") {
    console.error(`Unknown command "${command}". Run \`help\` for usage.`);
    return 1;
  }

  const environment = positional[1];
  if (!environment) {
    console.error("Missing <environment>. Example: set-token sandbox");
    return 1;
  }

  // --config-dir overrides where we read/write (the server passes its own dir).
  const configDir = flagString(flags, "config-dir");
  if (configDir) {
    process.env.PRISME_CONFIG_DIR = configDir;
  }

  // Resolve the environment's apiUrl: stored topology > shipped defaults > --api-url.
  let topology: StoredTopology;
  try {
    topology = loadTopologySync() ?? loadShippedDefaults() ?? { environments: {} };
  } catch (error) {
    console.error(
      `Could not read existing config: ${error instanceof Error ? error.message : String(error)}`
    );
    topology = { environments: {} };
  }

  const existing = topology.environments[environment];
  const apiUrlFlag = flagString(flags, "api-url");
  const studioUrlFlag = flagString(flags, "studio-url");
  const apiUrl = apiUrlFlag ?? existing?.apiUrl;

  if (!apiUrl) {
    const known = Object.keys(topology.environments).join(", ") || "(none)";
    console.error(
      `Unknown environment "${environment}" (known: ${known}). ` +
        `Pass --api-url to register it, e.g. --api-url https://api.sandbox.prisme.ai/v2`
    );
    return 1;
  }

  // Token: PRISME_TOKEN env var, else interactive hidden prompt.
  let token = process.env.PRISME_TOKEN?.trim();
  if (!token) {
    token = await promptHidden(`Paste the API token for "${environment}" (input hidden): `);
  }
  if (!token) {
    console.error("No token provided. Aborting; nothing was saved.");
    return 1;
  }

  // Probe-validate before persisting anything.
  const studioUrl = studioUrlFlag ?? existing?.studioUrl;
  process.stdout.write(`Validating token against ${apiUrl} ... `);
  let me: any;
  try {
    const probe = axios.create({
      baseURL: apiUrl,
      timeout: 15000,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    const response = await probe.get("/me");
    me = response.data;
    console.log("ok");
  } catch (error) {
    const status = (error as any)?.response?.status;
    const tokenUrl = deriveTokenUrl({ apiUrl, studioUrl });
    console.log("failed");
    console.error(
      `Token validation failed${status ? ` (HTTP ${status})` : ""}. Nothing was saved. ` +
        `Create a valid token at ${tokenUrl ?? "<studio>/settings/tokens"} and try again.`
    );
    return 1;
  }

  // Persist topology (ensure the env exists) + token.
  const merged: StoredEnvironment = {
    ...(existing ?? {}),
    apiUrl,
    ...(studioUrl ? { studioUrl } : {}),
  };
  topology.environments[environment] = merged;

  try {
    await persistTopology(topology);
    const credentialsPath = await persistToken(environment, token);
    const who = me?.email ?? me?.id ?? "(authenticated)";
    console.log(
      `Saved token for "${environment}" (validated as ${who}) to ${credentialsPath}.`
    );
    console.log("Re-run your request in Claude Code / Codex — no restart needed.");
    return 0;
  } catch (error) {
    console.error(
      `Failed to write config: ${error instanceof Error ? error.message : String(error)}`
    );
    return 1;
  }
}
