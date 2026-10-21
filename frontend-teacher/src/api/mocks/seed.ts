// Owner: Subgroup B (Teacher desktop UI). Example data for the local mock store, built from today's date so the
// screens are never empty. Ported from seed() in design/reference.
import type {
  Booking,
  BookingRequest,
  Dow,
  Note,
  Role,
  StudentPrefs,
  Teacher,
  TeacherPrefs,
  Timing,
} from '../../types'
import { addDays, formatDateLong, formatDateShort, formatTime, startOfDay, toISODate } from '../../lib/dates'
import { DEFAULT_SEATS } from '../../lib/rules'

export const STORAGE_VERSION = 2

/** The signed-in people in mock mode. */
export const ME_TEACHER = 'rivera'
export const ME_STUDENT = 'maya'

export interface DemoState {
  version: number
  session: Role | null
  teachers: Teacher[]
  bookings: Booking[]
  requests: BookingRequest[]
  notes: Record<Role, Note[]>
  teacherPrefs: TeacherPrefs
  studentPrefs: StudentPrefs
  seq: number
}

const HOUR = 3_600_000

export function seedState(now: Date, session: Role | null = null): DemoState {
  const t0 = startOfDay(now)
  let seq = 100
  const id = (prefix: string) => `${prefix}${++seq}`

  /** The next `n` dates, starting tomorrow, that fall on one of these weekdays. */
  const fwd = (dows: number[], n: number): string[] => {
    const out: string[] = []
    for (let d = addDays(t0, 1); out.length < n; d = addDays(d, 1)) if (dows.includes(d.getDay())) out.push(toISODate(d))
    return out
  }
  /** The previous `n` dates, starting yesterday, that fall on one of these weekdays. */
  const back = (dows: number[], n: number): string[] => {
    const out: string[] = []
    for (let d = addDays(t0, -1); out.length < n; d = addDays(d, -1)) if (dows.includes(d.getDay())) out.push(toISODate(d))
    return out
  }

  const timing = (tid: string, name: string, start: string, end: string, days: Dow[]): Timing => ({
    id: tid,
    name,
    start,
    end,
    days,
  })
  const teacher = (tid: string, name: string, subject: string, group: string, timings: Timing[]): Teacher => ({
    id: tid,
    name,
    subject,
    group,
    max: DEFAULT_SEATS,
    timings,
    daysOff: [],
  })

  const lunch = (days: Dow[]) => timing('lunch', 'Lunch', '12:10', '12:40', days)
  const after = (days: Dow[]) => timing('after', 'After school', '15:30', '16:00', days)
  const teachers: Teacher[] = [
    teacher('rivera', 'Ms. Rivera', 'Mathematics', 'Math', [lunch([2, 4]), after([2, 4])]),
    teacher('okafor', 'Mr. Okafor', 'Chemistry', 'Science', [lunch([2, 5])]),
    teacher('brooks', 'Ms. Brooks', 'Biology', 'Science', [lunch([2, 4])]),
    teacher('lindqvist', 'Dr. Lindqvist', 'English', 'English', [after([2, 5])]),
    teacher('alvarez', 'Ms. Alvarez', 'Spanish', 'Languages', [lunch([3, 4])]),
    teacher('tanaka', 'Mr. Tanaka', 'World History', 'History', [after([1, 3])]),
  ]
  const byId = (tid: string) => teachers.find((t) => t.id === tid)!

  const bookings: Booking[] = []
  const add = (
    teacherId: string,
    date: string,
    timingId: string,
    seat: number,
    studentName: string,
    studentId: string,
    reason: string,
    status: Booking['status'] = 'confirmed',
  ) => bookings.push({ id: id('b'), teacherId, date, timingId, seat, studentName, studentId, reason, status })
  const ME = 'Maya K.'

  /* Ms. Rivera (the teacher view) */
  const riv = fwd([2, 4], 12)
  add('rivera', riv[0], 'lunch', 1, ME, 'maya', 'Review homework problems 12–18.')
  add('rivera', riv[0], 'lunch', 2, 'Daniel O.', 'daniel', 'Questions on the graphing project rubric.')
  add('rivera', riv[0], 'lunch', 3, 'Priya S.', 'priya', 'Not sure how to start the word problems.')
  add('rivera', riv[0], 'after', 2, 'Ethan W.', 'ethan', 'Wants feedback on his test corrections.')
  add('rivera', riv[1], 'lunch', 1, 'Hana B.', 'hana', 'Prep for the unit 3 exam.')
  add('rivera', riv[1], 'lunch', 2, 'Leo M.', 'leo', 'Catch up after missing two classes.')
  add('rivera', riv[2], 'lunch', 1, 'Noor A.', 'noor', 'Check my work on factoring.')
  add('rivera', riv[2], 'lunch', 2, 'Jonas R.', 'jonas', 'Study group review for the quiz.')
  add('rivera', riv[2], 'lunch', 3, 'Zoe T.', 'zoe', 'Retake plan for the last test.')
  add('rivera', riv[2], 'lunch', 4, 'Ines F.', 'ines', 'Confused about slope-intercept form.')
  add('rivera', riv[3], 'lunch', 1, 'Tariq A.', 'tariq', 'Help with the extra credit problem.')
  byId('rivera').daysOff = [
    { date: riv[3], reason: 'Parent conference day' },
    { date: riv[5], reason: 'Field trip' },
    { date: riv[9], reason: 'Holiday break' },
  ]
  // This week's office hours that already happened (today counts), so history is never empty.
  const monday = addDays(t0, -((t0.getDay() + 6) % 7))
  for (let i = 0; i < 5; i++) {
    const d = addDays(monday, i)
    if (d <= t0 && (d.getDay() === 2 || d.getDay() === 4)) {
      const k = toISODate(d)
      add('rivera', k, 'lunch', 1, 'Mia C.', 'mia', 'Help with the homework set.')
      add('rivera', k, 'lunch', 2, 'Omar H.', 'omar', 'Quiz retake planning.')
      add('rivera', k, 'lunch', 3, 'Lena V.', 'lena', 'Check my graphs.')
      add('rivera', k, 'after', 1, 'Sam D.', 'sam', 'Review the unit test.')
    }
  }

  /* other teachers */
  const ok = fwd([2, 5], 6)
  add('okafor', ok[0], 'lunch', 1, 'Daniel O.', 'daniel', 'Lab report questions.')
  add('okafor', ok[0], 'lunch', 2, 'Hana B.', 'hana', 'Review moles and molar mass.')
  add('okafor', ok[1], 'lunch', 1, 'Leo M.', 'leo', 'Catch up on the titration lab.')
  add('okafor', ok[1], 'lunch', 3, ME, 'maya', 'Questions about balancing equations.')
  add('okafor', ok[2], 'lunch', 2, 'Noor A.', 'noor', 'Study for the unit test.')
  const br = fwd([2, 4], 6)
  ;['Jonas R.', 'Zoe T.', 'Ines F.', 'Tariq A.'].forEach((name, i) =>
    add('brooks', br[0], 'lunch', i + 1, name, name.split(' ')[0].toLowerCase(), 'Cell structure review.'),
  )
  add('brooks', br[1], 'lunch', 1, 'Mia C.', 'mia', 'Help with the genetics worksheet.')
  const li = fwd([2, 5], 6)
  add('lindqvist', li[1], 'after', 1, 'Omar H.', 'omar', 'Feedback on my essay draft.')
  const al = fwd([3, 4], 6)
  add('alvarez', al[0], 'lunch', 1, 'Lena V.', 'lena', 'Practice speaking.')
  add('alvarez', al[2], 'lunch', 2, ME, 'maya', 'Practice for the oral exam.')
  byId('alvarez').daysOff = [{ date: al[2], reason: 'Curriculum day' }]
  const ta = fwd([1, 3], 6)
  add('tanaka', ta[1], 'after', 1, 'Sam D.', 'sam', 'Essay outline help.')

  /* Maya's history */
  add('rivera', back([2], 1)[0], 'lunch', 2, ME, 'maya', 'Help with the chapter 3 quiz.')
  add('okafor', back([5], 1)[0], 'lunch', 1, ME, 'maya', 'Lab safety questions.')
  add('lindqvist', back([2, 5], 4)[3], 'after', 3, ME, 'maya', 'Feedback on my essay outline.', 'cancelled')

  const requests: BookingRequest[] = []
  const rq = (
    teacherId: string,
    studentId: string,
    studentName: string,
    date: string,
    time: string,
    reason: string,
    status: BookingRequest['status'],
    note = '',
  ) => requests.push({ id: id('r'), teacherId, studentId, studentName, date, time, reason, status, note })
  rq('rivera', 'aiden', 'Aiden P.', fwd([3], 1)[0], '15:45', 'Wants to go over the unit test he missed before the make-up date.', 'pending')
  rq('rivera', 'sofia', 'Sofia L.', fwd([5], 1)[0], '12:15', 'Stuck on geometry proofs and needs more time than a lunch slot.', 'pending')
  rq('rivera', 'marcus', 'Marcus T.', fwd([1], 1)[0], '15:30', 'Wants to plan a retake of last quiz.', 'pending')
  rq('okafor', 'maya', ME, fwd([5], 1)[0], '15:45', 'Can I get feedback on my lab report draft? None of the lunch seats fit my schedule.', 'pending')
  rq('alvarez', 'maya', ME, back([3], 1)[0], '16:00', 'Extra practice before the vocabulary test.', 'accepted', 'Ms. Alvarez accepted this time.')
  rq('lindqvist', 'maya', ME, back([1], 1)[0], '15:30', 'Talk through my thesis statement.', 'declined', 'Dr. Lindqvist: “I’m out Mondays. Please use Tuesday or Friday.”')

  const nowMs = now.getTime()
  const note = (text: string, hoursAgo: number, read: boolean): Note => ({ id: id('n'), text, at: nowMs - hoursAgo * HOUR, read })
  const notes: Record<Role, Note[]> = {
    student: [
      note(`Ms. Alvarez is out on ${formatDateLong(al[2])}. Cancel your booking and pick another time.`, 2, false),
      note('Ms. Alvarez accepted your request for a different time.', 30, true),
    ],
    teacher: [
      note(`Marcus T. sent a request for ${formatDateShort(fwd([1], 1)[0])} at ${formatTime('15:30')}.`, 1, false),
      note(`Hana B. booked Seat 1 in Lunch on ${formatDateShort(riv[1])}.`, 5, false),
      note(`Sofia L. sent a request for ${formatDateShort(fwd([5], 1)[0])} at ${formatTime('12:15')}.`, 26, true),
    ],
  }

  return {
    version: STORAGE_VERSION,
    session,
    teachers,
    bookings,
    requests,
    notes,
    teacherPrefs: { email: '', remind: true, booking: true, cancel: true, request: true, morning: false, lead: '1 hour' },
    studentPrefs: { name: 'Maya K.', grade: 'Grade 10', email: '', remind: true, booked: true, answer: true, out: true, lead: '1 hour' },
    seq,
  }
}

/** Sanity check used when reading saved data, so a stale or hand-edited blob never crashes the app. */
export function isDemoState(x: unknown): x is DemoState {
  if (!x || typeof x !== 'object') return false
  const s = x as Partial<DemoState>
  return (
    s.version === STORAGE_VERSION &&
    Array.isArray(s.teachers) &&
    Array.isArray(s.bookings) &&
    Array.isArray(s.requests) &&
    !!s.notes &&
    Array.isArray(s.notes.student) &&
    Array.isArray(s.notes.teacher) &&
    !!s.teacherPrefs &&
    !!s.studentPrefs &&
    typeof s.seq === 'number'
  )
}

