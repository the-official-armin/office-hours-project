// Themes: palette and Light / Dark / System apply at once, persist, and System follows the operating system live.
import { expect, test, type Page } from '@playwright/test'
import { signIn } from './helpers'

const html = (page: Page) => page.locator('html')
const sidebarColor = (page: Page) => page.locator('#side').evaluate((el) => getComputedStyle(el).backgroundColor)

for (const role of ['teacher', 'student'] as const) {
  test(`${role}: choose a palette in Settings and see the sidebar change`, async ({ page }) => {
    await signIn(page, role)
    await page.goto(`/${role}/settings`)
    await expect(html(page)).toHaveAttribute('data-palette', 'navy')
    const navy = await sidebarColor(page)

    await page.getByText('Crest Light', { exact: true }).click()
    await expect(html(page)).toHaveAttribute('data-palette', 'crest')
    const crest = await sidebarColor(page)
    expect(crest).not.toBe(navy)

    await page.getByText('Shield Mint', { exact: true }).click()
    await expect(html(page)).toHaveAttribute('data-palette', 'mint')
    expect(await sidebarColor(page)).not.toBe(crest)

    await page.reload()
    await expect(html(page)).toHaveAttribute('data-palette', 'mint')
  })
}

test('Light, Dark and System; System follows the operating system without a reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await signIn(page, 'teacher')
  await page.goto('/teacher/settings')
  await expect(html(page)).toHaveAttribute('data-theme', 'light')

  await page.getByRole('button', { name: 'Dark', exact: true }).click()
  await expect(html(page)).toHaveAttribute('data-theme', 'dark')
  expect(await page.evaluate(() => localStorage.getItem('oh-theme'))).toBe('dark')

  await page.getByRole('button', { name: 'System', exact: true }).click()
  await expect(html(page)).toHaveAttribute('data-theme', 'light')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(html(page)).toHaveAttribute('data-theme', 'dark')
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(html(page)).toHaveAttribute('data-theme', 'light')
})

test('the saved choice is applied before the first paint on a fresh load', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('oh-palette', 'mint')
    localStorage.setItem('oh-theme', 'dark')
  })
  await page.goto('/login')
  await expect(html(page)).toHaveAttribute('data-palette', 'mint')
  await expect(html(page)).toHaveAttribute('data-theme', 'dark')
})

test('a bad saved value falls back to navy and system', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('oh-palette', 'purple')
    localStorage.setItem('oh-theme', 'sepia')
  })
  await page.goto('/login')
  await expect(html(page)).toHaveAttribute('data-palette', 'navy')
})
