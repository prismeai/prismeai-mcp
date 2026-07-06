import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { SDK } from '../types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Platform host base (…/v2). Single source of truth shared by App.tsx and the
// CatalogPublish module so both target the same api origin.
export function resolveHost(sdk?: SDK): string {
  if (sdk?.host) return sdk.host
  const o = window.location.origin
  return o.replace('https://', 'https://api.').replace('http://', 'http://api.') + '/v2'
}

export function readParam(name: string): string {
  return new URLSearchParams(window.location.search).get(name) || ''
}

// Authenticated headers for platform API calls made with the user's Studio
// session (Bearer + CSRF). credentials:'include' is still required at the call site.
export function apiHeaders(sdk?: SDK): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (sdk?.token) h['Authorization'] = 'Bearer ' + sdk.token
  const csrf = sdk?._csrfToken
  if (csrf) h['x-prismeai-csrf-token'] = csrf
  return h
}
