// Owner: Subgroup B (Teacher desktop UI). The ONLY way Teacher pages reach data.
// VITE_USE_MOCKS=true (default) answers from the local demo store; false calls the real backend.
// Endpoints are PROPOSED: see docs/api-contract.md. The backend enforces every booking rule.
import type {
  AppNotification,
  Booking,
  BookingRequest,
  DayOff,
  DayOffPreview,
  ReminderPrefs,
  Schedule,
  ScheduleView,
  Slot,
  TeacherProfile,
  TeacherSettings,
} from '../types'
import { USE_MOCKS, request } from './client'
import { mockTeacherApi } from './mocks/mockTeacher'

export interface TeacherApi {
  getMe(): Promise<TeacherProfile>
  getReminderPrefs(): Promise<ReminderPrefs>
  saveSettings(settings: TeacherSettings): Promise<TeacherSettings>
  getSchedule(): Promise<ScheduleView>
  saveSchedule(schedule: Schedule): Promise<ScheduleView>
  getSlots(from: string, to: string): Promise<Slot[]>
  getBookings(): Promise<Booking[]>
  cancelBooking(id: string): Promise<void>
  getRequests(): Promise<BookingRequest[]>
  acceptRequest(id: string): Promise<Booking>
  declineRequest(id: string): Promise<void>
  getDaysOff(): Promise<DayOff[]>
  previewDayOff(date: string): Promise<DayOffPreview>
  addDayOff(input: { date: string; reason: string }): Promise<DayOff>
  removeDayOff(id: string): Promise<void>
  getNotifications(): Promise<AppNotification[]>
  markAllNotificationsRead(): Promise<void>
}

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) })

const realTeacherApi: TeacherApi = {
  getMe: () => request('/teacher/me'),
  getReminderPrefs: () => request('/teacher/reminder-prefs'),
  saveSettings: (settings) => request('/teacher/settings', { method: 'PUT', ...json(settings) }),
  getSchedule: () => request('/teacher/schedule'),
  saveSchedule: (schedule) => request('/teacher/schedule', { method: 'PUT', ...json(schedule) }),
  getSlots: (from, to) => request(`/teacher/slots?from=${from}&to=${to}`),
  getBookings: () => request('/teacher/bookings'),
  cancelBooking: (id) => request(`/teacher/bookings/${id}`, { method: 'DELETE' }),
  getRequests: () => request('/teacher/requests'),
  acceptRequest: (id) => request(`/teacher/requests/${id}/accept`, { method: 'POST' }),
  declineRequest: (id) => request(`/teacher/requests/${id}/decline`, { method: 'POST' }),
  getDaysOff: () => request('/teacher/days-off'),
  previewDayOff: (date) => request(`/teacher/days-off/preview?date=${date}`),
  addDayOff: (input) => request('/teacher/days-off', { method: 'POST', ...json(input) }),
  removeDayOff: (id) => request(`/teacher/days-off/${id}`, { method: 'DELETE' }),
  getNotifications: () => request('/teacher/notifications'),
  markAllNotificationsRead: () => request('/teacher/notifications/read-all', { method: 'POST' }),
}

export const teacherApi: TeacherApi = USE_MOCKS ? mockTeacherApi : realTeacherApi

export { USE_MOCKS }
