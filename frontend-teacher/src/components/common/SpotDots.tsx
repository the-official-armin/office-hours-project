// Shared: changes need a PR note and a teammate review.
// Purpose: capacity dots (one per seat, filled = taken), the date block, and the "3 of 4 seats" / "3 of 4 spots" line used by office hour rows.
import { dayOfMonth, DOW_SHORT, dowOf, formatMonthDay } from '../../lib/dates'

interface DotsProps {
  taken: number
  max: number
  small?: boolean
  /** Position (0-based) of the viewer's own spot among the filled dots: drawn with a ring. */
  mine?: number | null
  /** When given, the dots are announced as an image with this label. Otherwise they are decorative. */
  label?: string
}

export function SpotDots({ taken, max, small = false, mine = null, label }: DotsProps) {
  return (
    <span
      className={`inline-flex ${small ? 'gap-[3px]' : 'gap-1'}`}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`rounded-full ${small ? 'h-[9px] w-[9px] border-[1.5px]' : 'h-3.5 w-3.5 border-2'} ${
            i < taken ? 'border-brand bg-brand' : 'border-seat-edge bg-surface'
          } ${i === mine ? 'ring-2 ring-link ring-offset-2 ring-offset-surface' : ''}`}
        />
      ))}
    </span>
  )
}

/** "3 of 4 seats" (teacher) or "3 of 4 spots" (student) with the dots above or beside it. */
export function SpotsEnd({ taken, max, unit = 'seats' }: { taken: number; max: number; unit?: 'seats' | 'spots' }) {
  return (
    <div className="flex flex-col items-end gap-1.5 max-[640px]:items-start">
      <span className="flex items-center gap-2 text-[13px] font-semibold text-muted">
        <SpotDots taken={taken} max={max} />
      </span>
      <span className="text-[13px] font-semibold tabular-nums text-muted">
        {taken} of {max} {unit}
      </span>
    </div>
  )
}

export function DateBlock({ date, kind = 'tint' }: { date: string; kind?: 'tint' | 'amber' | 'past' }) {
  const tone = { tint: 'bg-tint text-tint-ink', amber: 'bg-amber text-amber-ink', past: 'bg-past text-past-ink' }[kind]
  const top = kind === 'amber' ? formatMonthDay(date).split(' ')[0] : DOW_SHORT[dowOf(date)]
  return (
    <div className={`flex h-14 w-14 flex-none flex-col items-center justify-center rounded-xl ${tone}`}>
      <span className="text-[11px] font-bold uppercase tracking-[.04em]">{top}</span>
      <b className="text-xl font-extrabold leading-[1.1] tabular-nums">{dayOfMonth(date)}</b>
    </div>
  )
}
