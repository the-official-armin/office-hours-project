// Owner: Subgroup B (Teacher desktop UI). Bell with unread count and a panel of (simulated) email notifications.
import { useEffect, useRef, useState } from 'react'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import { useTeacherData } from '../../hooks/TeacherDataProvider'
import Button from './Button'
import Icon from './Icons'
import { EmptyState, FeedbackMessage } from './ui'

function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return `${Math.round(hours / 24)} d ago`
}

export default function NotificationBell() {
  const { data, markAllRead } = useTeacherData()
  const { run, feedback, isPending } = useAsyncAction()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const unread = data.notifications.filter((n) => !n.read).length

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Notifications, ${unread} unread`}
        className="relative rounded-lg border border-line bg-surface p-2 text-ink hover:bg-canvas"
      >
        <Icon name="bell" />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-warn px-1 text-xs font-bold text-ink">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="region"
          aria-label="Notifications"
          className="absolute right-0 z-20 mt-2 w-96 rounded-2xl border border-line bg-surface shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="font-bold">Notifications</h2>
            <Button
              variant="secondary"
              className="px-3 py-1 text-xs"
              disabled={unread === 0}
              loading={isPending('read')}
              onClick={() => run('read', markAllRead, 'All notifications marked as read.')}
            >
              Mark all read
            </Button>
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {data.notifications.length === 0 && (
              <li className="p-4">
                <EmptyState>Nothing yet. Bookings, cancellations, requests and reminders show up here.</EmptyState>
              </li>
            )}
            {data.notifications.map((n) => (
              <li key={n.id} className={`border-b border-line px-4 py-3 last:border-b-0 ${n.read ? '' : 'bg-brand-soft'}`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-bold">
                    {!n.read && <span className="sr-only">Unread: </span>}
                    {n.title}
                  </p>
                  <span className="shrink-0 text-xs text-muted">{timeAgo(n.createdAt)}</span>
                </div>
                <p className="mt-0.5 text-sm text-muted">{n.body}</p>
              </li>
            ))}
          </ul>
          <div className="space-y-2 border-t border-line px-4 py-3">
            <FeedbackMessage feedback={feedback} />
            <p className="text-xs text-muted">Email reminders are simulated in this local MVP.</p>
          </div>
        </div>
      )}
    </div>
  )
}
