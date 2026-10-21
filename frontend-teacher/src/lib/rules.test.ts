// Shared: unit tests for the domain rules.
import { describe, expect, it } from 'vitest'
import type { Booking, BookingRequest, Teacher, TimingDraft } from '../types'
import {
  affectedOn,
  applyTimings,
  checkAccept,
  checkBooking,
  checkBookingReason,
  checkDayOff,
  checkHours,
  checkRequest,
  disruption,
  hoursNotices,
  listSlots,
  minSeats,
  orphanedBookings,
  pastBookings,
  pendingRequests,
  slotRows,
  stepSeats,
  upcomingBookings,
  validateHours,
  type World,
} from './rules'

// Thursday 15 Oct 2026, 12:00 local time.
const NOW = new Date(2026, 9, 15, 12, 0, 0)
const TODAY = '2026-10-15' // Thu
const NEXT_TUE = '2026-10-20'
const NEXT_WED = '2026-10-21'
const NEXT_THU = '2026-10-22'

const rivera: Teacher = {
  id: 'rivera',
  name: 'Ms. Rivera',
  subject: 'Mathematics',
  group: 'Math',
  max: 4,
  daysOff: [],
  timings: [
    { id: 'lunch', name: 'Lunch', start: '12:10', end: '12:40', days: [2, 4] },
    { id: 'after', name: 'After school', start: '15:30', end: '16:00', days: [2, 4] },
  ],
}
const okafor: Teacher = {
  id: 'okafor',
  name: 'Mr. Okafor',
  subject: 'Chemistry',
  group: 'Science',
  max: 4,
  daysOff: [],
  timings: [{ id: 'lunch', name: 'Lunch', start: '12:10', end: '12:40', days: [2, 5] }],
}

let n = 0
function booking(partial: Partial<Booking> & Pick<Booking, 'date' | 'seat'>): Booking {
  n += 1
  return {
    id: `b${n}`,
    teacherId: 'rivera',
    timingId: 'lunch',
    studentId: `s${n}`,
    studentName: `Student ${n}`,
    reason: 'Homework help',
    status: 'confirmed',
    ...partial,
  }
}

function world(partial: Partial<World> = {}): World {
  return { teachers: [structuredClone(rivera), structuredClone(okafor)], bookings: [], ...partial }
}

const attempt = (over: Partial<Parameters<typeof checkBooking>[1]> = {}) => ({
  teacherId: 'rivera',
  date: NEXT_TUE,
  timingId: 'lunch',
  seat: 1,
  studentId: 'maya',
  ...over,
})

