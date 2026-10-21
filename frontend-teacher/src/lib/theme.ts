// Shared: changes need a PR note and a teammate review.
// Purpose: the color theme (palette) and Appearance (System / Light / Dark). The choice is saved in localStorage
// (every access is guarded, so a blocked or full storage never crashes the app) and applied to <html> as
// data-palette="navy|mint|crest" and data-theme="light|dark". "System" follows the operating system and updates live.
import { useSyncExternalStore } from 'react'

export type Palette = 'navy' | 'mint' | 'crest'
export type Mode = 'system' | 'light' | 'dark'

export const PALETTE_KEY = 'oh-palette'
export const MODE_KEY = 'oh-theme'

export const PALETTES: { id: Palette; name: string; blurb: string }[] = [
  { id: 'navy', name: 'Washington Navy', blurb: 'Deep navy sidebar. The default.' },
  { id: 'mint', name: 'Shield Mint', blurb: 'Navy sidebar with a mint accent and green buttons.' },
  { id: 'crest', name: 'Crest Light', blurb: 'Light sidebar with navy text.' },
]

export const MODES: { id: Mode; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
]

const isPalette = (v: unknown): v is Palette => v === 'navy' || v === 'mint' || v === 'crest'
const isMode = (v: unknown): v is Mode => v === 'system' || v === 'light' || v === 'dark'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** localStorage, or null when it is unavailable (private window, blocked site data). */
function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function read(key: string, storage: StorageLike | null): string | null {
  try {
    return storage ? storage.getItem(key) : null
  } catch {
    return null
  }
}

function write(key: string, value: string, storage: StorageLike | null): void {
  try {
    storage?.setItem(key, value)
  } catch {
    // The choice still applies for this visit; it just will not be remembered.
  }
}

export function readPalette(storage: StorageLike | null = browserStorage()): Palette {
  const v = read(PALETTE_KEY, storage)
  return isPalette(v) ? v : 'navy'
}

export function readMode(storage: StorageLike | null = browserStorage()): Mode {
  const v = read(MODE_KEY, storage)
  return isMode(v) ? v : 'system'
}

export function savePalette(palette: Palette, storage: StorageLike | null = browserStorage()): void {
  write(PALETTE_KEY, palette, storage)
}

export function saveMode(mode: Mode, storage: StorageLike | null = browserStorage()): void {
  write(MODE_KEY, mode, storage)
}

/** "System" becomes light or dark depending on the operating system. */
export function resolveMode(mode: Mode, prefersDark: boolean): 'light' | 'dark' {
  return mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode
}

export function applyTheme(
  root: { setAttribute(name: string, value: string): void },
  palette: Palette,
  mode: Mode,
  prefersDark: boolean,
): void {
  root.setAttribute('data-palette', palette)
  root.setAttribute('data-theme', resolveMode(mode, prefersDark))
}

// ---- live state shared with the UI ----

export interface ThemeState {
  palette: Palette
  mode: Mode
}

let state: ThemeState = { palette: 'navy', mode: 'system' }
const listeners = new Set<() => void>()
let media: MediaQueryList | null = null

const systemDark = (): boolean => (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) || false

function applyNow(): void {
  if (typeof document === 'undefined') return
  applyTheme(document.documentElement, state.palette, state.mode, systemDark())
}

function emit(): void {
  listeners.forEach((l) => l())
}

/** Call once before the first render: applies the saved choice and follows the operating system while on "System". */
export function initTheme(): void {
  state = { palette: readPalette(), mode: readMode() }
  applyNow()
  if (typeof window !== 'undefined' && window.matchMedia && !media) {
    media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', () => {
      if (state.mode === 'system') applyNow()
    })
  }
  emit()
}

export function setPalette(palette: Palette): void {
  state = { ...state, palette }
  savePalette(palette)
  applyNow()
  emit()
}

export function setMode(mode: Mode): void {
  state = { ...state, mode }
  saveMode(mode)
  applyNow()
  emit()
}

export const getTheme = (): ThemeState => state

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useTheme(): ThemeState & { setPalette: typeof setPalette; setMode: typeof setMode } {
  const s = useSyncExternalStore(subscribeTheme, getTheme, getTheme)
  return { ...s, setPalette, setMode }
}
