// Owner: Subgroup B (Teacher desktop UI). Purpose: requests for a different time (accept / decline) and the seats students
// booked, each with the student's reason. A table on desktop, stacked cards on phones.
import { useSearchParams } from 'react-router-dom'
import Button, { Pill } from '../../components/common/Button'
import Card, { Empty } from '../../components/common/Card'
import Chip from '../../components/common/Chip'
import { ErrorText } from '../../components/common/fields'
import PageHeader from '../../components/common/PageHeader'
import { teacherWorld, useTeacherData } from '../../hooks/TeacherData'
import { useAction } from '../../hooks/useAction'
import { formatDateShort, formatTime, initials } from '../../lib/dates'
import { DISRUPT_TEXT, disruption, pendingRequests, timingOf, upcomingBookings } from '../../lib/rules'

type Tab = 'requests' | 'bookings'

const ROW =
  'grid items-center gap-4 border-t border-line px-3 py-4 min-[900px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,2.4fr)_minmax(0,1.6fr)] max-[899px]:mt-2 max-[899px]:grid-cols-1 max-[899px]:gap-2 max-[899px]:rounded-xl max-[899px]:border max-[899px]:p-3.5 max-[899px]:first-of-type:mt-0'

function Person({ name }: { name: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 font-bold">
      <span aria-hidden="true" className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-tint text-[13px] font-extrabold text-tint-ink">
        {initials(name)}
      </span>
      <span>{name}</span>
    </div>
  )
}

export default function BookingRequests() {
  const { data, now, answerRequest } = useTeacherData()
  const { run, error, pending, isPending } = useAction()
  // The tab lives in the URL so the sidebar can link straight to ?tab=bookings.
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'bookings' ? 'bookings' : 'requests'

  const world = teacherWorld(data)
  const pend = pendingRequests(data.requests, data.teacher.id)
  const handled = data.requests
    .filter((r) => r.teacherId === data.teacher.id && r.status !== 'pending')
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
  const ups = upcomingBookings(world, (b) => b.teacherId === data.teacher.id, now)

  return (
    <>
      <PageHeader title="Booking requests" subtitle="Seats students booked, and requests for a time outside your office hours." />

      <Card aria-label="Bookings and requests" className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Show">
          <Pill pressed={tab === 'requests'} onClick={() => setParams({ tab: 'requests' })}>
            Requests ({pend.length})
          </Pill>
          <Pill pressed={tab === 'bookings'} onClick={() => setParams({ tab: 'bookings' })}>
            Bookings ({ups.length})
          </Pill>
        </div>
        <ErrorText>{error}</ErrorText>

        <div>
          <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,2.4fr)_minmax(0,1.6fr)] gap-4 px-3 py-2 text-xs font-bold uppercase tracking-[.05em] text-muted max-[899px]:hidden">
            <span>Student</span>
            <span>When</span>
            <span>Reason</span>
            <span>Status</span>
          </div>

          {tab === 'requests' &&
            (pend.length + handled.length === 0 ? (
              <Empty>No requests right now.</Empty>
            ) : (
              [...pend, ...handled].map((r) => (
                <div key={r.id} className={ROW}>
                  <Person name={r.studentName} />
                  <div>
                    <div className="font-semibold">{formatDateShort(r.date)}</div>
                    <div className="mt-0.5 text-[13px] text-muted">{formatTime(r.time)}</div>
                  </div>
                  <p className="leading-normal text-ink2">{r.reason}</p>
                  <div className="flex flex-wrap gap-2">
                    {r.status === 'pending' ? (
                      <>
                        <Button
                          variant="primary"
                          className="!px-4"
                          disabled={pending}
                          loading={isPending(`accepted:${r.id}`)}
                          aria-label={`Accept ${r.studentName}`}
                          onClick={() => run(`accepted:${r.id}`, () => answerRequest(r.id, 'accepted'), 'Request accepted.')}
                        >
                          Accept
                        </Button>
                        <Button
                          className="!px-4"
                          disabled={pending}
                          loading={isPending(`declined:${r.id}`)}
                          aria-label={`Decline ${r.studentName}`}
                          onClick={() => run(`declined:${r.id}`, () => answerRequest(r.id, 'declined'), 'Request declined.')}
                        >
                          Decline
                        </Button>
                      </>
                    ) : r.status === 'accepted' ? (
                      <Chip>Accepted</Chip>
                    ) : (
                      <Chip kind="past">Declined</Chip>
                    )}
                  </div>
                </div>
              ))
            ))}

          {tab === 'bookings' &&
            (ups.length === 0 ? (
              <Empty>No upcoming bookings yet.</Empty>
            ) : (
              ups.map((b) => {
                const x = timingOf(world, b)
                const dis = disruption(world, b)
                return (
                  <div key={b.id} className={ROW}>
                    <Person name={b.studentName} />
                    <div>
                      <div className="font-semibold">{formatDateShort(b.date)}</div>
                      <div className="mt-0.5 text-[13px] text-muted">
                        {x?.name} &middot; {x ? formatTime(x.start) : ''}
                      </div>
                    </div>
                    <p className="leading-normal text-ink2">{b.reason}</p>
                    <div className="flex flex-wrap gap-2">
                      <Chip>Seat {b.seat}</Chip>
                      {dis ? <Chip kind="amber">{DISRUPT_TEXT[dis]}</Chip> : <Chip>Confirmed</Chip>}
                    </div>
                  </div>
                )
              })
            ))}
        </div>
      </Card>
    </>
  )
}
