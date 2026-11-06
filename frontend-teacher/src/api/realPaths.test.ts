// The real (non-mock) API objects must call exactly the paths in backend/README.md. fetch is stubbed here, so this runs
// without a backend. If the backend renames a path, this test and the two objects change together.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { realStudentApi } from './student'
import { realTeacherApi } from './teacher'

type Call = { method: string; path: string; body: unknown }

function stubFetch(answers: Record<string, unknown> = {}) {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = String(url).replace(/^https?:\/\/[^/]+/, '')
      calls.push({ method: init?.method ?? 'GET', path, body: init?.body ? JSON.parse(String(init.body)) : undefined })
      const noBody = (init?.method ?? 'GET') === 'DELETE' || path.startsWith('/notifications/read-all')
      return new Response(noBody ? null : JSON.stringify(answers[path] ?? []), { status: noBody ? 204 : 200 })
    }),
  )
  return calls
}

afterEach(() => vi.unstubAllGlobals())

describe('real teacher API paths', () => {
  it('uses the backend paths', async () => {
    const calls = stubFetch()
    const api = realTeacherApi
    await api.getTeacher()
    await api.getSettings()
    await api.saveSettings({} as never)
    await api.getBookings()
    await api.getRequests()
    await api.saveHours({ timings: [], max: 4 })
    await api.addDayOff({ date: '2026-10-27', reason: 'Trip' })
    await api.removeDayOff('2026-10-27')
    await api.answerRequest('7', 'accepted')
    await api.answerRequest('8', 'declined')
    await api.getNotes()
    await api.markNotesRead()
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'GET /teacher/profile',
      'GET /teacher/settings',
      'PUT /teacher/settings',
      'GET /bookings?view=teacher',
      'GET /requests?view=teacher',
      'PUT /teacher/schedule',
      'POST /teacher/days-off',
      'DELETE /teacher/days-off/2026-10-27',
      'POST /requests/7/answer',
      'POST /requests/8/answer',
      'GET /notifications?view=teacher',
      'POST /notifications/read-all?view=teacher',
    ])
    expect(calls[5].body).toEqual({ timings: [], max: 4 })
    expect(calls[8].body).toEqual({ answer: 'accepted' })
    expect(calls[9].body).toEqual({ answer: 'declined' })
  })
})

describe('real student API paths', () => {
  it('uses the backend paths and sends no seat when booking', async () => {
    const calls = stubFetch()
    const api = realStudentApi
    await api.getTeachers()
    await api.getSpotBookings()
    await api.getBookings()
    await api.getRequests()
    await api.bookSpot({ teacherId: 'rivera', date: '2026-10-22', timingId: 't1', reason: 'Help with the quiz.' })
    await api.cancelBooking('5')
    await api.sendRequest({ teacherId: 'rivera', date: '2026-10-23', time: '15:45', reason: 'Need more time for proofs.' })
    await api.cancelRequest('6')
    await api.getSettings()
    await api.saveSettings({} as never)
    await api.getNotes()
    await api.markNotesRead()
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'GET /teachers',
      'GET /bookings?view=open',
      'GET /bookings?view=student',
      'GET /requests?view=student',
      'POST /bookings',
      'DELETE /bookings/5',
      'POST /requests',
      'DELETE /requests/6',
      'GET /student/settings',
      'PUT /student/settings',
      'GET /notifications?view=student',
      'POST /notifications/read-all?view=student',
    ])
    expect(calls[4].body).toEqual({ teacherId: 'rivera', date: '2026-10-22', timingId: 't1', reason: 'Help with the quiz.' })
    expect(calls[4].body).not.toHaveProperty('seat')
  })

  it('asks the backend for the date range and still cuts to it', async () => {
    const booking = (id: string, date: string) => ({ id, date, teacherId: 'rivera', timingId: 't1', studentId: 'maya', studentName: 'Maya K.', reason: 'x', status: 'confirmed' })
    const req = (id: string, date: string) => ({ id, date, teacherId: 'rivera', studentId: 'maya', studentName: 'Maya K.', time: '15:45', reason: 'x', status: 'pending', note: '' })
    const calls = stubFetch({
      '/bookings?view=student&from=2026-10-01&to=2026-10-31': [booking('1', '2026-09-30'), booking('2', '2026-10-01'), booking('3', '2026-10-31'), booking('4', '2026-11-01')],
      '/requests?view=student&from=2026-10-01&to=2026-10-31': [req('9', '2026-10-15'), req('10', '2026-12-01')],
    })
    const cal = await realStudentApi.getCalendar('2026-10-01', '2026-10-31')
    expect(calls.map((c) => c.path).sort()).toEqual([
      '/bookings?view=student&from=2026-10-01&to=2026-10-31',
      '/requests?view=student&from=2026-10-01&to=2026-10-31',
    ])
    expect(cal.bookings.map((b) => b.id)).toEqual(['2', '3']) // both ends inclusive
    expect(cal.requests.map((r) => r.id)).toEqual(['9'])
    expect(calls.every((c) => !c.path.includes('/student/calendar'))).toBe(true)
  })
})
