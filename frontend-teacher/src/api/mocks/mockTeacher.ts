// Owner: Subgroup B (Teacher desktop UI). Local implementation of the Teacher API, backed by store.ts.
// Same function names and signatures as the real client in ../teacher.ts so a backend can replace it.
import type {
  AppNotification,
  Booking,
  BookingRequest,
  DayOff,
  DayOffPreview,
  ReminderPrefs,
  ScheduleView,
  Schedule,
  Slot,
  TeacherProfile,
  TeacherSettings,
} from '../../types'
import { formatDateShort, formatTime } from '../../lib/dates'
import { RuleError } from '../errors'
import {
  checkRequestTime,
  countAffectedBookings,
  generateSlots,
  scheduleWarnings,
  validateDayOff,
  validateSchedule,
  type RuleResult,
  type RuleState,
} from './bookingRules'
import { notify } from './notify'
import type { DemoState } from './seed'
import { getState, mutate, nextId } from './store'

export function delay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 150 + Math.random() * 150))
}

export function ruleState(s: DemoState): RuleState {
  return { schedule: s.schedule, daysOff: s.daysOff, bookings: s.bookings }
}

export function assertOk(result: RuleResult): void {
  if (!result.ok) throw new RuleError(result.code, result.message)
}

function byDateTime<T extends { date: string; start: string }>(a: T, b: T): number {
  return (a.date + a.start).localeCompare(b.date + b.start)
}

export const mockTeacherApi = {
  async getMe(): Promise<TeacherProfile> {
    await delay()
    return getState().profile
  },

  async getReminderPrefs(): Promise<ReminderPrefs> {
    await delay()
    return getState().prefs
  },

  async saveSettings(settings: TeacherSettings): Promise<TeacherSettings> {
    await delay()
    const { profile, prefs } = settings
    if (!profile.name.trim()) throw new RuleError('invalid', 'Name cannot be empty.')
    if (profile.email && !/^\S+@\S+\.\S+$/.test(profile.email)) {
      throw new RuleError('invalid', 'Enter a valid email address.')
    }
    if (![30, 60, 1440].includes(prefs.leadMinutes)) throw new RuleError('invalid', 'Pick a reminder time.')
    return mutate((d) => {
      d.profile = profile
      d.prefs = prefs
      return { profile: d.profile, prefs: d.prefs }
    })
  },

  async getSchedule(): Promise<ScheduleView> {
    await delay()
    const s = getState()
    return { schedule: s.schedule, warnings: scheduleWarnings(ruleState(s), new Date()) }
  },

  /** Existing bookings are never deleted; the response lists warnings instead. */
  async saveSchedule(schedule: Schedule): Promise<ScheduleView> {
    await delay()
    assertOk(validateSchedule(schedule))
    return mutate((d) => {
      d.schedule = schedule
      return { schedule: d.schedule, warnings: scheduleWarnings(ruleState(d), new Date()) }
    })
  },

  async getSlots(from: string, to: string): Promise<Slot[]> {
    await delay()
    return generateSlots(ruleState(getState()), from, to)
  },

  async getBookings(): Promise<Booking[]> {
    await delay()
    return [...getState().bookings].sort(byDateTime)
  },

  async cancelBooking(id: string): Promise<void> {
    await delay()
    mutate((d) => {
      const b = d.bookings.find((x) => x.id === id)
      if (!b) throw new RuleError('invalid', 'That booking no longer exists.')
      d.bookings = d.bookings.filter((x) => x.id !== id)
      notify(
        d,
        'cancellation',
        'Booking cancelled',
        `${b.studentName} cancelled ${b.timingName ?? 'a visit'} on ${formatDateShort(b.date)}.`,
      )
    })
  },

  async getRequests(): Promise<BookingRequest[]> {
    await delay()
    return [...getState().requests].sort(byDateTime)
  },

  /** Rule 6: accepting creates a booking, still subject to the past and day-off rules. */
  async acceptRequest(id: string): Promise<Booking> {
    await delay()
    return mutate((d) => {
      const r = d.requests.find((x) => x.id === id)
      if (!r) throw new RuleError('invalid', 'That request no longer exists.')
      assertOk(checkRequestTime(ruleState(d), r.date, r.start, new Date()))
      d.requests = d.requests.filter((x) => x.id !== id)
      const booking: Booking = {
        id: nextId(d, 'b'),
        studentName: r.studentName,
        reason: r.reason,
        date: r.date,
        start: r.start,
        end: r.end,
        slotId: null,
        timingName: null,
        createdAt: new Date().toISOString(),
      }
      d.bookings.push(booking)
      notify(
        d,
        'booking',
        'Request accepted',
        `${r.studentName} is booked for ${formatDateShort(r.date)} at ${formatTime(r.start)}.`,
      )
      return booking
    })
  },

  async declineRequest(id: string): Promise<void> {
    await delay()
    mutate((d) => {
      const r = d.requests.find((x) => x.id === id)
      if (!r) throw new RuleError('invalid', 'That request no longer exists.')
      d.requests = d.requests.filter((x) => x.id !== id)
      notify(
        d,
        'request',
        'Request declined',
        `You declined ${r.studentName}'s request for ${formatDateShort(r.date)} at ${formatTime(r.start)}.`,
      )
    })
  },

  async getDaysOff(): Promise<DayOff[]> {
    await delay()
    return [...getState().daysOff].sort((a, b) => a.date.localeCompare(b.date))
  },

  /** Rule 4: tells the UI how many bookings a day off would affect before it saves. */
  async previewDayOff(date: string): Promise<DayOffPreview> {
    await delay()
    const s = getState()
    assertOk(validateDayOff(ruleState(s), date, new Date()))
    return { date, affectedBookings: countAffectedBookings(s.bookings, date) }
  },

  async addDayOff(input: { date: string; reason: string }): Promise<DayOff> {
    await delay()
    return mutate((d) => {
      assertOk(validateDayOff(ruleState(d), input.date, new Date()))
      const dayOff: DayOff = { id: nextId(d, 'd'), date: input.date, reason: input.reason.trim() }
      d.daysOff.push(dayOff)
      return dayOff
    })
  },

  async removeDayOff(id: string): Promise<void> {
    await delay()
    mutate((d) => {
      d.daysOff = d.daysOff.filter((x) => x.id !== id)
    })
  },

  async getNotifications(): Promise<AppNotification[]> {
    await delay()
    return getState().notifications
  },

  async markAllNotificationsRead(): Promise<void> {
    await delay()
    mutate((d) => {
      d.notifications = d.notifications.map((n) => ({ ...n, read: true }))
    })
  },
}
