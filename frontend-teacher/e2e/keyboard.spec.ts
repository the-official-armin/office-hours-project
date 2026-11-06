// Keyboard-only behavior: dialogs, the notification popover, the sidebar shortcut, booking a spot, the theme picker.
import { expect, test, type Page } from '@playwright/test'
import { signIn } from './helpers'

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

test('a student can book a spot with the keyboard alone', async ({ page }) => {
  await signIn(page, 'student')
  await page.goto('/student/teachers/rivera')
  await expect(page.getByRole('heading', { name: /Book a spot with Ms\. Rivera/ })).toBeVisible()

  // Some office hours are not bookable (already booked, full, started), so take the first enabled "Book a spot".
  const book = page.getByRole('button', { name: 'Book a spot', exact: true }).and(page.locator(':enabled')).first()
  await book.focus()
  await page.keyboard.press('Enter')

  // The reason form opens in place and takes focus.
  const reason = page.getByLabel('What do you want help with?')
  await expect(reason).toBeFocused()
  await page.keyboard.type('Help with the graphing project')
  await expect(page.getByText(/\d+ \/ 300/)).toContainText('30 / 300')

  await page.getByRole('button', { name: 'Confirm booking' }).focus()
  await page.keyboard.press('Enter')

  const done = page.getByRole('heading', { name: /You.re booked/ })
  await expect(done).toBeVisible()
  await expect(done).toBeFocused()
})

test('Back closes the reason form without booking anything', async ({ page }) => {
  await signIn(page, 'student')
  await page.goto('/student/teachers/rivera')
  const book = page.getByRole('button', { name: 'Book a spot', exact: true }).and(page.locator(':enabled')).first()
  await book.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('What do you want help with?')).toBeFocused()
  await page.getByRole('button', { name: 'Back' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('What do you want help with?')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Book a spot', exact: true }).first()).toBeVisible()
})

test('a booked office hour can be cancelled from the Book page by keyboard', async ({ page }) => {
  await signIn(page, 'student')
  // The example data books Maya on Ms. Rivera's first Tuesday or Thursday after today.
  const next = new Date()
  do next.setDate(next.getDate() + 1)
  while (![2, 4].includes(next.getDay()))
  const day = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
  await page.goto(`/student/teachers/rivera?day=${day}`)
  const cancel = page.getByRole('button', { name: /^Cancel your booking in/ }).first()
  await expect(cancel).toBeVisible()
  await cancel.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Yes, cancel' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Yes, cancel' })).toHaveCount(0)
  // The "You're booked ✓" chip is gone. (The same day can show a clash note about another teacher, so match the chip.)
  await expect(page.getByText(/You.re booked ✓/)).toHaveCount(0)
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
