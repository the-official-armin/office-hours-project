// Shared: changes need a PR note and a teammate review.
// Purpose: the domain rules as pure functions (no React, no storage, "now" is always passed in).
// The UI uses them to show and pre-validate. The mock store uses them to enforce. The REAL backend must enforce
// the same rules; see docs/api-contract.md.
//
// Booking rules (a student can NOT book):
//   - a past date, or an office hour that has already started
//   - a teacher's day off
//   - a full office hour, a seat already taken, or a second seat in the same office hour
//   - an office hour that overlaps another of their bookings in time, with any teacher
// Existing bookings are flagged when disrupted, never auto-cancelled.
import type {
  Booking,
  BookingRequest,
  Dow,
  HoursInput,
  ReminderLead,
  RuleCode,
  Teacher,
  Timing,
  TimingDraft,
} from '../types'
import { combine, DOW_LONG, dowOf, formatDateLong, formatDateShort, formatRange, toISODate } from './dates'

export const MAX_TIMINGS = 4
export const MIN_SEATS = 1
export const MAX_SEATS = 30
export const DEFAULT_SEATS = 4
export const REASON_MIN = 10
export const REASON_MAX = 300

/** How long before an office hour each reminder setting sends its reminder. */
export const LEAD_MINUTES: Record<ReminderLead, number> = { '30 minutes': 30, '1 hour': 60, '1 day': 1440 }

export interface World {
  teachers: Teacher[]
  bookings: Booking[]
}

export type Check = { ok: true } | { ok: false; code: RuleCode; message: string }

const OK: Check = { ok: true }
const fail = (code: RuleCode, message: string): Check => ({ ok: false, code, message })

/** The message of a failed check, or '' when it passed. */
export const errorOf = (c: Check): string => (c.ok ? '' : c.message)

// ---------------------------------------------------------------- lookups

export const findTeacher = (w: World, id: string): Teacher | undefined => w.teachers.find((t) => t.id === id)

export const isOff = (t: Teacher, date: string): boolean => t.daysOff.some((d) => d.date === date)

export const hasStarted = (date: string, start: string, now: Date): boolean => combine(date, start) <= now

export const runsOn = (timing: Timing, date: string): boolean => timing.days.includes(dowOf(date) as Dow)

const byStart = (a: Timing, b: Timing) => a.start.localeCompare(b.start)

export function timingOf(w: World, b: Booking): Timing | undefined {
  return findTeacher(w, b.teacherId)?.timings.find((x) => x.id === b.timingId)
}

const isConfirmed = (b: Booking) => b.status === 'confirmed'

export interface SlotRow {
  timing: Timing
  bookings: Booking[]
  taken: number
  left: number
  started: boolean
}

/** The office hours a teacher holds on a date, with who is booked. */
export function slotRows(w: World, t: Teacher, date: string, now: Date): SlotRow[] {
  return t.timings
    .filter((x) => runsOn(x, date))
    .sort(byStart)
    .map((timing) => {
      const bookings = w.bookings
        .filter((b) => b.teacherId === t.id && b.date === date && b.timingId === timing.id && isConfirmed(b))
        .sort((a, b) => a.seat - b.seat)
      return {
        timing,
        bookings,
        taken: bookings.length,
        left: t.max - bookings.length,
        started: hasStarted(date, timing.start, now),
      }
    })
}

export interface Opening {
  date: string
  row: SlotRow
  teacher: Teacher
}

