// Shared: changes need a PR note and a teammate review.
// Purpose: Teacher types mirroring the PLANNED API shapes in docs/api-contract.md.
// Dates are "YYYY-MM-DD" and times are "HH:MM" (24h), both in the school's local time.

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri'
export type TimingId = 'first' | 'second'

export interface Timing {
  id: TimingId
  name: string
  start: string
  end: string
  days: Weekday[]
}

export interface Schedule {
  timings: [Timing, Timing]
  seatsPerOfficeHour: number
}

/** One concrete office hour on one date (derived from the schedule). */
export interface Slot {
  id: string
  date: string
  timingId: TimingId
  name: string
  start: string
  end: string
  maxStudents: number
  booked: number
}

export interface Booking {
  id: string
  studentName: string
  reason: string
  date: string
  start: string
  end: string
  /** null when the booking came from an accepted request outside the schedule. */
  slotId: string | null
  timingName: string | null
  createdAt: string
}

export interface BookingRequest {
  id: string
  studentName: string
  reason: string
  date: string
  start: string
  end: string
  createdAt: string
}

export interface DayOff {
  id: string
  date: string
  reason: string
}

export interface DayOffPreview {
  date: string
  affectedBookings: number
}

export interface ReminderPrefs {
  beforeOfficeHour: boolean
  studentBooks: boolean
  studentCancels: boolean
  studentRequests: boolean
  morningSummary: boolean
  /** Minutes before the office hour: 30, 60 or 1440. */
  leadMinutes: number
}

export interface TeacherProfile {
  name: string
  subject: string
  email: string
}

export interface TeacherSettings {
  profile: TeacherProfile
  prefs: ReminderPrefs
}

export type NotificationType = 'booking' | 'cancellation' | 'request' | 'reminder'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  body: string
  createdAt: string
  read: boolean
  /** Dedupe key for generated reminders. */
  key?: string
}

export type WarningKind = 'over_capacity' | 'unscheduled'

/** Raised when a schedule change leaves existing bookings in an odd state. Bookings are never deleted. */
export interface ScheduleWarning {
  kind: WarningKind
  date: string
  timingName: string
  booked: number
  max: number
}

export interface ScheduleView {
  schedule: Schedule
  warnings: ScheduleWarning[]
}

export type RuleCode =
  | 'past'
  | 'day_off'
  | 'full'
  | 'no_office_hour'
  | 'duplicate_day_off'
  | 'invalid'
