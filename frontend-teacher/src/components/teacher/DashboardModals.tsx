// Owner: Subgroup B (Teacher desktop UI). The two Dashboard pop-ups: upcoming office hours (next 8 weeks) and open requests.
import { useNavigate } from 'react-router-dom'
import { useAction } from '../../hooks/useAction'
import { useTeacherData, teacherWorld } from '../../hooks/TeacherData'
import { addDays, formatDateShort, formatMonthDay, formatRange, formatTime, parseISODate, plural, toISODate } from '../../lib/dates'
import { mondayOf } from '../../lib/calendar'
import { listSlots, pendingRequests } from '../../lib/rules'
import Button from '../common/Button'
import Chip from '../common/Chip'
import { Empty, Row } from '../common/Card'
import { ErrorText } from '../common/fields'
import Modal, { ModalGroup } from '../common/Modal'
import { DateBlock, SeatsEnd } from '../common/SeatDots'
import RequestMini from './RequestMini'

export function UpcomingModal({ onClose }: { onClose: () => void }) {
  const { data, now } = useTeacherData()
  const navigate = useNavigate()
  const today = toISODate(now)
  const list = listSlots(teacherWorld(data), data.teacher, today, 56, now)
  const thisWeek = mondayOf(today)
  const nextWeek = toISODate(addDays(parseISODate(thisWeek), 7))
  const booked = list.reduce((sum, o) => sum + o.row.taken, 0)
  const max = data.teacher.max

  const go = (path: string) => {
    onClose()
    navigate(path)
  }

  const headingFor = (index: number): string | null => {
    const week = mondayOf(list[index].date)
    if (index > 0 && mondayOf(list[index - 1].date) === week) return null
    if (week === thisWeek) return 'This week'
    if (week === nextWeek) return 'Next week'
    return `Week of ${formatMonthDay(week)}`
  }

  return (
    <Modal
      title="Upcoming office hours"
      subtitle={`${plural(list.length, 'office hour')} in the next 8 weeks · ${plural(booked, 'seat')} booked`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={() => go('/teacher/office-hours')}>Edit office hours</Button>
          <Button variant="primary" onClick={() => go('/teacher/calendar')}>
            Open calendar
          </Button>
        </>
      }
    >
      {list.length === 0 && <Empty flush>No upcoming office hours.</Empty>}
      {list.map((o, i) => {
        const heading = headingFor(i)
        return (
          <div key={`${o.date}-${o.row.timing.id}`}>
            {heading && <ModalGroup>{heading}</ModalGroup>}
            <Row first={!heading && i === 0} top>
              <DateBlock date={o.date} />
              <div className="min-w-0 flex-[1_1_180px]">
                <div className="text-[15px] font-bold">
                  {o.row.timing.name} &middot; {formatRange(o.row.timing.start, o.row.timing.end)}
                </div>
                {o.row.bookings.length === 0 ? (
                  <div className="mt-0.5 text-[13px] text-muted">No one has booked yet.</div>
                ) : (
                  <ul className="mt-2 flex list-none flex-col gap-1.5 p-0">
                    {o.row.bookings.map((b) => (
                      <li key={b.id} className="rounded-lg bg-soft px-2.5 py-1.5 text-[13px] leading-[1.4]">
                        <b>{b.studentName}</b> <span className="text-muted">&middot; Seat {b.seat}</span>
                        <span className="block text-ink2">{b.reason}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <SeatsEnd taken={o.row.taken} max={max} />
            </Row>
          </div>
        )
      })}
    </Modal>
  )
}

export function RequestsModal({ onClose }: { onClose: () => void }) {
  const { data, answerRequest } = useTeacherData()
  const { run, error, pending, isPending } = useAction()
  const navigate = useNavigate()
  const pend = pendingRequests(data.requests, data.teacher.id)
  const done = data.requests
    .filter((r) => r.teacherId === data.teacher.id && r.status !== 'pending')
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))

  return (
    <Modal
      title="Open requests"
      subtitle={pend.length ? `${plural(pend.length, 'student')} asked for a time outside your office hours` : 'Nothing waiting'}
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          onClick={() => {
            onClose()
            navigate('/teacher/requests?tab=requests')
          }}
        >
          Open Booking requests
        </Button>
      }
    >
      <div className="pt-2">
        <ErrorText>{error}</ErrorText>
      </div>
      {pend.length === 0 ? (
        <Empty flush>No open requests. You&rsquo;re all caught up.</Empty>
      ) : (
        pend.map((r, i) => (
          <RequestMini
            key={r.id}
            request={r}
            first={i === 0}
            disabled={pending}
            busy={isPending(`accepted:${r.id}`) ? 'accepted' : isPending(`declined:${r.id}`) ? 'declined' : null}
            onAnswer={(answer) =>
              run(`${answer}:${r.id}`, () => answerRequest(r.id, answer), answer === 'accepted' ? 'Request accepted.' : 'Request declined.')
            }
          />
        ))
      )}
      {done.length > 0 && (
        <>
          <ModalGroup>Answered</ModalGroup>
          {done.map((r, i) => (
            <Row key={r.id} first={i === 0} top>
              <div className="min-w-0 flex-[1_1_180px]">
                <div className="text-[15px] font-bold">{r.studentName}</div>
                <div className="mt-0.5 text-[13px] text-muted">
                  {formatDateShort(r.date)} &middot; {formatTime(r.time)}
                </div>
                <div className="mt-1 text-[13px] text-ink2">{r.reason}</div>
              </div>
              {r.status === 'accepted' ? <Chip>Accepted</Chip> : <Chip kind="past">Declined</Chip>}
            </Row>
          ))}
        </>
      )}
    </Modal>
  )
}
