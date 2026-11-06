// Purpose: /student/login and /teacher/login. Already signed in -> straight to your home (or the page you asked for).
import { Navigate, useSearchParams } from 'react-router-dom'
import { safeNext } from '../../auth/access'
import { useAuth } from '../../auth/AuthProvider'
import AuthLayout from '../../components/auth/AuthLayout'
import AuthSplash from '../../components/auth/AuthSplash'
import LoginForm from '../../components/auth/LoginForm'
import type { Role } from '../../types'

export default function LoginPage({ role }: { role: Role }) {
  const { status, user } = useAuth()
  const [params] = useSearchParams()

  if (status === 'loading') return <AuthSplash />
  if (status === 'signedIn' && user) return <Navigate to={safeNext(params.get('next'), user.role)} replace />

  return (
    <AuthLayout>
      <LoginForm role={role} />
    </AuthLayout>
  )
}
