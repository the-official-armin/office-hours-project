// Owner: Subgroup B (Teacher desktop UI). Demo-only helpers that stand in for the Student UI and for the email scheduler.
// A real backend has no equivalent: students book through their own UI, and reminders are sent by the server.
import type { Booking, BookingRequest } from '../../types'
import { addDays, combine, formatDateShort, formatTime, parseISODate, toISODate } from '../../lib/dates'
import { RuleError } from '../errors'
import { checkBooking, checkRequestTime, generateSlots } from './bookingRules'
import { assertOk, delay, ruleState } from './mockTeacher'
import { notify } from './notify'
import { mutate, nextId, resetState } from './store'

/** A student books a seat. Goes through the same rules the backend will enforce. */
export async function createDemoBooking(input: {
  slotId: string
  studentName: string
  reason: string
}): Promise<Booking> {
  await delay()
  if (!input.studentName.trim()) throw new RuleError('invalid', 'Enter the student name.')
  return mutate((d) => {
    const now = new Date()
    assertOk(checkBooking(ruleState(d), input.slotId, now))
    const date = input.slotId.slice(0, 10)
    const slot = generateSlots(ruleState(d), date, date).find((s) => s.id === input.slotId)!
    const booking: Booking = {
      id: nextId(d, 'b'),
      studentName: input.studentName.trim(),
      reason: input.reason.trim() || 'No reason given.',
      date,
      start: slot.start,
      end: slot.end,
      slotId: slot.id,
      timingName: slot.name,
      createdAt: now.toISOString(),
    }
    d.bookings.push(booking)
    notify(
      d,
      'booking',
      'New booking',
      `${booking.studentName} booked ${slot.name} on ${formatDateShort(date)} at ${formatTime(slot.start)}.`,
    )
    return booking
  })
}

/** A student asks for a time outside the schedule. */
export async function createDemoRequest(input: {
  date: string
  start: string
  studentName: string
  reason: string
}): Promise<BookingRequest> {
  await delay()
  if (!input.studentName.trim()) throw new RuleError('invalid', 'Enter the student name.')
  if (!input.date || !input.start) throw new RuleError('invalid', 'Pick a date and a time.')
  return mutate((d) => {
    const now = new Date()
    assertOk(checkRequestTime(ruleState(d), input.date, input.start, now))
    const startDate = combine(input.date, input.start)
    const end = new Date(startDate.getTime() + 30 * 60_000)
    const endTime = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
    const request: BookingRequest = {
      id: nextId(d, 'r'),
      studentName: input.studentName.trim(),
      reason: input.reason.trim() || 'No reason given.',
      date: input.date,
      start: input.start,
      end: end.getDate() === startDate.getDate() ? endTime : '23:59',
      createdAt: now.toISOString(),
    }
    d.requests.push(request)
    notify(
      d,
      'request',
      'New request',
      `${request.studentName} asked for ${formatDateShort(request.date)} at ${formatTime(request.start)}.`,
    )
    return request
  })
}

/**
 * Simulates the server-side email scheduler. Creates reminder notifications for office hours that start
 * within the chosen lead time. Safe to call repeatedly: each reminder has a dedupe key.
 */
export async function runReminders(now: Date = new Date()): Promise<void> {
  mutate((d) => {
    const today = toISODate(now)
    const state = ruleState(d)
    const horizon = toISODate(addDays(parseISODate(today), 2))
    const slots = generateSlots(state, today, horizon).filter(
      (s) => !d.daysOff.some((o) => o.date === s.date) && s.booked > 0,
    )

    if (d.prefs.beforeOfficeHour) {
      for (const s of slots) {
        const minutesUntil = (combine(s.date, s.start).getTime() - now.getTime()) / 60_000
        if (minutesUntil <= 0 || minutesUntil > d.prefs.leadMinutes) continue
        notify(
          d,
          'reminder',
          'Office hour starting soon',
          `${s.name} starts at ${formatTime(s.start)} with ${s.booked} student${s.booked === 1 ? '' : 's'} booked.`,
          { key: `reminder:${s.id}:${d.prefs.leadMinutes}` },
        )
      }
    }

    if (d.prefs.morningSummary) {
      const todays = slots.filter((s) => s.date === today)
      if (todays.length > 0) {
        const total = todays.reduce((sum, s) => sum + s.booked, 0)
        notify(d, 'reminder', 'Morning summary', `Today: ${todays.length} office hours, ${total} seats booked.`, {
          key: `morning:${today}`,
          pref: 'morningSummary',
        })
      }
    }
  })
}

export async function resetDemoData(): Promise<void> {
  await delay()
  resetState()
}
