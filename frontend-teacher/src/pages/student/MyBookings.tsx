// Owner: Subgroup B (Teacher desktop UI). Purpose: the student's seats (upcoming and past) and their requests for a
// different time. Cancelling asks first. Bookings the teacher disrupted are flagged, never removed.
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Button, { Pill } from '../../components/common/Button'
import Card, { Empty, Row } from '../../components/common/Card'
import { ConfirmBar } from '../../components/common/Banner'
import Chip from '../../components/common/Chip'
import { ErrorText } from '../../components/common/fields'
import PageHeader from '../../components/common/PageHeader'
import { DateBlock } from '../../components/common/SeatDots'
import { myWorld, useStudentData } from '../../hooks/StudentData'
import { useAction } from '../../hooks/useAction'
import { formatDateShort, formatRange, formatTime } from '../../lib/dates'
import { DISRUPT_TEXT, disruption, findTeacher, pastBookings, timingOf, upcomingBookings } from '../../lib/rules'
import type { Booking } from '../../types'

type Tab = 'up' | 'past' | 'req'

export default function MyBookings() {
  const { data, now, cancelBooking, cancelRequest } = useStudentData()
  const { run, error, pending, isPending } = useAction()
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  const tab: Tab = raw === 'past' || raw === 'req' ? raw : 'up'

  const [cancelId, setCancelId] = useState('')
  const [message, setMessage] = useState('')
  const yesRef = useRef<HTMLButtonElement>(null)
  const askedFrom = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (cancelId) yesRef.current?.focus()
  }, [cancelId])

  const world = myWorld(data)
  const up = upcomingBookings(world, () => true, now)
  const past = pastBookings(world, () => true, now)
  const mine = [...data.requests].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
  const open = mine.filter((r) => r.status === 'pending').length

  const go = (next: Tab) => {
    setCancelId('')
    setMessage('')
    setParams({ tab: next })
  }

  const line = (b: Booking) => {
    const t = findTeacher(world, b.teacherId)
    const x = timingOf(world, b)
    return (
      <div className="min-w-0 flex-[1_1_180px]">
        <div className="text-[15px] font-bold">
          {t?.name} &middot; {t?.subject}
        </div>
        <div className="mt-0.5 text-[13px] text-muted">
          {x?.name} &middot; {x ? formatRange(x.start, x.end) : ''}
        </div>
        <div className="mt-1 text-[13px] text-ink2">{b.reason}</div>
      </div>
    )
  }

  const cancelBookingNow = async (b: Booking) => {
    const t = findTeacher(world, b.teacherId)
    const done = await run(b.id, async () => {
      await cancelBooking(b.id)
      return true
    })
    if (done) {
      setCancelId('')
      setMessage(`Booking cancelled. ${t?.name ?? 'Your teacher'} was told and the seat is open again.`)
    }
  }

  return (
    <>
      <PageHeader title="My bookings" subtitle="Your seats, and the requests you sent for other times." />

      <Card aria-label="Bookings" className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2 pb-2" role="group" aria-label="Show">
          <Pill pressed={tab === 'up'} onClick={() => go('up')}>
            Upcoming ({up.length})
          </Pill>
          <Pill pressed={tab === 'past'} onClick={() => go('past')}>
            Past ({past.length})
          </Pill>
          <Pill pressed={tab === 'req'} onClick={() => go('req')}>
            Requests ({open} open)
          </Pill>
        </div>
        <ErrorText>{error}</ErrorText>
        <div role="status" className={message && tab === 'up' ? 'mb-2 rounded-xl bg-tint px-4 py-3 text-sm font-semibold text-tint-ink' : ''}>
          {tab === 'up' ? message : ''}
        </div>

        {tab === 'up' &&
          (up.length === 0 ? (
            <Empty>
              No upcoming bookings.{' '}
              <Link to="/student/teachers" className="font-bold text-link">
                Find a teacher
              </Link>{' '}
              to book your next office hour.
            </Empty>
          ) : (
            up.map((b) => {
              const dis = disruption(world, b)
              const asking = cancelId === b.id
              const t = findTeacher(world, b.teacherId)
              return (
                <Row key={b.id} top>
                  <DateBlock date={b.date} />
                  {line(b)}
                  <div className="flex flex-col items-start gap-1.5">
                    <Chip>Seat {b.seat}</Chip>
                    {dis && <Chip kind="amber">{DISRUPT_TEXT[dis]}</Chip>}
                  </div>
                  {!asking && (
                    <Button
                      variant="danger"
                      aria-label={`Cancel booking with ${t?.name} on ${formatDateShort(b.date)}`}
                      onClick={(e) => {
                        askedFrom.current = e.currentTarget
                        setMessage('')
                        setCancelId(b.id)
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                  {asking && (
                    <div className="basis-full">
                      <ConfirmBar message={`Cancel this booking? ${t?.name} will be told, and your seat opens up for other students.`}>
                        <Button ref={yesRef} variant="dangerfill" loading={isPending(b.id)} onClick={() => void cancelBookingNow(b)}>
                          Yes, cancel
                        </Button>
                        <Button
                          disabled={isPending(b.id)}
                          onClick={() => {
                            setCancelId('')
                            askedFrom.current?.focus()
                          }}
                        >
                          Keep it
                        </Button>
                      </ConfirmBar>
                    </div>
                  )}
                </Row>
              )
            })
          ))}

        {tab === 'past' &&
          (past.length === 0 ? (
            <Empty>Nothing here yet.</Empty>
          ) : (
            past.map((b) => (
              <Row key={b.id} top>
                <DateBlock date={b.date} kind="past" />
                {line(b)}
                {b.status === 'cancelled' ? <Chip kind="past">Cancelled</Chip> : <Chip>Attended</Chip>}
              </Row>
            ))
          ))}

        {tab === 'req' &&
          (mine.length === 0 ? (
            <Empty>You haven&rsquo;t sent any requests. To ask for a time outside office hours, open a teacher and choose &ldquo;Need a different time?&rdquo;.</Empty>
          ) : (
            mine.map((r) => (
              <Row key={r.id} top>
                <div className="min-w-0 flex-[1_1_300px]">
                  <div className="flex justify-between gap-3">
                    <b className="text-[15px]">{findTeacher(world, r.teacherId)?.name}</b>
                    <span className="text-[13px] text-muted">
                      {formatDateShort(r.date)} &middot; {formatTime(r.time)}
                    </span>
                  </div>
                  <div className="mt-1 text-[13px] text-ink2">{r.reason}</div>
                  {r.note && <div className="mt-1 text-[13px] text-muted">{r.note}</div>}
                </div>
                {r.status === 'pending' ? <Chip kind="amber">Pending</Chip> : r.status === 'accepted' ? <Chip>Accepted</Chip> : <Chip kind="past">Declined</Chip>}
                {r.status === 'pending' && (
                  <Button
                    disabled={pending}
                    loading={isPending(r.id)}
                    onClick={() => run(r.id, () => cancelRequest(r.id), 'Request cancelled.')}
                  >
                    Cancel request
                  </Button>
                )}
              </Row>
            ))
          ))}
      </Card>
    </>
  )
}
