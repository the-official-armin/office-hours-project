// Owner: Subgroup B (Teacher desktop UI). Purpose: requests (accept/decline) and upcoming bookings with each reason summary.
import { useSearchParams } from 'react-router-dom'
import Button from '../../components/teacher/Button'
import { Avatar, Badge, Card, EmptyState, FeedbackMessage, PageHeader } from '../../components/teacher/ui'
import { useTeacherData } from '../../hooks/TeacherDataProvider'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import { combine, formatDateShort, formatTime, formatTimeRange, initials } from '../../lib/dates'

type Tab = 'requests' | 'bookings'

export default function BookingRequests() {
  const { data, now, acceptRequest, declineRequest } = useTeacherData()
  const { run, feedback, pending, isPending } = useAsyncAction()
  // The tab lives in the URL so the sidebar can link to ?tab=bookings.
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'bookings' ? 'bookings' : 'requests'
  const setTab = (next: Tab) => setParams({ tab: next })

  const requests = data.requests
  const bookings = data.bookings.filter((b) => combine(b.date, b.start) > now)

  const tabClass = (active: boolean) =>
    `rounded-lg border px-4 py-2 text-sm font-bold ${
      active ? 'border-brand bg-brand text-on-brand' : 'border-line bg-surface hover:bg-canvas'
    }`

  return (
    <div>
      <PageHeader
        title="Booking requests"
        subtitle="Seats students booked, and requests for a time outside your office hours."
      />
      <Card>
        <div role="tablist" aria-label="Requests and bookings" className="mb-4 flex gap-2">
          <button
            role="tab"
            type="button"
            id="tab-requests"
            aria-selected={tab === 'requests'}
            aria-controls="panel-requests"
            className={tabClass(tab === 'requests')}
            onClick={() => setTab('requests')}
          >
            Requests ({requests.length})
          </button>
          <button
            role="tab"
            type="button"
            id="tab-bookings"
            aria-selected={tab === 'bookings'}
            aria-controls="panel-bookings"
            className={tabClass(tab === 'bookings')}
            onClick={() => setTab('bookings')}
          >
            Bookings ({bookings.length})
          </button>
        </div>

        <div className="mb-3">
          <FeedbackMessage feedback={feedback} />
        </div>

        {tab === 'requests' ? (
          <div role="tabpanel" id="panel-requests" aria-labelledby="tab-requests">
            {requests.length === 0 ? (
              <EmptyState>No open requests. Students can ask for a time outside your office hours and it will show up here.</EmptyState>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-muted">
                    <th className="px-3 py-2 font-bold">Student</th>
                    <th className="px-3 py-2 font-bold">When</th>
                    <th className="px-3 py-2 font-bold">Reason</th>
                    <th className="px-3 py-2 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id} className="border-t border-line align-middle">
                      <td className="px-3 py-3">
                        <span className="flex items-center gap-3 font-bold">
                          <Avatar text={initials(r.studentName)} />
                          {r.studentName}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-bold">{formatDateShort(r.date)}</p>
                        <p className="text-muted">{formatTime(r.start)}</p>
                      </td>
                      <td className="max-w-md px-3 py-3 text-muted">{r.reason}</td>
                      <td className="px-3 py-3">
                        <div className="flex gap-2">
                          <Button
                            disabled={pending}
                            loading={isPending(`accept:${r.id}`)}
                            aria-label={`Accept ${r.studentName}`}
                            onClick={() => run(`accept:${r.id}`, () => acceptRequest(r.id), `Accepted ${r.studentName}. It is now a booking.`)}
                          >
                            Accept
                          </Button>
                          <Button
                            variant="secondary"
                            disabled={pending}
                            loading={isPending(`decline:${r.id}`)}
                            aria-label={`Decline ${r.studentName}`}
                            onClick={() => run(`decline:${r.id}`, () => declineRequest(r.id), `Declined ${r.studentName}.`)}
                          >
                            Decline
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div role="tabpanel" id="panel-bookings" aria-labelledby="tab-bookings">
            {bookings.length === 0 ? (
              <EmptyState>No upcoming bookings yet. Seats students book will be listed here.</EmptyState>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-muted">
                    <th className="px-3 py-2 font-bold">Student</th>
                    <th className="px-3 py-2 font-bold">When</th>
                    <th className="px-3 py-2 font-bold">Office hour</th>
                    <th className="px-3 py-2 font-bold">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id} className="border-t border-line align-middle">
                      <td className="px-3 py-3">
                        <span className="flex items-center gap-3 font-bold">
                          <Avatar text={initials(b.studentName)} />
                          {b.studentName}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-bold">{formatDateShort(b.date)}</p>
                        <p className="text-muted">{formatTimeRange(b.start, b.end)}</p>
                      </td>
                      <td className="px-3 py-3">{b.timingName ? <Badge>{b.timingName}</Badge> : <Badge tone="warn">Accepted request</Badge>}</td>
                      <td className="max-w-md px-3 py-3 text-muted">{b.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
