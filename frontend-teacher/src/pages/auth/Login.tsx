// PLACEHOLDER sign-in for the local demo, same as the design reference: pick a side and you are signed in as the
// example person. The auth team owns real login (FastAPI + JWT); replace this page and src/hooks/useAuth.ts then.
import { Navigate, useNavigate } from 'react-router-dom'
import { DEMO_ACCOUNTS } from '../../api/auth'
import { HOME_PATH } from '../../components/common/nav'
import Icon from '../../components/common/Icon'
import { initials } from '../../lib/dates'
import { useAuth } from '../../hooks/useAuth'

export default function Login() {
  const { role, login } = useAuth()
  const navigate = useNavigate()

  if (role) return <Navigate to={HOME_PATH[role]} replace />

  return (
    <div className="flex min-h-screen items-center justify-center px-[max(16px,env(safe-area-inset-right,0px))] py-6">
      <div className="flex w-[min(520px,100%)] flex-col gap-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-accent text-[#12303a]">
          <Icon name="clock" size={26} />
        </div>
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight">Office Hours</h1>
          <p className="mt-1.5 text-[15px] text-muted">
            Book a seat with a teacher, or manage your office hours. Pick a side to look around.
          </p>
        </div>

        {DEMO_ACCOUNTS.map((a) => (
          <button
            key={a.role}
            type="button"
            onClick={() => void login(a.role).then(() => navigate(HOME_PATH[a.role], { replace: true }))}
            className="flex min-h-[72px] w-full items-center gap-3.5 rounded-[14px] border border-edge bg-surface p-4 text-left hover:border-brand"
          >
            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-tint font-extrabold text-tint-ink">
              {initials(a.name)}
            </span>
            <span>
              <b className="block text-base font-extrabold capitalize">{a.role}</b>
              <small className="mt-0.5 block text-[13px] text-muted">
                {a.name}, {a.detail}
              </small>
            </span>
          </button>
        ))}

        <p className="text-[13px] text-muted">
          Example data saved in this browser. Real sign-in will come from the auth team.
        </p>
      </div>
    </div>
  )
}