/** Office hours that can still be booked, in order, over the next `days` days starting at `from`. */
export function listSlots(w: World, t: Teacher, from: string, days: number, now: Date): Opening[] {
  const out: Opening[] = []
  const start = combine(from, '00:00')
  for (let i = 0; i < days; i++) {
    const date = toISODate(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
    if (isOff(t, date)) continue
    for (const row of slotRows(w, t, date, now)) if (!row.started) out.push({ date, row, teacher: t })
  }
  return out
}

export const upcomingBookings = (w: World, pick: (b: Booking) => boolean, now: Date): Booking[] =>
  w.bookings
    .filter((b) => isConfirmed(b) && pick(b))
    .filter((b) => {
      const x = timingOf(w, b)
      return x ? !hasStarted(b.date, x.start, now) : false
    })
    .sort((a, b) => key(w, a).localeCompare(key(w, b)))

export const pastBookings = (w: World, pick: (b: Booking) => boolean, now: Date): Booking[] =>
  w.bookings
    .filter((b) => pick(b))
    .filter((b) => {
      const x = timingOf(w, b)
      return b.status === 'cancelled' || (x ? hasStarted(b.date, x.start, now) : true)
    })
    .sort((a, b) => key(w, b).localeCompare(key(w, a)))

const key = (w: World, b: Booking) => b.date + (timingOf(w, b)?.start ?? '')

export const pendingRequests = (requests: BookingRequest[], teacherId: string): BookingRequest[] =>
  requests
    .filter((r) => r.teacherId === teacherId && r.status === 'pending')
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))

// ---------------------------------------------------------------- disruptions

export type Disruption = 'out' | 'changed'

export const DISRUPT_TEXT: Record<Disruption, string> = {
  out: 'Teacher is out that day',
  changed: 'This office hour was moved',
}

/** Is an existing booking affected by a day off or a schedule change? */
export function disruption(w: World, b: Booking): Disruption | null {
  const t = findTeacher(w, b.teacherId)
  if (!t) return null
  if (isOff(t, b.date)) return 'out'
  const x = t.timings.find((y) => y.id === b.timingId)
  if (!x || !runsOn(x, b.date)) return 'changed'
  return null
}

// ---------------------------------------------------------------- booking a seat

/** Another confirmed booking of this student that overlaps `timing` on `date`, with any teacher. */
export function conflictingBooking(
  w: World,
  studentId: string,
  date: string,
  timing: Timing,
  teacherId: string,
): Booking | undefined {
  return w.bookings.find((b) => {
    if (b.studentId !== studentId || !isConfirmed(b) || b.date !== date) return false
    if (b.teacherId === teacherId && b.timingId === timing.id) return false
    const other = timingOf(w, b)
    return !!other && other.start < timing.end && timing.start < other.end
  })
}

export interface BookingAttempt {
  teacherId: string
  date: string
  timingId: string
  seat: number
  studentId: string
}

export function checkBooking(w: World, a: BookingAttempt, now: Date): Check {
  const t = findTeacher(w, a.teacherId)
  const x = t?.timings.find((y) => y.id === a.timingId)
  if (!t || !x || !runsOn(x, a.date)) return fail('no_office_hour', 'That office hour does not exist.')
  if (isOff(t, a.date)) return fail('day_off', `${t.name} is out on ${formatDateLong(a.date)}.`)
  if (hasStarted(a.date, x.start, now)) return fail('past', 'That office hour has already started. Pick a later one.')
  if (!Number.isInteger(a.seat) || a.seat < 1 || a.seat > t.max) return fail('bad_seat', 'Pick a seat first.')
  const taken = w.bookings.some(
    (b) => b.teacherId === t.id && b.date === a.date && b.timingId === x.id && isConfirmed(b) && b.seat === a.seat,
  )
  if (taken) return fail('seat_taken', 'Someone just took that seat. Pick another one.')
  const mine = w.bookings.find(
    (b) => b.studentId === a.studentId && isConfirmed(b) && b.teacherId === t.id && b.date === a.date && b.timingId === x.id,
  )
  if (mine) return fail('already_booked', `You already have Seat ${mine.seat} in this office hour.`)
  const clash = conflictingBooking(w, a.studentId, a.date, x, t.id)
  if (clash) {
    const other = findTeacher(w, clash.teacherId)
    return fail('conflict', `You are already booked at that time with ${other?.name ?? 'another teacher'}.`)
  }
  return OK
}

/** Booking reason: at least 10 and at most 300 characters. */
export function checkBookingReason(text: string): Check {
  const n = text.trim().length
  if (n < REASON_MIN) {
    return fail('reason', `Tell your teacher a little more about what you need (at least ${REASON_MIN} characters).`)
  }
  if (n > REASON_MAX) return fail('reason', `Keep the reason under ${REASON_MAX} characters.`)
  return OK
}

