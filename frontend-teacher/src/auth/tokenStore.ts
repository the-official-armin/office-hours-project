// Shared: changes need a PR note and a teammate review.
// Purpose: where the access token lives. The backend has no refresh cookie yet, so a token that only lived in memory would be
// lost on every reload. It is kept in sessionStorage (gone when the tab closes), or in localStorage when the person ticks
// "Keep me signed in". Storage can be blocked (private window), so every access is wrapped and the token still works in memory.
const KEY = 'oh-token'

interface Stored {
  token: string
  /** Epoch milliseconds. */
  expiresAt: number
}

let memory: Stored | null = null

function read(storage: () => Storage): Stored | null {
  try {
    const raw = storage().getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Stored>
    if (typeof parsed.token === 'string' && typeof parsed.expiresAt === 'number') return { token: parsed.token, expiresAt: parsed.expiresAt }
  } catch {
    // blocked or corrupt: treat as no token
  }
  return null
}

function write(storage: () => Storage, value: Stored | null): void {
  try {
    if (value) storage().setItem(KEY, JSON.stringify(value))
    else storage().removeItem(KEY)
  } catch {
    // storage unavailable: the in-memory copy still works for this page
  }
}

/** The stored token even when it has expired (the mock guard needs it to tell "expired" from "never signed in"). */
export function getTokenRaw(): string | null {
  return memory ? memory.token : null
}

/** The token to send, or null. A token past its expiry is never returned. */
export function getToken(now = Date.now()): string | null {
  if (memory && memory.expiresAt > now) return memory.token
  return null
}

/** Remember a new token. `expiresInSeconds` comes from the login answer. */
export function setToken(token: string, expiresInSeconds: number, remember: boolean, now = Date.now()): void {
  memory = { token, expiresAt: now + expiresInSeconds * 1000 }
  write(() => sessionStorage, remember ? null : memory)
  write(() => localStorage, remember ? memory : null)
}

/** Read a token saved by an earlier visit (page reload, or "Keep me signed in"). Returns it, or null if none or expired. */
export function loadStoredToken(now = Date.now()): string | null {
  const found = read(() => localStorage) ?? read(() => sessionStorage)
  if (!found || found.expiresAt <= now) {
    clearToken()
    return null
  }
  memory = found
  return found.token
}

export function clearToken(): void {
  memory = null
  write(() => sessionStorage, null)
  write(() => localStorage, null)
}
