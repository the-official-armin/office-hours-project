// Student side of the app: loads the Student shell data, then renders the shared AppShell.
// Placeholder wiring until Phase 4 builds the Student pages.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { USE_MOCKS } from '../../api/client'
import { useAuth } from '../../hooks/useAuth'
import { useStudentShell } from '../../hooks/useStudentShell'
import AppShell from '../common/AppShell'

export default function StudentLayout() {
  const { data, error, reload, markAllRead, reset } = useStudentShell()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [pageKey, setPageKey] = useState(0)

  if (error) {
    return (
      <div className="p-8">
        <div role="alert" className="max-w-lg rounded-2xl border border-line bg-surface p-6">
          <p className="font-bold">We could not load your data.</p>
          <p className="mt-1 text-sm text-muted">{error}</p>
          <button
            type="button"
            onClick={reload}
            className="mt-4 rounded-[10px] border border-brand bg-brand px-4 py-2 text-sm font-bold text-on-brand"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div role="status" className="p-8 text-muted">
        Loading...
      </div>
    )
  }

  return (
    <AppShell
      role="student"
      data={data}
      showExample={USE_MOCKS}
      onMarkAllRead={markAllRead}
      onReset={async () => {
        await reset()
        setPageKey((k) => k + 1)
      }}
      onLogout={() => {
        logout()
        navigate('/login', { replace: true })
      }}
      pageKey={pageKey}
    />
  )
}
