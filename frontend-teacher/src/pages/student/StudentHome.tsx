// Owner: Subgroup B (Teacher desktop UI). Purpose: the student's home: bookings at a glance, open seats this week,
// and the requests waiting for an answer.
import { Link, useNavigate } from 'react-router-dom'
import Banner from '../../components/common/Banner'
import Button, { LinkButton } from '../../components/common/Button'
import Card, { CardHead, CardTitle, Empty, Row } from '../../components/common/Card'
import Chip from '../../components/common/Chip'
import { ErrorText } from '../../components/common/fields'
import PageHeader from '../../components/common/PageHeader'
import { DateBlock, SeatDots } from '../../components/common/SeatDots'
import { myWorld, seatWorld, useStudentData } from '../../hooks/StudentData'
import { useAction } from '../../hooks/useAction'
import { DOW_SHORT, dowOf, formatDateLong, formatDateShort, formatMonthDay, formatRange, formatTime, formatTimeShort, plural, toISODate } from '../../lib/dates'
import { conflictingBooking, disruption, DISRUPT_TEXT, findTeacher, listSlots, timingOf, upcomingBookings, type Opening } from '../../lib/rules'

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card tight>
      <div className="text-[13px] font-semibold text-muted">{label}</div>
      <div className="mt-2 text-[32px] font-extrabold leading-[1.15] tracking-[-.02em] tabular-nums max-[899px]:mt-1.5 max-[899px]:text-2xl">{value}</div>
      <div className="mt-1 text-[13px] text-muted">{sub}</div>
    </Card>
  )
}

