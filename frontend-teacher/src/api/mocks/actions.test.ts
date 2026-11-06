// Owner: Subgroup B (Teacher desktop UI). The demo scenario at the API level: both roles act on one shared store.
// Runs without a browser: the store falls back to memory when localStorage is unavailable.
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { addDays, toISODate } from '../../lib/dates'
import { listSlots, checkBooking, type World } from '../../lib/rules'
import type { Booking, TimingDraft } from '../../types'

vi.mock('./actions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./actions')>()),
  delay: async () => undefined,
}))

import { resetExample, runReminders } from './demo'
import { mockStudentApi as student } from './mockStudent'
import { mockTeacherApi as teacher } from './mockTeacher'
import { ME_STUDENT, ME_TEACHER } from './seed'
import { getState, mutate, resetState } from './store'

const world = (): World => ({ teachers: getState().teachers, bookings: getState().bookings })
const rivera = () => getState().teachers.find((t) => t.id === ME_TEACHER)!
const tomorrow = () => toISODate(addDays(new Date(), 1))

/** An office hour Maya can book with Ms. Rivera right now, found with the same rules the API enforces. */
function openSpot(skipDates: string[] = []) {
  const t = rivera()
  for (const o of listSlots(world(), t, tomorrow(), 60, new Date())) {
    if (skipDates.includes(o.date)) continue
    const attempt = { teacherId: t.id, date: o.date, timingId: o.row.timing.id, studentId: ME_STUDENT }
    if (checkBooking(world(), attempt, new Date()).ok) return attempt
  }
  throw new Error('no open spot found')
}

const heldIn = (a: { teacherId: string; date: string; timingId: string }) =>
  getState().bookings.filter((b) => b.teacherId === a.teacherId && b.date === a.date && b.timingId === a.timingId && b.status === 'confirmed').length

/** Other students take spots in an office hour (bypassing Maya's API), to set up a full or nearly full office hour. */
function otherStudentsTake(attempt: { teacherId: string; date: string; timingId: string }, count: number) {
  mutate((d) => {
    for (let i = 0; i < count; i++) {
      d.seq += 1
      d.bookings.push({
        id: `x${d.seq}`,
        teacherId: attempt.teacherId,
        date: attempt.date,
        timingId: attempt.timingId,
        studentId: `other${d.seq}`,
        studentName: 'Someone',
        reason: 'Needs help',
        status: 'confirmed',
        createdAt: new Date().toISOString(),
      })
    }
  })
}

const lunchDraft = (over: Partial<TimingDraft> = {}): TimingDraft => ({
  id: 'lunch', name: 'Lunch', start: '12:10', end: '12:40', days: [2, 4], ...over,
})
const afterDraft = (): TimingDraft => ({ id: 'after', name: 'After school', start: '15:30', end: '16:00', days: [2, 4] })

// Run with VITE_TEST_NOW=2026-10-17T10:00:00 to check the scenario on any day and time of week.
beforeAll(() => {
  if (!import.meta.env.VITE_TEST_NOW) return
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(import.meta.env.VITE_TEST_NOW))
})

beforeEach(() => resetState())

describe('example data', () => {
  it('is seeded relative to today with six teachers, days off and open requests', () => {
    const s = getState()
    expect(s.teachers).toHaveLength(6)
    expect(rivera().daysOff).toHaveLength(3)
    expect(s.requests.filter((r) => r.teacherId === ME_TEACHER && r.status === 'pending')).toHaveLength(3)
    expect(s.notes[ME_TEACHER].filter((n) => !n.read)).toHaveLength(2)
    expect(s.notes[ME_STUDENT].filter((n) => !n.read)).toHaveLength(1)
  })

  it('has settings and notifications for each example account, not one shared set', () => {
    const s = getState()
    for (const id of ['rivera', 'okafor']) expect(s.teacherPrefs[id]).toBeDefined()
    for (const id of ['maya', 'daniel']) expect(s.studentPrefs[id].id).toBe(id)
    expect(s.studentPrefs.daniel.name).toBe('Daniel O.')
    expect(s.notes.okafor.length).toBeGreaterThan(0)
  })
})

