// Shared: changes need a PR note and a teammate review.
// Purpose: one toast at a time, visible for 3.2 seconds. Use useToast() to show a message.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

const SHOW_MS = 3200

const ToastContext = createContext<(message: string) => void>(() => undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('')
  const [visible, setVisible] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const show = useCallback((text: string) => {
    setMessage(text)
    setVisible(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setVisible(false), SHOW_MS)
  }, [])

  useEffect(() => () => clearTimeout(timer.current), [])

  const value = useMemo(() => show, [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom,0px)+84px)] left-1/2 z-[60] max-w-[min(520px,calc(100vw-32px))] -translate-x-1/2 rounded-xl bg-ink px-[18px] py-3 text-sm font-semibold text-page shadow-pop transition-opacity duration-150 min-[900px]:bottom-[calc(env(safe-area-inset-bottom,0px)+20px)] ${visible ? 'opacity-100' : 'opacity-0'}`}
      >
        {message}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): (message: string) => void {
  return useContext(ToastContext)
}
