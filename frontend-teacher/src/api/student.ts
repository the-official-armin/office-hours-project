// Owner: Subgroup B (Teacher desktop UI). The ONLY way Student pages reach data (same pattern as teacher.ts).
// VITE_USE_MOCKS=true (default) answers from the local mock store; false calls the real backend.
// Paths follow backend/README.md (the source of truth). The backend enforces every rule in src/lib/rules.ts.
import type { Booking, BookingRequest, CalendarData, Note, StudentSettings, Teacher } from '../types'
import { guardMock } from '../auth/guardMock'
import { calendarInRange } from '../lib/studentCalendar'
import { USE_MOCKS, request } from './client'
import { mockStudentApi, type BookSpotInput, type SendRequestInput } from './mocks/mockStudent'

export type { BookSpotInput, SendRequestInput }

export interface StudentApi {
  getTeachers(): Promise<Teacher[]>
  /** Every confirmed booking of every teacher with other students' names and reasons removed (to count spots). */
  getSpotBookings(): Promise<Booking[]>
  /** This student's bookings, every status. */
  getBookings(): Promise<Booking[]>
  getRequests(): Promise<BookingRequest[]>
  /** This student's bookings (every status) and requests between two dates, inclusive, across all teachers. */
  getCalendar(from: string, to: string): Promise<CalendarData>
  /** Books one spot in an office hour. There is no seat number. */
  bookSpot(input: BookSpotInput): Promise<Booking>
  cancelBooking(id: string): Promise<void>
  sendRequest(input: SendRequestInput): Promise<BookingRequest>
  cancelRequest(id: string): Promise<void>
  getSettings(): Promise<StudentSettings>
  saveSettings(input: StudentSettings): Promise<StudentSettings>
  getNotes(): Promise<Note[]>
  markNotesRead(): Promise<void>
}

const body = (value: unknown): RequestInit => ({ body: JSON.stringify(value) })

// Shared resources take ?view=student (or ?view=open for the anonymous occupancy list); settings sit under /student.
export const realStudentApi: StudentApi = {
  getTeachers: () => request('/teachers'),
  getSpotBookings: () => request('/bookings?view=open'),
  getBookings: () => request('/bookings?view=student'),
  getRequests: () => request('/requests?view=student'),
  // The backend has no date-range query yet, so ask for this student's lists and cut them to the range here.
  getCalendar: async (from, to) => {
    const [bookings, requests] = await Promise.all([
      request<Booking[]>('/bookings?view=student'),
      request<BookingRequest[]>('/requests?view=student'),
    ])
    return calendarInRange(bookings, requests, from, to)
  },
  bookSpot: (input) => request('/bookings', { method: 'POST', ...body(input) }),
  cancelBooking: (id) => request(`/bookings/${id}`, { method: 'DELETE' }),
  sendRequest: (input) => request('/requests', { method: 'POST', ...body(input) }),
  cancelRequest: (id) => request(`/requests/${id}`, { method: 'DELETE' }),
  getSettings: () => request('/student/settings'),
  saveSettings: (input) => request('/student/settings', { method: 'PUT', ...body(input) }),
  getNotes: () => request('/notifications?view=student'),
  markNotesRead: () => request('/notifications/read-all?view=student', { method: 'POST' }),
}

export const studentApi: StudentApi = USE_MOCKS ? guardMock(mockStudentApi) : realStudentApi
