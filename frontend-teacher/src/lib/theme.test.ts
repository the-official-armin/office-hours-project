// Shared: unit tests for the theme storage and the attributes applied to <html>.
import { describe, expect, it } from 'vitest'
import {
  applyTheme,
  MODE_KEY,
  PALETTE_KEY,
  readMode,
  readPalette,
  resolveMode,
  saveMode,
  savePalette,
  type StorageLike,
} from './theme'

function memory(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v
    },
  }
}

const broken: StorageLike = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
}

describe('saved choices', () => {
  it('fall back to navy and system when nothing is saved or the value is not valid', () => {
    expect(readPalette(memory())).toBe('navy')
    expect(readMode(memory())).toBe('system')
    expect(readPalette(memory({ [PALETTE_KEY]: 'purple' }))).toBe('navy')
    expect(readMode(memory({ [MODE_KEY]: 'sepia' }))).toBe('system')
  })

  it('read what was saved', () => {
    expect(readPalette(memory({ [PALETTE_KEY]: 'mint' }))).toBe('mint')
    expect(readPalette(memory({ [PALETTE_KEY]: 'crest' }))).toBe('crest')
    expect(readMode(memory({ [MODE_KEY]: 'dark' }))).toBe('dark')
    expect(readMode(memory({ [MODE_KEY]: 'light' }))).toBe('light')
  })

  it('save under oh-palette and oh-theme', () => {
    const s = memory()
    savePalette('crest', s)
    saveMode('dark', s)
    expect(s.data).toEqual({ 'oh-palette': 'crest', 'oh-theme': 'dark' })
  })

  it('never throw when storage is blocked or missing', () => {
    expect(readPalette(broken)).toBe('navy')
    expect(readMode(broken)).toBe('system')
    expect(() => savePalette('mint', broken)).not.toThrow()
    expect(() => saveMode('dark', broken)).not.toThrow()
    expect(readPalette(null)).toBe('navy')
    expect(() => saveMode('light', null)).not.toThrow()
  })
})

describe('applying a theme', () => {
  const root = () => {
    const attrs: Record<string, string> = {}
    return { attrs, setAttribute: (n: string, v: string) => void (attrs[n] = v) }
  }

  it('sets data-palette and a resolved data-theme', () => {
    const r = root()
    applyTheme(r, 'mint', 'dark', false)
    expect(r.attrs).toEqual({ 'data-palette': 'mint', 'data-theme': 'dark' })
  })

  it('resolves System from the operating system', () => {
    expect(resolveMode('system', true)).toBe('dark')
    expect(resolveMode('system', false)).toBe('light')
    expect(resolveMode('light', true)).toBe('light')
    expect(resolveMode('dark', false)).toBe('dark')
    const r = root()
    applyTheme(r, 'navy', 'system', true)
    expect(r.attrs['data-theme']).toBe('dark')
  })
})
