// Owner: Subgroup B (Teacher desktop UI). Purpose: run an async action with pending state and success/error feedback.
import { useCallback, useState } from 'react'

export interface Feedback {
  kind: 'success' | 'error'
  text: string
}

export function useAsyncAction() {
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  /** Returns the result, or undefined if the action failed (the error is shown as feedback). */
  const run = useCallback(
    async <T,>(key: string, fn: () => Promise<T>, success?: string | ((result: T) => string)) => {
      setPendingKey(key)
      setFeedback(null)
      try {
        const result = await fn()
        if (success) setFeedback({ kind: 'success', text: typeof success === 'function' ? success(result) : success })
        return result
      } catch (err) {
        setFeedback({ kind: 'error', text: err instanceof Error ? err.message : 'Something went wrong.' })
        return undefined
      } finally {
        setPendingKey(null)
      }
    },
    [],
  )

  return {
    run,
    feedback,
    clearFeedback: () => setFeedback(null),
    pending: pendingKey !== null,
    isPending: (key: string) => pendingKey === key,
  }
}
