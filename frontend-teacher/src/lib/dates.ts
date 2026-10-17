// Shared: changes need a PR note and a teammate review.
// Purpose: pure date/time helpers (local time, "YYYY-MM-DD" and "HH:MM" strings). No React.
import type { Weekday } from '../types'

const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri']

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
}

export const WEEKDAY_ORDER = WEEKDAYS

const pad = (n: number) => String(n).padStart(2, '0')

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  return toISODate(parseISODate(s)) === s
}

export function addDays(d: Date, n: number): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + n)
  return next
}

/** Monday of the week that contains `d`. */
export function startOfWeek(d: Date): Date {
  const day = (d.getDay() + 6) % 7
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day)
}

/** "mon".."fri", or null on weekends. */
export function weekdayOf(date: string): Weekday | null {
  const idx = (parseISODate(date).getDay() + 6) % 7
  return idx < 5 ? WEEKDAYS[idx] : null
}

/** Date + "HH:MM" as a local Date. */
export function combine(date: string, time: string): Date {
  const [h, m] = time.split(':').map(Number)
  const d = parseISODate(date)
  d.setHours(h, m, 0, 0)
  return d
}

export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${pad(m)} ${suffix}`
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`
}

export function formatDateLong(date: string): string {
  return parseISODate(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export function formatDateShort(date: string): string {
  return parseISODate(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function formatMonth(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function shortWeekday(date: string): string {
  return parseISODate(date).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
}

export function shortMonth(date: string): string {
  return parseISODate(date).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
}

export function dayOfMonth(date: string): number {
  return parseISODate(date).getDate()
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}
