// Owner: Subgroup B (Teacher desktop UI). The local "database" for the demo: localStorage with an in-memory fallback.
// Only src/api/ may import this file. Pages and hooks never touch storage.
import { seedState, STORAGE_VERSION, type DemoState } from './seed'

export const STORAGE_KEY = 'officehours.demo.v1'

let current: DemoState | null = null
const listeners = new Set<() => void>()

function readRaw(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeRaw(value: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // Storage unavailable (private window, blocked site data). State stays in memory only.
  }
}

function isDemoState(x: unknown): x is DemoState {
  if (!x || typeof x !== 'object') return false
  const s = x as Partial<DemoState>
  return (
    s.version === STORAGE_VERSION &&
    typeof s.loggedIn === 'boolean' &&
    !!s.profile &&
    !!s.prefs &&
    !!s.schedule &&
    Array.isArray(s.daysOff) &&
    Array.isArray(s.bookings) &&
    Array.isArray(s.requests) &&
    Array.isArray(s.notifications) &&
    typeof s.seq === 'number'
  )
}

function emit(): void {
  listeners.forEach((l) => l())
}

export function getState(): DemoState {
  if (current) return current
  const raw = readRaw()
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (isDemoState(parsed)) {
        current = parsed
        return current
      }
    } catch {
      // corrupt data: fall through and re-seed
    }
  }
  current = seedState(new Date())
  writeRaw(JSON.stringify(current))
  return current
}

function commit(next: DemoState): void {
  current = next
  writeRaw(JSON.stringify(next))
  emit()
}

/** Run `fn` on a copy of the state. If it throws, nothing is saved. */
export function mutate<T>(fn: (draft: DemoState) => T): T {
  const draft = structuredClone(getState())
  const result = fn(draft)
  commit(draft)
  return result
}

/** Restore the seed. Keeps the current login so the demo does not log you out. */
export function resetState(): void {
  const { loggedIn, role } = getState()
  commit({ ...seedState(new Date(), loggedIn), role })
}

export function nextId(draft: DemoState, prefix: string): string {
  return `${prefix}${draft.seq++}`
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Keep several tabs in sync.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      current = null
      emit()
    }
  })
}
