// Owner: Subgroup B (Teacher desktop UI). Helpers shared by the mock Teacher and Student APIs.
import type { Note, Role } from '../../types'
import type { Check, World } from '../../lib/rules'
import { RuleError } from '../errors'
import type { DemoState } from './seed'
import { nextId } from './store'

/** Simulated network latency, so loading and saving states are real. */
export function delay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 150 + Math.random() * 150))
}

export const worldOf = (d: DemoState): World => ({ teachers: d.teachers, bookings: d.bookings })

export function assertOk(c: Check): void {
  if (!c.ok) throw new RuleError(c.code, c.message)
}

/**
 * Adds a notification to a role's inbox, newest first. Nothing is added when the person turned that kind of
 * email off, or when a reminder with the same key already exists. Returns whether it was added.
 */
export function pushNote(d: DemoState, role: Role, text: string, enabled = true, key?: string): boolean {
  if (!enabled) return false
  if (key && d.notes[role].some((n) => n.key === key)) return false
  const note: Note = { id: nextId(d, 'n'), text, at: Date.now(), read: false, key }
  d.notes[role].unshift(note)
  return true
}
