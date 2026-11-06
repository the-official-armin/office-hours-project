// Purpose: the checks the sign-in form runs before it asks the server. Only emptiness: the server decides whether an ID and
// password are right, and it never says which one was wrong.
import { FIELD_ERRORS } from './messages'

export interface LoginFieldErrors {
  userId?: string
  password?: string
}

export function validateLogin(userId: string, password: string): LoginFieldErrors {
  const errors: LoginFieldErrors = {}
  if (!userId.trim()) errors.userId = FIELD_ERRORS.userId
  if (!password) errors.password = FIELD_ERRORS.password
  return errors
}

export const hasErrors = (e: LoginFieldErrors): boolean => Object.keys(e).length > 0
