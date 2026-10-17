// Owner: Subgroup B (Teacher desktop UI). Seed data for the local demo, generated relative to "now".
import type { AppNotification, Booking, BookingRequest, DayOff, ReminderPrefs, Schedule, TeacherProfile } from '../../types'
import { addDays, parseISODate, toISODate, weekdayOf } from '../../lib/dates'
import { slotId } from './bookingRules'

export const STORAGE_VERSION = 1

export interface DemoState {
  version: number
  loggedIn: boolean
  profile: TeacherProfile
  prefs: ReminderPrefs
  schedule: Schedule
  daysOff: DayOff[]
  bookings: Booking[]
  requests: BookingRequest[]
  notifications: AppNotification[]
  seq: number
}

export const DEFAULT_SEATS = 4

export function seedState(now: Date, loggedIn = false): DemoState {
  const schedule: Schedule = {
    seatsPerOfficeHour: DEFAULT_SEATS,
    timings: [
      { id: 'first', name: 'Lunch', start: '12:10', end: '12:40', days: ['tue', 'thu'] },
      { id: 'second', name: 'After school', start: '15:30', end: '16:00', days: ['tue', 'thu'] },
    ],
  }

  const today = toISODate(now)
  const teachingDates: string[] = []
  for (let i = 1; i <= 42; i++) {
    const date = toISODate(addDays(parseISODate(today), i))
    const wd = weekdayOf(date)
    if (wd === 'tue' || wd === 'thu') teachingDates.push(date)
  }

  let seq = 1
  const names = ['Maya K.', 'Daniel O.', 'Priya S.', 'Ethan W.', 'Lena R.', 'Omar H.', 'Grace T.', 'Noah B.']
  const reasons = [
    'Review homework problems 12-18.',
    'Questions on the graphing project rubric.',
    'Not sure how to start the word problems.',
    'Wants feedback on his test corrections.',
    'Needs help with the study guide.',
    'Going over last quiz mistakes.',
  ]
  let n = 0
  const bookings: Booking[] = []
  const book = (date: string, timingId: 'first' | 'second', count: number) => {
    const t = schedule.timings.find((x) => x.id === timingId)!
    for (let i = 0; i < count; i++, n++) {
      bookings.push({
        id: `b${seq++}`,
        studentName: names[n % names.length],
        reason: reasons[n % reasons.length],
        date,
        start: t.start,
        end: t.end,
        slotId: slotId(date, timingId),
        timingName: t.name,
        createdAt: now.toISOString(),
      })
    }
  }

  const [d0, d1, d2, d3] = teachingDates
  book(d0, 'first', 3)
  book(d0, 'second', 1)
  book(d1, 'first', 2)
  book(d2, 'second', 1) // this date becomes the seeded day off: "1 booking affected"
  book(d3, 'first', DEFAULT_SEATS) // a full office hour, handy for showing the "full" rule

  const daysOff: DayOff[] = [{ id: `d${seq++}`, date: d2, reason: 'Parent conference day' }]

  const requestDates: string[] = []
  for (let i = 1; requestDates.length < 3 && i < 21; i++) {
    const date = toISODate(addDays(parseISODate(today), i))
    if (weekdayOf(date) && date !== d2) requestDates.push(date)
  }
  const requestSeeds = [
    { studentName: 'Aiden P.', reason: 'Wants to go over the unit test he missed before the make-up date.', start: '15:45', end: '16:15' },
    { studentName: 'Sofia L.', reason: 'Stuck on geometry proofs and needs more time than a lunch slot.', start: '12:15', end: '12:45' },
    { studentName: 'Marcus T.', reason: 'Wants to plan a retake of last quiz.', start: '15:30', end: '16:00' },
  ]
  const requests: BookingRequest[] = requestSeeds.map((r, i) => ({
    id: `r${seq++}`,
    date: requestDates[i],
    createdAt: now.toISOString(),
    ...r,
  }))

  return {
    version: STORAGE_VERSION,
    loggedIn,
    profile: { name: 'Ms. Rivera', subject: 'Mathematics', email: 'teacher@demo.school' },
    prefs: {
      beforeOfficeHour: true,
      studentBooks: true,
      studentCancels: true,
      studentRequests: true,
      morningSummary: false,
      leadMinutes: 60,
    },
    schedule,
    daysOff,
    bookings,
    requests,
    notifications: [],
    seq,
  }
}
