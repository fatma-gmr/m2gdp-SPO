import type { APIRequestContext, APIResponse } from '@playwright/test'
import { tokens } from './testData'

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/** Appelle l'API avec le jeton du compte de test `uid` (ou sans jeton si `uid` est null). */
export function call(
  request: APIRequestContext,
  uid: string | null,
  method: Method,
  url: string,
  data?: unknown,
): Promise<APIResponse> {
  const headers: Record<string, string> = uid ? { Authorization: `Bearer ${tokens()[uid]}` } : {}
  return request.fetch(url, { method, headers, ...(data !== undefined ? { data } : {}) })
}

/** Date ISO dans `days` jours. */
export function inDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString()
}
