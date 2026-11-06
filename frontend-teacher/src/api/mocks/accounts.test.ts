// Mock mode with real accounts: the mock APIs answer for whoever signed in (read from the mock token), so two students can use the
// same store at once. This is what the "That office hour just filled up." race needs: maya and daniel, then rivera and okafor.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeMockToken } from '../../auth/mockToken'
import { clearToken, setToken } from '../../auth/tokenStore'
import { addDays, toISODate } from '../../lib/dates'
import { checkBooking, listSlots } from '../../lib/rules'
import type { Role } from '../../types'

vi.mock('./actions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./actions')>()),
  delay: async () => undefined,
}))

import { mockStudentApi as student } from './mockStudent'
import { mockTeacherApi as teacher } from './mockTeacher'
import { getState, mutate, resetState } from './store'

const signInAs = (role: Role, id: string) => setToken(makeMockToken(role, id, Date.now() + 3_600_000), 3600, false)

beforeEach(() => {
  clearToken()
  resetState()
})
afterEach(() => clearToken())

const worldNow = () => ({ teachers: getState().teachers, bookings: getState().bookings })

/** A future office hour of this teacher that this student can book right now, found with the rules the API enforces. */
function openSpot(teacherId: string, studentId: string, from = 1) {
  const t = getState().teachers.find((x) => x.id === teacherId)!
  for (const o of listSlots(worldNow(), t, toISODate(addDays(new Date(), from)), 60, new Date())) {
    const attempt = { teacherId, date: o.date, timingId: o.row.timing.id, studentId }
    if (checkBooking(worldNow(), attempt, new Date()).ok) return attempt
  }
  throw new Error('no open spot')
}

describe('each signed-in student sees their own data', () => {
  it('maya and daniel have their own bookings, settings and notifications', async () => {
    signInAs('student', 'maya')
    const mayaBookings = await student.getBookings()
    const mayaSettings = await student.getSettings()
    const mayaNotes = await student.getNotes()
    signInAs('student', 'daniel')
    const danielBookings = await student.getBookings()
    const danielSettings = await student.getSettings()

    expect(mayaSettings).toMatchObject({ id: 'maya', name: 'Maya K.' })
    expect(danielSettings).toMatchObject({ id: 'daniel', name: 'Daniel O.' })
    expect(mayaBookings.every((b) => b.studentId === 'maya')).toBe(true)
    expect(danielBookings.every((b) => b.studentId === 'daniel')).toBe(true)
    expect(danielBookings.length).toBeGreaterThan(0)
    expect(mayaNotes.length).toBeGreaterThan(0)
    expect(await student.getNotes()).toHaveLength(0) // daniel's inbox is his own and empty
  })

  it('saving settings changes only the signed-in student', async () => {
    signInAs('student', 'daniel')
    const s = await student.getSettings()
    await student.saveSettings({ ...s, name: 'Daniel Ortiz' })
    signInAs('student', 'maya')
    expect((await student.getSettings()).name).toBe('Maya K.')
    signInAs('student', 'daniel')
    expect((await student.getSettings()).name).toBe('Daniel Ortiz')
  })
})

describe('daniel can book, under his own name, and the teacher is told', () => {
  it('books an open spot as daniel and tells Ms. Rivera', async () => {
    signInAs('student', 'daniel')
    const spot = openSpot('rivera', 'daniel')
    const booked = await student.bookSpot({ teacherId: spot.teacherId, date: spot.date, timingId: spot.timingId, reason: 'Help with the quiz.' })
    expect(booked).toMatchObject({ studentId: 'daniel', studentName: 'Daniel O.', status: 'confirmed' })

    signInAs('teacher', 'rivera')
    expect((await teacher.getBookings()).some((b) => b.id === booked.id)).toBe(true)
    expect((await teacher.getNotes())[0].text).toMatch(/^Daniel O\. booked /)
  })

  it('two students racing for the last spot: the second one is told it is full', async () => {
    const spot = openSpot('rivera', 'maya')
    const t = getState().teachers.find((x) => x.id === 'rivera')!
    const held = getState().bookings.filter((b) => b.teacherId === spot.teacherId && b.date === spot.date && b.timingId === spot.timingId && b.status === 'confirmed').length
    // Other classmates fill every spot but one.
    mutate((d) => {
      for (let i = held; i < t.max - 1; i++) {
        d.bookings.push({ id: `fill${i}`, teacherId: spot.teacherId, date: spot.date, timingId: spot.timingId, studentId: `kid${i}`, studentName: 'Kid', reason: 'x', status: 'confirmed', createdAt: new Date().toISOString() })
      }
    })
    const input = { teacherId: spot.teacherId, date: spot.date, timingId: spot.timingId, reason: 'Help with the quiz.' }
    signInAs('student', 'maya')
    await student.bookSpot(input)
    signInAs('student', 'daniel')
    await expect(student.bookSpot(input)).rejects.toMatchObject({ code: 'full' })
  })
})

describe('each signed-in teacher sees their own office hours and inbox', () => {
  it('okafor sees okafor, rivera sees rivera', async () => {
    signInAs('teacher', 'okafor')
    expect((await teacher.getTeacher()).id).toBe('okafor')
    expect((await teacher.getBookings()).every((b) => b.teacherId === 'okafor')).toBe(true)
    expect((await teacher.getNotes()).length).toBeGreaterThan(0)
    signInAs('teacher', 'rivera')
    expect((await teacher.getTeacher()).id).toBe('rivera')
    expect((await teacher.getBookings()).every((b) => b.teacherId === 'rivera')).toBe(true)
  })

  it('a booking with Mr. Okafor lands in his inbox, not Ms. Rivera’s', async () => {
    signInAs('teacher', 'rivera')
    const before = (await teacher.getNotes()).length
    signInAs('student', 'daniel')
    const spot = openSpot('okafor', 'daniel', 8)
    await student.bookSpot({ teacherId: spot.teacherId, date: spot.date, timingId: spot.timingId, reason: 'Lab report questions.' })
    signInAs('teacher', 'okafor')
    expect((await teacher.getNotes())[0].text).toMatch(/^Daniel O\. booked /)
    signInAs('teacher', 'rivera')
    expect((await teacher.getNotes()).length).toBe(before)
  })
})
