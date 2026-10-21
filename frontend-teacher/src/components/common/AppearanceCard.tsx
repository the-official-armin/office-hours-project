// Shared: changes need a PR note and a teammate review.
// Purpose: Settings -> Appearance. Pick a color theme (radio cards that preview each palette) and Light / Dark / System.
// Both take effect immediately and are remembered on this device; both roles use this card.
import { MODES, PALETTES, useTheme } from '../../lib/theme'
import Card, { CardTitle } from './Card'
import { Segmented } from './controls'

/** A tiny app: a sidebar strip with the active bar, a primary button and a tinted chip, in the palette's own colors. */
function Preview({ palette }: { palette: string }) {
  return (
    <span
      aria-hidden="true"
      data-palette-preview={palette}
      className="flex h-[84px] overflow-hidden rounded-lg border border-line bg-page"
    >
      <span className="flex w-[30%] flex-col gap-1.5 bg-side p-2">
        <span className="h-3.5 w-3.5 rounded-full bg-side-ink-strong" />
        <span className="h-1.5 rounded bg-side-hover" />
        <span className="h-2 rounded border-l-2 border-side-accent bg-side-active" />
        <span className="h-1.5 rounded bg-side-hover" />
      </span>
      <span className="flex flex-1 flex-col justify-center gap-2 p-2.5">
        <span className="inline-flex h-5 w-14 items-center justify-center rounded bg-brand text-[9px] font-bold text-on-brand">Book</span>
        <span className="inline-flex h-4 w-12 items-center justify-center rounded bg-tint text-[9px] font-bold text-tint-ink">3 left</span>
      </span>
    </span>
  )
}

export default function AppearanceCard() {
  const { palette, mode, setPalette, setMode } = useTheme()

  return (
    <Card aria-labelledby="appearance-h" className="flex flex-col gap-5">
      <div>
        <CardTitle id="appearance-h">Appearance</CardTitle>
        <p className="mt-1 text-[13px] text-muted">Changes apply right away on this device.</p>
      </div>

      <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
        <legend className="mb-2 p-0 text-[13px] font-bold text-ink2">Color theme</legend>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
          {PALETTES.map((p) => (
            <label key={p.id} className="relative block cursor-pointer">
              <input
                type="radio"
                name="palette"
                value={p.id}
                checked={palette === p.id}
                onChange={() => setPalette(p.id)}
                className="peer sr-only"
              />
              <span className="flex flex-col gap-2.5 rounded-xl border-2 border-line bg-surface p-3 peer-checked:border-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-link">
                <Preview palette={p.id} />
                <span>
                  <b className="block text-sm font-extrabold">{p.name}</b>
                  <small className="mt-0.5 block text-xs text-muted">{p.blurb}</small>
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <span id="mode-h" className="text-[13px] font-bold text-ink2">
          Light or dark
        </span>
        <Segmented label="Light or dark" value={mode} options={MODES} onChange={setMode} />
      </div>
    </Card>
  )
}
