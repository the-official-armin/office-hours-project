// Owner: Subgroup B (Teacher desktop UI). Purpose: overview of upcoming office hours and open requests.
// Every number is computed from the data store; nothing here is hard-coded.
import { Link } from 'react-router-dom'
import { LinkButton } from '../../components/teacher/Button'
import RequestCard from '../../components/teacher/RequestCard'
import { Card, DateBadge, EmptyState, FeedbackMessage, Notice, SeatDots } from '../../components/teacher/ui'
import { useTeacherData } from '../../hooks/TeacherDataProvider'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import {
  addDays,
  combine,
  formatDateLong,
  formatDateShort,
  formatTime,
  formatTimeRange,
  parseISODate,
  shortWeekday,
  startOfWeek,
  toISODate,
} from '../../lib/dates'

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function TeacherDashboard() {
  const { data, now, today, acceptRequest, declineRequest } = useTeacherData()
  const { run, feedback, pending, isPending } = useAsyncAction()

  const dayOffDates = new Set(data.daysOff.map((d) => d.date))
  const bookable = data.slots.filter((s) => !dayOffDates.has(s.date))

  const monday = startOfWeek(parseISODate(today))
  const weekFrom = toISODate(monday)
  const weekTo = toISODate(addDays(monday, 4))
  const weekSlots = bookable.filter((s) => s.date >= weekFrom && s.date <= weekTo)
  const seatsBooked = weekSlots.reduce((sum, s) => sum + s.booked, 0)
  const seatsTotal = weekSlots.reduce((sum, s) => sum + s.maxStudents, 0)

  const upcoming = bookable.filter((s) => combine(s.date, s.start) > now)
  const next = upcoming[0]
  const openRequests = data.requests

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            {greeting(now.getHours())}, {data.profile.name}
          </h1>
          <p className="mt-1 text-muted">{formatDateLong(today)}</p>
        </div>
        <div className="flex gap-3">
          <LinkButton to="/teacher/days-off">Mark a day off</LinkButton>
          <LinkButton to="/teacher/office-hours" variant="primary">
            Edit office hours
          </LinkButton>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <Card className="p-5">
          <p className="text-sm text-muted">Seats booked this week</p>
          <p className="mt-1 text-4xl font-extrabold">
            {seatsBooked} <span className="text-lg font-semibold text-muted">of {seatsTotal}</span>
          </p>
          <p className="mt-1 text-sm text-muted">
            Across {weekSlots.length} office hour{weekSlots.length === 1 ? '' : 's'}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Next office hour</p>
          {next ? (
            <>
              <p className="mt-1 text-4xl font-extrabold">
                {shortWeekday(next.date)[0] + shortWeekday(next.date).slice(1).toLowerCase()} {formatTime(next.start).replace(' ', '')}
              </p>
              <p className="mt-1 text-sm text-muted">
                {formatDateShort(next.date)} &middot; {next.booked} of {next.maxStudents} seats booked
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">No upcoming office hours. Check your schedule on the Office hours page.</p>
          )}
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Open requests</p>
          <p className="mt-1 text-4xl font-extrabold">{openRequests.length}</p>
          <p className="mt-1 text-sm text-muted">
            {openRequests.length === 0 ? 'Nothing waiting for you' : 'Students asked for a different time'}
          </p>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-[1.35fr_1fr] items-start gap-5">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold">Upcoming office hours</h2>
            <Link to="/teacher/calendar" className="text-sm font-bold text-brand hover:underline">
              Open calendar
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <EmptyState>No upcoming office hours in the next six weeks.</EmptyState>
          ) : (
            <ul>
              {upcoming.slice(0, 4).map((s) => (
                <li key={s.id} className="flex items-center gap-4 border-t border-line py-3 first:border-t-0">
                  <DateBadge date={s.date} />
                  <div className="flex-1">
                    <p className="font-bold">{s.name}</p>
                    <p className="text-sm text-muted">{formatTimeRange(s.start, s.end)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <SeatDots booked={s.booked} max={s.maxStudents} />
                    <span className="text-sm text-muted">
                      {s.booked} of {s.maxStudents} seats
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold">Open requests</h2>
            {openRequests.length > 0 && (
              <Link to="/teacher/requests" className="text-sm font-bold text-brand hover:underline">
                See all {openRequests.length}
              </Link>
            )}
          </div>
          {openRequests.length === 0 ? (
            <EmptyState>No open requests. When a student asks for a time outside your office hours it appears here.</EmptyState>
          ) : (
            <ul>
              {openRequests.slice(0, 2).map((r) => (
                <li key={r.id} className="border-t border-line py-3 first:border-t-0">
                  <RequestCard
                    request={r}
                    disabled={pending}
                    busy={isPending(`accept:${r.id}`) ? 'accept' : isPending(`decline:${r.id}`) ? 'decline' : null}
                    onAccept={() => run(`accept:${r.id}`, () => acceptRequest(r.id), `Accepted ${r.studentName}.`)}
                    onDecline={() => run(`decline:${r.id}`, () => declineRequest(r.id), `Declined ${r.studentName}.`)}
                  />
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3">
            <FeedbackMessage feedback={feedback} />
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <Notice>
          Students can&apos;t book past dates or your days off, and each office hour closes when its seats are full.
        </Notice>
      </div>
    </div>
  )
}
