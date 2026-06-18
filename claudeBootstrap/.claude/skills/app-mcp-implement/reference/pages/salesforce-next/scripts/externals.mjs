// Modules provided by the Prisme.ai platform at runtime — DO NOT bundle them.
// This list mirrors the platform's sharedModules.ts. If you import a package
// not listed here, esbuild will bundle it into your app's output.
//
// Source of truth on the platform side:
// services/platform/src/lib/sharedModules.ts (EXTERNAL_MODULES export)

export const EXTERNALS = [
  // React
  'react',
  'react-dom',
  'react-dom/client',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',

  // State
  'jotai',
  'jotai/utils',

  // Prisme SDK (host injects an authenticated singleton — never bundle this)
  '@prisme.ai/sdk',

  // Radix UI primitives (only the ones the host pre-loads)
  '@radix-ui/react-alert-dialog',
  '@radix-ui/react-dialog',
  '@radix-ui/react-dropdown-menu',
  '@radix-ui/react-tabs',
  '@radix-ui/react-tooltip',
  '@radix-ui/react-collapsible',
  '@radix-ui/react-scroll-area',
  '@radix-ui/react-separator',
  '@radix-ui/react-slot',
  '@radix-ui/react-select',
  '@radix-ui/react-avatar',
  '@radix-ui/react-popover',
  // NOTE: @radix-ui/react-label / react-switch / react-slider are NOT in the
  // platform socle (verified via the runtime ModuleLoadError "available modules"
  // list) — keep them OUT of externals so esbuild bundles them. The starter list
  // drifts from the real socle; see feedback_starter_spa_externals_drift.

  // Utilities
  'clsx',
  'tailwind-merge',
  'class-variance-authority',

  // Icons — NOTE: the host pre-loads a curated subset (~250 icons). If your
  // app references an icon not in that subset it will fail at runtime with
  // "X is undefined". Stick to commonly used icons or check with the platform team.
  'lucide-react',
]
