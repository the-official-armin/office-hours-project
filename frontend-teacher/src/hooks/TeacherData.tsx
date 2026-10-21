// Owner: Subgroup B (Teacher desktop UI). One place that loads Teacher data through src/api/ and refreshes it after writes.
// Data flow: pages -> useTeacher() -> api/teacher.ts. Pages never call fetch or touch storage.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { teacherApi, USE_MOCKS } from '../api/teacher'
import { resetExample, runReminders } from '../api/mocks/demo'
import type { Booking, BookingRequest, Note, ShellData, Teacher, TeacherSettings } from '../types'
import { pendingRequests } from '../lib/rules'

export interface TeacherData {
  teacher: Teacher
  settings: TeacherSettings
  bookings: Booking[]
  requests: BookingRequest[]
  notes: Note[]
}

interface TeacherContextValue {
  status: 'loading' | 'ready' | 'error'
  error: string | null
  data: TeacherData | null
  /** Changes on every refresh, so "is it past yet?" checks stay current. */
  now: Date
  usingMocks: boolean
  refresh: () => Promise<void>
  /** Await a write, then refresh so the screen matches what is saved. */
  commit: <T>(write: Promise<T>) => Promise<T>
  markNotesRead: () => Promise<void>
  resetExample: () => Promise<void>
}

const TeacherContext = createContext<TeacherContextValue | null>(null)

export function TeacherDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<TeacherData | null>(null)
  const [status, setStatus] = useState<TeacherContextValue['status']>('loading')
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())
  const alive = useRef(true)

  const load = useCallback(async () => {
    const [teacher, settings, bookings, requests, notes] = await Promise.all([
      teacherApi.getTeacher(),
      teacherApi.getSettings(),
      teacherApi.getBookings(),
      teacherApi.getRequests(),
      teacherApi.getNotes(),
    ])
    if (!alive.current) return
    setData({ teacher, settings, bookings, requests, notes })
    setNow(new Date())
  }, [])

  // First load. In mock mode the reminder scheduler runs first so reminders show up straight away.
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

  // Keep "now", past times and reminders fresh while the tab stays open.
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

  const value = useMemo<TeacherContextValue>(
    () => ({
      status,
      error,
      data,
      now,
      usingMocks: USE_MOCKS,
      refresh,
      commit,
      markNotesRead: () => commit(teacherApi.markNotesRead()),
      resetExample: () => commit(resetExample()),
    }),
    [status, error, data, now, refresh, commit],
  )

  return <TeacherContext.Provider value={value}>{children}</TeacherContext.Provider>
}

export function useTeacher(): TeacherContextValue {
  const ctx = useContext(TeacherContext)
  if (!ctx) throw new Error('useTeacher must be used inside <TeacherDataProvider>.')
  return ctx
}

/** For pages: the layout renders a page only after the data has loaded. */
export function useTeacherData(): TeacherContextValue & { data: TeacherData } {
  const ctx = useTeacher()
  if (!ctx.data) throw new Error('Teacher data is not loaded yet.')
  return ctx as TeacherContextValue & { data: TeacherData }
}

/** What the app shell shows for a teacher. */
export function toTeacherShell(data: TeacherData): ShellData {
  return {
    user: { name: data.teacher.name, subtitle: data.teacher.subject },
    notes: data.notes,
    badges: { requests: pendingRequests(data.requests, data.teacher.id).length, disrupted: 0 },
  }
}
