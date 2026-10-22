// Owner: Subgroup B (Teacher desktop UI). Purpose: Week / Month / Quarter calendar of office hours, seats and students,
// with a panel for the selected day.
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Banner from '../../components/common/Banner'
import Button from '../../components/common/Button'
import { CalendarControls, CalendarGrid, CalendarLegend, type DayRender, type MiniRender } from '../../components/common/Calendar'
import Card from '../../components/common/Card'
import { Eyebrow } from '../../components/common/Card'
import { ErrorText } from '../../components/common/fields'
import PageHeader from '../../components/common/PageHeader'
import { SeatDots } from '../../components/common/SeatDots'
import StudentBox from '../../components/teacher/StudentBox'
import { teacherWorld, useTeacherData } from '../../hooks/TeacherData'
import { useAction } from '../../hooks/useAction'
import { initialCal, mondayOf, type CalState } from '../../lib/calendar'
import { DOW_LONG, formatDateLong, formatRange, isValidISODate, parseISODate, toISODate } from '../../lib/dates'
import { disruption, firstOfficeDay, isOff, slotRows, type SlotRow } from '../../lib/rules'
import type { Teacher } from '../../types'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function aria(t: Teacher, date: string, rows: SlotRow[], off: boolean): string {
  const d = parseISODate(date)
  const day = `${DOW_LONG[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`
  if (off) return `${day}, day off`
  if (rows.length === 0) return `${day}, no office hours`
  return `${day}, ${rows.map((r) => `${r.timing.name} ${r.taken} of ${t.max}`).join(', ')}`
}