describe('checkBooking', () => {
  it('allows an open seat in a future office hour', () => {
    expect(checkBooking(world(), attempt(), NOW)).toEqual({ ok: true })
  })

  it('blocks a past date', () => {
    expect(checkBooking(world(), attempt({ date: '2026-10-13' }), NOW)).toMatchObject({ ok: false, code: 'past' })
  })

  it('blocks an office hour that already started today, and one starting this very minute', () => {
    const w = world()
    expect(checkBooking(w, attempt({ date: TODAY }), new Date(2026, 9, 15, 12, 30))).toMatchObject({ code: 'past' })
    expect(checkBooking(w, attempt({ date: TODAY }), new Date(2026, 9, 15, 12, 10))).toMatchObject({ code: 'past' })
  })

  it('allows today when the office hour has not started', () => {
    expect(checkBooking(world(), attempt({ date: TODAY, timingId: 'after' }), NOW)).toEqual({ ok: true })
  })

  it('blocks a day off, including today', () => {
    const w = world()
    w.teachers[0].daysOff = [{ date: NEXT_TUE, reason: 'Trip' }, { date: TODAY, reason: 'Sick' }]
    expect(checkBooking(w, attempt(), NOW)).toMatchObject({ code: 'day_off' })
    expect(checkBooking(w, attempt({ date: TODAY, timingId: 'after' }), NOW)).toMatchObject({ code: 'day_off' })
  })

  it('reports a day off before a started office hour', () => {
    const w = world()
    w.teachers[0].daysOff = [{ date: TODAY, reason: '' }]
    expect(checkBooking(w, attempt({ date: TODAY }), new Date(2026, 9, 15, 13, 0))).toMatchObject({ code: 'day_off' })
  })

  it('blocks a time that is not an office hour', () => {
    expect(checkBooking(world(), attempt({ date: NEXT_WED }), NOW)).toMatchObject({ code: 'no_office_hour' })
    expect(checkBooking(world(), attempt({ teacherId: 'nobody' }), NOW)).toMatchObject({ code: 'no_office_hour' })
  })

  it('needs a seat inside 1..max', () => {
    expect(checkBooking(world(), attempt({ seat: 0 }), NOW)).toMatchObject({ code: 'bad_seat' })
    expect(checkBooking(world(), attempt({ seat: 5 }), NOW)).toMatchObject({ code: 'bad_seat' })
    expect(checkBooking(world(), attempt({ seat: 4 }), NOW)).toEqual({ ok: true })
  })

  it('blocks a seat already taken, and every seat once the office hour is full', () => {
    const bookings = [1, 2, 3, 4].map((seat) => booking({ date: NEXT_TUE, seat }))
    const w = world({ bookings })
    for (const seat of [1, 2, 3, 4]) expect(checkBooking(w, attempt({ seat }), NOW)).toMatchObject({ code: 'seat_taken' })
  })

  it('ignores cancelled bookings', () => {
    const w = world({ bookings: [booking({ date: NEXT_TUE, seat: 1, status: 'cancelled' })] })
    expect(checkBooking(w, attempt(), NOW)).toEqual({ ok: true })
  })

  it('blocks a second seat in the same office hour', () => {
    const w = world({ bookings: [booking({ date: NEXT_TUE, seat: 2, studentId: 'maya' })] })
    expect(checkBooking(w, attempt({ seat: 3 }), NOW)).toMatchObject({ code: 'already_booked' })
  })

  it('blocks an overlap with another teacher, allows back-to-back or different times', () => {
    const clash = booking({ date: NEXT_TUE, seat: 1, studentId: 'maya', teacherId: 'okafor' })
    const w = world({ bookings: [clash] })
    expect(checkBooking(w, attempt(), NOW)).toMatchObject({ code: 'conflict' })
    expect(checkBooking(w, attempt({ timingId: 'after' }), NOW)).toEqual({ ok: true })
  })
})

describe('checkBookingReason', () => {
  it('needs 10 to 300 characters', () => {
    expect(checkBookingReason('123456789')).toMatchObject({ ok: false, code: 'reason' })
    expect(checkBookingReason('1234567890')).toEqual({ ok: true })
    expect(checkBookingReason('x'.repeat(300))).toEqual({ ok: true })
    expect(checkBookingReason('x'.repeat(301))).toMatchObject({ ok: false })
    expect(checkBookingReason('   short   ')).toMatchObject({ ok: false })
  })
})

describe('checkRequest', () => {
  const req = (over = {}) => ({ teacherId: 'rivera', date: NEXT_WED, time: '15:45', reason: 'Need more time please', ...over })

  it('accepts a valid request', () => {
    expect(checkRequest(world(), req(), NOW)).toEqual({ ok: true })
  })

  it('needs a date and a time', () => {
    expect(checkRequest(world(), req({ date: '' }), NOW)).toMatchObject({ code: 'missing' })
    expect(checkRequest(world(), req({ time: '' }), NOW)).toMatchObject({ code: 'missing' })
  })

  it('rejects a time that has passed, including this minute', () => {
    expect(checkRequest(world(), req({ date: TODAY, time: '11:00' }), NOW)).toMatchObject({ code: 'past' })
    expect(checkRequest(world(), req({ date: TODAY, time: '12:00' }), NOW)).toMatchObject({ code: 'past' })
    expect(checkRequest(world(), req({ date: TODAY, time: '12:01' }), NOW)).toEqual({ ok: true })
  })

  it('rejects a day off and a short reason', () => {
    const w = world()
    w.teachers[0].daysOff = [{ date: NEXT_WED, reason: '' }]
    expect(checkRequest(w, req(), NOW)).toMatchObject({ code: 'day_off' })
    expect(checkRequest(world(), req({ reason: 'too short' }), NOW)).toMatchObject({ code: 'reason' })
  })

  it('lets the teacher accept only a future time on a working day', () => {
    const r: BookingRequest = {
      id: 'r1', teacherId: 'rivera', studentId: 'x', studentName: 'X', date: NEXT_WED, time: '15:45',
      reason: 'Need more time please', status: 'pending', note: '',
    }
    expect(checkAccept(world(), r, NOW)).toEqual({ ok: true })
    expect(checkAccept(world(), { ...r, date: '2026-10-13' }, NOW)).toMatchObject({ code: 'past' })
    const w = world()
    w.teachers[0].daysOff = [{ date: NEXT_WED, reason: '' }]
    expect(checkAccept(w, r, NOW)).toMatchObject({ code: 'day_off' })
  })
})

