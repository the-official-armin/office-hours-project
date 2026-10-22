// Shared: checks the contrast of every text/background pair in all six themes (3 palettes x light/dark).
// It reads the real tokens from src/index.css, so the CSS stays the one source of truth.
// Text must reach 4.5:1 (WCAG AA). Non-text marks (rings, bars, toggles) must reach 3:1.
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')

type Tokens = Record<string, string>
type Palette = 'navy' | 'mint' | 'crest'
type Mode = 'light' | 'dark'

const canonical: Record<string, string> = {
  ":root": 'light.navy',
  ":root[data-palette='mint']": 'light.mint',
  ":root[data-palette='crest']": 'light.crest',
  ":root[data-theme='dark']": 'dark.base',
  ":root[data-theme='dark'][data-palette='mint']": 'dark.mint',
  ":root[data-theme='dark'][data-palette='crest']": 'dark.crest',
}

function parseBlocks(): Record<string, Tokens> {
  const text = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@import[^;]*;/g, '')
    .replace(/"/g, "'")
  const blocks: Record<string, Tokens> = {}
  for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const first = m[1].split(',')[0].trim().replace(/\s+/g, ' ')
    const key = canonical[first]
    if (!key) continue
    const tokens: Tokens = {}
    for (const d of m[2].matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) tokens[d[1]] = d[2].trim()
    blocks[key] = tokens
  }
  return blocks
}

const blocks = parseBlocks()

/** The tokens in force for a palette and mode, merged in the same order the browser applies the CSS. */
function theme(palette: Palette, mode: Mode): Tokens {
  const t: Tokens = { ...blocks['light.navy'] }
  if (palette !== 'navy') Object.assign(t, blocks[`light.${palette}`])
  if (mode === 'dark') {
    Object.assign(t, blocks['dark.base'])
    if (palette !== 'navy') Object.assign(t, blocks[`dark.${palette}`])
  }
  return t
}

type RGB = [number, number, number]

function rgbOf(value: string, over: RGB | null): RGB {
  const hex = value.match(/^#([0-9a-f]{6})$/i)
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)) as RGB
  const rgba = value.match(/^rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)$/)
  if (rgba) {
    if (!over) throw new Error(`${value} needs a background to sit on`)
    const a = Number(rgba[4])
    return [1, 2, 3].map((i) => Math.round(Number(rgba[i]) * a + over[i - 1] * (1 - a))) as RGB
  }
  throw new Error(`Unsupported color: ${value}`)
}

function luminance([r, g, b]: RGB): number {
  const f = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

function ratio(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

interface Pair {
  fg: string
  bg: string
  /** A translucent background (e.g. a hover overlay) is drawn over this token. */
  over?: string
  min?: number
  note?: string
}

const TEXT: Pair[] = [
  { fg: 'ink', bg: 'surface' },
  { fg: 'ink', bg: 'bg' },
  { fg: 'ink2', bg: 'surface' },
  { fg: 'ink2', bg: 'past', note: 'past chip' },
  { fg: 'muted', bg: 'surface' },
  { fg: 'muted', bg: 'bg' },
  { fg: 'muted', bg: 'field', note: 'placeholder' },
  { fg: 'head', bg: 'surface' },
  { fg: 'head', bg: 'bg' },
  { fg: 'on-brand', bg: 'brand', note: 'primary button, selected pill' },
  { fg: 'link', bg: 'surface' },
  { fg: 'link', bg: 'bg' },
  { fg: 'tint-ink', bg: 'tint', note: 'open seats, info banner' },
  { fg: 'amber-ink', bg: 'amber', note: 'full / day off, warnings' },
  { fg: 'past-ink', bg: 'past', note: 'past' },
  { fg: 'mint-ink', bg: 'mint-soft', note: 'timing block' },
  { fg: 'danger', bg: 'surface', note: 'errors, cancel' },
  { fg: 'danger', bg: 'bg' },
  { fg: 'on-danger', bg: 'danger-fill' },
  { fg: 'badge-ink', bg: 'badge', note: 'text on orange is navy' },
  { fg: 'side-ink', bg: 'side' },
  { fg: 'side-ink-strong', bg: 'side', note: 'brand name, profile name' },
  { fg: 'side-mute', bg: 'side' },
  { fg: 'side-ink', bg: 'side-hover', over: 'side', note: 'nav item on hover' },
  { fg: 'side-ink-strong', bg: 'side-hover', over: 'side', note: 'open group with the current page' },
  { fg: 'side-ink-strong', bg: 'side-active', over: 'side', note: 'current page' },
  { fg: 'side-mute', bg: 'side-active', over: 'side' },
]

const NON_TEXT: Pair[] = [
  { fg: 'side-accent', bg: 'side', min: 3, note: 'active bar, logo flame' },
  { fg: 'today', bg: 'surface', min: 3, note: 'today ring' },
  { fg: 'today', bg: 'bg', min: 3 },
  { fg: 'seat-edge', bg: 'surface', min: 3, note: 'empty seat dot' },
  { fg: 'knob', bg: 'toggle-off', min: 3, note: 'switch knob' },
  { fg: 'knob', bg: 'brand', min: 3, note: 'switch knob when on' },
]

const palettes: Palette[] = ['navy', 'mint', 'crest']
const modes: Mode[] = ['light', 'dark']

describe('the theme CSS is readable', () => {
  it('defines all six theme blocks', () => {
    expect(Object.keys(blocks).sort()).toEqual(Object.values(canonical).sort())
  })

  it('every palette defines every token a pair needs', () => {
    for (const p of palettes) {
      for (const m of modes) {
        const t = theme(p, m)
        for (const pair of [...TEXT, ...NON_TEXT]) {
          expect(t[pair.fg], `${p}/${m} --${pair.fg}`).toBeDefined()
          expect(t[pair.bg], `${p}/${m} --${pair.bg}`).toBeDefined()
        }
      }
    }
  })
})

describe.each(palettes.flatMap((p) => modes.map((m) => [p, m] as const)))('contrast: %s / %s', (palette, mode) => {
  const t = theme(palette, mode)
  const pairs = [...TEXT, ...NON_TEXT]

  it.each(pairs.map((p) => [`${p.fg} on ${p.bg}${p.note ? ` (${p.note})` : ''}`, p] as const))('%s', (_label, p) => {
    const over = p.over ? rgbOf(t[p.over], null) : null
    const bg = rgbOf(t[p.bg], over)
    const fg = rgbOf(t[p.fg], bg)
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(p.min ?? 4.5)
  })
})

describe('the school colors', () => {
  const light = theme('navy', 'light')

  it('keeps status colors identical in every palette and mode family', () => {
    for (const p of palettes) {
      const t = theme(p, 'light')
      for (const token of ['amber', 'amber-ink', 'past', 'past-ink', 'danger', 'danger-fill']) {
        expect(t[token], `${p} --${token}`).toBe(light[token])
      }
    }
    for (const p of palettes) {
      const t = theme(p, 'dark')
      const base = theme('navy', 'dark')
      for (const token of ['amber', 'amber-ink', 'past', 'past-ink', 'danger', 'danger-fill']) {
        expect(t[token], `${p} dark --${token}`).toBe(base[token])
      }
    }
  })

  it('never puts white text on the torch orange', () => {
    for (const p of palettes) {
      for (const m of modes) {
        const t = theme(p, m)
        expect(t['badge-ink'].toLowerCase()).not.toBe('#ffffff')
      }
    }
  })
})
