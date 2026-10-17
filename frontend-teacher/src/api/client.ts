// Shared: changes need a PR note and a teammate review.
// Purpose: fetch wrapper. The frontend only talks to the backend through src/api/.
import { RuleError } from './errors'
import type { RuleCode } from '../types'

export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

/** Defaults to true unless VITE_USE_MOCKS is explicitly "false". */
export const USE_MOCKS: boolean = import.meta.env.VITE_USE_MOCKS !== 'false'

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) {
    // Expected backend error shape: { code, message }. See docs/api-contract.md.
    const body = (await res.json().catch(() => null)) as { code?: RuleCode; message?: string } | null
    throw new RuleError(body?.code ?? 'invalid', body?.message ?? `Request failed (${res.status}).`)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}
