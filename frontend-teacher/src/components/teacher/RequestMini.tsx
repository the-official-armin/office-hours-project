// Owner: Subgroup B (Teacher desktop UI). A compact open request with Accept / Decline (Dashboard and the requests pop-up).
// Presentational: the page owns the action and its pending state, because the row disappears once answered.
import { formatDateShort, formatTime } from '../../lib/dates'
import type { BookingRequest } from '../../types'
import Button from '../common/Button'

interface Props {
  request: BookingRequest
  busy: 'accepted' | 'declined' | null
  disabled: boolean
  /** First row in a pop-up: no line above it. */
  first?: boolean
  onAnswer: (answer: 'accepted' | 'declined') => void
}

export default function RequestMini({ request: r, busy, disabled, first = false, onAnswer }: Props) {
  return (
    <div className={`flex flex-col gap-2 py-4 ${first ? '' : 'border-t border-line'}`}>
      <div className="flex flex-wrap justify-between gap-3">
        <b className="text-[15px]">{r.studentName}</b>
        <span className="text-[13px] text-muted">
          {formatDateShort(r.date)} &middot; {formatTime(r.time)}
        </span>
      </div>
      <p className="leading-normal text-ink2">{r.reason}</p>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          variant="primary"
          disabled={disabled}
          loading={busy === 'accepted'}
          aria-label={`Accept ${r.studentName}`}
          onClick={() => onAnswer('accepted')}
        >
          Accept
        </Button>
        <Button disabled={disabled} loading={busy === 'declined'} aria-label={`Decline ${r.studentName}`} onClick={() => onAnswer('declined')}>
          Decline
        </Button>
      </div>
    </div>
  )
}
