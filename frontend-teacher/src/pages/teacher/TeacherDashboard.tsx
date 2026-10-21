// Owner: Subgroup B (Teacher desktop UI). Purpose: next office hour, what comes after, open requests and coming days off.
// Every number is computed from the data; nothing is hard-coded.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import Banner from '../../components/common/Banner'
import { LinkButton, TextButton } from '../../components/common/Button'
import Card, { CardHead, CardTitle, Empty, Eyebrow, Row } from '../../components/common/Card'
import Chip from '../../components/common/Chip'
import { ErrorText } from '../../components/common/fields'
import Icon from '../../components/common/Icon'
import PageHeader from '../../components/common/PageHeader'
import { DateBlock, SeatsEnd } from '../../components/common/SeatDots'
import { RequestsModal, UpcomingModal } from '../../components/teacher/DashboardModals'
import RequestMini from '../../components/teacher/RequestMini'
import { teacherWorld, useTeacherData } from '../../hooks/TeacherData'
import { useAction } from '../../hooks/useAction'
import {
  DOW_LONG,
  DOW_SHORT,
  dowOf,
  formatDateLong,
  formatRange,
  formatTimeShort,
  initials,
  plural,
  toISODate,
} from '../../lib/dates'
import { affectedOn, listSlots, pendingRequests } from '../../lib/rules'

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function ViewAll({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <TextButton onClick={onClick} className="inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap">
      {label}
      <Icon name="expand" size={16} strokeWidth={2} />
    </TextButton>
  )
}

