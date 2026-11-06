// Purpose: /login. Two big buttons, student or teacher, then that side's sign-in. Points at the side used last time.
import { Link, Navigate } from 'react-router-dom'
import { HOME_PATH } from '../../components/common/nav'
import { useAuth } from '../../auth/AuthProvider'
import { getLastRole, setLastRole } from '../../auth/lastRole'
import AuthLayout from '../../components/auth/AuthLayout'
import AuthSplash from '../../components/auth/AuthSplash'
import type { Role } from '../../types'

const CHOICES: { role: Role; label: string; hint: string; to: string }[] = [
  { role: 'student', label: 'I\u2019m a student', hint: 'Book a spot at your teachers\u2019 office hours.', to: '/student/login' },
  { role: 'teacher', label: 'I\u2019m a teacher', hint: 'Manage your office hours and see who\u2019s coming.', to: '/teacher/login' },
]

export default function RoleChooser() {
  const { status, user } = useAuth()
  if (status === 'loading') return <AuthSplash />
  if (status === 'signedIn' && user) return <Navigate to={HOME_PATH[user.role]} replace />

  const last = getLastRole()
  return (
    <AuthLayout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight">Washington Prep Office Hours</h1>
          <p className="mt-1.5 text-[15px] text-muted">Choose how you sign in.</p>
        </div>
        <div className="flex flex-col gap-3">
          {CHOICES.map((c) => (
            <Link
              key={c.role}
              to={c.to}
              onClick={() => setLastRole(c.role)}
              className={`flex min-h-[84px] flex-col justify-center gap-0.5 rounded-[14px] border p-4 no-underline hover:border-brand ${
                last === c.role ? 'border-brand bg-tint text-tint-ink' : 'border-edge bg-surface text-ink'
              }`}
            >
              <b className="text-lg font-extrabold">{c.label}</b>
              <span className="text-[13px] text-muted">{c.hint}</span>
              {last === c.role && <span className="text-[13px] font-bold">You signed in this way last time</span>}
            </Link>
          ))}
        </div>
        <p className="text-sm text-muted">No account? Your school sets it up for you.</p>
      </div>
    </AuthLayout>
  )
}
