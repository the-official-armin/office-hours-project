// Every sentence the sign-in screens can show, in one place. Plain words, no codes. Never says which of user ID or password was wrong.

export type AuthErrorKind = 'invalid' | 'unauthorized' | 'too_many' | 'network' | 'server' | 'link' | 'weak_password'

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
  invalid: 'Email or password is incorrect.',
  unauthorized: 'Your session ended. Sign in again.',
  too_many: 'Too many tries. Wait a few minutes and try again.',
  network: 'Can’t reach the server. Check your connection.',
  server: 'Something went wrong on our side. Try again in a moment.',
  link: 'This link has expired or was already used.',
  weak_password: 'Choose a longer password that isn’t your email.',
}

export const SESSION_ENDED = MESSAGES.unauthorized
export const SIGNED_OUT = 'Signed out'
export const LINK_HELP = 'Ask for a new one from the Forgot password page, or ask the school office.'
export const passwordLinkSent = (email: string) => `We emailed ${email} a link to choose a new password. It expires in 1 hour.`
export const RESET_SENT = 'If that email has an account, we’ve sent a link to choose a new password. It expires in 1 hour.'
export const NO_ACCOUNT = 'No account? Your school sets it up for you.'

export const FIELD_ERRORS = {
  email: 'Enter your email.',
  password: 'Enter your password.',
  shortPassword: 'Use at least 10 characters.',
  longPassword: 'Use at most 128 characters.',
  emailPassword: 'Don’t use your email as your password.',
  confirm: 'The two passwords don’t match.',
}

/** The text to show for anything a login attempt threw. */
export function messageFor(err: unknown): string {
  return err instanceof AuthError ? MESSAGES[err.kind] : MESSAGES.server
}

/** Shown when someone opens a page that belongs to the other role. `required` is the role the page is for. */
export const pageIsFor = (required: 'student' | 'teacher') => `That page is for ${required === 'teacher' ? 'teachers' : 'students'}`
