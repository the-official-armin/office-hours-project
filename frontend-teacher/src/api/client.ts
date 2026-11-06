// Shared: changes need a PR note and a teammate review.
// Purpose: fetch wrapper. The frontend only talks to the backend through src/api/.
// It adds the signed-in person's token ("Authorization: Bearer ..."). A 401 means the session ended: it tells the auth layer
// (which forgets the token and sends the person to that role's sign-in) and then throws like any other error.
import { handleUnauthorized } from '../auth/events'
import { MESSAGES } from '../auth/messages'
import { getToken } from '../auth/tokenStore'
import { RuleError } from './errors'
import type { RuleCode } from '../types'

export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

/** Defaults to true unless VITE_USE_MOCKS is explicitly "false". */
export const USE_MOCKS: boolean = import.meta.env.VITE_USE_MOCKS !== 'false'

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers },
    })
  } catch {
    throw new RuleError('invalid', MESSAGES.network)
  }
  if (!res.ok) {
    // Expected backend error shape: { code, message }. See docs/api-contract.md.
    const body = (await res.json().catch(() => null)) as { code?: RuleCode; message?: string } | null
    if (res.status === 401) {
      handleUnauthorized()
      throw new RuleError('unauthorized', MESSAGES.unauthorized)
    }
    throw new RuleError(body?.code ?? 'invalid', body?.message ?? `Request failed (${res.status}).`)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}
