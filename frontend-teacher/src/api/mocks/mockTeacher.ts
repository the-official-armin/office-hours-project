// Owner: Subgroup B (Teacher desktop UI). Local implementation of the Teacher API, backed by store.ts.
// Same function names and signatures as the real client in ../teacher.ts so a backend can replace it.
// The signed-in teacher in mock mode is whoever signed in (identity.ts).
import type {
  Booking,
  BookingRequest,
  DayOff,
  HoursInput,
  Note,
  Teacher,
  TeacherSettings,
} from '../../types'
import { formatDateLong, formatDateShort, formatTime } from '../../lib/dates'
import {
  affectedOn,
  applyTimings,
  checkAccept,
  checkDayOff,
  checkHours,
  findTeacher,
  hoursNotices,
  orphanedBookings,
} from '../../lib/rules'
import { RuleError } from '../errors'
import { assertOk, delay, pushNote, studentPrefsOf, teacherPrefsOf, worldOf } from './actions'
import { meTeacher } from './identity'
import type { DemoState } from './seed'
import { getState, mutate } from './store'

const me = (d: DemoState): Teacher => {
  const t = findTeacher(worldOf(d), meTeacher())
  if (!t) throw new RuleError('not_found', 'Teacher not found.')
  return t
}

const byDateTime = <T extends { date: string }>(a: T & { time?: string }, b: T & { time?: string }) =>
  (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? ''))

export const mockTeacherApi = {
  async getTeacher(): Promise<Teacher> {
    await delay()
    return me(getState())
  },

  async getSettings(): Promise<TeacherSettings> {
    await delay()
    const d = getState()
    const t = me(d)
    return { name: t.name, subject: t.subject, ...teacherPrefsOf(d, t.id) }
  },

  async saveSettings(input: TeacherSettings): Promise<TeacherSettings> {
    await delay()
    const name = input.name.trim()
    if (!name) throw new RuleError('invalid', 'Enter a name first.')
    if (input.email.trim() && !/^\S+@\S+\.\S+$/.test(input.email.trim())) {
      throw new RuleError('invalid', 'Enter a valid email address.')
    }
    return mutate((d) => {
      const t = me(d)
      t.name = name
      t.subject = input.subject.trim()
      const { name: _n, subject: _s, ...prefs } = input
      d.teacherPrefs[t.id] = { ...prefs, email: prefs.email.trim() }
      return { name: t.name, subject: t.subject, ...d.teacherPrefs[t.id] }
    })
  },

  async getBookings(): Promise<Booking[]> {
    await delay()
    return getState().bookings.filter((b) => b.teacherId === meTeacher())
  },

  async getRequests(): Promise<BookingRequest[]> {
    await delay()
    return getState()
      .requests.filter((r) => r.teacherId === meTeacher())
      .sort(byDateTime)
  },

  /**
   * Saves the timings and seats. Existing bookings are kept, never deleted. Students whose booking no longer matches
   * (moved, no longer held, removed) are told. `orphaned` is how many upcoming bookings no longer match an office hour.
   */
  async saveHours(input: HoursInput): Promise<{ orphaned: number }> {
    await delay()
    return mutate((d) => {
      const now = new Date()
      assertOk(checkHours(worldOf(d), meTeacher(), input, now))
      const orphaned = orphanedBookings(worldOf(d), meTeacher(), input.timings, now).length
      const notices = hoursNotices(worldOf(d), meTeacher(), input.timings, now)
      const t = me(d)
      t.timings = applyTimings(t.timings, input.timings)
      t.max = input.max
      for (const n of notices) pushNote(d, n.studentId, n.text, studentPrefsOf(d, n.studentId).out)
      return { orphaned }
    })
  },

  /** A day off is allowed even when bookings exist; they are kept and `affected` says how many. */
  async addDayOff(input: { date: string; reason: string }): Promise<{ dayOff: DayOff; affected: number }> {
    await delay()
    return mutate((d) => {
      const now = new Date()
      const t = me(d)
      assertOk(checkDayOff(t, input.date, now))
      const affected = affectedOn(worldOf(d), meTeacher(), input.date, now)
      const dayOff: DayOff = { date: input.date, reason: input.reason.trim() || 'Day off' }
      t.daysOff = [...t.daysOff, dayOff].sort((a, b) => a.date.localeCompare(b.date))
      for (const b of affected) {
        pushNote(
          d,
          b.studentId,
          `${t.name} is out on ${formatDateLong(input.date)}. Cancel your booking and pick another time.`,
          studentPrefsOf(d, b.studentId).out,
        )
      }
      return { dayOff, affected: affected.length }
    })
  },

  async removeDayOff(date: string): Promise<void> {
    await delay()
    mutate((d) => {
      const now = new Date()
      const t = me(d)
      if (!t.daysOff.some((x) => x.date === date)) throw new RuleError('not_found', 'That day off no longer exists.')
      t.daysOff = t.daysOff.filter((x) => x.date !== date)
      for (const b of affectedOn(worldOf(d), t.id, date, now)) {
        pushNote(d, b.studentId, `${t.name} is back on ${formatDateLong(date)}. Your booking is on again.`, studentPrefsOf(d, b.studentId).out)
      }
    })
  },

  /** Accepting agrees to the requested time (it does not create a seat). It is refused if that time has passed or is a day off. */
  async answerRequest(id: string, answer: 'accepted' | 'declined'): Promise<BookingRequest> {
    await delay()
    return mutate((d) => {
      const t = me(d)
      const r = d.requests.find((x) => x.id === id && x.teacherId === meTeacher() && x.status === 'pending')
      if (!r) throw new RuleError('not_found', 'That request was already answered.')
      if (answer === 'accepted') assertOk(checkAccept(worldOf(d), r, new Date()))
      r.status = answer
      r.note = `${t.name} ${answer === 'accepted' ? 'accepted' : 'declined'} this time.`
      pushNote(
        d,
        r.studentId,
        `${t.name} ${answer === 'accepted' ? 'accepted' : 'declined'} your request for ${formatDateShort(r.date)} at ${formatTime(r.time)}.`,
        studentPrefsOf(d, r.studentId).answer,
      )
      return { ...r }
    })
  },

  async getNotes(): Promise<Note[]> {
    await delay()
    return getState().notes[meTeacher()] ?? []
  },

  async markNotesRead(): Promise<void> {
    await delay()
    mutate((d) => {
      const id = meTeacher()
      d.notes[id] = (d.notes[id] ?? []).map((n) => ({ ...n, read: true }))
    })
  },
}
