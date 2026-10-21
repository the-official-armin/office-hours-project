// Owner: Subgroup B (Teacher desktop UI). One booked student: name, seat, reason, and a chip when the booking is disrupted.
import { DISRUPT_TEXT, type Disruption } from '../../lib/rules'
import type { Booking } from '../../types'
import Chip from '../common/Chip'

export default function StudentBox({ booking: b, disrupted }: { booking: Booking; disrupted: Disruption | null }) {
  return (
    <div className="rounded-[10px] bg-soft px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <b className="text-sm">{b.studentName}</b>
        <span className="text-[13px] text-muted">Seat {b.seat}</span>
      </div>
      <div className="mt-0.5 text-[13px] text-muted">{b.reason}</div>
      {disrupted && (
        <div className="mt-1.5">
          <Chip kind="amber">{DISRUPT_TEXT[disrupted]}</Chip>
        </div>
      )}
    </div>
  )
}
