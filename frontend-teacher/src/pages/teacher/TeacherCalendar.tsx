// Owner: Subgroup B (Teacher desktop UI). Purpose: month calendar of office hours, seats and students; works for any month.
import { useEffect, useMemo, useState } from 'react'
import Icon from '../../components/teacher/Icons'
import { LinkButton } from '../../components/teacher/Button'
import { Badge, Card, EmptyState, PageHeader, SeatDots } from '../../components/teacher/ui'
import { useTeacherData } from '../../hooks/TeacherDataProvider'
import {
  addDays,
  dayOfMonth,
  formatDateLong,
  formatMonth,
  formatTimeRange,
  parseISODate,
  shortMonth,
  startOfWeek,
  toISODate,
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
} from '../../lib/dates'
import type { Booking, Slot } from '../../types'

interface MonthView {
  year: number
  month: number
}

/** Mon-Fri rows that cover the month, including leading/trailing days from neighbouring months. */
function buildWeeks(view: MonthView): string[][] {
  const first = new Date(view.year, view.month, 1)
  const last = new Date(view.year, view.month + 1, 0)
  const firstMonday = first.getDay() === 0 || first.getDay() === 6 ? addDays(startOfWeek(first), 7) : startOfWeek(first)
  const lastWeekday = last.getDay() === 6 ? addDays(last, -1) : last.getDay() === 0 ? addDays(last, -2) : last
  const lastMonday = startOfWeek(lastWeekday)

  const weeks: string[][] = []
  for (let monday = firstMonday; monday <= lastMonday; monday = addDays(monday, 7)) {
    weeks.push([0, 1, 2, 3, 4].map((i) => toISODate(addDays(monday, i))))
  }
  return weeks
}

function firstWeekdayOfMonth(view: MonthView): string {
  const d = new Date(view.year, view.month, 1)
  if (d.getDay() === 6) return toISODate(addDays(d, 2))
  if (d.getDay() === 0) return toISODate(addDays(d, 1))
  return toISODate(d)
}

function BookingRow({ b }: { b: Booking }) {
  return (
    <li className="rounded-xl bg-canvas px-3 py-2">
      <p className="text-sm font-bold">{b.studentName}</p>
      <p className="text-sm text-muted">{b.reason}</p>
    </li>
  )
}

