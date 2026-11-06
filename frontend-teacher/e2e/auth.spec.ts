// Sign-in, sign-out and route guards, end to end, in mock mode (example accounts, password "demo-password").
import { expect, test, type Page } from '@playwright/test'
import { PASSWORD, signIn } from './helpers'

const userField = (page: Page) => page.getByLabel('User ID')
const passwordField = (page: Page) => page.getByLabel('Password', { exact: true })
const submit = (page: Page) => page.getByRole('button', { name: 'Sign in' })
const logOut = (page: Page) => page.locator('#side').getByRole('button', { name: 'Log out' })

async function fillAndSubmit(page: Page, id: string, password: string) {
  await userField(page).fill(id)
  await passwordField(page).fill(password)
  await submit(page).click()
}

test.describe('the chooser', () => {
  test('has one big button per side and goes to that side’s sign in', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { level: 1, name: 'Washington Prep Office Hours' })).toBeVisible()
    await page.getByRole('link', { name: /I.m a student/ }).click()
    await expect(page).toHaveURL(/\/student\/login$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Student sign in' })).toBeVisible()
    await expect(page.getByText('Book a spot at your teachers’ office hours.')).toBeVisible()
    await page.goto('/login')
    await page.getByRole('link', { name: /I.m a teacher/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Teacher sign in' })).toBeVisible()
    await expect(page.getByText('Manage your office hours and see who’s coming.')).toBeVisible()
  })

  test('remembers the side you signed in as last time', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('You signed in this way last time')).toHaveCount(0)
    await signIn(page, 'teacher')
    await logOut(page).click()
    await page.goto('/login')
    await expect(page.getByRole('link', { name: /I.m a teacher/ }).getByText('You signed in this way last time')).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('oh-last-role'))).toBe('teacher')
  })

  test('the root address goes to the chooser when signed out and to your home when signed in', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)
    await signIn(page, 'student')
    await page.goto('/')
    await expect(page).toHaveURL(/\/student$/)
  })
})

