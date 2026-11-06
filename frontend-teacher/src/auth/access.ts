// Shared: changes need a PR note and a teammate review.
// Purpose: the pure decisions behind sign-in and route guards, so they can be tested without a browser.
import type { AuthUser, Role } from '../types'
import { HOME_PATH } from '../components/common/nav'

export type AuthStatus = 'loading' | 'signedIn' | 'signedOut'

export type Access = { kind: 'wait' } | { kind: 'login' } | { kind: 'home'; role: Role } | { kind: 'allow' }

/** What a page that is only for `required` should do right now. */
export function decideAccess(status: AuthStatus, user: AuthUser | null, required: Role): Access {
  if (status === 'loading') return { kind: 'wait' }
  if (status === 'signedOut' || !user) return { kind: 'login' }
  if (user.role !== required) return { kind: 'home', role: user.role }
  return { kind: 'allow' }
}

export const loginPath = (role: Role): string => `/${role}/login`

/** Where to send a signed-out visitor: that role's login, remembering the page they wanted. */
export function loginRedirect(role: Role, wanted: { pathname: string; search?: string }, expired = false): string {
  const params = new URLSearchParams()
  params.set('next', `${wanted.pathname}${wanted.search ?? ''}`)
  if (expired) params.set('reason', 'expired')
  return `${loginPath(role)}?${params.toString()}`
}

/**
 * The page to open after signing in. `next` is only followed when it is an app path ("/..."), is not a protocol-relative or
 * backslash trick, and belongs to the signed-in role. Anything else goes to that role's home.
 */
export function safeNext(next: string | null | undefined, role: Role): string {
  const home = HOME_PATH[role]
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return home
  let path: string
  try {
    path = new URL(next, 'http://app.local').pathname
  } catch {
    return home
  }
  const base = `/${role}`
  const inside = path === base || path.startsWith(`${base}/`)
  const isLogin = path === `${base}/login`
  return inside && !isLogin ? next : home
}
