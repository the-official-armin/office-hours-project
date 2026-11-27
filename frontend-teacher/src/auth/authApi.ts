// Shared: changes need a PR note and a teammate review.
// Purpose: the sign-in calls (backend/README.md). Accounts are invite-only: people sign in with their school email, and
// choose a password from the link in their invite email (or a "Forgot password" email). Real mode talks to the server; mock
// mode (VITE_USE_MOCKS=true) checks the example accounts and acts like the real API: 401 for a wrong password, a 400 ms delay,
// tokens that last 60 minutes. Mock mode has no email, so every link is "expired" there.
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

/** What an activation or reset link is for, so its page can greet the person. */
export interface LinkInfo {
  purpose: 'activate' | 'reset'
  name: string
  email: string
  role: Role
}

export interface AuthApi {
  login(email: string, password: string): Promise<LoginResult>
  me(token: string): Promise<AuthUser>
  /** Throws AuthError('link') when the link is unknown, used or expired. */
  link(token: string): Promise<LinkInfo>
  /** Chooses a password from an activation or reset link; signs the person in. */
  setPassword(token: string, password: string): Promise<LoginResult>
  /** Always resolves (the server never says whether an email has an account). */
  forgotPassword(email: string): Promise<void>
  /** A fresh token for the same sign-in (up to 7 days after signing in). */
  refresh(token: string): Promise<LoginResult>
  /** Ends every session of this person on the server. */
  logout(token: string): Promise<void>
}

async function call<T>(path: string, init: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } })
  } catch {
    throw new AuthError('network')
  }
  if (res.status === 204) return undefined as T
  if (res.ok) return (await res.json()) as T
  const body = (await res.json().catch(() => null)) as { code?: string } | null
  if (body?.code === 'link_invalid') throw new AuthError('link')
  if (body?.code === 'weak_password') throw new AuthError('weak_password')
  if (res.status === 401) throw new AuthError(body?.code === 'invalid_credentials' ? 'invalid' : 'unauthorized')
  if (res.status === 429) throw new AuthError('too_many')
  if (res.status === 422) throw new AuthError('invalid') // the server refused the shape of the form
  throw new AuthError('server')
}

export const realAuthApi: AuthApi = {
  login: (email, password) => call('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: (token) => call('/auth/me', { headers: { Authorization: `Bearer ${token}` } }),
  link: (token) => call(`/auth/link/${encodeURIComponent(token)}`, {}),
  setPassword: (token, password) => call('/auth/set-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
  forgotPassword: (email) => call('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  refresh: (token) => call('/auth/refresh', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }),
  logout: (token) => call('/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }),
}

const LATENCY_MS = import.meta.env.MODE === 'test' ? 0 : 400
export const MOCK_TOKEN_SECONDS = 60 * 60
const wait = () => new Promise<void>((resolve) => setTimeout(resolve, LATENCY_MS))

export const mockAuthApi: AuthApi = {
  async login(email, password) {
    await wait()
    const account = MOCK_ACCOUNTS.find((a) => a.email === email.trim().toLowerCase())
    if (!account || password !== MOCK_PASSWORD) throw new AuthError('invalid')
    return {
      accessToken: makeMockToken(account.role, account.id, Date.now() + MOCK_TOKEN_SECONDS * 1000),
      expiresIn: MOCK_TOKEN_SECONDS,
      user: { id: account.id, role: account.role, name: account.name },
    }
  },
  async link() {
    await wait()
    throw new AuthError('link')
  },
  async setPassword() {
    await wait()
    throw new AuthError('link')
  },
  async forgotPassword() {
    await wait()
  },
  async refresh(token) {
    const user = await mockAuthApi.me(token)
    return { accessToken: makeMockToken(user.role, user.id, Date.now() + MOCK_TOKEN_SECONDS * 1000), expiresIn: MOCK_TOKEN_SECONDS, user }
  },
  async logout() {},
  async me(token) {
    await wait()
    const claims = parseMockToken(token)
    const account = claims && MOCK_ACCOUNTS.find((a) => a.role === claims.role && a.id === claims.id)
    if (!claims || !account || claims.expiresAt <= Date.now()) throw new AuthError('unauthorized')
    return { id: account.id, role: account.role, name: account.name }
  },
}

export const authApi: AuthApi = USE_MOCKS ? mockAuthApi : realAuthApi
