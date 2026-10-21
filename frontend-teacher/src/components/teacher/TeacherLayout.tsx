// Owner: Subgroup B (Teacher desktop UI). Teacher side of the app: loads Teacher data, then renders the shared AppShell.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TeacherDataProvider, toTeacherShell, useTeacher } from '../../hooks/TeacherData'
import { useAuth } from '../../hooks/useAuth'
import AppShell from '../common/AppShell'
import Button from '../common/Button'

function Shell() {
  const t = useTeacher()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [pageKey, setPageKey] = useState(0)

  if (t.status === 'error' || (t.status === 'ready' && !t.data)) {
    return (
      <div className="p-8">
        <div role="alert" className="max-w-lg rounded-2xl border border-line bg-surface p-6">
          <p className="font-bold">We could not load your data.</p>
          <p className="mt-1 text-sm text-muted">{t.error}</p>
          <Button className="mt-4" onClick={() => void t.refresh().catch(() => undefined)}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  if (t.status === 'loading' || !t.data) {
    return (
      <div role="status" className="p-8 text-muted">
        Loading your office hours...
      </div>
    )
  }

  return (
    <AppShell
      role="teacher"
      data={toTeacherShell(t.data)}
      showExample={t.usingMocks}
      onMarkAllRead={t.markNotesRead}
      onReset={async () => {
        await t.resetExample()
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

export default function TeacherLayout() {
  return (
    <TeacherDataProvider>
      <Shell />
    </TeacherDataProvider>
  )
}