// ---------------------------------------------------------------- request a different time

export interface RequestAttempt {
  teacherId: string
  date: string
  time: string
  reason: string
}

export function checkRequest(w: World, a: RequestAttempt, now: Date): Check {
  const t = findTeacher(w, a.teacherId)
  if (!t) return fail('not_found', 'That teacher no longer exists.')
  if (!a.date) return fail('missing', 'Choose a date.')
  if (!a.time) return fail('missing', 'Choose a time.')
  if (combine(a.date, a.time) <= now) return fail('past', 'Choose a time that hasn’t passed.')
  if (isOff(t, a.date)) return fail('day_off', `${t.name} is out on ${formatDateLong(a.date)}. Choose another day.`)
  if (a.reason.trim().length < REASON_MIN) {
    return fail('reason', `Tell ${t.name} why you need this time (at least ${REASON_MIN} characters).`)
  }
  return OK
}

/** The teacher may only accept a request whose time has not passed and is not a day off. */
export function checkAccept(w: World, r: BookingRequest, now: Date): Check {
  const t = findTeacher(w, r.teacherId)
  if (!t) return fail('not_found', 'That teacher no longer exists.')
  if (combine(r.date, r.time) <= now) return fail('past', 'That time has already passed.')
  if (isOff(t, r.date)) return fail('day_off', `You are out on ${formatDateLong(r.date)}.`)
  return OK
}

// ---------------------------------------------------------------- seats per office hour

/** The highest seat number held in any upcoming booking: seats cannot drop below this. */
export function minSeats(w: World, teacherId: string, now: Date): number {
  let m = MIN_SEATS
  for (const b of upcomingBookings(w, (x) => x.teacherId === teacherId, now)) if (b.seat > m) m = b.seat
  return m
}

/** One click on the stepper. `blocked` means a "-" click was refused because a student holds that seat. */
export function stepSeats(current: number, delta: number, floor: number): { max: number; blocked: boolean } {
  if (delta < 0 && current <= floor && floor > MIN_SEATS) return { max: current, blocked: true }
  return { max: Math.max(MIN_SEATS, Math.min(MAX_SEATS, current + delta)), blocked: false }
}

// ---------------------------------------------------------------- saving office hours

/** The first problem with the timings, in the order the editor reports them, or '' when they are valid. */
export function validateHours(list: TimingDraft[]): string {
  if (!list.length) return 'Add at least one timing so students can book you.'
  const seen = new Set<string>()
  for (const n of list) {
    const name = n.name.trim()
    if (!name) return 'Give each timing a name. Click “Name this timing” to type one.'
    if (seen.has(name.toLowerCase())) return `Two timings are called “${name}”. Give each its own name.`
    seen.add(name.toLowerCase())
    if (!n.start || !n.end) return `Set a start and an end time for ${name}.`
    if (n.start >= n.end) return `${name}: the end time must be after the start time.`
    if (!n.days.length) return `${name} has no days. Pick at least one day, or remove it.`
  }
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]
      const b = list[j]
      const shared = a.days.find((d) => b.days.includes(d))
      if (shared && a.start < b.end && b.start < a.end) {
        return `${a.name.trim()} and ${b.name.trim()} overlap on ${DOW_LONG[shared]}. Change a time or a day.`
      }
    }
  }
  return ''
}

/** Full check of an Office hours save: timings, count, and the seat floor. */
export function checkHours(w: World, teacherId: string, input: HoursInput, now: Date): Check {
  if (input.timings.length > MAX_TIMINGS) return fail('invalid', `You can have up to ${MAX_TIMINGS} timings.`)
  const problem = validateHours(input.timings)
  if (problem) return fail('invalid', problem)
  if (!Number.isInteger(input.max) || input.max < MIN_SEATS || input.max > MAX_SEATS) {
    return fail('invalid', `Seats per office hour must be between ${MIN_SEATS} and ${MAX_SEATS}.`)
  }
  const floor = minSeats(w, teacherId, now)
  if (input.max < floor) {
    return fail('seat_floor', `A student already holds Seat ${floor}, so seats cannot go below ${floor}.`)
  }
  return OK
}

