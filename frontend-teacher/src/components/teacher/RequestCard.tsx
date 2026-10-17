// Owner: Subgroup B (Teacher desktop UI). A compact request with Accept / Decline (used on the Dashboard).
// Presentational only: the page owns the actions and the feedback, because the card unmounts once handled.
import { formatDateShort, formatTime } from '../../lib/dates'
import type { BookingRequest } from '../../types'
import Button from './Button'

interface RequestCardProps {
  request: BookingRequest
  busy: 'accept' | 'decline' | null
  disabled: boolean
  onAccept: () => void
  onDecline: () => void
}

export default function RequestCard({ request, busy, disabled, onAccept, onDecline }: RequestCardProps) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-bold">{request.studentName}</p>
        <p className="text-sm text-muted">
          {formatDateShort(request.date)} &middot; {formatTime(request.start)}
        </p>
      </div>
      <p className="mt-1 text-sm text-muted">{request.reason}</p>
      <div className="mt-3 flex gap-2">
        <Button disabled={disabled} loading={busy === 'accept'} onClick={onAccept}>
          Accept
        </Button>
        <Button variant="secondary" disabled={disabled} loading={busy === 'decline'} onClick={onDecline}>
          Decline
        </Button>
      </div>
    </div>
  )
}
