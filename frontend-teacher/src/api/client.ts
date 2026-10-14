// Shared: changes need a PR note and a teammate review.
// Purpose: fetch wrapper. The frontend only talks to the backend through src/api/.
export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

/** Defaults to true unless VITE_USE_MOCKS is explicitly "false". */
export const USE_MOCKS: boolean = import.meta.env.VITE_USE_MOCKS !== 'false'

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return (await res.json()) as T
}
