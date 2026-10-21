// Owner: Subgroup B (Teacher desktop UI). Purpose: mark and remove days off, with a confirmation when bookings are affected.
// Bookings on a new day off are kept, never deleted; students are told. The backend blocks bookings on days off.
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Banner, { ConfirmBar } from '../../components/common/Banner'
import Button from '../../components/common/Button'
import Card, { CardTitle, Empty, Row } from '../../components/common/Card'
import Chip from '../../components/common/Chip'
import { ErrorText, Field, TextInput } from '../../components/common/fields'
import PageHeader from '../../components/common/PageHeader'
import { DateBlock } from '../../components/common/SeatDots'
import { teacherWorld, useTeacherData } from '../../hooks/TeacherData'
import { useAction } from '../../hooks/useAction'
import { formatDateLong, plural, toISODate } from '../../lib/dates'
import { affectedOn, checkDayOff, errorOf } from '../../lib/rules'

export default function DaysOff() {
  const { data, now, addDayOff, removeDayOff } = useTeacherData()
  const { run, error, setError, pending, isPending } = useAction()
  const [params] = useSearchParams()

  const t = data.teacher
  const world = teacherWorld(data)
  const today = toISODate(now)

  const [date, setDate] = useState(params.get('date') ?? '')
  const [reason, setReason] = useState('')
  const [problem, setProblem] = useState('')
  const [confirm, setConfirm] = useState(0)
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (confirm > 0) confirmRef.current?.focus()
  }, [confirm])

  const upcoming = t.daysOff.filter((d) => d.date >= today)

  const reset = () => {
    setConfirm(0)
    setProblem('')
    setError(null)
  }

  const apply = async () => {
    const added = await run('add', () => addDayOff({ date, reason }), 'Day off added.')
    if (added) {
      setDate('')
      setReason('')
      reset()
    }
  }

  const submit = () => {
    reset()
    const problemText = errorOf(checkDayOff(t, date, now))
    if (problemText) {
      setProblem(problemText)
      return
    }
    const n = affectedOn(world, t.id, date, now).length
    if (n > 0) setConfirm(n)
    else void apply()
  }

  return (
    <>
      <PageHeader title="Days off" subtitle="Students can&rsquo;t book any office hour on these days." />

      <div className="flex flex-wrap items-start gap-6 [&>*]:min-w-0">
        <Card aria-labelledby="list-h" className="flex-[3_1_460px]">
          <h2 id="list-h" className="pb-3 text-lg font-extrabold">
            Upcoming days off
          </h2>
          {upcoming.length === 0 ? (
            <Empty>No days off are set. Students can book every office hour.</Empty>
          ) : (
            upcoming.map((d) => {
              const n = affectedOn(world, t.id, d.date, now).length
              return (
                <Row key={d.date}>
                  <DateBlock date={d.date} kind="amber" />
                  <div className="min-w-0 flex-[1_1_180px]">
                    <div className="text-[15px] font-bold">{formatDateLong(d.date)}</div>
                    <div className="mt-0.5 text-[13px] text-muted">{d.reason}</div>
                  </div>
                  <Chip kind={n ? 'amber' : 'tint'}>{n ? `${plural(n, 'booking')} affected` : 'No bookings'}</Chip>
                  <Button
                    disabled={pending}
                    loading={isPending(`rm:${d.date}`)}
                    aria-label={`Remove the day off on ${formatDateLong(d.date)}`}
                    onClick={() => run(`rm:${d.date}`, () => removeDayOff(d.date), 'Day off removed.')}
                  >
                    Remove
                  </Button>
                </Row>
              )
            })
          )}
        </Card>

        <Card aria-labelledby="add-h" className="flex flex-[2_1_320px] flex-col gap-4">
          <CardTitle id="add-h">Add a day off</CardTitle>
          <Field label="Date">
            <TextInput
              type="date"
              min={today}
              value={date}
              onChange={(e) => {
                setDate(e.target.value)
                reset()
              }}
            />
          </Field>
          <Field label="Reason (optional)">
            <TextInput
              type="text"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                setProblem('')
              }}
            />
          </Field>
          <ErrorText>{problem || error}</ErrorText>
          {confirm > 0 ? (
            <ConfirmBar message={`${plural(confirm, 'booking')} on ${formatDateLong(date)}. Students will be told that you’re out.`}>
              <Button ref={confirmRef} variant="primary" loading={isPending('add')} onClick={() => void apply()}>
                Add day off
              </Button>
              <Button disabled={isPending('add')} onClick={() => setConfirm(0)}>
                Cancel
              </Button>
            </ConfirmBar>
          ) : (
            <Button variant="primary" loading={isPending('add')} onClick={submit}>
              Add day off
            </Button>
          )}
          <Banner kind="warn">If students already booked that day, you&rsquo;ll see how many bookings are affected before you confirm.</Banner>
        </Card>
      </div>
    </>
  )
}