export default function TeacherDashboard() {
  const { data, now, answerRequest } = useTeacherData()
  const { run, error, pending, isPending } = useAction()
  const [modal, setModal] = useState<'upcoming' | 'requests' | null>(null)

  const t = data.teacher
  const world = teacherWorld(data)
  const today = toISODate(now)
  const all = listSlots(world, t, today, 60, now)
  const next = all[0]
  const after = all.slice(1, 5)
  const pend = pendingRequests(data.requests, t.id)
  const offs = t.daysOff.filter((d) => d.date >= today).slice(0, 2)

  return (
    <>
      <PageHeader
        title={`${greeting(now.getHours())}, ${data.settings.name}`}
        subtitle={formatDateLong(today)}
        actions={
          <div className="flex flex-wrap gap-3">
            <LinkButton to="/teacher/days-off">Mark a day off</LinkButton>
            <LinkButton to="/teacher/office-hours" variant="primary">
              Edit office hours
            </LinkButton>
          </div>
        }
      />

      <div className="flex flex-wrap items-start gap-6 [&>*]:min-w-0">
        <div className="flex flex-[3_1_460px] flex-col gap-6">
          {next ? (
            <Card aria-labelledby="next-h">
              <div className="flex items-center justify-between gap-3">
                <Eyebrow id="next-h">Next office hour</Eyebrow>
                <Link to={`/teacher/calendar?day=${next.date}`} className="text-sm font-bold text-link">
                  Open in calendar
                </Link>
              </div>
              <div className="flex flex-wrap items-end justify-between gap-4 pt-2.5">
                <div>
                  <div className="text-4xl font-extrabold leading-[1.1] tracking-[-.02em] tabular-nums max-[640px]:text-[28px]">
                    {DOW_SHORT[dowOf(next.date)]} {formatTimeShort(next.row.timing.start)}
                  </div>
                  <div className="mt-1 text-muted">
                    {formatDateLong(next.date)} &middot; {next.row.timing.name} &middot;{' '}
                    {formatRange(next.row.timing.start, next.row.timing.end)}
                  </div>
                </div>
                <SeatsEnd taken={next.row.taken} max={t.max} />
              </div>
              <div className="mt-[18px] flex flex-wrap gap-2 border-t border-line pt-4">
                {next.row.bookings.length === 0 ? (
                  <span className="text-[13px] text-muted">No one has booked yet.</span>
                ) : (
                  next.row.bookings.map((b) => (
                    <span
                      key={b.id}
                      title={b.reason}
                      className="inline-flex items-center gap-2 rounded-full bg-soft py-1 pl-1 pr-3 text-[13px] font-bold"
                    >
                      <span
                        aria-hidden="true"
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-tint text-[11px] font-extrabold text-tint-ink"
                      >
                        {initials(b.studentName)}
                      </span>
                      {b.studentName}
                      <small className="text-xs font-semibold text-muted">Seat {b.seat}</small>
                    </span>
                  ))
                )}
              </div>
            </Card>
          ) : (
            <Card>
              <Eyebrow>Next office hour</Eyebrow>
              <p className="mt-2 text-muted">No upcoming office hours. Add a timing in Office hours.</p>
            </Card>
          )}

          <Card aria-labelledby="upcoming-h">
            <CardHead>
              <CardTitle id="upcoming-h">After that</CardTitle>
              <ViewAll label={`View all ${all.length}`} onClick={() => setModal('upcoming')} />
            </CardHead>
            {after.length === 0 ? (
              <Empty>Nothing else on the calendar yet.</Empty>
            ) : (
              after.map((o) => (
                <Row key={`${o.date}-${o.row.timing.id}`}>
                  <DateBlock date={o.date} />
                  <div className="min-w-0 flex-[1_1_180px]">
                    <div className="text-[15px] font-bold">{o.row.timing.name}</div>
                    <div className="mt-0.5 text-[13px] text-muted">{formatRange(o.row.timing.start, o.row.timing.end)}</div>
                  </div>
                  <SeatsEnd taken={o.row.taken} max={t.max} />
                </Row>
              ))
            )}
          </Card>
        </div>

        <div className="flex flex-[2_1_340px] flex-col gap-6">
          <Card aria-labelledby="req-h">
            <CardHead>
              <CardTitle id="req-h">
                Open requests
                {pend.length > 0 && (
                  <span className="ml-1.5 inline-flex h-[22px] min-w-6 items-center justify-center rounded-full bg-badge px-[7px] align-[2px] text-xs font-extrabold text-badge-ink">
                    {pend.length}
                  </span>
                )}
              </CardTitle>
              <ViewAll label="View all" onClick={() => setModal('requests')} />
            </CardHead>
            <ErrorText>{error}</ErrorText>
            {pend.length === 0 ? (
              <Empty>No open requests. You&rsquo;re all caught up.</Empty>
            ) : (
              pend.slice(0, 2).map((r) => (
                <RequestMini
                  key={r.id}
                  request={r}
                  disabled={pending}
                  busy={isPending(`accepted:${r.id}`) ? 'accepted' : isPending(`declined:${r.id}`) ? 'declined' : null}
                  onAnswer={(answer) =>
                    run(`${answer}:${r.id}`, () => answerRequest(r.id, answer), answer === 'accepted' ? 'Request accepted.' : 'Request declined.')
                  }
                />
              ))
            )}
          </Card>

          <Card aria-labelledby="off-h">
            <CardHead>
              <CardTitle id="off-h">Coming days off</CardTitle>
              <Link to="/teacher/days-off" className="text-sm font-bold text-link">
                Manage
              </Link>
            </CardHead>
            {offs.length === 0 ? (
              <Empty>No days off coming up.</Empty>
            ) : (
              offs.map((d) => {
                const n = affectedOn(world, t.id, d.date, now).length
                return (
                  <Row key={d.date}>
                    <DateBlock date={d.date} kind="amber" />
                    <div className="min-w-0 flex-[1_1_120px]">
                      <div className="text-[15px] font-bold">{DOW_LONG[dowOf(d.date)]}</div>
                      <div className="mt-0.5 text-[13px] text-muted">{d.reason}</div>
                    </div>
                    {n > 0 && <Chip kind="amber">{plural(n, 'booking')} affected</Chip>}
                  </Row>
                )
              })
            )}
          </Card>
        </div>
      </div>

      <Banner>Students can&rsquo;t book past dates or your days off, and each office hour closes when its seats are full.</Banner>

      {modal === 'upcoming' && <UpcomingModal onClose={() => setModal(null)} />}
      {modal === 'requests' && <RequestsModal onClose={() => setModal(null)} />}
    </>
  )
}
