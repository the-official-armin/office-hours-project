// Mock mode only: makes the mock APIs refuse a call once the mock token has run out, like the real server answering 401.
// With no token at all (unit tests, or before sign-in) calls pass through untouched.
import { RuleError } from '../api/errors'
import { handleUnauthorized } from './events'
import { SESSION_ENDED } from './messages'
import { parseMockToken } from './mockToken'
import { getTokenRaw } from './tokenStore'

type AsyncFn = (...args: never[]) => Promise<unknown>

export function guardMock<T extends Record<string, AsyncFn>>(api: T): T {
  const out: Record<string, AsyncFn> = {}
  for (const [name, fn] of Object.entries(api)) {
    out[name] = (async (...args: never[]) => {
      const claims = parseMockToken(getTokenRaw())
      if (claims && claims.expiresAt <= Date.now()) {
        handleUnauthorized()
        throw new RuleError('unauthorized', SESSION_ENDED)
      }
      return fn(...args)
    }) as AsyncFn
  }
  return out as T
}
