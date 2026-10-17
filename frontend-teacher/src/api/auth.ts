// Shared: changes need a PR note and a teammate review.
// PLACEHOLDER: the auth team owns real login (FastAPI + JWT). This demo version only flips a flag in the local store.
// Keep the exported function names so useAuth() can be re-pointed at real JWT without touching pages.
import { getState, mutate, subscribe } from './mocks/store'

export const DEMO_EMAIL = 'teacher@demo.school'
export const DEMO_PASSWORD = 'demo'

export function isLoggedIn(): boolean {
  return getState().loggedIn
}

export function subscribeAuth(listener: () => void): () => void {
  return subscribe(listener)
}

export async function login(email: string, password: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 200))
  if (email.trim().toLowerCase() !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
    throw new Error('Wrong email or password. Use the demo account shown on this page.')
  }
  mutate((d) => {
    d.loggedIn = true
  })
}

export function logout(): void {
  mutate((d) => {
    d.loggedIn = false
  })
}
