// The student calendar (all teachers) and booking a spot without choosing a seat.
import { expect, test, type Page } from '@playwright/test'
import { isoDay, signIn } from './helpers'

const scale = (page: Page, name: 'Week' | 'Month' | 'Quarter') =>
  page.getByRole('group', { name: 'Calendar scale' }).getByRole('button', { name, exact: true })


test.describe('My calendar at 1280px', () => {
  test('is in the sidebar and shows the student’s bookings across teachers', async ({ page }) => {
    await signIn(page, 'student')
    await page.locator('#side').getByRole('link', { name: 'My calendar' }).click()
    await expect(page).toHaveURL(/\/student\/calendar$/)
    await expect(page.getByRole('heading', { level: 1, name: 'My calendar' })).toBeVisible()
    await expect(page.locator('#side').getByRole('link', { name: 'My calendar' })).toHaveAttribute('aria-current', 'page')

    // Month view is the default: bookings with at least two different teachers (Ms. Rivera and Mr. Okafor) appear as chips.
    const grid = page.getByRole('region', { name: /Month calendar/ })
    await expect(grid.getByText(/Ms\. Rivera · /).first()).toBeVisible()
    await expect(grid.getByText(/Mr\. Okafor · /).first()).toBeVisible()
    await expect(page.getByText('Needs attention')).toBeVisible() // the legend
  })

  test('the Home page links to it', async ({ page }) => {
    await signIn(page, 'student')
    await page.getByRole('link', { name: 'Open my calendar' }).click()
    await expect(page).toHaveURL(/\/student\/calendar$/)
  })

  test('the sidebar order is Home, My calendar, Find a teacher, My bookings, Settings', async ({ page }) => {
    await signIn(page, 'student')
    const labels = await page.locator('#side nav').getByRole('link').allInnerTexts()
    const top = labels.map((t) => t.trim()).filter((t) => ['Home', 'My calendar', 'Find a teacher', 'Settings'].includes(t))
    expect(top).toEqual(['Home', 'My calendar', 'Find a teacher', 'Settings'])
    const text = await page.locator('#side nav').innerText()
    expect(text.indexOf('My calendar')).toBeLessThan(text.indexOf('Find a teacher'))
    expect(text.indexOf('Find a teacher')).toBeLessThan(text.indexOf('My bookings'))
    expect(text.indexOf('My bookings')).toBeLessThan(text.indexOf('Settings'))
  })

  test('the selected-day panel lists the day with reason, flag and actions', async ({ page }) => {
    await signIn(page, 'student')
    await page.goto('/student/calendar')
    // The seed has Maya booked with Ms. Rivera, Mr. Okafor and Ms. Alvarez in the coming weeks (one of those days is a day off).
    // The first Rivera booking in view can be last week's history, so take the last one: it is always upcoming.
    const day = page.getByRole('button', { name: /Ms\. Rivera Lunch/ }).last()
    await day.click()
    const panel = page.locator('aside[aria-labelledby="day-h"]')
    await expect(panel.getByText('Review homework problems 12–18.')).toBeVisible()
    await expect(panel.getByRole('link', { name: /Book another time with Ms\. Rivera/ })).toHaveAttribute('href', /\/student\/teachers\/rivera\?day=\d{4}-\d{2}-\d{2}/)
    await expect(panel.getByRole('button', { name: /^Cancel booking with Ms\. Rivera/ })).toBeVisible()
  })

  test('cancelling asks first, then strikes the booking through', async ({ page }) => {
    await signIn(page, 'student')
    await page.goto('/student/calendar')
    await page.getByRole('button', { name: /Ms\. Rivera Lunch/ }).last().click()
    const panel = page.locator('aside[aria-labelledby="day-h"]')
    await panel.getByRole('button', { name: /^Cancel booking with Ms\. Rivera/ }).click()
    await expect(panel.getByText(/Cancel this booking\?/)).toBeVisible()
    await panel.getByRole('button', { name: 'Keep it' }).click()
    await expect(panel.getByText(/Cancel this booking\?/)).toHaveCount(0)

    await panel.getByRole('button', { name: /^Cancel booking with Ms\. Rivera/ }).click()
    await panel.getByRole('button', { name: 'Yes, cancel' }).click()
    await expect(panel.getByText('Cancelled', { exact: true })).toBeVisible()
    await expect(panel.locator('b.line-through')).toBeVisible()
  })

  test('an empty day says "Nothing booked." and offers Find a teacher; a past day offers nothing', async ({ page }) => {
    await signIn(page, 'student')
    await page.goto('/student/calendar')
    await scale(page, 'Quarter').click()
    await expect(page.getByRole('region', { name: /Quarter calendar/ })).toBeVisible()
    const days = page.getByRole('region', { name: /Quarter calendar/ }).locator('button[aria-pressed]')
    await expect(days.first()).toBeVisible()
    // Quarter days are all clickable, including empty ones.
    expect(await days.count()).toBeGreaterThan(50)
    expect(await days.evaluateAll((els) => els.filter((e) => (e as HTMLButtonElement).disabled).length)).toBe(0)

    const empty = page.getByRole('region', { name: /Quarter calendar/ }).locator('button[aria-label$="nothing booked"]').last()
    await empty.click()
    const panel = page.locator('aside[aria-labelledby="day-h"]')
    await expect(panel.getByText('Nothing booked.')).toBeVisible()
    await expect(panel.getByRole('link', { name: 'Find a teacher' })).toBeVisible()

    const past = page.getByRole('region', { name: /Quarter calendar/ }).locator('button[aria-label$="nothing booked"]').first()
    await past.click()
    await expect(panel.getByText('Nothing booked.')).toBeVisible()
    await expect(panel.getByRole('link', { name: 'Find a teacher' })).toHaveCount(0)
  })

  test('Week, Month and Quarter all work, and moving on fetches the next range', async ({ page }) => {
    await signIn(page, 'student')
    await page.goto('/student/calendar')
    const label = page.locator('main output')
    const month = await label.innerText()
    expect(month).toMatch(/^[A-Z][a-z]+ \d{4}$/)

    await page.getByRole('button', { name: 'Next month' }).click()
    await expect(label).not.toHaveText(month)
    await expect(page.getByRole('region', { name: /Month calendar/ })).toHaveAttribute('aria-busy', 'false')
    await page.getByRole('button', { name: 'Previous month' }).click()
    await expect(label).toHaveText(month)

    await scale(page, 'Week').click()
    await expect(label).toHaveText(/\d+ – \d+, \d{4}|[A-Z][a-z]{2} \d+ – [A-Z][a-z]{2} \d+, \d{4}/)
    await expect(page.getByRole('button', { name: 'Next week' })).toBeVisible()

    await scale(page, 'Quarter').click()
    await expect(label).toHaveText(/[A-Z][a-z]{2} – [A-Z][a-z]{2} \d{4}|[A-Z][a-z]{2} \d{4} – [A-Z][a-z]{2} \d{4}/)
  })

  test('a new booking shows up on the calendar', async ({ page }) => {
    await signIn(page, 'student')
    await page.goto('/student/teachers/rivera')
    const book = page.getByRole('button', { name: 'Book a spot', exact: true }).and(page.locator(':enabled')).first()
    await book.click()
    await page.getByLabel('What do you want help with?').fill('Help with the graphing project')
    await page.getByRole('button', { name: 'Confirm booking' }).click()
    await expect(page.getByRole('heading', { name: /You.re booked/ })).toBeVisible()

    await page.locator('#side').getByRole('link', { name: 'My calendar' }).click()
    const grid = page.getByRole('region', { name: /Month calendar/ })
    await expect(grid.getByText(/Ms\. Rivera · /).first()).toBeVisible()
    const count = await grid.getByText(/Ms\. Rivera · /).count()
    expect(count).toBeGreaterThanOrEqual(2)
  })
})

