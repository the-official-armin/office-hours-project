// Shared: changes need a PR note and a teammate review.
// Purpose: guards /student/* and /teacher/*. Signed out -> that role's sign-in (remembering the page). The other role -> your own
// home, with a toast. While the saved token is being checked, a spinner (no flash of the login page).
import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import AuthSplash from '../components/auth/AuthSplash'
import { HOME_PATH } from '../components/common/nav'
import { useToast } from '../components/common/Toast'
import type { Role } from '../types'
import { decideAccess, loginPath, loginRedirect } from './access'
import { useAuth } from './AuthProvider'
import { pageIsFor } from './messages'

function WrongSide({ required, home }: { required: Role; home: string }) {
  const toast = useToast()
  useEffect(() => {
    toast(pageIsFor(required))
  }, [toast, required])
  return <Navigate to={home} replace />
}

export default function RequireRole({ role }: { role: Role }) {
  const { status, user, ended, loggedOut } = useAuth()
  const location = useLocation()
  const access = decideAccess(status, user, role)

  if (access.kind === 'wait') return <AuthSplash />
  // After choosing to log out there is no page to come back to: a plain sign-in. Otherwise remember the page that was asked for.
  if (access.kind === 'login') return <Navigate to={loggedOut ? loginPath(role) : loginRedirect(role, location, ended)} replace />
  if (access.kind === 'home') return <WrongSide required={role} home={HOME_PATH[access.role]} />
  return <Outlet />
}