describe('seats per office hour', () => {
  it('floor is the highest seat in any upcoming booking', () => {
    const w = world({
      bookings: [
        booking({ date: NEXT_TUE, seat: 3 }),
        booking({ date: NEXT_THU, seat: 2 }),
        booking({ date: '2026-10-13', seat: 4 }), // past, ignored
        booking({ date: NEXT_TUE, seat: 4, status: 'cancelled' }), // cancelled, ignored
      ],
    })
    expect(minSeats(w, 'rivera', NOW)).toBe(3)
    expect(minSeats(world(), 'rivera', NOW)).toBe(1)
  })

  it('blocks "-" at the floor and clamps to 1..30', () => {
    expect(stepSeats(3, -1, 3)).toEqual({ max: 3, blocked: true })
    expect(stepSeats(4, -1, 3)).toEqual({ max: 3, blocked: false })
    expect(stepSeats(1, -1, 1)).toEqual({ max: 1, blocked: false })
    expect(stepSeats(30, 1, 1)).toEqual({ max: 30, blocked: false })
    expect(stepSeats(5, 1, 3)).toEqual({ max: 6, blocked: false })
  })
})

const draft = (over: Partial<TimingDraft> = {}): TimingDraft => ({
  id: 'lunch', name: 'Lunch', start: '12:10', end: '12:40', days: [2, 4], ...over,
})

describe('validateHours', () => {
  it('needs at least one timing', () => {
    expect(validateHours([])).toMatch(/at least one timing/i)
  })

  it('checks names, uniqueness (ignoring case), times and days in order', () => {
    expect(validateHours([draft({ name: '  ' })])).toMatch(/name/i)
    expect(validateHours([draft(), draft({ id: 'b', name: 'LUNCH', days: [1] })])).toMatch(/two timings/i)
    expect(validateHours([draft({ start: '' })])).toMatch(/start and an end/i)
    expect(validateHours([draft({ start: '13:00', end: '12:00' })])).toMatch(/after the start/i)
    expect(validateHours([draft({ start: '12:00', end: '12:00' })])).toMatch(/after the start/i)
    expect(validateHours([draft({ days: [] })])).toMatch(/no days/i)
  })

  it('rejects overlaps on a shared day only', () => {
    const a = draft()
    const overlapping = draft({ id: 'b', name: 'Late lunch', start: '12:30', end: '13:00', days: [4] })
    expect(validateHours([a, overlapping])).toMatch(/overlap on Thursday/)
    const otherDay = draft({ id: 'b', name: 'Late lunch', start: '12:30', end: '13:00', days: [1, 5] })
    expect(validateHours([a, otherDay])).toBe('')
    const backToBack = draft({ id: 'b', name: 'After', start: '12:40', end: '13:00' })
    expect(validateHours([a, backToBack])).toBe('')
  })

  it('accepts a valid list', () => {
    expect(validateHours([draft(), draft({ id: 'after', name: 'After school', start: '15:30', end: '16:00' })])).toBe('')
  })
})

