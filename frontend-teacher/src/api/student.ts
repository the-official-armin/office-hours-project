// Owner: Subgroup B (Teacher desktop UI). The ONLY way Student pages reach data (same pattern as teacher.ts).
// VITE_USE_MOCKS=true (default) answers from the local mock store; false calls the real backend.
// Endpoints are PROPOSED: see docs/api-contract.md. The backend enforces every rule in src/lib/rules.ts.
import type { Booking, BookingRequest, Note, StudentSettings, Teacher } from '../types'
import { USE_MOCKS, request } from './client'
import { mockStudentApi, type BookSeatInput, type SendRequestInput } from './mocks/mockStudent'

export type { BookSeatInput, SendRequestInput }

export interface StudentApi {
  getTeachers(): Promise<Teacher[]>
  /** Every confirmed booking of every teacher with other students' names and reasons removed (seat counts only). */
  getSeatBookings(): Promise<Booking[]>
  /** This student's bookings, every status. */
  getBookings(): Promise<Booking[]>
  getRequests(): Promise<BookingRequest[]>
  bookSeat(input: BookSeatInput): Promise<Booking>
  cancelBooking(id: string): Promise<void>
  sendRequest(input: SendRequestInput): Promise<BookingRequest>
  cancelRequest(id: string): Promise<void>
  getSettings(): Promise<StudentSettings>
  saveSettings(input: StudentSettings): Promise<StudentSettings>
  getNotes(): Promise<Note[]>
  markNotesRead(): Promise<void>
}

const body = (value: unknown): RequestInit => ({ body: JSON.stringify(value) })

const realStudentApi: StudentApi = {
  getTeachers: () => request('/teachers'),
  getSeatBookings: () => request('/bookings/seats'),
  getBookings: () => request('/student/bookings'),
  getRequests: () => request('/student/requests'),
  bookSeat: (input) => request('/student/bookings', { method: 'POST', ...body(input) }),
  cancelBooking: (id) => request(`/student/bookings/${id}`, { method: 'DELETE' }),
  sendRequest: (input) => request('/student/requests', { method: 'POST', ...body(input) }),
  cancelRequest: (id) => request(`/student/requests/${id}`, { method: 'DELETE' }),
  getSettings: () => request('/student/settings'),
  saveSettings: (input) => request('/student/settings', { method: 'PUT', ...body(input) }),
  getNotes: () => request('/student/notifications'),
  markNotesRead: () => request('/student/notifications/read-all', { method: 'POST' }),
}

export const studentApi: StudentApi = USE_MOCKS ? mockStudentApi : realStudentApi
