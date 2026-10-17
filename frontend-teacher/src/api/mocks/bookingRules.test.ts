// Owner: Subgroup B (Teacher desktop UI). Unit tests for the stand-in backend rules.
import { describe, expect, it } from 'vitest'
import type { Booking, Schedule } from '../../types'
import {
  checkBooking,
  checkRequestTime,
  countAffectedBookings,
  generateSlots,
  scheduleWarnings,
  slotId,
  validateDayOff,
  validateSchedule,
  type RuleState,
} from './bookingRules'

// Thursday 15 Oct 2026, 12:00 local time.
const NOW = new Date(2026, 9, 15, 12, 0, 0)
const TODAY = '2026-10-15'
const TOMORROW = '2026-10-16'
const NEXT_TUE = '2026-10-20'

const schedule: Schedule = {
  seatsPerOfficeHour: 4,
  timings: [
    { id: 'first', name: 'Lunch', start: '12:10', end: '12:40', days: ['tue', 'thu'] },
    { id: 'second', name: 'After school', start: '15:30', end: '16:00', days: ['tue', 'thu'] },
  ],
}

function booking(id: string, date: string, timingId: 'first' | 'second', name = 'Lunch'): Booking {
  return {
    id,
    studentName: `Student ${id}`,
    reason: 'Homework',
    date,
    start: '12:10',
    end: '12:40',
    slotId: slotId(date, timingId),
    timingName: name,
    createdAt: NOW.toISOString(),
  }
}

function state(partial: Partial<RuleState> = {}): RuleState {
  return { schedule, daysOff: [], bookings: [], ...partial }
}

describe('checkBooking', () => {
  it('allows an open slot in the future', () => {
    expect(checkBooking(state(), slotId(NEXT_TUE, 'first'), NOW)).toEqual({ ok: true })
  })

  it('blocks a past date', () => {
    const r = checkBooking(state(), slotId('2026-10-13', 'first'), NOW)
    expect(r).toMatchObject({ ok: false, code: 'past' })
  })

  it('blocks today when the office hour already started (earlier time)', () => {
    const r = checkBooking(state(), slotId(TODAY, 'first'), new Date(2026, 9, 15, 12, 30))
    expect(r).toMatchObject({ ok: false, code: 'past' })
  })

  it('blocks a start time exactly equal to now', () => {
    const r = checkBooking(state(), slotId(TODAY, 'first'), new Date(2026, 9, 15, 12, 10))
    expect(r).toMatchObject({ ok: false, code: 'past' })
  })

  it('allows today when the office hour has not started yet', () => {
    expect(checkBooking(state(), slotId(TODAY, 'second'), NOW)).toEqual({ ok: true })
  })

  it('blocks a day off', () => {
    const s = state({ daysOff: [{ id: 'd1', date: NEXT_TUE, reason: '' }] })
    expect(checkBooking(s, slotId(NEXT_TUE, 'first'), NOW)).toMatchObject({ ok: false, code: 'day_off' })
  })

  it('blocks a day off that is today (later time)', () => {
    const s = state({ daysOff: [{ id: 'd1', date: TODAY, reason: '' }] })
    expect(checkBooking(s, slotId(TODAY, 'second'), NOW)).toMatchObject({ ok: false, code: 'day_off' })
  })

  it('reports past before day off when both apply', () => {
    const s = state({ daysOff: [{ id: 'd1', date: '2026-10-13', reason: '' }] })
    expect(checkBooking(s, slotId('2026-10-13', 'first'), NOW)).toMatchObject({ code: 'past' })
  })

  it('allows the last seat (3 of 4 booked)', () => {
    const bookings = [1, 2, 3].map((i) => booking(String(i), NEXT_TUE, 'first'))
    expect(checkBooking(state({ bookings }), slotId(NEXT_TUE, 'first'), NOW)).toEqual({ ok: true })
  })

  it('blocks a slot that is exactly full (4 of 4)', () => {
    const bookings = [1, 2, 3, 4].map((i) => booking(String(i), NEXT_TUE, 'first'))
    expect(checkBooking(state({ bookings }), slotId(NEXT_TUE, 'first'), NOW)).toMatchObject({
      ok: false,
      code: 'full',
    })
  })

  it('blocks a time that is not an office hour', () => {
    expect(checkBooking(state(), slotId('2026-10-21', 'first'), NOW)).toMatchObject({
      ok: false,
      code: 'no_office_hour',
    })
  })
})