describe('student books and the teacher is told', () => {
  it('books an open spot, shows it to the teacher, and cancels it again', async () => {
    const a = openSpot()
    const before = (await teacher.getNotes()).length
    const booked = await student.bookSpot({ ...a, reason: 'Help with the quiz.' })
    expect(booked).toMatchObject({ studentId: ME_STUDENT, status: 'confirmed' })
    expect(booked).not.toHaveProperty('seat')
    expect(Date.parse(String(booked.createdAt))).not.toBeNaN()
    expect((await teacher.getBookings()).some((b) => b.id === booked.id)).toBe(true)
    const notes = await teacher.getNotes()
    expect(notes).toHaveLength(before + 1)
    expect(notes[0].text).toMatch(/Maya K\. booked .+ on /)
    expect(notes[0].text).not.toMatch(/seat/i)

    await student.cancelBooking(booked.id)
    const after = (await student.getBookings()).find((b) => b.id === booked.id)
    expect(after?.status).toBe('cancelled')
    expect((await teacher.getNotes())[0].text).toMatch(/cancelled their booking/)
    await expect(student.cancelBooking(booked.id)).rejects.toMatchObject({ code: 'not_found' })
  })

  it('stays quiet when the teacher turned that email off', async () => {
    const t = await teacher.getSettings()
    await teacher.saveSettings({ ...t, booking: false })
    const before = (await teacher.getNotes()).length
    await student.bookSpot({ ...openSpot(), reason: 'Help with the quiz.' })
    expect(await teacher.getNotes()).toHaveLength(before)
  })

  it('enforces every booking rule through the API', async () => {
    const a = openSpot()
    const book = (over: object, reason = 'Help with the quiz.') => student.bookSpot({ ...a, ...over, reason })
    await expect(book({ date: toISODate(addDays(new Date(), -3)) })).rejects.toMatchObject({ code: expect.stringMatching(/past|no_office_hour/) })
    await expect(book({}, 'short')).rejects.toMatchObject({ code: 'reason' })

    const dayOff = rivera().daysOff[0].date
    await expect(book({ date: dayOff, timingId: 'lunch' })).rejects.toMatchObject({ code: 'day_off' })

    await book({})
    await expect(book({})).rejects.toMatchObject({ code: 'already_booked' })
  })

  it('the last spot goes to one student only', async () => {
    const a = openSpot()
    const max = rivera().max
    otherStudentsTake(a, max - 1 - heldIn(a)) // leave exactly one spot
    expect(checkBooking(world(), a, new Date())).toEqual({ ok: true })
    // Another student grabs it between Maya loading the page and confirming.
    otherStudentsTake(a, 1)
    await expect(student.bookSpot({ ...a, reason: 'Help with the quiz.' })).rejects.toMatchObject({ code: 'full' })
    expect(heldIn(a)).toBe(max)
  })

  it('a cancelled booking frees its spot for the next student', async () => {
    const a = openSpot()
    otherStudentsTake(a, rivera().max - 1 - heldIn(a))
    const mine = await student.bookSpot({ ...a, reason: 'Help with the quiz.' })
    const someoneElse = { ...a, studentId: 'someone-else' }
    expect(checkBooking(world(), someoneElse, new Date())).toMatchObject({ ok: false, code: 'full' })
    await student.cancelBooking(mine.id)
    expect(checkBooking(world(), someoneElse, new Date())).toEqual({ ok: true })
  })

  it('sends a request, validates it, and lets the student cancel it', async () => {
    const date = tomorrow()
    const ok = { teacherId: ME_TEACHER, date, time: '15:45', reason: 'Need more time for proofs.' }
    const days = rivera().daysOff.map((d) => d.date)
    const safe = days.includes(date) ? toISODate(addDays(new Date(), 2)) : date
    await expect(student.sendRequest({ ...ok, date: toISODate(addDays(new Date(), -1)) })).rejects.toMatchObject({ code: 'past' })
    await expect(student.sendRequest({ ...ok, date: days[0] })).rejects.toMatchObject({ code: 'day_off' })
    await expect(student.sendRequest({ ...ok, date: safe, reason: 'too short' })).rejects.toMatchObject({ code: 'reason' })

    const r = await student.sendRequest({ ...ok, date: safe })
    expect(r.status).toBe('pending')
    expect((await teacher.getNotes())[0].text).toMatch(/Maya K\. sent a request/)
    await student.cancelRequest(r.id)
    expect((await student.getRequests()).some((x) => x.id === r.id)).toBe(false)
  })
})

