// The sidebar footer (profile + Log out) must stay put while the page scrolls, even when the nav tree is taller than
// the screen, and after the sidebar is collapsed and reopened.
import { expect, test, type Locator, type Page } from '@playwright/test'

async function signInAsTeacher(page: Page) {
  await page.goto('/login')
  await page.getByRole('button', { name: /teacher/i }).click()
  await expect(page.locator('#side')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

const logOut = (page: Page): Locator => page.locator('#side').getByRole('button', { name: 'Log out' })

async function rect(locator: Locator) {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { top: r.top, bottom: r.bottom, viewport: window.innerHeight }
  })
}

/** Make the page tall enough to scroll, so the test proves something on every screen. */
async function makeScrollable(page: Page) {
  await page.addStyleTag({ content: 'main { min-height: 2600px !important; }' })
}

async function scrollPageToBottom(page: Page) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300)
}

async function expectFooterFixed(page: Page) {
  const before = await rect(logOut(page))
  expect(before.top).toBeGreaterThanOrEqual(0)
  expect(before.bottom).toBeLessThanOrEqual(before.viewport)

  await scrollPageToBottom(page)
  const after = await rect(logOut(page))
  expect(after.top).toBeCloseTo(before.top, 0)
  expect(after.bottom).toBeLessThanOrEqual(after.viewport)
  expect(after.top).toBeGreaterThanOrEqual(0)

  await page.evaluate(() => window.scrollTo(0, 0))
}

test.describe('sidebar footer stays fixed at 1280x720', () => {
  for (const [name, path] of [
    ['Dashboard', '/teacher'],
    ['Calendar (Month)', '/teacher/calendar'],
    ['Office hours', '/teacher/office-hours'],
  ] as const) {
    test(name, async ({ page }) => {
      await signInAsTeacher(page)
      await page.goto(path)
      await expect(page.locator('#side')).toBeVisible()
      await makeScrollable(page)
      await expectFooterFixed(page)
    })
  }
})

test.describe('with every nav group expanded on a short screen', () => {
  test('1280x600: Log out is still visible while the page scrolls', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 })
    await signInAsTeacher(page)
    for (const group of await page.locator('#side button[aria-expanded]').all()) {
      if ((await group.getAttribute('aria-expanded')) === 'false') await group.click()
    }
    await makeScrollable(page)
    await expectFooterFixed(page)
  })

  test('1280x420: the nav scrolls by itself and Log out never moves', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 420 })
    await signInAsTeacher(page)
    await makeScrollable(page)

    const nav = page.locator('#side nav')
    const overflow = await nav.evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }))
    expect(overflow.scroll, 'the nav must be taller than its box here').toBeGreaterThan(overflow.client)

    const before = await rect(logOut(page))
    expect(before.bottom).toBeLessThanOrEqual(before.viewport)

    await nav.evaluate((el) => el.scrollTo(0, el.scrollHeight))
    await expect.poll(() => nav.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
    const afterNav = await rect(logOut(page))
    expect(afterNav.top).toBeCloseTo(before.top, 0)

    await scrollPageToBottom(page)
    const afterPage = await rect(logOut(page))
    expect(afterPage.top).toBeCloseTo(before.top, 0)
    expect(afterPage.bottom).toBeLessThanOrEqual(afterPage.viewport)
  })
})

test('collapsing and reopening the sidebar keeps the footer in place', async ({ page }) => {
  await signInAsTeacher(page)
  await makeScrollable(page)
  const column = page.locator('#main').locator('..')

  const before = await rect(logOut(page))
  await expect.poll(() => column.evaluate((el) => getComputedStyle(el).marginLeft)).toBe('248px')

  await page.getByRole('button', { name: 'Hide navigation' }).click()
  await expect(page.locator('#side')).toHaveAttribute('inert', '')
  await expect.poll(() => column.evaluate((el) => getComputedStyle(el).marginLeft)).toBe('0px')
  await expect
    .poll(() => page.locator('#side').evaluate((el) => el.getBoundingClientRect().right))
    .toBeLessThanOrEqual(0)

  await page.getByRole('button', { name: 'Show navigation' }).click()
  await expect(page.locator('#side')).not.toHaveAttribute('inert', '')
  await expect.poll(() => column.evaluate((el) => getComputedStyle(el).marginLeft)).toBe('248px')
  await expect.poll(async () => (await rect(logOut(page))).top).toBeCloseTo(before.top, 0)

  await expectFooterFixed(page)
})
