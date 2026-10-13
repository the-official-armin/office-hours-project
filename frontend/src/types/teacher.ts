// Shared: changes need a PR note and a teammate review.
// Purpose: Teacher types mirroring the PLANNED API shapes in docs/api-contract.md.
// When the backend team finalizes endpoints, update this file to match the contract.

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri'

/** Teacher defines two timing options (A and B) per weekday. Final shape TBD with backend team. */
export type TimingOption = 'A' | 'B'

export interface OfficeHourSlot {
  id: number
  weekday: Weekday
  option: TimingOption
  startTime: string // "HH:MM" 24h
  endTime: string // "HH:MM" 24h
  maxStudents: number
}

export interface DayOff {
  id: number
  date: string // YYYY-MM-DD
  note?: string
}

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled'

export interface TeacherBooking {
  id: number
  studentName: string
  date: string // YYYY-MM-DD
  startTime: string // "HH:MM"
  endTime: string // "HH:MM"
  reasonSummary: string
  status: BookingStatus
}

export interface TeacherProfile {
  id: number
  name: string
  email: string
  emailReminders: boolean
  reminderLeadMinutes: number
  defaultMaxStudents: number
}
