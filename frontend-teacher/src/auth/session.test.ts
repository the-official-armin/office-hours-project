// Sessions: the token is refreshed before it runs out (once, even when requests arrive together), a failed refresh never blocks
// a request, "Keep me signed in" carries over to the fresh token, and log out tells the server.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { request } from '../api/client'
import { mockAuthApi, realAuthApi } from './authApi'
import { refreshIfNeeded, setRefresher } from './events'
import { makeMockToken } from './mockToken'
import { clearToken, getToken, isRemembered, loadStoredToken, secondsLeft, setToken } from './tokenStore'

const maya = { id: 'maya', name: 'Maya K.', role: 'student' as const }
const reply = (status: number, body?: unknown) => vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status }))

beforeEach(() => clearToken())
afterEach(() => {
  vi.unstubAllGlobals()
  setRefresher(null)
  clearToken()
})

describe('refresh before the token runs out', () => {
  it('runs before every request, and requests that arrive together share one refresh', async () => {
    const refresh = vi.fn(async () => setToken('fresh', 3600, false))
    setRefresher(refresh)
    const f = reply(200, [])
    vi.stubGlobal('fetch', f)
    await Promise.all([request('/teachers'), request('/bookings?view=student'), request('/requests?view=student')])
    expect(refresh).toHaveBeenCalledTimes(1)
    const sent = (f.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>
    expect(sent.Authorization).toBe('Bearer fresh')
  })

  it('a failed refresh never blocks the request', async () => {
    setToken('old', 60, false)
    setRefresher(() => Promise.reject(new Error('offline')))
    vi.stubGlobal('fetch', reply(200, []))
    await expect(request('/teachers')).resolves.toEqual([])
    await expect(refreshIfNeeded()).resolves.toBeUndefined()
  })

  it('knows how long the token has left', () => {
    expect(secondsLeft()).toBe(0)
    setToken('t', 600, false, 1_000)
    expect(secondsLeft(1_000)).toBe(600)
    expect(secondsLeft(601_000 + 5)).toBe(0)
  })

  it('remembers "Keep me signed in" so a refreshed token is kept the same way, also after a reload', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) })
    vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: () => undefined, removeItem: () => undefined })
    setToken('t', 3600, true)
    expect(isRemembered()).toBe(true)
    expect(loadStoredToken()).toBe('t')
    expect(isRemembered()).toBe(true)
    setToken('t2', 3600, false)
    expect(isRemembered()).toBe(false)
    expect(getToken()).toBe('t2')
  })
})

describe('refresh and log out calls', () => {
  it('posts to /auth/refresh and /auth/logout with the token', async () => {
    let f = reply(200, { accessToken: 'n', tokenType: 'bearer', expiresIn: 3600, user: maya })
    vi.stubGlobal('fetch', f)
    expect((await realAuthApi.refresh('t')).accessToken).toBe('n')
    let [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toMatch(/\/auth\/refresh$/)
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer t')

    f = reply(204)
    vi.stubGlobal('fetch', f)
    await expect(realAuthApi.logout('t')).resolves.toBeUndefined()
    ;[url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toMatch(/\/auth\/logout$/)
    expect(init.method).toBe('POST')
  })

  it('mock mode refreshes a valid token and refuses an expired one', async () => {
    const res = await mockAuthApi.refresh(makeMockToken('student', 'maya', Date.now() + 60_000))
    expect(res.user.id).toBe('maya')
    await expect(mockAuthApi.refresh(makeMockToken('student', 'maya', Date.now() - 1))).rejects.toMatchObject({ kind: 'unauthorized' })
  })
})
