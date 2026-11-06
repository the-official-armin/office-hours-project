// Mock mode only: the example people you can sign in as. Same ids and password as the backend's demo seed
// (backend/README.md: every demo account has the password "demo-password"), so a screenshot or a test works in both modes.
import type { Role } from '../types'

export interface MockAccount {
  id: string
  role: Role
  name: string
  detail: string
}

export const MOCK_PASSWORD = 'demo-password'

export const MOCK_ACCOUNTS: MockAccount[] = [
  { id: 'maya', role: 'student', name: 'Maya K.', detail: 'Grade 10' },
  { id: 'daniel', role: 'student', name: 'Daniel O.', detail: 'Grade 10' },
  { id: 'rivera', role: 'teacher', name: 'Ms. Rivera', detail: 'Mathematics' },
  { id: 'okafor', role: 'teacher', name: 'Mr. Okafor', detail: 'Chemistry' },
]

export const DEFAULT_STUDENT = 'maya'
export const DEFAULT_TEACHER = 'rivera'
