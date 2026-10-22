// Student side of the app: loads Student data, then renders the shared AppShell.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { StudentDataProvider, toStudentShell, useStudent } from '../../hooks/StudentData'
import { useAuth } from '../../hooks/useAuth'
import AppShell from '../common/AppShell'

function Shell() {
  const s = useStudent()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [pageKey, setPageKey] = useState(0)

  if (s.status === 'error' || (s.status === 'ready' && !s.data)) {
    return (
      <div className="p-8">
        <div role="alert" className="max-w-lg rounded-2xl border border-line bg-surface p-6">
          <p className="font-bold">We could not load your data.</p>
          <p className="mt-1 text-sm text-muted">{s.error}</p>
          <button
            type="button"
            onClick={() => void s.refresh().catch(() => undefined)}
            className="mt-4 rounded-[10px] border border-brand bg-brand px-4 py-2 text-sm font-bold text-on-brand"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (s.status === 'loading' || !s.data) {
    return (
      <div role="status" className="p-8 text-muted">
        Loading...
      </div>
    )
  }

  return (
    <AppShell
      role="student"
      data={toStudentShell(s.data, s.now)}
      showExample={s.usingMocks}
      onMarkAllRead={s.markNotesRead}
      onReset={async () => {
        await s.resetExample()
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

export default function StudentLayout() {
  return (
    <StudentDataProvider>
      <Shell />
    </StudentDataProvider>
  )
}
