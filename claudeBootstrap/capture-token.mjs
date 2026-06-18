#!/usr/bin/env node
//
// capture-token.mjs - invoke the browser-based access-token capture flow
// without ever printing the token. The token is written to --output-file
// (mode 600) and only metadata is emitted on stdout.
//
import { writeFileSync, chmodSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const browserModulePath = resolve(__dirname, "..", "build", "auth", "browser.js");

const args = process.argv.slice(2);
const opts = {};
for (let i = 0; i < args.length; i += 2) {
  const key = args[i];
  if (!key || !key.startsWith("--")) {
    process.stderr.write(`Unexpected argument: ${key}\n`);
    process.exit(2);
  }
  opts[key.slice(2)] = args[i + 1];
}

const env = opts["env"];
const studioUrl = opts["studio-url"];
const outputFile = opts["output-file"];
const timeoutSecondsRaw = opts["timeout-seconds"];

if (!env || !studioUrl || !outputFile) {
  process.stderr.write(
    "Usage: capture-token.mjs --env <name> --studio-url <url> --output-file <path> [--timeout-seconds <n>]\n"
  );
  process.exit(2);
}

if (!existsSync(browserModulePath)) {
  process.stderr.write(
    `Browser module not found at ${browserModulePath}. Run 'npm run build' first.\n`
  );
  process.exit(1);
}

let captureAccessToken;
try {
  ({ captureAccessToken } = await import(browserModulePath));
} catch (err) {
  process.stderr.write(
    `Failed to load browser module: ${err instanceof Error ? err.message : String(err)}\n`
  );
  process.exit(1);
}

const timeoutMs = timeoutSecondsRaw
  ? Math.min(Math.max(parseInt(timeoutSecondsRaw, 10) * 1000, 30_000), 900_000)
  : undefined;

try {
  const { token, expiresAt } = await captureAccessToken({
    studioUrl,
    env,
    timeoutMs,
  });
  writeFileSync(outputFile, token, { mode: 0o600 });
  chmodSync(outputFile, 0o600);
  if (expiresAt) {
    process.stdout.write(`EXPIRES_AT=${expiresAt.toISOString()}\n`);
  }
  process.stdout.write("OK\n");
} catch (err) {
  process.stderr.write(
    `${err instanceof Error ? err.message : String(err)}\n`
  );
  process.exit(1);
}
