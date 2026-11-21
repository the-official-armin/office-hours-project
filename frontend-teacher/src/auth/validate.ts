// Purpose: the checks the sign-in and password forms run before they ask the server. The server decides whether an email and
// password are right, and it never says which one was wrong.
import { FIELD_ERRORS } from './messages'

export interface LoginFieldErrors {
  email?: string
  password?: string
}

export function validateLogin(email: string, password: string): LoginFieldErrors {
  const errors: LoginFieldErrors = {}
  if (!email.trim()) errors.email = FIELD_ERRORS.email
  if (!password) errors.password = FIELD_ERRORS.password
  return errors
}

export const hasErrors = (e: LoginFieldErrors): boolean => Object.keys(e).length > 0

/** Same rules as the backend (app/accounts.py): at least 10 characters, at most 128, not the email. */
export const MIN_PASSWORD = 10

export interface NewPasswordErrors {
  password?: string
  confirm?: string
}

export function validateNewPassword(password: string, confirm: string, email: string): NewPasswordErrors {
  const errors: NewPasswordErrors = {}
  const lowered = password.toLowerCase()
  if (password.length < MIN_PASSWORD) errors.password = FIELD_ERRORS.shortPassword
  else if (password.length > 128) errors.password = FIELD_ERRORS.longPassword
  else if (email && (lowered === email.toLowerCase() || lowered === email.toLowerCase().split('@')[0])) errors.password = FIELD_ERRORS.emailPassword
  if (!errors.password && password !== confirm) errors.confirm = FIELD_ERRORS.confirm
  return errors
}
