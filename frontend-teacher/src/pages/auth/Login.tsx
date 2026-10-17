// PLACEHOLDER login for the local demo. The auth team owns real login (FastAPI + JWT); replace this page and
// src/hooks/useAuth.ts then. Pages should not need to change.
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { DEMO_EMAIL, DEMO_PASSWORD } from '../../api/auth'
import Button from '../../components/teacher/Button'
import FormInput from '../../components/teacher/FormInput'
import { Notice } from '../../components/teacher/ui'
import { useAuth } from '../../hooks/useAuth'

export default function Login() {
  const { isLoggedIn, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState(DEMO_EMAIL)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (isLoggedIn) return <Navigate to="/teacher" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(email, password)
      navigate('/teacher', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen min-w-[1024px] items-center justify-center bg-canvas">
      <div className="w-[420px] rounded-2xl border border-line bg-surface p-8">
        <h1 className="text-2xl font-extrabold">Office Hours</h1>
        <p className="mb-5 text-muted">Teacher login</p>

        <Notice tone="warn">
          <p className="font-bold">Placeholder login for the local demo.</p>
          <p>
            Email: <code>{DEMO_EMAIL}</code>
            <br />
            Password: <code>{DEMO_PASSWORD}</code>
          </p>
          <p className="mt-1">Real login is owned by the auth team.</p>
        </Notice>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <FormInput label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <FormInput
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <div aria-live="polite" role="status">
            {error && <p className="rounded-lg bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">{error}</p>}
          </div>
          <Button type="submit" loading={busy} className="w-full">
            Log in
          </Button>
        </form>
      </div>
    </div>
  )
}
