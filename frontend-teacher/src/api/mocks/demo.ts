// Owner: Subgroup B (Teacher desktop UI). Mock-mode only helpers: the reminder scheduler and the reset button.
// A real backend has no equivalent: the server sends reminders, and there is no "example data".
import { addDays, combine, formatTime, toISODate } from '../../lib/dates'
import { isOff, LEAD_MINUTES, slotRows, disruption, timingOf, upcomingBookings } from '../../lib/rules'
import { delay, pushNote, worldOf } from './actions'
import { ME_STUDENT, ME_TEACHER } from './seed'
import { mutate, resetState } from './store'

/**
 * Simulates the server-side email scheduler. Creates reminder notifications for office hours that start within each
 * person's chosen lead time. Safe to call repeatedly: every reminder has a dedupe key.
 */
export async function runReminders(now: Date = new Date()): Promise<void> {
  mutate((d) => {
    const w = worldOf(d)
    const today = toISODate(now)
    const teacher = w.teachers.find((t) => t.id === ME_TEACHER)
    const minutesUntil = (date: string, start: string) => (combine(date, start).getTime() - now.getTime()) / 60_000

    if (teacher) {
      const lead = LEAD_MINUTES[d.teacherPrefs.lead]
      let todayRows = 0
      let todaySeats = 0
      for (let i = 0; i < 3; i++) {
        const date = toISODate(addDays(now, i))
        if (isOff(teacher, date)) continue
        for (const row of slotRows(w, teacher, date, now)) {
          if (row.taken === 0) continue
          const wait = minutesUntil(date, row.timing.start)
          if (date === today && wait > 0) {
            todayRows += 1
            todaySeats += row.taken
          }
          if (wait > 0 && wait <= lead) {
            pushNote(
              d,
              'teacher',
              `${row.timing.name} starts at ${formatTime(row.timing.start)} with ${row.taken} student${row.taken === 1 ? '' : 's'} booked.`,
              d.teacherPrefs.remind,
              `reminder:${teacher.id}:${date}:${row.timing.id}:${d.teacherPrefs.lead}`,
            )
          }
        }
      }
      if (todayRows > 0) {
        pushNote(
          d,
          'teacher',
          `Today: ${todayRows} office hour${todayRows === 1 ? '' : 's'} still to come, ${todaySeats} seat${todaySeats === 1 ? '' : 's'} booked.`,
          d.teacherPrefs.morning,
          `morning:${today}`,
        )
      }
    }

    const lead = LEAD_MINUTES[d.studentPrefs.lead]
    for (const b of upcomingBookings(w, (x) => x.studentId === ME_STUDENT, now)) {
      const x = timingOf(w, b)
      const t = w.teachers.find((y) => y.id === b.teacherId)
      if (!x || !t || disruption(w, b)) continue
      const wait = minutesUntil(b.date, x.start)
      if (wait <= 0 || wait > lead) continue
      pushNote(
        d,
        'student',
        `Reminder: ${t.name}’s ${x.name} starts at ${formatTime(x.start)}. You have Seat ${b.seat}.`,
        d.studentPrefs.remind,
        `reminder:${b.id}:${d.studentPrefs.lead}`,
      )
    }
  })
}

/** Puts the original example data back. Keeps the person signed in. */
export async function resetExample(): Promise<void> {
  await delay()
  resetState()
}
