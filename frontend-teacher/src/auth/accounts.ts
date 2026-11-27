// Mock mode only: the example people you can sign in as. Same emails and password as the backend's demo seed
// (<id>@example.com, password "demo-password"), so a screenshot or a test works in both modes.
import type { Role } from '../types'

export interface MockAccount {
  id: string
  email: string
  role: Role
  name: string
  detail: string
}

export const MOCK_PASSWORD = 'demo-password'

/** The backend seed's demo sign-in email for an id. example.com is reserved for examples, so it reaches nobody. */
export const demoEmail = (id: string): string => `${id}@example.com`

export const MOCK_ACCOUNTS: MockAccount[] = [
  { id: 'maya', role: 'student', name: 'Maya K.', detail: 'Grade 10' },
  { id: 'daniel', role: 'student', name: 'Daniel O.', detail: 'Grade 10' },
  { id: 'rivera', role: 'teacher', name: 'Ms. Rivera', detail: 'Mathematics' },
  { id: 'okafor', role: 'teacher', name: 'Mr. Okafor', detail: 'Chemistry' },
].map((a) => ({ ...a, email: demoEmail(a.id) }) as MockAccount)

export const DEFAULT_STUDENT = 'maya'
export const DEFAULT_TEACHER = 'rivera'
