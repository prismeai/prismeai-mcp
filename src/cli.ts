import axios from "axios";
import { homedir } from "os";
import { isAbsolute, join, resolve } from "path";
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
import { loadEnvironmentCatalog } from "./environments.js";
import { createExtraCaAgent } from "./tls.js";

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

function cleanApiUrl(value: string): string {
  const input = normalizeUrlInput(value);
  const url = new URL(input);
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function cleanStudioUrl(value: string): string {
  const input = normalizeUrlInput(value);
  const url = new URL(input);
  url.pathname = "";
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

function cleanExtraCaCertsPath(value: string): string {
  const unquoted = value.trim().replace(/^(["'])(.*)\1$/, "$2");
  const expanded =
    unquoted === "~"
      ? homedir()
      : unquoted.startsWith("~/")
        ? join(homedir(), unquoted.slice(2))
        : unquoted;
  return isAbsolute(expanded) ? expanded : resolve(expanded);
}

/**
 * The environment a call without `environment` reaches, by the server's
 * rules: a `default: true` entry, else `defaultEnvironment`, else the only
 * configured environment. PRISME_DEFAULT_ENVIRONMENT is the server's own
 * variable and cannot be seen from here.
 */
function effectiveDefault(topology: StoredTopology): string | undefined {
  const names = Object.keys(topology.environments);
  const flagged = names.filter((name) => topology.environments[name].default === true);
  if (flagged.length > 0) return flagged[flagged.length - 1];
  if (topology.defaultEnvironment && topology.environments[topology.defaultEnvironment]) {
    return topology.defaultEnvironment;
  }
  return names.length === 1 ? names[0] : undefined;
}

function printDefaultStatus(topology: StoredTopology): void {
  const names = Object.keys(topology.environments);
  if (names.length === 0) return;
  const current = effectiveDefault(topology);
  console.log(
    current
      ? `Default environment: ${current} (configured: ${names.join(", ")}).`
      : `No default environment: each request must name one of ${names.join(", ")}. ` +
          `Run set-token <environment> --default to choose one.`
  );
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

    output.write(question);
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

async function promptRequiredLine(question: string): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const answer = await promptLine(question);
    if (answer) return answer;
    console.error("No API URL entered. Paste the API URL, then press Enter. Press Ctrl+C to cancel.");
  }
  return "";
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
      "Only this environment is added to config.json.",
      "",
      "Options:",
      "  --api-url <url>                   API base URL (optional; prompts if missing)",
      "  --studio-url <url>                Studio origin (optional; prompts interactively)",
      "  --node-extra-ca-certs <pem-path>  Extra trusted CA bundle for this environment",
      "  --default                         Make this environment the default one",
      "  --config-dir <dir>                Config dir to write to (defaults to PRISME_CONFIG_DIR or ~/.prisme-ai-mcp)",
      "",
      "The token is read from an interactive hidden prompt, or from the PRISME_TOKEN",
      "env var if set. Avoid passing it as a plain argument (shell history leak).",
      "The API URL must be the Prisme API base URL, e.g.",
      "https://api.sandbox.prisme.ai/v2. If unsure, open the Prisme instance",
      "in a browser and copy the API origin/path from the Network tab.",
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

  return setToken(environment, flags);
}

async function setToken(
  environment: string,
  flags: Record<string, string | true>
): Promise<number> {
  const makeDefault = flags.default === true;
  if (flags.default !== undefined && !makeDefault) {
    console.error(
      `--default takes no value. Put it after the environment name, e.g. set-token ${environment} --default`
    );
    return 1;
  }

  // Only registered environments go to config.json. The shipped catalog
  // (sandbox, staging, prod) lends its URLs as examples and defaults for an
  // environment of the same name; fresh interactive setup still asks for the
  // API URL.
  let storedTopology: StoredTopology | undefined;
  try {
    storedTopology = loadTopologySync();
  } catch (error) {
    console.error(
      `Could not read config.json: ${error instanceof Error ? error.message : String(error)}. ` +
        `Fix or delete it, then try again. Nothing was saved.`
    );
    return 1;
  }
  const topology: StoredTopology = storedTopology ?? { environments: {} };

  const existing = storedTopology?.environments[environment];
  const fallbackExisting = existing ?? loadEnvironmentCatalog()[environment];
  const exampleApiUrl =
    fallbackExisting?.apiUrl ?? "https://api.sandbox.prisme.ai/v2";
  const apiUrlFlag = flagString(flags, "api-url");
  const studioUrlFlag = flagString(flags, "studio-url");
  const extraCaCertsFlag = flagString(flags, "node-extra-ca-certs");
  let apiUrl: string | undefined;
  let studioUrl: string | undefined;
  try {
    apiUrl = apiUrlFlag ? cleanApiUrl(apiUrlFlag) : existing?.apiUrl;
    studioUrl = studioUrlFlag
      ? cleanStudioUrl(studioUrlFlag)
      : existing?.studioUrl;
  } catch (error) {
    console.error(
      `Invalid URL: ${error instanceof Error ? error.message : String(error)}`
    );
    return 1;
  }
  let nodeExtraCaCerts = extraCaCertsFlag
    ? cleanExtraCaCertsPath(extraCaCertsFlag)
    : existing?.nodeExtraCaCerts;

  if (!apiUrl && !process.stdin.isTTY) {
    console.error(
      `No API URL provided. Pass --api-url, e.g. --api-url ${exampleApiUrl}`
    );
    return 1;
  }

  console.log(`Prisme.ai token setup (${environment})`);

  // Token: PRISME_TOKEN env var, else interactive hidden prompt.
  let token = process.env.PRISME_TOKEN?.trim();
  if (!token) {
    token = await promptRequiredHidden("Token (hidden): ");
  }
  if (!token) {
    console.error("No token provided. Aborting; nothing was saved.");
    return 1;
  }

  if (process.stdin.isTTY) {
    const apiPrompt = apiUrl
      ? `API URL [${apiUrl}]: `
      : `API URL (e.g. ${exampleApiUrl}; copy from Network tab if unsure): `;
    const apiInput = apiUrl ? await promptLine(apiPrompt) : await promptRequiredLine(apiPrompt);
    if (apiInput) {
      try {
        apiUrl = cleanApiUrl(apiInput);
        studioUrl = studioUrl ?? deriveStudioUrl(apiInput);
      } catch {
        console.error(
          `Invalid API URL "${apiInput}". Use the API base URL, e.g. ${exampleApiUrl}.`
        );
        return 1;
      }
    }

    const suggestedStudioUrl = studioUrl ?? (apiUrl ? deriveStudioUrl(apiUrl) : undefined);
    const studioPrompt = suggestedStudioUrl
      ? `Studio URL [${suggestedStudioUrl}]: `
      : "Studio URL (e.g. https://sandbox.prisme.ai): ";
    const studioInput = await promptLine(studioPrompt);
    try {
      studioUrl = studioInput
        ? cleanStudioUrl(studioInput)
        : suggestedStudioUrl;
    } catch {
      console.error(
        `Invalid Studio URL "${studioInput}". Use the Studio origin, e.g. https://sandbox.prisme.ai.`
      );
      return 1;
    }

    const extraCaPrompt = nodeExtraCaCerts
      ? `NODE_EXTRA_CA_CERTS PEM path (optional) [${nodeExtraCaCerts}]: `
      : "NODE_EXTRA_CA_CERTS PEM path (optional; press Enter to skip): ";
    const extraCaInput = await promptLine(extraCaPrompt);
    if (extraCaInput) {
      nodeExtraCaCerts = cleanExtraCaCertsPath(extraCaInput);
    }
  }

  if (!apiUrl) {
    console.error(
      `No API URL provided. Aborting; nothing was saved. Use the API base URL, e.g. ${exampleApiUrl}.`
    );
    return 1;
  }

  let httpsAgent;
  try {
    httpsAgent = createExtraCaAgent(nodeExtraCaCerts);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error("Aborting; nothing was saved.");
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
      ...(httpsAgent ? { httpsAgent } : {}),
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
    ...(fallbackExisting ?? {}),
    apiUrl,
    ...(studioUrl ? { studioUrl } : {}),
    ...(nodeExtraCaCerts ? { nodeExtraCaCerts } : {}),
  };
  topology.environments[environment] = merged;
  if (makeDefault) {
    for (const env of Object.values(topology.environments)) {
      delete env.default;
    }
    topology.defaultEnvironment = environment;
  }

  try {
    await persistTopology(topology);
    const credentialsPath = await persistToken(environment, token);
    const who = me?.email ?? me?.id ?? "(authenticated)";
    console.log(
      `Saved token for "${environment}" (validated as ${who}) to ${credentialsPath}.`
    );
    printDefaultStatus(topology);
    console.log("Re-run your request in Claude Code / Codex — no restart needed.");
    return 0;
  } catch (error) {
    console.error(
      `Failed to write config: ${error instanceof Error ? error.message : String(error)}`
    );
    return 1;
  }
}
