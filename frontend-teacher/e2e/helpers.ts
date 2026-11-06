// Shared by every e2e spec: sign in through the real form, as the example accounts (mock mode, password "demo-password").
import { expect, type Page } from '@playwright/test'

export const PASSWORD = 'demo-password'

/** The example account each role signs in as unless a spec asks for another one. */
export const DEFAULT_ID = { student: 'maya', teacher: 'rivera' } as const

/** Opens that role's sign-in page, fills the form and waits until the app has loaded. */
export async function signIn(page: Page, role: 'teacher' | 'student', userId: string = DEFAULT_ID[role], password: string = PASSWORD) {
  await page.goto(`/${role}/login`)
  await page.getByLabel('User ID').fill(userId)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  // Signed in once the URL is on this side and no longer a sign-in page (/student/login also starts with /student).
  await page.waitForURL((url) => url.pathname.startsWith(`/${role}`) && !url.pathname.endsWith('/login'))
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

/** A YYYY-MM-DD date in school-local terms, `days` from today. */
export function isoDay(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
