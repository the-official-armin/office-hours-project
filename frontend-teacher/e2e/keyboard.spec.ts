// Keyboard-only behavior: dialogs, the notification popover, the sidebar shortcut, the seat picker, the theme picker.
import { expect, test, type Page } from '@playwright/test'

async function signIn(page: Page, role: 'teacher' | 'student') {
  await page.goto('/login')
  await page.getByRole('button', { name: new RegExp(role, 'i') }).click()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

test('a dialog traps focus, closes with Esc and returns focus to its opener', async ({ page }) => {
  await signIn(page, 'teacher')
  const opener = page.getByRole('button', { name: /^View all \d+/ })
  await opener.focus()
  await page.keyboard.press('Enter')

  const dialog = page.getByRole('dialog', { name: 'Upcoming office hours' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused()

  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab')
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
  }
  await page.keyboard.press('Shift+Tab')
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(opener).toBeFocused()
})

test('the notification bell opens with Enter, closes with Esc, and marks everything read', async ({ page }) => {
  await signIn(page, 'teacher')
  const bell = page.getByRole('button', { name: /^Notifications, \d+ unread/ })
  await bell.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Notifications' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Notifications' })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Notifications' })).toBeFocused()
  await expect(page.getByRole('button', { name: /unread/ })).toHaveCount(0)
})

test('Ctrl+B hides and shows the sidebar, and the choice is remembered', async ({ page }) => {
  await signIn(page, 'teacher')
  const toggle = page.getByRole('button', { name: /(Hide|Show) navigation/ })
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Control+b')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Show navigation' })).toHaveAttribute('aria-expanded', 'false')
  await page.keyboard.press('Control+b')
  await expect(page.getByRole('button', { name: 'Hide navigation' })).toHaveAttribute('aria-expanded', 'true')
})

test('a student can book a seat with the keyboard alone', async ({ page }) => {
  await signIn(page, 'student')
  await page.goto('/student/teachers/rivera')
  await expect(page.getByRole('heading', { name: /Book a seat with Ms\. Rivera/ })).toBeVisible()

  // Some office hours are locked (you already hold a seat there), so pick an enabled seat.
  const seat = page.locator('button[aria-label$=", open"]:enabled').first()
  await seat.focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: /^Seat \d+, picked$/ })).toHaveCount(1)

  await page.getByLabel('What do you want help with?').focus()
  await page.keyboard.type('Help with the graphing project')
  await expect(page.getByText(/\d+ \/ 300/)).toContainText('30 / 300')

  const confirm = page.getByRole('button', { name: 'Confirm booking' })
  await confirm.focus()
  await page.keyboard.press('Enter')

  const done = page.getByRole('heading', { name: /booked/ })
  await expect(done).toBeVisible()
  await expect(done).toBeFocused()
})

test('a booking can be cancelled by keyboard, with an inline confirmation', async ({ page }) => {
  await signIn(page, 'student')
  await page.goto('/student/bookings?tab=up')
  const cancel = page.getByRole('button', { name: /^Cancel booking with/ }).first()
  await cancel.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Yes, cancel' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Keep it' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Yes, cancel' })).toHaveCount(0)
  await expect(cancel).toBeFocused()
})

test('the color theme radios work with arrow keys and are remembered', async ({ page }) => {
  await signIn(page, 'teacher')
  await page.goto('/teacher/settings')
  const navy = page.getByRole('radio', { name: /Washington Navy/ })
  await navy.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'mint')
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'crest')
  expect(await page.evaluate(() => localStorage.getItem('oh-palette'))).toBe('crest')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'crest')
})
