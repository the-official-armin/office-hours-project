// Shared: changes need a PR note and a teammate review.
// Purpose: what the student calendar shows. Turns a student's bookings and requests (across all teachers) into day items,
// with their look (kind), flag text, and the short labels used on phones. Pure: no React, "now" is passed in.
import type { Booking, BookingRequest, CalendarData, Teacher } from '../types'
import type { MiniStatus } from '../components/common/Calendar'
import { combine, formatRange, formatTime, formatTimeShort } from './dates'
import { DISRUPT_TEXT, disruption, findTeacher, hasStarted, timingOf } from './rules'
import { teacherInitial } from './text'

/**
 * booking: a confirmed upcoming booking. disrupted: a booking the teacher's day off or schedule change affected.
 * pending / accepted: a request for a different time. past: already happened or already started.
 * cancelled: a cancelled booking (struck through).
 */
export type ItemKind = 'booking' | 'disrupted' | 'pending' | 'accepted' | 'past' | 'cancelled'

export interface CalItem {
  id: string
  source: 'booking' | 'request'
  kind: ItemKind
  date: string
  /** "HH:MM" */
  start: string
  end: string | null
  teacherId: string
  teacherName: string
  subject: string
  initial: string
  timingName: string | null
  reason: string
  /** "Teacher is out that day" or "This office hour was moved", for a disrupted booking. */
  flag: string | null
  /** The answer a teacher gave to a request. */
  note: string
  /** The booking or request can still be cancelled by the student. */
  cancellable: boolean
  /** One line for a block: "12:10 – 12:40 PM" or "3:45 PM". */
  time: string
}

export const KIND_LABEL: Record<ItemKind, string> = {
  booking: 'Booked',
  disrupted: 'Needs attention',
  pending: 'Requested',
  accepted: 'Requested time',
  past: 'Past',
  cancelled: 'Cancelled',
}

const byTime = (a: CalItem, b: CalItem) => (a.date + a.start).localeCompare(b.date + b.start) || a.id.localeCompare(b.id)

/** All items for the student, in date and time order. Declined requests are not shown. */
export function buildItems(bookings: Booking[], requests: BookingRequest[], teachers: Teacher[], now: Date): CalItem[] {
  const world = { teachers, bookings }
  const items: CalItem[] = []

  for (const b of bookings) {
    const t = findTeacher(world, b.teacherId)
    const x = timingOf(world, b)
    if (!t || !x) continue
    const started = hasStarted(b.date, x.start, now)
    const flag = b.status === 'confirmed' && !started ? disruption(world, b) : null
    const kind: ItemKind = b.status === 'cancelled' ? 'cancelled' : started ? 'past' : flag ? 'disrupted' : 'booking'
    items.push({
      id: b.id,
      source: 'booking',
      kind,
      date: b.date,
      start: x.start,
      end: x.end,
      teacherId: t.id,
      teacherName: t.name,
      subject: t.subject,
      initial: teacherInitial(t.name),
      timingName: x.name,
      reason: b.reason,
      flag: flag ? DISRUPT_TEXT[flag] : null,
      note: '',
      cancellable: b.status === 'confirmed' && !started,
      time: formatRange(x.start, x.end),
    })
  }

  for (const r of requests) {
    if (r.status === 'declined') continue
    const t = findTeacher(world, r.teacherId)
    if (!t) continue
    const passed = combine(r.date, r.time) <= now
    const kind: ItemKind = passed ? 'past' : r.status === 'accepted' ? 'accepted' : 'pending'
    items.push({
      id: r.id,
      source: 'request',
      kind,
      date: r.date,
      start: r.time,
      end: null,
      teacherId: t.id,
      teacherName: t.name,
      subject: t.subject,
      initial: teacherInitial(t.name),
      timingName: null,
      reason: r.reason,
      flag: null,
      note: r.note,
      cancellable: r.status === 'pending' && !passed,
      time: formatTime(r.time),
    })
  }

  return items.sort(byTime)
}

export function itemsByDate(items: CalItem[]): Map<string, CalItem[]> {
  const map = new Map<string, CalItem[]>()
  for (const item of items) map.set(item.date, [...(map.get(item.date) ?? []), item])
  return map
}

/** Quarter-view colour for a day. A day with nothing on it is "none" (or "past" once it is over); it stays clickable. */
export function dayStatus(items: CalItem[] | undefined, date: string, today: string): MiniStatus {
  if (!items || items.length === 0) return date < today ? 'past' : 'none'
  if (items.some((i) => i.kind === 'disrupted')) return 'off'
  if (items.some((i) => i.kind === 'booking' || i.kind === 'accepted')) return 'open'
  if (items.every((i) => i.kind === 'past' || i.kind === 'cancelled')) return 'past'
  return 'none'
}

/** Cuts a student's whole booking and request lists down to a date range (inclusive). Used while the backend has no range query. */
export function calendarInRange(bookings: Booking[], requests: BookingRequest[], from: string, to: string): CalendarData {
  const within = (date: string) => date >= from && date <= to
  return { bookings: bookings.filter((b) => within(b.date)), requests: requests.filter((r) => within(r.date)) }
}

/** A dot on days with a booking (not a cancelled one). A request on its own does not get a dot. */
export const hasBookingDot = (items: CalItem[] | undefined): boolean =>
  !!items && items.some((i) => i.source === 'booking' && i.kind !== 'cancelled')

/** Month chip on a desktop: "Ms. Rivera · 12:10". On a phone: "R 12:10". */
export const chipText = (i: CalItem): string => `${i.teacherName} \u00b7 ${formatTimeShort(i.start)}`
export const tinyText = (i: CalItem): string => `${i.initial} ${formatTimeShort(i.start)}`

/** The key shown under a phone month: "R = Ms. Rivera, O = Mr. Okafor", for the teachers on screen. */
export function teacherKey(items: CalItem[]): string {
  const seen = new Map<string, string>()
  for (const i of items) if (!seen.has(i.teacherId)) seen.set(i.teacherId, `${i.initial} = ${i.teacherName}`)
  return [...seen.entries()]
    .sort((x, y) => x[1].split(' = ')[1].localeCompare(y[1].split(' = ')[1]))
    .map(([, text]) => text)
    .join(', ')
}

/** What a screen reader hears for a day: "Thursday, October 15, 2 items: Ms. Rivera Lunch, Pending request with Mr. Okafor". */
export function itemSpoken(i: CalItem): string {
  if (i.source === 'request') return `${i.kind === 'pending' ? 'pending request' : 'request'} with ${i.teacherName} at ${i.time}`
  return `${i.teacherName} ${i.timingName ?? ''}${i.kind === 'cancelled' ? ', cancelled' : ''}${i.flag ? `, ${i.flag.toLowerCase()}` : ''}`.trim()
}
