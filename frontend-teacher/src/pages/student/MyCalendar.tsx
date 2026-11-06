// Owner: Subgroup B (Teacher desktop UI). Purpose: the student's own calendar across ALL teachers: confirmed bookings,
// bookings affected by a change, pending and accepted requests, and what is past or cancelled.
// Same shared Calendar as the teacher's (Week / Month / Quarter). The panel for the selected day lists everything on it
// with the actions that make sense (cancel, cancel a request, book another time).
import { useEffect, useMemo, useState } from 'react'
import { ConfirmBar } from '../../components/common/Banner'
import Button, { LinkButton } from '../../components/common/Button'
import {
  CalendarControls,
  CalendarGrid,
  CalendarLegend,
  type DayRender,
  type MiniRender,
} from '../../components/common/Calendar'
import Card, { Eyebrow } from '../../components/common/Card'
import Chip from '../../components/common/Chip'
import { ErrorText } from '../../components/common/fields'
import PageHeader from '../../components/common/PageHeader'
import { useStudentData } from '../../hooks/StudentData'
import { useAction } from '../../hooks/useAction'
import { initialCal, visibleRange, type CalState } from '../../lib/calendar'
import { formatDateLong, plural, toISODate } from '../../lib/dates'
import {
  buildItems,
  chipText,
  dayStatus,
  hasBookingDot,
  itemSpoken,
  itemsByDate,
  KIND_LABEL,
  teacherKey,
  tinyText,
  type CalItem,
  type ItemKind,
} from '../../lib/studentCalendar'
import type { CalendarData } from '../../types'

const BLOCK: Record<ItemKind, string> = {
  booking: 'bg-tint text-tint-ink',
  disrupted: 'bg-amber text-amber-ink',
  pending: 'border-2 border-dashed border-link bg-surface text-ink',
  accepted: 'bg-tint text-tint-ink',
  past: 'border border-line bg-past text-past-ink',
  cancelled: 'border border-line bg-past text-past-ink line-through',
}

const CHIP: Record<ItemKind, 'tint' | 'amber' | 'past'> = {
  booking: 'tint',
  disrupted: 'amber',
  pending: 'amber',
  accepted: 'tint',
  past: 'past',
  cancelled: 'past',
}

/** What the student sees under "Requested" on the week blocks and in the day panel. */
function when(i: CalItem): string {
  if (i.source === 'request') return `${i.kind === 'pending' ? 'Requested' : 'Requested time'} · ${i.time}`
  return `${i.timingName} · ${i.time}`
}

function Skeleton() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading your calendar</span>
      <div className="grid grid-cols-5 gap-2 max-[640px]:gap-1">
        {Array.from({ length: 15 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-past max-[640px]:h-[76px]" />
        ))}
      </div>
    </div>
  )
}

interface Loaded {
  from: string
  to: string
  data: CalendarData
}