/** Upcoming bookings that would no longer match any office hour after the save (excluding days off). */
export function orphanedBookings(w: World, teacherId: string, list: TimingDraft[], now: Date): Booking[] {
  const t = findTeacher(w, teacherId)
  if (!t) return []
  return upcomingBookings(w, (b) => b.teacherId === teacherId, now).filter((b) => {
    const x = list.find((y) => y.id === b.timingId)
    return (!x || !x.days.includes(dowOf(b.date) as Dow)) && !isOff(t, b.date)
  })
}

/** Who to tell about a schedule change, and what to say. Only upcoming confirmed bookings. */
export function hoursNotices(
  w: World,
  teacherId: string,
  list: TimingDraft[],
  now: Date,
): { studentId: string; text: string }[] {
  const t = findTeacher(w, teacherId)
  if (!t) return []
  const out: { studentId: string; text: string }[] = []
  for (const x of t.timings.filter((y) => !y.gone)) {
    const n = list.find((y) => y.id === x.id)
    const changed = !!n && (x.start !== n.start || x.end !== n.end || x.name !== n.name.trim())
    const affected = w.bookings.filter(
      (b) => b.teacherId === t.id && b.timingId === x.id && isConfirmed(b) && !hasStarted(b.date, x.start, now),
    )
    for (const b of affected) {
      if (!n) {
        out.push({ studentId: b.studentId, text: `${t.name} stopped holding ${x.name}. Your booking on ${formatDateShort(b.date)} needs a new time.` })
      } else if (!n.days.includes(dowOf(b.date) as Dow)) {
        out.push({
          studentId: b.studentId,
          text: `${t.name} no longer holds ${n.name.trim()} on ${formatDateShort(b.date)}. Cancel your booking and pick another time.`,
        })
      } else if (changed) {
        out.push({
          studentId: b.studentId,
          text: `${t.name} moved ${n.name.trim()} to ${formatRange(n.start, n.end)}. Your booking on ${formatDateShort(b.date)} still stands.`,
        })
      }
    }
  }
  return out
}

/** The teacher's timings after a save. A removed timing is kept with no days, so old bookings still resolve. */
export function applyTimings(current: Timing[], list: TimingDraft[]): Timing[] {
  const next: Timing[] = current.map((x) => {
    const n = list.find((y) => y.id === x.id)
    if (!n) return { ...x, gone: true, days: [] }
    return { id: x.id, name: n.name.trim(), start: n.start, end: n.end, days: [...n.days].sort() as Dow[], gone: false }
  })
  for (const n of list) {
    if (!current.some((x) => x.id === n.id)) {
      next.push({ id: n.id, name: n.name.trim(), start: n.start, end: n.end, days: [...n.days].sort() as Dow[], gone: false })
    }
  }
  return next
}

// ---------------------------------------------------------------- days off

/** Adding a day off: reject a past date or one already off. Existing bookings do NOT block it. */
export function checkDayOff(t: Teacher, date: string, now: Date): Check {
  if (!date) return fail('missing', 'Choose a date.')
  if (date < toISODate(now)) return fail('past', 'That date has passed. Choose today or a later day.')
  if (isOff(t, date)) return fail('duplicate_day_off', `${formatDateLong(date)} is already a day off.`)
  return OK
}

/** Upcoming confirmed bookings on a date that a day off would affect. */
export function affectedOn(w: World, teacherId: string, date: string, now: Date): Booking[] {
  return w.bookings.filter((b) => {
    if (b.teacherId !== teacherId || b.date !== date || !isConfirmed(b)) return false
    const x = timingOf(w, b)
    return x ? !hasStarted(b.date, x.start, now) : false
  })
}

/** The first day from `from` on that is not a day off and has at least one office hour (even one already started). */
export function firstOfficeDay(w: World, t: Teacher, from: string, now: Date): string {
  const start = combine(from, '00:00')
  for (let i = 0; i < 120; i++) {
    const date = toISODate(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
    if (!isOff(t, date) && slotRows(w, t, date, now).length > 0) return date
  }
  return from
}
