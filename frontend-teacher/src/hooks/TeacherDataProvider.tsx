// Owner: Subgroup B (Teacher desktop UI). Purpose: one place that loads Teacher data through src/api/ and exposes actions.
// Data flow: pages -> useTeacher() -> api/teacher.ts. Pages never call fetch or touch storage.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { teacherApi, USE_MOCKS } from '../api/teacher'
import { createDemoBooking, createDemoRequest, resetDemoData, runReminders } from '../api/mocks/demo'
import { addDays, parseISODate, startOfWeek, toISODate } from '../lib/dates'
import type {
  AppNotification,
  Booking,
  BookingRequest,
  DayOff,
  DayOffPreview,
  ReminderPrefs,
  Schedule,
  ScheduleView,
  ScheduleWarning,
  Slot,
  TeacherProfile,
  TeacherSettings,
} from '../types'

interface TeacherData {
  profile: TeacherProfile
  prefs: ReminderPrefs
  schedule: Schedule
  warnings: ScheduleWarning[]
  daysOff: DayOff[]
  bookings: Booking[]
  requests: BookingRequest[]
  notifications: AppNotification[]
  /** Office hours from last week through six weeks ahead, with booked counts. */
  slots: Slot[]
}

interface TeacherContextValue {
  status: 'loading' | 'ready' | 'error'
  error: string | null
  data: TeacherData | null
  now: Date
  today: string
  /** Bumps after every reload so views that fetch their own ranges can refetch. */
  version: number
  usingMocks: boolean
  reload: () => Promise<void>
  getSlots: (from: string, to: string) => Promise<Slot[]>
  saveSchedule: (schedule: Schedule) => Promise<ScheduleView>
  saveSettings: (settings: TeacherSettings) => Promise<TeacherSettings>
  previewDayOff: (date: string) => Promise<DayOffPreview>
  addDayOff: (input: { date: string; reason: string }) => Promise<DayOff>
  removeDayOff: (id: string) => Promise<void>
  acceptRequest: (id: string) => Promise<Booking>
  declineRequest: (id: string) => Promise<void>
  cancelBooking: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  demo: {
    book: typeof createDemoBooking
    request: typeof createDemoRequest
    reset: () => Promise<void>
  }
}

const TeacherContext = createContext<TeacherContextValue | null>(null)

function slotRange(today: string): { from: string; to: string } {
  const monday = startOfWeek(parseISODate(today))
  return { from: toISODate(addDays(monday, -7)), to: toISODate(addDays(parseISODate(today), 42)) }
}

export function TeacherDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<TeacherData | null>(null)
  const [status, setStatus] = useState<TeacherContextValue['status']>('loading')
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [version, setVersion] = useState(0)
  const mounted = useRef(true)

  const today = toISODate(now)

  const load = useCallback(async () => {
    const { from, to } = slotRange(toISODate(new Date()))
    const [profile, prefs, scheduleView, daysOff, bookings, requests, notifications, slots] = await Promise.all([
      teacherApi.getMe(),
      teacherApi.getReminderPrefs(),
      teacherApi.getSchedule(),
      teacherApi.getDaysOff(),
      teacherApi.getBookings(),
      teacherApi.getRequests(),
      teacherApi.getNotifications(),
      teacherApi.getSlots(from, to),
    ])
    if (!mounted.current) return
    setData({
      profile,
      prefs,
      schedule: scheduleView.schedule,
      warnings: scheduleView.warnings,
      daysOff,
      bookings,
      requests,
      notifications,
      slots,
    })
    setNow(new Date())
    setVersion((v) => v + 1)
  }, [])

  const getSlots = useCallback((from: string, to: string) => teacherApi.getSlots(from, to), [])

  // Initial load: simulate the reminder scheduler first so reminders show up straight away.
  useEffect(() => {
    mounted.current = true
    let cancelled = false
    ;(async () => {
      try {
        if (USE_MOCKS) await runReminders()
        await load()
        if (!cancelled) setStatus('ready')
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load your data.')
          setStatus('error')
        }
      }
    })()
    return () => {
      cancelled = true
      mounted.current = false
    }
  }, [load])

  // Keep "now", past days and reminders fresh while the tab stays open.
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        if (USE_MOCKS) await runReminders()
        await load()
      } catch {
        // ignore: the next tick or the next user action will retry
      }
    }, 60_000)
    return () => clearInterval(id)
  }, [load])

  const afterWrite = useCallback(
    async <T,>(promise: Promise<T>): Promise<T> => {
      const result = await promise
      await load()
      return result
    },
    [load],
  )

  const value = useMemo<TeacherContextValue>(
    () => ({
      status,
      error,
      data,
      now,
      today,
      version,
      usingMocks: USE_MOCKS,
      reload: load,
      getSlots,
      saveSchedule: (schedule) => afterWrite(teacherApi.saveSchedule(schedule)),
      saveSettings: (settings) => afterWrite(teacherApi.saveSettings(settings)),
      previewDayOff: (date) => teacherApi.previewDayOff(date),
      addDayOff: (input) => afterWrite(teacherApi.addDayOff(input)),
      removeDayOff: (id) => afterWrite(teacherApi.removeDayOff(id)),
      acceptRequest: (id) => afterWrite(teacherApi.acceptRequest(id)),
      declineRequest: (id) => afterWrite(teacherApi.declineRequest(id)),
      cancelBooking: (id) => afterWrite(teacherApi.cancelBooking(id)),
      markAllRead: () => afterWrite(teacherApi.markAllNotificationsRead()),
      demo: {
        book: (input) => afterWrite(createDemoBooking(input)),
        request: (input) => afterWrite(createDemoRequest(input)),
        reset: () => afterWrite(resetDemoData()),
      },
    }),
    [status, error, data, now, today, version, load, getSlots, afterWrite],
  )

  return <TeacherContext.Provider value={value}>{children}</TeacherContext.Provider>
}

export function useTeacher(): TeacherContextValue {
  const ctx = useContext(TeacherContext)
  if (!ctx) throw new Error('useTeacher must be used inside <TeacherDataProvider>.')
  return ctx
}

/** Same as useTeacher(), for components that render only after data has loaded. */
export function useTeacherData(): TeacherContextValue & { data: TeacherData } {
  const ctx = useTeacher()
  if (!ctx.data) throw new Error('Teacher data is not loaded yet.')
  return ctx as TeacherContextValue & { data: TeacherData }
}
