// Purpose: /activate and /reset-password, opened from the invite or "Forgot password" email (?token=...). The person chooses a
// password and is signed in. A new teacher goes straight to Office hours, since students can't book until they set them.
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi, type LinkInfo } from '../../auth/authApi'
import { useAuth } from '../../auth/AuthProvider'
import { LINK_HELP, MESSAGES, messageFor } from '../../auth/messages'
import { hasErrors, MIN_PASSWORD, validateNewPassword, type NewPasswordErrors } from '../../auth/validate'
import AuthLayout from '../../components/auth/AuthLayout'
import AuthSplash from '../../components/auth/AuthSplash'
import Button from '../../components/common/Button'
import { HOME_PATH } from '../../components/common/nav'
import { inputClass } from '../../components/common/fields'

// 16px text keeps iPhones from zooming into the field.
const field = `${inputClass} !text-base`

type Load = { state: 'loading' } | { state: 'ready'; info: LinkInfo } | { state: 'failed'; message: string }

export default function SetPasswordPage({ purpose }: { purpose: 'activate' | 'reset' }) {
  const { loginWithLink } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // Read the token once, then take it out of the address bar (and out of the history and any Referer header).
  const [token] = useState(() => params.get('token') ?? '')
  const [load, setLoad] = useState<Load>({ state: 'loading' })

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [errors, setErrors] = useState<NewPasswordErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const passRef = useRef<HTMLInputElement>(null)
  const confirmRef = useRef<HTMLInputElement>(null)
  const uid = useId()

  useEffect(() => {
    window.history.replaceState(null, '', window.location.pathname)
    let cancelled = false
    if (!token) {
      setLoad({ state: 'failed', message: MESSAGES.link })
      return
    }
    authApi.link(token).then(
      (info) => !cancelled && setLoad({ state: 'ready', info }),
      (err: unknown) => !cancelled && setLoad({ state: 'failed', message: messageFor(err) }),
    )
    return () => {
      cancelled = true
    }
  }, [token])

  if (load.state === 'loading') return <AuthSplash />

  if (load.state === 'failed') {
    return (
      <AuthLayout>
        <div className="flex flex-col gap-6">
          <h1 className="text-[28px] font-extrabold tracking-tight">This link can’t be used</h1>
          <div role="alert" className="rounded-xl bg-amber px-4 py-3 text-sm font-semibold text-amber-ink">
            {load.message}
          </div>
          <p className="text-[15px] text-muted">{LINK_HELP}</p>
          <div className="flex flex-col gap-1 text-sm">
            <Link to="/forgot-password" className="font-bold text-link">
              Forgot password
            </Link>
            <Link to="/login" className="font-bold text-link">
              Sign in
            </Link>
          </div>
        </div>
      </AuthLayout>
    )
  }

  const { info } = load
  const first = info.name.split(' ')[0] || info.name

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (pending) return
    const found = validateNewPassword(password, confirm, info.email)
    setErrors(found)
    if (hasErrors(found)) {
      ;(found.password ? passRef : confirmRef).current?.focus()
      return
    }
    setServerError(null)
    setPending(true)
    try {
      const user = await loginWithLink(token, password)
      const firstTeacherVisit = purpose === 'activate' && user.role === 'teacher'
      navigate(firstTeacherVisit ? '/teacher/office-hours' : HOME_PATH[user.role], { replace: true })
    } catch (err) {
      setServerError(messageFor(err))
      setPending(false)
    }
  }

  return (
    <AuthLayout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight">
            {purpose === 'activate' ? `Welcome, ${first}` : 'Choose a new password'}
          </h1>
          <p className="mt-1.5 text-[15px] text-muted">
            {purpose === 'activate' ? 'Choose a password for your account.' : 'Then you’re signed in.'} You’ll sign in with{' '}
            <b className="font-bold text-ink2">{info.email}</b>.
          </p>
        </div>

        {serverError && (
          <div role="alert" className="rounded-xl bg-amber px-4 py-3 text-sm font-semibold text-amber-ink">
            {serverError}
          </div>
        )}

        <form noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
          {/* Lets password managers save the new password under the right email. */}
          <input type="email" name="email" autoComplete="username" value={info.email} readOnly hidden />

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${uid}-pass`} className="text-[13px] font-bold text-ink2">
              New password
            </label>
            <div className="relative">
              <input
                ref={passRef}
                id={`${uid}-pass`}
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={`${uid}-pass-hint`}
                className={`${field} pr-16`}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-pressed={show}
                className="absolute inset-y-0 right-0 min-h-11 border-0 bg-transparent px-3 text-sm font-bold text-link"
              >
                {show ? 'Hide' : 'Show'}
              </button>
            </div>
            <p id={`${uid}-pass-hint`} className={`text-sm ${errors.password ? 'font-semibold text-danger' : 'text-muted'}`}>
              {errors.password ?? `At least ${MIN_PASSWORD} characters. A few words together is easy to remember.`}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${uid}-confirm`} className="text-[13px] font-bold text-ink2">
              Type it again
            </label>
            <input
              ref={confirmRef}
              id={`${uid}-confirm`}
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={errors.confirm ? true : undefined}
              aria-describedby={errors.confirm ? `${uid}-confirm-err` : undefined}
              className={field}
            />
            {errors.confirm && (
              <p id={`${uid}-confirm-err`} className="text-sm font-semibold text-danger">
                {errors.confirm}
              </p>
            )}
          </div>

          <Button type="submit" variant="primary" block loading={pending}>
            {purpose === 'activate' ? 'Set password and sign in' : 'Save and sign in'}
          </Button>
        </form>
      </div>
    </AuthLayout>
  )
}
