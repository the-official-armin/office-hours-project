// Shared: changes need a PR note and a teammate review.
// Purpose: pure date/time helpers (local time, "YYYY-MM-DD" and "HH:MM" strings). No React.

export const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

/** Monday of the week that contains `d`. */
export function startOfWeek(d: Date): Date {
  return addDays(d, -((d.getDay() + 6) % 7))
}

/** JavaScript weekday of a date key: 0 = Sunday ... 6 = Saturday. */
export function dowOf(date: string): number {
  return parseISODate(date).getDay()
}

/** Date + "HH:MM" as a local Date. */
export function combine(date: string, time: string): Date {
  const [h, m] = time.split(':').map(Number)
  const d = parseISODate(date)
  d.setHours(h, m, 0, 0)
  return d
}

/** "12:10 PM" */
export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? 'PM' : 'AM'}`
}

/** "12:10 – 12:40 PM" (drops the first AM/PM when both match). */
export function formatRange(start: string, end: string): string {
  const a = formatTime(start)
  const b = formatTime(end)
  return `${a.slice(-2) === b.slice(-2) ? a.replace(/ [AP]M$/, '') : a} – ${b}`
}

/** "Thursday, October 15" */
export function formatDateLong(date: string): string {
  const d = parseISODate(date)
  return `${DOW_LONG[d.getDay()]}, ${MONTH_LONG[d.getMonth()]} ${d.getDate()}`
}

/** "Thu, Oct 15" */
export function formatDateShort(date: string): string {
  const d = parseISODate(date)
  return `${DOW_SHORT[d.getDay()]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`
}

/** "Oct 15" */
export function formatMonthDay(date: string): string {
  const d = parseISODate(date)
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`
}

/** "October 2026" */
export function formatMonth(year: number, month: number): string {
  return `${MONTH_LONG[month]} ${year}`
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
