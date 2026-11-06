// Mock mode only: who the mock APIs answer for. In the app it is the person who signed in (read from the mock token, the way the
// real server reads a JWT). With no token (unit tests) it is the example student and teacher, so those tests need no sign-in.
import { DEFAULT_STUDENT, DEFAULT_TEACHER } from '../../auth/accounts'
import { parseMockToken } from '../../auth/mockToken'
import { getTokenRaw } from '../../auth/tokenStore'

export function meStudent(): string {
  const claims = parseMockToken(getTokenRaw())
  return claims && claims.role === 'student' ? claims.id : DEFAULT_STUDENT
}

export function meTeacher(): string {
  const claims = parseMockToken(getTokenRaw())
  return claims && claims.role === 'teacher' ? claims.id : DEFAULT_TEACHER
}
