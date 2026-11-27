// Sign-in logic that needs no browser: the reducer, the route-guard decisions, ?next= safety, every error message, the token store,
// the real login calls (fetch stubbed), the mock accounts, and the mock guard that makes expired tokens answer 401.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RuleError } from '../api/errors'
import { decideAccess, loginRedirect, safeNext } from './access'
import { MOCK_ACCOUNTS, MOCK_PASSWORD } from './accounts'
import { mockAuthApi, realAuthApi } from './authApi'
import { authReducer, initialAuthState } from './authReducer'
import { handleUnauthorized, setUnauthorizedHandler } from './events'
import { guardMock } from './guardMock'
import { AuthError, FIELD_ERRORS, messageFor, MESSAGES, NO_ACCOUNT, pageIsFor, SESSION_ENDED, SIGNED_OUT } from './messages'
import { makeMockToken, parseMockToken } from './mockToken'
import { clearToken, getToken, getTokenRaw, loadStoredToken, setToken } from './tokenStore'
import { hasErrors, validateLogin, validateNewPassword } from './validate'

const maya = { id: 'maya', name: 'Maya K.', role: 'student' as const }
const rivera = { id: 'rivera', name: 'Ms. Rivera', role: 'teacher' as const }

describe('auth reducer', () => {
  it('starts loading, with nobody signed in', () => {
    expect(initialAuthState).toEqual({ status: 'loading', user: null, ended: false, loggedOut: false })
  })
  it('a saved session that checks out, or a login, signs the person in', () => {
    expect(authReducer(initialAuthState, { type: 'restored', user: maya })).toEqual({ status: 'signedIn', user: maya, ended: false, loggedOut: false })
    expect(authReducer(initialAuthState, { type: 'signedIn', user: rivera }).user).toBe(rivera)
  })
  it('no saved session means signed out, not "ended"', () => {
    expect(authReducer(initialAuthState, { type: 'none' })).toEqual({ status: 'signedOut', user: null, ended: false, loggedOut: false })
  })
  it('logging out clears the person and records that it was their choice', () => {
    const on = authReducer(initialAuthState, { type: 'signedIn', user: maya })
    const out = authReducer(on, { type: 'signedOut' })
    expect(out).toEqual({ status: 'signedOut', user: null, ended: false, loggedOut: true })
    expect(authReducer(out, { type: 'signedIn', user: maya }).loggedOut).toBe(false)
  })
  it('a 401 on a working session ends it and says so, until the next sign-in', () => {
    const on = authReducer(initialAuthState, { type: 'signedIn', user: maya })
    const ended = authReducer(on, { type: 'expired' })
    expect(ended).toEqual({ status: 'signedOut', user: null, ended: true, loggedOut: false })
    expect(authReducer(ended, { type: 'signedIn', user: maya }).ended).toBe(false)
  })
})

describe('RequireRole decisions', () => {
  it('waits while the saved sign-in is being checked, never redirecting early', () => {
    expect(decideAccess('loading', null, 'student')).toEqual({ kind: 'wait' })
  })
  it('sends a signed-out visitor to sign in', () => {
    expect(decideAccess('signedOut', null, 'teacher')).toEqual({ kind: 'login' })
  })
  it('lets the right role in', () => {
    expect(decideAccess('signedIn', maya, 'student')).toEqual({ kind: 'allow' })
    expect(decideAccess('signedIn', rivera, 'teacher')).toEqual({ kind: 'allow' })
  })
  it('sends the wrong role to their own home', () => {
    expect(decideAccess('signedIn', maya, 'teacher')).toEqual({ kind: 'home', role: 'student' })
    expect(decideAccess('signedIn', rivera, 'student')).toEqual({ kind: 'home', role: 'teacher' })
  })
  it('says which side a page is for', () => {
    expect(pageIsFor('teacher')).toBe('That page is for teachers')
    expect(pageIsFor('student')).toBe('That page is for students')
  })
  it('remembers the page that was asked for, and whether the session ended', () => {
    expect(loginRedirect('teacher', { pathname: '/teacher/calendar', search: '?day=2026-11-10' })).toBe(
      '/teacher/login?next=%2Fteacher%2Fcalendar%3Fday%3D2026-11-10',
    )
    expect(loginRedirect('student', { pathname: '/student' }, true)).toBe('/student/login?next=%2Fstudent&reason=expired')
  })
})

