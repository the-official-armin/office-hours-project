// Owner: Subgroup B (Teacher desktop UI). Teacher side of the app: loads Teacher data, then renders the shared AppShell.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toTeacherShell } from '../../api/shell'
import { TeacherDataProvider, useTeacher } from '../../hooks/TeacherDataProvider'
import { useAuth } from '../../hooks/useAuth'
import AppShell from '../common/AppShell'
import Button from './Button'
import { Loading } from './ui'

function Shell() {
  const t = useTeacher()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [pageKey, setPageKey] = useState(0)

  if (t.status === 'loading' || (t.status === 'ready' && !t.data)) {
    return (
      <div className="p-8">
        <Loading label="Loading your office hours..." />
      </div>
    )
  }

  if (t.status === 'error' || !t.data) {
    return (
      <div className="p-8">
        <div role="alert" className="max-w-lg rounded-2xl border border-line bg-surface p-6">
          <p className="font-bold">We could not load your data.</p>
          <p className="mt-1 text-sm text-muted">{t.error}</p>
          <Button className="mt-4" onClick={() => void t.reload().catch(() => undefined)}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  const { data } = t

  return (
    <AppShell
      role="teacher"
      data={toTeacherShell(data.profile, data.requests, data.notifications)}
      showExample={t.usingMocks}
      onMarkAllRead={t.markAllRead}
      onReset={async () => {
        await t.demo.reset()
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