export default function TeacherCalendar() {
  const { data, now, removeDayOff } = useTeacherData()
  const { run, error } = useAction()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const t = data.teacher
  const world = teacherWorld(data)
  const today = toISODate(now)

  const [cal, setCal] = useState<CalState>(() => {
    const day = params.get('day')
    if (day && isValidISODate(day)) return { ...initialCal(today, day), view: 'week', wk: mondayOf(day) }
    return initialCal(today, firstOfficeDay(world, t, today, now))
  })

  const selected = cal.sel ?? today
  const select = (date: string) => setCal((c) => ({ ...c, sel: date }))

  const renderDay = (date: string, view: 'week' | 'month'): DayRender => {
    const past = date < today
    const off = isOff(t, date)
    const rows = slotRows(world, t, date, now)
    const reason = t.daysOff.find((d) => d.date === date)?.reason
    let content
    if (view === 'week') {
      content = off ? (
        <span className="self-start rounded-lg bg-amber px-2 py-1 text-xs font-bold text-amber-ink">Day off &middot; {reason}</span>
      ) : rows.length === 0 ? (
        <span className="text-[13px] text-muted">No office hours</span>
      ) : (
        rows.map((r) => {
          const full = r.taken >= t.max
          const tone = past || r.started ? 'border border-line bg-past text-past-ink' : full ? 'bg-amber text-amber-ink' : 'bg-tint text-tint-ink'
          return (
            <span key={r.timing.id} className={`flex min-w-0 flex-col gap-[3px] rounded-[10px] p-2 text-xs leading-[1.3] [overflow-wrap:anywhere] ${tone}`}>
              <b className="text-[13px] font-extrabold">{r.timing.name}</b>
              <span>{formatRange(r.timing.start, r.timing.end)}</span>
              <span className="flex flex-wrap items-center gap-1.5 font-bold">
                <SeatDots taken={r.taken} max={t.max} small /> {r.taken}/{t.max}
              </span>
              {r.bookings.length > 0 && <span className="font-medium text-ink2">{r.bookings.map((b) => b.studentName).join(', ')}</span>}
            </span>
          )
        })
      )
    } else {
      content = (
        <>
          {off && <span className="self-start rounded-lg bg-amber px-2 py-1 text-xs font-bold text-amber-ink">Day off</span>}
          {!off &&
            rows.map((r) => {
              if (past && r.taken === 0) return null
              const full = r.taken >= t.max
              const count = full ? 'Full' : `${r.taken}/${t.max}`
              const tone = past || r.started ? 'border border-line bg-past text-past-ink' : full ? 'bg-amber text-amber-ink' : 'bg-tint text-tint-ink'
              return (
                <span key={r.timing.id} className={`max-w-full self-stretch rounded-lg px-2 py-1 text-xs font-bold leading-tight [overflow-wrap:anywhere] max-[640px]:rounded-md max-[640px]:px-1 max-[640px]:py-[3px] max-[640px]:text-[10.5px] ${tone}`}>
                  <span className="max-[640px]:hidden">
                    {r.timing.name} &middot; {count}
                  </span>
                  <span className="hidden max-[640px]:inline">
                    {r.timing.name.charAt(0).toUpperCase()} {count}
                  </span>
                </span>
              )
            })}
        </>
      )
    }
    return { aria: aria(t, date, rows, off), content, past }
  }

  const renderMini = (date: string): MiniRender => {
    const past = date < today
    const off = isOff(t, date)
    const rows = slotRows(world, t, date, now)
    const status = off ? 'off' : past ? 'past' : rows.length === 0 ? 'none' : rows.every((r) => r.taken >= t.max) ? 'full' : 'open'
    return { status, aria: aria(t, date, rows, off), dot: !past && !off && rows.some((r) => r.taken > 0) }
  }

  // The selected day's panel.
  const past = selected < today
  const off = isOff(t, selected)
  const rows = slotRows(world, t, selected, now)
  const rowIds = rows.map((r) => r.timing.id)
  const orphans = data.bookings.filter((b) => b.date === selected && b.status === 'confirmed' && !rowIds.includes(b.timingId))
  const reason = t.daysOff.find((d) => d.date === selected)?.reason
  const legend = t.timings
    .filter((x) => !x.gone)
    .map((x) => `${x.name.charAt(0).toUpperCase()} = ${x.name}`)
    .join(', ')

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle="See every office hour and who is coming."
        actions={<CalendarControls cal={cal} today={today} onChange={setCal} />}
      />

      <div className="flex flex-wrap items-start gap-6 [&>*]:min-w-0">
        <Card
          className="flex-[999_1_520px] !p-3 min-[900px]:!p-5"
          aria-label={`${cal.view === 'week' ? 'Week' : cal.view === 'month' ? 'Month' : 'Quarter'} calendar`}
        >
          <CalendarGrid cal={cal} today={today} onSelect={select} renderDay={renderDay} renderMini={renderMini} />
          <CalendarLegend
            extra={
              cal.view === 'quarter' ? (
                <span className="inline-flex items-center gap-2">
                  <i className="inline-block h-2 w-2 rounded-full bg-brand" />
                  Students booked
                </span>
              ) : undefined
            }
          />
          {cal.view === 'month' && legend && <div className="pt-2 text-[13px] text-muted min-[641px]:hidden">{legend}</div>}
        </Card>

        <aside
          aria-labelledby="day-h"
          className="flex min-w-0 max-w-[380px] flex-[1_1_300px] flex-col gap-5 rounded-2xl border border-line bg-surface p-[18px] min-[900px]:p-6 max-[900px]:max-w-none"
        >
          <div>
            <Eyebrow>Selected day</Eyebrow>
            <h2 id="day-h" className="mt-1 text-xl font-extrabold">
              {formatDateLong(selected)}
            </h2>
          </div>

          {off && <Banner kind="warn">Day off &middot; {reason}. Students can&rsquo;t book this day.</Banner>}
          {rows.length === 0 && orphans.length === 0 && (
            <div className="rounded-xl bg-tint px-4 py-3 text-sm font-semibold text-tint-ink">No office hours this day.</div>
          )}

          {rows.map((r, i) => (
            <div key={r.timing.id} className={`flex flex-col gap-2.5 ${i ? 'border-t border-line pt-5' : ''}`}>
              <div className="flex items-baseline justify-between gap-2">
                <b className="text-[15px]">{r.timing.name}</b>
                <span className="text-[13px] text-muted">{formatRange(r.timing.start, r.timing.end)}</span>
              </div>
              <div className="flex items-center gap-2 text-[13px] font-semibold text-muted">
                <SeatDots taken={r.taken} max={t.max} />
                <span className="ml-1 tabular-nums">
                  {r.taken} of {t.max} seats
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {r.bookings.length === 0 ? (
                  <div className="text-[13px] text-muted">{past ? 'No one booked this one.' : 'No one has booked yet.'}</div>
                ) : (
                  r.bookings.map((b) => <StudentBox key={b.id} booking={b} disrupted={disruption(world, b)} />)
                )}
              </div>
            </div>
          ))}

          {orphans.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-line pt-3">
              <Eyebrow>Booked, but no longer held</Eyebrow>
              {orphans.map((b) => (
                <StudentBox key={b.id} booking={b} disrupted={disruption(world, b)} />
              ))}
            </div>
          )}

          <ErrorText>{error}</ErrorText>
          {!past &&
            (off ? (
              <Button block onClick={() => run('rm', () => removeDayOff(selected), 'Day off removed.')}>
                Remove this day off
              </Button>
            ) : (
              <Button block onClick={() => navigate(`/teacher/days-off?date=${selected}`)}>
                Mark this day off
              </Button>
            ))}
        </aside>
      </div>
    </>
  )
}
