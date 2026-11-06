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
import { addDays, toISODate } from '../../lib/dates'
import BookSpot from './BookSpot'
import MyCalendar from './MyCalendar'
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
  const [teachers, settings, bookings, spotBookings, requests, notes] = await Promise.all([
    studentApi.getTeachers(),
    studentApi.getSettings(),
    studentApi.getBookings(),
    studentApi.getSpotBookings(),
    studentApi.getRequests(),
    studentApi.getNotes(),
  ])
  data = { teachers, settings, bookings, spotBookings, requests, notes }
  const never = async () => {
    throw new Error('not used in render tests')
  }
  value = {
    status: 'ready',
    error: null,
    data,
    now: new Date(),
    version: 1,
    usingMocks: true,
    refresh: async () => undefined,
    commit: (p) => p,
    markNotesRead: async () => undefined,
    resetExample: async () => undefined,
    bookSpot: never,
    getCalendar: never,
    cancelBooking: never,
    sendRequest: never,
    cancelRequest: never,
    saveSettings: never,
  }
})

/** React inserts <!-- --> between adjacent text nodes when rendering to a string. */
const clean = (html: string) => html.replace(/<!-- -->/g, '')

function render(page: ReactNode, path = '/', route = '*', override: Partial<StudentContextValue> = {}) {
  return clean(
    renderToString(
      <ToastProvider>
        <StudentDataTestProvider value={{ ...value, ...override }}>
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
  it('Home: stats, upcoming bookings, open spots, requests, calendar link, rules banner', () => {
    const html = render(<StudentHome />)
    expect(html).toContain('Upcoming bookings')
    expect(html).toContain('Next office hour')
    expect(html).toContain('Open spots this week')
    expect(html).toContain('Your request')
    expect(html).toContain('Find a teacher')
    expect(html).toContain('Open my calendar')
    expect(html).toContain('href="/student/calendar"')
    expect(html).toContain('a day your teacher is out')
    expect(html).not.toMatch(/Seat \d/)
  })

  it('Find a teacher: every teacher, filters and next open spot', () => {
    const html = render(<FindTeacher />)
    for (const t of data.teachers) expect(html).toContain(t.name)
    for (const g of ['All', 'Math', 'Science', 'English', 'Languages', 'History']) expect(html).toContain(g)
    expect(html).toContain('Next open spot')
    expect(html).toContain('Book a spot')
    expect(html).not.toMatch(/Book a seat|Next open seat/)
  })

  it('My calendar: header, scale controls, legend and a loading skeleton before the range arrives', () => {
    const html = render(<MyCalendar />, '/student/calendar')
    expect(html).toContain('My calendar')
    expect(html).toContain('Calendar scale')
    expect(html).toContain('Loading your calendar')
    for (const entry of ['Booked', 'Needs attention', 'Requested', 'Past or cancelled']) expect(html).toContain(entry)
  })
  it('Book a spot: calendar, one card per office hour, no seat grid, and the request form', () => {
    const html = render(<BookSpot />, '/student/teachers/rivera', '/student/teachers/:teacherId')
    expect(html).toContain('Book a spot with Ms. Rivera')
    expect(html).toContain('Pick a day')
    expect(html).toContain('Selected day')
    expect(html).toContain('aria-label="Lunch office hour"')
    expect(html).toMatch(/aria-label="\d of 4 spots taken"/)
    expect(html).toMatch(/\d of 4 spots taken &middot; \d left|\d of 4 spots taken \u00b7 (\d left|none left)/)
    expect(html).toContain('Need a different time? Send a request')
    // the seat grid is gone
    expect(html).not.toMatch(/Seat \d|Teacher.s desk|Picked|aria-label="Seat/)
  })

  // Built when a test runs, not when the file loads, so it follows the fake clock set in beforeAll.
  const futureDays = () => Array.from({ length: 40 }, (_, i) => toISODate(addDays(new Date(), i + 1)))
  const bookPage = (teacher: string, date: string, override: Partial<StudentContextValue> = {}) =>
    render(<BookSpot />, `/student/teachers/${teacher}?day=${date}`, '/student/teachers/:teacherId', override)
  const withData = (patch: Partial<StudentData>): Partial<StudentContextValue> => ({ data: { ...data, ...patch } })
  const isOff = (teacherId: string, date: string) => data.teachers.find((t) => t.id === teacherId)!.daysOff.some((d) => d.date === date)
  const weekday = (date: string) => new Date(`${date}T12:00:00`).getDay()
  /** The same data with none of the student's own bookings on one day, so nothing can clash there. */
  const withoutMyBookingsOn = (date: string): Partial<StudentContextValue> =>
    withData({
      bookings: data.bookings.filter((b) => b.date !== date),
      spotBookings: data.spotBookings.filter((b) => !(b.date === date && b.studentId === data.settings.id)),
    })

  it('Book a spot, state 1 (bookable): "Book a spot", with room left', () => {
    const date = futureDays().find(
      (d) => [2, 4].includes(weekday(d)) && !isOff('rivera', d) && !data.spotBookings.some((b) => b.date === d && b.teacherId === 'rivera'),
    )!
    const html = bookPage('rivera', date, withoutMyBookingsOn(date))
    expect(html).toMatch(/<button[^>]*>Book a spot<\/button>/)
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Book a spot<\/button>/)
    expect(html).toContain('0 of 4 spots taken')
    expect(html).toContain('4 left')
  })

  it('Book a spot, state 2 (full): a disabled "Full" and a link to ask for a different time', () => {
    const date = data.spotBookings.find((b) => b.teacherId === 'brooks' && b.date > toISODate(new Date()))!.date
    const html = bookPage('brooks', date, withoutMyBookingsOn(date))
    expect(html).toContain('4 of 4 spots taken')
    expect(html).toContain('none left')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Full<\/button>/)
    expect(html).toContain('Ask for a different time')
  })

  it('Book a spot, state 3 (already booked): "You\u2019re booked" with a Cancel button', () => {
    const mine = data.bookings.find((b) => b.status === 'confirmed' && b.teacherId === 'rivera' && b.date > toISODate(new Date()))!
    const html = bookPage('rivera', mine.date)
    expect(html).toContain('You\u2019re booked \u2713')
    expect(html).toContain('aria-label="Cancel your booking in Lunch"')
    expect(html).toContain('ring-2') // the student's own dot is drawn with a ring
  })

  it('Book a spot: a student who already holds a spot in a FULL office hour still sees "You’re booked" and Cancel', () => {
    const mine = data.bookings.find((b) => b.status === 'confirmed' && b.teacherId === 'rivera' && b.date > toISODate(new Date()))!
    const held = data.spotBookings.filter((b) => b.teacherId === mine.teacherId && b.date === mine.date && b.timingId === mine.timingId).length
    const rivera = data.teachers.find((t) => t.id === 'rivera')!
    const others = Array.from({ length: rivera.max - held }, (_, i) => ({
      ...mine, id: `fullfill${i}`, studentId: `other${i}`, studentName: '', reason: '', createdAt: new Date().toISOString(),
    }))
    const html = bookPage('rivera', mine.date, withData({ spotBookings: [...data.spotBookings, ...others] }))
    expect(html).toContain('4 of 4 spots taken')
    expect(html).toContain('none left')
    expect(html).toContain('You’re booked ✓')
    expect(html).toContain('aria-label="Cancel your booking in Lunch"')
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Full<\/button>/)
  })

  it('Book a spot, state 4 (started): a disabled "Started"', () => {
    const mine = data.bookings.find((b) => b.status === 'confirmed' && b.teacherId === 'rivera' && b.date > toISODate(new Date()))!
    const afterLunch = new Date(`${mine.date}T13:00:00`)
    const html = bookPage('rivera', mine.date, { now: afterLunch })
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Started<\/button>/)
  })

  it('Book a spot, state 5 (time clash): disabled, with the amber note naming the other teacher', () => {
    const tuesday = futureDays().find((d) => weekday(d) === 2 && !isOff('rivera', d) && !isOff('okafor', d))!
    const others = withoutMyBookingsOn(tuesday).data!
    const clash = {
      id: 'clash1', teacherId: 'okafor', date: tuesday, timingId: 'lunch', studentId: data.settings.id,
      studentName: data.settings.name, reason: 'Lab help please', status: 'confirmed' as const, createdAt: new Date().toISOString(),
    }
    const html = bookPage('rivera', tuesday, withData({ bookings: [...others.bookings, clash], spotBookings: [...others.spotBookings, clash] }))
    expect(html).toContain('You\u2019re booked with Mr. Okafor at this time.')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Book a spot<\/button>/)
  })

  it('Book a spot: honours ?day= and a teacher who is unknown', () => {
    const maya = data.bookings.find((b) => b.status === 'confirmed' && b.teacherId === 'okafor')!
    const html = render(<BookSpot />, `/student/teachers/okafor?day=${maya.date}`, '/student/teachers/:teacherId')
    expect(html).toContain('Book a spot with Mr. Okafor')
    expect(html).toContain('You\u2019re booked \u2713') // Maya has a booking that day
    const missing = render(<BookSpot />, '/student/teachers/nobody', '/student/teachers/:teacherId')
    expect(missing).toContain('Teacher not found')
  })

  it('My bookings: each tab', () => {
    const up = render(<MyBookings />)
    expect(up).toContain('Upcoming (')
    expect(up).not.toMatch(/Seat \d/)
    expect(up).toMatch(/Booked|Teacher is out|This office hour was moved/)
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
