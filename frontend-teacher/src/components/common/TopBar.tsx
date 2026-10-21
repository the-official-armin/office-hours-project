// Shared: changes need a PR note and a teammate review.
// Purpose: sticky top bar: sidebar toggle, logo (when the sidebar is hidden), example-data chip, bell, reset.
import type { Role, ShellNote } from '../../types'
import Icon from './Icon'
import NotificationsPopover from './NotificationsPopover'

interface Props {
  role: Role
  sidebarOpen: boolean
  onToggleSidebar: () => void
  notes: ShellNote[]
  onMarkAllRead: () => void
  /** Show the "Example data" chip and reset button. Only true when running on mock data. */
  showExample: boolean
  onReset: () => void
}

export default function TopBar({ role, sidebarOpen, onToggleSidebar, notes, onMarkAllRead, showExample, onReset }: Props) {
  const toggleLabel = `${sidebarOpen ? 'Hide' : 'Show'} navigation`

  return (
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-30 border-b border-line bg-surface">
      <div className="flex min-h-[60px] items-center gap-2 py-2 pl-[max(16px,env(safe-area-inset-left,0px))] pr-[max(16px,env(safe-area-inset-right,0px))] min-[900px]:gap-3 min-[900px]:pl-8">
        <button
          type="button"
          aria-label={toggleLabel}
          title={`${toggleLabel} (Ctrl+B)`}
          aria-expanded={sidebarOpen}
          aria-controls="side"
          onClick={onToggleSidebar}
          className="-ml-3.5 hidden h-11 w-11 flex-none items-center justify-center rounded-[10px] border border-transparent bg-transparent p-0 text-ink min-[900px]:inline-flex"
        >
          <Icon name="panel" />
        </button>
        <div
          className={`h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-accent text-[#12303a] max-[899px]:flex ${sidebarOpen ? 'min-[900px]:hidden' : 'min-[900px]:flex'}`}
        >
          <Icon name="clock" />
        </div>

        {showExample && (
          <>
            <span className="inline-block whitespace-nowrap rounded-lg bg-tint px-2.5 py-1 text-xs font-bold text-tint-ink">
              Example data
            </span>
            <span className="hidden min-w-0 text-[13px] text-muted min-[1100px]:inline">
              Saved in this browser. Reset puts the original {role === 'student' ? 'bookings' : 'office hours and requests'} back.
            </span>
          </>
        )}

        <span className="flex-1" />

        <NotificationsPopover notes={notes} onMarkAllRead={onMarkAllRead} />
        {showExample && (
          <button
            type="button"
            aria-label="Reset the example data"
            title="Reset the example data"
            onClick={onReset}
            className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-[10px] border border-edge bg-surface p-0 text-ink"
          >
            <Icon name="reset" />
          </button>
        )}
      </div>
    </header>
  )
}
