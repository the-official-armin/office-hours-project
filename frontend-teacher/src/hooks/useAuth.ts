// Shared: changes need a PR note and a teammate review.
// Purpose: auth state for the UI. Pages only use this hook, never src/api/auth.ts directly.
// The auth team can swap the body for real JWT handling without touching any page.
import { useSyncExternalStore } from 'react'
import { getRole, login, logout, subscribeAuth } from '../api/auth'

export function useAuth() {
  const role = useSyncExternalStore(subscribeAuth, getRole)
  return { role, isLoggedIn: role !== null, login, logout }
}
