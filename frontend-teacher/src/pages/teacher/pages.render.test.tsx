// Owner: Subgroup B (Teacher desktop UI). Render smoke test: every Teacher page and the shell render with the seeded
// data without crashing, and show the key parts of the design. (No browser here; this catches runtime errors.)
import { renderToString } from 'react-dom/server'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import AppShell from '../../components/common/AppShell'
import { ToastProvider } from '../../components/common/Toast'
import { teacherApi } from '../../api/teacher'
import { pendingRequests } from '../../lib/rules'
import { resetState } from '../../api/mocks/store'
import { toTeacherShell, TeacherDataTestProvider, type TeacherContextValue, type TeacherData } from '../../hooks/TeacherData'
import BookingRequests from './BookingRequests'
import DaysOff from './DaysOff'
import OfficeHourSettings from './OfficeHourSettings'
import TeacherCalendar from './TeacherCalendar'
import TeacherDashboard from './TeacherDashboard'
import TeacherSettings from './TeacherSettings'

vi.mock('../../api/mocks/actions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/mocks/actions')>()),
  delay: async () => undefined,
}))

let value: TeacherContextValue
let data: TeacherData

beforeAll(async () => {
  // Run with VITE_TEST_NOW=2026-10-17T10:00:00 to check the pages on any day and time of week.
  if (import.meta.env.VITE_TEST_NOW) {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(import.meta.env.VITE_TEST_NOW))
  }
  resetState()
  const [teacher, settings, bookings, requests, notes] = await Promise.all([
    teacherApi.getTeacher(),
    teacherApi.getSettings(),
    teacherApi.getBookings(),
    teacherApi.getRequests(),
    teacherApi.getNotes(),
  ])
  data = { teacher, settings, bookings, requests, notes }
  const never = async () => {
    throw new Error('not used in render tests')
  }
  value = {
    status: 'ready',
    error: null,
    data,
    now: new Date(),
    usingMocks: true,
    refresh: async () => undefined,
    commit: (p) => p,
    markNotesRead: async () => undefined,
    resetExample: async () => undefined,
    saveSettings: never,
    saveHours: never,
    addDayOff: never,
    removeDayOff: never,
    answerRequest: never,
  }
})

function render(page: ReactNode, path = '/') {
  return clean(
    renderToString(
      <ToastProvider>
        <TeacherDataTestProvider value={value}>
          <MemoryRouter initialEntries={[path]}>{page}</MemoryRouter>
        </TeacherDataTestProvider>
      </ToastProvider>,
    ),
  )
}

/** React inserts <!-- --> between adjacent text nodes when rendering to a string. */
const clean = (html: string) => html.replace(/<!-- -->/g, '')

describe('Teacher pages render with the example data', () => {
  it('Dashboard: next office hour, after that, requests, days off, rules banner', () => {
    const html = render(<TeacherDashboard />)
    expect(html).toContain('Next office hour')
    expect(html).toContain('After that')
    expect(html).toContain('Open requests')
    expect(html).toContain('Coming days off')
    // The two soonest open requests are shown (which students depends on today's date).
    for (const r of pendingRequests(data.requests, 'rivera').slice(0, 2)) expect(html).toContain(r.studentName)
    expect(html).toContain('Parent conference day')
    expect(html).toContain('past dates or your days off') // rules banner
  })

  it('Calendar: controls, month grid and the selected-day panel', () => {
    const html = render(<TeacherCalendar />)
    expect(html).toContain('Calendar scale')
    expect(html).toContain('Selected day')
    expect(html).toMatch(/aria-label="[A-Z][a-z]+day, [A-Z][a-z]+ \d+,/)
    expect(html).toContain('Past, can')
  })

  it('Calendar: opens on the week of a day passed in the URL', () => {
    const day = data.bookings.find((b) => b.teacherId === 'rivera')!.date
    const html = render(<TeacherCalendar />, `/?day=${day}`)
    expect(html).toContain('Previous week')
  })

  it('Office hours: one card per timing, preview, seats, totals', () => {
    const html = render(<OfficeHourSettings />)
    expect(html).toContain('aria-label="Timing 1"')
    expect(html).toContain('aria-label="Timing 2"')
    expect(html).toContain('Your week')
    expect(html).toContain('Seats per office hour')
    expect(html).toContain('4 office hours a week, 4 seats each: 16 seats in total.')
    expect(html).toContain('Add another timing')
  })

  it('Days off: the list, the form and the warning', () => {
    const html = render(<DaysOff />)
    expect(html).toContain('Upcoming days off')
    expect(html).toContain('Add a day off')
    expect(html).toContain('Field trip')
    expect(html).toMatch(/1 booking affected/)
  })

  it('Booking requests: both tabs', () => {
    const requests = render(<BookingRequests />)
    expect(requests).toContain('Requests (3)')
    expect(requests).toContain('Sofia L.')
    expect(requests).toContain('Accept')
    const bookings = render(<BookingRequests />, '/?tab=bookings')
    expect(bookings).toContain('Bookings (')
    expect(bookings).toContain('Confirmed')
    expect(bookings).toContain('Seat ')
  })

  it('Settings: profile, switches, lead time, preview and account', () => {
    const html = render(<TeacherSettings />)
    expect(html).toContain('Profile')
    expect(html).toContain('role="switch"')
    expect(html).toContain('Send the reminder before the office hour')
    expect(html).toContain('What a reminder looks like')
    for (const name of ['Washington Navy', 'Shield Mint', 'Crest Light']) expect(html).toContain(name)
    expect(html).toContain('type="radio"')
    expect(html).toContain('System')
    expect(html).toContain('Signed in as Ms. Rivera.')
  })
})

describe('App shell', () => {
  const shell = (path: string) =>
    clean(renderToString(
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route
              element={
                <AppShell
                  role="teacher"
                  data={toTeacherShell(data)}
                  showExample
                  onMarkAllRead={async () => undefined}
                  onReset={async () => undefined}
                  onLogout={() => undefined}
                />
              }
            >
              <Route path="*" element={<Outlet />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ToastProvider>,
    ))

  it('shows the nav tree, badges, the example-data chip and the tab bar', () => {
    const html = shell('/teacher/requests?tab=bookings')
    for (const label of ['Dashboard', 'Schedule', 'Calendar', 'Office hours', 'Days off', 'Students', 'Booking requests', 'Booked seats', 'Settings']) {
      expect(html).toContain(label)
    }
    expect(html).toContain('Example data')
    expect(html).toContain('Hide navigation')
    expect(html).toContain('Teacher navigation')
    // Only "Booked seats" is the current child on ?tab=bookings.
    expect(html.match(/aria-current="page"/g)?.length).toBeGreaterThanOrEqual(1)
    expect(html).toMatch(/aria-current="page"[^>]*>(<span[^>]*>)?Booked seats/)
    expect(html).toMatch(/3 waiting/)
  })
})
