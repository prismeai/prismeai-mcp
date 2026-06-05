#!/usr/bin/env node
/**
 * Compile src/App.tsx into a single CJS bundle that the Prisme.ai platform
 * can load via its module loader.
 *
 * Output: dist/bundle.js (committed-friendly, single file, no source maps)
 *
 * The platform expects:
 *   - CJS format with `module.exports.default = AppComponent`
 *   - All shared libs (React, Radix, lucide, @prisme.ai/sdk, ...) as externals
 *     (they are injected by the host's module loader; bundling them would
 *     duplicate React and break hooks)
 */

import * as esbuild from 'esbuild'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { EXTERNALS } from './externals.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const ENTRY = path.join(ROOT, 'src/App.tsx')
const OUT_DIR = path.join(ROOT, 'dist')
const OUT_FILE = path.join(OUT_DIR, 'bundle.js')

const start = Date.now()

const result = await esbuild.build({
  entryPoints: [ENTRY],
  bundle: true,
  format: 'cjs',
  target: 'es2022',
  platform: 'browser',
  jsx: 'automatic',
  minify: true,
  sourcemap: false,
  external: EXTERNALS,
  alias: {
    '@': path.join(ROOT, 'src'),
  },
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts',
  },
  // Tailwind classes are NOT compiled into the bundle — they are served by the
  // platform's main CSS. Only utility classes already present in the platform
  // CSS will style your app. Avoid arbitrary one-off classes.
  metafile: true,
  write: false,
})

await mkdir(OUT_DIR, { recursive: true })
await writeFile(OUT_FILE, result.outputFiles[0].contents)

const elapsed = Date.now() - start
const bytes = result.outputFiles[0].contents.byteLength
const sizeKb = (bytes / 1024).toFixed(1)

console.log(`✓ Built ${path.relative(ROOT, OUT_FILE)} (${sizeKb} KB) in ${elapsed}ms`)
console.log(`  External modules (provided by host): ${EXTERNALS.length}`)

if (result.warnings.length) {
  console.warn(`⚠ ${result.warnings.length} warnings:`)
  for (const w of result.warnings) console.warn('  -', w.text)
}

// Bundle size guard: warn at WARN threshold, fail at MAX. Configurable via env.
// Defaults: warn 500 KB, fail 2 MB. Apps over a few MB load slowly on mobile.
const SIZE_WARN = parseInt(process.env.PRISMEAI_BUNDLE_SIZE_WARN || '512000', 10) // 500 KB
const SIZE_MAX = parseInt(process.env.PRISMEAI_BUNDLE_SIZE_MAX || '2097152', 10)  // 2 MB

if (bytes > SIZE_MAX) {
  console.error(`✗ Bundle exceeds max size: ${sizeKb} KB > ${(SIZE_MAX / 1024).toFixed(0)} KB.`)
  console.error(`  Either trim the bundle (tree-shake, code-split, drop heavy deps)`)
  console.error(`  or raise PRISMEAI_BUNDLE_SIZE_MAX (current: ${SIZE_MAX} bytes).`)
  process.exit(1)
}
if (bytes > SIZE_WARN) {
  console.warn(`⚠ Bundle is ${sizeKb} KB (warn threshold: ${(SIZE_WARN / 1024).toFixed(0)} KB).`)
  console.warn(`  Consider tree-shaking or React.lazy for heavy panels.`)
}
