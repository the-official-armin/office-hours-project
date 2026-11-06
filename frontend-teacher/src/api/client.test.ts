// client.ts: sends the Bearer token, and treats a 401 as "the session ended" (tells the auth layer, then throws).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setUnauthorizedHandler } from '../auth/events'
import { MESSAGES } from '../auth/messages'
import { clearToken, setToken } from '../auth/tokenStore'
import { request } from './client'
import { RuleError } from './errors'

const reply = (status: number, body?: unknown) => vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status }))
const headersOf = (f: ReturnType<typeof reply>, call: number) => (f.mock.calls[call] as unknown as [string, RequestInit])[1].headers as Record<string, string>

beforeEach(() => clearToken())
afterEach(() => {
  vi.unstubAllGlobals()
  setUnauthorizedHandler(null)
  clearToken()
})

describe('request', () => {
  it('adds the Bearer header when signed in, and none when signed out', async () => {
    const f = reply(200, [])
    vi.stubGlobal('fetch', f)
    await request('/teachers')
    expect(headersOf(f, 0).Authorization).toBeUndefined()
    setToken('tok', 60, false)
    await request('/teachers')
    expect(headersOf(f, 1).Authorization).toBe('Bearer tok')
  })

  it('a 401 tells the auth layer once and throws "unauthorized" with the session-ended words', async () => {
    const ended = vi.fn()
    setUnauthorizedHandler(ended)
    vi.stubGlobal('fetch', reply(401, { code: 'unauthorized', message: 'A bearer token is required.' }))
    await expect(request('/bookings?view=student')).rejects.toMatchObject({ code: 'unauthorized', message: MESSAGES.unauthorized })
    expect(ended).toHaveBeenCalledTimes(1)
  })

  it('other errors keep the server code and message and do not end the session', async () => {
    const ended = vi.fn()
    setUnauthorizedHandler(ended)
    vi.stubGlobal('fetch', reply(409, { code: 'full', message: 'That office hour is full. Pick another one.' }))
    await expect(request('/bookings', { method: 'POST' })).rejects.toMatchObject({ code: 'full', message: 'That office hour is full. Pick another one.' })
    expect(ended).not.toHaveBeenCalled()
  })

  it('says it cannot reach the server when the request never arrives', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    const err = await request('/teachers').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(RuleError)
    expect((err as RuleError).message).toBe(MESSAGES.network)
  })

  it('returns nothing for a 204', async () => {
    vi.stubGlobal('fetch', reply(204))
    expect(await request('/bookings/5', { method: 'DELETE' })).toBeUndefined()
  })
})
