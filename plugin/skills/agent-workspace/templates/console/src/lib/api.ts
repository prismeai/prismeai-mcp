import type { SDK } from '@/types'

/* ------------------------------------------------------------------ *
 * Workspace webhook client. The console runs in the Studio with the user's
 * session: every call carries the session cookie + the CSRF token, so the
 * automations see the real user and the workspace role check (_guard-control)
 * applies. The page holds no secret (DESIGN.md §8).
 *
 * The gateway cuts a request at ~60 s while the run goes on: the client
 * stops waiting at 50 s and reports `stillRunning`; the caller then follows
 * the work through consoleState (lib/console.tsx).
 * ------------------------------------------------------------------ */

export const CLIENT_TIMEOUT_MS = 50_000

export interface CallResult<T = Record<string, unknown>> {
  ok: boolean
  status: number
  data: T | null
  /** The client stopped waiting; the run continues on the workspace. */
  stillRunning?: boolean
  /** PascalCase error code returned by the automation (DESIGN.md §5.4), or HttpXXX / NetworkError. */
  error?: string
  message?: string
}

function headers(sdk: SDK): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (sdk.token) h['Authorization'] = 'Bearer ' + sdk.token
  if (sdk._csrfToken) h['x-prismeai-csrf-token'] = sdk._csrfToken
  return h
}

function interpret<T>(status: number, data: unknown): CallResult<T> {
  // 504 / 502 from the gateway = the run is still going on the workspace.
  if (status === 504 || status === 502) return { ok: false, status, data: null, stillRunning: true }
  const obj = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  const err = typeof obj.error === 'string' && obj.error ? obj.error : undefined
  const okHttp = status >= 200 && status < 300
  return {
    ok: okHttp && !err,
    status,
    data: data as T,
    error: err || (okHttp ? undefined : `Http${status}`),
    message: typeof obj.message === 'string' ? obj.message : undefined,
  }
}

export function makeClient(sdk: SDK, workspaceId: string) {
  const base = `${sdk.host}/workspaces/${workspaceId}/webhooks`
  return async function call<T = Record<string, unknown>>(slug: string, body: Record<string, unknown> = {}, timeoutMs = CLIENT_TIMEOUT_MS): Promise<CallResult<T>> {
    // Local dev: the mock host answers in memory, with the same timeout rule.
    if (sdk.mockCall) {
      const mock = sdk.mockCall
      return new Promise((resolve) => {
        const timer = window.setTimeout(() => resolve({ ok: false, status: 0, data: null, stillRunning: true }), timeoutMs)
        mock(slug, body)
          .then((r) => resolve(interpret<T>(r.status, r.body)))
          .catch((e: Error) => resolve({ ok: false, status: 0, data: null, error: 'NetworkError', message: e.message }))
          .finally(() => window.clearTimeout(timer))
      })
    }
    const ctrl = new AbortController()
    const timer = window.setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(`${base}/${slug}`, { method: 'POST', credentials: 'include', headers: headers(sdk), body: JSON.stringify(body), signal: ctrl.signal })
      const text = await res.text()
      let data: unknown = null
      try {
        data = text ? JSON.parse(text) : null
      } catch {
        data = { message: text.slice(0, 300) }
      }
      return interpret<T>(res.status, data)
    } catch (e) {
      if ((e as Error).name === 'AbortError') return { ok: false, status: 0, data: null, stillRunning: true }
      return { ok: false, status: 0, data: null, error: 'NetworkError', message: (e as Error).message }
    } finally {
      window.clearTimeout(timer)
    }
  }
}

export type Call = ReturnType<typeof makeClient>
