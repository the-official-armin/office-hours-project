// Owner: Subgroup B (Teacher desktop UI). Typed Teacher API functions; serve mocks when USE_MOCKS is true.
// Endpoints are PROPOSED (see docs/api-contract.md); the backend team confirms them.
// The backend enforces booking rules. The client only pre-validates for display.
import type { DayOff, OfficeHourSlot, TeacherBooking, TeacherProfile } from '../types/teacher'
import { USE_MOCKS, request } from './client'
import { mockBookings, mockDaysOff, mockProfile, mockSlots } from './mocks/teacher'

export function getTeacherProfile(): Promise<TeacherProfile> {
  return USE_MOCKS ? Promise.resolve(mockProfile) : request('/teachers/me')
}

export function getOfficeHourSlots(): Promise<OfficeHourSlot[]> {
  return USE_MOCKS ? Promise.resolve(mockSlots) : request('/teachers/me/office-hours')
}

export function getDaysOff(): Promise<DayOff[]> {
  return USE_MOCKS ? Promise.resolve(mockDaysOff) : request('/teachers/me/days-off')
}

export function getTeacherBookings(): Promise<TeacherBooking[]> {
  return USE_MOCKS ? Promise.resolve(mockBookings) : request('/teachers/me/bookings')
}
