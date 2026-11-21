// Purpose: the one sign-in form for both roles (school email + password). Only the words differ; the account decides the role. Errors: inline under the field (aria-invalid, aria-describedby,
// focus on the first bad field) for empty fields; a role="alert" banner for what the server says. After a failed attempt the
// email stays and the password is cleared. No sign-up: the school invites people, and they choose a password from the email.
import { useId, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { safeNext } from '../../auth/access'
import { useAuth } from '../../auth/AuthProvider'
import { messageFor, NO_ACCOUNT, SESSION_ENDED } from '../../auth/messages'
import { hasErrors, validateLogin, type LoginFieldErrors } from '../../auth/validate'
import { USE_MOCKS } from '../../api/client'
import type { Role } from '../../types'
import Button from '../common/Button'
import { inputClass } from '../common/fields'
import DemoAccounts from './DemoAccounts'

const COPY: Record<Role, { title: string; subtitle: string; otherPrompt: string; otherLink: string; otherTo: string }> = {
  student: {
    title: 'Student sign in',
    subtitle: 'Book a spot at your teachers’ office hours.',
    otherPrompt: 'Are you a teacher?',
    otherLink: 'Teacher sign in',
    otherTo: '/teacher/login',
  },
  teacher: {
    title: 'Teacher sign in',
    subtitle: 'Manage your office hours and see who’s coming.',
    otherPrompt: 'Are you a student?',
    otherLink: 'Student sign in',
    otherTo: '/student/login',
  },
}

// 16px text keeps iPhones from zooming into the field.
const field = `${inputClass} !text-base`

export default function LoginForm({ role }: { role: Role }) {
  const copy = COPY[role]
  const { login, ended } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const reason = params.get('reason')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [show, setShow] = useState(false)
  const [pending, setPending] = useState(false)
  const [errors, setErrors] = useState<LoginFieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)

  const emailRef = useRef<HTMLInputElement>(null)
  const passRef = useRef<HTMLInputElement>(null)
  const uid = useId()
  const emailErrId = `${uid}-email-err`
  const passErrId = `${uid}-pass-err`

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (pending) return
    const found = validateLogin(email, password)
    setErrors(found)
    if (hasErrors(found)) {
      ;(found.email ? emailRef : passRef).current?.focus()
      return
    }
    setServerError(null)
    setPending(true)
    try {
      const user = await login(email, password, remember)
      navigate(safeNext(params.get('next'), user.role), { replace: true })
    } catch (err) {
      setServerError(messageFor(err))
      setPassword('')
      passRef.current?.focus()
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-extrabold tracking-tight">{copy.title}</h1>
        <p className="mt-1.5 text-[15px] text-muted">{copy.subtitle}</p>
      </div>

      {(ended || reason === 'expired') && !serverError && (
        <p role="status" className="rounded-xl bg-tint px-4 py-3 text-sm font-semibold text-tint-ink">
          {SESSION_ENDED}
        </p>
      )}
      {serverError && (
        <div role="alert" className="rounded-xl bg-amber px-4 py-3 text-sm font-semibold text-amber-ink">
          {serverError}
        </div>
      )}

      <form noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-email`} className="text-[13px] font-bold text-ink2">
            School email
          </label>
          <input
            ref={emailRef}
            id={`${uid}-email`}
            name="username"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? emailErrId : undefined}
            className={field}
          />
          {errors.email && (
            <p id={emailErrId} className="text-sm font-semibold text-danger">
              {errors.email}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-pass`} className="text-[13px] font-bold text-ink2">
            Password
          </label>
          <div className="relative">
            <input
              ref={passRef}
              id={`${uid}-pass`}
              name="password"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={errors.password ? passErrId : undefined}
              className={`${field} pr-20`}
            />
            <button
              type="button"
              aria-label={show ? 'Hide password' : 'Show password'}
              aria-pressed={show}
              onClick={() => setShow((s) => !s)}
              className="absolute right-1 top-0 flex h-11 min-w-[56px] items-center justify-center rounded-[10px] border-0 bg-transparent px-3 text-sm font-bold text-link"
            >
              {show ? 'Hide' : 'Show'}
            </button>
          </div>
          {errors.password && (
            <p id={passErrId} className="text-sm font-semibold text-danger">
              {errors.password}
            </p>
          )}
        </div>

        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] font-semibold text-ink2">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-5 w-5 accent-brand" />
          Keep me signed in
        </label>

        <Button type="submit" variant="primary" block loading={pending}>
          Sign in
        </Button>

        <Link to="/forgot-password" className="inline-flex min-h-11 items-center text-sm font-bold text-link">
          Forgot password?
        </Link>
      </form>

      {USE_MOCKS && (
        <DemoAccounts
          role={role}
          onPick={(id, pw) => {
            setEmail(id)
            setPassword(pw)
            setErrors({})
            setServerError(null)
          }}
        />
      )}

      <div className="flex flex-col gap-1 border-t border-line pt-4 text-sm text-muted">
        <p>
          {copy.otherPrompt}{' '}
          <Link to={copy.otherTo} className="font-bold text-link">
            {copy.otherLink}
          </Link>
        </p>
        <p>{NO_ACCOUNT}</p>
      </div>
    </div>
  )
}