test.describe('My calendar at 390px', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('month chips are short, a key explains them, and nothing scrolls sideways', async ({ page }) => {
    await signIn(page, 'student')
    await page.goto('/student/calendar')
    const grid = page.getByRole('region', { name: /Month calendar/ })
    await expect(grid.getByText(/^R \d{1,2}:\d{2}$/).first()).toBeVisible()
    await expect(page.getByText(/R = Ms\. Rivera/)).toBeVisible()
    const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }))
    expect(width.scroll).toBeLessThanOrEqual(width.inner)

    for (const name of ['Week', 'Quarter'] as const) {
      await scale(page, name).click()
      const w = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }))
      expect(w.scroll, `${name} view`).toBeLessThanOrEqual(w.inner)
    }
  })

  test('the phone tab bar has Home, Calendar, Teachers, Bookings, Settings', async ({ page }) => {
    await signIn(page, 'student')
    const tabs = page.getByRole('navigation', { name: /student navigation/i }).getByRole('link')
    await expect(tabs).toHaveText(['Home', 'Calendar', 'Teachers', 'Bookings', 'Settings'].map((t) => new RegExp(t)))
  })
})

test.describe('booking a spot, not a seat', () => {
  test('no seat numbers or seat grid anywhere on the Book page', async ({ page }) => {
    await signIn(page, 'student')
    await page.goto('/student/teachers/rivera')
    await expect(page.getByRole('heading', { name: /Book a spot with Ms\. Rivera/ })).toBeVisible()
    const text = await page.locator('main').innerText()
    expect(text).not.toMatch(/Seat \d|Teacher.s desk|Picked/)
    await expect(page.locator('button[aria-label^="Seat"]')).toHaveCount(0)
    // Capacity is shown as dots with a label.
    await expect(page.getByRole('img', { name: /\d of \d spots taken/ }).first()).toBeVisible()
  })

  test('the teacher lists the student without a seat number', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
    const page = await context.newPage()
    await signIn(page, 'student')
    await page.goto('/student/teachers/rivera')
    await page.getByRole('button', { name: 'Book a spot', exact: true }).and(page.locator(':enabled')).first().click()
    await page.getByLabel('What do you want help with?').fill('Help with the graphing project')
    await page.getByRole('button', { name: 'Confirm booking' }).click()
    await expect(page.getByRole('heading', { name: /You.re booked/ })).toBeVisible()

    await page.locator('#side').getByRole('button', { name: 'Log out' }).click()
    await signIn(page, 'teacher')
    await page.goto('/teacher/requests?tab=bookings')
    const text = await page.locator('main').innerText()
    expect(text).toContain('Maya K.')
    expect(text).not.toMatch(/Seat \d/)
    await context.close()
  })

  test('if the office hour fills up while the form is open, the card says so and nothing is booked', async ({ browser }) => {
    // Two real students in one browser: maya and daniel are signed in in separate tabs (the token lives in each tab's sessionStorage)
    // while the example data is shared. Maya has the reason form open on the last spot, Daniel takes it, then Maya confirms.
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
    const a = await context.newPage()
    const b = await context.newPage()
    await signIn(a, 'student', 'maya')
    await signIn(b, 'student', 'daniel')

    // The second Tuesday or Thursday from tomorrow: no day off, nothing booked after school, and nobody clashes.
    const days: string[] = []
    for (let i = 1; days.length < 2; i++) {
      const d = new Date()
      d.setDate(d.getDate() + i)
      if ([2, 4].includes(d.getDay())) days.push(isoDay(i))
    }
    const day = days[1]

    // Other classmates take all but one of Ms. Rivera's after-school spots that day.
    await b.evaluate((date) => {
      const key = 'officehours.demo.v3'
      const state = JSON.parse(localStorage.getItem(key)!)
      const rivera = state.teachers.find((t: { id: string }) => t.id === 'rivera')
      const held = state.bookings.filter((x: { teacherId: string; date: string; timingId: string; status: string }) => x.teacherId === 'rivera' && x.date === date && x.timingId === 'after' && x.status === 'confirmed').length
      for (let n = held; n < rivera.max - 1; n++) {
        state.seq += 1
        state.bookings.push({ id: `fill${state.seq}`, teacherId: 'rivera', date, timingId: 'after', studentId: `kid${state.seq}`, studentName: 'Classmate', reason: 'Needs help', status: 'confirmed', createdAt: new Date().toISOString() })
      }
      localStorage.setItem(key, JSON.stringify(state))
    }, day)

    // Maya opens the form on the last spot and types her reason.
    await a.goto(`/student/teachers/rivera?day=${day}`)
    const mayaCard = a.getByLabel('After school office hour')
    await expect(mayaCard.getByText(/3 of 4 spots taken/)).toBeVisible()
    await mayaCard.getByRole('button', { name: 'Book a spot', exact: true }).click()
    await a.getByLabel('What do you want help with?').fill('Help with the graphing project')

    // Daniel books the last spot first.
    await b.goto(`/student/teachers/rivera?day=${day}`)
    await b.getByLabel('After school office hour').getByRole('button', { name: 'Book a spot', exact: true }).click()
    await b.getByLabel('What do you want help with?').fill('Lab report questions for the quiz')
    await b.getByRole('button', { name: 'Confirm booking' }).click()
    await expect(b.getByRole('heading', { name: /You.re booked/ })).toBeVisible()

    // Maya confirms: it just filled up, nothing is booked, and what she typed is still there.
    await a.getByRole('button', { name: 'Confirm booking' }).click()
    await expect(a.getByText('That office hour just filled up.')).toBeVisible()
    await expect(a.getByRole('heading', { name: /You.re booked/ })).toHaveCount(0)
    await expect(a.getByLabel('After school office hour').getByRole('button', { name: 'Full', exact: true })).toBeVisible()
    await context.close()
  })
})

