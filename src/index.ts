#!/usr/bin/env node

// Entry point. Two modes:
//   - `node build/index.js`                  -> start the MCP stdio server
//   - `node build/index.js set-token ...`    -> out-of-band CLI to register a
//                                               token without going through the
//                                               chat (keeps it off the wire to
//                                               the LLM provider)
//
// The server modules (and their config side effects) are loaded lazily so the
// CLI path stays fast and side-effect free.

const CLI_COMMANDS = new Set(["set-token", "help", "--help", "-h"]);

async function main() {
  const command = process.argv[2];

  if (command && CLI_COMMANDS.has(command)) {
    const { runCli } = await import("./cli.js");
    process.exit(await runCli(process.argv.slice(2)));
  }

  const { startServer } = await import("./server.js");
  await startServer();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
