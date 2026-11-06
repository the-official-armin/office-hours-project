// Purpose: remember which side the person signed in as last, so the chooser can point at it. Storage may be blocked.
import type { Role } from '../types'

const KEY = 'oh-last-role'

export function getLastRole(): Role | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'student' || v === 'teacher' ? v : null
  } catch {
    return null
  }
}

export function setLastRole(role: Role): void {
  try {
    localStorage.setItem(KEY, role)
  } catch {
    // blocked: the chooser just shows no hint
  }
}