describe('teacher answers and the student is told', () => {
  it('accepts or declines a request, once', async () => {
    const date = toISODate(addDays(new Date(), 2))
    const safe = rivera().daysOff.some((d) => d.date === date) ? toISODate(addDays(new Date(), 3)) : date
    const sent = await student.sendRequest({ teacherId: ME_TEACHER, date: safe, time: '15:45', reason: 'Need more time for proofs.' })

    const answered = await teacher.answerRequest(sent.id, 'accepted')
    expect(answered).toMatchObject({ status: 'accepted', note: 'Ms. Rivera accepted this time.' })
    expect((await student.getNotes())[0].text).toMatch(/Ms\. Rivera accepted your request/)
    await expect(teacher.answerRequest(sent.id, 'declined')).rejects.toMatchObject({ code: 'not_found' })

    const pending = (await teacher.getRequests()).filter((r) => r.status === 'pending')
    const declined = await teacher.answerRequest(pending[0].id, 'declined')
    expect(declined.status).toBe('declined')
  })

  it('refuses to accept a request whose day is now a day off', async () => {
    const target = (await teacher.getRequests()).find((r) => r.status === 'pending')!
    await teacher.addDayOff({ date: target.date, reason: 'Sick' })
    await expect(teacher.answerRequest(target.id, 'accepted')).rejects.toMatchObject({ code: 'day_off' })
    await expect(teacher.answerRequest(target.id, 'declined')).resolves.toMatchObject({ status: 'declined' })
  })
})

describe('days off', () => {
  it('counts affected bookings, keeps them, tells the student, and can be undone', async () => {
    const mine = getState().bookings.find((b) => b.studentId === ME_STUDENT && b.teacherId === ME_TEACHER && b.date > toISODate(new Date()))!
    const total = getState().bookings.length
    const unread = (await student.getNotes()).length

    const { affected, dayOff } = await teacher.addDayOff({ date: mine.date, reason: '  Trip  ' })
    expect(affected).toBeGreaterThanOrEqual(1)
    expect(dayOff.reason).toBe('Trip')
    expect(getState().bookings).toHaveLength(total)
    expect((await student.getNotes())[0].text).toMatch(/Ms\. Rivera is out on/)
    expect(await student.getNotes()).toHaveLength(unread + 1)

    await expect(teacher.addDayOff({ date: mine.date, reason: '' })).rejects.toMatchObject({ code: 'duplicate_day_off' })
    await expect(teacher.addDayOff({ date: toISODate(addDays(new Date(), -1)), reason: '' })).rejects.toMatchObject({ code: 'past' })

    await teacher.removeDayOff(mine.date)
    expect(rivera().daysOff.some((d) => d.date === mine.date)).toBe(false)
    expect((await student.getNotes())[0].text).toMatch(/is back on/)
    await expect(teacher.removeDayOff(mine.date)).rejects.toMatchObject({ code: 'not_found' })
  })
})

describe('office hours', () => {
  it('moves a timing, keeps every booking, and tells affected students', async () => {
    const total = getState().bookings.length
    const result = await teacher.saveHours({ timings: [lunchDraft({ start: '12:20', end: '12:50' }), afterDraft()], max: 4 })
    expect(result.orphaned).toBe(0)
    expect(getState().bookings).toHaveLength(total)
    expect((await student.getNotes())[0].text).toMatch(/moved Lunch to 12:20 – 12:50 PM/)
  })

  it('keeps a removed timing on file so old bookings still resolve', async () => {
    const result = await teacher.saveHours({ timings: [lunchDraft()], max: 4 })
    expect(result.orphaned).toBeGreaterThanOrEqual(1)
    const gone = rivera().timings.find((x) => x.id === 'after')
    expect(gone).toMatchObject({ gone: true, days: [] })
    expect(getState().bookings.filter((b) => b.timingId === 'after').length).toBeGreaterThan(0)
  })

  it('validates timings and will not drop seats below the fullest upcoming office hour', async () => {
    await expect(teacher.saveHours({ timings: [], max: 4 })).rejects.toMatchObject({ code: 'invalid' })
    await expect(teacher.saveHours({ timings: [lunchDraft({ name: ' ' })], max: 4 })).rejects.toMatchObject({ code: 'invalid' })
    const groups = new Map<string, number>()
    for (const b of getState().bookings) {
      if (b.teacherId !== ME_TEACHER || b.status !== 'confirmed' || b.date <= toISODate(new Date())) continue
      groups.set(`${b.date}|${b.timingId}`, (groups.get(`${b.date}|${b.timingId}`) ?? 0) + 1)
    }
    const highest = Math.max(...groups.values())
    await expect(teacher.saveHours({ timings: [lunchDraft(), afterDraft()], max: highest - 1 })).rejects.toMatchObject({
      code: 'seat_floor',
      message: expect.stringContaining(`${highest} is the lowest right now`),
    })
    await expect(teacher.saveHours({ timings: [lunchDraft(), afterDraft()], max: highest })).resolves.toBeDefined()
    expect(rivera().max).toBe(highest)
  })

  it('adds a new timing', async () => {
    const early: TimingDraft = { id: 'early', name: 'Before school', start: '07:30', end: '08:00', days: [1, 3] }
    await teacher.saveHours({ timings: [lunchDraft(), afterDraft(), early], max: 4 })
    expect(rivera().timings.find((x) => x.id === 'early')).toMatchObject({ name: 'Before school', days: [1, 3] })
  })
})

