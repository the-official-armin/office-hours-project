// Shared: changes need a PR note and a teammate review.
// Purpose: small wording helpers for teachers ("Tuesday and Thursday", "Lunch 12:10 – 12:40 PM"). No React.
import type { Teacher } from '../types'
import { DOW_LONG, formatRange } from './dates'

/** The weekdays a teacher holds office hours, as a sentence: "Tuesday, Wednesday and Friday". */
export function daysText(t: Teacher): string {
  const set = new Set<number>()
  for (const x of t.timings) for (const d of x.days) set.add(d)
  const names = [1, 2, 3, 4, 5].filter((d) => set.has(d)).map((d) => DOW_LONG[d])
  if (names.length === 0) return 'No days set'
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** "Lunch 12:10 – 12:40 PM · After school 3:30 – 4:00 PM", earliest first, removed timings left out. */
export function timesText(t: Teacher): string {
  return t.timings
    .filter((x) => !x.gone)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((x) => `${x.name} ${formatRange(x.start, x.end)}`)
    .join(' \u00b7 ')
}

/** Initials without the title: "Dr. Lindqvist" -> "L", "Ms. Rivera" -> "R". */
export function teacherInitial(name: string): string {
  return name
    .replace(/^(Ms|Mr|Dr|Mrs)\.\s+/, '')
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
