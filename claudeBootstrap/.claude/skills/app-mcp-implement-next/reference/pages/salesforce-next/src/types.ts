/**
 * Host contract — the props the Prisme.ai platform passes to your App.
 *
 * The platform's AppRenderer mounts your default export with these props.
 * Both src/App.tsx (the real component) and src/lib/mockHost.ts (local-dev
 * stub) import from here so the contract has a single source of truth.
 */

export interface PrismeEvent {
  type: string
  payload?: { [key: string]: unknown }
}

export interface Events {
  on(event: string, cb: (data: PrismeEvent) => void): () => void
  emit(event: string, payload?: Record<string, unknown>): void
  close(): void
}

export interface SDK {
  host?: string
  token?: string
  _csrfToken?: string
  streamEvents(workspaceId: string, filters?: Record<string, unknown>): Promise<Events>
}

export interface BackendConfig {
  slug: string
}

export interface AppProps {
  sdk: SDK
  user: unknown
  workspace: { id: string; slug: string; name: string }
  backends?: Record<string, BackendConfig>
  agents?: Record<string, string>
}