describe('settings, notifications and reminders', () => {
  it('saves settings, renames the teacher everywhere, and rejects an empty name', async () => {
    const s = await teacher.getSettings()
    await expect(teacher.saveSettings({ ...s, name: '  ' })).rejects.toMatchObject({ code: 'invalid' })
    await teacher.saveSettings({ ...s, name: 'Ms. R. Rivera', email: 'r@school.org', lead: '1 day' })
    expect(rivera().name).toBe('Ms. R. Rivera')
    expect((await student.getTeachers()).find((t) => t.id === ME_TEACHER)?.name).toBe('Ms. R. Rivera')
    expect((await teacher.getSettings()).lead).toBe('1 day')
    await expect(teacher.saveSettings({ ...s, email: 'nope' })).rejects.toMatchObject({ code: 'invalid' })
  })

  it('marks notifications read per role', async () => {
    await teacher.markNotesRead()
    expect((await teacher.getNotes()).every((n) => n.read)).toBe(true)
    expect((await student.getNotes()).some((n) => !n.read)).toBe(true)
  })

  it('creates each reminder once, and respects the reminder switch', async () => {
    const s = await teacher.getSettings()
    await teacher.saveSettings({ ...s, lead: '1 day' })
    await runReminders()
    const total = () => Object.values(getState().notes).reduce((n, list) => n + list.length, 0)
    const once = total()
    await runReminders()
    expect(total()).toBe(once)

    resetState()
    const off = await teacher.getSettings()
    await teacher.saveSettings({ ...off, remind: false, morning: false, lead: '1 day' })
    const before = getState().notes[ME_TEACHER].length
    await runReminders()
    expect(getState().notes[ME_TEACHER].length).toBe(before)
  })

  it('reset puts the original data back', async () => {
    const original = getState().bookings.length
    await student.bookSpot({ ...openSpot(), reason: 'Help with the quiz.' })
    expect(getState().bookings).toHaveLength(original + 1)
    await resetExample()
    expect(getState().bookings).toHaveLength(original)
  })
})

describe('data the student sees', () => {
  it('lists only their own bookings and requests, and how full every office hour is', async () => {
    const mine = await student.getBookings()
    expect(mine.length).toBeGreaterThan(0)
    expect(mine.every((b: Booking) => b.studentId === ME_STUDENT)).toBe(true)
    expect((await student.getRequests()).every((r) => r.studentId === ME_STUDENT)).toBe(true)
    const spots = await student.getSpotBookings()
    expect(spots.every((b) => b.status === 'confirmed')).toBe(true)
    expect(spots.some((b) => b.teacherId === 'brooks')).toBe(true)
    // Other students are anonymous, the student's own bookings are complete.
    expect(spots.filter((b) => b.studentId !== ME_STUDENT).every((b) => b.studentName === '' && b.reason === '')).toBe(true)
    expect(spots.filter((b) => b.studentId === ME_STUDENT).every((b) => b.reason !== '')).toBe(true)
  })

  it('getCalendar returns only the student\u2019s own bookings and requests inside the range, across teachers', async () => {
    const from = toISODate(new Date())
    const to = toISODate(addDays(new Date(), 60))
    const { bookings, requests } = await student.getCalendar(from, to)
    expect(bookings.length).toBeGreaterThan(0)
    expect(bookings.every((b) => b.studentId === ME_STUDENT && b.date >= from && b.date <= to)).toBe(true)
    expect(new Set(bookings.map((b) => b.teacherId)).size).toBeGreaterThan(1) // Rivera, Okafor and Alvarez in the seed
    expect(requests.every((r) => r.studentId === ME_STUDENT && r.date >= from && r.date <= to)).toBe(true)
  })

  it('getCalendar includes cancelled bookings, treats both ends as inclusive, and can be empty', async () => {
    const a = openSpot()
    const booked = await student.bookSpot({ ...a, reason: 'Help with the quiz.' })
    await student.cancelBooking(booked.id)
    const one = await student.getCalendar(a.date, a.date)
    expect(one.bookings.find((b) => b.id === booked.id)?.status).toBe('cancelled')
    expect(one.bookings.every((b) => b.date === a.date)).toBe(true)
    const none = await student.getCalendar('2001-01-01', '2001-01-07')
    expect(none).toEqual({ bookings: [], requests: [] })
  })
})
