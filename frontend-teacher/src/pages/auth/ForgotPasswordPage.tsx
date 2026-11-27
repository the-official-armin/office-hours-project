// Purpose: /forgot-password. Emails a link to choose a new password (or a new invite to someone who never activated). The answer
// is the same whether or not the email has an account, so nobody can use this page to find out who is registered.
import { useId, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../../auth/authApi'
import { FIELD_ERRORS, messageFor, RESET_SENT } from '../../auth/messages'
import AuthLayout from '../../components/auth/AuthLayout'
import Button from '../../components/common/Button'
import { inputClass } from '../../components/common/fields'

const field = `${inputClass} !text-base`

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [pending, setPending] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  const uid = useId()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (pending) return
    if (!email.trim()) {
      setError(FIELD_ERRORS.email)
      ref.current?.focus()
      return
    }
    setError(null)
    setServerError(null)
    setPending(true)
    try {
      await authApi.forgotPassword(email.trim())
      setSent(true)
    } catch (err) {
      setServerError(messageFor(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight">Forgot password</h1>
          <p className="mt-1.5 text-[15px] text-muted">We’ll email you a link to choose a new one.</p>
        </div>

        {sent ? (
          <p role="status" className="rounded-xl bg-tint px-4 py-3 text-sm font-semibold text-tint-ink">
            {RESET_SENT}
          </p>
        ) : (
          <form noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
            {serverError && (
              <div role="alert" className="rounded-xl bg-amber px-4 py-3 text-sm font-semibold text-amber-ink">
                {serverError}
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${uid}-email`} className="text-[13px] font-bold text-ink2">
                School email
              </label>
              <input
                ref={ref}
                id={`${uid}-email`}
                type="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${uid}-email-err` : undefined}
                className={field}
              />
              {error && (
                <p id={`${uid}-email-err`} className="text-sm font-semibold text-danger">
                  {error}
                </p>
              )}
            </div>
            <Button type="submit" variant="primary" block loading={pending}>
              Email me a link
            </Button>
          </form>
        )}

        <Link to="/login" className="text-sm font-bold text-link">
          Back to sign in
        </Link>
      </div>
    </AuthLayout>
  )
}
