// Owner: Subgroup B (Teacher desktop UI). Purpose: DEMO ONLY. Stands in for the Student UI so the whole flow can be shown.
// Everything here goes through the same booking rules the backend will enforce. Safe to delete with its route and sidebar link.
import { useState, type FormEvent } from 'react'
import Button from '../../components/teacher/Button'
import FormInput from '../../components/teacher/FormInput'
import { Card, EmptyState, FeedbackMessage, Notice, PageHeader } from '../../components/teacher/ui'
import { useTeacherData } from '../../hooks/TeacherDataProvider'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import { combine, formatDateShort, formatTime, formatTimeRange } from '../../lib/dates'

export default function DemoTools() {
  const { data, now, usingMocks, demo, cancelBooking } = useTeacherData()
  const booking = useAsyncAction()
  const request = useAsyncAction()
  const cancel = useAsyncAction()
  const reset = useAsyncAction()

  const [slotId, setSlotId] = useState('')
  const [bookName, setBookName] = useState('')
  const [bookReason, setBookReason] = useState('')

  const [reqDate, setReqDate] = useState('')
  const [reqTime, setReqTime] = useState('15:30')
  const [reqName, setReqName] = useState('')
  const [reqReason, setReqReason] = useState('')

  const [confirmReset, setConfirmReset] = useState(false)

  if (!usingMocks) {
    return (
      <div>
        <PageHeader title="Demo tools" />
        <Notice tone="warn">Demo tools only work with the local demo data. Set VITE_USE_MOCKS=true to use them.</Notice>
      </div>
    )
  }

  const upcomingBookings = data.bookings.filter((b) => combine(b.date, b.start) > now)

  async function submitBooking(e: FormEvent) {
    e.preventDefault()
    const chosen = slotId || data.slots[0]?.id
    if (!chosen) return
    const result = await booking.run(
      'book',
      () => demo.book({ slotId: chosen, studentName: bookName, reason: bookReason }),
      (b) => `Booked ${b.studentName} into ${b.timingName} on ${formatDateShort(b.date)}.`,
    )
    if (result) {
      setBookName('')
      setBookReason('')
    }
  }

  async function submitRequest(e: FormEvent) {
    e.preventDefault()
    const result = await request.run(
      'request',
      () => demo.request({ date: reqDate, start: reqTime, studentName: reqName, reason: reqReason }),
      (r) => `Request added for ${r.studentName} on ${formatDateShort(r.date)} at ${formatTime(r.start)}.`,
    )
    if (result) {
      setReqName('')
      setReqReason('')
    }
  }

  async function doReset() {
    const done = await reset.run('reset', async () => {
      await demo.reset()
      return true
    }, 'Demo data was reset to the starting data.')
    if (done) setConfirmReset(false)
  }

  return (
    <div>
      <PageHeader
        title="Demo tools"
        subtitle="Act as a student to try the whole flow. The Student UI belongs to another team."
      />

      <div className="grid grid-cols-2 gap-5">
        <Card>
          <h2 className="mb-1 text-lg font-extrabold">Add a student booking</h2>
          <p className="mb-4 text-sm text-muted">
            Past, day-off and full office hours are all listed so you can see each rule block the booking.
          </p>
          <form onSubmit={submitBooking} className="space-y-4">
            <label className="block text-sm">
              <span className="mb-1.5 block font-semibold">Office hour</span>
              <select
                value={slotId || data.slots[0]?.id || ''}
                onChange={(e) => setSlotId(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2"
              >
                {data.slots.map((s) => {
                  const off = data.daysOff.some((d) => d.date === s.date)
                  const past = combine(s.date, s.start) <= now
                  const tags = [past && 'past', off && 'day off', s.booked >= s.maxStudents && 'full'].filter(Boolean)
                  return (
                    <option key={s.id} value={s.id}>
                      {formatDateShort(s.date)} &middot; {s.name} {formatTimeRange(s.start, s.end)} &middot; {s.booked}/
                      {s.maxStudents}
                      {tags.length > 0 ? ` (${tags.join(', ')})` : ''}
                    </option>
                  )
                })}
              </select>
            </label>
            <FormInput label="Student name" value={bookName} onChange={(e) => setBookName(e.target.value)} required />
            <FormInput label="Reason" value={bookReason} onChange={(e) => setBookReason(e.target.value)} />
            <Button type="submit" loading={booking.isPending('book')} disabled={data.slots.length === 0}>
              Book this seat
            </Button>
            <FeedbackMessage feedback={booking.feedback} />
          </form>
        </Card>

        <Card>
          <h2 className="mb-1 text-lg font-extrabold">Add a student request</h2>
          <p className="mb-4 text-sm text-muted">A request for a time outside your office hours.</p>
          <form onSubmit={submitRequest} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormInput label="Date" type="date" value={reqDate} onChange={(e) => setReqDate(e.target.value)} required />
              <FormInput label="Time" type="time" value={reqTime} onChange={(e) => setReqTime(e.target.value)} required />
            </div>
            <FormInput label="Student name" value={reqName} onChange={(e) => setReqName(e.target.value)} required />
            <FormInput label="Reason" value={reqReason} onChange={(e) => setReqReason(e.target.value)} />
            <Button type="submit" loading={request.isPending('request')}>
              Send request
            </Button>
            <FeedbackMessage feedback={request.feedback} />
          </form>
        </Card>

        <Card>
          <h2 className="mb-3 text-lg font-extrabold">Cancel a booking</h2>
          {upcomingBookings.length === 0 ? (
            <EmptyState>No upcoming bookings to cancel. Add one with the form above.</EmptyState>
          ) : (
            <ul className="max-h-72 overflow-y-auto">
              {upcomingBookings.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 border-t border-line py-2 first:border-t-0">
                  <div className="text-sm">
                    <p className="font-bold">{b.studentName}</p>
                    <p className="text-muted">
                      {formatDateShort(b.date)} &middot; {formatTime(b.start)} &middot; {b.timingName ?? 'Accepted request'}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    disabled={cancel.pending}
                    loading={cancel.isPending(b.id)}
                    aria-label={`Cancel booking for ${b.studentName}`}
                    onClick={() => cancel.run(b.id, () => cancelBooking(b.id), `Cancelled ${b.studentName}'s booking.`)}
                  >
                    Cancel
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3">
            <FeedbackMessage feedback={cancel.feedback} />
          </div>
        </Card>

        <Card>
          <h2 className="mb-1 text-lg font-extrabold">Reset demo data</h2>
          <p className="mb-4 text-sm text-muted">
            Restores the starting bookings, requests and day off, and clears notifications. You stay logged in.
          </p>
          {confirmReset ? (
            <div className="flex gap-2">
              <Button variant="danger" loading={reset.isPending('reset')} onClick={doReset}>
                Yes, reset everything
              </Button>
              <Button variant="secondary" disabled={reset.pending} onClick={() => setConfirmReset(false)}>
                Keep my data
              </Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setConfirmReset(true)}>
              Reset demo data
            </Button>
          )}
          <div className="mt-3">
            <FeedbackMessage feedback={reset.feedback} />
          </div>
        </Card>
      </div>
    </div>
  )
}
