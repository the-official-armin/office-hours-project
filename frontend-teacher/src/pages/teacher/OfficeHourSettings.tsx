// Owner: Subgroup B (Teacher desktop UI). Purpose: choose the two office-hour timings, their days, and seats per office hour.
// The backend enforces seat limits and keeps existing bookings; the UI only pre-validates and shows warnings.
import { useState } from 'react'
import Button from '../../components/teacher/Button'
import FormInput from '../../components/teacher/FormInput'
import { Card, FeedbackMessage, Notice, PageHeader } from '../../components/teacher/ui'
import { useTeacherData } from '../../hooks/TeacherDataProvider'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import { formatDateShort, WEEKDAY_LABELS, WEEKDAY_ORDER } from '../../lib/dates'
import type { Schedule, Timing, Weekday } from '../../types'

const MAX_SEATS = 20

function clientErrors(draft: Schedule): string[] {
  const errors: string[] = []
  draft.timings.forEach((t, i) => {
    const label = t.name.trim() || `Timing ${i + 1}`
    if (!t.name.trim()) errors.push(`Give timing ${i + 1} a name.`)
    if (t.end <= t.start) errors.push(`${label}: the end time must be after the start time.`)
  })
  return errors
}

export default function OfficeHourSettings() {
  const { data, saveSchedule } = useTeacherData()
  const { run, feedback, isPending } = useAsyncAction()
  const [draft, setDraft] = useState<Schedule>(data.schedule)

  const dirty = JSON.stringify(draft) !== JSON.stringify(data.schedule)
  const errors = clientErrors(draft)

  const officeHoursPerWeek = draft.timings.reduce((n, t) => n + t.days.length, 0)
  const seats = draft.seatsPerOfficeHour

  function updateTiming(index: 0 | 1, patch: Partial<Timing>) {
    setDraft((d) => {
      const timings: [Timing, Timing] = [{ ...d.timings[0] }, { ...d.timings[1] }]
      timings[index] = { ...timings[index], ...patch }
      return { ...d, timings }
    })
  }

  function toggleDay(index: 0 | 1, day: Weekday) {
    const current = draft.timings[index].days
    const days = current.includes(day) ? current.filter((d) => d !== day) : [...current, day]
    updateTiming(
      index,
      { days: WEEKDAY_ORDER.filter((d) => days.includes(d)) },
    )
  }

  function setSeats(value: number) {
    setDraft((d) => ({ ...d, seatsPerOfficeHour: Math.min(MAX_SEATS, Math.max(1, value)) }))
  }

  async function save() {
    const view = await run('save', () => saveSchedule(draft), (v) =>
      v.warnings.length > 0
        ? 'Office hours saved. Some existing bookings no longer fit; they were kept (see the warning below).'
        : 'Office hours saved.',
    )
    if (view) setDraft(view.schedule)
  }

  return (
    <div>
      <PageHeader title="Office hours" subtitle="Pick the two times you hold office hours and which days each one runs." />

      {data.warnings.length > 0 && (
        <div className="mb-5">
          <Notice tone="warn">
            <p className="font-bold">Some bookings no longer fit your schedule. They were kept, nothing was deleted.</p>
            <ul className="mt-1 list-disc pl-5">
              {data.warnings.map((w) => (
                <li key={`${w.date}-${w.timingName}-${w.kind}`}>
                  {formatDateShort(w.date)} &middot; {w.timingName}:{' '}
                  {w.kind === 'over_capacity'
                    ? `${w.booked} students booked but only ${w.max} seats now.`
                    : `${w.booked} booking${w.booked === 1 ? '' : 's'} on a day that is no longer on your schedule.`}
                </li>
              ))}
            </ul>
          </Notice>
        </div>
      )}

      <div className="grid grid-cols-2 gap-5">
        {draft.timings.map((t, i) => {
          const index = i as 0 | 1
          return (
            <Card key={t.id}>
              <h2 className="mb-4 flex items-center gap-3 text-lg font-extrabold">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft text-sm text-brand-ink">
                  {i + 1}
                </span>
                {i === 0 ? 'First timing' : 'Second timing'}
              </h2>
              <div className="space-y-4">
                <FormInput label="Name" value={t.name} onChange={(e) => updateTiming(index, { name: e.target.value })} />
                <div className="grid grid-cols-2 gap-4">
                  <FormInput
                    label="Starts"
                    type="time"
                    value={t.start}
                    onChange={(e) => updateTiming(index, { start: e.target.value })}
                  />
                  <FormInput
                    label="Ends"
                    type="time"
                    value={t.end}
                    onChange={(e) => updateTiming(index, { end: e.target.value })}
                  />
                </div>
                <fieldset>
                  <legend className="mb-1.5 text-sm font-semibold">Days</legend>
                  <div className="flex gap-2">
                    {WEEKDAY_ORDER.map((d) => {
                      const on = t.days.includes(d)
                      return (
                        <button
                          key={d}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggleDay(index, d)}
                          className={`rounded-lg border px-3 py-2 text-sm font-bold transition-colors ${
                            on ? 'border-brand bg-brand text-on-brand' : 'border-line bg-surface hover:bg-canvas'
                          }`}
                        >
                          {WEEKDAY_LABELS[d]}
                        </button>
                      )
                    })}
                  </div>
                </fieldset>
              </div>
            </Card>
          )
        })}

        <Card>
          <h2 className="mb-4 text-lg font-extrabold">Seats per office hour</h2>
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label="Fewer seats"
              disabled={seats <= 1}
              onClick={() => setSeats(seats - 1)}
              className="h-10 w-10 rounded-lg border border-line bg-surface text-lg font-bold hover:bg-canvas disabled:opacity-50"
            >
              &minus;
            </button>
            <span className="w-12 text-center text-4xl font-extrabold" aria-live="polite">
              {seats}
            </span>
            <button
              type="button"
              aria-label="More seats"
              disabled={seats >= MAX_SEATS}
              onClick={() => setSeats(seats + 1)}
              className="h-10 w-10 rounded-lg border border-line bg-surface text-lg font-bold hover:bg-canvas disabled:opacity-50"
            >
              +
            </button>
            <p className="text-sm text-muted">students at most. The default is 4.</p>
          </div>
          <p className="mt-4 rounded-lg bg-brand-soft px-4 py-3 text-sm font-bold text-brand-ink">
            {officeHoursPerWeek} office hour{officeHoursPerWeek === 1 ? '' : 's'} a week, {seats} seats each:{' '}
            {officeHoursPerWeek * seats} seats in total.
          </p>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-extrabold">What students can&apos;t do</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted marker:text-brand">
            <li>Book a time that has already passed.</li>
            <li>Book on a day you marked as a day off.</li>
            <li>Take a seat once an office hour is full.</li>
          </ul>
          <p className="mt-4 text-xs text-muted">The server enforces these rules. This page only shows them.</p>
        </Card>
      </div>

      <div className="mt-5 space-y-3">
        {errors.length > 0 && (
          <ul role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <FeedbackMessage feedback={feedback} />
        <div className="flex justify-end gap-3">
          <Button variant="secondary" disabled={!dirty || isPending('save')} onClick={() => setDraft(data.schedule)}>
            Discard changes
          </Button>
          <Button disabled={!dirty || errors.length > 0} loading={isPending('save')} onClick={save}>
            Save office hours
          </Button>
        </div>
      </div>
    </div>
  )
}
