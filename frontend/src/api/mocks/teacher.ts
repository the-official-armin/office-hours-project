// Owner: Subgroup B (Teacher desktop UI). Mock data used when VITE_USE_MOCKS is true.
import type { DayOff, OfficeHourSlot, TeacherBooking, TeacherProfile } from '../../types/teacher'

export const mockProfile: TeacherProfile = {
  id: 1,
  name: 'Ms. Example',
  email: 'teacher@example.com',
  emailReminders: true,
  reminderLeadMinutes: 60,
  defaultMaxStudents: 3,
}

export const mockSlots: OfficeHourSlot[] = [
  { id: 1, weekday: 'mon', option: 'A', startTime: '15:30', endTime: '16:30', maxStudents: 3 },
  { id: 2, weekday: 'wed', option: 'A', startTime: '12:00', endTime: '12:45', maxStudents: 2 },
  { id: 3, weekday: 'wed', option: 'B', startTime: '15:30', endTime: '16:30', maxStudents: 3 },
  { id: 4, weekday: 'fri', option: 'A', startTime: '08:00', endTime: '08:45', maxStudents: 4 },
]

export const mockDaysOff: DayOff[] = [
  { id: 1, date: '2026-11-27', note: 'Thanksgiving break' },
  { id: 2, date: '2026-12-21' },
]

export const mockBookings: TeacherBooking[] = [
  { id: 1, studentName: 'Alex Kim', date: '2026-10-19', startTime: '15:30', endTime: '16:00', reasonSummary: 'Help with problem set 4', status: 'confirmed' },
  { id: 2, studentName: 'Jordan Lee', date: '2026-10-21', startTime: '12:00', endTime: '12:30', reasonSummary: 'Essay feedback', status: 'pending' },
  { id: 3, studentName: 'Sam Patel', date: '2026-10-23', startTime: '08:00', endTime: '08:30', reasonSummary: 'Missed quiz makeup', status: 'pending' },
]
