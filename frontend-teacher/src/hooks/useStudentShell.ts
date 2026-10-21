// Owner: Subgroup B (Teacher desktop UI). Purpose: shell data (name, notifications, badges) for the Student side.
// Phase 2 replaces the mock behind src/api/shell.ts with the shared store.
import { useCallback, useEffect, useState } from 'react'
import { getStudentShell, markStudentNotesRead, resetStudentShell } from '../api/shell'
import type { ShellData } from '../types'

export function useStudentShell() {
  const [data, setData] = useState<ShellData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    getStudentShell().then(
      (next) => {
        if (cancelled) return
        setData(next)
        setError(null)
      },
      (err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load your data.')
      },
    )
    return () => {
      cancelled = true
    }
  }, [attempt])

  const reload = useCallback(() => setAttempt((a) => a + 1), [])

  const markAllRead = useCallback(async () => {
    await markStudentNotesRead()
    reload()
  }, [reload])

  const reset = useCallback(async () => {
    await resetStudentShell()
    reload()
  }, [reload])

  return { data, error, reload, markAllRead, reset }
}
