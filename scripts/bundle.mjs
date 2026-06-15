#!/usr/bin/env node
// Bundle the MCP server into a single self-contained plugin/build/index.js
// (the committed artifact shipped with the plugin).
// Requires linter/dist to be built first (npm run build:bundle handles that).
import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  outfile: "plugin/build/index.js",
  sourcemap: false,
  minify: false,
  // CJS deps (axios, form-data, adm-zip...) may call require() at runtime;
  // provide one in the ESM output.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module';\nconst require = __createRequire(import.meta.url);",
  },
  logLevel: "info",
});