export default function MyCalendar() {
  const { data, now, version, getCalendar, cancelBooking, cancelRequest } = useStudentData()
  const { run, error, pending, isPending } = useAction()
  const today = toISODate(now)

  const [cal, setCal] = useState<CalState>(() => initialCal(today, today))
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [cancelId, setCancelId] = useState('')

  const [from, to] = visibleRange(cal)

  // Fetch whenever the visible range changes, or the student's data changes. The old range stays on screen meanwhile.
  useEffect(() => {
    let current = true
    getCalendar(from, to).then(
      (result) => {
        if (!current) return
        setLoaded({ from, to, data: result })
        setLoadError(null)
      },
      (err: unknown) => {
        if (current) setLoadError(err instanceof Error ? err.message : 'Could not load your calendar.')
      },
    )
    return () => {
      current = false
    }
  }, [from, to, version, getCalendar])

  const items = useMemo(
    () => (loaded ? buildItems(loaded.data.bookings, loaded.data.requests, data.teachers, now) : []),
    [loaded, data.teachers, now],
  )
  const byDate = useMemo(() => itemsByDate(items), [items])

  const selected = cal.sel ?? today
  const stale = !loaded || loaded.from !== from || loaded.to !== to
  const selectedKnown = !!loaded && selected >= loaded.from && selected <= loaded.to
  const dayItems = byDate.get(selected) ?? []
  const pastDay = selected < today

  const describe = (date: string): string => {
    const list = byDate.get(date) ?? []
    if (list.length === 0) return `${formatDateLong(date)}, nothing booked`
    return `${formatDateLong(date)}, ${plural(list.length, 'item')}: ${list.map(itemSpoken).join('; ')}`
  }

  const renderDay = (date: string, view: 'week' | 'month'): DayRender => {
    const list = byDate.get(date) ?? []
    let content
    if (view === 'week') {
      content =
        list.length === 0 ? (
          <span className="text-[13px] text-muted">Nothing booked</span>
        ) : (
          list.map((i) => (
            <span key={i.id} className={`flex min-w-0 flex-col gap-[3px] rounded-[10px] p-1.5 text-xs leading-[1.3] break-words min-[641px]:[hyphens:manual] ${BLOCK[i.kind]}`}>
              <b className="text-[13px] font-extrabold">{i.teacherName}</b>
              <span>{i.subject}</span>
              <span className="font-semibold">{when(i)}</span>
              {i.flag && <span className="font-bold">{i.flag}</span>}
            </span>
          ))
        )
    } else {
      content = list.map((i) => (
        <span
          key={i.id}
          className={`max-w-full self-stretch rounded-lg px-2 py-1 text-xs font-bold leading-tight [overflow-wrap:anywhere] max-[640px]:rounded-md max-[640px]:px-1 max-[640px]:py-[3px] max-[640px]:text-[10.5px] ${BLOCK[i.kind]}`}
        >
          <span className="max-[640px]:hidden">{chipText(i)}</span>
          <span className="hidden max-[640px]:inline">{tinyText(i)}</span>
        </span>
      ))
    }
    return { aria: describe(date), content, past: date < today }
  }

  const renderMini = (date: string): MiniRender => {
    const list = byDate.get(date)
    return { status: dayStatus(list, date, today), aria: describe(date), dot: hasBookingDot(list) }
  }

  const select = (date: string) => {
    setCal((c) => ({ ...c, sel: date }))
    setCancelId('')
  }

  const key = teacherKey(items)

  return (
    <>
      <PageHeader
        title="My calendar"
        subtitle="Your bookings and requests with every teacher."
        actions={<CalendarControls cal={cal} today={today} onChange={setCal} />}
      />

      {loadError && (
        <p role="alert" className="rounded-xl bg-amber px-4 py-3 text-sm font-semibold text-amber-ink">
          {loadError}
        </p>
      )}

      <div className="flex flex-wrap items-start gap-6 [&>*]:min-w-0">
        <Card
          aria-label={`${cal.view === 'week' ? 'Week' : cal.view === 'month' ? 'Month' : 'Quarter'} calendar`}
          aria-busy={stale}
          className="flex-[999_1_520px] !p-3 min-[900px]:!p-5"
        >
          {loaded ? (
            <CalendarGrid cal={cal} today={today} onSelect={select} renderDay={renderDay} renderMini={renderMini} />
          ) : (
            <Skeleton />
          )}
          <CalendarLegend
            entries={[
              { swatch: 'bg-tint', label: 'Booked' },
              { swatch: 'bg-amber', label: 'Needs attention' },
              { swatch: 'border-2 border-dashed border-link bg-surface', label: 'Requested' },
              { swatch: 'border border-edge bg-past', label: 'Past or cancelled' },
            ]}
            extra={
              cal.view === 'quarter' ? (
                <span className="inline-flex items-center gap-2">
                  <i className="inline-block h-2 w-2 rounded-full bg-brand" />
                  Booking
                </span>
              ) : undefined
            }
          />
          {cal.view === 'month' && key && <div className="pt-2 text-[13px] text-muted min-[641px]:hidden">{key}</div>}
          {stale && loaded && (
            <span role="status" className="sr-only">
              Updating
            </span>
          )}
        </Card>

        <aside
          aria-labelledby="day-h"
          className="flex min-w-0 max-w-[380px] flex-[1_1_300px] flex-col gap-5 rounded-2xl border border-line bg-surface p-[18px] min-[900px]:p-6 max-[900px]:max-w-none"
        >
          <div>
            <Eyebrow>Selected day</Eyebrow>
            <h2 id="day-h" className="mt-1 text-xl font-extrabold">
              {formatDateLong(selected)}
            </h2>
          </div>

          <ErrorText>{error}</ErrorText>

          {!selectedKnown ? (
            <div role="status" aria-busy="true" className="flex flex-col gap-2">
              <span className="sr-only">Loading this day</span>
              <div className="h-16 animate-pulse rounded-xl bg-past" />
              <div className="h-16 animate-pulse rounded-xl bg-past" />
            </div>
          ) : dayItems.length === 0 ? (
            <div className="flex flex-col gap-3">
              <p className="rounded-xl bg-tint px-4 py-3 text-sm font-semibold text-tint-ink">Nothing booked.</p>
              {!pastDay && (
                <LinkButton to="/student/teachers" variant="primary" block>
                  Find a teacher
                </LinkButton>
              )}
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {dayItems.map((i) => {
                const asking = cancelId === i.id
                return (
                  <li key={i.id} className="flex flex-col gap-2 rounded-xl bg-soft p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <b className={`block text-sm ${i.kind === 'cancelled' ? 'line-through' : ''}`}>
                          {i.teacherName} &middot; {i.subject}
                        </b>
                        <span className="block text-[13px] text-muted">{when(i)}</span>
                      </div>
                      <Chip kind={CHIP[i.kind]}>{KIND_LABEL[i.kind]}</Chip>
                    </div>
                    {i.flag && (
                      <div>
                        <Chip kind="amber">{i.flag}</Chip>
                      </div>
                    )}
                    <p className="text-[13px] text-ink2">{i.reason}</p>
                    {i.note && <p className="text-[13px] text-muted">{i.note}</p>}

                    {!pastDay && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {i.cancellable && i.source === 'booking' && !asking && (
                          <Button
                            variant="danger"
                            disabled={pending}
                            aria-label={`Cancel booking with ${i.teacherName}`}
                            onClick={() => setCancelId(i.id)}
                          >
                            Cancel
                          </Button>
                        )}
                        {i.cancellable && i.source === 'request' && (
                          <Button
                            disabled={pending}
                            loading={isPending(i.id)}
                            aria-label={`Cancel request to ${i.teacherName}`}
                            onClick={() => run(i.id, () => cancelRequest(i.id), 'Request cancelled.')}
                          >
                            Cancel request
                          </Button>
                        )}
                        <LinkButton to={`/student/teachers/${i.teacherId}?day=${i.date}`}>Book another time with {i.teacherName}</LinkButton>
                      </div>
                    )}

                    {asking && (
                      <ConfirmBar message={`Cancel this booking? ${i.teacherName} will be told, and your spot opens up for other students.`}>
                        <Button
                          variant="dangerfill"
                          autoFocus
                          loading={isPending(i.id)}
                          onClick={async () => {
                            const done = await run(
                              i.id,
                              async () => {
                                await cancelBooking(i.id)
                                return true
                              },
                              'Booking cancelled.',
                            )
                            if (done) setCancelId('')
                          }}
                        >
                          Yes, cancel
                        </Button>
                        <Button disabled={isPending(i.id)} onClick={() => setCancelId('')}>
                          Keep it
                        </Button>
                      </ConfirmBar>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </aside>
      </div>
    </>
  )
}
