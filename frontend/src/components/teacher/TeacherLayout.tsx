// Owner: Subgroup B (Teacher desktop UI). Desktop only (min width 1024px): sidebar + header + main content.
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import Button from './Button'

const links = [
  { to: '/teacher', label: 'Dashboard', end: true },
  { to: '/teacher/office-hours', label: 'Office hours' },
  { to: '/teacher/calendar', label: 'Calendar' },
  { to: '/teacher/days-off', label: 'Days off' },
  { to: '/teacher/requests', label: 'Booking requests' },
  { to: '/teacher/settings', label: 'Settings' },
]

export default function TeacherLayout() {
  const navigate = useNavigate()

  // TODO: wire to the real logout once the auth team provides it. Placeholder only.
  function handleLogout() {
    try {
      localStorage.removeItem('token')
    } catch {
      // storage unavailable; nothing to clear
    }
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen min-w-[1024px] flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <h1 className="text-lg font-semibold">Office Hours - Teacher</h1>
        <Button onClick={handleLogout}>Log out</Button>
      </header>
      <div className="flex flex-1">
        <nav className="w-56 shrink-0 border-r bg-gray-50 p-4">
          <ul className="space-y-1">
            {links.map((l) => (
              <li key={l.to}>
                <NavLink
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) =>
                    `block rounded px-3 py-2 text-sm ${isActive ? 'bg-indigo-100 font-medium text-indigo-700' : 'hover:bg-gray-100'}`
                  }
                >
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
