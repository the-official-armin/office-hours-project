// Owner: Subgroup B (Teacher desktop UI). Purpose: mark and remove days off, with a confirmation when bookings are affected.
// The backend blocks bookings on days off; the UI only displays this and asks before affecting bookings.
import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import Button from '../../components/teacher/Button'
import FormInput from '../../components/teacher/FormInput'
import { Badge, Card, DateBadge, EmptyState, FeedbackMessage, Notice, PageHeader } from '../../components/teacher/ui'
import { useTeacherData } from '../../hooks/TeacherDataProvider'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import { formatDateLong } from '../../lib/dates'
import type { DayOffPreview } from '../../types'

export default function DaysOff() {
  const { data, today, previewDayOff, addDayOff, removeDayOff } = useTeacherData()
  const { run, feedback, pending, isPending } = useAsyncAction()
  const [params] = useSearchParams()

  const [date, setDate] = useState(params.get('date') ?? '')
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState<DayOffPreview | null>(null)

  const upcoming = data.daysOff.filter((d) => d.date >= today)

  function affectedFor(dayDate: string): number {
    return data.bookings.filter((b) => b.date === dayDate).length
  }

  async function save(forDate: string) {
    const created = await run('add', () => addDayOff({ date: forDate, reason }), `Day off added for ${formatDateLong(forDate)}.`)
    if (created) {
      setDate('')
      setReason('')
      setConfirming(null)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!date) return
    const preview = await run('add', () => previewDayOff(date))
    if (!preview) return
    if (preview.affectedBookings > 0) {
      setConfirming(preview)
    } else {
      await save(preview.date)
    }
  }

  return (
    <div>
      <PageHeader title="Days off" subtitle="Students can't book any office hour on these days." />

      <div className="grid grid-cols-[1.5fr_1fr] items-start gap-5">
        <Card>
          <h2 className="mb-3 text-lg font-extrabold">Upcoming days off</h2>
          {upcoming.length === 0 ? (
            <EmptyState>No days off coming up. Add one on the right and students won&apos;t be able to book that day.</EmptyState>
          ) : (
            <ul>
              {upcoming.map((d) => {
                const affected = affectedFor(d.date)
                return (
                  <li key={d.id} className="flex items-center gap-4 border-t border-line py-3 first:border-t-0">
                    <DateBadge date={d.date} tone="warn" />
                    <div className="flex-1">
                      <p className="font-bold">{formatDateLong(d.date)}</p>
                      <p className="text-sm text-muted">{d.reason || 'No reason given'}</p>
                    </div>
                    {affected > 0 ? (
                      <Badge tone="warn">
                        {affected} booking{affected === 1 ? '' : 's'} affected
                      </Badge>
                    ) : (
                      <Badge>No bookings</Badge>
                    )}
                    <Button
                      variant="secondary"
                      disabled={pending}
                      loading={isPending(`remove:${d.id}`)}
                      aria-label={`Remove day off on ${formatDateLong(d.date)}`}
                      onClick={() =>
                        run(`remove:${d.id}`, () => removeDayOff(d.id), `Removed the day off on ${formatDateLong(d.date)}.`)
                      }
                    >
                      Remove
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-extrabold">Add a day off</h2>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormInput
              label="Date"
              type="date"
              min={today}
              value={date}
              required
              onChange={(e) => {
                setDate(e.target.value)
                setConfirming(null)
              }}
            />
            <FormInput label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />

            {confirming ? (
              <div className="space-y-3 rounded-xl bg-warn-soft p-4 text-warn-ink">
                <p className="text-sm font-bold">
                  {confirming.affectedBookings} booking{confirming.affectedBookings === 1 ? '' : 's'} on{' '}
                  {formatDateLong(confirming.date)} will be affected.
                </p>
                <p className="text-sm">
                  The bookings are kept, but students can&apos;t book more seats that day. You may want to contact them.
                </p>
                <div className="flex gap-2">
                  <Button type="button" loading={isPending('add')} onClick={() => save(confirming.date)}>
                    Confirm day off
                  </Button>
                  <Button type="button" variant="secondary" disabled={pending} onClick={() => setConfirming(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button type="submit" className="w-full" loading={isPending('add')} disabled={!date}>
                Add day off
              </Button>
            )}
          </form>
          <div className="mt-4 space-y-3">
            <FeedbackMessage feedback={feedback} />
            <Notice tone="warn">
              If students already booked that day, you&apos;ll see how many bookings are affected before you confirm.
            </Notice>
          </div>
        </Card>
      </div>
    </div>
  )
}
