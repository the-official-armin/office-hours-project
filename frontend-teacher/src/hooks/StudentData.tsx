// Owner: Subgroup B (Teacher desktop UI). One place that loads Student data through src/api/ and refreshes it after writes.
// Data flow: pages -> useStudent() -> api/student.ts. Pages never call fetch or touch storage.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { studentApi } from '../api/student'
import { USE_MOCKS } from '../api/client'
import { resetExample, runReminders } from '../api/mocks/demo'
import type { Booking, BookingRequest, Note, ShellData, StudentSettings, Teacher } from '../types'
import { disruption, upcomingBookings } from '../lib/rules'

export interface StudentData {
  teachers: Teacher[]
  settings: StudentSettings
  /** This student's bookings, every status. */
  bookings: Booking[]
  /** This student's requests, every status. */
  requests: BookingRequest[]
  notes: Note[]
}

interface StudentContextValue {
  status: 'loading' | 'ready' | 'error'
  error: string | null
  data: StudentData | null
  now: Date
  usingMocks: boolean
  refresh: () => Promise<void>
  commit: <T>(write: Promise<T>) => Promise<T>
  markNotesRead: () => Promise<void>
  resetExample: () => Promise<void>
}

const StudentContext = createContext<StudentContextValue | null>(null)

export function StudentDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<StudentData | null>(null)
  const [status, setStatus] = useState<StudentContextValue['status']>('loading')
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())
  const alive = useRef(true)

  const load = useCallback(async () => {
    const [teachers, settings, bookings, requests, notes] = await Promise.all([
      studentApi.getTeachers(),
      studentApi.getSettings(),
      studentApi.getBookings(),
      studentApi.getRequests(),
      studentApi.getNotes(),
    ])
    if (!alive.current) return
    setData({ teachers, settings, bookings, requests, notes })
    setNow(new Date())
  }, [])

  useEffect(() => {
    alive.current = true
    ;(async () => {
      try {
        if (USE_MOCKS) await runReminders()
        await load()
        if (alive.current) setStatus('ready')
      } catch (err) {
        if (alive.current) {
          setError(err instanceof Error ? err.message : 'Could not load your data.')
          setStatus('error')
        }
      }
    })()
    return () => {
      alive.current = false
    }
  }, [load])

  useEffect(() => {
    const id = setInterval(() => {
      void (async () => {
        try {
          if (USE_MOCKS) await runReminders()
          await load()
        } catch {
          // the next tick or the next user action retries
        }
      })()
    }, 60_000)
    return () => clearInterval(id)
  }, [load])

  const refresh = useCallback(async () => {
    try {
      await load()
      setError(null)
      setStatus('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your data.')
      if (!data) setStatus('error')
      throw err
    }
  }, [load, data])

  const commit = useCallback(
    async <T,>(write: Promise<T>): Promise<T> => {
      const result = await write
      await load()
      return result
    },
    [load],
  )

  const value = useMemo<StudentContextValue>(
    () => ({
      status,
      error,
      data,
      now,
      usingMocks: USE_MOCKS,
      refresh,
      commit,
      markNotesRead: () => commit(studentApi.markNotesRead()),
      resetExample: () => commit(resetExample()),
    }),
    [status, error, data, now, refresh, commit],
  )

  return <StudentContext.Provider value={value}>{children}</StudentContext.Provider>
}

export function useStudent(): StudentContextValue {
  const ctx = useContext(StudentContext)
  if (!ctx) throw new Error('useStudent must be used inside <StudentDataProvider>.')
  return ctx
}

/** For pages: the layout renders a page only after the data has loaded. */
export function useStudentData(): StudentContextValue & { data: StudentData } {
  const ctx = useStudent()
  if (!ctx.data) throw new Error('Student data is not loaded yet.')
  return ctx as StudentContextValue & { data: StudentData }
}

/** What the app shell shows for a student. The badge counts upcoming bookings flagged as disrupted. */
export function toStudentShell(data: StudentData, now: Date): ShellData {
  const world = { teachers: data.teachers, bookings: data.bookings }
  const disrupted = upcomingBookings(world, () => true, now).filter((b) => disruption(world, b)).length
  return {
    user: { name: data.settings.name, subtitle: data.settings.grade },
    notes: data.notes,
    badges: { requests: 0, disrupted },
  }
}
