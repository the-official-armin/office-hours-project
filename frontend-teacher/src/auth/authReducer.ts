// Purpose: the sign-in state machine. loading (finding out if a saved token is still good) -> signedIn | signedOut.
// `ended` is true when a session that was working stopped (the server answered 401), so the login page can say so.
// `loggedOut` is true when the person chose to log out, so the route guard sends them to a plain sign-in (no ?next=).
import type { AuthUser } from '../types'
import type { AuthStatus } from './access'

export interface AuthState {
  status: AuthStatus
  user: AuthUser | null
  ended: boolean
  loggedOut: boolean
}

export type AuthAction =
  | { type: 'restored'; user: AuthUser }
  | { type: 'none' }
  | { type: 'signedIn'; user: AuthUser }
  | { type: 'signedOut' }
  | { type: 'expired' }

export const initialAuthState: AuthState = { status: 'loading', user: null, ended: false, loggedOut: false }

export function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'restored':
    case 'signedIn':
      return { status: 'signedIn', user: action.user, ended: false, loggedOut: false }
    case 'none':
      return { status: 'signedOut', user: null, ended: false, loggedOut: false }
    case 'signedOut':
      return { status: 'signedOut', user: null, ended: false, loggedOut: true }
    case 'expired':
      return { status: 'signedOut', user: null, ended: true, loggedOut: false }
    default:
      return state
  }
}
