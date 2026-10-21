// Owner: Subgroup B (Teacher desktop UI). The ONLY way Teacher pages reach data.
// VITE_USE_MOCKS=true (default) answers from the local mock store; false calls the real backend.
// Endpoints are PROPOSED: see docs/api-contract.md. The backend enforces every rule in src/lib/rules.ts.
import type {
  Booking,
  BookingRequest,
  DayOff,
  HoursInput,
  Note,
  Teacher,
  TeacherSettings,
} from '../types'
import { USE_MOCKS, request } from './client'
import { mockTeacherApi } from './mocks/mockTeacher'

export interface TeacherApi {
  /** The signed-in teacher: name, subject, seats, timings (removed ones have gone=true) and days off. */
  getTeacher(): Promise<Teacher>
  getSettings(): Promise<TeacherSettings>
  saveSettings(input: TeacherSettings): Promise<TeacherSettings>
  /** All of this teacher's bookings, every status. */
  getBookings(): Promise<Booking[]>
  /** All of this teacher's requests, every status. */
  getRequests(): Promise<BookingRequest[]>
  /** Save timings and seats. Bookings are kept; affected students are notified. */
  saveHours(input: HoursInput): Promise<{ orphaned: number }>
  /** Allowed even when bookings exist; they are kept and counted in `affected`. */
  addDayOff(input: { date: string; reason: string }): Promise<{ dayOff: DayOff; affected: number }>
  removeDayOff(date: string): Promise<void>
  answerRequest(id: string, answer: 'accepted' | 'declined'): Promise<BookingRequest>
  getNotes(): Promise<Note[]>
  markNotesRead(): Promise<void>
}

const body = (value: unknown): RequestInit => ({ body: JSON.stringify(value) })

const realTeacherApi: TeacherApi = {
  getTeacher: () => request('/teacher/me'),
  getSettings: () => request('/teacher/settings'),
  saveSettings: (input) => request('/teacher/settings', { method: 'PUT', ...body(input) }),
  getBookings: () => request('/teacher/bookings'),
  getRequests: () => request('/teacher/requests'),
  saveHours: (input) => request('/teacher/office-hours', { method: 'PUT', ...body(input) }),
  addDayOff: (input) => request('/teacher/days-off', { method: 'POST', ...body(input) }),
  removeDayOff: (date) => request(`/teacher/days-off/${date}`, { method: 'DELETE' }),
  answerRequest: (id, answer) =>
    request(`/teacher/requests/${id}/${answer === 'accepted' ? 'accept' : 'decline'}`, { method: 'POST' }),
  getNotes: () => request('/teacher/notifications'),
  markNotesRead: () => request('/teacher/notifications/read-all', { method: 'POST' }),
}

export const teacherApi: TeacherApi = USE_MOCKS ? mockTeacherApi : realTeacherApi

export { USE_MOCKS }
