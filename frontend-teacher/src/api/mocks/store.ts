// Owner: Subgroup B (Teacher desktop UI). The local "database" for mock mode: localStorage with an in-memory fallback.
// Only src/api/ may import this file. Pages and hooks never touch storage.
import { isDemoState, seedState, type DemoState } from './seed'

export const STORAGE_KEY = 'officehours.demo.v2'

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

/** Restore the example data. Keeps the current login so a reset does not sign you out. */
export function resetState(): void {
  commit(seedState(new Date(), getState().session))
}

export function nextId(draft: DemoState, prefix: string): string {
  draft.seq += 1
  return `${prefix}${draft.seq}`
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
