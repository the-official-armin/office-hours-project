// The phone layout at 390px: no sideways scroll, the tab bar instead of the sidebar, and tap targets of at least 44px.
import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

const TEACHER = ['', '/calendar', '/office-hours', '/days-off', '/requests?tab=requests', '/requests?tab=bookings', '/settings']
const STUDENT = ['', '/calendar', '/teachers', '/teachers/rivera', '/bookings?tab=up', '/bookings?tab=past', '/bookings?tab=req', '/settings']

async function signIn(page: Page, role: 'teacher' | 'student') {
  await page.goto('/login')
  await page.getByRole('button', { name: new RegExp(role, 'i') }).click()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

/** Interactive elements whose tap area is under 44px tall. A switch extends its hit area; a label counts as its input. */
async function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = []
    const sel = 'button, a[href], input:not([type=hidden]), select, textarea, [role=switch]'
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
      const style = getComputedStyle(el)
      if (el.closest('[inert]') || el.classList.contains('sr-only') || style.visibility === 'hidden') continue
      const box = (el.closest('label') ?? el).getBoundingClientRect()
      if (box.width === 0 || box.height === 0) continue
      const height = el.getAttribute('role') === 'switch' ? box.height + 12 : box.height
      if (height < 43.5) {
        const name = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40)
        out.push(`${Math.round(box.width)}x${Math.round(height)} ${el.tagName.toLowerCase()} "${name}"`)
      }
    }
    return out
  })
}

for (const [role, paths] of [
  ['teacher', TEACHER],
  ['student', STUDENT],
] as const) {
  test.describe(`${role} pages at 390px`, () => {
    for (const path of paths) {
      test(`${role}${path || ' home'}`, async ({ page }) => {
        await signIn(page, role)
        await page.goto(`/${role}${path}`)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        await page.waitForTimeout(300)

        const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }))
        expect(width.scroll, 'no sideways scroll').toBeLessThanOrEqual(width.inner)

        await expect(page.getByRole('navigation', { name: new RegExp(`${role} navigation`, 'i') })).toHaveCount(1)
        await expect(page.locator('#side')).toBeHidden()

        expect(await smallTargets(page), 'tap targets under 44px').toEqual([])
      })
    }
  })
}
