// Every sentence the sign-in screens can show, in one place. Plain words, no codes. Never says which of user ID or password was wrong.

export type AuthErrorKind = 'invalid' | 'unauthorized' | 'too_many' | 'network' | 'server'

/** What the login and session code throws. `kind` picks the message; the UI never shows server text for these. */
export class AuthError extends Error {
  kind: AuthErrorKind

  constructor(kind: AuthErrorKind) {
    super(MESSAGES[kind])
    this.name = 'AuthError'
    this.kind = kind
  }
}

export const MESSAGES: Record<AuthErrorKind, string> = {
  invalid: 'User ID or password is incorrect.',
  unauthorized: 'Your session ended. Sign in again.',
  too_many: 'Too many tries. Wait a few minutes and try again.',
  network: 'Can’t reach the server. Check your connection.',
  server: 'Something went wrong on our side. Try again in a moment.',
}

export const SESSION_ENDED = MESSAGES.unauthorized
export const SIGNED_OUT = 'Signed out'
export const FORGOT_NOTE = 'Ask the school office or IT to reset it.'
export const NO_ACCOUNT = 'No account? Your school sets it up for you.'

export const FIELD_ERRORS = {
  userId: 'Enter your user ID.',
  password: 'Enter your password.',
}

/** The text to show for anything a login attempt threw. */
export function messageFor(err: unknown): string {
  return err instanceof AuthError ? MESSAGES[err.kind] : MESSAGES.server
}

/** Shown when someone opens a page that belongs to the other role. `required` is the role the page is for. */
export const pageIsFor = (required: 'student' | 'teacher') => `That page is for ${required === 'teacher' ? 'teachers' : 'students'}`
