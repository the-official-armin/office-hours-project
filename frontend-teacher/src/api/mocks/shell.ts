// Owner: Subgroup B (Teacher desktop UI). Mock shell data for the STUDENT side until the student store exists.
// Phase 2 replaces this with the real shared store. Kept in memory only.
import type { ShellData, ShellNote } from '../../types'
import { addDays, formatDateLong, toISODate, weekdayOf } from '../../lib/dates'

const HOUR = 3_600_000

let notes: ShellNote[] | null = null

/** Third upcoming Wednesday or Thursday, like the reference seed. */
function thirdMidweek(now: Date): string {
  const found: string[] = []
  for (let i = 1; found.length < 3 && i < 60; i++) {
    const key = toISODate(addDays(now, i))
    const wd = weekdayOf(key)
    if (wd === 'wed' || wd === 'thu') found.push(key)
  }
  return found[2]
}

function seedNotes(): ShellNote[] {
  const now = new Date()
  return [
    {
      id: 'n1',
      text: `Ms. Alvarez is out on ${formatDateLong(thirdMidweek(now))}. Cancel your booking and pick another time.`,
      at: now.getTime() - 2 * HOUR,
      read: false,
    },
    {
      id: 'n2',
      text: 'Ms. Alvarez accepted your request for a different time.',
      at: now.getTime() - 30 * HOUR,
      read: true,
    },
  ]
}

export async function getStudentShell(): Promise<ShellData> {
  notes ??= seedNotes()
  return {
    user: { name: 'Maya K.', subtitle: 'Grade 10' },
    notes: notes.map((n) => ({ ...n })),
    badges: { requests: 0, disrupted: 0 },
  }
}

export async function markStudentNotesRead(): Promise<void> {
  notes = (notes ?? seedNotes()).map((n) => ({ ...n, read: true }))
}

export async function resetStudentShell(): Promise<void> {
  notes = seedNotes()
}
