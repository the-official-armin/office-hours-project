// Owner: Subgroup B (Teacher desktop UI). Helpers shared by the mock Teacher and Student APIs.
import type { Note, StudentPrefs, TeacherPrefs } from '../../types'
import type { Check, World } from '../../lib/rules'
import { RuleError } from '../errors'
import { MOCK_ACCOUNTS } from '../../auth/accounts'
import { defaultStudentPrefs, defaultTeacherPrefs, type DemoState } from './seed'
import { nextId } from './store'

/** Simulated network latency, so loading and saving states are real. */
export function delay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 150 + Math.random() * 150))
}

export const worldOf = (d: DemoState): World => ({ teachers: d.teachers, bookings: d.bookings })

export function assertOk(c: Check): void {
  if (!c.ok) throw new RuleError(c.code, c.message)
}

/** A teacher's email switches. Someone who never saved settings has the defaults. */
export const teacherPrefsOf = (d: DemoState, id: string): TeacherPrefs => d.teacherPrefs[id] ?? defaultTeacherPrefs()

/** A student's profile and email switches. Someone who never saved settings has the defaults (name from the example accounts). */
export function studentPrefsOf(d: DemoState, id: string): StudentPrefs {
  const known = MOCK_ACCOUNTS.find((a) => a.id === id)
  return d.studentPrefs[id] ?? defaultStudentPrefs(id, known?.name ?? id, known?.detail ?? '')
}

/**
 * Adds a notification to one person's inbox (by id), newest first. Nothing is added when the person turned that kind of
 * email off, or when a reminder with the same key already exists. Returns whether it was added.
 */
export function pushNote(d: DemoState, to: string, text: string, enabled = true, key?: string): boolean {
  if (!enabled) return false
  const inbox = (d.notes[to] ??= [])
  if (key && inbox.some((n) => n.key === key)) return false
  const note: Note = { id: nextId(d, 'n'), text, at: Date.now(), read: false, key }
  inbox.unshift(note)
  return true
}
