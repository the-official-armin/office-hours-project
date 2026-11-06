// Shared: changes need a PR note and a teammate review.
// Purpose: the two calls the backend has today: POST /auth/login and GET /auth/me (backend/README.md). Real mode talks to the
// server; mock mode (VITE_USE_MOCKS=true) checks the example accounts and acts like the real API: 401 for a wrong
// password, a 400 ms delay, tokens that last 60 minutes.
import { API_URL, USE_MOCKS } from '../api/client'
import type { AuthUser, Role } from '../types'
import { MOCK_ACCOUNTS, MOCK_PASSWORD } from './accounts'
import { AuthError } from './messages'
import { makeMockToken, parseMockToken } from './mockToken'

export interface LoginResult {
  accessToken: string
  /** Seconds until the token stops working. */
  expiresIn: number
  user: AuthUser
}

export interface AuthApi {
  login(role: Role, userId: string, password: string): Promise<LoginResult>
  me(token: string): Promise<AuthUser>
}

async function call<T>(path: string, init: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } })
  } catch {
    throw new AuthError('network')
  }
  if (res.ok) return (await res.json()) as T
  const body = (await res.json().catch(() => null)) as { code?: string } | null
  if (res.status === 401) throw new AuthError(body?.code === 'invalid_credentials' ? 'invalid' : 'unauthorized')
  if (res.status === 429) throw new AuthError('too_many')
  if (res.status === 422) throw new AuthError('invalid') // the server refused the shape of the form
  throw new AuthError('server')
}

export const realAuthApi: AuthApi = {
  login: (role, userId, password) => call('/auth/login', { method: 'POST', body: JSON.stringify({ role, userId, password }) }),
  me: (token) => call('/auth/me', { headers: { Authorization: `Bearer ${token}` } }),
}

const LATENCY_MS = import.meta.env.MODE === 'test' ? 0 : 400
export const MOCK_TOKEN_SECONDS = 60 * 60
const wait = () => new Promise<void>((resolve) => setTimeout(resolve, LATENCY_MS))

export const mockAuthApi: AuthApi = {
  async login(role, userId, password) {
    await wait()
    const account = MOCK_ACCOUNTS.find((a) => a.role === role && a.id === userId.trim())
    if (!account || password !== MOCK_PASSWORD) throw new AuthError('invalid')
    return {
      accessToken: makeMockToken(role, account.id, Date.now() + MOCK_TOKEN_SECONDS * 1000),
      expiresIn: MOCK_TOKEN_SECONDS,
      user: { id: account.id, role, name: account.name },
    }
  },
  async me(token) {
    await wait()
    const claims = parseMockToken(token)
    const account = claims && MOCK_ACCOUNTS.find((a) => a.role === claims.role && a.id === claims.id)
    if (!claims || !account || claims.expiresAt <= Date.now()) throw new AuthError('unauthorized')
    return { id: account.id, role: account.role, name: account.name }
  },
}

export const authApi: AuthApi = USE_MOCKS ? mockAuthApi : realAuthApi
