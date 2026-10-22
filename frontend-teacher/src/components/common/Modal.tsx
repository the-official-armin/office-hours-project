// Shared: changes need a PR note and a teammate review.
// Purpose: accessible dialog. role="dialog" aria-modal, Esc and backdrop close it, focus is trapped, starts on the
// close button and returns to what opened it, the page behind is inert and cannot scroll. A bottom sheet on phones.
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'
import { IconButton } from './Button'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface ModalProps {
  title: string
  subtitle?: string
  onClose: () => void
  /** Scrolls. Keep it as plain children so its scroll position survives updates. */
  children: ReactNode
  footer?: ReactNode
}

export default function Modal({ title, subtitle, onClose, children, footer }: ModalProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const root = document.getElementById('root')
    const previousOverflow = document.documentElement.style.overflow
    root?.setAttribute('inert', '')
    document.documentElement.style.overflow = 'hidden'
    closeRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !dialogRef.current) return
      const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !dialogRef.current.contains(active))) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)

    return () => {
      document.removeEventListener('keydown', onKey)
      root?.removeAttribute('inert')
      document.documentElement.style.overflow = previousOverflow
      if (opener && document.contains(opener)) opener.focus()
    }
  }, [])

  return createPortal(
    <>
      <div aria-hidden="true" onClick={() => onClose()} className="fixed inset-0 z-[70] bg-scrim" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed left-1/2 top-1/2 z-[71] flex max-h-[min(760px,calc(100vh-64px))] w-[min(680px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[18px] border border-line bg-surface shadow-pop max-[640px]:inset-x-0 max-[640px]:bottom-0 max-[640px]:top-auto max-[640px]:max-h-[calc(100vh-48px-env(safe-area-inset-top,0px))] max-[640px]:w-full max-[640px]:translate-x-0 max-[640px]:translate-y-0 max-[640px]:rounded-b-none max-[640px]:rounded-t-[18px] max-[640px]:border-b-0"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 pb-3.5 pt-5 max-[640px]:px-[max(16px,env(safe-area-inset-right,0px))]">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-extrabold">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
          </div>
          <IconButton aria-label="Close" onClick={() => onClose()} ref={closeRef}>
            <Icon name="x" strokeWidth={2} />
          </IconButton>
        </div>
        <div className="overflow-auto overscroll-contain px-6 pb-4 max-[640px]:px-[max(16px,env(safe-area-inset-right,0px))]">
          {children}
        </div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2.5 border-t border-line px-6 py-3.5 max-[640px]:px-[max(16px,env(safe-area-inset-right,0px))] max-[640px]:pb-[calc(12px+env(safe-area-inset-bottom,0px))] [&>*]:max-[640px]:flex-auto">
            {footer}
          </div>
        )}
      </div>
    </>,
    document.body,
  )
}

/** A small group heading inside a modal ("This week", "Answered"). */
export function ModalGroup({ children }: { children: ReactNode }) {
  return <div className="pb-1 pt-5 text-xs font-bold uppercase tracking-[.05em] text-muted">{children}</div>
}
