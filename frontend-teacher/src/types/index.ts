// Shared: changes need a PR note and a teammate review.
// Purpose: the one source of types. They mirror the PLANNED API shapes in docs/api-contract.md.
// Dates are "YYYY-MM-DD" and times are "HH:MM" (24h), both in the school's local time.

export type Role = 'student' | 'teacher'

/** Weekday as JavaScript numbers it: 1 = Monday ... 5 = Friday. */
export type Dow = 1 | 2 | 3 | 4 | 5

export interface Timing {
  id: string
  name: string
  start: string
  end: string
  days: Dow[]
  /**
   * A timing the teacher removed. It stays on file with no days so existing bookings still know what they were for.
   */
  gone?: boolean
}

export interface DayOff {
  date: string
  reason: string
}

export interface Teacher {
  id: string
  name: string
  subject: string
  /** Subject group, used for the filter pills on "Find a teacher". */
  group: string
  /** Seats per office hour, 1-30. */
  max: number
  timings: Timing[]
  daysOff: DayOff[]
}

export type BookingStatus = 'confirmed' | 'cancelled'

export interface Booking {
  id: string
  teacherId: string
  date: string
  timingId: string
  seat: number
  studentId: string
  studentName: string
  reason: string
  status: BookingStatus
}

export type RequestStatus = 'pending' | 'accepted' | 'declined'

/** "Request a different time": a student asks for a time outside the teacher's office hours. */
export interface BookingRequest {
  id: string
  teacherId: string
  studentId: string
  studentName: string
  date: string
  time: string
  reason: string
  status: RequestStatus
  /** The teacher's answer, shown to the student. */
  note: string
}

export type ReminderLead = '30 minutes' | '1 hour' | '1 day'

export interface TeacherPrefs {
  email: string
  /** Reminder before each office hour. */
  remind: boolean
  /** A student books a seat. */
  booking: boolean
  /** A student cancels. */
  cancel: boolean
  /** A student sends a request. */
  request: boolean
  /** Morning summary on days with office hours. */
  morning: boolean
  lead: ReminderLead
}

export interface StudentPrefs {
  name: string
  grade: string
  email: string
  /** Reminder before each booked office hour. */
  remind: boolean
  /** Booking confirmations. */
  booked: boolean
  /** The teacher answers a request. */
  answer: boolean
  /** The teacher is out or moves an office hour. */
  out: boolean
  lead: ReminderLead
}

/** What the Teacher Settings page edits: the teacher's own record plus email preferences. */
export interface TeacherSettings extends TeacherPrefs {
  name: string
  subject: string
}

export type StudentSettings = StudentPrefs

export interface Note {
  id: string
  text: string
  /** Epoch milliseconds. */
  at: number
  read: boolean
  /** Dedupe key for generated reminders. */
  key?: string
}

/** What the Office hours editor sends: the timings to keep, and seats per office hour. */
export interface TimingDraft {
  id: string
  name: string
  start: string
  end: string
  days: Dow[]
}

export interface HoursInput {
  timings: TimingDraft[]
  max: number
}

export type RuleCode =
  | 'not_found'
  | 'missing'
  | 'invalid'
  | 'past'
  | 'day_off'
  | 'no_office_hour'
  | 'bad_seat'
  | 'seat_taken'
  | 'already_booked'
  | 'conflict'
  | 'reason'
  | 'duplicate_day_off'
  | 'seat_floor'

/** What the app shell (sidebar, top bar, tab bar) shows. */
export interface ShellData {
  user: { name: string; subtitle: string }
  notes: Note[]
  badges: {
    /** Teacher: open booking requests. */
    requests: number
    /** Student: upcoming bookings flagged as disrupted. */
    disrupted: number
  }
}

export type ShellBadges = ShellData['badges']
