// Owner: Subgroup B (Teacher desktop UI). One office hour as a theater-style seat grid: a "Teacher's desk" bar and seats
// that are Open, Taken, Yours or Picked. Locked when the office hour started, or the student already has a seat there
// or a clashing booking with another teacher.
import { formatRange } from '../../lib/dates'
import { conflictingBooking, findTeacher, type SlotRow, type World } from '../../lib/rules'
import type { Teacher } from '../../types'

type SeatState = 'open' | 'taken' | 'mine' | 'picked'

const SEAT_LOOK: Record<SeatState, string> = {
  open: 'border-edge bg-surface text-ink',
  taken: 'border-line bg-past text-past-ink',
  mine: 'border-brand bg-tint text-tint-ink',
  picked: 'border-brand bg-brand text-on-brand',
}

const SEAT_WORD: Record<SeatState, string> = { open: 'Open', taken: 'Taken', mine: 'You', picked: 'Picked' }

interface Props {
  world: World
  teacher: Teacher
  row: SlotRow
  date: string
  studentId: string
  /** The seat picked in this office hour, if any. */
  picked: number | null
  onPick: (seat: number) => void
}

export default function SlotSeats({ world, teacher, row, date, studentId, picked, onPick }: Props) {
  const mineIn = row.bookings.find((b) => b.studentId === studentId)
  const clash = conflictingBooking(world, studentId, date, row.timing, teacher.id)
  const locked = row.started || !!mineIn || !!clash
  const note = row.started
    ? 'This office hour already started.'
    : mineIn
      ? 'You already have a seat in this office hour.'
      : clash
        ? `You are booked at this time with ${findTeacher(world, clash.teacherId)?.name ?? 'another teacher'}.`
        : ''

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <b className="text-[15px]">{row.timing.name}</b>
        <span className="text-[13px] text-muted">{formatRange(row.timing.start, row.timing.end)}</span>
      </div>
      <div aria-hidden="true" className="text-center text-[11px] font-bold uppercase tracking-[.06em] text-muted">
        Teacher&rsquo;s desk
      </div>
      <div aria-hidden="true" className="mx-2 h-1.5 rounded-full bg-edge" />
      <div role="group" aria-label={`Seats for ${row.timing.name}`} className="grid grid-cols-[repeat(auto-fill,minmax(60px,1fr))] gap-2.5">
        {Array.from({ length: teacher.max }, (_, i) => i + 1).map((n) => {
          const booking = row.bookings.find((b) => b.seat === n)
          const state: SeatState = booking ? (booking.studentId === studentId ? 'mine' : 'taken') : picked === n ? 'picked' : 'open'
          const disabled = state === 'mine' || state === 'taken' || (state === 'open' && locked)
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              aria-pressed={state === 'picked'}
              aria-label={`Seat ${n}, ${SEAT_WORD[state].toLowerCase()}`}
              onClick={() => onPick(n)}
              className={`flex h-[60px] w-full flex-col items-center justify-center gap-0.5 rounded-b-lg rounded-t-[14px] border-[1.5px] p-0 disabled:cursor-default ${SEAT_LOOK[state]} ${
                state === 'open' && locked ? 'disabled:opacity-55' : ''
              }`}
            >
              <b className="text-[17px] font-extrabold leading-none tabular-nums">{n}</b>
              <span className="text-[11px] font-bold leading-none">{SEAT_WORD[state]}</span>
            </button>
          )
        })}
      </div>
      <div className="text-[13px] font-semibold text-muted">
        {row.left <= 0 ? 'Full' : `${row.left} ${row.left === 1 ? 'seat' : 'seats'} left`}
      </div>
      {note && <div className="rounded-lg bg-amber px-2.5 py-1.5 text-[13px] font-bold text-amber-ink">{note}</div>}
    </div>
  )
}

/** The key under the seat grids. */
export function SeatKeys() {
  const swatch = 'inline-block h-3 w-3 rounded border-[1.5px]'
  return (
    <div className="flex flex-wrap gap-3.5 text-xs text-muted">
      <span className="inline-flex items-center gap-1.5">
        <i className={`${swatch} border-edge bg-surface`} />
        Open
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i className={`${swatch} border-line bg-past`} />
        Taken
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i className={`${swatch} border-brand bg-tint`} />
        Your seat
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i className={`${swatch} border-brand bg-brand`} />
        Picked
      </span>
    </div>
  )
}