describe('?next= is only followed when it is safe', () => {
  it('follows a page of the signed-in role, with its query', () => {
    expect(safeNext('/teacher/calendar', 'teacher')).toBe('/teacher/calendar')
    expect(safeNext('/student/teachers/rivera?day=2026-11-10', 'student')).toBe('/student/teachers/rivera?day=2026-11-10')
    expect(safeNext('/student', 'student')).toBe('/student')
  })
  it('goes home when the page belongs to the other role', () => {
    expect(safeNext('/teacher/calendar', 'student')).toBe('/student')
    expect(safeNext('/student/bookings', 'teacher')).toBe('/teacher')
  })
  it('goes home for anything that is not an app path', () => {
    for (const bad of ['https://evil.example/teacher', '//evil.example/teacher', '/\\evil.example', 'javascript:alert(1)', 'teacher/calendar', '', null, undefined]) {
      expect(safeNext(bad as string | null | undefined, 'teacher'), String(bad)).toBe('/teacher')
    }
  })
  it('does not bounce back to a login page, and lookalike prefixes do not count', () => {
    expect(safeNext('/teacher/login', 'teacher')).toBe('/teacher')
    expect(safeNext('/teacherx/calendar', 'teacher')).toBe('/teacher')
    expect(safeNext('/teacher/../student', 'teacher')).toBe('/teacher')
  })
})

describe('error messages', () => {
  it('has the exact words for each case, and never says which of email or password was wrong', () => {
    expect(MESSAGES.invalid).toBe('Email or password is incorrect.')
    expect(MESSAGES.unauthorized).toBe('Your session ended. Sign in again.')
    expect(SESSION_ENDED).toBe('Your session ended. Sign in again.')
    expect(MESSAGES.too_many).toBe('Too many tries. Wait a few minutes and try again.')
    expect(MESSAGES.network).toBe('Can’t reach the server. Check your connection.')
    expect(MESSAGES.invalid).not.toMatch(/^(Email|Password) is/)
    expect(SIGNED_OUT).toBe('Signed out')
    expect(NO_ACCOUNT).toBe('No account? Your school sets it up for you.')
  })
  it('maps each kind of failure to its message, and anything unknown to the server one', () => {
    for (const kind of ['invalid', 'unauthorized', 'too_many', 'network', 'server', 'link', 'weak_password'] as const) {
      expect(messageFor(new AuthError(kind))).toBe(MESSAGES[kind])
    }
    expect(messageFor(new Error('boom'))).toBe(MESSAGES.server)
  })
  it('asks for an empty email or password inline, and nothing else', () => {
    expect(validateLogin('', '')).toEqual({ email: FIELD_ERRORS.email, password: FIELD_ERRORS.password })
    expect(validateLogin('   ', 'x')).toEqual({ email: 'Enter your email.' })
    expect(validateLogin('maya@example.com', '')).toEqual({ password: 'Enter your password.' })
    expect(hasErrors(validateLogin('maya@example.com', 'x'))).toBe(false)
  })
  it('checks a new password like the server: long enough, not the email, typed the same twice', () => {
    const email = 'ava.chen@waprep.org'
    expect(validateNewPassword('short', 'short', email)).toEqual({ password: FIELD_ERRORS.shortPassword })
    expect(validateNewPassword('x'.repeat(129), 'x'.repeat(129), email)).toEqual({ password: FIELD_ERRORS.longPassword })
    expect(validateNewPassword('Ava.Chen@waprep.org', 'Ava.Chen@waprep.org', email)).toEqual({ password: FIELD_ERRORS.emailPassword })
    expect(validateNewPassword('a good long password', 'a good long passwort', email)).toEqual({ confirm: FIELD_ERRORS.confirm })
    expect(validateNewPassword('a good long password', 'a good long password', email)).toEqual({})
  })
})

