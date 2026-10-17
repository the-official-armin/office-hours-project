// Owner: Subgroup B (Teacher desktop UI). Desktop only (min width 1024px): left sidebar + header row + main content.
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { TeacherDataProvider, useTeacher } from '../../hooks/TeacherDataProvider'
import { initials } from '../../lib/dates'
import Button from './Button'
import Icon, { type IconName } from './Icons'
import NotificationBell from './NotificationBell'
import { Loading } from './ui'

const NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/teacher', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/teacher/calendar', label: 'Calendar', icon: 'calendar' },
  { to: '/teacher/office-hours', label: 'Office hours', icon: 'clock' },
  { to: '/teacher/days-off', label: 'Days off', icon: 'ban' },
  { to: '/teacher/requests', label: 'Booking requests', icon: 'inbox' },
  { to: '/teacher/settings', label: 'Settings', icon: 'sliders' },
]

function navClass({ isActive }: { isActive: boolean }): string {
  return `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
    isActive ? 'bg-sidebar-active text-white' : 'text-sidebar-ink hover:bg-sidebar-active/60'
  }`
}

function Shell() {
  const { status, error, data, reload } = useTeacher()
  const { logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const requestCount = data?.requests.length ?? 0
  const name = data?.profile.name ?? 'Teacher'

  return (
    <div className="flex min-h-screen min-w-[1024px]">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col bg-sidebar px-4 py-5 text-sidebar-ink">
        <div className="mb-6 flex items-center gap-3 px-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white">
            <Icon name="clock" />
          </span>
          <div className="leading-tight">
            <p className="font-extrabold text-white">Office Hours</p>
            <p className="text-xs text-sidebar-muted">Teacher</p>
          </div>
        </div>

        <nav aria-label="Teacher navigation" className="flex flex-col gap-1">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
              <Icon name={item.icon} />
              <span className="flex-1">{item.label}</span>
              {item.to === '/teacher/requests' && requestCount > 0 && (
                <span
                  className="rounded-full bg-warn px-2 py-0.5 text-xs font-bold text-ink"
                  aria-label={`${requestCount} open requests`}
                >
                  {requestCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-6">
          <p className="mb-1 px-3 text-[11px] font-bold uppercase tracking-wider text-sidebar-muted">Demo</p>
          <NavLink to="/teacher/demo" className={navClass}>
            <Icon name="flask" />
            Demo tools
          </NavLink>
        </div>

        <div className="mt-auto border-t border-sidebar-active pt-4">
          <div className="flex items-center gap-3 px-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
              {initials(name)}
            </span>
            <div className="leading-tight">
              <p className="text-sm font-bold text-white">{name}</p>
              <p className="text-xs text-sidebar-muted">{data?.profile.subject}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-sidebar-ink hover:bg-sidebar-active/60"
          >
            <Icon name="logout" />
            Log out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex justify-end px-8 pt-6">{data && <NotificationBell />}</header>
        <main className="flex-1 px-8 pb-10 pt-2">
          {status === 'loading' && <Loading label="Loading your office hours..." />}
          {status === 'error' && (
            <div role="alert" className="rounded-2xl border border-line bg-surface p-6">
              <p className="font-bold">We could not load your data.</p>
              <p className="mt-1 text-sm text-muted">{error}</p>
              <Button className="mt-4" onClick={() => void reload().catch(() => undefined)}>
                Try again
              </Button>
            </div>
          )}
          {status === 'ready' && data && <Outlet />}
        </main>
      </div>
    </div>
  )
}

export default function TeacherLayout() {
  return (
    <TeacherDataProvider>
      <Shell />
    </TeacherDataProvider>
  )
}
