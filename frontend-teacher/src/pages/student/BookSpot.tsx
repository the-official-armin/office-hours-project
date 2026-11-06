// Owner: Subgroup B (Teacher desktop UI). Purpose: pick a day on a teacher's calendar and book a spot in one of that day's
// office hours (no seat numbers), or ask for a different time.
// The backend enforces every rule; the UI pre-validates with src/lib/rules.ts and shows the backend's message if it refuses.
import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { RuleError } from '../../api/errors'
import Banner from '../../components/common/Banner'
import Button, { LinkButton } from '../../components/common/Button'
import { CalendarControls, CalendarGrid, CalendarLegend, type DayRender, type MiniRender } from '../../components/common/Calendar'
import Card, { Eyebrow } from '../../components/common/Card'
import { ErrorText, Field, TextArea, TextInput } from '../../components/common/fields'
import Icon from '../../components/common/Icon'
import PageHeader from '../../components/common/PageHeader'
import { useToast } from '../../components/common/Toast'
import OfficeHourCard from '../../components/student/OfficeHourCard'
import { spotWorld, useStudentData } from '../../hooks/StudentData'
import { useAction } from '../../hooks/useAction'
import { initialCal, mondayOf, monthOf, type CalState } from '../../lib/calendar'
import { formatDateLong, formatRange, isValidISODate, plural, toISODate } from '../../lib/dates'
import { checkRequest, errorOf, firstBookableDay, officeHourState, slotRows, studentDay } from '../../lib/rules'
import { daysText } from '../../lib/text'
import type { Teacher } from '../../types'

interface Done {
  date: string
  slotName: string
  time: string
}