describe('checkRequestTime', () => {
  it('blocks past and day-off requests, allows others', () => {
    const s = state({ daysOff: [{ id: 'd1', date: TOMORROW, reason: '' }] })
    expect(checkRequestTime(s, TODAY, '09:00', NOW)).toMatchObject({ code: 'past' })
    expect(checkRequestTime(s, TOMORROW, '15:00', NOW)).toMatchObject({ code: 'day_off' })
    expect(checkRequestTime(s, NEXT_TUE, '15:00', NOW)).toEqual({ ok: true })
  })
})

describe('days off', () => {
  it('allows a day off that has bookings and counts them', () => {
    const bookings = [booking('1', NEXT_TUE, 'first'), booking('2', NEXT_TUE, 'second'), booking('3', '2026-10-22', 'first')]
    expect(validateDayOff(state({ bookings }), NEXT_TUE, NOW)).toEqual({ ok: true })
    expect(countAffectedBookings(bookings, NEXT_TUE)).toBe(2)
    expect(countAffectedBookings(bookings, '2026-10-27')).toBe(0)
  })

  it('rejects a past day and a duplicate day', () => {
    const s = state({ daysOff: [{ id: 'd1', date: NEXT_TUE, reason: '' }] })
    expect(validateDayOff(s, '2026-10-14', NOW)).toMatchObject({ code: 'past' })
    expect(validateDayOff(s, NEXT_TUE, NOW)).toMatchObject({ code: 'duplicate_day_off' })
    expect(validateDayOff(s, TODAY, NOW)).toEqual({ ok: true })
  })
})

describe('schedule changes', () => {
  it('keeps bookings and warns when the new max is below the booked count', () => {
    const bookings = [1, 2, 3].map((i) => booking(String(i), NEXT_TUE, 'first'))
    const smaller = state({ bookings, schedule: { ...schedule, seatsPerOfficeHour: 2 } })
    expect(smaller.bookings).toHaveLength(3)
    expect(scheduleWarnings(smaller, NOW)).toEqual([
      { kind: 'over_capacity', date: NEXT_TUE, timingName: 'Lunch', booked: 3, max: 2 },
    ])
  })

  it('warns about bookings whose day was removed from the schedule', () => {
    const bookings = [booking('1', NEXT_TUE, 'first')]
    const noTuesday = state({
      bookings,
      schedule: {
        ...schedule,
        timings: [{ ...schedule.timings[0], days: ['thu'] }, schedule.timings[1]],
      },
    })
    expect(scheduleWarnings(noTuesday, NOW)).toMatchObject([{ kind: 'unscheduled', date: NEXT_TUE, booked: 1 }])
  })

  it('does not warn about past bookings or when everything fits', () => {
    const bookings = [booking('1', '2026-10-13', 'first'), booking('2', NEXT_TUE, 'first')]
    expect(scheduleWarnings(state({ bookings }), NOW)).toEqual([])
  })

  it('generates slots with booked counts', () => {
    const bookings = [booking('1', NEXT_TUE, 'first'), booking('2', NEXT_TUE, 'first')]
    const slots = generateSlots(state({ bookings }), TODAY, NEXT_TUE)
    expect(slots.map((s) => s.id)).toEqual([
      slotId(TODAY, 'first'),
      slotId(TODAY, 'second'),
      slotId(NEXT_TUE, 'first'),
      slotId(NEXT_TUE, 'second'),
    ])
    expect(slots[2]).toMatchObject({ booked: 2, maxStudents: 4 })
  })

  it('validates timings and seats', () => {
    expect(validateSchedule(schedule)).toEqual({ ok: true })
    expect(validateSchedule({ ...schedule, seatsPerOfficeHour: 0 })).toMatchObject({ code: 'invalid' })
    const reversed = { ...schedule, timings: [{ ...schedule.timings[0], end: '12:00' }, schedule.timings[1]] } as Schedule
    expect(validateSchedule(reversed)).toMatchObject({ code: 'invalid' })
    const overlap = { ...schedule, timings: [schedule.timings[0], { ...schedule.timings[1], start: '12:20', end: '13:00' }] } as Schedule
    expect(validateSchedule(overlap)).toMatchObject({ code: 'invalid' })
  })
})