// Every color theme, light and dark, at desktop and phone width: no sideways scroll on the new student screens.
const SHOTS = process.env.SHOTS_DIR
for (const width of [1280, 390]) {
  for (const palette of ['navy', 'mint', 'crest']) {
    for (const mode of ['light', 'dark']) {
      test(`no sideways scroll: ${width}px, ${palette}, ${mode}`, async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width, height: 900 } })
        await context.addInitScript(([p, m]) => {
          try {
            localStorage.setItem('oh-palette', p)
            localStorage.setItem('oh-theme', m)
          } catch {
            /* storage can be blocked */
          }
        }, [palette, mode])
        const page = await context.newPage()
        await signIn(page, 'student')
        const tag = `${width}-${palette}-${mode}`
        const fits = async (label: string) => {
          const w = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }))
          expect(w.scroll, `${label} at ${tag}`).toBeLessThanOrEqual(w.inner)
        }

        await page.goto('/student/calendar')
        for (const name of ['Week', 'Month', 'Quarter'] as const) {
          await scale(page, name).click()
          await expect(page.getByRole('region', { name: new RegExp(`${name} calendar`) })).toHaveAttribute('aria-busy', 'false')
          await page
            .getByRole('region', { name: new RegExp(`${name} calendar`) })
            .locator('button[aria-pressed]:enabled')
            .filter({ hasText: /./ })
            .first()
            .click()
          await fits(`${name} calendar`)
          if (SHOTS) await page.screenshot({ path: `${SHOTS}/cal-${name.toLowerCase()}-${tag}.png`, fullPage: true })
        }

        await page.goto('/student/teachers/rivera')
        await expect(page.getByRole('img', { name: /\d of \d spots taken/ }).first()).toBeVisible()
        await fits('Book a spot')
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/book-${tag}.png`, fullPage: true })
        await context.close()
      })
    }
  }
}
