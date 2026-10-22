// Shared: changes need a PR note and a teammate review.
// Purpose: pure logic for the Week / Month / Quarter calendar (shared by both roles). No React.
import { addDays, DOW_SHORT, formatMonth, parseISODate, toISODate } from './dates'

export type CalView = 'week' | 'month' | 'quarter'

export interface MonthRef {
  y: number
  /** 0 = January. */
  m: number
}

export interface CalState {
  view: CalView
  /** Monday of the shown week. */
  wk: string
  /** The shown month (the first month of the quarter in quarter view). */
  month: MonthRef
  /** The selected day, or null. */
  sel: string | null
}

export const CAL_VIEWS: { id: CalView; label: string }[] = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'quarter', label: 'Quarter' },
]

export const monthOf = (date: string): MonthRef => {
  const d = parseISODate(date)
  return { y: d.getFullYear(), m: d.getMonth() }
}

export const shiftMonth = (mo: MonthRef, n: number): MonthRef => {
  const d = new Date(mo.y, mo.m + n, 1)
  return { y: d.getFullYear(), m: d.getMonth() }
}

/** Monday of the school week a day belongs to. A weekend jumps to the coming week. */
export function mondayOf(date: string): string {
  const d = parseISODate(date)
  const w = d.getDay()
  return toISODate(w === 0 ? addDays(d, 1) : w === 6 ? addDays(d, 2) : addDays(d, -(w - 1)))
}

export function initialCal(today: string, selected: string | null = null): CalState {
  return { view: 'month', wk: mondayOf(today), month: monthOf(today), sel: selected }
}

/** First and last date shown for the current view. */
export function calRange(c: CalState): [string, string] {
  if (c.view === 'week') return [c.wk, toISODate(addDays(parseISODate(c.wk), 4))]
  const n = c.view === 'quarter' ? 3 : 1
  return [toISODate(new Date(c.month.y, c.month.m, 1)), toISODate(new Date(c.month.y, c.month.m + n, 0))]
}

/** Switch scale and keep the selected (or today's) day in view. Returns a new state. */
export function calSetView(c: CalState, view: CalView, today: string): CalState {
  if (view === c.view) return c
  const [from, to] = calRange(c)
  const seen = c.sel !== null && c.sel >= from && c.sel <= to
  const next = { ...c, view }
  if (view === 'week') {
    const anchor = seen ? c.sel! : today >= from && today <= to ? today : from
    next.wk = mondayOf(anchor)
  } else if (c.view === 'week') {
    next.month = monthOf(seen ? c.sel! : toISODate(addDays(parseISODate(c.wk), 2)))
  }
  return next
}

/** Previous / next: one week, one month or three months. */
export function calNav(c: CalState, n: number): CalState {
  if (c.view === 'week') return { ...c, wk: toISODate(addDays(parseISODate(c.wk), 7 * n)) }
  return { ...c, month: shiftMonth(c.month, c.view === 'quarter' ? 3 * n : n) }
}

/** "Oct 19 – 23, 2026", "October 2026" or "Oct – Dec 2026". */
export function calLabel(c: CalState): string {
  const short = (d: Date) => DOW_MONTHS[d.getMonth()]
  if (c.view === 'week') {
    const a = parseISODate(c.wk)
    const b = addDays(a, 4)
    return a.getMonth() === b.getMonth()
      ? `${short(a)} ${a.getDate()} – ${b.getDate()}, ${b.getFullYear()}`
      : `${short(a)} ${a.getDate()} – ${short(b)} ${b.getDate()}, ${b.getFullYear()}`
  }
  if (c.view === 'month') return formatMonth(c.month.y, c.month.m)
  const end = shiftMonth(c.month, 2)
  const a = DOW_MONTHS[c.month.m]
  const b = DOW_MONTHS[end.m]
  return end.y === c.month.y ? `${a} – ${b} ${end.y}` : `${a} ${c.month.y} – ${b} ${end.y}`
}

const DOW_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** The Mon-Fri rows that cover a month, including leading and trailing days of neighbouring months. */
export function monthWeeks(y: number, m: number): string[][] {
  const first = new Date(y, m, 1)
  const last = new Date(y, m + 1, 0)
  let d = addDays(first, -((first.getDay() + 6) % 7))
  const weeks: string[][] = []
  while (d <= last) {
    const week = [0, 1, 2, 3, 4].map((i) => toISODate(addDays(d, i)))
    if (week.some((k) => parseISODate(k).getMonth() === m)) weeks.push(week)
    d = addDays(d, 7)
  }
  return weeks
}

/** The five days of the shown week. */
export const weekDays = (wk: string): string[] => [0, 1, 2, 3, 4].map((i) => toISODate(addDays(parseISODate(wk), i)))

/** Mon-Fri column headings: "Mon" ... "Fri". */
export const WEEKDAY_HEADINGS = DOW_SHORT.slice(1, 6)