describe('token store', () => {
  beforeEach(() => clearToken())

  it('gives the token back until it expires, never after', () => {
    setToken('abc', 60, false, 1_000)
    expect(getToken(1_000 + 59_000)).toBe('abc')
    expect(getToken(1_000 + 60_000)).toBeNull()
    expect(getTokenRaw()).toBe('abc') // the mock guard still needs to see an expired token
  })
  it('forgets it on clear, and an expired saved token is not restored', () => {
    setToken('abc', 60, true)
    clearToken()
    expect(getToken()).toBeNull()
    expect(loadStoredToken()).toBeNull()
    setToken('old', 1, false, Date.now() - 10_000)
    expect(loadStoredToken()).toBeNull()
  })
})

describe('real login calls', () => {
  afterEach(() => vi.unstubAllGlobals())

  const answer = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }))

  it('posts email and password and returns the token and the person', async () => {
    const fetchMock = answer(200, { accessToken: 't', tokenType: 'bearer', expiresIn: 3600, user: maya })
    vi.stubGlobal('fetch', fetchMock)
    const res = await realAuthApi.login('maya@example.com', 'demo-password')
    expect(res).toMatchObject({ accessToken: 't', expiresIn: 3600, user: maya })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toMatch(/\/auth\/login$/)
    expect(JSON.parse(String(init.body))).toEqual({ email: 'maya@example.com', password: 'demo-password' })
  })
  it('checks a saved token with GET /auth/me and the Bearer header', async () => {
    const fetchMock = answer(200, maya)
    vi.stubGlobal('fetch', fetchMock)
    expect(await realAuthApi.me('t')).toEqual(maya)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toMatch(/\/auth\/me$/)
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer t')
  })
  it('reads an email link, chooses a password with it, and asks for a reset link', async () => {
    const info = { purpose: 'activate', name: 'Ava Chen', email: 'ava@waprep.org', role: 'student' }
    let fetchMock = answer(200, info)
    vi.stubGlobal('fetch', fetchMock)
    expect(await realAuthApi.link('a/b')).toEqual(info)
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toMatch(/\/auth\/link\/a%2Fb$/)

    fetchMock = answer(200, { accessToken: 't', tokenType: 'bearer', expiresIn: 3600, user: maya })
    vi.stubGlobal('fetch', fetchMock)
    await realAuthApi.setPassword('tok', 'a good long password')
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toMatch(/\/auth\/set-password$/)
    expect(JSON.parse(String(init.body))).toEqual({ token: 'tok', password: 'a good long password' })

    fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(realAuthApi.forgotPassword('maya@example.com')).resolves.toBeUndefined()
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toMatch(/\/auth\/forgot-password$/)
  })
  it('turns each answer into the right kind of failure', async () => {
    const kindOf = async (status: number, body: unknown) => {
      vi.stubGlobal('fetch', answer(status, body))
      return realAuthApi.login('maya@example.com', 'x').then(
        () => 'ok',
        (e: AuthError) => e.kind,
      )
    }
    expect(await kindOf(401, { code: 'invalid_credentials', message: 'Invalid role, user ID, or password.' })).toBe('invalid')
    expect(await kindOf(401, { code: 'unauthorized', message: '' })).toBe('unauthorized')
    expect(await kindOf(422, { detail: [] })).toBe('invalid')
    expect(await kindOf(429, {})).toBe('too_many')
    expect(await kindOf(410, { code: 'link_invalid', message: '' })).toBe('link')
    expect(await kindOf(422, { code: 'weak_password', message: '' })).toBe('weak_password')
    expect(await kindOf(500, {})).toBe('server')
  })
  it('says "can’t reach the server" when the request never arrives', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    await expect(realAuthApi.login('maya@example.com', 'x')).rejects.toMatchObject({ kind: 'network', message: MESSAGES.network })
  })
})

