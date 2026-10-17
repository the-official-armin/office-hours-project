// Owner: Subgroup B (Teacher desktop UI). Pure module, no React.
// Stands in for the rules the REAL backend must enforce (see docs/api-contract.md):
//   1. No booking in the past.
//   2. No booking on a teacher's day off.
//   3. No more students than a slot's max.
//   4. Adding a day off that already has bookings is allowed; the affected count is reported.
//   5. Schedule changes never delete bookings; over-capacity and unscheduled bookings raise warnings.
//   6. Accepting a request creates a booking (also subject to rules 1 and 2).
import type { Booking, DayOff, RuleCode, Schedule, ScheduleWarning, Slot } from '../../types'
import { addDays, combine, parseISODate, toISODate, weekdayOf } from '../../lib/dates'

export interface RuleState {
  schedule: Schedule
  daysOff: DayOff[]
  bookings: Booking[]
}

export type RuleResult = { ok: true } | { ok: false; code: RuleCode; message: string }

const ok: RuleResult = { ok: true }
const fail = (code: RuleCode, message: string): RuleResult => ({ ok: false, code, message })

export function slotId(date: string, timingId: string): string {
  return `${date}_${timingId}`
}

/** Office hours between two dates (inclusive), with their current booked counts. */
export function generateSlots(state: RuleState, from: string, to: string): Slot[] {
  const slots: Slot[] = []
  const end = parseISODate(to)
  for (let d = parseISODate(from); d <= end; d = addDays(d, 1)) {
    const date = toISODate(d)
    const wd = weekdayOf(date)
    if (!wd) continue
    for (const t of state.schedule.timings) {
      if (!t.days.includes(wd)) continue
      const id = slotId(date, t.id)
      slots.push({
        id,
        date,
        timingId: t.id,
        name: t.name,
        start: t.start,
        end: t.end,
        maxStudents: state.schedule.seatsPerOfficeHour,
        booked: state.bookings.filter((b) => b.slotId === id).length,
      })
    }
  }
  return slots.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
}

function timeChecks(state: RuleState, date: string, start: string, now: Date): RuleResult {
  if (combine(date, start) <= now) return fail('past', 'That time has already passed.')
  if (state.daysOff.some((d) => d.date === date)) return fail('day_off', 'The teacher is off on that day.')
  return ok
}

/** Rules 1-3 for booking a seat in an existing office hour. */
export function checkBooking(state: RuleState, id: string, now: Date): RuleResult {
  const date = id.slice(0, 10)
  const slot = generateSlots(state, date, date).find((s) => s.id === id)
  if (!slot) return fail('no_office_hour', 'There is no office hour at that time.')
  const timing = timeChecks(state, slot.date, slot.start, now)
  if (!timing.ok) return timing
  if (slot.booked >= slot.maxStudents) return fail('full', 'That office hour is full.')
  return ok
}

/** Rules 1-2 for a request outside the schedule (also used when the teacher accepts it). */
export function checkRequestTime(state: RuleState, date: string, start: string, now: Date): RuleResult {
  return timeChecks(state, date, start, now)
}

/** Whether a day off can be added on `date`. Existing bookings do NOT block it (rule 4). */
export function validateDayOff(state: RuleState, date: string, now: Date): RuleResult {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail('invalid', 'Pick a valid date.')
  if (date < toISODate(now)) return fail('past', 'A day off cannot be in the past.')
  if (state.daysOff.some((d) => d.date === date)) return fail('duplicate_day_off', 'That day is already a day off.')
  return ok
}

export function countAffectedBookings(bookings: Booking[], date: string): number {
  return bookings.filter((b) => b.date === date).length
}

/** Rule 5: existing bookings are kept; this only reports what no longer fits. */
export function scheduleWarnings(state: RuleState, now: Date): ScheduleWarning[] {
  const today = toISODate(now)
  const groups = new Map<string, Booking[]>()
  for (const b of state.bookings) {
    if (!b.slotId || b.date < today) continue
    groups.set(b.slotId, [...(groups.get(b.slotId) ?? []), b])
  }
  const warnings: ScheduleWarning[] = []
  for (const [id, list] of groups) {
    const date = id.slice(0, 10)
    const slot = generateSlots(state, date, date).find((s) => s.id === id)
    const timingName = list[0].timingName ?? slot?.name ?? 'Office hour'
    if (!slot) {
      warnings.push({ kind: 'unscheduled', date, timingName, booked: list.length, max: 0 })
    } else if (list.length > slot.maxStudents) {
      warnings.push({ kind: 'over_capacity', date, timingName, booked: list.length, max: slot.maxStudents })
    }
  }
  return warnings.sort((a, b) => a.date.localeCompare(b.date))
}

export function validateSchedule(schedule: Schedule): RuleResult {
  if (!Number.isInteger(schedule.seatsPerOfficeHour) || schedule.seatsPerOfficeHour < 1) {
    return fail('invalid', 'Seats per office hour must be at least 1.')
  }
  for (const t of schedule.timings) {
    if (!t.name.trim()) return fail('invalid', 'Give each timing a name.')
    if (t.end <= t.start) return fail('invalid', `${t.name}: the end time must be after the start time.`)
  }
  const [a, b] = schedule.timings
  const shared = a.days.some((d) => b.days.includes(d))
  if (shared && a.start < b.end && b.start < a.end) {
    return fail('invalid', 'The two timings overlap on a shared day.')
  }
  return ok
}
