// Owner: Subgroup B (Teacher desktop UI). Render smoke test: every Student page renders with the seeded data without
// crashing and shows the key parts of the design. (No browser here; this catches runtime errors.)
import { renderToString } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { studentApi } from '../../api/student'
import { resetState } from '../../api/mocks/store'
import { ToastProvider } from '../../components/common/Toast'
import { StudentDataTestProvider, type StudentContextValue, type StudentData } from '../../hooks/StudentData'
import BookSeat from './BookSeat'
import FindTeacher from './FindTeacher'
import MyBookings from './MyBookings'
import StudentHome from './StudentHome'
import StudentSettings from './StudentSettings'

vi.mock('../../api/mocks/actions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/mocks/actions')>()),
  delay: async () => undefined,
}))

let value: StudentContextValue
let data: StudentData

beforeAll(async () => {
  // Run with VITE_TEST_NOW=2026-10-17T10:00:00 to check the pages on any day and time of week.
  if (import.meta.env.VITE_TEST_NOW) {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(import.meta.env.VITE_TEST_NOW))
  }
  resetState()
  const [teachers, settings, bookings, seatBookings, requests, notes] = await Promise.all([
    studentApi.getTeachers(),
    studentApi.getSettings(),
    studentApi.getBookings(),
    studentApi.getSeatBookings(),
    studentApi.getRequests(),
    studentApi.getNotes(),
  ])
  data = { teachers, settings, bookings, seatBookings, requests, notes }
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
    bookSeat: never,
    cancelBooking: never,
    sendRequest: never,
    cancelRequest: never,
    saveSettings: never,
  }
})

/** React inserts <!-- --> between adjacent text nodes when rendering to a string. */
const clean = (html: string) => html.replace(/<!-- -->/g, '')

function render(page: ReactNode, path = '/', route = '*') {
  return clean(
    renderToString(
      <ToastProvider>
        <StudentDataTestProvider value={value}>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path={route} element={page} />
            </Routes>
          </MemoryRouter>
        </StudentDataTestProvider>
      </ToastProvider>,
    ),
  )
}

describe('Student pages render with the example data', () => {
  it('Home: stats, upcoming bookings, open seats, requests, rules banner', () => {
    const html = render(<StudentHome />)
    expect(html).toContain('Upcoming bookings')
    expect(html).toContain('Next office hour')
    expect(html).toContain('Open seats this week')
    expect(html).toContain('Your request')
    expect(html).toContain('Find a teacher')
    expect(html).toContain('a day your teacher is out')
  })

  it('Find a teacher: every teacher, filters and next open seat', () => {
    const html = render(<FindTeacher />)
    for (const t of data.teachers) expect(html).toContain(t.name)
    for (const g of ['All', 'Math', 'Science', 'English', 'Languages', 'History']) expect(html).toContain(g)
    expect(html).toContain('Next open seat')
    expect(html).toContain('Book a seat')
  })

  it('Book a seat: calendar, seat grid and the request form for an open day', () => {
    const html = render(<BookSeat />, '/student/teachers/rivera', '/student/teachers/:teacherId')
    expect(html).toContain('Book a seat with Ms. Rivera')
    expect(html).toContain('Pick a day')
    expect(html).toContain('Selected day')
    expect(html).toContain('Teacher&#x27;s desk'.replace('&#x27;', '\u2019'))
    expect(html).toContain('What do you want help with?')
    expect(html).toContain('Confirm booking')
    expect(html).toContain('Need a different time? Send a request')
    expect(html).toMatch(/aria-label="Seat 1, (open|taken|you)"/)
  })

  it('Book a seat: honours ?day= and a teacher who is unknown', () => {
    const maya = data.bookings.find((b) => b.status === 'confirmed' && b.teacherId === 'okafor')!
    const html = render(<BookSeat />, `/student/teachers/okafor?day=${maya.date}`, '/student/teachers/:teacherId')
    expect(html).toContain('Book a seat with Mr. Okafor')
    expect(html).toContain('aria-label="Seat 3, you"') // Maya holds a seat that day
    const missing = render(<BookSeat />, '/student/teachers/nobody', '/student/teachers/:teacherId')
    expect(missing).toContain('Teacher not found')
  })

  it('My bookings: each tab', () => {
    const up = render(<MyBookings />)
    expect(up).toContain('Upcoming (')
    expect(up).toContain('Seat ')
    expect(up).toContain('Cancel')
    const past = render(<MyBookings />, '/?tab=past')
    expect(past).toMatch(/Attended|Cancelled/)
    const req = render(<MyBookings />, '/?tab=req')
    expect(req).toContain('Pending')
    expect(req).toContain('Cancel request')
    expect(req).toContain('accepted this time')
  })

  it('Settings: profile, switches, reminder time, preview and account', () => {
    const html = render(<StudentSettings />)
    expect(html).toContain('Grade')
    expect(html).toContain('role="switch"')
    expect(html).toContain('A teacher answers my request')
    expect(html).toContain('What a reminder looks like')
    for (const name of ['Washington Navy', 'Shield Mint', 'Crest Light']) expect(html).toContain(name)
    expect(html).toContain('type="radio"')
    expect(html).toContain('System')
    expect(html).toContain('Signed in as Maya K.')
  })
})
