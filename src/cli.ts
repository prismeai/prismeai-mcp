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

function normalizeUrlInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function normalizeApiUrl(value: string): string {
  const input = normalizeUrlInput(value);
  const url = new URL(input);
  if (!/^api[.-]/.test(url.hostname)) {
    url.hostname = `api.${url.hostname}`;
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  if (!/\/v\d+$/.test(url.pathname)) {
    url.pathname = `${url.pathname === "/" ? "" : url.pathname}/v2`;
  }
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function deriveStudioUrl(value: string): string | undefined {
  const input = normalizeUrlInput(value);
  try {
    const url = new URL(input);
    url.hostname = url.hostname.replace(/^api[.-]/, "");
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return undefined;
  }
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
    const output = process.stderr;

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

    output.write("\n=== READY FOR TOKEN INPUT ===\n");
    output.write(`${question}\n`);
    output.write("Paste the token now, then press Enter. Input is hidden, so typed/pasted characters will not appear.\n");
    output.write("Token > ");
    muted = true;
    rl.question("", (answer) => {
      rl.close();
      output.write("\n");
      resolve(answer.trim());
    });
  });
}

function promptLine(question: string): Promise<string> {
  return new Promise((resolve) => {
    const input = process.stdin;
    const output = process.stdout;

    if (!input.isTTY) {
      resolve("");
      return;
    }

    const rl = createInterface({ input, output });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function promptRequiredHidden(question: string): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const answer = await promptHidden(question);
    if (answer) return answer;
    console.error("No token entered. Paste the token, then press Enter. Press Ctrl+C to cancel.");
  }
  return "";
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
      "  --api-url <url>      API base URL (optional; prompts if missing)",
      "  --studio-url <url>   Studio origin (optional; used for token-creation links)",
      "  --config-dir <dir>   Config dir to write to (defaults to PRISME_CONFIG_DIR or ~/.prisme-ai-mcp)",
      "",
      "The token is read from an interactive hidden prompt, or from the PRISME_TOKEN",
      "env var if set. Avoid passing it as a plain argument (shell history leak).",
      "For the instance URL prompt, you can enter either the studio/base URL",
      "(https://sandbox.prisme.ai) or the API URL (https://api.sandbox.prisme.ai/v2).",
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
  let apiUrl = apiUrlFlag ? normalizeApiUrl(apiUrlFlag) : existing?.apiUrl;
  let studioUrl = studioUrlFlag ?? existing?.studioUrl;

  if (!apiUrl && !process.stdin.isTTY) {
    const known = Object.keys(topology.environments).join(", ") || "(none)";
    console.error(
      `Unknown environment "${environment}" (known: ${known}). ` +
        `Pass --api-url to register it, e.g. --api-url https://api.sandbox.prisme.ai/v2. ` +
        `You can also pass the studio/base URL, e.g. --api-url https://sandbox.prisme.ai.`
    );
    return 1;
  }

  console.log(`Registering token for environment "${environment}".`);
  console.log(`Config dir: ${getConfigDir()}`);
  if (apiUrl) {
    console.log(`Resolved API URL: ${apiUrl}`);
  }
  console.log("The token input is hidden. Paste the token, then press Enter.");

  // Token: PRISME_TOKEN env var, else interactive hidden prompt.
  let token = process.env.PRISME_TOKEN?.trim();
  if (!token) {
    token = await promptRequiredHidden(`Paste the API token for "${environment}" (input hidden)`);
  }
  if (!token) {
    console.error("No token provided. Aborting; nothing was saved.");
    return 1;
  }

  if (!apiUrl) {
    const known = Object.keys(topology.environments).join(", ") || "(none)";
    console.log(`Unknown environment "${environment}" (known: ${known}).`);
    console.log(
      "Enter the instance URL. Accepted formats: https://sandbox.prisme.ai or https://api.sandbox.prisme.ai/v2."
    );
  }

  if (process.stdin.isTTY) {
    const apiPrompt = apiUrl
      ? `Instance API URL or studio/base URL [${apiUrl}]: `
      : "Instance API URL or studio/base URL: ";
    const apiInput = await promptLine(apiPrompt);
    if (apiInput) {
      try {
        apiUrl = normalizeApiUrl(apiInput);
        studioUrl = studioUrl ?? deriveStudioUrl(apiInput);
      } catch {
        console.error(
          `Invalid instance URL "${apiInput}". Use a studio/base URL like https://sandbox.prisme.ai or an API URL like https://api.sandbox.prisme.ai/v2.`
        );
        return 1;
      }
    }
  }

  if (!apiUrl) {
    console.error(
      "No API URL provided. Aborting; nothing was saved. Use a studio/base URL like https://sandbox.prisme.ai or an API URL like https://api.sandbox.prisme.ai/v2."
    );
    return 1;
  }

  // Probe-validate before persisting anything.
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
