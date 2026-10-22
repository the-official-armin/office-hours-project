// Owner: Subgroup B (Teacher desktop UI). Purpose: search and filter the teachers, and see each one's next open seat.
import { useState } from 'react'
import { LinkButton } from '../../components/common/Button'
import Card from '../../components/common/Card'
import Chip from '../../components/common/Chip'
import { Field, TextInput } from '../../components/common/fields'
import PageHeader from '../../components/common/PageHeader'
import { Pill } from '../../components/common/Button'
import { SeatDots } from '../../components/common/SeatDots'
import { seatWorld, useStudentData } from '../../hooks/StudentData'
import { formatDateShort, plural, toISODate } from '../../lib/dates'
import { listSlots } from '../../lib/rules'
import { daysText, teacherInitial, timesText } from '../../lib/text'
import type { Teacher } from '../../types'

export default function FindTeacher() {
  const { data, now } = useStudentData()
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('All')

  const seats = seatWorld(data)
  const today = toISODate(now)
  const groups = ['All', ...Array.from(new Set(data.teachers.map((t) => t.group)))]

  const q = query.trim().toLowerCase()
  const list = data.teachers.filter(
    (t) => (group === 'All' || t.group === group) && (!q || `${t.name} ${t.subject}`.toLowerCase().includes(q)),
  )

  const nextSeat = (t: Teacher) => {
    const slots = listSlots(seats, t, today, 120, now)
    const first = slots[0]
    const open = slots.find((o) => o.row.left > 0)
    if (!first) return <div className="text-[13px] text-muted">No upcoming office hours</div>
    if (!open) {
      return (
        <>
          <div className="text-sm font-bold">No open seats</div>
          <div>
            <Chip kind="amber">Full for the next 4 months</Chip>
          </div>
        </>
      )
    }
    return (
      <>
        <div className="text-sm font-bold">
          {formatDateShort(open.date)} &middot; {open.row.timing.name}
        </div>
        <div className="flex items-center gap-2 text-[13px] font-semibold text-muted">
          <SeatDots taken={open.row.taken} max={t.max} />
          <span>{plural(open.row.left, 'seat')} left</span>
        </div>
        {first.row.left <= 0 && (
          <div>
            <Chip kind="amber">Full on the next office hour</Chip>
          </div>
        )}
      </>
    )
  }

  return (
    <>
      <PageHeader title="Find a teacher" subtitle="Pick a teacher to see their office hours and book a seat." />

      <section aria-label="Search and filter" className="flex flex-wrap items-end gap-4">
        <Field label="Search by name or subject" className="max-w-[420px] flex-[1_1_260px]">
          <TextInput type="search" autoComplete="off" placeholder="For example, Chemistry" value={query} onChange={(e) => setQuery(e.target.value)} />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span id="subject-h" className="text-[13px] font-bold text-ink2">
            Subject
          </span>
          <div role="group" aria-labelledby="subject-h" className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <Pill key={g} pressed={g === group} onClick={() => setGroup(g)}>
                {g}
              </Pill>
            ))}
          </div>
        </div>
      </section>

      <section aria-label="Teachers">
        {list.length === 0 ? (
          <Card>
            <p className="text-muted">No teachers match that search. Try another name or choose All.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-4">
            {list.map((t) => (
              <Card key={t.id} className="flex flex-col gap-3.5 !p-5">
                <div className="flex items-center gap-3">
                  <div
                    aria-hidden="true"
                    className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-tint text-[15px] font-extrabold text-tint-ink"
                  >
                    {teacherInitial(t.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-extrabold">{t.name}</div>
                    <div className="mt-0.5 text-[13px] text-muted">{t.subject}</div>
                  </div>
                </div>
                <div className="flex flex-col gap-1 text-[13px] text-ink2">
                  <div className="font-bold">{daysText(t)}</div>
                  <div>{timesText(t)}</div>
                </div>
                <div className="mt-auto flex flex-col gap-2 border-t border-line pt-3.5">
                  <div className="text-xs font-bold uppercase tracking-[.05em] text-muted">Next open seat</div>
                  {nextSeat(t)}
                </div>
                <LinkButton to={`/student/teachers/${t.id}`} variant="primary" block aria-label={`Book a seat with ${t.name}`}>
                  Book a seat
                </LinkButton>
              </Card>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
