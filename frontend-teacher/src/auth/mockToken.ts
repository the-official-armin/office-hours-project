// Mock mode only: the fake access token "mock.<role>.<id>.<expiresAtMs>". It lets the mock APIs know who is signed in and
// whether the token has run out, the way the real backend reads a JWT.
import type { Role } from '../types'

export interface MockClaims {
  role: Role
  id: string
  expiresAt: number
}

export const makeMockToken = (role: Role, id: string, expiresAt: number): string => `mock.${role}.${id}.${expiresAt}`

export function parseMockToken(token: string | null): MockClaims | null {
  if (!token) return null
  const [prefix, role, id, exp] = token.split('.')
  const expiresAt = Number(exp)
  if (prefix !== 'mock' || (role !== 'student' && role !== 'teacher') || !id || !Number.isFinite(expiresAt)) return null
  return { role, id, expiresAt }
}
