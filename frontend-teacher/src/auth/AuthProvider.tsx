// Shared: changes need a PR note and a teammate review.
// Purpose: who is signed in. On start it checks a saved token with GET /auth/me (showing a spinner meanwhile, never a flash of
// the login page). login() / loginWithLink() / logout() are the only way in and out. A 401 anywhere ends the session (see events.ts).
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import { useToast } from '../components/common/Toast'
import type { AuthUser, Role } from '../types'
import type { AuthStatus } from './access'
import { authApi } from './authApi'
import { authReducer, initialAuthState } from './authReducer'
import { setRefresher, setUnauthorizedHandler } from './events'
import { setLastRole } from './lastRole'
import { AuthError, SIGNED_OUT } from './messages'
import { clearToken, getToken, isRemembered, loadStoredToken, secondsLeft, setToken } from './tokenStore'

export interface AuthContextValue {
  user: AuthUser | null
  status: AuthStatus
  role: Role | null
  isLoggedIn: boolean
  /** True when a session that was working stopped (the server said 401), so the login page can say so. */
  ended: boolean
  /** Throws an AuthError when the sign-in fails. Resolves with the signed-in person. */
  login: (email: string, password: string, remember: boolean) => Promise<AuthUser>
  /** Chooses a password from an activation or reset email link and signs in. Throws an AuthError. */
  loginWithLink: (token: string, password: string) => Promise<AuthUser>
  /** True when the person chose to log out (the route guard then sends them to a plain sign-in). */
  loggedOut: boolean
  /** Forgets the token and says "Signed out". The route guard then sends the person to that role's sign-in. */
  logout: () => void
}

/** Outside a provider (isolated render tests) everyone is signed out and the actions do nothing. */
const signedOutValue: AuthContextValue = {
  user: null,
  status: 'signedOut',
  role: null,
  isLoggedIn: false,
  ended: false,
  loggedOut: false,
  login: () => Promise.reject(new AuthError('server')),
  loginWithLink: () => Promise.reject(new AuthError('server')),
  logout: () => undefined,
}

const REFRESH_WITHIN_SECONDS = 10 * 60

export const AuthContext = createContext<AuthContextValue>(signedOutValue)

export const useAuth = (): AuthContextValue => useContext(AuthContext)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialAuthState)
  const toast = useToast()

  // A 401 from any request: forget the token and mark the session as ended.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearToken()
      dispatch({ type: 'expired' })
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  // While the app is in use, swap the token for a fresh one in its last 10 minutes (the server allows this for 7 days after
  // signing in), so nobody is signed out mid-task. client.ts runs this before every request.
  useEffect(() => {
    setRefresher(async () => {
      const token = getToken()
      if (!token || secondsLeft() > REFRESH_WITHIN_SECONDS) return
      const res = await authApi.refresh(token)
      setToken(res.accessToken, res.expiresIn, isRemembered())
    })
    return () => setRefresher(null)
  }, [])

  // On start: is the saved token (if any) still good?
  useEffect(() => {
    let cancelled = false
    const saved = loadStoredToken()
    if (!saved) {
      dispatch({ type: 'none' })
      return
    }
    authApi.me(saved).then(
      (user) => {
        if (!cancelled) dispatch({ type: 'restored', user })
      },
      (err: unknown) => {
        if (cancelled) return
        if (err instanceof AuthError && err.kind === 'unauthorized') {
          clearToken()
          dispatch({ type: 'expired' })
        } else {
          // The server could not be reached. Keep the token for the next visit and show the sign-in page.
          dispatch({ type: 'none' })
        }
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string, remember: boolean) => {
    const res = await authApi.login(email.trim(), password)
    setToken(res.accessToken, res.expiresIn, remember)
    setLastRole(res.user.role)
    dispatch({ type: 'signedIn', user: res.user })
    return res.user
  }, [])

  const loginWithLink = useCallback(async (token: string, password: string) => {
    const res = await authApi.setPassword(token, password)
    setToken(res.accessToken, res.expiresIn, false)
    setLastRole(res.user.role)
    dispatch({ type: 'signedIn', user: res.user })
    return res.user
  }, [])

  const role = state.user?.role ?? null
  const logout = useCallback(() => {
    // Tell the server too, so this token (and the person's other sessions) stop working at once.
    const token = getToken()
    if (token) authApi.logout(token).catch(() => undefined)
    clearToken()
    dispatch({ type: 'signedOut' })
    toast(SIGNED_OUT)
  }, [toast])

  const value = useMemo<AuthContextValue>(
    () => ({ user: state.user, status: state.status, role, isLoggedIn: state.status === 'signedIn', ended: state.ended, loggedOut: state.loggedOut, login, loginWithLink, logout }),
    [state, role, login, loginWithLink, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
