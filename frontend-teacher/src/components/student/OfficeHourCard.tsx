// Owner: Subgroup B (Teacher desktop UI). One office hour on the Book page: how full it is, and one button whose state says
// what the student can do (Book a spot, Full, You're booked, Started, or a time clash). "Book a spot" opens the reason
// form in place. There are no seat numbers: booking takes one of the office hour's spots.
import { useState } from 'react'
import { formatDateShort, formatRange } from '../../lib/dates'
import { checkBookingReason, errorOf, REASON_MAX, type OfficeHourState, type SlotRow } from '../../lib/rules'
import type { Teacher } from '../../types'
import { ConfirmBar } from '../common/Banner'
import Button, { TextButton } from '../common/Button'
import Chip from '../common/Chip'
import { ErrorText, TextArea } from '../common/fields'
import { SpotDots } from '../common/SpotDots'

interface Props {
  teacher: Teacher
  row: SlotRow
  date: string
  state: OfficeHourState
  studentId: string
  /** The reason form is open for this office hour. */
  composing: boolean
  reason: string
  onReason: (text: string) => void
  onStart: () => void
  onBack: () => void
  /** Called with a valid reason. The page does the booking. */
  onConfirm: () => void
  confirming: boolean
  /** An error from the server to show in this card (for example "That office hour just filled up."). */
  notice?: string
  /** Cancels the booking. Shows its own error if that fails. */
  onCancelBooking: (bookingId: string) => Promise<void>
  onAskRequest: () => void
}

export default function OfficeHourCard({
  teacher,
  row,
  date,
  state,
  studentId,
  composing,
  reason,
  onReason,
  onStart,
  onBack,
  onConfirm,
  confirming,
  notice,
  onCancelBooking,
  onAskRequest,
}: Props) {
  const [problem, setProblem] = useState('')
  const [asking, setAsking] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const timing = row.timing
  const mineIndex = row.bookings.findIndex((b) => b.studentId === studentId)
  const label = `${row.taken} of ${teacher.max} spots taken`
  const left = Math.max(0, row.left)
  const countId = `reason-count-${timing.id}`

  function confirm() {
    const found = errorOf(checkBookingReason(reason))
    setProblem(found)
    if (!found) onConfirm()
  }

  return (
    <section aria-label={`${timing.name} office hour`} className="flex flex-col gap-3 rounded-xl border border-line p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[15px] font-bold">{timing.name}</h3>
        <span className="text-[13px] text-muted">{formatRange(timing.start, timing.end)}</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <SpotDots taken={row.taken} max={teacher.max} mine={mineIndex >= 0 ? mineIndex : null} label={label} />
        <span aria-live="polite" className="text-[13px] font-semibold tabular-nums text-muted">
          {label} &middot; {left > 0 ? `${left} left` : 'none left'}
        </span>
      </div>

      {state.kind === 'bookable' && !composing && (
        <Button variant="primary" onClick={onStart}>
          Book a spot
        </Button>
      )}

      {state.kind === 'bookable' && composing && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`reason-${timing.id}`} className="text-[13px] font-bold text-ink2">
              What do you want help with?
            </label>
            <TextArea
              id={`reason-${timing.id}`}
              rows={3}
              autoFocus
              maxLength={REASON_MAX}
              aria-describedby={countId}
              placeholder={'For example, I don’t understand problems 12 to 18'}
              value={reason}
              onChange={(e) => {
                onReason(e.target.value)
                setProblem('')
              }}
            />
            <div className="flex justify-between text-[13px] text-muted">
              <span>At least 10 characters.</span>
              <span id={countId} className="tabular-nums">
                {reason.length} / {REASON_MAX}
              </span>
            </div>
          </div>
          <div className="rounded-xl bg-soft px-3.5 py-3 text-sm font-semibold leading-[1.6] text-ink2">
            {formatDateShort(date)} &middot; {timing.name} {formatRange(timing.start, timing.end)} &middot; {teacher.name}
          </div>
          <ErrorText>{problem}</ErrorText>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" loading={confirming} onClick={confirm}>
              Confirm booking
            </Button>
            <Button disabled={confirming} onClick={onBack}>
              Back
            </Button>
          </div>
        </div>
      )}

      {state.kind === 'full' && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Button disabled>Full</Button>
          <TextButton onClick={onAskRequest}>Ask for a different time</TextButton>
        </div>
      )}

      {state.kind === 'started' && <Button disabled>Started</Button>}

      {state.kind === 'clash' && (
        <>
          <Button disabled>Book a spot</Button>
          <div className="rounded-lg bg-amber px-2.5 py-1.5 text-[13px] font-bold text-amber-ink">
            You&rsquo;re booked with {state.teacher?.name ?? 'another teacher'} at this time.
          </div>
        </>
      )}

      {state.kind === 'booked' && !asking && (
        <div className="flex flex-wrap items-center gap-3">
          <Chip>You&rsquo;re booked &#10003;</Chip>
          <Button variant="danger" aria-label={`Cancel your booking in ${timing.name}`} onClick={() => setAsking(true)}>
            Cancel
          </Button>
        </div>
      )}

      {state.kind === 'booked' && asking && (
        <ConfirmBar message={`Cancel this booking? ${teacher.name} will be told, and your spot opens up for other students.`}>
          <Button
            variant="dangerfill"
            autoFocus
            loading={cancelling}
            onClick={async () => {
              setCancelling(true)
              await onCancelBooking(state.booking.id)
              setCancelling(false)
              setAsking(false)
            }}
          >
            Yes, cancel
          </Button>
          <Button disabled={cancelling} onClick={() => setAsking(false)}>
            Keep it
          </Button>
        </ConfirmBar>
      )}

      {notice && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {notice}
        </p>
      )}
    </section>
  )
}