describe('checkHours', () => {
  it('rejects more than 4 timings and seats outside 1..30', () => {
    const five = [1, 2, 3, 4, 5].map((i) => draft({ id: `t${i}`, name: `T${i}`, days: [i as 1], start: '08:00', end: '08:30' }))
    expect(checkHours(world(), 'rivera', { timings: five, max: 4 }, NOW)).toMatchObject({ code: 'invalid' })
    expect(checkHours(world(), 'rivera', { timings: [draft()], max: 0 }, NOW)).toMatchObject({ code: 'invalid' })
    expect(checkHours(world(), 'rivera', { timings: [draft()], max: 31 }, NOW)).toMatchObject({ code: 'invalid' })
  })

  it('refuses seats below the highest held seat', () => {
    const w = world({ bookings: [booking({ date: NEXT_TUE, seat: 3 })] })
    expect(checkHours(w, 'rivera', { timings: [draft()], max: 2 }, NOW)).toMatchObject({ code: 'seat_floor' })
    expect(checkHours(w, 'rivera', { timings: [draft()], max: 3 }, NOW)).toEqual({ ok: true })
  })
})

describe('schedule changes keep bookings and tell students', () => {
  const b1 = booking({ date: NEXT_TUE, seat: 1, studentId: 'maya' })
  const b2 = booking({ date: NEXT_THU, seat: 1, studentId: 'zoe', timingId: 'after' })
  const w = world({ bookings: [b1, b2] })

  it('counts orphaned bookings: removed timing or day no longer run', () => {
    expect(orphanedBookings(w, 'rivera', [draft()], NOW)).toEqual([b2]) // "after" removed
    expect(orphanedBookings(w, 'rivera', [draft({ days: [4] }), draft({ id: 'after', name: 'After school', start: '15:30', end: '16:00' })], NOW)).toEqual([b1])
    expect(orphanedBookings(w, 'rivera', [draft(), draft({ id: 'after', name: 'After school', start: '15:30', end: '16:00' })], NOW)).toEqual([])
  })

  it('does not count bookings on a day off, past, or cancelled', () => {
    const off = world({ bookings: [b2] })
    off.teachers[0].daysOff = [{ date: NEXT_THU, reason: '' }]
    expect(orphanedBookings(off, 'rivera', [draft()], NOW)).toEqual([])
  })

  it('writes the right notice for stopped, no longer held, and moved', () => {
    const notices = hoursNotices(w, 'rivera', [draft({ days: [4], start: '12:20', end: '12:50' })], NOW)
    expect(notices.find((x) => x.studentId === 'maya')?.text).toMatch(/no longer holds Lunch on Tue, Oct 20/)
    expect(notices.find((x) => x.studentId === 'zoe')?.text).toMatch(/stopped holding After school/)
    const moved = hoursNotices(w, 'rivera', [draft({ start: '12:20', end: '12:50' }), draft({ id: 'after', name: 'After school', start: '15:30', end: '16:00' })], NOW)
    expect(moved).toHaveLength(1)
    expect(moved[0].text).toMatch(/moved Lunch to 12:20 – 12:50 PM\. Your booking on Tue, Oct 20 still stands/)
  })

  it('keeps a removed timing on file with no days, and adds new ones', () => {
    const next = applyTimings(w.teachers[0].timings, [draft({ name: ' Lunch ' }), draft({ id: 'new', name: 'Early', start: '07:45', end: '08:15', days: [3, 1] })])
    expect(next.find((x) => x.id === 'after')).toMatchObject({ gone: true, days: [] })
    expect(next.find((x) => x.id === 'lunch')).toMatchObject({ name: 'Lunch', gone: false })
    expect(next.find((x) => x.id === 'new')).toMatchObject({ days: [1, 3], gone: false })
    expect(next).toHaveLength(3)
  })
})

