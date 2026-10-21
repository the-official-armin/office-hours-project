// Shared: changes need a PR note and a teammate review.
// PLACEHOLDER: the auth team owns real login (FastAPI + JWT). This version works like the design reference:
// you pick a role and are signed in as the example person. It only stores the role in the local mock store.
// Keep the exported function names so useAuth() can be re-pointed at real JWT without touching pages.
import type { Role } from '../types'
import { getState, mutate, subscribe } from './mocks/store'

export interface DemoAccount {
  role: Role
  name: string
  detail: string
}

/** The example people offered on the sign-in screen (mock mode only). */
export const DEMO_ACCOUNTS: DemoAccount[] = [
  { role: 'student', name: 'Maya K.', detail: 'Grade 10' },
  { role: 'teacher', name: 'Ms. Rivera', detail: 'Mathematics' },
]

/** The signed-in role, or null. A primitive, so it is safe for useSyncExternalStore. */
export function getRole(): Role | null {
  return getState().session
}

export function subscribeAuth(listener: () => void): () => void {
  return subscribe(listener)
}

export async function login(role: Role): Promise<void> {
  mutate((d) => {
    d.session = role
  })
}

export function logout(): void {
  mutate((d) => {
    d.session = null
  })
}
