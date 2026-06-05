/**
 * Mock host for local development (`npm run dev`).
 *
 * In production, the Prisme.ai platform injects `sdk`, `user`, `workspace`, and
 * `backends` props into your App component. Locally we provide a minimal stub so
 * the demo can render and webhook/event calls don't crash.
 *
 * If you need real calls during local dev, point VITE_PRISME_API_URL +
 * VITE_PRISME_API_KEY at a real workspace (uses fetch directly, no SDK needed).
 */

import type { AppProps } from '@/types'

type Listener = (event: { type: string; payload?: Record<string, unknown> }) => void

function makeMockEvents() {
  const listeners = new Map<string, Set<Listener>>()
  return {
    on(event: string, cb: Listener) {
      if (!listeners.has(event)) listeners.set(event, new Set())
      listeners.get(event)!.add(cb)
      return () => listeners.get(event)?.delete(cb)
    },
    emit(event: string, payload?: Record<string, unknown>) {
      console.info('[mock] emit', event, payload)
      // Echo handler: if the app emits "app.greeting.requested", respond locally.
      if (event === 'app.greeting.requested') {
        setTimeout(() => {
          const set = listeners.get('app.greeting.completed')
          set?.forEach((cb) =>
            cb({
              type: 'app.greeting.completed',
              payload: {
                message: `Hello ${(payload?.name as string) || 'World'} (local mock — no automation ran)`,
              },
            })
          )
        }, 400)
      }
    },
    close() {
      listeners.clear()
    },
  }
}

export function buildMockProps(): AppProps {
  const apiUrl = (import.meta.env.VITE_PRISME_API_URL as string | undefined) || ''
  const apiToken = (import.meta.env.VITE_PRISME_API_KEY as string | undefined) || ''

  return {
    sdk: {
      host: apiUrl,
      token: apiToken,
      async streamEvents() {
        console.info('[mock] streamEvents — using local echo (no real WebSocket)')
        return makeMockEvents()
      },
    },
    user: { id: 'local-dev-user', email: 'dev@example.com' },
    workspace: {
      id: 'local-dev-workspace',
      slug: 'local-dev',
      name: 'Local Dev Workspace',
    },
    backends: {},
  }
}
