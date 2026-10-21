// Shared: changes need a PR note and a teammate review.
// Purpose: app shell for both roles: collapsible sidebar, top bar, page outlet, bottom tab bar (phones) and toast.
// Purely presentational: the role's layout passes in the data and the actions.
import { useCallback, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useSidebar } from '../../hooks/useSidebar'
import type { Role, ShellData } from '../../types'
import SideNav from './SideNav'
import TabBar from './TabBar'
import { useToast } from './Toast'
import TopBar from './TopBar'

interface AppShellProps {
  role: Role
  data: ShellData
  showExample: boolean
  onMarkAllRead: () => Promise<void>
  onReset: () => Promise<void>
  onLogout: () => void
  /** Change to remount the page (used after a reset so pages drop their unsaved state). */
  pageKey?: number
}

export default function AppShell({ role, data, showExample, onMarkAllRead, onReset, onLogout, pageKey = 0 }: AppShellProps) {
  const { open, toggle } = useSidebar()
  const toast = useToast()
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  const markAllRead = useCallback(() => {
    onMarkAllRead().catch(() => toast('Could not update notifications. Try again.'))
  }, [onMarkAllRead, toast])

  const reset = useCallback(() => {
    onReset().then(
      () => toast('Example data restored.'),
      () => toast('Could not reset the example data.'),
    )
  }, [onReset, toast])

  return (
    <div className="flex min-h-screen items-stretch">
      <aside
        id="side"
        inert={!open}
        className={`hidden flex-none overflow-hidden bg-side text-white transition-[width] duration-[220ms] min-[900px]:block ${open ? 'w-[248px]' : 'w-0'}`}
      >
        <SideNav role={role} user={data.user} badges={data.badges} onLogout={onLogout} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          role={role}
          sidebarOpen={open}
          onToggleSidebar={toggle}
          notes={data.notes}
          onMarkAllRead={markAllRead}
          showExample={showExample}
          onReset={reset}
        />
        <main
          id="main"
          className="flex min-w-0 flex-col gap-5 px-[max(16px,env(safe-area-inset-right,0px))] pb-[calc(92px+env(safe-area-inset-bottom,0px))] pt-5 min-[900px]:gap-6 min-[900px]:px-10 min-[900px]:pb-12 min-[900px]:pt-8"
        >
          <Outlet key={pageKey} />
        </main>
      </div>

      <TabBar role={role} badges={data.badges} />
    </div>
  )
}