export default function TeacherCalendar() {
  const { data, today, getSlots, version } = useTeacherData()

  const [view, setView] = useState<MonthView>(() => {
    const d = parseISODate(today)
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [selected, setSelected] = useState(today)
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const weeks = useMemo(() => buildWeeks(view), [view])
  const from = weeks[0][0]
  const to = weeks[weeks.length - 1][4]

  useEffect(() => {
    let cancelled = false
    getSlots(from, to)
      .then((result) => {
        if (cancelled) return
        setSlots(result)
        setLoadError(null)
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load this month.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [from, to, version, getSlots])

  const slotsByDate = useMemo(() => {
    const map = new Map<string, Slot[]>()
    for (const s of slots) map.set(s.date, [...(map.get(s.date) ?? []), s])
    return map
  }, [slots])

  const dayOffByDate = useMemo(() => new Map(data.daysOff.map((d) => [d.date, d])), [data.daysOff])

  function go(delta: number) {
    const next = new Date(view.year, view.month + delta, 1)
    const nextView = { year: next.getFullYear(), month: next.getMonth() }
    setView(nextView)
    setLoading(true)
    const t = parseISODate(today)
    setSelected(
      t.getFullYear() === nextView.year && t.getMonth() === nextView.month ? today : firstWeekdayOfMonth(nextView),
    )
  }

  function goToday() {
    const t = parseISODate(today)
    setView({ year: t.getFullYear(), month: t.getMonth() })
    setLoading(true)
    setSelected(today)
  }

  const selectedSlots = slotsByDate.get(selected) ?? []
  const selectedDayOff = dayOffByDate.get(selected)
  const selectedBookings = data.bookings.filter((b) => b.date === selected)
  const slotIds = new Set(selectedSlots.map((s) => s.id))
  const extraBookings = selectedBookings.filter((b) => !b.slotId || !slotIds.has(b.slotId))
  const selectedPast = selected < today

  return (
    <div>
      <PageHeader
        title="Calendar"
        subtitle="See every office hour and who is coming."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous month"
              className="rounded-lg border border-line bg-surface p-2 hover:bg-canvas"
            >
              <Icon name="left" />
            </button>
            <span className="min-w-36 text-center font-extrabold" aria-live="polite">
              {formatMonth(view.year, view.month)}
            </span>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next month"
              className="rounded-lg border border-line bg-surface p-2 hover:bg-canvas"
            >
              <Icon name="right" />
            </button>
            <button
              type="button"
              onClick={goToday}
              className="ml-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold hover:bg-canvas"
            >
              Today
            </button>
          </div>
        }
      />

      {loadError && (
        <p role="alert" className="mb-4 rounded-lg bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
          {loadError}
        </p>
      )}

      <div className="grid grid-cols-[1fr_340px] items-start gap-5">
        <Card className="p-5" >
          <div role="grid" aria-label={`Office hours in ${formatMonth(view.year, view.month)}`} aria-busy={loading}>
            <div role="row" className="mb-2 grid grid-cols-5 gap-2">
              {WEEKDAY_ORDER.map((w) => (
                <div key={w} role="columnheader" className="px-2 text-xs font-bold uppercase tracking-wide text-muted">
                  {WEEKDAY_LABELS[w]}
                </div>
              ))}
            </div>
            {weeks.map((week) => (
              <div key={week[0]} role="row" className="mb-2 grid grid-cols-5 gap-2">
                {week.map((date) => {
                  const inMonth = parseISODate(date).getMonth() === view.month
                  const past = date < today
                  const isToday = date === today
                  const daySlots = slotsByDate.get(date) ?? []
                  const dayOff = dayOffByDate.get(date)
                  const bookedTotal = daySlots.reduce((n, s) => n + s.booked, 0)
                  const label = `${formatDateLong(date)}${isToday ? ', today' : ''}${
                    dayOff ? ', day off' : `, ${daySlots.length} office hours, ${bookedTotal} seats booked`
                  }${past ? ', in the past' : ''}`
                  return (
                    <button
                      key={date}
                      role="gridcell"
                      type="button"
                      onClick={() => setSelected(date)}
                      aria-label={label}
                      aria-pressed={selected === date}
                      className={`min-h-28 rounded-xl border p-2 text-left align-top transition-colors ${
                        past ? 'border-transparent bg-past text-muted' : 'border-line bg-surface hover:border-brand'
                      } ${selected === date ? 'ring-2 ring-brand' : ''} ${isToday ? 'border-brand' : ''}`}
                    >
                      <span className="flex items-center justify-between">
                        <span className={`text-sm font-bold ${inMonth ? '' : 'text-muted'}`}>
                          {!inMonth || dayOfMonth(date) === 1 ? `${shortMonth(date)[0]}${shortMonth(date).slice(1).toLowerCase()} ` : ''}
                          {dayOfMonth(date)}
                        </span>
                        {isToday && <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-white">Today</span>}
                      </span>
                      <span className="mt-1 flex flex-col gap-1">
                        {dayOff ? (
                          <span className="rounded-md bg-warn-soft px-1.5 py-0.5 text-xs font-bold text-warn-ink">Day off</span>
                        ) : (
                          daySlots.map((s) => {
                            const full = s.booked >= s.maxStudents
                            const tone = past
                              ? 'bg-surface text-muted'
                              : full
                                ? 'bg-warn-soft text-warn-ink'
                                : 'bg-brand-soft text-brand-ink'
                            return (
                              <span key={s.id} className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${tone}`}>
                                {s.name} &middot; {full ? 'Full' : `${s.booked}/${s.maxStudents}`}
                              </span>
                            )
                          })
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-5 text-xs text-muted">
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-brand-soft" />Seats open</span>
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-warn-soft" />Full or day off</span>
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-past" />Past, can&apos;t be booked</span>
          </div>
        </Card>

        <Card>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Selected day</p>
          <h2 className="mb-4 text-xl font-extrabold">{formatDateLong(selected)}</h2>

          {selectedDayOff && (
            <div className="mb-4 rounded-xl bg-warn-soft px-4 py-3 text-sm font-semibold text-warn-ink">
              Day off{selectedDayOff.reason ? `: ${selectedDayOff.reason}` : ''}. Students can&apos;t book this day.
            </div>
          )}

          {selectedSlots.length === 0 && extraBookings.length === 0 && (
            <EmptyState>
              {selectedDayOff
                ? 'No office hours run on a day off.'
                : 'No office hours on this day. Change your schedule on the Office hours page.'}
            </EmptyState>
          )}

          {selectedSlots.map((s) => {
            const list = selectedBookings.filter((b) => b.slotId === s.id)
            return (
              <div key={s.id} className="mb-5 border-b border-line pb-5 last:border-b-0 last:pb-0">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-bold">{s.name}</h3>
                  <span className="text-sm text-muted">{formatTimeRange(s.start, s.end)}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-sm text-muted">
                  <SeatDots booked={s.booked} max={s.maxStudents} />
                  {s.booked} of {s.maxStudents} seats
                  {s.booked > s.maxStudents && <Badge tone="warn">Over capacity</Badge>}
                </div>
                {list.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">No students booked yet.</p>
                ) : (
                  <ul className="mt-3 flex flex-col gap-2">
                    {list.map((b) => (
                      <BookingRow key={b.id} b={b} />
                    ))}
                  </ul>
                )}
              </div>
            )
          })}

          {extraBookings.length > 0 && (
            <div className="mb-5">
              <h3 className="font-bold">Outside your current schedule</h3>
              <p className="text-sm text-muted">Accepted requests, or bookings from a schedule you changed.</p>
              <ul className="mt-3 flex flex-col gap-2">
                {extraBookings.map((b) => (
                  <BookingRow key={b.id} b={b} />
                ))}
              </ul>
            </div>
          )}

          {selectedDayOff ? (
            <LinkButton to="/teacher/days-off" className="mt-2 w-full">
              Manage days off
            </LinkButton>
          ) : selectedPast ? (
            <p className="mt-2 text-sm text-muted">This day has passed, so it can&apos;t be marked as a day off.</p>
          ) : (
            <LinkButton to={`/teacher/days-off?date=${selected}`} className="mt-2 w-full">
              Mark this day off
            </LinkButton>
          )}
        </Card>
      </div>
    </div>
  )
}