function BookSpotFor({ teacher: t }: { teacher: Teacher }) {
  const { data, now, bookSpot, cancelBooking, sendRequest, refresh } = useStudentData()
  const [params] = useSearchParams()
  const toast = useToast()
  const asking = useAction()
  const cancelling = useAction()

  const me = data.settings
  const world = spotWorld(data)
  const today = toISODate(now)

  const [cal, setCal] = useState<CalState>(() => {
    const asked = params.get('day')
    const day = asked && isValidISODate(asked) ? asked : firstBookableDay(world, t, today, now)
    return { ...initialCal(today, day), month: monthOf(day), wk: mondayOf(day) }
  })
  const [composing, setComposing] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)
  const [fullFor, setFullFor] = useState<string | null>(null)
  const [otherError, setOtherError] = useState<{ timingId: string; text: string } | null>(null)
  const [done, setDone] = useState<Done | null>(null)
  const [reqOpen, setReqOpen] = useState(false)
  const [reqSent, setReqSent] = useState(false)
  const [reqProblem, setReqProblem] = useState('')
  const [req, setReq] = useState({ date: '', time: '15:45', reason: '' })
  const [scrollTick, setScrollTick] = useState(0)

  const asideRef = useRef<HTMLElement>(null)
  const doneRef = useRef<HTMLHeadingElement>(null)
  const requestRef = useRef<HTMLDivElement>(null)

  // On a phone the day panel sits below the calendar, so bring it into view after a day is picked or a spot is booked.
  useEffect(() => {
    if (scrollTick > 0 && window.innerWidth < 900) asideRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [scrollTick])

  useEffect(() => {
    if (done) doneRef.current?.focus()
  }, [done])

  const day = cal.sel ?? today

  const selectDay = (date: string) => {
    setCal((c) => ({ ...c, sel: date }))
    setComposing(null)
    setFullFor(null)
    setOtherError(null)
    setDone(null)
    setReqSent(false)
    setScrollTick((n) => n + 1)
  }

  const describe = (date: string) => {
    const s = studentDay(world, t, date, now, me.id)
    const tail = s.past
      ? ', past'
      : s.off
        ? ', teacher is out'
        : s.selectable
          ? s.full
            ? ', full'
            : s.bookable
              ? `, ${plural(s.left, 'spot')} left`
              : ', already started'
          : ', no office hours'
    return { s, aria: `${formatDateLong(date)}${tail}${s.mine ? ', you have a booking' : ''}` }
  }

  const renderDay = (date: string, view: 'week' | 'month'): DayRender => {
    const { s, aria } = describe(date)
    let content
    if (view === 'week') {
      content = s.off ? (
        <span className="self-start rounded-lg bg-amber px-2 py-1 text-xs font-bold text-amber-ink">Teacher is out</span>
      ) : s.rows.length === 0 ? (
        <span className="text-[13px] text-muted">No office hours</span>
      ) : (
        s.rows.map((r) => {
          const mine = r.bookings.some((b) => b.studentId === me.id)
          const status = mine ? 'Your booking' : s.past || r.started ? 'Started' : r.left <= 0 ? 'Full' : `${plural(r.left, 'spot')} left`
          const tone = mine
            ? 'bg-brand text-on-brand'
            : s.past || r.started
              ? 'border border-line bg-past text-past-ink'
              : r.left <= 0
                ? 'bg-amber text-amber-ink'
                : 'bg-tint text-tint-ink'
          return (
            <span key={r.timing.id} className={`flex min-w-0 flex-col gap-[3px] rounded-[10px] p-2 text-xs leading-[1.3] [overflow-wrap:anywhere] ${tone}`}>
              <b className="text-[13px] font-extrabold">{r.timing.name}</b>
              <span>{formatRange(r.timing.start, r.timing.end)}</span>
              <span className="font-bold">{status}</span>
            </span>
          )
        })
      )
    } else {
      const chip = 'max-w-full self-start rounded-lg px-2 py-1 text-xs font-bold leading-tight max-[640px]:rounded-md max-[640px]:px-1 max-[640px]:py-[3px] max-[640px]:text-[10.5px]'
      content = (
        <>
          {s.off && <span className={`${chip} bg-amber text-amber-ink`}>Day off</span>}
          {s.selectable && s.mine && (
            <span className={`${chip} bg-brand text-on-brand`}>
              <span className="max-[640px]:hidden">Your booking</span>
              <span className="hidden max-[640px]:inline">Yours</span>
            </span>
          )}
          {s.selectable &&
            (!s.bookable ? (
              <span className={`${chip} border border-line bg-past text-past-ink`}>
                <span className="max-[640px]:hidden">Started</span>
                <span className="hidden max-[640px]:inline">Past</span>
              </span>
            ) : s.full ? (
              <span className={`${chip} bg-amber text-amber-ink`}>Full</span>
            ) : (
              <span className={`${chip} bg-tint text-tint-ink`}>
                <span className="max-[640px]:hidden">{plural(s.left, 'spot')} left</span>
                <span className="hidden max-[640px]:inline">{s.left} left</span>
              </span>
            ))}
        </>
      )
    }
    return { aria, content, past: s.past, disabled: !s.selectable }
  }

  const renderMini = (date: string): MiniRender => {
    const { s, aria } = describe(date)
    const status = s.off ? 'off' : s.past ? 'past' : s.rows.length === 0 ? 'none' : !s.bookable ? 'past' : s.full ? 'full' : 'open'
    return { status, aria, dot: s.mine, disabled: !s.selectable }
  }

  const confirm = async (timingId: string) => {
    setConfirming(timingId)
    setOtherError(null)
    setFullFor(null)
    try {
      await bookSpot({ teacherId: t.id, date: day, timingId, reason })
      const x = t.timings.find((y) => y.id === timingId)!
      toast('Spot booked.')
      setDone({ date: day, slotName: x.name, time: formatRange(x.start, x.end) })
      setComposing(null)
      setReason('')
      setScrollTick((n) => n + 1)
    } catch (err) {
      if (err instanceof RuleError && err.code === 'full') {
        // Someone took the last spot while this form was open. Show the real numbers, keep what the student typed.
        setFullFor(timingId)
        setComposing(null)
        await refresh().catch(() => undefined)
      } else {
        setOtherError({ timingId, text: err instanceof Error ? err.message : 'Something went wrong. Try again.' })
        await refresh().catch(() => undefined)
      }
    } finally {
      setConfirming(null)
    }
  }

  const cancelHere = async (id: string) => {
    await cancelling.run(id, () => cancelBooking(id), 'Booking cancelled.')
  }

  const askForRequest = () => {
    setReqOpen(true)
    setReqSent(false)
    setReq((r) => ({ ...r, date: day >= today ? day : '' }))
    requestAnimationFrame(() => {
      requestRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      requestRef.current?.querySelector<HTMLInputElement>('input[type=date]')?.focus()
    })
  }

  const send = async () => {
    const attempt = { teacherId: t.id, date: req.date, time: req.time, reason: req.reason }
    const found = errorOf(checkRequest(world, attempt, now))
    if (found) {
      setReqProblem(found)
      return
    }
    setReqProblem('')
    const sent = await asking.run('send', () => sendRequest(attempt), 'Request sent.')
    if (sent) {
      setReqOpen(false)
      setReqSent(true)
      setReq({ date: '', time: '15:45', reason: '' })
    }
  }

  // The day panel.
  const past = day < today
  const off = t.daysOff.find((d) => d.date === day)
  const rows = slotRows(world, t, day, now)
  const timingNames = t.timings
    .filter((x) => !x.gone)
    .map((x) => x.name.toLowerCase())
    .join(' and ')

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/student/teachers" className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-link no-underline">
            <Icon name="left" size={16} strokeWidth={2} />
            All teachers
          </Link>
          <h1 className="mt-1 text-balance text-2xl font-extrabold tracking-tight min-[900px]:text-[28px]">Book a spot with {t.name}</h1>
          <p className="mt-1.5 text-[15px] text-muted">
            {t.subject} &middot; {daysText(t)}, {timingNames}
          </p>
        </div>
        <CalendarControls cal={cal} today={today} onChange={setCal} />
      </header>

      <div className="flex flex-wrap items-start gap-6 [&>*]:min-w-0">
        <Card aria-label="Pick a day" className="flex-[999_1_520px] !p-3 min-[900px]:!p-5">
          <CalendarGrid cal={cal} today={today} onSelect={selectDay} renderDay={renderDay} renderMini={renderMini} />
          <CalendarLegend
            entries={[
              { swatch: 'bg-tint', label: 'Spots open' },
              { swatch: 'bg-amber', label: 'Full or day off' },
              { swatch: 'border border-edge bg-past', label: 'Past, can’t be booked' },
            ]}
            extra={
              <span className="inline-flex items-center gap-2">
                <i className="inline-block h-3.5 w-3.5 rounded bg-brand" />
                Your booking
              </span>
            }
          />
        </Card>

        {done ? (
          <aside
            ref={asideRef}
            aria-labelledby="done-h"
            className="flex max-w-[430px] min-w-0 flex-[1_1_340px] flex-col gap-3.5 rounded-2xl border border-line bg-surface p-[18px] min-[900px]:p-6 max-[900px]:max-w-none"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-tint text-tint-ink">
              <Icon name="check" size={22} strokeWidth={2.2} />
            </div>
            <h2 id="done-h" ref={doneRef} tabIndex={-1} className="text-xl font-extrabold outline-none">
              You&rsquo;re booked
            </h2>
            <div className="rounded-xl bg-soft px-3.5 py-3 text-sm leading-[1.6] text-ink2">
              <b className="text-ink">
                {formatDateLong(done.date)} &middot; {done.slotName} {done.time}
              </b>
              <div>With {t.name}</div>
            </div>
            <p className="leading-normal text-ink2">
              {me.remind ? `We’ll email you a reminder ${me.lead} before. ` : 'Email reminders are off in your settings. '}
              You can cancel any time from My bookings.
            </p>
            <LinkButton to="/student/bookings" variant="primary" block>
              View my bookings
            </LinkButton>
            <Button block onClick={() => setDone(null)}>
              Book another spot
            </Button>
          </aside>
        ) : (
          <aside
            ref={asideRef}
            aria-labelledby="pick-h"
            className="flex max-w-[430px] min-w-0 flex-[1_1_340px] flex-col gap-5 rounded-2xl border border-line bg-surface p-[18px] min-[900px]:p-6 max-[900px]:max-w-none"
          >
            <div>
              <Eyebrow>Selected day</Eyebrow>
              <h2 id="pick-h" className="mt-1 text-xl font-extrabold">
                {formatDateLong(day)}
              </h2>
            </div>

            {past ? (
              <div className="rounded-xl bg-tint px-4 py-3 text-sm font-semibold text-tint-ink">This day has passed. Pick a day from today on.</div>
            ) : off ? (
              <Banner kind="warn">
                {t.name} is out on this day ({off.reason}). Pick another day.
              </Banner>
            ) : rows.length === 0 ? (
              <div className="rounded-xl bg-tint px-4 py-3 text-sm font-semibold text-tint-ink">{t.name} has no office hours this day.</div>
            ) : (
              <>
                {rows.map((r) => (
                  <OfficeHourCard
                    key={r.timing.id}
                    teacher={t}
                    row={r}
                    date={day}
                    state={officeHourState(world, t, r, day, me.id)}
                    studentId={me.id}
                    composing={composing === r.timing.id}
                    reason={reason}
                    onReason={setReason}
                    onStart={() => {
                      setComposing(r.timing.id)
                      setFullFor(null)
                      setOtherError(null)
                    }}
                    onBack={() => setComposing(null)}
                    onConfirm={() => void confirm(r.timing.id)}
                    confirming={confirming === r.timing.id}
                    notice={
                      fullFor === r.timing.id
                        ? 'That office hour just filled up.'
                        : otherError?.timingId === r.timing.id
                          ? otherError.text
                          : undefined
                    }
                    onCancelBooking={cancelHere}
                    onAskRequest={askForRequest}
                  />
                ))}
                <ErrorText>{cancelling.error}</ErrorText>
              </>
            )}

            <div ref={requestRef} className="flex flex-col gap-3 border-t border-line pt-4">
              <Button
                aria-expanded={reqOpen}
                className="!h-auto self-start !py-2.5 text-center"
                onClick={() => {
                  setReqOpen((o) => !o)
                  setReqSent(false)
                  setReqProblem('')
                  asking.setError(null)
                }}
              >
                Need a different time? Send a request
              </Button>
              {reqOpen && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-3 [&>*]:flex-[1_1_140px]">
                    <Field label="Date">
                      <TextInput type="date" min={today} value={req.date} onChange={(e) => setReq({ ...req, date: e.target.value })} />
                    </Field>
                    <Field label="Time">
                      <TextInput type="time" value={req.time} onChange={(e) => setReq({ ...req, time: e.target.value })} />
                    </Field>
                  </div>
                  <Field label="Why do you need this time?">
                    <TextArea rows={2} value={req.reason} onChange={(e) => setReq({ ...req, reason: e.target.value })} />
                  </Field>
                  <ErrorText>{reqProblem || asking.error}</ErrorText>
                  <Button variant="primary" loading={asking.isPending('send')} onClick={() => void send()}>
                    Send request to {t.name}
                  </Button>
                </div>
              )}
              {reqSent && (
                <p role="status" className="font-semibold text-tint-ink">
                  Request sent. You&rsquo;ll see the answer in My bookings.
                </p>
              )}
            </div>
          </aside>
        )}
      </div>
    </>
  )
}

export default function BookSpot() {
  const { teacherId } = useParams()
  const { data } = useStudentData()
  const teacher = data.teachers.find((t) => t.id === teacherId)

  if (!teacher) {
    return (
      <>
        <PageHeader title="Teacher not found" subtitle="That teacher is not in the list." />
        <Card>
          <LinkButton to="/student/teachers" variant="primary">
            All teachers
          </LinkButton>
        </Card>
      </>
    )
  }
  // Remount when the teacher changes so the calendar and the form start fresh.
  return <BookSpotFor key={teacher.id} teacher={teacher} />
}
