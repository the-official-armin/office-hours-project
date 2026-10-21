// Shared: changes need a PR note and a teammate review.
// Purpose: seat dots, date block, and the "dots + n of max seats" line used by office hour rows.
import { dayOfMonth, DOW_SHORT, dowOf, formatMonthDay } from '../../lib/dates'

export function SeatDots({ taken, max, small = false }: { taken: number; max: number; small?: boolean }) {
  return (
    <span className={`inline-flex ${small ? 'gap-[3px]' : 'gap-1'}`} aria-hidden="true">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`rounded-full ${small ? 'h-[9px] w-[9px] border-[1.5px]' : 'h-3.5 w-3.5 border-2'} ${
            i < taken ? 'border-brand bg-brand' : 'border-seat-edge bg-surface'
          }`}
        />
      ))}
    </span>
  )
}

/** "3 of 4 seats" with the dots above or beside it. */
export function SeatsEnd({ taken, max }: { taken: number; max: number }) {
  return (
    <div className="flex flex-col items-end gap-1.5 max-[640px]:items-start">
      <span className="flex items-center gap-2 text-[13px] font-semibold text-muted">
        <SeatDots taken={taken} max={max} />
      </span>
      <span className="text-[13px] font-semibold tabular-nums text-muted">
        {taken} of {max} seats
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
