// Shared: changes need a PR note and a teammate review.
// Purpose: bell button and notifications popover. Closes on an outside click or Esc, and closing marks all as read.
import { useEffect, useRef, useState } from 'react'
import type { Note } from '../../types'
import Icon from './Icon'

function ago(at: number): string {
  const minutes = Math.max(0, Math.round((Date.now() - at) / 60_000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return `${Math.round(hours / 24)} d ago`
}

interface Props {
  notes: Note[]
  onMarkAllRead: () => void
}

export default function NotificationsPopover({ notes, onMarkAllRead }: Props) {
  const [open, setOpen] = useState(false)
  const bellRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const unread = notes.filter((n) => !n.read).length

  function close(returnFocus: boolean) {
    setOpen(false)
    if (unread > 0) onMarkAllRead()
    if (returnFocus) bellRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (popRef.current?.contains(target) || bellRef.current?.contains(target)) return
      setOpen(false)
      if (unread > 0) onMarkAllRead()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      if (unread > 0) onMarkAllRead()
      bellRef.current?.focus()
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, unread, onMarkAllRead])

  return (
    <>
      <button
        ref={bellRef}
        type="button"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        onClick={() => (open ? close(false) : setOpen(true))}
        className="relative inline-flex h-11 w-11 flex-none items-center justify-center rounded-[10px] border border-edge bg-surface p-0 text-ink"
      >
        <Icon name="bell" />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-badge px-[5px] text-[11px] font-extrabold text-badge-ink">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={popRef}
          role="dialog"
          aria-label="Notifications"
          className="fixed right-[max(16px,env(safe-area-inset-right,0px))] top-[calc(env(safe-area-inset-top,0px)+66px)] z-50 max-h-[min(520px,70vh)] w-[min(380px,calc(100vw-32px))] overflow-auto rounded-[14px] border border-line bg-surface shadow-pop"
        >
          <h2 className="px-4 pb-2 pt-3.5 text-[15px] font-extrabold">Notifications</h2>
          {notes.length === 0 ? (
            <div className="border-t border-line px-4 py-3 text-sm">Nothing new.</div>
          ) : (
            notes.map((n) => (
              <div
                key={n.id}
                className={`flex gap-2.5 border-t border-line px-4 py-3 text-sm leading-[1.45] ${n.read ? '' : 'bg-tint'}`}
              >
                <i
                  aria-hidden="true"
                  className={`mt-1.5 h-2 w-2 flex-none rounded-full ${n.read ? 'bg-transparent' : 'bg-brand'}`}
                />
                <div>
                  {!n.read && <span className="sr-only">Unread: </span>}
                  {n.text}
                  <small className="mt-0.5 block text-xs text-muted">{ago(n.at)}</small>
                </div>
              </div>
            ))
          )}
          <div className="flex justify-end border-t border-line px-4 py-2.5">
            <button type="button" onClick={onMarkAllRead} className="text-sm font-bold text-link">
              Mark all as read
            </button>
          </div>
        </div>
      )}
    </>
  )
}