test.describe('signing in and out', () => {
  test('a student signs in, sees their home, and logs out', async ({ page }) => {
    await signIn(page, 'student')
    await expect(page).toHaveURL(/\/student$/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Maya')
    await expect(page.locator('#side')).toContainText('Maya K.')

    await logOut(page).click()
    await expect(page).toHaveURL(/\/student\/login$/)
    await expect(page.getByText('Signed out')).toBeVisible()
    expect(await page.evaluate(() => sessionStorage.getItem('oh-token') ?? localStorage.getItem('oh-token'))).toBeNull()
    await page.goto('/student')
    await expect(page).toHaveURL(/\/student\/login\?next=/)
  })

  test('a teacher signs in, sees the dashboard, and logs out', async ({ page }) => {
    await signIn(page, 'teacher')
    await expect(page).toHaveURL(/\/teacher$/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Ms. Rivera')
    await logOut(page).click()
    await expect(page).toHaveURL(/\/teacher\/login$/)
    await expect(page.getByText('Signed out')).toBeVisible()
  })

  test('each account is itself: Mr. Okafor sees his own dashboard, Daniel his own home', async ({ page }) => {
    await signIn(page, 'teacher', 'okafor')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Mr. Okafor')
    await logOut(page).click()
    await signIn(page, 'student', 'daniel')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Daniel')
  })

  test('log out also works from the phone Settings page', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await signIn(page, 'student')
    await page.goto('/student/settings')
    await page.getByRole('button', { name: 'Log out' }).click()
    await expect(page).toHaveURL(/\/student\/login$/)
    await expect(page.getByText('Signed out')).toBeVisible()
  })

  test('a reload keeps you signed in, and a signed-in visitor to a login page goes straight home', async ({ page }) => {
    await signIn(page, 'student')
    await page.reload()
    await expect(page).toHaveURL(/\/student$/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Maya')
    await page.goto('/student/login')
    await expect(page).toHaveURL(/\/student$/)
    await page.goto('/teacher/login')
    await expect(page).toHaveURL(/\/student$/)
  })

  test('"Keep me signed in" decides where the token is kept', async ({ page }) => {
    await page.goto('/student/login')
    await userField(page).fill('maya')
    await passwordField(page).fill(PASSWORD)
    await submit(page).click()
    await expect(page).toHaveURL(/\/student$/)
    expect(await page.evaluate(() => [sessionStorage.getItem('oh-token'), localStorage.getItem('oh-token')].map((v) => v !== null))).toEqual([true, false])
    await logOut(page).click()

    await page.goto('/student/login')
    await userField(page).fill('maya')
    await passwordField(page).fill(PASSWORD)
    await page.getByLabel('Keep me signed in').check()
    await submit(page).click()
    await expect(page).toHaveURL(/\/student$/)
    expect(await page.evaluate(() => [sessionStorage.getItem('oh-token'), localStorage.getItem('oh-token')].map((v) => v !== null))).toEqual([false, true])
  })
})

test.describe('errors', () => {
  test('a wrong password shows one message, keeps the user ID, clears the password and refocuses it', async ({ page }) => {
    await page.goto('/student/login')
    await fillAndSubmit(page, 'maya', 'not-the-password')
    await expect(page.getByRole('alert')).toHaveText('User ID or password is incorrect.')
    await expect(userField(page)).toHaveValue('maya')
    await expect(passwordField(page)).toHaveValue('')
    await expect(passwordField(page)).toBeFocused()
  })

  test('an unknown ID, or an ID from the other side, gets the very same message', async ({ page }) => {
    await page.goto('/student/login')
    await fillAndSubmit(page, 'nobody', PASSWORD)
    await expect(page.getByRole('alert')).toHaveText('User ID or password is incorrect.')
    await userField(page).fill('rivera') // a teacher's ID on the student page
    await passwordField(page).fill(PASSWORD)
    await submit(page).click()
    await expect(page.getByRole('alert')).toHaveText('User ID or password is incorrect.')
    await expect(page).toHaveURL(/\/student\/login$/)
  })

  test('empty fields: an inline error under each, aria-invalid and aria-describedby, focus on the first bad field', async ({ page }) => {
    await page.goto('/teacher/login')
    await submit(page).click()
    await expect(page.getByText('Enter your user ID.')).toBeVisible()
    await expect(page.getByText('Enter your password.')).toBeVisible()
    await expect(userField(page)).toHaveAttribute('aria-invalid', 'true')
    await expect(userField(page)).toBeFocused()
    const described = await userField(page).getAttribute('aria-describedby')
    await expect(page.locator(`[id="${described}"]`)).toHaveText('Enter your user ID.')

    await userField(page).fill('rivera')
    await submit(page).click()
    await expect(page.getByText('Enter your user ID.')).toHaveCount(0)
    await expect(passwordField(page)).toHaveAttribute('aria-invalid', 'true')
    await expect(passwordField(page)).toBeFocused()
    expect(await passwordField(page).getAttribute('aria-describedby')).toBeTruthy()
  })

  test('the Sign in button shows it is working and cannot be pressed twice', async ({ page }) => {
    await page.goto('/student/login')
    await userField(page).fill('maya')
    await passwordField(page).fill(PASSWORD)
    await submit(page).click()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Sign in' })).toHaveAttribute('aria-busy', 'true')
    await expect(page).toHaveURL(/\/student$/)
  })

  test('"Forgot password?" explains who to ask, inline', async ({ page }) => {
    await page.goto('/student/login')
    await expect(page.getByText('Ask the school office or IT to reset it.')).toHaveCount(0)
    await page.getByRole('button', { name: 'Forgot password?' }).click()
    await expect(page.getByText('Ask the school office or IT to reset it.')).toBeVisible()
    await expect(page.getByText('No account? Your school sets it up for you.')).toBeVisible()
  })

  test('links to the other side’s sign in, and there is no sign-up', async ({ page }) => {
    await page.goto('/student/login')
    await page.getByRole('link', { name: 'Teacher sign in' }).click()
    await expect(page).toHaveURL(/\/teacher\/login$/)
    await page.getByRole('link', { name: 'Student sign in' }).click()
    await expect(page).toHaveURL(/\/student\/login$/)
    await expect(page.getByText(/sign up|create an account|register/i)).toHaveCount(0)
  })
})

test.describe('guards and ?next=', () => {
  test('opening a page while signed out goes to sign in and, afterwards, lands back on that page', async ({ page }) => {
    await page.goto('/teacher/calendar')
    await expect(page).toHaveURL(/\/teacher\/login\?next=%2Fteacher%2Fcalendar$/)
    await fillAndSubmit(page, 'rivera', PASSWORD)
    await expect(page).toHaveURL(/\/teacher\/calendar$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible()
  })

  test('the page you wanted keeps its query', async ({ page }) => {
    await page.goto('/student/teachers/rivera?day=2030-01-08')
    await expect(page).toHaveURL(/\/student\/login\?next=/)
    await fillAndSubmit(page, 'maya', PASSWORD)
    await expect(page).toHaveURL(/\/student\/teachers\/rivera\?day=2030-01-08$/)
  })

  test('the other side’s page sends you to your own home, with a note', async ({ page }) => {
    await signIn(page, 'student')
    await page.goto('/teacher/calendar')
    await expect(page).toHaveURL(/\/student$/)
    await expect(page.getByText('That page is for teachers')).toBeVisible()

    await logOut(page).click()
    await signIn(page, 'teacher')
    await page.goto('/student/bookings')
    await expect(page).toHaveURL(/\/teacher$/)
    await expect(page.getByText('That page is for students')).toBeVisible()
  })

  test('a ?next= that is not an app page, or belongs to the other side, is ignored', async ({ page }) => {
    await page.goto('/student/login?next=https%3A%2F%2Fevil.example%2Fteacher')
    await fillAndSubmit(page, 'maya', PASSWORD)
    await expect(page).toHaveURL(/localhost:\d+\/student$/)
    await logOut(page).click()

    await page.goto('/student/login?next=%2Fteacher%2Fcalendar')
    await fillAndSubmit(page, 'maya', PASSWORD)
    await expect(page).toHaveURL(/\/student$/)
  })

  test('when the token runs out the next request ends the session, says so, and signing in returns you to the page', async ({ page }) => {
    await page.clock.install({ time: new Date() })
    await signIn(page, 'student')
    await page.goto('/student/calendar')
    await expect(page.getByRole('region', { name: /Month calendar/ })).toHaveAttribute('aria-busy', 'false')

    await page.clock.fastForward(61 * 60 * 1000) // the example token lasts 60 minutes
    // Pages refresh in the background, so that may already have hit the 401. If not, the next click does.
    const nextMonth = page.getByRole('button', { name: 'Next month' })
    if (await nextMonth.isVisible()) await nextMonth.click()

    await expect(page).toHaveURL(/\/student\/login\?next=%2Fstudent%2Fcalendar&reason=expired$/)
    await expect(page.getByRole('status').filter({ hasText: 'Your session ended. Sign in again.' })).toBeVisible()
    await fillAndSubmit(page, 'maya', PASSWORD)
    await expect(page).toHaveURL(/\/student\/calendar$/)
  })
})

test.describe('keyboard and password managers', () => {
  test('you can sign in with the keyboard alone', async ({ page }) => {
    await page.goto('/student/login')
    await userField(page).focus()
    await page.keyboard.type('maya')
    await page.keyboard.press('Tab')
    await expect(passwordField(page)).toBeFocused()
    await page.keyboard.type(PASSWORD)
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/student$/)
  })

  test('Show / Hide works by keyboard and is named for screen readers', async ({ page }) => {
    await page.goto('/student/login')
    await passwordField(page).focus()
    await page.keyboard.press('Tab')
    const toggle = page.getByRole('button', { name: 'Show password' })
    await expect(toggle).toBeFocused()
    await page.keyboard.press('Space')
    await expect(passwordField(page)).toHaveAttribute('type', 'text')
    await expect(page.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('Space')
    await expect(passwordField(page)).toHaveAttribute('type', 'password')
  })

  test('both fields carry what password managers look for', async ({ page }) => {
    await page.goto('/teacher/login')
    await expect(userField(page)).toHaveAttribute('autocomplete', 'username')
    await expect(passwordField(page)).toHaveAttribute('autocomplete', 'current-password')
    await expect(userField(page)).toHaveAttribute('name', 'username')
    await expect(passwordField(page)).toHaveAttribute('name', 'password')
    await expect(page.locator('form')).toHaveCount(1)
  })
})

test.describe('demo accounts (mock mode only)', () => {
  test('lists this side’s accounts and fills the form on click', async ({ page }) => {
    await page.goto('/student/login')
    const box = page.getByRole('region', { name: 'Demo accounts' })
    await expect(box.getByRole('button', { name: /Maya K\./ })).toBeVisible()
    await expect(box.getByRole('button', { name: /Daniel O\./ })).toBeVisible()
    await expect(box.getByRole('button', { name: /Rivera/ })).toHaveCount(0)
    await box.getByRole('button', { name: /Daniel O\./ }).click()
    await expect(userField(page)).toHaveValue('daniel')
    await expect(passwordField(page)).toHaveValue(PASSWORD)
    await submit(page).click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Daniel')
  })
})

test.describe('layout', () => {
  test('at 390px nothing scrolls sideways and every input is at least 16px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    for (const path of ['/login', '/student/login', '/teacher/login']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }))
      expect(width.scroll, path).toBeLessThanOrEqual(width.inner)
      const sizes = await page.locator('input[type=text], input[type=password], input[type=email]').evaluateAll((els) => els.map((e) => parseFloat(getComputedStyle(e).fontSize)))
      for (const px of sizes) expect(px, path).toBeGreaterThanOrEqual(16)
    }
  })

  test('the navy brand panel appears from 1024px and the card stays at most 420px wide', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/student/login')
    await expect(page.locator('aside')).toBeVisible()
    const card = await page.locator('main > div').boundingBox()
    expect(card!.width).toBeLessThanOrEqual(420)
    await page.setViewportSize({ width: 800, height: 800 })
    await expect(page.locator('aside')).toBeHidden()
  })
})