export default function StudentHome() {
  const { data, now, cancelRequest } = useStudentData()
  const { run, error, pending, isPending } = useAction()
  const navigate = useNavigate()

  const me = data.settings
  const mine = myWorld(data)
  const seats = seatWorld(data)
  const today = toISODate(now)
  const first = me.name.split(' ')[0]

  const up = upcomingBookings(mine, () => true, now)
  const next = up[0]
  const nextTeacher = next ? findTeacher(mine, next.teacherId) : undefined
  const nextTiming = next ? timingOf(mine, next) : undefined
  const pend = data.requests.filter((r) => r.status === 'pending')
  const teacherCount = new Set(up.map((b) => b.teacherId)).size

  const open: Opening[] = data.teachers
    .flatMap((t) => listSlots(seats, t, today, 7, now))
    .filter(
      (o) =>
        o.row.left > 0 &&
        !o.row.bookings.some((b) => b.studentId === me.id) &&
        !conflictingBooking(seats, me.id, o.date, o.row.timing, o.teacher.id),
    )
    .sort((a, b) => (a.date + a.row.timing.start).localeCompare(b.date + b.row.timing.start))

  return (
    <>
      <PageHeader
        title={`${greeting(now.getHours())}, ${first}`}
        subtitle={formatDateLong(today)}
        actions={
          <LinkButton to="/student/teachers" variant="primary">
            Find a teacher
          </LinkButton>
        }
      />

      <section
        aria-label="Your week at a glance"
        className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4 max-[899px]:grid-cols-2 max-[899px]:gap-3 max-[899px]:[&>:last-child:nth-child(odd)]:col-span-full"
      >
        <Stat
          label="Upcoming bookings"
          value={String(up.length)}
          sub={up.length ? `With ${plural(teacherCount, 'different teacher')}` : 'Nothing booked yet'}
        />
        <Stat
          label="Next office hour"
          value={next && nextTiming ? `${DOW_SHORT[dowOf(next.date)]} ${formatTimeShort(nextTiming.start)}` : 'None yet'}
          sub={next && nextTeacher ? `${formatMonthDay(next.date)} · ${nextTeacher.name} · Seat ${next.seat}` : 'Find a teacher to book a seat'}
        />
        <Stat
          label="Open requests"
          value={String(pend.length)}
          sub={pend.length ? `Waiting for ${findTeacher(mine, pend[0].teacherId)?.name ?? 'a teacher'}` : 'Nothing waiting'}
        />
      </section>

      <div className="flex flex-wrap items-start gap-6 [&>*]:min-w-0">
        <Card aria-labelledby="up-h" className="flex-[3_1_460px]">
          <CardHead>
            <CardTitle id="up-h">Upcoming bookings</CardTitle>
            <Link to="/student/bookings" className="text-sm font-bold text-link">
              See all
            </Link>
          </CardHead>
          {up.length === 0 ? (
            <Empty>No upcoming bookings. Pick a teacher and a seat to get started.</Empty>
          ) : (
            up.slice(0, 3).map((b) => {
              const t = findTeacher(mine, b.teacherId)
              const x = timingOf(mine, b)
              const dis = disruption(mine, b)
              return (
                <Row key={b.id}>
                  <DateBlock date={b.date} />
                  <div className="min-w-0 flex-[1_1_180px]">
                    <div className="text-[15px] font-bold">
                      {t?.name} &middot; {t?.subject}
                    </div>
                    <div className="mt-0.5 text-[13px] text-muted">
                      {x?.name} &middot; {x ? formatRange(x.start, x.end) : ''}
                    </div>
                    <div className="mt-1 text-[13px] text-ink2">{b.reason}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 max-[640px]:items-start">
                    <Chip>Seat {b.seat}</Chip>
                    {dis && <Chip kind="amber">{DISRUPT_TEXT[dis]}</Chip>}
                  </div>
                </Row>
              )
            })
          )}
        </Card>

        <div className="flex flex-[2_1_340px] flex-col gap-6">
          <Card aria-labelledby="open-h">
            <CardHead>
              <CardTitle id="open-h">Open seats this week</CardTitle>
              <Link to="/student/teachers" className="text-sm font-bold text-link">
                All teachers
              </Link>
            </CardHead>
            {open.length === 0 ? (
              <Empty>No open seats in the next 7 days.</Empty>
            ) : (
              open.slice(0, 3).map((o) => (
                <div key={`${o.teacher.id}-${o.date}-${o.row.timing.id}`} className="flex items-center gap-3 border-t border-line py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-bold">
                      {o.teacher.name} &middot; {o.teacher.subject}
                    </div>
                    <div className="mt-0.5 text-[13px] text-muted">
                      {formatDateShort(o.date)} &middot; {o.row.timing.name} {formatTime(o.row.timing.start)}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[13px] font-semibold text-muted">
                      <SeatDots taken={o.row.taken} max={o.teacher.max} />
                      <span>{plural(o.row.left, 'seat')} left</span>
                    </div>
                  </div>
                  <Button
                    aria-label={`Book ${o.teacher.name} on ${formatDateShort(o.date)}`}
                    onClick={() => navigate(`/student/teachers/${o.teacher.id}?day=${o.date}`)}
                  >
                    Book
                  </Button>
                </div>
              ))
            )}
          </Card>

          <Card aria-labelledby="rq-h" className="flex flex-col gap-3">
            <CardTitle id="rq-h">{pend.length > 1 ? 'Your requests' : 'Your request'}</CardTitle>
            <ErrorText>{error}</ErrorText>
            {pend.length === 0 ? (
              <p className="text-muted">No open requests. You can ask a teacher for a different time from the booking page.</p>
            ) : (
              pend.map((r) => (
                <div key={r.id} className="flex flex-col gap-2.5 border-t border-line pt-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <b className="text-[15px]">{findTeacher(mine, r.teacherId)?.name}</b>
                    <span className="text-[13px] text-muted">
                      {formatDateShort(r.date)} &middot; {formatTime(r.time)}
                    </span>
                  </div>
                  <p className="leading-normal text-ink2">{r.reason}</p>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Chip kind="amber">Pending</Chip>
                    <Button
                      disabled={pending}
                      loading={isPending(r.id)}
                      onClick={() => run(r.id, () => cancelRequest(r.id), 'Request cancelled.')}
                    >
                      Cancel request
                    </Button>
                  </div>
                </div>
              ))
            )}
          </Card>
        </div>
      </div>

      <Banner>You can&rsquo;t book a time that has passed or a day your teacher is out, and an office hour closes when its seats are full.</Banner>
    </>
  )
}
