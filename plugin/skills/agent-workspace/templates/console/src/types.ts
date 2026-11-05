/**
 * Host contract — the props the Prisme.ai platform passes to the App.
 *
 * The platform's AppRenderer mounts the default export of src/App.tsx with these
 * props. src/lib/mockHost.ts (local dev) builds the same shape.
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

/** Local dev only: answers a webhook call without a network (src/lib/mockHost.ts). */
export type MockCall = (slug: string, body: Record<string, unknown>) => Promise<{ status: number; body: unknown }>

export interface SDK {
  host?: string
  token?: string
  _csrfToken?: string
  streamEvents(workspaceId: string, filters?: Record<string, unknown>): Promise<Events>
  /** Set by the local mock host only; never present in the platform. */
  mockCall?: MockCall
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