describe('days off', () => {
  it('rejects a missing, past or duplicate day, but allows today and days with bookings', () => {
    const w = world({ bookings: [booking({ date: NEXT_TUE, seat: 1 })] })
    w.teachers[0].daysOff = [{ date: NEXT_THU, reason: '' }]
    const t = w.teachers[0]
    expect(checkDayOff(t, '', NOW)).toMatchObject({ code: 'missing' })
    expect(checkDayOff(t, '2026-10-14', NOW)).toMatchObject({ code: 'past' })
    expect(checkDayOff(t, NEXT_THU, NOW)).toMatchObject({ code: 'duplicate_day_off' })
    expect(checkDayOff(t, NEXT_TUE, NOW)).toEqual({ ok: true })
    expect(checkDayOff(t, TODAY, NOW)).toEqual({ ok: true })
  })

  it('counts only upcoming confirmed bookings on that day', () => {
    const w = world({
      bookings: [
        booking({ date: NEXT_TUE, seat: 1 }),
        booking({ date: NEXT_TUE, seat: 2, status: 'cancelled' }),
        booking({ date: NEXT_TUE, seat: 3, teacherId: 'okafor' }),
        booking({ date: TODAY, seat: 1 }), // lunch already started at 12:30
      ],
    })
    expect(affectedOn(w, 'rivera', NEXT_TUE, NOW)).toHaveLength(1)
    expect(affectedOn(w, 'rivera', TODAY, new Date(2026, 9, 15, 12, 30))).toHaveLength(0)
  })

  it('flags bookings on a day off or on a timing that no longer runs', () => {
    const b = booking({ date: NEXT_TUE, seat: 1 })
    const w = world({ bookings: [b] })
    expect(disruption(w, b)).toBeNull()
    w.teachers[0].daysOff = [{ date: NEXT_TUE, reason: '' }]
    expect(disruption(w, b)).toBe('out')
    w.teachers[0].daysOff = []
    w.teachers[0].timings[0].days = [4]
    expect(disruption(w, b)).toBe('changed')
    w.teachers[0].timings[0] = { ...w.teachers[0].timings[0], gone: true, days: [] }
    expect(disruption(w, b)).toBe('changed')
  })
})

describe('lookups', () => {
  it('lists office hours with seats, and skips started ones and days off in listSlots', () => {
    const w = world({ bookings: [booking({ date: NEXT_TUE, seat: 1 }), booking({ date: NEXT_TUE, seat: 2 })] })
    const rows = slotRows(w, w.teachers[0], NEXT_TUE, NOW)
    expect(rows.map((r) => [r.timing.id, r.taken, r.left, r.started])).toEqual([
      ['lunch', 2, 2, false],
      ['after', 0, 4, false],
    ])
    w.teachers[0].daysOff = [{ date: NEXT_THU, reason: '' }]
    const open = listSlots(w, w.teachers[0], TODAY, 8, new Date(2026, 9, 15, 13, 0))
    expect(open.map((o) => `${o.date} ${o.row.timing.id}`)).toEqual([
      `${TODAY} after`,
      `${NEXT_TUE} lunch`,
      `${NEXT_TUE} after`,
    ])
  })

  it('splits upcoming and past bookings, and sorts pending requests', () => {
    const up = booking({ date: NEXT_TUE, seat: 1, studentId: 'maya' })
    const past = booking({ date: '2026-10-13', seat: 1, studentId: 'maya' })
    const cancelled = booking({ date: NEXT_THU, seat: 1, studentId: 'maya', status: 'cancelled' })
    const w = world({ bookings: [up, past, cancelled] })
    const mine = (b: Booking) => b.studentId === 'maya'
    expect(upcomingBookings(w, mine, NOW)).toEqual([up])
    expect(pastBookings(w, mine, NOW)).toEqual([cancelled, past])

    const r = (id: string, date: string, status: BookingRequest['status'], teacherId = 'rivera'): BookingRequest => ({
      id, teacherId, studentId: 's', studentName: 'S', date, time: '15:30', reason: 'A reason here', status, note: '',
    })
    expect(pendingRequests([r('b', NEXT_THU, 'pending'), r('a', NEXT_TUE, 'pending'), r('c', NEXT_TUE, 'accepted'), r('d', NEXT_TUE, 'pending', 'okafor')], 'rivera').map((x) => x.id)).toEqual(['a', 'b'])
  })
})