describe('mock accounts act like the real API', () => {
  it('signs each example account in with its email and the demo password', async () => {
    for (const a of MOCK_ACCOUNTS) {
      const res = await mockAuthApi.login(a.email.toUpperCase(), MOCK_PASSWORD)
      expect(res.user).toEqual({ id: a.id, role: a.role, name: a.name })
      expect(res.expiresIn).toBe(3600)
      expect(await mockAuthApi.me(res.accessToken)).toEqual(res.user)
    }
    expect(MOCK_ACCOUNTS.map((a) => a.id)).toEqual(expect.arrayContaining(['maya', 'daniel', 'rivera', 'okafor']))
  })
  it('answers 401 invalid for a wrong password or an unknown email', async () => {
    await expect(mockAuthApi.login('maya@example.com', 'nope')).rejects.toMatchObject({ kind: 'invalid' })
    await expect(mockAuthApi.login('nobody@example.com', MOCK_PASSWORD)).rejects.toMatchObject({ kind: 'invalid' })
    await expect(mockAuthApi.login('maya', MOCK_PASSWORD)).rejects.toMatchObject({ kind: 'invalid' })
  })
  it('has no email in mock mode, so every link is expired and forgot password just says it was sent', async () => {
    await expect(mockAuthApi.link('t')).rejects.toMatchObject({ kind: 'link' })
    await expect(mockAuthApi.setPassword('t', 'a good long password')).rejects.toMatchObject({ kind: 'link' })
    await expect(mockAuthApi.forgotPassword('maya@example.com')).resolves.toBeUndefined()
  })
  it('rejects a token that is bad or has run out', async () => {
    await expect(mockAuthApi.me('garbage')).rejects.toMatchObject({ kind: 'unauthorized' })
    await expect(mockAuthApi.me(makeMockToken('student', 'maya', Date.now() - 1))).rejects.toMatchObject({ kind: 'unauthorized' })
  })
  it('reads who a mock token is for', () => {
    expect(parseMockToken(makeMockToken('teacher', 'okafor', 5))).toEqual({ role: 'teacher', id: 'okafor', expiresAt: 5 })
    expect(parseMockToken('nope')).toBeNull()
    expect(parseMockToken(null)).toBeNull()
  })
})

describe('mock guard: an expired token answers 401 like the server', () => {
  afterEach(() => {
    clearToken()
    setUnauthorizedHandler(null)
  })
  const api = guardMock({ getThing: async (n: number) => n * 2 })

  it('passes calls through with no token (unit tests, before sign-in)', async () => {
    expect(await api.getThing(2)).toBe(4)
  })
  it('passes calls through while the token is good', async () => {
    setToken(makeMockToken('student', 'maya', Date.now() + 60_000), 60, false)
    expect(await api.getThing(3)).toBe(6)
  })
  it('refuses once the token has run out: tells the auth layer and throws "unauthorized"', async () => {
    const ended = vi.fn()
    setUnauthorizedHandler(ended)
    setToken(makeMockToken('student', 'maya', Date.now() - 1), 60, false, Date.now() - 120_000)
    await expect(api.getThing(1)).rejects.toMatchObject({ code: 'unauthorized', message: SESSION_ENDED })
    await expect(api.getThing(1)).rejects.toBeInstanceOf(RuleError)
    expect(ended).toHaveBeenCalledTimes(2)
  })
  it('the unauthorized hook is a no-op when nobody listens', () => {
    expect(() => handleUnauthorized()).not.toThrow()
  })
})
