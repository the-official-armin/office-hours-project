// Owner: Subgroup B (Teacher desktop UI). Purpose: run an async action with a pending state, an inline error on
// failure (role="alert" in the page) and a toast on success. Never leaves an unhandled rejection.
import { useCallback, useState } from 'react'
import { useToast } from '../components/common/Toast'

export function useAction() {
  const toast = useToast()
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  /** Returns the result, or undefined when the action failed (the message is in `error`). */
  const run = useCallback(
    async <T,>(key: string, fn: () => Promise<T>, success?: string | ((result: T) => string)) => {
      setPendingKey(key)
      setError(null)
      try {
        const result = await fn()
        if (success) toast(typeof success === 'function' ? success(result) : success)
        return result
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
        return undefined
      } finally {
        setPendingKey(null)
      }
    },
    [toast],
  )

  return {
    run,
    error,
    setError,
    pending: pendingKey !== null,
    isPending: (key: string) => pendingKey === key,
  }
}
